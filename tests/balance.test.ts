import { describe, expect, it } from 'vitest';
import { runBot, TARGETS } from '../tools/runner';

// The balance simulator is the quality gate: cost and rate changes must keep these green.
describe('balance (bot player)', () => {
  it('first building within 90 seconds', () => {
    const { ms } = runBot({}, 600);
    expect(ms.firstBuilding).toBeLessThanOrEqual(90);
  });

  it('first Rebuild lands in 60–90 simulated minutes', () => {
    const { ms } = runBot({}, 2 * 3600);
    const [lo, hi] = TARGETS.firstRebuild;
    expect(ms.firstRebuild).toBeGreaterThanOrEqual(lo);
    expect(ms.firstRebuild).toBeLessThanOrEqual(hi);
  });

  it('every doctrine reaches Ascension in 4–7 days of casual play, within 15% of each other', () => {
    const casual: number[] = [];
    const active: number[] = [];
    for (const doctrine of ['automation', 'biotech', 'exodus']) {
      const c = runBot({ doctrine }, 8 * 86400).ms;
      expect(c.ascension, doctrine).toBeDefined();
      casual.push(c.ascension!);
      active.push(runBot({ doctrine }, 8 * 86400, 1, 7, 'active').ms.ascension!);
    }
    for (const t of casual) {
      expect(t).toBeGreaterThanOrEqual(TARGETS.ascension[0]);
      expect(t).toBeLessThanOrEqual(TARGETS.ascension[1]);
    }
    expect(Math.max(...active) / Math.min(...active) - 1).toBeLessThanOrEqual(0.15);
  });
});
