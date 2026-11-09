# Blender sea agent: wrecks, coral, sea arch, kelp pillar, marker buoy, treasure chests (handoff)

_Status: DONE (9 Nov). Checks: `npm run build` passes, and `tools/check-art.mjs` flags none of these files. One Playwright shot from the real game (`?test=100&notitle=1`, dev server) loads six of the models with `loadModel('world', id)`, places them in the `under` group near the player, and shows no page errors._

## What was built
There are 22 bespoke bpy builds, each with a `model.glb` and a 256 px `preview.webp` in `public/assets/world/<id>/`, and each with a manifest entry that includes a story.
- **Format:** metres, Y-up, front +Z, meshopt + quantized.
- **Textures:** external `../_shared/cove_atlas.jpg` / `cove_net.png`, using D's material names.
- **Vertex colours:** AO, algae below the waterline, a wet band at the waterline and gull streaks are all baked into COLOR_0.
- **Coral colour:** I chose **per-vertex colour ramps on the atlas's flat cream cell**, so there is no new texture. Each coral runs from a dark rich base to a saturated living part to bright tips. The ramps are authored in sRGB and converted to linear (three.js reads vertex colours as linear). Sea-fan lattices use `cove_net` tinted by vertex colour.

| id | category | placement | tris | size | footprint (m) | top y |
|---|---|---|---|---|---|---|
| wreck_brig | landmark | seabed | 9,581 | 216 KB | 12.6 × 20.0 | 7.51 |
| wreck_skiff | prop | seabed | 2,735 | 69 KB | 3.6 × 6.0 | 1.98 |
| coral_fan_red / _violet | prop | seabed | 2,582 / 3,222 | 42 / 53 KB | 1.6–1.9 × 0.3–0.6 | 1.48 |
| coral_brain_gold / _green | prop | seabed | 2,523 / 2,512 | 39 / 38 KB | 1.2 × 1.1 | 0.28 |
| coral_staghorn_pink / _blue | prop | seabed | 1,898 / 1,934 | 34 / 32 KB | 1.2 × 1.1–1.3 | 1.08 |
| coral_tube_orange / _purple | prop | seabed | 1,196 each | 23 KB | 0.8 × 0.8 | 1.08 |
| coral_table_teal / _rose | prop | seabed | 1,456 each | 23 / 22 KB | 2.2 × 2.1 | 0.95 |
| coral_seawhip_yellow / _magenta | prop | seabed | 608 each | 14 KB | ~1 × 1 | 2.1 |
| coral_bed_a (warm) | prop | seabed | 7,998 | 125 KB | 6.6 × 5.6 | 2.04 |
| coral_bed_b (cool) | prop | seabed | 7,998 | 125 KB | 5.8 × 6.0 | 2.01 |
| sea_arch | landmark | seabed | 3,820 | 68 KB | 13.9 × 5.1 | 10.34 |
| kelp_cathedral_pillar | nature | seabed | 1,802 | 44 KB | 3.8 × 2.7 | 8.66 |
| marker_buoy | prop | **water** | 2,574 | 54 KB | 2.4 × 2.4 | 4.9 |
| treasure_chest_wood / _silver / _gold | prop | ground | 2,194 / 2,194 / 2,606 | 47 / 41 / 53 KB | 1.16 × 0.73 (gold 1.11 with its spill) | 0.75 |

The total is 64.7k tris and 1.24 MB. Each coral comes in two colour variants as separate ids: `coral_<kind>_<colour>`. There is no bare `coral_fan` id.

## For the lead to wire
1. **New placement `"seabed"`:** the origin sits on the sea floor, so place it at the floor height under (x, z). It is used by the wrecks, corals, beds, arch and kelp pillar. The existing `"underwater"` value (kelp_a) means the same thing, so you can alias the two.
2. **`water_depth` field (design depth):**
   - **wreck_brig: 3 m.** The foremast breaks the surface; the masthead sits at y≈7.3 above the floor (+4.3 above water) and the crow's nest at ≈5.3.
   - **sea_arch: 3 m.** The crown is at +7.3 above water, with about 6 m of clear width at the waterline. The legs reach 1.7 m below the origin to cover sloping floors.
   - **kelp_cathedral_pillar: 7.6 m.** At that depth the canopy lies flat on the surface. In shallower water, scale it to depth/7.6.
   - If the floor is deeper or shallower than the design depth, things rise or sink by the difference.
3. **marker_buoy uses `"water"`:** the origin is at the waterline, so set y = 0. Don't use the building dock-deck path for it. Its chain hangs to y≈-4.5.
4. **Underwater models must go in the `under` group, not `scene`.** I found this in the in-game test. `SplitScenePass` draws everything outside `under` again in pass 2, on top of the water, untinted, so coral then looks like it floats above the sea. Inside `under`, the water shader tints them by depth correctly.
5. **Animated nodes** (`anim` field; empties with identity rotation and a `mesh_<name>` child; read by `animParts.js`):
   - **wreck_brig:**
     - `anim_swing_z_7_46`: the figurehead's brass lantern sways from her hand.
     - `anim_light` sits inside the lantern. It wants a small warm point light, which is the "her lantern still burns" story beat.
   - **marker_buoy:** these are nested.
     - `anim_bob_9_38` moves the whole buoy.
     - Inside it, `anim_swing_z_5_47` rolls the buoy.
     - Inside that, `anim_swing_x_16_13` swings the bell.
     - `anim_light` sits in the lamp lens.
   - **kelp_cathedral_pillar:**
     - `anim_swing_z_4_47`: the middle section.
     - `anim_swing_x_9_62`: the upper fronds and the canopy.
   - **coral_seawhip_\* and both beds:** `anim_swing_x_5_42` and `anim_swing_z_4_51` move two whip groups.
