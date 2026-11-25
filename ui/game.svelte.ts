/**
 * UI-side engine: owns the GameState, runs the fixed-tick loop, saves, and handles
 * offline catch-up. The sim itself stays pure; this file is the only bridge.
 */
import {
  WORLD, advanceAsync, createState, deserialize, emptyReport, serialize, splitOffline, summarize, tick, type GameState, type Report,
} from '../sim';
import { season as seasonOf } from '../sim';
import { setHidden, setSeason, setVolumes, sfx, unlock, type Sfx } from './audio';

const SAVE_KEY = 'aphelion.save.v1';
const MAX_CATCHUP_LIVE = 60; // seconds handled silently by the live loop

export type Tab = 'colony' | 'crew' | 'lab' | 'works' | 'legacy';
export type Sheet =
  | { kind: 'resource'; id: string }
  | { kind: 'building'; id: string }
  | { kind: 'stores' }
  | { kind: 'log' }
  | { kind: 'settings' }
  | { kind: 'rebuild' }
  | { kind: 'ascend' }
  | null;

export interface AwayReport {
  seconds: number;
  simulated: number;
  reserve: number;
  gained: Record<string, number>;
  pop: number;
  events: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: string;
}

export const ui = $state({
  t: 0,
  tab: 'colony' as Tab,
  sheet: null as Sheet,
  catchup: null as null | { progress: number; seconds: number },
  away: null as AwayReport | null,
  toasts: [] as Toast[],
  saveError: '' as string,
});

export const engine = {
  state: createState((Math.random() * 2 ** 32) >>> 0) as GameState,
  report: emptyReport() as Report,
};

/** Read the game state reactively: any template/derived calling S() updates every tick. */
export function S(): GameState {
  void ui.t;
  return engine.state;
}

export function R(): Report {
  void ui.t;
  return engine.report;
}

/** Call after any player action so the UI refreshes immediately. Plays `sound` if the action did something. */
export function act<T>(fn: (s: GameState) => T, sound?: Sfx): T {
  const out = fn(engine.state);
  ui.t++;
  if (sound && out !== false && out !== 0) sfx(sound);
  syncAudio();
  return out;
}

export function syncAudio(): void {
  const st = engine.state.settings;
  setVolumes(st.music ?? 0.5, st.sfx ?? 0.7);
}

// ---------------------------------------------------------------- persistence

export function save(): void {
  try {
    engine.state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, serialize(engine.state));
    ui.saveError = '';
  } catch (e) {
    ui.saveError = 'Could not save to this device.';
  }
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function replaceState(s: GameState): void {
  engine.state = s;
  engine.report = emptyReport();
  lastLogTop = s.log[0];
  ui.t++;
  save();
}

export function hardReset(): void {
  localStorage.removeItem(SAVE_KEY);
  replaceState(createState((Math.random() * 2 ** 32) >>> 0));
}

// ---------------------------------------------------------------- loop

let acc = 0;
let lastFrame = 0;
let lastWall = Date.now();
let lastLogTop: unknown = null;
let toastId = 0;
let running = false;

function frame(now: number) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (ui.catchup) { lastFrame = now; return; }
  const realDt = lastFrame ? Math.min(MAX_CATCHUP_LIVE, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  lastWall = Date.now();
  const s = engine.state;
  let speed = 1;
  if (s.overdrive && s.chrono > 0) speed = 3;
  if (s.overdrive && s.chrono <= 0) s.overdrive = false;
  acc += realDt * speed;
  if (speed > 1) s.chrono = Math.max(0, s.chrono - realDt * (speed - 1));
  let ticks = 0;
  while (acc >= WORLD.tick && ticks < 2000) {
    acc -= WORLD.tick;
    const last = acc < WORLD.tick;
    if (last) {
      const r = emptyReport();
      tick(s, WORLD.tick, r);
      engine.report = r;
    } else tick(s, WORLD.tick);
    ticks++;
  }
  if (ticks) {
    ui.t++;
    collectToasts();
    setSeason(seasonOf(s).id);
  }
}

function collectToasts() {
  const log = engine.state.log;
  if (!log.length || log[0] === lastLogTop) return;
  const fresh = [];
  for (const e of log) {
    if (e === lastLogTop) break;
    fresh.push(e);
    if (fresh.length > 3) break;
  }
  lastLogTop = log[0];
  for (const e of fresh.reverse()) {
    if (e.kind === 'info' && !e.text.startsWith('Research')) continue;
    sfx(e.kind === 'event' ? 'event' : e.kind === 'story' ? 'story' : e.kind === 'info' ? 'research' : 'story');
    const id = ++toastId;
    ui.toasts = [...ui.toasts.slice(-2), { id, text: e.text, kind: e.kind }];
    setTimeout(() => (ui.toasts = ui.toasts.filter((t) => t.id !== id)), 5000);
  }
}

async function catchUp(elapsed: number) {
  if (elapsed < 2) return;
  const s = engine.state;
  const { simulated, reserve } = splitOffline(elapsed);
  const before = summarize(s);
  ui.catchup = { progress: 0, seconds: simulated };
  await advanceAsync(s, simulated, (p) => (ui.catchup = { progress: p, seconds: simulated }));
  s.chrono += reserve;
  const after = summarize(s);
  const gained: Record<string, number> = {};
  for (const [k, v] of Object.entries(after.res)) {
    const d = v - (before.res[k] ?? 0);
    if (Math.abs(d) > 0.01) gained[k] = d;
  }
  ui.catchup = null;
  lastLogTop = s.log[0];
  if (elapsed >= MAX_CATCHUP_LIVE) {
    ui.away = { seconds: elapsed, simulated, reserve, gained, pop: after.pop - before.pop, events: s.events.length };
  }
  ui.t++;
  save();
}

export async function start(): Promise<void> {
  const loaded = load();
  if (loaded) {
    engine.state = loaded;
    lastLogTop = loaded.log[0];
    const elapsed = loaded.lastSaved ? (Date.now() - loaded.lastSaved) / 1000 : 0;
    await catchUp(elapsed);
  } else {
    lastLogTop = null;
  }
  running = true;
  lastWall = Date.now();
  syncAudio();
  // Browsers only start audio after a gesture; any tap unlocks it.
  const wake = () => { if (engine.state.settings.seenIntro) unlock(); };
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('keydown', wake);
  requestAnimationFrame(frame);
  setInterval(save, 15000);

  // Phones suspend background tabs. Save when hidden, catch up when we come back.
  document.addEventListener('visibilitychange', async () => {
    setHidden(document.visibilityState === 'hidden');
    if (document.visibilityState === 'hidden') {
      save();
    } else {
      const gap = (Date.now() - lastWall) / 1000;
      lastFrame = 0;
      lastWall = Date.now();
      if (gap > MAX_CATCHUP_LIVE) await catchUp(gap);
      else acc += gap;
    }
  });
  window.addEventListener('pagehide', save);
}

/** Developer helper for manual testing from the console. */
export function debugAdvance(seconds: number) {
  return catchUp(seconds);
}
