# Blender monsters agent: mossneck, anchorjaw_leviathan, drowned_lighthouse (handoff)

_Status: DONE (9 Nov). `npm run build` passes. In the real build (`?test=100&notitle=1`), all three were spawned next to the player with `window.__game.world.spawnFish(id, x, z)`. Each one got its model (`userData.hasModel === true`, triangle counts match) and there were no console or page errors. `tools/check-art.mjs` flags none of these files._

## What was built
These are three bespoke end-game monsters. Each is one mesh with one material, built procedurally in Blender 5.2 (bpy) and painted procedurally. No kit pieces, scans or generated images are used.

| id | body | tris | bytes | preview | idea = anatomy |
|---|---|---|---|---|---|
| mossneck | eel | 11,856 | 305 KB | 512×224 | The humps are three real semicircular causeway arches. Each is built from 9 wedge voussoirs with grooved joints, a raised keystone and a moss cushion on top. The arches stand on stacked basalt piers. The neck is a faceted mooring column made of stone drums with iron bands. Frayed rope is wound round it 3.3 times, with lashing turns and hanging strands. Barnacles cover it. The head is small and flat with brow ridges and two small lantern-green eyes. Weed hangs from the arch soffits. |
| anchorjaw_leviathan | bulky | 11,949 | 341 KB | 512×250 | A deep, blunt grouper covered in shingled hull plates. They are real geometry: each plate's rear edge stands proud, and the rows are staggered. Rivets, rust weeping from the rivets, tar-black plates and rare verdigris (copper-sheathed) plates are painted on. The undershot lower jaw carries 7 inverted anchors as teeth (crown up, arms curving up to arrowhead flukes, with a stock). One has a broken arm and one has lost its stock. Four interlocking chains trail from the lip like barbels. The fins are tarred canvas over iron ribs. A barnacle crown sits on the head. |
| drowned_lighthouse | eel | 8,714 | 280 KB | 512×130 | The head is the lantern room: a gallery on corbels, a railing with one span torn away and hanging, an iron parapet, brass mullions and astragals, and 24 panes. 4 panes are broken out, leaving jagged shards, and 5 are cracked. A ribbed Fresnel lens burns gold inside. On top sit a red copper dome with seams, a ventilator ball and a lightning-rod finial. The body is grooved stone courses, whitewashed and banded with lighthouse red. The paint is peeling, with moss on top and grime underneath. There are arched windows with sills, an iron door near the tail and kelp hanging from the gallery. The tail compresses into a stone keel and ends in missing blocks. |

- **Spec:**
  - Length is exactly 1.0 along +Z, with the head at +Z and Y up.
  - The pivot is at the bbox centre in X and Z. Z must be centred because the swim shader maps z ∈ [-0.5, 0.5] to head→tail.
  - Y is at the area centroid (centre of mass).
  - The node has no transform. All tri counts are within the 12k boss budget.
- **Material:** one PBR material per model.
  - Base colour is 1024 WebP, with AO and cavity baked in.
  - Metal/rough is 256.
  - Emissive is 512, and it doubles as the signature mask that `src/vfx/looks.js` reads.
  - **Glow only on the signature part:**
    - Mossneck: the eyes, plus sparse lantern-green spores in the moss crowns, so the humps read at dusk.
    - Lighthouse: the lamp and the lit panes.
    - Anchorjaw (glow `null` in behaviour): only a faint verdigris sheen on the anchors, so variant looks still have a mask. It can be set to 0 if Casper wants it fully dark.
- **Bending:**
  - Every part is in one mesh, with edge loops every 0.007–0.015 along Z.
  - The vertex shader's displacement depends only on z, plus |x| for the bulky fin flutter. Pieces that overlap therefore move together and can't detach. That covers the rope, piers, anchors, chains, railings and lens.
  - The bend test in the sheets uses the real `src/fishing/swim.js` at thrash amplitude (2.6 × base).
- **Manifest:** entries were added to `public/assets/fish/manifest.json` with `status: "temp"`, `licence: "original (Blender bpy build, CC0)"`, `concept: null` and a one-line `story`. No other entries were touched.

## Screenshots (`docs/handoff/shots/`)
- `monsters_mossneck.png`, `monsters_anchorjaw_leviathan.png`, `monsters_drowned_lighthouse.png`: each sheet shows:
  - top view
  - side view
  - two bend-test frames (phases 0.6 and 2.2)
  - the 55° game camera
  - a 3/4 view
- `monsters_ingame.png`: all three spawned in the real build, underwater, next to the home island.

## Tools (git-ignored, `.cache/blender/`)
- `scripts/monsters/monlib.py` is the builder library:
  - sweeps with parallel-transport frames, lathes, thin slabs (with auto winding) and oriented boxes
  - barnacles, ribbons and chains
  - frame normalisation
  - Smart UV with per-part texel boosts
  - Cycles bakes of position, normal, part/param attributes, pointiness, cavity AO and large AO
  - numpy noise
  - the export
- `scripts/monsters/<id>.py` holds one build function and one paint function per monster. Builds are seeded and repeat exactly, and each takes about 25 s.
- `mon.sh <id>` builds, then runs `node/post_mon.mjs` (meshopt; NORMAL/TEXCOORD quantized; POSITION kept float and snapped to a 2⁻¹⁴ grid; textures re-encoded with sharp) into `out/monsters/<id>/model.glb`. Copying the result to `public/assets/fish/<id>/` is a manual step.
- Renderers:
  - `render/monview.html` + `render/monshot.py`: views with the real swim shader. `bg=none` gives cut-out previews.
  - `render/monsheet.sh` and `render/compose.py`: contact sheets.
  - `render/monsters_ingame.py`: the in-game spawn check.

## For the lead / Casper to decide
1. **Swim shader vs quantized positions (affects `storm_marlin` today):**
   - The shader bends `transformed`, which is raw geometry space. gltf-transform's default meshopt/quantize stores positions as normalized int16 and moves the real scale and offset onto the node. `storm_marlin` has node scale 0.5 and a translation, so its z runs about -1..1 in shader space. Its head quarter stays rigid and the bend is squeezed into the middle.
   - I kept POSITION as float for the monsters, which costs about 40 KB each.
   - A two-line fix in `applySwimToModel` would correct every quantized fish and let these files shrink further: pass in the mesh's local matrix, or bake the node transform before swim. I didn't touch game code.
2. **Size in game:** the spawned lengths came out at 9.2 m, 10.7 m and 17.6 m, because the per-fish size roll is applied on top of the behaviour `length` (7, 9 and 12). At those sizes the monsters dwarf the home island. That may be intended for end-game, but it is worth a look.
3. **Anchorjaw glow:** the faint verdigris emissive on the anchors is the only glow. Casper can set it to 0 for a fully unlit monster.
4. **File sizes:** 280–341 KB each (about 0.93 MB for all three). The 1024 base colour is about half of each file. Going to 768 would save about 30%.
5. **No concept or cards:** like the machines, these have no painted concept, hero or portrait (`concept: null`). Cards can be rendered from the models.
