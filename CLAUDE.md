# Aphelion — notes for Claude Code

Deep idle game: a handful of survivors grow into a civilization. Every prestige layer is a change of scale.
Design source: the "Aphelion – Idle Game Design Proposal" (Nov 2026). This repo currently ships the MVP: **Era I (Cinder)**.

## Design pillars
1. Every minute rewards — early unlocks every 30–90 s.
2. Scale as prestige — resetting is a promotion; each layer adds a system.
3. Decisions over clicks — doctrines, research paths, specialisations.
4. Old layers stay alive — earlier systems keep contributing.
5. Respect the player — generous offline, soft walls, no pay-to-skip.

## Eras
| Era | Scale | Core mechanic | Reset reward | Status |
|---|---|---|---|---|
| I Cinder | One colony | Population, jobs, buildings, crafting | Legacy | **playable** |
| II Orbit | Home system | 8-tier generator chain | Launch Credits | next |
| III Drift | Nearby stars | Fleets, routes | Star Charts | later |
| IV Lattice | Galaxy | Megastructures | Resonance | later |
| V Aphelion | Universe | Rewriting constants | Constants | later |

## Layout
- `sim/` pure game logic, **no DOM**. Deterministic (seeded RNG in state). Entry: `sim/index.ts`.
- `data/` all content as JSON (resources, jobs, buildings, research, recipes, doctrines, legacy perks, events, story, world constants).
- `ui/` Svelte 5 app. `ui/game.svelte.ts` is the only bridge to the sim (loop, saves, offline catch-up).
- `tools/` bot player (`bot.ts`), balance simulator (`simulate.ts`), timeline trace (`trace.ts`), test-save generator, icon renderer.
- `tests/` Vitest: sim unit tests + balance gate.

## Coding rules
- The sim stays pure: no DOM, no `Date.now()`, no `Math.random()` (use `nextRandom(state)`).
- Content is data-driven. Adding a building/research/job/event should need only a JSON edit. Use generic modifier keys
  (`res:<id>`, `job:<id>`, `bld:<id>`, `jobs`, `converters`, `convYield`, `craft`, `autocraft`, `power`, `heat`, `heatDemand`,
  `growth`, `attrition`, `researchCost`, `buildCost`, `cap:<id|tier>`, `global`, `startPop`, `startScrap`, `keepTier`).
  Within a source group adds sum; groups multiply.
- Any action that changes modifiers must call `invalidate(state)` (bumps `rev`, refreshes the derived cache).
- Live play and offline catch-up both call `tick(state, WORLD.tick)` — never fork the math.
- Era I quantities are plain doubles (they stay far below 1e308). Bring in a big-number library with Era II's chain.
- UI must work at phone width (≥320px) and tablet; tap targets ≥44px; nothing may rely on hover.

## Commands
- `npm run dev` — dev server (`--host`, so a phone/tablet on the LAN can open it)
- `npm test` — all tests incl. balance gate (~25 s)
- `npm run sim` — milestone report vs pacing targets for every doctrine (`-- --quick` for 2 h)
- `npx vite-node tools/goals.ts 4` — goal and research timeline for the first hours
- `npx vite-node tools/trace.ts 90 5 automation` — minute-by-minute bot timeline
- `npm run check` — svelte-check + types; `npm run build` — production build into `dist/`

## Balance gate
Every change to costs or rates must keep `npm test` green: first Rebuild 60–90 min, doctrine 3–5 h, Ascension 4–7 days
(casual pattern), doctrine spread ≤ 15% (continuous play). These are 2x the original proposal's timings, chosen after the
first playtest felt too fast. Keep PROGRESS.md updated at the end of each session.

## Goal chain
`data/goals.json` is the player's guide and the early-game gate: goals complete strictly in order, persist across
Rebuilds, and early buildings/jobs `require` goals so only a few things are available at a time. Each new mechanic should
arrive with the goal that needs it (e.g. power appears only when a second Smelter needs it). `npx vite-node tools/goals.ts 4`
prints when the bot completes each goal and research — check it for dead zones after balance changes.
