import { BLD, DOC, JOB, RCP, RSC, WORLD } from './data';
import { invalidate, m } from './mods';
import {
  addLog, buildingCost, buildingUnlocked, canAfford, caps, idle, jobUnlocked, pay, recipeUnlocked, researchAvailable, researchCost,
} from './state';
import type { GameState } from './types';

export function scavenge(s: GameState): void {
  const amt = WORLD.clickScrap * Math.max(1, m(s, 'job:scavenger'));
  s.res.scrap = Math.min(caps(s).scrap, s.res.scrap + amt);
  if (s.res.scrap > (s.seen.scrap ?? 0)) s.seen.scrap = s.res.scrap;
  s.stats.clicks++;
}

export function build(s: GameState, id: string): boolean {
  const b = BLD[id];
  if (!b || !buildingUnlocked(s, id)) return false;
  const n = s.buildings[id] ?? 0;
  if (b.max !== undefined && n >= b.max) return false;
  const cost = buildingCost(s, id);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  s.buildings[id] = n + 1;
  if (b.toggle && s.active[id] !== undefined && s.active[id] >= n) s.active[id] = n + 1;
  invalidate(s);
  if (b.category === 'project') addLog(s, `${b.name} complete.`, 'milestone');
  return true;
}

/** Set how many of a toggleable building are running. */
export function setActive(s: GameState, id: string, n: number): void {
  const total = s.buildings[id] ?? 0;
  s.active[id] = Math.max(0, Math.min(total, Math.round(n)));
  invalidate(s);
}

export function assign(s: GameState, job: string, delta: number): number {
  if (!JOB[job] || !jobUnlocked(s, job)) return 0;
  const cur = s.jobs[job] ?? 0;
  let d = delta > 0 ? Math.min(delta, idle(s)) : Math.max(delta, -cur);
  if (d === 0) return 0;
  s.jobs[job] = cur + d;
  invalidate(s);
  return d;
}

export function research(s: GameState, id: string): boolean {
  if (!RSC[id] || !researchAvailable(s, id)) return false;
  const cost = researchCost(s, id);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  s.research[id] = true;
  invalidate(s);
  addLog(s, `Research complete: ${RSC[id].name}.`, 'info');
  return true;
}

export function chooseDoctrine(s: GameState, id: string): boolean {
  if (!DOC[id] || s.doctrine || !s.research.charter) return false;
  s.doctrine = id;
  invalidate(s);
  addLog(s, `The charter is signed. The colony follows the ${DOC[id].name} doctrine.`, 'milestone');
  return true;
}

/** Max whole crafts affordable for a recipe. */
export function maxCrafts(s: GameState, id: string): number {
  const rc = RCP[id];
  let n = Infinity;
  for (const [r, v] of Object.entries(rc.in)) n = Math.min(n, Math.floor((s.res[r] ?? 0) / v + 1e-9));
  return n === Infinity ? 0 : n;
}

export function craft(s: GameState, id: string, times: number): number {
  const rc = RCP[id];
  if (!rc || !recipeUnlocked(s, id)) return 0;
  const n = Math.min(Math.floor(times), maxCrafts(s, id));
  if (n <= 0) return 0;
  for (const [r, v] of Object.entries(rc.in)) s.res[r] -= v * n;
  const k = m(s, 'craft');
  const cp = caps(s);
  for (const [r, v] of Object.entries(rc.out)) {
    const got = Math.min(cp[r], s.res[r] + v * n * k) - s.res[r];
    s.res[r] += got;
    if (s.res[r] > (s.seen[r] ?? 0)) s.seen[r] = s.res[r];
    s.run.produced[r] = (s.run.produced[r] ?? 0) + got;
    s.run.score += got * 15;
  }
  s.stats.crafted += n;
  return n;
}

export function setAutocraft(s: GameState, id: string, on: boolean, target?: number): void {
  const rule = (s.autocraft[id] ??= { on: false, target: 10 });
  rule.on = on;
  if (target !== undefined) rule.target = Math.max(0, target);
}

export function setDefaultJob(s: GameState, job: string | null): void {
  if (job && (!JOB[job] || !s.research.rosters)) return;
  s.defaultJob = job;
}
