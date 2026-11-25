import { DATA, BLD, WORLD } from './data';
import { derived, invalidate, m } from './mods';
import { addLog, addSurvivor, housing, recipeUnlocked, removeSurvivor, season } from './state';
import { checkEvents, checkStory } from './events';
import type { Amounts, GameState } from './types';

export interface Flow {
  label: string;
  rate: number; // per second, signed
}

/** Snapshot of what the last tick did. Filled only when requested (UI), never needed by the sim itself. */
export interface Report {
  flows: Record<string, Flow[]>;
  power: { supply: number; demand: number; eff: number };
  heat: { supply: number; demand: number; ratio: number };
  food: { use: number };
  starving: boolean;
  cold: boolean;
  autocraft: number;
  eff: Record<string, number>; // per building efficiency 0..1
}

export function emptyReport(): Report {
  return {
    flows: {},
    power: { supply: 0, demand: 0, eff: 1 },
    heat: { supply: 0, demand: 0, ratio: 1 },
    food: { use: 0 },
    starving: false,
    cold: false,
    autocraft: 0,
    eff: {},
  };
}

const COMPONENTS = new Set(DATA.resources.filter((r) => r.tier === 'component').map((r) => r.id));
const REFINED = new Set(DATA.resources.filter((r) => r.tier === 'refined').map((r) => r.id));
const CONVERTERS = DATA.buildings.filter((b) => b.converts);
const GENERATORS = CONVERTERS.filter((b) => (b.power ?? 0) > 0 || (b.heat ?? 0) > 0);
const PROCESSORS = CONVERTERS.filter((b) => !((b.power ?? 0) > 0 || (b.heat ?? 0) > 0));
const PRODUCERS = DATA.buildings.filter((b) => b.produces);
const SIMPLE_POWER = DATA.buildings.filter((b) => !b.converts && (b.power ?? 0) > 0);
const CONSUMERS = DATA.buildings.filter((b) => (b.power ?? 0) < 0);
const HEATERS = DATA.buildings.filter((b) => !b.converts && (b.heat ?? 0) > 0);
const FABS = DATA.buildings.filter((b) => b.autocraft);

function flow(r: Report | undefined, res: string, label: string, rate: number) {
  if (!r || rate === 0) return;
  (r.flows[res] ??= []).push({ label, rate });
}

function gain(s: GameState, caps: Amounts, res: string, amount: number): number {
  const before = s.res[res];
  if (amount <= 0 || before >= caps[res]) return 0;
  s.res[res] = Math.min(caps[res], before + amount);
  if (s.res[res] > (s.seen[res] ?? 0)) s.seen[res] = s.res[res];
  const got = s.res[res] - before;
  if (got > 0 && (REFINED.has(res) || COMPONENTS.has(res))) {
    s.run.produced[res] = (s.run.produced[res] ?? 0) + got;
    s.run.score += COMPONENTS.has(res) ? got * 15 : got;
  }
  return got;
}

export function activeCount(s: GameState, id: string): number {
  const n = s.buildings[id] ?? 0;
  if (!BLD[id].toggle) return n;
  return Math.min(n, s.active[id] ?? n);
}

/** Input-limited efficiency for a converter about to consume `need` per unit throughput over dt. */
function inputEff(s: GameState, ins: Amounts, thr: number, dt: number): number {
  let eff = 1;
  for (const [r, v] of Object.entries(ins)) {
    const need = v * thr * dt;
    if (need > 0) eff = Math.min(eff, s.res[r] / need);
  }
  return Math.max(0, eff);
}

/**
 * Advance the simulation by dt seconds. Deterministic for a given state and dt.
 * Pass a Report to record flows for the UI.
 */
