/** Print a timeline of one bot run: `npx vite-node tools/trace.ts [minutes] [every-minutes] [doctrine]`. */
import { createState, fmtTime, housing, rebuildGain } from '../sim';
import { Bot, defaultBot } from './bot';
import { onlineAt } from './runner';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const minutes = Number(args[0] ?? 90);
const every = Number(args[1] ?? 5);
const s = createState(7);
const bot = new Bot({ ...defaultBot, doctrine: args[2] ?? 'automation' });
let next = 0;
const r = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x)).toString();
while (s.totalTime < minutes * 60) {
  bot.step(s, 1, onlineAt(s.totalTime));
  if (s.totalTime >= next) {
    next += every * 60;
    const rp = bot.report;
    const b = Object.entries(s.buildings).map(([k, v]) => `${k}${v}`).join(' ');
    const j = Object.entries(s.jobs).filter(([, v]) => v).map(([k, v]) => `${k.slice(0, 4)}${v}`).join(' ');
    const res = ['food', 'scrap', 'ore', 'biomass', 'ice', 'metal', 'fuel', 'polymer', 'glass', 'circuits', 'alloy', 'core', 'data']
      .filter((k) => s.seen[k]).map((k) => `${k}=${r(s.res[k])}`).join(' ');
    console.log(`[${fmtTime(s.totalTime)}] run#${s.prestige.rebuilds} pop ${s.pop}/${housing(s)} score ${Math.round(s.run.score)} gain ${rebuildGain(s)} L${s.prestige.legacyEarned} res#${Object.keys(s.research).length} pw ${r(rp.power.supply)}/${r(rp.power.demand)} heat ${r(rp.heat.ratio)}`);
    console.log(`    ${res}`);
    console.log(`    B: ${b}`);
    console.log(`    J: ${j}`);
  }
}
