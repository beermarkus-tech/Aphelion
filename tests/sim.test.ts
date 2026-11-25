import { describe, expect, it } from 'vitest';
import {
  DATA, WORLD, advance, build, buildingCost, caps, createState, derived, deserialize, emptyReport, exportSave, fmt, housing,
  importSave, rebuild, research, resolveEvent, serialize, splitOffline, startRun, tick, assign, idle, craft, canRebuild, buyPerk,
  validateData, currentGoal, type GameState,
} from '../sim';
import { Bot, defaultBot } from '../tools/bot';

function grown(minutes: number, seed = 3): GameState {
  const s = createState(seed);
  const bot = new Bot(defaultBot);
  while (s.totalTime < minutes * 60) bot.step(s, WORLD.tick, true);
  return s;
}

function maxed(): GameState {
  const s = createState(1);
  for (const r of DATA.research) s.research[r.id] = true;
  for (const g of DATA.goals) s.goals[g.id] = true;
  s.prestige.legacy = 0;
  for (const r of DATA.resources) s.res[r.id] = 1e6;
  s.rev++;
  return s;
}

describe('data', () => {
  it('cross references are valid', () => {
    expect(validateData()).toEqual([]);
  });

  it('every building does something observable (content is data driven)', () => {
    for (const b of DATA.buildings) {
      const s = maxed();
      s.pop = 10;
      const half = () => { const c = caps(s); for (const r of DATA.resources) s.res[r.id] = c[r.id] === Infinity ? 1e6 : c[r.id] / 2; };
      half();
      const before = emptyReport();
      tick(s, 0.2, before);
      const capsBefore = { ...caps(s) };
      const housingBefore = housing(s);
      const multBefore = JSON.stringify(derived(s).mult);
      for (const r of DATA.resources) s.res[r.id] = 1e6;
      expect(build(s, b.id), b.id).toBe(true);
      half();
      const after = emptyReport();
      tick(s, 0.2, after);
      const changed =
        JSON.stringify(after.flows) !== JSON.stringify(before.flows) ||
        JSON.stringify(caps(s)) !== JSON.stringify(capsBefore) ||
        housing(s) !== housingBefore ||
        JSON.stringify(derived(s).mult) !== multBefore ||
        after.autocraft !== before.autocraft ||
        b.category === 'project';
      expect(changed, `${b.id} has no effect`).toBe(true);
    }
  });
});

describe('engine', () => {
  it('12 hours of offline catch-up equals 12 hours of live ticks', () => {
    const base = grown(20);
    const a = deserialize(serialize(base));
    const b = deserialize(serialize(base));
    advance(a, 12 * 3600);
    const n = Math.round((12 * 3600) / WORLD.tick);
    for (let i = 0; i < n; i++) tick(b, WORLD.tick);
    expect(a.res).toEqual(b.res);
    expect(a.pop).toBe(b.pop);
    expect(a.time).toBeCloseTo(b.time, 6);
    expect(a.run.score).toBe(b.run.score);
  });

  it('is deterministic for a given seed', () => {
    expect(serialize(grown(10, 9))).toBe(serialize(grown(10, 9)));
  });

  it('splits long absences into simulated time and a chrono reserve', () => {
    expect(splitOffline(3600)).toEqual({ simulated: 3600, reserve: 0 });
    const twelve = splitOffline(12 * 3600);
    expect(twelve.reserve).toBe(0);
    const week = splitOffline(7 * 86400);
    expect(week.simulated).toBeGreaterThan(12 * 3600);
    expect(week.simulated).toBeLessThan(24 * 3600 + 1);
    expect(week.simulated + week.reserve).toBeCloseTo(7 * 86400, 6);
    // beyond 7 days everything extra goes to the reserve
    const month = splitOffline(30 * 86400);
    expect(month.simulated).toBeCloseTo(week.simulated, 3);
  });

  it('starving survivors leave, and never below one', () => {
    const s = createState(1);
    s.res.food = 0;
    s.jobs = {};
    for (let i = 0; i < 2000; i++) tick(s, 0.2);
    expect(s.pop).toBe(1);
  });

  it('cold kills when heat runs out in winter', () => {
    const s = createState(1);
    s.pop = 12; s.bonusHousing = 9; s.rev++;
    s.res.food = 250;
    s.time = WORLD.seasonLength * 3; // deep winter
    for (let i = 0; i < 600; i++) { s.res.food = 250; tick(s, 0.2); }
    expect(s.pop).toBeLessThan(12);
  });

  it('storage caps clamp production', () => {
    const s = createState(1);
    s.res.scrap = caps(s).scrap - 0.01;
    s.jobs.scavenger = 3;
    for (let i = 0; i < 50; i++) tick(s, 0.2);
    expect(s.res.scrap).toBeCloseTo(caps(s).scrap, 6);
  });
});

