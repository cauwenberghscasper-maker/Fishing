# Agent A — Engine & Fishing (handoff, live)

_Updated after every milestone. Status: IN PROGRESS._

| Milestone | Status |
|---|---|
| fish-behaviour.json (new M1 ids, `flat` + `shelled`) | done |
| Core: loop, input, asset loader, quality | in progress |
| Water shader | pending |
| Island terrain + layout | pending |
| Camera | pending |
| Player | pending |
| Aim / cast | pending |
| Bite / hook | pending |
| Fight | pending |
| Asset integration (C/D manifests) | pending |
| Screenshots + verification | pending |

## Notes so far
- `public/data/fish-behaviour.json` covers the 7 M1 ids: glasswing_sardine, driftback, compass_flounder, shellback_blenny, kelp_wraith, seaglass_puffer, old_mooring. Schema per INTERFACES.md plus extra keys A reads (`hookWindow`, `school`, `silhouette`, `glow`, `moveWeights`, `signature`).
