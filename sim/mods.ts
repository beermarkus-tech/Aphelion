import { BLD, DATA, DOC, JOB, LEG, RES, RSC, WORLD } from './data';
import type { Amounts, GameState, Mod } from './types';

/**
 * Modifier model: every source belongs to a group. Within a group, adds are summed;
 * groups multiply: mult(key) = Π (1 + Σ adds in group).
 */
type Group = 'research' | 'buildings' | 'jobs' | 'legacy' | 'doctrine' | 'temp' | 'prestige';

export interface Derived {
  rev: number;
  mult: Record<string, number>;
  sum: Record<string, number>;
  caps: Amounts;
  housing: number;
  sources: Record<string, { label: string; add: number }[]>;
}

const cache = new WeakMap<GameState, Derived>();

export function invalidate(s: GameState): void {
  s.rev++;
}

export function derived(s: GameState): Derived {
  const hit = cache.get(s);
  if (hit && hit.rev === s.rev) return hit;
  const d = compute(s);
  cache.set(s, d);
  return d;
}

export function m(s: GameState, key: string): number {
  const v = derived(s).mult[key];
  return v === undefined ? 1 : v;
}

function compute(s: GameState): Derived {
  const groups: Record<string, Record<string, number>> = {};
  const sum: Record<string, number> = {};
  const sources: Record<string, { label: string; add: number }[]> = {};
  const push = (g: Group, mods: Mod[] | undefined, times: number, label: string) => {
    if (!mods || times === 0) return;
    for (const mod of mods) {
      const v = mod.add * times;
      (groups[g] ??= {})[mod.key] = (groups[g][mod.key] ?? 0) + v;
      sum[mod.key] = (sum[mod.key] ?? 0) + v;
      (sources[mod.key] ??= []).push({ label, add: v });
    }
  };
  for (const id of Object.keys(s.research)) push('research', RSC[id]?.effects, 1, RSC[id]?.name ?? id);
  for (const [id, n] of Object.entries(s.buildings)) push('buildings', BLD[id]?.effects, n, BLD[id]?.name ?? id);
  for (const [id, n] of Object.entries(s.jobs)) push('jobs', JOB[id]?.effects, n, JOB[id]?.name ?? id);
  for (const [id, n] of Object.entries(s.prestige.perks)) push('legacy', LEG[id]?.effects, n, LEG[id]?.name ?? id);
  if (s.doctrine) push('doctrine', DOC[s.doctrine]?.effects, 1, `${DOC[s.doctrine]?.name} doctrine`);
  for (const t of s.tempMods) push('temp', [{ key: t.key, add: t.add }], 1, t.label);
  const p = s.prestige;
  const glob: Mod[] = [];
  if (p.legacy > 0) push('prestige', [{ key: 'global', add: p.legacy * WORLD.rebuild.legacyBonus }], 1, 'Unspent Legacy');
  if (p.credits > 0) push('prestige', [{ key: 'global', add: p.credits * WORLD.ascension.creditBonus }], 1, 'Launch Credits');
  if (p.echo > 0) push('prestige', [{ key: 'global', add: p.echo }], 1, 'Legacy Echo');
  void glob;

  const mult: Record<string, number> = {};
  for (const g of Object.values(groups)) {
    for (const [k, v] of Object.entries(g)) mult[k] = (mult[k] ?? 1) * Math.max(0, 1 + v);
  }
  for (const k of ['researchCost', 'buildCost', 'heatDemand']) if (mult[k] !== undefined) mult[k] = Math.max(0.1, mult[k]);

  // storage caps
  const add: Amounts = {};
  for (const [id, n] of Object.entries(s.buildings)) {
    const st = BLD[id]?.storage;
    if (!st || !n) continue;
    for (const [k, v] of Object.entries(st)) add[k] = (add[k] ?? 0) + v * n;
  }
  const caps: Amounts = {};
  for (const r of DATA.resources) {
    if (r.cap === null) { caps[r.id] = Infinity; continue; }
    const base = r.cap + (add[r.id] ?? 0) + (add[r.tier] ?? 0) + (add.all ?? 0);
    const mul = (mult[`cap:${r.id}`] ?? 1) * (mult[`cap:${r.tier}`] ?? 1) * (mult['cap:all'] ?? 1);
    caps[r.id] = base * mul;
  }
  let housing = WORLD.start.housing + s.bonusHousing + (sum.startPop ?? 0);
  for (const [id, n] of Object.entries(s.buildings)) housing += (BLD[id]?.housing ?? 0) * n;
  void RES;
  return { rev: s.rev, mult, sum, caps, housing, sources };
}
