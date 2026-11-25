/**
 * Balance simulator. Runs the bot through Era I and reports milestone timings
 * against the pacing targets from the design proposal.
 *
 *   npm run sim               full report (all doctrines)
 *   npm run sim -- --quick    first two hours only
 */
import { fmtTime } from '../sim';
import { runBot, TARGETS, type Milestones } from './runner';

function verdict(key: string, v: number | undefined): string {
  const t = TARGETS[key];
  if (!t) return '';
  if (v === undefined) return 'MISSED';
  return v >= t[0] && v <= t[1] ? 'ok' : v < t[0] ? 'too fast' : 'too slow';
}

{
  const quick = process.argv.includes('--quick');
  const max = quick ? 2 * 3600 : 9 * 86400;
  const rows: Record<string, Milestones> = {};
  for (const doctrine of ['automation', 'biotech', 'exodus']) {
    const t0 = Date.now();
    const { s, ms } = runBot({ doctrine }, max);
    rows[doctrine] = ms;
    console.log(`\n== ${doctrine} (${((Date.now() - t0) / 1000).toFixed(1)}s wall) ==`);
    for (const k of ['firstBuilding', 'firstJob', 'firstRebuild', 'doctrine', 'firstCore', 'ascension'] as const) {
      console.log(`  ${k.padEnd(14)} ${fmtTime(ms[k] ?? NaN).padEnd(10)} ${verdict(k, ms[k])}`);
    }
    console.log(`  rebuilds       ${ms.rebuilds}   legacy earned ${s.prestige.legacyEarned}   pop ${s.pop}   research ${Object.keys(s.research).length}`);
  }
  if (!quick) {
    // Doctrine balance is measured with continuous play so check-in timing doesn't add noise.
    const t: Record<string, number> = {};
    for (const doctrine of ['automation', 'biotech', 'exodus']) {
      const { ms } = runBot({ doctrine }, max, 1, 7, 'active');
      t[doctrine] = ms.ascension ?? Infinity;
    }
    const v = Object.values(t);
    const spread = Math.max(...v) / Math.min(...v) - 1;
    console.log(`\nActive play, time to Ascension: ${Object.entries(t).map(([k, x]) => `${k} ${fmtTime(x)}`).join(', ')}`);
    console.log(`Doctrine spread: ${(spread * 100).toFixed(1)}% (target ≤ 15%)`);
  }
}
