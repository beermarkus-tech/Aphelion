/** Write a bot-played save for UI testing: npx vite-node tools/makesave.ts <minutes> <out.json> */
import { writeFileSync } from 'node:fs';
import { createState, serialize } from '../sim';
import { Bot, defaultBot } from './bot';
const [min, out] = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const s = createState(11);
const bot = new Bot({ ...defaultBot, rebuildPolicy: 'never' });
while (s.totalTime < Number(min) * 60) bot.step(s, 1, true);
s.settings.seenIntro = true;
s.lastSaved = Date.now();
writeFileSync(out, serialize(s));
console.log('pop', s.pop, 'research', Object.keys(s.research).length, 'events', s.events.length);
