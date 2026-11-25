/** Bot runner shared by the balance simulator CLI and tests. */
import { createState, type GameState } from '../sim';
import { Bot, defaultBot, type BotOptions } from './bot';

export interface Milestones {
  firstBuilding?: number;
  firstJob?: number;
  firstRebuild?: number;
  doctrine?: number;
  firstCore?: number;
  ascension?: number;
  rebuilds: number;
}

export const TARGETS: Record<string, [number, number]> = {
  firstBuilding: [0, 90],
  firstRebuild: [30 * 60, 45 * 60],
  doctrine: [90 * 60, 3 * 3600],
  ascension: [2 * 86400, 3 * 86400],
};

/** Casual pattern: one long first session, then 5-minute check-ins every 90 minutes, sleeping 8h a day. */
export function onlineAt(t: number): boolean {
  if (t < 2 * 3600) return true;
  const day = t % 86400;
  if (day > 16 * 3600) return false; // asleep
  return t % 5400 < 300;
}

export function runBot(
  opt: Partial<BotOptions> = {},
  maxSeconds = 4 * 86400,
  dt = 1,
  seed = 7,
  pattern: 'casual' | 'active' = 'casual',
): { s: GameState; ms: Milestones } {
  const s = createState(seed);
  const bot = new Bot({ ...defaultBot, ...opt });
  const ms: Milestones = { rebuilds: 0 };
  let lastRebuilds = 0;
  while (s.totalTime < maxSeconds) {
    bot.step(s, dt, pattern === 'active' || onlineAt(s.totalTime));
    const t = s.totalTime;
    if (ms.firstBuilding === undefined && Object.values(s.buildings).some((n) => n > 0)) ms.firstBuilding = t;
    if (ms.firstJob === undefined && Object.values(s.jobs).some((n) => n > 0)) ms.firstJob = t;
    if (s.prestige.rebuilds > lastRebuilds) {
      lastRebuilds = s.prestige.rebuilds;
      ms.rebuilds = lastRebuilds;
      if (ms.firstRebuild === undefined) ms.firstRebuild = t;
    }
    if (ms.doctrine === undefined && s.doctrine) ms.doctrine = t;
    if (ms.firstCore === undefined && (s.seen.core ?? 0) >= 1) ms.firstCore = t;
    if (s.buildings.ignition) { ms.ascension = t; break; }
  }
  return { s, ms };
}

