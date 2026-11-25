import { WORLD } from './data';
import { tick } from './tick';
import type { GameState } from './types';

const H = 3600;

/**
 * Split real elapsed seconds into simulated seconds and chrono reserve.
 * The first `fullHours` count in full. After that, up to `maxHours`, time counts at a
 * declining rate (total extra approaches `declineHours`). Whatever isn't simulated is
 * stored as chrono reserve, so nothing is lost.
 */
export function splitOffline(elapsed: number): { simulated: number; reserve: number } {
  const { fullHours, maxHours, declineHours } = WORLD.offline;
  const e = Math.max(0, elapsed);
  const full = Math.min(e, fullHours * H);
  const rest = Math.min(Math.max(0, e - fullHours * H), (maxHours - fullHours) * H);
  const K = declineHours * H;
  const declined = K * (1 - Math.exp(-rest / K));
  const simulated = full + declined;
  return { simulated, reserve: e - simulated };
}

/**
 * Advance a state by `seconds` using the same fixed tick as live play.
 * Live play and catch-up share this exact path, so 12h offline == 12h live.
 * `onChunk` lets the UI yield between chunks; returns ticks run.
 */
export function advance(s: GameState, seconds: number, dt = WORLD.tick): number {
  const n = Math.floor(seconds / dt + 1e-9);
  for (let i = 0; i < n; i++) tick(s, dt);
  const rem = seconds - n * dt;
  if (rem > 1e-9) tick(s, rem);
  return n;
}

/** Async, chunked variant for the UI so long catch-ups don't freeze the page. */
export async function advanceAsync(
  s: GameState,
  seconds: number,
  onProgress: (done: number) => void,
  dt = WORLD.tick,
): Promise<void> {
  const total = Math.floor(seconds / dt + 1e-9);
  const chunk = 5000;
  for (let i = 0; i < total; i += chunk) {
    const end = Math.min(total, i + chunk);
    for (let j = i; j < end; j++) tick(s, dt);
    onProgress(end / Math.max(1, total));
    await new Promise((r) => setTimeout(r, 0));
  }
  const rem = seconds - total * dt;
  if (rem > 1e-9) tick(s, rem);
}

/** Snapshot of key numbers, used to build the "while you were away" report. */
export function summarize(s: GameState) {
  return { res: { ...s.res }, pop: s.pop, research: Object.keys(s.research).length, events: s.events.length, score: s.run.score };
}
