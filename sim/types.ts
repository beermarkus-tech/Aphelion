// Pure data types. Nothing in /sim may touch the DOM.

export type Amounts = Record<string, number>;

export interface Mod {
  key: string;
  add: number;
}

/** Unlock / trigger condition. Every field present must hold. */
export interface Req {
  research?: string[];
  buildings?: Record<string, number>;
  seen?: Amounts;
  pop?: number;
  season?: string;
}

export interface ResourceDef {
  id: string;
  name: string;
  tier: 'need' | 'raw' | 'refined' | 'component' | 'science';
  cap: number | null;
  desc: string;
}

export interface JobDef {
  id: string;
  name: string;
  desc: string;
  produces?: Amounts;
  effects?: Mod[];
  seasonal?: 'farm' | 'solar';
  requires?: Req;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: 'habitat' | 'production' | 'industry' | 'power' | 'science' | 'storage' | 'project';
  desc: string;
  cost: Amounts;
  costMult: number;
  produces?: Amounts;
  converts?: { in: Amounts; out: Amounts };
  power?: number;
  heat?: number;
  storage?: Amounts;
  housing?: number;
  seasonal?: 'farm' | 'solar';
  toggle?: boolean;
  max?: number;
  effects?: Mod[];
  autocraft?: number;
  requires?: Req;
}

export interface ResearchDef {
  id: string;
  tier: number;
  name: string;
  desc: string;
  cost: Amounts;
  requires?: Req;
  effects?: Mod[];
  doctrine?: boolean;
}

export interface RecipeDef {
  id: string;
  name: string;
  in: Amounts;
  out: Amounts;
  requires?: Req;
}

export interface DoctrineDef {
  id: string;
  name: string;
  desc: string;
  effects: Mod[];
}

export interface LegacyDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  costMult: number;
  max: number;
  effects: Mod[];
}

export interface EventOutcome {
  res?: Amounts;
  resPct?: Amounts;
  pop?: number;
  mod?: { key: string; add: number; duration: number; label: string };
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  chance: number;
  requires?: Req;
  choices: { label: string; outcome: EventOutcome; result: string }[];
}

export interface StoryDef {
  id: string;
  when: Req;
  text: string;
}

export interface SeasonDef {
  id: string;
  name: string;
  solar: number;
  farm: number;
  heat: number;
}

export interface WorldDef {
  tick: number;
  seasonLength: number;
  seasons: SeasonDef[];
  start: { pop: number; housing: number; res: Amounts };
  base: { power: number; heat: number };
  foodPerSurvivor: number;
  heatPerSurvivor: number;
  growthPerSecond: number;
  starvePerSecond: number;
  coldLossPerSecond: number;
  clickScrap: number;
  rebuild: { scoreDivisor: number; exponent: number; minPop: number; legacyBonus: number };
  ascension: { creditBonus: number; echo: number };
  offline: { fullHours: number; maxHours: number; declineHours: number; coarseTick: number };
  eventInterval: number;
  eventExpiry: number;
  maxPendingEvents: number;
}

export type Notation = 'scientific' | 'engineering' | 'words';

export interface LogEntry {
  t: number; // totalTime (game seconds) when logged
  text: string;
  kind: 'story' | 'event' | 'info' | 'milestone';
}

export interface TempMod {
  key: string;
  add: number;
  until: number; // run time
  label: string;
}

export interface PendingEvent {
  id: string;
  at: number; // totalTime when it fired
}

export interface AutoRule {
  on: boolean;
  target: number;
}

export interface GameState {
  version: number;
  rng: number;
  rev: number;

  time: number; // seconds in the current run
  totalTime: number; // seconds across all runs

  res: Amounts;
  seen: Amounts; // highest amount held this run (drives reveal)
  buildings: Record<string, number>;
  active: Record<string, number>;
  jobs: Record<string, number>;
  pop: number;
  bonusHousing: number;
  growth: number;
  loss: number;
  peakPop: number;

  research: Record<string, true>;
  doctrine: string | null;
  autocraft: Record<string, AutoRule>;
  defaultJob: string | null;

  tempMods: TempMod[];
  events: PendingEvent[];
  nextEventAt: number;
  story: Record<string, true>;
  log: LogEntry[];

  run: { score: number; produced: Amounts };
  prestige: {
    legacy: number;
    legacyEarned: number;
    perks: Record<string, number>;
    rebuilds: number;
    ascensions: number;
    credits: number;
    echo: number;
    bestScore: number;
  };

  chrono: number;
  overdrive: boolean;
  settings: { notation: Notation; seenIntro: boolean };
  lastSaved: number;
  stats: { clicks: number; crafted: number; eventsSeen: number; firstRebuildAt: number | null };
}
