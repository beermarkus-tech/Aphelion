# Progress

## Done (MVP — Era I)
- **Engine**: fixed 0.2 s tick, deterministic seeded RNG, offline catch-up through the same tick (test: 12 h offline == 12 h live),
  offline rule (full 12 h, declining to 7 days, remainder stored as chrono time), save/load/export/import with migration defaults.
- **Data model**: 13 resources, 8 jobs, 27 buildings, 32 research topics, 3 recipes, 3 doctrines, 7 legacy perks, 6 events, 11 story beats.
- **Era I economy**: food/power/heat/housing needs, four seasons (solar/farm/heat), raw → refined converters with power
  efficiency and input/output limits, components by hand crafting (+craft bonus) and Fabricator auto-craft rules,
  starvation and cold attrition, toggleable machines, duty roster (default job).
- **Prestige**: Rebuild (Legacy, projected gain + next-point hint), Legacy perks incl. Recall, doctrine choice via Colony
  Charter, Ascension via the Ignition Chamber (Launch Credits + Legacy echo).
- **Events & story**: world-triggered events with trade-off choices (expire after 24 h), narrative log.
- **UI (phone + tablet)**: bottom tab bar + status strip on phones; status sidebar + top tabs on tablets; log column on wide
  landscape. Production breakdown sheet per resource (sources, drains, multipliers), cost chips with time-to-afford,
  hold-to-repeat buttons, context hints for the first hour, toasts, away report, notation toggle, PWA (installable, offline).
- **Balance** (`npm run sim`): first Rebuild 31 min; doctrine ~1h45; Ascension 2d1h–2d13h casual; doctrine spread 13.4%.

## Open items
- Era II (Orbit) is teased only: Ascension grants Launch Credits and restarts Era I.
- No audio yet (design calls for soft per-era ambient).
- No cloud save; export/import text and file download only.
- Anomaly system, challenges, secrets: not started.
- Native wrappers (Capacitor) not set up; the PWA covers install on iOS/Android for now.
- Balance bot is greedy and simple; real playtests may find other stall points (watch Hab Module costs and data caps mid-game).

## Next steps
1. Playtest the first hour on a phone and a tablet; tune hints and early costs.
2. Era II: big-number library, 8-tier Reactor chain fed by Era I output, first three challenges.
3. Telemetry opt-in for stall points; cosmetic theme pack scaffolding.
