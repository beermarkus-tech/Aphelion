import { DATA, BLD, JOB, RCP, RSC, WORLD } from './data';
import { derived, invalidate, m } from './mods';
import type { Amounts, GameState, Req } from './types';

export const SAVE_VERSION = 1;

export function createState(seed = 12345): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    rev: 0,
    time: 0,
    totalTime: 0,
    res: {},
    seen: {},
    buildings: {},
    active: {},
    jobs: {},
    pop: 0,
    bonusHousing: 0,
    growth: 0,
    loss: 0,
    peakPop: 0,
    research: {},
    doctrine: null,
    autocraft: {},
    defaultJob: null,
    tempMods: [],
    events: [],
    nextEventAt: WORLD.eventInterval * 3,
    story: {},
    goals: {},
    log: [],
    run: { score: 0, produced: {} },
    prestige: { legacy: 0, legacyEarned: 0, perks: {}, rebuilds: 0, ascensions: 0, credits: 0, echo: 0, bestScore: 0 },
    chrono: 0,
    overdrive: false,
    settings: { notation: 'scientific', seenIntro: false, music: 0.5, sfx: 0.7, motion: true },
    lastSaved: 0,
    stats: { clicks: 0, crafted: 0, eventsSeen: 0, firstRebuildAt: null },
  };
  startRun(s);
  return s;
}

/** Reset everything that belongs to a single run, keeping prestige, settings and stats. */
export function startRun(s: GameState): void {
  s.time = 0;
  s.res = {};
  for (const r of DATA.resources) s.res[r.id] = 0;
  s.seen = {};
  s.buildings = {};
  s.active = {};
  s.jobs = {};
  s.bonusHousing = 0;
  s.growth = 0;
  s.loss = 0;
  s.doctrine = null;
  s.autocraft = {};
  s.defaultJob = null;
  s.tempMods = [];
  s.events = [];
  s.nextEventAt = WORLD.eventInterval * 3;
  s.story = {};
  s.run = { score: 0, produced: {} };
  // research kept by the Recall perk
  const keepTier = s.prestige.perks.recall ?? 0;
  s.research = {};
  for (const r of DATA.research) if (r.tier <= keepTier && !r.doctrine) s.research[r.id] = true;
  invalidate(s);
  const d = derived(s);
  s.pop = WORLD.start.pop + (d.sum.startPop ?? 0);
  s.peakPop = s.pop;
  for (const [k, v] of Object.entries(WORLD.start.res)) s.res[k] = v;
  s.res.scrap += d.sum.startScrap ?? 0;
  for (const k of Object.keys(s.res)) if (s.res[k] > 0) s.seen[k] = s.res[k];
  invalidate(s);
}

export function caps(s: GameState): Amounts {
  return derived(s).caps;
}

export function housing(s: GameState): number {
  return derived(s).housing;
}

export function employed(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.jobs)) n += v;
  return n;
}

export function idle(s: GameState): number {
  return Math.max(0, s.pop - employed(s));
}

export function seasonIndex(s: GameState): number {
  return Math.floor(s.time / WORLD.seasonLength) % WORLD.seasons.length;
}

export function season(s: GameState) {
  return WORLD.seasons[seasonIndex(s)];
}

export function year(s: GameState): number {
  return Math.floor(s.time / (WORLD.seasonLength * WORLD.seasons.length)) + 1;
}

export function reqMet(s: GameState, r: Req | undefined): boolean {
  if (!r) return true;
  if (r.research) for (const id of r.research) if (!s.research[id]) return false;
  if (r.buildings) for (const [id, n] of Object.entries(r.buildings)) if ((s.buildings[id] ?? 0) < n) return false;
  if (r.seen) for (const [id, n] of Object.entries(r.seen)) if ((s.seen[id] ?? 0) < n) return false;
  if (r.pop !== undefined && s.pop < r.pop) return false;
  if (r.season !== undefined && season(s).id !== r.season) return false;
  if (r.goals) for (const id of r.goals) if (!s.goals[id]) return false;
  if (r.jobs) for (const [id, n] of Object.entries(r.jobs)) if ((s.jobs[id] ?? 0) < n) return false;
  if (r.time !== undefined && s.time < r.time) return false;
  if (r.researched !== undefined && Object.keys(s.research).length < r.researched) return false;
  if (r.doctrine && !s.doctrine) return false;
  if (r.rebuilds !== undefined && s.prestige.rebuilds < r.rebuilds) return false;
  if (r.ascensions !== undefined && s.prestige.ascensions < r.ascensions) return false;
  return true;
}

export function buildingCost(s: GameState, id: string, count = s.buildings[id] ?? 0): Amounts {
  const b = BLD[id];
  const k = Math.pow(b.costMult, count) * m(s, 'buildCost');
  const out: Amounts = {};
  for (const [r, v] of Object.entries(b.cost)) out[r] = v * k;
  return out;
}

export function researchCost(s: GameState, id: string): Amounts {
  const k = m(s, 'researchCost');
  const out: Amounts = {};
  for (const [r, v] of Object.entries(RSC[id].cost)) out[r] = v * k;
  return out;
}

export function canAfford(s: GameState, cost: Amounts): boolean {
  for (const [r, v] of Object.entries(cost)) if ((s.res[r] ?? 0) < v - 1e-9) return false;
  return true;
}

/** True when the cost can never be paid with current storage caps. */
export function exceedsCaps(s: GameState, cost: Amounts): string | null {
  const c = caps(s);
  for (const [r, v] of Object.entries(cost)) if (v > c[r] + 1e-9) return r;
  return null;
}

export function pay(s: GameState, cost: Amounts): void {
  for (const [r, v] of Object.entries(cost)) s.res[r] = Math.max(0, (s.res[r] ?? 0) - v);
}

export function buildingUnlocked(s: GameState, id: string): boolean {
  const b = BLD[id];
  return reqMet(s, b.requires);
}

export function jobUnlocked(s: GameState, id: string): boolean {
  return reqMet(s, JOB[id].requires);
}

export function recipeUnlocked(s: GameState, id: string): boolean {
  return reqMet(s, RCP[id].requires);
}

export function researchAvailable(s: GameState, id: string): boolean {
  return !s.research[id] && reqMet(s, RSC[id].requires);
}

export function addLog(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info'): void {
  s.log.unshift({ t: s.totalTime, text, kind });
  if (s.log.length > 120) s.log.length = 120;
}

export function addSurvivor(s: GameState): void {
  s.pop++;
  if (s.defaultJob && JOB[s.defaultJob]) {
    s.jobs[s.defaultJob] = (s.jobs[s.defaultJob] ?? 0) + 1;
  }
  invalidate(s);
}

/** Remove one survivor: idle first, otherwise from the largest job. */
export function removeSurvivor(s: GameState): void {
  if (s.pop <= 1) return;
  if (idle(s) === 0) {
    let best: string | null = null;
    for (const [id, n] of Object.entries(s.jobs)) if (n > 0 && (!best || n > s.jobs[best])) best = id;
    if (best) s.jobs[best]--;
  }
  s.pop--;
  invalidate(s);
}

