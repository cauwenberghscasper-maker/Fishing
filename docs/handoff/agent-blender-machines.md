# Blender machines agent: net_rig, reel_mill, cannery (handoff)

_Status: DONE (9 Nov). Checks: `npm run build` and `tools/smoke.py` pass (ready, no errors). `tools/check-art.mjs` flags none of these files. All 9 models were bought and placed in the real game (`?test=100`) with `economy.upgradeBuilding`, and every animated node was found and moving._

## What was built
There are 9 bespoke models, each with a 256 px `preview.webp`, in `public/assets/world/<id>/`:
- Each is built procedurally in Blender (bpy) from bevelled timbers, crooked driftwood, rope lashings, nails, patched boards, gears and lathed brass.
- Each is painted with the shared `cove_atlas.jpg` and `cove_net.png`, using D's material names (`cove_atlas`, `cove_atlas_ds` only for cloth, nets and open shells, `cove_glow`, `cove_net`).
- AO and weathering are baked into COLOR_0: ray-traced AO, ground grime, a wet tide line on stakes, and sun-bleach on upward faces.
- Format: metres, Y-up, front +Z facing the sea, origin at the footprint centre at ground level. Files are meshopt + quantized like D's, with the textures external (`../_shared/...`).

All nine use `placement: "ground"`, including the net rig. Build spots are on owned land. `placement: "water"` would put the origin at y=0 and add a walkable dock deck (island.js `placeBuilding`), which would sink the rig into the plot and create a phantom deck. Each net rig is instead a real tide-line fishery set on the sand (stake net, weir, drawn-up raft) with its seaward side at +Z.

| id | name | tris | bytes | footprint (m) |
|---|---|---|---|---|
| net_rig_l1 | Stake Net | 3,993 | 99 KB | 4.36 × 1.51 |
| net_rig_l2 | Tidal Weir | 6,929 | 159 KB | 4.17 × 4.35 |
| net_rig_l3 | Drift-net Raft | 6,780 | 174 KB | 4.76 × 4.75 |
| reel_mill_l1 | Bell Rack | 4,513 | 128 KB | 3.94 × 3.26 |
| reel_mill_l2 | Tide Wheel | 6,441 | 153 KB | 4.50 × 3.39 |
| reel_mill_l3 | Clockwork Reel Mill | 9,653 | 244 KB | 5.47 × 4.49 |
| cannery_l1 | Tin Bench | 4,951 | 111 KB | 4.24 × 2.97 |
| cannery_l2 | Steam Cannery | 7,348 | 172 KB | 4.50 × 4.17 |
| cannery_l3 | Cannery Works | 7,314 | 189 KB | 4.65 × 4.94 |

All nine fit the 10k-triangle building budget. Each model's story is in its manifest `story`.

## Animated nodes (glTF node names; the pivot sits on the axis or hinge)
- Every animated node is an empty with identity rotation, so its axes are the model's axes. Its mesh is a child named `mesh_<node>`; that name doesn't start with `anim`, so it is never animated twice.
- `anim_light` empties sit inside each lantern and swing with it. Their positions are in the manifest `light` field.
- Every node position is in the manifest `anim` field (`{name: [x, y, z]}`).
- **net_rig_l1:**
  - Cork floats: `anim_bob_3_22`, `anim_bob_2_27`, `anim_bob_3_19` (one per net section).
  - A fish kicking in the mesh: `anim_swing_y_22_5`.
  - The stake lantern: `anim_swing_z_9_26`.
