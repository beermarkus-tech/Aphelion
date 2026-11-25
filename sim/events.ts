import { DATA, EVT, WORLD } from './data';
import { invalidate } from './mods';
import { nextRandom } from './rng';
import { addLog, addSurvivor, caps, housing, removeSurvivor, reqMet } from './state';
import type { GameState } from './types';

let storyClock = new WeakMap<GameState, number>();

export function checkStory(s: GameState): void {
  // cheap throttle: at most once per game second
  const last = storyClock.get(s) ?? -1;
  if (Math.floor(s.time) === last) return;
  storyClock.set(s, Math.floor(s.time));
  for (const st of DATA.story) {
    if (s.story[st.id]) continue;
    if (reqMet(s, st.when)) {
      s.story[st.id] = true;
      addLog(s, st.text, 'story');
    }
  }
}

export function resetStoryClock(): void {
  storyClock = new WeakMap();
}

export function checkEvents(s: GameState): void {
  // expire unanswered events (never faster than 24h, see design pillars)
  if (s.events.length && s.totalTime - s.events[0].at > WORLD.eventExpiry) {
    const gone = s.events.shift()!;
    addLog(s, `${EVT[gone.id]?.title ?? 'An event'} passed without an answer.`, 'event');
  }
  if (s.time < s.nextEventAt) return;
  s.nextEventAt = s.time + WORLD.eventInterval;
  if (s.events.length >= WORLD.maxPendingEvents) return;
  const eligible = DATA.events.filter((e) => !s.events.some((p) => p.id === e.id) && reqMet(s, e.requires));
  if (!eligible.length) return;
  const roll = nextRandom(s);
  let acc = 0;
  const total = eligible.reduce((a, e) => a + e.chance, 0);
  // overall chance to get any event this interval
  if (roll > Math.min(0.5, total)) return;
  const pick = nextRandom(s) * total;
  for (const e of eligible) {
    acc += e.chance;
    if (pick <= acc) {
      s.events.push({ id: e.id, at: s.totalTime });
      s.stats.eventsSeen++;
      addLog(s, `${e.title}: ${e.text}`, 'event');
      return;
    }
  }
}

export function resolveEvent(s: GameState, index: number, choice: number): boolean {
  const pending = s.events[index];
  if (!pending) return false;
  const def = EVT[pending.id];
  const c = def?.choices[choice];
  if (!c) return false;
  const o = c.outcome;
  const cp = caps(s);
  for (const [r, v] of Object.entries(o.res ?? {})) s.res[r] = Math.max(0, Math.min(cp[r], (s.res[r] ?? 0) + v));
  for (const [r, v] of Object.entries(o.resPct ?? {})) {
    const base = cp[r] === Infinity ? s.res[r] : cp[r];
    s.res[r] = Math.max(0, Math.min(cp[r], (s.res[r] ?? 0) + base * v));
  }
  if (o.pop) {
    for (let i = 0; i < o.pop; i++) {
      if (s.pop < housing(s)) addSurvivor(s);
      else { s.bonusHousing++; addSurvivor(s); }
    }
    for (let i = 0; i < -o.pop; i++) removeSurvivor(s);
  }
  if (o.mod) s.tempMods.push({ key: o.mod.key, add: o.mod.add, until: s.time + o.mod.duration, label: o.mod.label });
  for (const k of Object.keys(s.res)) if (s.res[k] > (s.seen[k] ?? 0)) s.seen[k] = s.res[k];
  s.events.splice(index, 1);
  addLog(s, `${def.title} — ${c.label}. ${c.result}`, 'event');
  invalidate(s);
  return true;
}