export function tick(s: GameState, dt: number, r?: Report): void {
  s.time += dt;
  s.totalTime += dt;

  // expire temporary modifiers
  if (s.tempMods.length) {
    const before = s.tempMods.length;
    s.tempMods = s.tempMods.filter((t) => t.until > s.time);
    if (s.tempMods.length !== before) invalidate(s);
  }

  const d = derived(s);
  const caps = d.caps;
  const se = season(s);
  const glob = m(s, 'global');

  // ---- power ----
  let supply = WORLD.base.power;
  flow(r, 'power', 'Crash pod reactor', WORLD.base.power);
  let heatSupply = WORLD.base.heat;
  flow(r, 'heat', 'Crash pod', WORLD.base.heat);
  const powerMult = m(s, 'power');
  for (const b of SIMPLE_POWER) {
    const n = s.buildings[b.id] ?? 0;
    if (!n) continue;
    const seasonal = b.seasonal === 'solar' ? se.solar : 1;
    const p = b.power! * n * seasonal * m(s, `bld:${b.id}`) * powerMult;
    supply += p;
    flow(r, 'power', `${b.name} ×${n}`, p);
  }
  for (const b of GENERATORS) {
    const n = activeCount(s, b.id);
    if (!n) continue;
    const thr = n * m(s, `bld:${b.id}`);
    const eff = inputEff(s, b.converts!.in, thr, dt);
    const e = Math.min(1, eff);
    for (const [res, v] of Object.entries(b.converts!.in)) {
      s.res[res] = Math.max(0, s.res[res] - v * thr * e * dt);
      flow(r, res, `${b.name} ×${n}`, -v * thr * e);
    }
    if (b.power && b.power > 0) {
      const p = b.power * thr * e * powerMult;
      supply += p;
      flow(r, 'power', `${b.name} ×${n}`, p);
    }
    if (b.heat && b.heat > 0) {
      const h = b.heat * thr * e;
      heatSupply += h;
      flow(r, 'heat', `${b.name} ×${n}`, h);
    }
    if (r) r.eff[b.id] = e;
  }
  let demand = 0;
  for (const b of CONSUMERS) {
    const n = activeCount(s, b.id);
    if (!n) continue;
    demand += -b.power! * n;
    flow(r, 'power', `${b.name} ×${n}`, b.power! * n);
  }
  const pEff = demand > 0 ? Math.min(1, supply / demand) : 1;
  if (r) r.power = { supply, demand, eff: pEff };

  // ---- heat ----
  for (const b of HEATERS) {
    const n = (b.power ?? 0) < 0 ? activeCount(s, b.id) : s.buildings[b.id] ?? 0;
    if (!n) continue;
    const e = (b.power ?? 0) < 0 ? pEff : 1;
    const h = b.heat! * n * e;
    heatSupply += h;
    flow(r, 'heat', `${b.name} ×${n}`, h);
  }
  heatSupply *= m(s, 'heat');
  const heatDemand = s.pop * WORLD.heatPerSurvivor * se.heat * m(s, 'heatDemand');
  flow(r, 'heat', `Survivors ×${s.pop} (${se.name})`, -heatDemand);
  const hRatio = heatDemand > 0 ? Math.min(1, heatSupply / heatDemand) : 1;
  const coldMult = 0.4 + 0.6 * hRatio;
  if (r) {
    r.heat = { supply: heatSupply, demand: heatDemand, ratio: hRatio };
    r.cold = hRatio < 1;
  }

  // ---- jobs ----
  const jobsMult = m(s, 'jobs') * glob * coldMult;
  for (const j of DATA.jobs) {
    const n = s.jobs[j.id] ?? 0;
    if (!n || !j.produces) continue;
    const seasonal = j.seasonal === 'farm' ? se.farm : 1;
    const k = n * jobsMult * m(s, `job:${j.id}`) * seasonal;
    for (const [res, v] of Object.entries(j.produces)) {
      const amt = v * k * m(s, `res:${res}`);
      gain(s, caps, res, amt * dt);
      flow(r, res, `${j.name}s ×${n}`, amt);
    }
  }

  // ---- passive building production ----
  for (const b of PRODUCERS) {
    const powered = (b.power ?? 0) < 0;
    const n = powered ? activeCount(s, b.id) : s.buildings[b.id] ?? 0;
    if (!n) continue;
    const seasonal = b.seasonal === 'farm' ? se.farm : b.seasonal === 'solar' ? se.solar : 1;
    const k = n * glob * m(s, `bld:${b.id}`) * seasonal * (powered ? pEff : 1);
    for (const [res, v] of Object.entries(b.produces!)) {
      const amt = v * k * m(s, `res:${res}`);
      gain(s, caps, res, amt * dt);
      flow(r, res, `${b.name} ×${n}`, amt);
    }
  }

  // ---- food ----
  const use = s.pop * WORLD.foodPerSurvivor * m(s, 'foodUse');
  flow(r, 'food', `Survivors ×${s.pop}`, -use);
  let starving = false;
  if (s.res.food >= use * dt) s.res.food -= use * dt;
  else { s.res.food = 0; starving = true; }

  // ---- converters ----
  const convMult = m(s, 'converters');
  const yieldMult = m(s, 'convYield');
  for (const b of PROCESSORS) {
    const n = activeCount(s, b.id);
    if (!n) continue;
    const powered = (b.power ?? 0) < 0;
    const thr = n * m(s, `bld:${b.id}`) * convMult * (powered ? pEff : 1);
    if (thr <= 0) { if (r) r.eff[b.id] = 0; continue; }
    let e = Math.min(1, inputEff(s, b.converts!.in, thr, dt));
    // don't burn inputs into a full store
    for (const [res, v] of Object.entries(b.converts!.out)) {
      const make = v * thr * yieldMult * m(s, `res:${res}`) * dt;
      if (make > 0 && caps[res] !== Infinity) e = Math.min(e, Math.max(0, (caps[res] - s.res[res]) / make));
    }
    if (r) r.eff[b.id] = powered ? e * pEff : e;
    if (e <= 0) continue;
    for (const [res, v] of Object.entries(b.converts!.in)) {
      s.res[res] = Math.max(0, s.res[res] - v * thr * e * dt);
      flow(r, res, `${b.name} ×${n}`, -v * thr * e);
    }
    for (const [res, v] of Object.entries(b.converts!.out)) {
      const amt = v * thr * e * yieldMult * m(s, `res:${res}`);
      gain(s, caps, res, amt * dt);
      flow(r, res, `${b.name} ×${n}`, amt);
    }
  }

  // ---- fabricators / auto-craft ----
  let fabRate = 0;
  for (const b of FABS) fabRate += activeCount(s, b.id) * b.autocraft! * pEff;
  fabRate *= m(s, 'autocraft');
  if (r) r.autocraft = fabRate;
  if (fabRate > 0) {
    const rules = DATA.recipes.filter((rc) => {
      const rule = s.autocraft[rc.id];
      if (!rule?.on || !recipeUnlocked(s, rc.id)) return false;
      const outRes = Object.keys(rc.out)[0];
      return s.res[outRes] < rule.target;
    });
    if (rules.length) {
      const share = (fabRate / rules.length) * dt;
      const craftMult = m(s, 'craft');
      for (const rc of rules) {
        const e = Math.min(1, inputEff(s, rc.in, share / dt, dt));
        if (e <= 0) continue;
        for (const [res, v] of Object.entries(rc.in)) {
          s.res[res] = Math.max(0, s.res[res] - v * share * e);
          flow(r, res, `Auto-craft ${rc.name}`, (-v * share * e) / dt);
        }
        for (const [res, v] of Object.entries(rc.out)) {
          gain(s, caps, res, v * share * e * craftMult);
          flow(r, res, 'Fabricators', (v * share * e * craftMult) / dt);
        }
      }
    }
  }

  // ---- population ----
  const cap = housing(s);
  const attr = m(s, 'attrition');
  if (starving) {
    s.loss += WORLD.starvePerSecond * dt * attr;
    s.growth = 0;
  } else if (hRatio < 0.5) {
    s.loss += WORLD.coldLossPerSecond * (0.5 - hRatio) * 2 * dt * attr;
  } else {
    s.loss = Math.max(0, s.loss - dt * 0.02);
    if (s.pop < cap && hRatio >= 0.9) s.growth += WORLD.growthPerSecond * dt * m(s, 'growth');
  }
  if (r) r.starving = starving;
  if (s.loss >= 1) {
    s.loss -= 1;
    if (s.pop > 1) {
      removeSurvivor(s);
      addLog(s, starving ? 'A survivor starved. Food stores are empty.' : 'A survivor froze in the night. We need more heat.', 'event');
    }
  }
  if (s.growth >= 1) {
    s.growth -= 1;
    if (s.pop < cap) addSurvivor(s);
  }
  if (s.pop > s.peakPop) s.peakPop = s.pop;

  // ---- world ----
  checkStory(s);
  checkEvents(s);
}

/** Pure helper for the UI: net rate per resource from a report. */
export function netRates(r: Report): Amounts {
  const out: Amounts = {};
  for (const [res, list] of Object.entries(r.flows)) out[res] = list.reduce((a, f) => a + f.rate, 0);
  return out;
}
