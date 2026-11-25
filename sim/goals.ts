import { DATA, GOAL, RES } from './data';
import { addLog, caps, reqMet } from './state';
import { invalidate } from './mods';
import type { GameState, GoalDef, Req } from './types';

/** Goals complete strictly in order. Returns the first incomplete goal, or null when all are done. */
export function currentGoal(s: GameState): GoalDef | null {
  for (const g of DATA.goals) if (!s.goals[g.id]) return g;
  return null;
}

export function goalIndex(id: string): number {
  return DATA.goals.findIndex((g) => g.id === id);
}

/** Complete as many goals in a row as are already satisfied. */
export function checkGoals(s: GameState): void {
  for (let guard = 0; guard < 5; guard++) {
    const g = currentGoal(s);
    if (!g || !reqMet(s, g.check)) return;
    s.goals[g.id] = true;
    if (g.reward) {
      const cp = caps(s);
      for (const [r, v] of Object.entries(g.reward)) s.res[r] = Math.min(cp[r], (s.res[r] ?? 0) + v);
    }
    invalidate(s);
    addLog(s, `Goal complete: ${g.title}.`, 'milestone');
  }
}

export interface GoalPart {
  label: string;
  have: number;
  need: number;
}

/** Break a goal's check into measurable parts for progress bars. */
export function goalParts(s: GameState, r: Req): GoalPart[] {
  const parts: GoalPart[] = [];
  const name = (id: string) => RES[id]?.name ?? id;
  for (const [id, n] of Object.entries(r.seen ?? {})) parts.push({ label: name(id), have: Math.min(n, s.seen[id] ?? 0), need: n });
  for (const [id, n] of Object.entries(r.buildings ?? {})) {
    const b = DATA.buildings.find((x) => x.id === id);
    parts.push({ label: b?.name ?? id, have: Math.min(n, s.buildings[id] ?? 0), need: n });
  }
  for (const [id, n] of Object.entries(r.jobs ?? {})) {
    const j = DATA.jobs.find((x) => x.id === id);
    parts.push({ label: `${j?.name ?? id}s`, have: Math.min(n, s.jobs[id] ?? 0), need: n });
  }
  for (const id of r.research ?? []) {
    const x = DATA.research.find((q) => q.id === id);
    parts.push({ label: x?.name ?? id, have: s.research[id] ? 1 : 0, need: 1 });
  }
  if (r.pop !== undefined) parts.push({ label: 'Survivors', have: Math.min(r.pop, s.pop), need: r.pop });
  if (r.time !== undefined) parts.push({ label: 'Time', have: Math.min(r.time, s.time), need: r.time });
  if (r.researched !== undefined) {
    parts.push({ label: 'Research', have: Math.min(r.researched, Object.keys(s.research).length), need: r.researched });
  }
  if (r.doctrine) parts.push({ label: 'Doctrine chosen', have: s.doctrine ? 1 : 0, need: 1 });
  if (r.rebuilds !== undefined) parts.push({ label: 'Rebuilds', have: Math.min(r.rebuilds, s.prestige.rebuilds), need: r.rebuilds });
  if (r.ascensions !== undefined) parts.push({ label: 'Ascensions', have: Math.min(r.ascensions, s.prestige.ascensions), need: r.ascensions });
  return parts;
}

export { GOAL };
