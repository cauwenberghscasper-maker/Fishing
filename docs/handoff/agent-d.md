# Agent D — World & Character Assets (handoff)

_Status: DONE for this round (9 Nov). Last check: `npm run build` + `tools/smoke.py` OK (ready, no errors); `tools/check-art.mjs` clean for D's files._

## Contact sheets (`docs/handoff/shots/`)
- `agent-d-buildings.png`: every building at l1–l3 (left to right), the scaffold, camp_l0 and the sandbar. Red outlines are the colliders.
- `agent-d-character.png`: the player and 4 worker fishers (idle / fish_idle / reel_loop).
- `agent-d-world-sheet.png`: all 85 unique world models with colliders.
- `agent-d-audit.png`: every world model from the game camera (48°) and eye level (8°), with colliders.

## What's in
**World manifest:** `public/assets/world/manifest.json`, 94 entries (85 models + 9 level/pier aliases that share a file), 4.3 MB total.

**Character manifest:** `public/assets/character/manifest.json`, 5 characters.

### Island growth (master prompt 4.6)
- **Day one:**
  - `sandbar`: crooked `pier_stub`, rocks, driftwood, a washed-up crate.
  - `camp_l0`: tarp lean-to, bedroll, crate seat with a lantern, driftwood fire with glowing embers and a fish on the spit.
- **Plot dressings:** `plot_palm_spit`, `plot_tidepool_shelf`, `plot_wreck_beach` (the beached Marigold + older wreck ribs), `plot_kelp_shallows`, `plot_basalt_cliff` (lantern cairn where the lighthouse will go), `plot_mooring_deep` (three lashed piles, iron ring, frayed ropes).
  - Each entry has `footprint_m`, `story`, a merged model, and `items`: `{model, pos, rotY, scale, placement}` in plot space (origin = plot centre at ground level, +Z = seaward), so A can either raise the merged model or place items on the sculpted terrain.
  - Each also has `colliders` (only its blocking items, already transformed into plot space).
- **Piers:** `pier_1`…`pier_6` are aliases of `pier_straight`, `pier_straight_b`, `pier_patched`, `pier_straight`, `pier_straight_b`, `pier_end`.
  - Modules are 3.0 m along Z and 2.0 m wide, origin at water level, deck at y=0.75.
  - `walkable: {deckY}` on every deck piece.

### Buildings × levels (9b.6)
- All 18 levels exist as `<building>_l1..l3`, plus `scaffold` (4×4 m, 3.3 m tall: scale x/z to the footprint).
- Every building has `footprint: {w, d}`, a box `collider`, a `story`, and `concept` = Agent F's card (`art/buildings/<id>.webp`). My HF concept stays in `concept_alt`.
- Legacy ids still used by A's code are kept: `shop_hullhouse` = `shop_l2`, `workers_hut` = `workers_hut_l2`, `boat_dock` = `boat_dock_l3`; aliases share the file.

| building | l1 | l2 | l3 |
|---|---|---|---|
| shop | crate stall under your rowboat's sail, brass hanging scale | the Hull House (upturned red hull) | hull lifted onto a 2nd storey, lit portholes, balcony, outside stair, crow's nest with lantern |
| cooler | seaweed-lined wicker basket under a sail lean-to | ice chest: sea chest packed with ice, ice blocks | basalt cold cellar, turf roof, brass-bound door, timber hoist |
| smokehouse | driftwood racks over a smouldering pit | tarred smoke shed, stovepipe, open hatch of golden fish | basalt firebox + octagonal tower, copper cowl, fish weathervane |
| aquarium | rock pool + shelf of glowing sea-glass jars | three barrel vats with lit porthole windows on a deck | glasshouse of ship windows around a glowing tank, dinghy roof |
| boat_dock | plank raft on cork floats + one mooring post | dock with cannon bollards, fenders, ladder, lantern | the rib-arch dock |
| workers_hut | hammock under a tarp, sea chest, rod rack | striped sail tent on oar A-frames + net rack | bunkhouse roofed with a sawn-up boat, ship's bell, hire board |

**Card vs model:** the cooler line was rebuilt to match the cards and the cooler screen (basket, then chest, then cellar). Other levels follow the cards' progression but not their exact shapes:
- F's aquarium l1 is a single glass tank (mine is a rock pool).
- F's dock l2 shows a crane (mine has cannon bollards).
- F's workers l2/l3 are stilt huts (mine are a sail tent and a bunkhouse).
- F's shop l1 card is nearly empty, and boat_dock l3's card is almost blank. **F may want to repaint those two.**

