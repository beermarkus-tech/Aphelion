/**
 * A scripted player used by the balance simulator and tests.
 * It plays "reasonably well" with simple greedy rules — not optimally.
 */
import {
  DATA, BLD, JOB, RCP, WORLD, currentGoal,
  assign, build, buildingCost, buildingUnlocked, buyPerk, canAfford, canRebuild, caps, chooseDoctrine, craft, emptyReport,
  exceedsCaps, housing, idle, jobUnlocked, m, perkCost, rebuild, rebuildGain, recipeUnlocked, research, researchAvailable,
  researchCost, resolveEvent, scavenge, season, setAutocraft, setDefaultJob, tick, type GameState, type Report,
} from '../sim';

export interface BotOptions {
  doctrine: string;
  /** Active play: seconds between decisions. */
  thinkEvery: number;
  /** Click scavenge during the first N seconds of each run. */
  clickFor: number;
  /** Stop rebuilding after this research (push for the goal instead). */
  rebuildPolicy: 'doubling' | 'never';
}

export const defaultBot: BotOptions = { doctrine: 'automation', thinkEvery: 2, clickFor: 60, rebuildPolicy: 'doubling' };

const RESEARCH_ORDER = [
  'prospecting', 'lichen', 'distillation', 'smelting', 'photovoltaics', 'combustion', 'sorting', 'rotation', 'archives', 'polymers', 'glassworking',
  'logistics', 'engineering', 'cryo', 'picks', 'medicine', 'circuitry', 'habitat', 'workshop', 'insulation', 'review', 'rosters',
  'charter', 'thermal', 'tracking', 'heatrecovery', 'metallurgy', 'fabrication', 'deepscan', 'geothermal', 'superconductors',
  'reactorTheory', 'ignition',
];

const PERK_ORDER = ['tools', 'memory', 'founders', 'caches', 'hearth', 'blueprints', 'recall'];

export class Bot {
  lastThink = -Infinity;
  report: Report = emptyReport();
  constructor(public opt: BotOptions = defaultBot) {}

  /** Advance one tick and maybe act. */
  step(s: GameState, dt: number, online = true): void {
    if (online && s.time < this.opt.clickFor) {
      // a human taps about 3 times per second early on
      const taps = Math.round(dt * 2);
      for (let i = 0; i < taps; i++) scavenge(s);
    }
    this.report = emptyReport();
    tick(s, dt, this.report);
    if (online && s.totalTime - this.lastThink >= this.opt.thinkEvery) {
      this.lastThink = s.totalTime;
      this.think(s);
    }
  }

  think(s: GameState): void {
    // events: take the first option (usually the safe/material one)
    while (s.events.length) resolveEvent(s, 0, 0);
    this.prestige(s);
    this.doResearch(s);
    if (s.research.charter && !s.doctrine) chooseDoctrine(s, this.opt.doctrine);
    if (s.research.rosters && !s.defaultJob) setDefaultJob(s, 'scavenger');
    this.doCrafting(s);
    this.doBuildings(s);
    this.doJobs(s);
  }

  prestige(s: GameState): void {
    // after the first Rebuild, follow the goal chain: sign the charter before rebuilding again
    const charterFirst = s.prestige.rebuilds >= 1 && !s.doctrine;
    if (this.opt.rebuildPolicy !== 'never' && canRebuild(s) && !s.research.reactorTheory && !charterFirst) {
      const gain = rebuildGain(s);
      const target = Math.max(3, s.prestige.legacyEarned);
      if (gain >= target) rebuild(s);
    }
    for (let guard = 0; guard < 50; guard++) {
      const options = PERK_ORDER.filter((id) => {
        const p = DATA.legacy.find((x) => x.id === id)!;
        return (s.prestige.perks[id] ?? 0) < p.max && perkCost(s, id) <= s.prestige.legacy;
      });
      if (!options.length) break;
      options.sort((a, b) => perkCost(s, a) - perkCost(s, b));
      buyPerk(s, options[0]);
    }
  }

  doResearch(s: GameState): void {
    for (const id of RESEARCH_ORDER) {
      if (!researchAvailable(s, id)) continue;
      const cost = researchCost(s, id);
      if (canAfford(s, cost)) { research(s, id); continue; }
      // save data for the next key research instead of spending it elsewhere
      if (!exceedsCaps(s, cost) && this.obtainable(s, cost)) return;
    }
  }

