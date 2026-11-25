import {
  BLD, DATA, RES, WORLD, buildingCost, caps, derived, fmt, fmtRate, fmtTime, housing, m, reqMet, type Amounts, type GameState,
  type Report, type BuildingDef,
} from '../sim';

export const name = (id: string) => RES[id]?.name ?? (id === 'power' ? 'Power' : id === 'heat' ? 'Heat' : id);

export function n(s: GameState, v: number, digits = 2) {
  return fmt(v, s.settings.notation, digits);
}

export function rate(s: GameState, v: number) {
  return fmtRate(v, s.settings.notation);
}

export function netRate(r: Report, res: string): number {
  return (r.flows[res] ?? []).reduce((a, f) => a + f.rate, 0);
}

export interface CostLine {
  res: string;
  need: number;
  have: number;
  ok: boolean;
  overCap: boolean;
  eta: number | null; // seconds until affordable at current rate
}

export function costLines(s: GameState, r: Report, cost: Amounts): CostLine[] {
  const cp = caps(s);
  return Object.entries(cost).map(([res, need]) => {
    const have = s.res[res] ?? 0;
    const ok = have >= need - 1e-9;
    const overCap = need > cp[res] + 1e-9;
    const rt = netRate(r, res);
    const eta = ok ? 0 : overCap || rt <= 0 ? null : (need - have) / rt;
    return { res, need, have, ok, overCap, eta };
  });
}

export function costEta(lines: CostLine[]): number | null {
  let worst = 0;
  for (const l of lines) {
    if (l.eta === null) return null;
    worst = Math.max(worst, l.eta);
  }
  return worst;
}

/** One-line summary of what a building does, generated from data. */
export function effectText(s: GameState, b: BuildingDef): string[] {
  const out: string[] = [];
  const k = m(s, `bld:${b.id}`);
  for (const [r, v] of Object.entries(b.produces ?? {})) out.push(`+${fmt(v * k)} ${name(r)}/s`);
  if (b.converts) {
    const ins = Object.entries(b.converts.in).map(([r, v]) => `${fmt(v * k)} ${name(r)}`).join(' + ');
    const outs = Object.entries(b.converts.out).map(([r, v]) => `${fmt(v * k)} ${name(r)}`).join(' + ');
    if (outs) out.push(`${ins} → ${outs} /s`);
    else out.push(`burns ${ins}/s`);
  }
  if (b.power) out.push(b.power > 0 ? `+${fmt(b.power)} power` : `uses ${fmt(-b.power)} power`);
  if (b.heat) out.push(`+${fmt(b.heat)} heat`);
  if (b.housing) out.push(`+${b.housing} housing`);
  for (const [r, v] of Object.entries(b.storage ?? {})) {
    out.push(`+${v} ${r === 'raw' ? 'raw' : r === 'refined' ? 'refined' : name(r)} storage`);
  }
  if (b.autocraft) out.push(`${fmt(b.autocraft)} auto-crafts/s`);
  return out;
}

/** Show a building once it's unlocked and the player has seen every resource it costs. */
export function buildingVisible(s: GameState, b: BuildingDef): boolean {
  if (!reqMet(s, b.requires)) return false;
  if ((s.buildings[b.id] ?? 0) > 0) return true;
  return Object.keys(b.cost).every((r) => (s.seen[r] ?? 0) > 0);
}

export function buildingAffordable(s: GameState, id: string): boolean {
  const c = buildingCost(s, id);
  return Object.entries(c).every(([r, v]) => (s.res[r] ?? 0) >= v - 1e-9);
}

/** Context-aware hint for the next sensible step. Drives the first-hour onboarding. */
export function hint(s: GameState, r: Report): string | null {
  const b = (id: string) => s.buildings[id] ?? 0;
  const se = WORLD.seasons[Math.floor(s.time / WORLD.seasonLength) % 4];
  const nextIsWinter = Math.floor(s.time / WORLD.seasonLength) % 4 === 2;
  if (r.starving) return 'Food is gone and people are leaving. Put more survivors on Grower duty or build Grow Tents.';
  if (r.heat.ratio < 0.9) return 'The colony is freezing. Build Burn Barrels (or Heat Exchangers) now.';
  if (r.power.eff < 0.99 && r.power.demand > 0) return 'Not enough power: machines run slower. Build Solar Arrays or Biomass Burners, or switch some machines off.';
  if (b('scrapyard') === 0 && s.res.scrap < 10) return 'Tap Scavenge to collect scrap from the wreck.';
  if (b('scrapyard') === 0) return 'Build a Scrapyard so scrap keeps coming in on its own.';
  if (Object.values(s.jobs).every((v) => !v)) return 'Open Crew and give your survivors jobs.';
  if (s.pop >= housing(s) && b('shelter') < 2) return 'Everyone has a bed. Build a Shelter so more survivors can join.';
  if (nextIsWinter && r.heat.supply < s.pop * WORLD.heatPerSurvivor * 1.7 * m(s, 'heatDemand')) {
    return `${se.name} ends soon and Deep Winter follows. Build Burn Barrels before the cold arrives.`;
  }
  if (b('terminal') === 0) return 'Build a Salvaged Terminal to unlock Scholars and research.';
  if (!s.jobs.scholar) return 'Assign a Scholar in Crew so the colony produces data for research.';
  if (Object.keys(s.research).length === 0) return 'Spend data in the Lab. Prospecting and Lichen Culture open new jobs.';
  if (!s.research.smelting) return 'Work toward Smelting in the Lab: it needs Prospecting and Distillation first.';
  if (s.research.smelting && !b('smelter')) return 'Build a Smelter. It needs fuel from a Distillery and power from Solar Arrays.';
  return null;
}

export function seasonInfo(s: GameState) {
  const idx = Math.floor(s.time / WORLD.seasonLength) % 4;
  const into = s.time % WORLD.seasonLength;
  return { season: WORLD.seasons[idx], left: WORLD.seasonLength - into, progress: into / WORLD.seasonLength, year: Math.floor(s.time / (WORLD.seasonLength * 4)) + 1 };
}

export function multSources(s: GameState, keys: string[]) {
  const d = derived(s);
  const out: { label: string; add: number; key: string }[] = [];
  for (const k of keys) for (const src of d.sources[k] ?? []) out.push({ ...src, key: k });
  return out;
}

export { fmtTime, DATA, BLD };

/** Svelte action: press-and-hold repeats the action, accelerating. Tap = once. */
export function hold(node: HTMLElement, fn: () => boolean | void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = 380;
  let current = fn;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    delay = 380;
  };
  const loop = () => {
    const ok = current();
    if (ok === false) return stop();
    delay = Math.max(50, delay * 0.8);
    timer = setTimeout(loop, delay);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || (node as HTMLButtonElement).disabled) return;
    e.preventDefault();
    current();
    timer = setTimeout(loop, delay);
  };
  const key = (e: MouseEvent) => {
    // keyboard activation (Enter/Space) arrives as a click with detail 0
    if (e.detail === 0) current();
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointerleave', stop);
  node.addEventListener('pointercancel', stop);
  node.addEventListener('click', key);
  node.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    update(f: () => boolean | void) {
      current = f;
    },
    destroy() {
      stop();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', stop);
      node.removeEventListener('pointerleave', stop);
      node.removeEventListener('pointercancel', stop);
      node.removeEventListener('click', key);
    },
  };
}

