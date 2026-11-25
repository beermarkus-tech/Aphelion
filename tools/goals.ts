/** Print when the bot completes each goal and research: `npx vite-node tools/goals.ts [hours]`. */
import { createState, DATA, fmtTime } from '../sim';
import { Bot, defaultBot } from './bot';
const hours = Number(process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 4);
const s = createState(7);
const bot = new Bot(defaultBot);
const seen = new Set<string>();
const first: Record<string, number> = {};
while (s.totalTime < hours * 3600) {
  bot.step(s, 1, true);
  for (const g of DATA.goals) if (s.goals[g.id] && !seen.has(g.id)) { seen.add(g.id); console.log(fmtTime(s.totalTime).padEnd(9), 'goal', g.title); }
  for (const r of Object.keys(s.research)) if (!first[r]) first[r] = s.totalTime;
}
console.log('research:', Object.entries(first).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}@${fmtTime(v)}`).join(', '));
