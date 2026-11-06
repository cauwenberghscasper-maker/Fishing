# Agent C — Fish Art handoff

## Round 2 (6 Nov) — status, updated after every step

| Step | Status |
|---|---|
| 1. Retire rejected round-1 art | done |
| 2. Choice sheet, 3 takes × 7 fish | done: `docs/handoff/shots/agent-c-choices.png` |
| 3. Message to the lead with the sheet | sent |
| 4. Blender 3D: storm_marlin | **done** (`public/assets/fish/storm_marlin/model.glb`, status `temp` until Casper has seen it) |
| 5. Blender 3D: the 6 picks, then temple_manta | in progress |
| 6. Previews (picks + marlin + manta) | made by the same build step; marlin done |
| 7. old_mooring new concept pass | after the quota reset (~22:45), budget 6 min |
| Quota ledger | ongoing (`docs/art-ledger.md`) |

### Step 4 — storm_marlin in Blender (done)
- Model: `public/assets/fish/storm_marlin/model.glb`, 3,314 tris, 68 KB, length exactly 1.000 on +Z, origin at the centre of mass (body volume), one mesh, one material, one draw call. Alpha MASK (cutoff 0.5), double-sided, 512 WebP base + 512 WebP emissive, meshopt + quantized. **The loader must register `MeshoptDecoder`** (`three/addons/libs/meshopt_decoder.module.js`).
- Turntable: `docs/handoff/shots/agent-c-turntable-storm_marlin.png` (concept + 10 views, three.js in headless Chromium).
- **Verdict:** it holds up next to the concept at game scale. From the side and from the 55° game camera it reads as the approved marlin: torn sail with lightning veins, coiled lightning-rod bill with sparks, blue and silver body. Weak points: the fins are flat alpha cards (paper-thin up close at a 3/4 angle); the glow is subtle without bloom; the eye is painted, so both sides are mirror images; the top view shows a clean blue back but no detail.
- Top view: the Edit-Angles call failed (the input URL had expired), and Qwen-Image drew another side view when asked for a top view. So the width profile comes from marlin body ratios, and the back is painted from the concept's own upper-flank colours (the "back strip", below). It looks right from above, so no top-view image is needed for side-view fish.
- Pipeline (reusable for every fish): `.cache/agent-c/scripts/fishbuild.py` + a config per fish in `.cache/agent-c/configs/<id>.json` → `fish_bpy.py` (Blender assembles the mesh and material and exports glTF) → `finish_glb.mjs` (gltf-transform: MASK, WebP 512, meshopt) → `turntable.mjs` (renders). One command: `.cache/agent-c/scripts/build.sh <id>`.

### Convention for Agent E (variants) and Agent A (swim shader): every fish model
- **Axes:** +Z forward (head), +Y up, +X = the fish's left. Length 1.0 on Z, origin at the centre of mass. Fins are part of the same mesh, so they bend with the vertex-shader swim.
- **UV0 is clean and meaningful:** `uv.x` = position along the fish (0 = tail tip, 1 = head/bill tip) **everywhere** (body, back strip, fins). Atlas: `uv.y` in [0.25, 1] = the projected concept (side view; top view for flat fish); `uv.y` in [0, 0.25] = the strip (back strip on side-view fish, spine at uv.y = 0.125; belly strip on flat fish). Flowing overlays (lightning crawling head to tail, frost creeping) can use `uv.x` directly.
- **Signature mask, two levels:**
  1. vertex attribute **`_SIGNATURE`** (float 0–1, three.js name `_signature`): 1 on the signature *part* (whole fin card, bill, crest, shell), 0 on the body. Use it for part-level effects (arcs between fins, glow on the crest).
  2. **emissive texture alpha** = per-texel signature mask (veins, bulbs, rune seal, needle, spine line). RGB is the normal emissive glow. Sample `emissiveMap.a` in a custom shader for detailed overlays; the standard material ignores it.
- **Base colour is the painted concept;** the material is metallic/roughness with no other textures. Basic morphs (`bleached`, `inkdark`, `gilded`) are a palette shift on the base colour: bleach or darken the body where signature = 0, keep or boost the emissive where signature = 1, and use gold on fin-card edges (alpha-edge texels).

### Step 1 — retired
- Moved to `art/concepts/fish/_rejected/`: sunscale_sardine, driftwood_perch, chartfish, tidepool_goby, kelp_ribbon, bellbuoy_bass, and the round-1 seaglass_puffer (as `seaglass_puffer_round1.webp`, since 5.2 rejects the first versions of all six commons; the id `seaglass_puffer` stays for the redesign).
- Deleted their `public/assets/fish/<id>/` folders and manifest entries. The manifest now holds storm_marlin, temple_manta and cathedral_jelly (all `status: concept`, `path: null`).
- The Fish section of CREDITS.md is updated to match.

### Step 2 — choice sheet
- Prompt template rewritten as v3 around the new rules (`art/prompt-template.md`): anatomy-first wording, a silhouette line, a dark-base palette, a face line and a story line.
- 21 kept takes: `art/concepts/fish/_takes/<id>_<A|B|C>.webp`. Seeds and Qwen URLs are in `.cache/agent-c/round2/takes.txt`; rejected attempts are in `.cache/agent-c/round2/`.
- Sheet: `docs/handoff/shots/agent-c-choices.png` (quality bar at the top, one row per fish, A/B/C with notes, recommendation in gold).

| Fish | Pick | Why, and what is still wrong |
|---|---|---|
| glasswing_sardine | **A** | glass body, glowing spine, dragonfly glass wings; reads as a cross from above. B is strong but wingless; C is weak. |
| driftback | **A** | the fish *is* driftwood (grain whorl, knot-hole eye). Fix in 3D: fronds look like land leaves and the rust reads like paint. |
| compass_flounder | **B** | dark ink disc, brass needle spine, brass fin-ray ring, calm face. A has the best bone rose but a cute face; C has the best star silhouette. |
| shellback_blenny | **C** | ammonite coil under a coral crest sail, strongest from above. A (shell grown from scales) is a good second. |
| kelp_wraith | **A** | leaf-fringe eel with glowing amber bulbs on the spine; the tail must be straightened in 3D. |
| seaglass_puffer | **A** (+ B as its inflated pose) | shard-armour body; B is the same idea inflated. **All puffer faces fail** (lips in r1, teeth in r2), a Qwen limit; the 3D build gets a closed beak. |
| old_mooring | **C, direction only** | fins and tail fray into hemp fibre (anatomy). **No take is ready**: every attempt drew a rope collar, teeth or leaked prompt text. It needs its own pass next quota day. |

Lessons for the template: story words get drawn ("bites the hook" became a hook in the mouth; the fish's name became printed text), so keep proper names and props out of the prompt. A "dark natural-history mood, realistic materials" line is what killed the plastic-toy look.

---

## Round 1 (5 Nov) — summary
- 10 concepts with Qwen-Image. Casper approved temple_manta (best) and storm_marlin (good); cathedral_jelly is not approved yet; everything else is rejected.
- TRELLIS.2 works, but only returns `hf.space` links, so the route is dropped (master prompt 5.5 now makes Blender the default).
- `not-lain/background-removal` returned "Not Found"; cut-outs are made locally with rembg (pip) + IS-Net (GitHub release) in `.cache/agent-c/venv`. No GPU used.
- Quota used on 5 Nov: ~6.6 min (estimate).