6. **Treasure chests:**
   - The lid is a separate node named exactly **`lid`**. Its pivot is on the back hinge edge at (0, 0.5, -0.33), and the mesh child is `mesh_lid`. Rotating about local X opens it: negative is open, and about -1.3 rad is fully open.
   - The inside is dark with a heap of gold coins.
   - The gold chest has coins and a green gem wedged in the lip, plus coins and a ruby spilled in front of it.
   - Placement is `ground`, which also works on the seabed. They have no collider.
7. **Colliders:** only parts that are above water and solid have one.
   - wreck_brig: a circle at the point where the mast crosses the surface.
   - sea_arch: two leg boxes.
   - marker_buoy: a circle of radius 1.1.
   - Everything else is `null`.
8. **Glow:** the kelp float bulbs and the buoy lens are `cove_glow`. The kelp bulbs use the amber rim of the glow cell, at UV (902, 902). The brig's lantern glass is `cove_glow`.

## Stories, in short (full text in the manifest)
- **wreck_brig, "The Lantern Maid":** an oil brig from a century before the Marigold.
  - She lies on her port side with her starboard bilge torn open, so the ribs show, along with sprung planks and a black hull with an ochre strake.
  - Her foremast leans 43° out of the water with the crow's nest, a torn fore course and a dangling halyard. The ropes include the shrouds and ratlines, one snapped shroud, the stays and a yard lift.
  - Her mainmast snapped, and the top lies in the sand alongside with its yard.
  - Her figurehead is a carved woman holding up a brass lantern that still burns.
  - Spilled around her are oil barrels, a carronade, the bower anchor and loose planks, with barnacles and weed on the wreck.
- **wreck_skiff, "The Dory Bess":** Wim's grandfather's lobster skiff.
  - She is lapstrake, with white strakes, a blue sheer and a teal gunwale, and one strake stove in.
  - Her stern is buried in a sand drift, with one oar still in its rowlock and one in the sand.
  - A slatted lobster pot with net ends lies on its line, with a crab inside.
- **sea_arch, "The Bellows":** made of the island's **columnar basalt**.
  - The legs are clusters of upright hex columns, and the crown is columns set radially like the stones of a built arch ("giants laid it").
  - Fallen drums lie at its feet, with a barnacle belt and a weed curtain at the tide line.
  - Gull nests sit on the crown, with white streaks below them.
- **kelp_cathedral_pillar:** three amber stipes twisting together, glowing float bulbs and a canopy lying flat on the surface. Several of them make the aisles where the Kelp Wraith hides.
- **marker_buoy:** a red-and-white bell buoy with a red lattice tower, a bronze bell, a lamp and a red diamond topmark. One goes at every named ground.
- **coral_bed_a / b:** composed ~6 × 6 m reef patches, one warm and one cool. Each has coralline-crusted rocks (pink crust on top), the coral kinds above in their variant colours, swaying sea whips, anemones, starfish and shells, all on a low sand rise tinted `sand.under` (#b89a5c) whose edge sinks below y=0.

## Screenshots (`docs/handoff/shots/`)
- `sea_game.png`: all 22 from the 50° game camera over translucent water, with collider outlines in red.
- `sea_side.png`: the same set from the side.
- `sea_brig.png`: the brig's starboard bilge (hole and ribs) and its deck side (collapsed hold, mast and crow's nest).
- `sea_chests_open.png`: the three chests with their lids open.
- `sea_ingame.png`: the real game with coral_bed_a/b, wreck_skiff, treasure_chest_gold and coral_fan_violet placed near the player.

## Tools (git-ignored, `.cache/blender/`)
- **Libraries:** `scripts/sealib.py` extends `machlib.py` with per-vertex colour ramps, waterline weathering, ribbons, hull UVs that run planks continuously along the hull, sand mounds and loose-vertex cleanup.
- **Build scripts:** `scripts/sea_wrecks.py <id>`, `scripts/sea_coral.py <id>` and `scripts/sea_misc.py <id>`.
- **Build command:** `./build.sh <script> <id>` builds, post-processes and copies into `public/`.
- **Manifest:** `scripts/register_sea.py` rewrites only these 22 entries.
- **Renderers:** `render/sea_view.html` and `render/sea_shot.py` render the preview pages, with seabed and water levels per id (`ids=wreck_brig:3:0`, meaning id : water y : floor y) and `open=` to open the chest lids.
- All builds are seeded and repeat exactly.

## For Casper to decide
1. **Coral depth versus colour.** The game's water absorbs colour fast. In the in-game shot, the beds at 3.4–3.8 m read as teal silhouettes, while the fan at 0.9 m is fully violet. Put reef grounds on 0.8–2 m shelves, or let the water shader absorb less over the reef grounds.
2. **Brig and arch scale.** The brig is 20 m long including the bowsprit and the fallen mainmast, and its masthead stands 4.3 m above the water. The arch crown stands 7.3 m above water against the 6 m asked for. Both are easy to scale through manifest `scale`.
3. **Variant ids.** Each coral variant is its own id (12 files, 14–53 KB each). If one id per kind is preferred, I can merge them and vary the colour by seed instead.
4. **Draw calls.** Each swaying or animated part is a separate node: 2 for each sea whip and bed, 3 for the kelp, 4 for the buoy, 2 for the brig and 1 for each chest lid.
5. **No concept art.** All entries have `concept: null`.