  /** Every missing resource is currently being produced. */
  obtainable(s: GameState, cost: Record<string, number>): boolean {
    for (const [r, v] of Object.entries(cost)) {
      if (s.res[r] >= v) continue;
      const net = (this.report.flows[r] ?? []).reduce((a, f) => a + f.rate, 0);
      if (net <= 0.001) return false;
    }
    return true;
  }

  doCrafting(s: GameState): void {
    const want: Record<string, number> = { circuits: 20, alloy: 20, core: 0 };
    if (s.research.reactorTheory) { want.circuits = 160; want.alloy = 160; }
    // keep enough components for the buildings we want next
    for (const id of ['lab', 'fabricator', 'geothermal']) {
      if (!buildingUnlocked(s, id)) continue;
      const c = buildingCost(s, id);
      for (const r of ['circuits', 'alloy']) if (c[r]) want[r] = Math.max(want[r], Math.ceil(c[r]) + 5);
    }
    if (s.research.reactorTheory && s.buildings.quarters) want.core = 11;
    const hasFab = (s.buildings.fabricator ?? 0) > 0;
    for (const rc of DATA.recipes) {
      if (!recipeUnlocked(s, rc.id)) continue;
      if (hasFab) setAutocraft(s, rc.id, true, want[rc.id] ?? 10);
      const out = Object.keys(rc.out)[0];
      if (s.res[out] >= (want[rc.id] ?? 0)) continue;
      // only spend inputs that are near cap (keep a reserve for buildings)
      const cp = caps(s);
      let n = Infinity;
      for (const [r, v] of Object.entries(rc.in)) {
        const spare = rc.id === 'core' ? s.res[r] : s.res[r] - cp[r] * 0.5;
        n = Math.min(n, Math.floor(spare / v));
      }
      if (n > 0) craft(s, rc.id, n);
    }
  }

  wants(s: GameState): Record<string, number> {
    const w: Record<string, number> = {};
    const r = this.report;
    const pop = s.pop;
    const cap = housing(s);
    const net = (res: string) => (r.flows[res] ?? []).reduce((a, f) => a + f.rate, 0);
    const winterDemand = pop * WORLD.heatPerSurvivor * 1.7 * m(s, 'heatDemand') + 1;
    const heatSupplyNow = r.heat.supply;
    const n = (id: string) => s.buildings[id] ?? 0;

    const cp = caps(s);
    const full = (res: string) => s.res[res] >= cp[res] * 0.9;
    const have = (res: string) => net(res) > 0.05 || s.res[res] > Math.min(cp[res] * 0.4, 40);
    w.shelter = pop >= cap - 1 ? 7 : 1;
    w.hab = pop >= cap - 1 ? 7.5 : 2;
    w.infirmary = 3;
    w.barrel = heatSupplyNow < winterDemand && !s.research.thermal ? 9 : 0;
    w.exchanger = heatSupplyNow < winterDemand ? 9 : 0;
    w.scrapyard = full('scrap') ? 0 : n('scrapyard') < 25 ? 5 : 2;
    w.tent = net('food') < 0.3 + 0.05 * pop ? 7 : full('food') ? 0 : 1;
    w.hydroponics = net('food') < 0.3 + 0.05 * pop ? 7 : 0;
    w.terminal = n('terminal') < 4 ? 6 : 2;
    w.sifter = full('ore') ? 0 : 4;
    w.greenhouse = full('biomass') ? 0 : 4;
    w.solar = r.power.demand > r.power.supply * 0.9 ? 8 : 0;
    w.burner = r.power.demand > r.power.supply * 0.9 && have('biomass') ? 6 : 0;
    w.geothermal = 6;
    w.refinery = have('biomass') && !full('fuel') ? 6 : 0;
    w.smelter = have('ore') && have('fuel') && !full('metal') ? 7 : 0;
    w.kiln = have('scrap') && have('fuel') && n('kiln') < n('smelter') && !full('glass') ? 6 : 0;
    w.vat = have('biomass') && have('fuel') && n('vat') < n('smelter') && !full('polymer') ? 6 : 0;
    w.electrolyzer = have('ice') && !full('fuel') ? 4 : 0;
    w.workshop = 4;
    w.lab = 6;
    w.fabricator = 5;
    w.archive = 4;
    w.crate = 3;
    w.warehouse = 3;
    w.depot = 3;
    // follow the goal chain like a player would
    const goal = currentGoal(s);
    for (const id of Object.keys(goal?.check.buildings ?? {})) w[id] = Math.max(w[id] ?? 0, 8.5);
    w.quarters = 10;
    w.ignition = 10;
    return w;
  }

