# Agent G — Gear & Boats (handoff, live)

_Updated after every step. Status: IN PROGRESS (8 Nov)._

## Plan / progress
1. [x] Boat concepts (4× Qwen-Image, 6 Nov) → `art/concepts/boats/<id>.webp` + side elevations `<id>_side.webp` (manifest fields `concept`, `sideView`)
2. [ ] Boats in Blender → `public/assets/boats/<id>/model.glb` + manifest (rowboat → patched_skiff → sail_sloop → storm_cutter)
3. [ ] Boat contact sheet `docs/handoff/shots/agent-g-boats.png`
4. [ ] Rods ×6 (+ `rod.<id>.broken`), reels ×5, baits ×5 + bobber, `lines` section, from F's cards (`public/art/gear/*`, = `concept`) + my views in `art/concepts/gear/` (= `sideView`)
5. [ ] Master prompt 4.7b tackle as F's cards land: hooks, sinkers, floats, leaders, lures, tools (`line` node on terminal tackle, `grip` on tools)
6. [ ] Gear contact sheet `docs/handoff/shots/agent-g-gear.png`, previews

## Tools (all in `.cache/agent-g/`)
- `py/glib.py` (clinker hull generator, sails, lanterns, export with empties), `py/build_boats.py`; Blender = `.cache/agent-d/venv/bin/python` (D's covelib/structlib imported read-only).
- `tools/post.mjs` (meshopt + quantize, shared textures external, empties kept) writes to a staging manifest `.cache/agent-g/stage/<kind>.json`; `tools/publish.mjs <kind> <keys|all>` copies verified entries into the live manifest.
- Live manifests `public/assets/gear/manifest.json`, `public/assets/boats/manifest.json` exist (valid JSON); entries appear only after they load in three.js.

## Work in progress named for check-art
- `art/concepts/boats/*` and `art/concepts/gear/*` are referenced by manifest entries once each model is published.