- **net_rig_l2:**
  - The sluice gate (the Marigold's cabin door, hinged at the top): `anim_swing_x_12_44`.
  - A fish flapping in the pound: `anim_swing_z_28_6`.
  - The lantern: `anim_swing_x_8_30`.
- **net_rig_l3:**
  - The whole raft: `anim_bob_3_46`. The parts below are its children.
  - Winch drum, 30T gear: `anim_spin_x_m24`.
  - Crank pinion, 10T: `anim_spin_x_72`. 24 × 30/10 = 72, opposite way.
  - Stern roller: `anim_spin_x_m96`. Its surface speed matches the drum.
  - Lantern: `anim_swing_z_10_28`.
  - Trailing-net corks (not part of the raft): `anim_bob_4_21`.
- **reel_mill_l1:**
  - Two nodding rod groups: `anim_swing_x_2_31` and `anim_swing_x_3_37`.
  - Six tip bells, children of the rods: `anim_swing_x_16_7`, `_z_14_8`, `_x_18_6`, `_z_15_9`, `_x_16_8`, `_z_12_7`.
  - The counterweight lever: `anim_swing_x_7_34`.
  - The stone bucket on the lever (its child): `anim_swing_z_6_17`.
- **reel_mill_l2:**
  - Water wheel, axle and 36T gear: `anim_spin_x_m30`.
  - 12T pinion, reel shaft and 5 reels: `anim_spin_x_90`. 30 × 36/12 = 90.
  - Striker bell: `anim_swing_x_14_9`.
  - Lantern: `anim_swing_x_9_27`.
- **reel_mill_l3:**
  - The gear train meshes at true ratios:
    - Wheel and 40T gear: `anim_spin_x_m24`.
    - 16T/32T compound gear: `anim_spin_x_60`.
    - 12T pinion, reel shaft 1 and 6 reels: `anim_spin_x_m160`.
    - 12T pinion, reel shaft 2 and 6 reels: `anim_spin_x_160`.
  - Pendulum: `anim_swing_z_9_20`.
  - Tide-clock hand: `anim_spin_z_m6`.
  - Crown bell: `anim_swing_x_16_13`.
  - Fish weathervane: `anim_swing_y_35_90`.
  - Two lanterns: `anim_swing_x_8_25` and `anim_swing_z_8_29`.
- **cannery_l1:**
  - Press tommy bar and screw: `anim_swing_y_28_32`.
  - Ridge lantern: `anim_swing_z_8_24`.
- **cannery_l2:**
  - Stovepipe smoke: `anim_smoke`.
  - Boiler flywheel: `anim_spin_x_150`.
  - Sealing press: `anim_swing_y_24_28`.
  - Lantern: `anim_swing_x_8_26`.
- **cannery_l3:**
  - Chimney smoke: `anim_smoke`.
  - Five chute rollers: `anim_spin_x_m200` … `_4`.
  - Belt flywheel: `anim_spin_x_90`.
  - Hoist hook and crate: `anim_swing_x_5_33`.
  - Door lantern: `anim_swing_x_8_24`.

## Colliders
- **Source:** shapes come from the solid parts' real geometry between 0.05 and 1.0 m, including edges that cross that band, so tall boards and posts count. Shapes are D's `circle` / `box` format, and some models have a list of shapes. Every box is at least 0.12 m thick.
- **Never block:** nets, sailcloth, ropes, lines and small loose props.
- **What blocks:**
  - Stake circles.
  - The weir wings, pound and catwalk.
  - The raft deck and mooring post.
  - The rod rack and lever post.
  - The wheel flume, reel bench and tower.
  - The tin bench, barrels and roof posts.
  - The shed walls one by one, so the open front stays walkable, plus the boiler.
  - The works building, chimney and chute foot.

## Screenshots (`docs/handoff/shots/`)
- `machines_game.png`: all 9 from a 50° game camera, colliders in red, sea at +Z.
- `machines_eye.png`: all 9 at eye level.
- `machines_anim_pose.png`: every animated node posed at t = 2.5 s, to check that pivots stay on their axes.
- `machines_ingame.png`: each level bought and placed in the real game at the default spots, with `?test=100`.

## Tools (git-ignored, `.cache/blender/`)
- `scripts/machlib.py` is the builder library: atlas UVs, tube UVs, AO and weathering, colliders, export.
- `scripts/net_rig.py`, `scripts/reel_mill.py`, `scripts/cannery.py` take a level argument.
- `ship.sh <script> <level> <id>` builds, post-processes (`node/post.mjs`: D's material settings, external textures, meshopt) and copies into `public/`.
- `scripts/register.py` rewrites only these 9 manifest entries.
- Renderers: `render/view.html` with `render/shot.py` (three.js sheets and previews), and `render/ingame.py` (buys and places the machines in the real build).
- All builds are seeded and repeat exactly.

## For Casper to decide
1. **Net rig on land or water:** the net rigs stand on the sand at the tide line. If you want the raft actually floating, it needs a water build spot type, because water placement currently adds a dock deck.
2. **No concept cards yet:** these 9 have no painted concept or card (`concept: null`). Agent F's cards can be painted from these models.
3. **File sizes:** 99–244 KB each, 1.43 MB for all nine. That is heavier per file than D's buildings because of the separate moving parts and all the small detail. It can be trimmed if download size matters.
4. **Draw calls:** each moving part is its own node (about 2–12 extra draw calls per machine; cannery_l3's five rollers and reel_mill_l1's six bells cost the most). This matters if the phone draw-call budget gets tight.
