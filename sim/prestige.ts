import { DATA, LEG, WORLD } from './data';
import { invalidate, m } from './mods';
import { addLog, startRun } from './state';
import type { GameState } from './types';

/** Legacy points a Rebuild would grant right now. */
export function rebuildGain(s: GameState): number {
  const { scoreDivisor, exponent } = WORLD.rebuild;
  return Math.floor(Math.pow(s.run.score / scoreDivisor, exponent) * m(s, 'legacyGain'));
}

/** Score needed for the next legacy point (for the "next at" hint). */
export function nextRebuildScore(s: GameState): number {
  const { scoreDivisor, exponent } = WORLD.rebuild;
  const next = rebuildGain(s) + 1;
  return Math.pow(next / m(s, 'legacyGain'), 1 / exponent) * scoreDivisor;
}

export function canRebuild(s: GameState): boolean {
  return rebuildGain(s) >= 1 && s.peakPop >= WORLD.rebuild.minPop;
}

export function rebuild(s: GameState): boolean {
  if (!canRebuild(s)) return false;
  const gain = rebuildGain(s);
  s.prestige.legacy += gain;
  s.prestige.legacyEarned += gain;
  s.prestige.rebuilds++;
  s.prestige.bestScore = Math.max(s.prestige.bestScore, s.run.score);
  if (s.stats.firstRebuildAt === null) s.stats.firstRebuildAt = s.totalTime;
  startRun(s);
  addLog(s, `Rebuild. The colony starts over with ${gain} Legacy, carrying what it learned.`, 'milestone');
  return true;
}

export function perkCost(s: GameState, id: string): number {
  const p = LEG[id];
  const lvl = s.prestige.perks[id] ?? 0;
  return Math.ceil(p.cost * Math.pow(p.costMult, lvl));
}

export function buyPerk(s: GameState, id: string): boolean {
  const p = LEG[id];
  if (!p) return false;
  const lvl = s.prestige.perks[id] ?? 0;
  if (lvl >= p.max) return false;
  const cost = perkCost(s, id);
  if (s.prestige.legacy < cost) return false;
  s.prestige.legacy -= cost;
  s.prestige.perks[id] = lvl + 1;
  invalidate(s);
  return true;
}

/** Launch Credits an Ascension would grant. */
export function ascensionGain(s: GameState): number {
  if (!canAscend(s)) return 0;
  return 1 + Math.floor(Math.log10(1 + s.prestige.legacyEarned));
}

export function canAscend(s: GameState): boolean {
  return (s.buildings.ignition ?? 0) >= 1;
}

export function ascend(s: GameState): boolean {
  if (!canAscend(s)) return false;
  const gain = ascensionGain(s);
  const p = s.prestige;
  p.credits += gain;
  p.ascensions++;
  // keep a small echo of everything earned so no era is wasted
  p.echo += p.legacyEarned * WORLD.rebuild.legacyBonus * WORLD.ascension.echo;
  p.legacy = 0;
  p.legacyEarned = 0;
  p.perks = {};
  p.bestScore = Math.max(p.bestScore, s.run.score);
  startRun(s);
  addLog(s, `Ascension. The colony's light reaches orbit. +${gain} Launch Credit${gain === 1 ? '' : 's'}.`, 'milestone');
  return true;
}

export const LEGACY_PERKS = DATA.legacy;
