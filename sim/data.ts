import resources from '../data/resources.json';
import jobs from '../data/jobs.json';
import buildings from '../data/buildings.json';
import research from '../data/research.json';
import recipes from '../data/recipes.json';
import doctrines from '../data/doctrines.json';
import legacy from '../data/legacy.json';
import events from '../data/events.json';
import story from '../data/story.json';
import world from '../data/world.json';
import goals from '../data/goals.json';
import type {
  BuildingDef, GoalDef, DoctrineDef, EventDef, JobDef, LegacyDef, RecipeDef, ResearchDef, ResourceDef, StoryDef, WorldDef,
} from './types';

export interface GameData {
  resources: ResourceDef[];
  jobs: JobDef[];
  buildings: BuildingDef[];
  research: ResearchDef[];
  recipes: RecipeDef[];
  doctrines: DoctrineDef[];
  legacy: LegacyDef[];
  events: EventDef[];
  story: StoryDef[];
  goals: GoalDef[];
  world: WorldDef;
}

export const DATA: GameData = {
  resources: resources as unknown as ResourceDef[],
  jobs: jobs as unknown as JobDef[],
  buildings: buildings as unknown as BuildingDef[],
  research: research as unknown as ResearchDef[],
  recipes: recipes as unknown as RecipeDef[],
  doctrines: doctrines as unknown as DoctrineDef[],
  legacy: legacy as unknown as LegacyDef[],
  events: events as unknown as EventDef[],
  story: story as unknown as StoryDef[],
  goals: goals as unknown as GoalDef[],
  world: world as unknown as WorldDef,
};

function index<T extends { id: string }>(list: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of list) out[item.id] = item;
  return out;
}

export const RES = index(DATA.resources);
export const JOB = index(DATA.jobs);
export const BLD = index(DATA.buildings);
export const RSC = index(DATA.research);
export const RCP = index(DATA.recipes);
export const DOC = index(DATA.doctrines);
export const LEG = index(DATA.legacy);
export const EVT = index(DATA.events);
export const WORLD = DATA.world;
export const GOAL = index(DATA.goals);

/** Validate cross references. Returns a list of problems (empty = valid). */
export function validateData(d: GameData = DATA): string[] {
  const problems: string[] = [];
  const res = new Set(d.resources.map((r) => r.id));
  const bld = new Set(d.buildings.map((b) => b.id));
  const rsc = new Set(d.research.map((r) => r.id));
  const checkAmounts = (where: string, a: Record<string, number> | undefined) => {
    for (const k of Object.keys(a ?? {})) if (!res.has(k)) problems.push(`${where}: unknown resource "${k}"`);
  };
  const gls = new Set(d.goals.map((g) => g.id));
  const jbs = new Set(d.jobs.map((j) => j.id));
  const checkReq = (where: string, r: { research?: string[]; buildings?: Record<string, number>; seen?: Record<string, number>; goals?: string[]; jobs?: Record<string, number> } | undefined) => {
    for (const k of r?.goals ?? []) if (!gls.has(k)) problems.push(`${where}: unknown goal "${k}"`);
    for (const k of Object.keys(r?.jobs ?? {})) if (!jbs.has(k)) problems.push(`${where}: unknown job "${k}"`);
    for (const k of r?.research ?? []) if (!rsc.has(k)) problems.push(`${where}: unknown research "${k}"`);
    for (const k of Object.keys(r?.buildings ?? {})) if (!bld.has(k)) problems.push(`${where}: unknown building "${k}"`);
    checkAmounts(where, r?.seen);
  };
  for (const j of d.jobs) { checkAmounts(`job ${j.id}`, j.produces); checkReq(`job ${j.id}`, j.requires); }
  for (const b of d.buildings) {
    checkAmounts(`building ${b.id} cost`, b.cost);
    checkAmounts(`building ${b.id} produces`, b.produces);
    checkAmounts(`building ${b.id} in`, b.converts?.in);
    checkAmounts(`building ${b.id} out`, b.converts?.out);
    for (const k of Object.keys(b.storage ?? {})) {
      if (!res.has(k) && !['raw', 'refined', 'all'].includes(k)) problems.push(`building ${b.id}: unknown storage key "${k}"`);
    }
    checkReq(`building ${b.id}`, b.requires);
    if (!(b.costMult >= 1)) problems.push(`building ${b.id}: costMult must be >= 1`);
  }
  for (const r of d.research) { checkAmounts(`research ${r.id}`, r.cost); checkReq(`research ${r.id}`, r.requires); }
  for (const r of d.recipes) { checkAmounts(`recipe ${r.id} in`, r.in); checkAmounts(`recipe ${r.id} out`, r.out); checkReq(`recipe ${r.id}`, r.requires); }
  for (const e of d.events) checkReq(`event ${e.id}`, e.requires);
  for (const s of d.story) checkReq(`story ${s.id}`, s.when);
  for (const g of d.goals) { checkReq(`goal ${g.id}`, g.check); checkAmounts(`goal ${g.id} reward`, g.reward); }
  // research prerequisites must not be in a higher tier (Recall keeps whole tiers) and must be acyclic
  const tier = Object.fromEntries(d.research.map((r) => [r.id, r.tier]));
  const reqs = Object.fromEntries(d.research.map((r) => [r.id, r.requires?.research ?? []]));
  for (const r of d.research) {
    for (const p of reqs[r.id]) {
      if (tier[p] !== undefined && tier[p] > r.tier) problems.push(`research ${r.id}: prerequisite ${p} is in a higher tier`);
    }
  }
  const state: Record<string, 0 | 1 | 2> = {};
  const visit = (id: string): boolean => {
    if (state[id] === 2) return true;
    if (state[id] === 1) return false;
    state[id] = 1;
    for (const p of reqs[id] ?? []) if (!visit(p)) return false;
    state[id] = 2;
    return true;
  };
  for (const r of d.research) if (!visit(r.id)) { problems.push(`research ${r.id}: prerequisite cycle`); break; }
  return problems;
}