describe('actions', () => {
  it('building costs scale and are paid', () => {
    const s = createState(1);
    s.goals.salvage = true;
    s.res.scrap = 100;
    const c0 = buildingCost(s, 'scrapyard').scrap;
    expect(build(s, 'scrapyard')).toBe(true);
    expect(s.res.scrap).toBeCloseTo(100 - c0);
    expect(buildingCost(s, 'scrapyard').scrap).toBeCloseTo(c0 * 1.13);
  });

  it('locked things cannot be bought', () => {
    const s = createState(1);
    s.res.scrap = 1e4; s.res.ore = 1e4;
    expect(build(s, 'smelter')).toBe(false);
    expect(research(s, 'smelting')).toBe(false);
    expect(assign(s, 'miner', 1)).toBe(0);
  });

  it('jobs never exceed population', () => {
    const s = createState(1);
    s.goals.salvage = true; s.goals.yard = true;
    expect(assign(s, 'scavenger', 10)).toBe(3);
    expect(idle(s)).toBe(0);
    expect(assign(s, 'grower', 1)).toBe(0);
    expect(assign(s, 'scavenger', -2)).toBe(-2);
  });

  it('crafting uses the craft bonus', () => {
    const s = createState(1);
    s.research.circuitry = true;
    s.buildings.workshop = 5; s.rev++;
    s.res.metal = 30; s.res.polymer = 20; s.res.glass = 10;
    expect(craft(s, 'circuits', 99)).toBe(10);
    expect(s.res.circuits).toBeCloseTo(10 * 1.2);
  });

  it('events apply their outcome and leave the queue', () => {
    const s = createState(1);
    s.events.push({ id: 'derelict', at: 0 });
    const before = s.res.scrap;
    expect(resolveEvent(s, 0, 0)).toBe(true);
    expect(s.res.scrap).toBeGreaterThan(before);
    expect(s.events.length).toBe(0);
  });
});

describe('goals', () => {
  it('gate the early buildings and complete in order', () => {
    const s = createState(1);
    expect(build(s, 'scrapyard')).toBe(false); // needs the first goal
    s.res.scrap = 12; s.seen.scrap = 12;
    tick(s, 1.2);
    expect(s.goals.salvage).toBe(true);
    expect(build(s, 'scrapyard')).toBe(true);
    tick(s, 1.2);
    expect(s.goals.yard).toBe(true);
    expect(currentGoal(s)?.id).toBe('crew');
    expect(build(s, 'shelter')).toBe(false); // later goal
  });

  it('survive a Rebuild', () => {
    const s = createState(1);
    s.goals.salvage = true; s.goals.yard = true;
    s.run.score = 1e5; s.peakPop = 10;
    expect(rebuild(s)).toBe(true);
    expect(s.goals.yard).toBe(true);
  });
});

describe('prestige', () => {
  it('rebuild keeps legacy and resets the run', () => {
    const s = grown(20);
    s.run.score = 1e5;
    s.peakPop = 10;
    expect(canRebuild(s)).toBe(true);
    const total = s.prestige.legacyEarned;
    expect(rebuild(s)).toBe(true);
    expect(s.prestige.legacyEarned).toBeGreaterThan(total);
    expect(Object.keys(s.buildings).length).toBe(0);
    expect(s.time).toBe(0);
    expect(s.run.score).toBe(0);
  });

  it('Recall keeps low-tier research through a rebuild', () => {
    const s = createState(1);
    s.prestige.legacy = 100;
    expect(buyPerk(s, 'recall')).toBe(true);
    s.research.prospecting = true; s.research.smelting = true;
    startRun(s);
    expect(s.research.prospecting).toBe(true);
    expect(s.research.smelting).toBeUndefined();
  });
});

describe('save', () => {
  it('round-trips through JSON and export text', () => {
    const s = grown(15);
    const json = serialize(s);
    expect(serialize(deserialize(json))).toBe(json);
    expect(serialize(importSave(exportSave(s)))).toBe(json);
  });

  it('fills in fields missing from older saves', () => {
    const s = createState(1);
    const raw = JSON.parse(serialize(s));
    delete raw.stats;
    delete raw.settings;
    const back = deserialize(JSON.stringify(raw));
    expect(back.stats.clicks).toBe(0);
    expect(back.settings.notation).toBe('scientific');
  });

  it('migrates saves from before the goal chain', () => {
    const s = createState(1);
    s.research.prospecting = true;
    const raw = JSON.parse(serialize(s));
    delete raw.goals;
    const back = deserialize(JSON.stringify(raw));
    expect(back.goals.barrels).toBe(true);
    expect(build(Object.assign(back, { res: { ...back.res, scrap: 100 } }), 'shelter')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(() => importSave('hello')).toThrow();
  });
});

describe('format', () => {
  it('formats in every notation', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(3.14159)).toBe('3.14');
    expect(fmt(12345)).toBe('12,345');
    expect(fmt(1.5e6, 'scientific')).toBe('1.50e6');
    expect(fmt(1.5e7, 'engineering')).toBe('15.00e6');
    expect(fmt(1.5e9, 'words')).toBe('1.50 billion');
  });
});