  doBuildings(s: GameState): void {
    const w = this.wants(s);
    // storage pressure: anything we want but can't hold → prioritise storage
    const cands = DATA.buildings
      .filter((b) => buildingUnlocked(s, b.id) && (b.max === undefined || (s.buildings[b.id] ?? 0) < b.max))
      .map((b) => ({ b, want: w[b.id] ?? 1, cost: buildingCost(s, b.id) }))
      .filter((c) => c.want > 0);
    const blocked = cands.filter((c) => c.want >= 6 && exceedsCaps(s, c.cost));
    for (const c of blocked) {
      const res = exceedsCaps(s, c.cost)!;
      const tier = DATA.resources.find((r) => r.id === res)!.tier;
      for (const st of ['crate', 'warehouse', 'depot', 'archive']) {
        const sb = BLD[st];
        if (sb.storage?.[res] || sb.storage?.[tier]) w[st] = Math.max(w[st] ?? 0, 8);
      }
    }
    // research that doesn't fit in storage → more data storage
    const nextRes = RESEARCH_ORDER.find((id) => researchAvailable(s, id));
    if (nextRes && exceedsCaps(s, researchCost(s, nextRes))) { w.archive = 8; w.lab = 8; }
    cands.sort((a, b) => (w[b.b.id] ?? 1) - (w[a.b.id] ?? 1));
    let bought = 0;
    for (const c of cands) {
      const want = w[c.b.id] ?? 1;
      if (want <= 0) continue;
      if (canAfford(s, c.cost)) {
        build(s, c.b.id);
        bought++;
        if (bought >= 3) return;
      } else if (want >= 8 && !exceedsCaps(s, c.cost) && this.obtainable(s, c.cost)) {
        return; // save up for something important
      }
    }
  }

  doJobs(s: GameState): void {
    // reset and redistribute everyone each think
    for (const j of Object.keys(s.jobs)) assign(s, j, -s.jobs[j]);
    const se = season(s);
    const unlocked = DATA.jobs.filter((j) => jobUnlocked(s, j.id)).map((j) => j.id);
    // growers to cover food with a margin, accounting for buildings
    const foodUse = s.pop * WORLD.foodPerSurvivor * m(s, 'foodUse');
    const other = (this.report.flows.food ?? []).filter((f) => f.rate > 0 && !f.label.startsWith('Grower')).reduce((a, f) => a + f.rate, 0);
    const perGrower = 0.8 * Math.max(0.6, se.farm) * m(s, 'job:grower') * m(s, 'jobs') * m(s, 'res:food') * m(s, 'global');
    const foodLow = s.res.food < caps(s).food * 0.3;
    const growers = Math.max(0, Math.ceil((foodUse * (foodLow ? 1.4 : 1.1) - other) / perGrower));
    assign(s, 'grower', Math.min(growers, idle(s)));
    for (const [id, n] of Object.entries(currentGoal(s)?.check.jobs ?? {})) {
      const need = n - (s.jobs[id] ?? 0);
      if (need > 0) assign(s, id, Math.min(need, idle(s)));
    }
    const weights: Record<string, number> = {
      scavenger: 2, scholar: 3, miner: 2.5, harvester: 2.5, icecutter: (s.buildings.hydroponics ?? 0) + (s.buildings.electrolyzer ?? 0) > 0 ? 1.5 : 0,
      engineer: 1, medic: s.pop >= 10 ? 0.5 : 0,
    };
    const pool = idle(s);
    const ids = unlocked.filter((j) => j !== 'grower' && (weights[j] ?? 0) > 0);
    const total = ids.reduce((a, j) => a + weights[j], 0);
    const shares = ids.map((j) => ({ j, exact: (pool * weights[j]) / total }));
    for (const sh of shares) assign(s, sh.j, Math.floor(sh.exact));
    shares.sort((a, b) => (b.exact % 1) - (a.exact % 1));
    for (const sh of shares) if (idle(s) > 0) assign(s, sh.j, 1);
    if (idle(s) > 0) assign(s, 'scavenger', idle(s));
    void JOB; void RCP;
  }
}