### Characters (9b.5)
- `fisher_player` (18 clips):
  - Brim shrunk ~30%, so the body (blue shirt, rust neckerchief, satchel) reads from a 45–50° camera.
  - The glowing teal fish-scale charm in the band is enlarged.
- **Worker fishers** (spawn one per hire; same rig, rod on `handslot.r`):
  - `worker_netmender`: Wim, beard, knit cap, net bundle.
  - `worker_deckhand`: Juno, yellow oilskin.
  - `worker_angler`: Sef, conical straw hat, creel.
  - `worker_boatwright`: Marta, navy pea coat, red sou'wester.
- **Worker clips:** idle, walk, fish_idle, cast_windup, cast_release, reel_loop, celebrate, interact, sit_idle.
- **Player clips:** the same as the workers, plus run, cast_aim, struggle_loop, hold_up_fish, dodge_left/right/back, hit, pick_up. See the character manifest `clips` for the game action each maps to.
- Characters have `collider: circle r=0.35`.

## Colliders (9b.7: no invisible walls)
- **Blocking (30 entries):** only buildings, big rocks/cliffs and palm trunks.
  - Shapes are derived from the model's real solid geometry at body height (0.05–1.0 m).
  - Leaves, cloth and nets never block. Building boxes are trimmed to the dense walls, so guy ropes don't extend them.
- **Shape:** `{type:'circle', r, x, z}` or `{type:'box', w, d, rot, x, z}`.
  - `x`, `z` = centre offset from the origin.
  - `rot` = rotation about +Y in the same sense as three.js `rotation.y`.
- **Non-blocking (`collider: null`):** all small props (grass, shells, small rocks, driftwood, buckets, barrels, crates, nets, lanterns, fences, signposts, hammock, kelp).
- **Walkable decks:** piers and docks also have `collider: null` and carry `walkable`.
- **Regenerate:** `.cache/agent-d/venv/bin/python -I .cache/agent-d/tools/finalize_manifest.py`.

## Audit fixes (9b.7: no cut or holey models)
- The barrel lying on its side was an open KayKit tube; it's replaced by a closed barrel.
- Open shells (barrel staves, bucket, stovepipes) are now double-sided, so you can't see through their insides.
- The pier gaps (missing plank, the patched-door hole) are closed.
- The standalone hammock now has its own posts.
- Floating stones in the lantern cairn, the hovering coconut and the hovering shell are fixed. The tarp on the crate stack is removed.
- The aquarium pool no longer pokes through its rock ring. The bunkhouse roof is rebuilt. The angler's hat normals are fixed.
- Double-sided materials (`cove_atlas_ds`) are used only for cloth, leaves, nets and open shells.

## Loader conventions (for A)
- Meshopt + quantized GLBs: call `GLTFLoader.setMeshoptDecoder`.
- One shared external texture, `assets/world/_shared/cove_atlas.jpg` (+ `cove_net.png`). Dedupe by material name: `cove_atlas`, `cove_atlas_ds`, `cove_glow` (emissive), `cove_net` (alpha mask).
- AO and weathering live in COLOR_0 (multiplied).
- Metres, Y-up, front +Z. Lanterns and the camp fire list a suggested point light in `light`.

## Gaps / for Casper
- **Cast animation:** no CC0 pack on GitHub has a true rod-cast clip. Ours is KayKit Throw split in two. Reel, struggle and hold-up are authored procedural layers. For hand-made fishing clips, attach Quaternius **Universal Animation Library 2** (CC0, "fishing" set): https://quaternius.com/packs/universalanimationlibrary2.html (download not reachable from the sandbox).
- **Over budget:** `shop_l3` is 10.7k tris, just over the 10k building budget.
- **Gear and boats:** `fishing_rod`, `bobber`, `lure`, `boat_skiff` are temp; Agent G owns them. Remove them when G's land.

## HF quota used by D
- 6 Nov: 2 Qwen-Image (~40 s), key art.
- 6 Nov after reset: 9 Qwen-Image (≤175 s wall), sandbar, plots, workers, player.
- 8 Nov: 10 Qwen-Image-Fast (~40 s GPU, ≤122 s wall), building levels + scaffold.
- All logged in `docs/art-ledger.md`. Every image is the `concept` (or `concept_alt`) of a model.

## Tools (in `.cache/agent-d/`, git-ignored; Agent C shares the bpy venv)
- `tools/py/*.py`: Blender builds (covelib, structlib, build_piers/nature/structures/props/plots/buildings/character).
- `tools/post_all.sh`: meshopt + manifest writer.
- `tools/finalize_manifest.py`: colliders, aliases, concepts.
- `tools/render/`: three.js contact sheets.
- Rebuild everything: run the build scripts, then `tools/post_all.sh`, then `finalize_manifest.py`.
