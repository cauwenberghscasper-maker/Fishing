# Agent C — Fish Art handoff

Date: 2026-11-05, session ~23:04–23:20 Brussels.
Contact sheet: `docs/handoff/shots/agent-c-fish-sheet.png` (all 10 concepts, background removed, with tier, signature and palette swatches). There is no 3D sheet because no 3D model reached the repo (see "3D" below).

## What exists per fish

| id | Concept `art/concepts/fish/` | Preview `public/assets/fish/<id>/preview.webp` | 3D `model.glb` | Verdict |
|---|---|---|---|---|
| sunscale_sardine | yes (v1) | yes | no | strong |
| driftwood_perch | yes (v2, template test) | yes | no (TRELLIS ran, file unreachable) | good |
| chartfish | yes (v2) | yes | no | **needs another pass** |
| tidepool_goby | yes (v2) | yes | no | OK, could be better |
| kelp_ribbon | yes (v1) | yes | no | good |
| seaglass_puffer | yes (v2) | yes | no | strong |
| bellbuoy_bass | yes (v1) | yes | no | strong |
| storm_marlin (favourite) | yes (v2), side view | yes | not in scope | good |
| temple_manta (favourite) | yes (v1), top three-quarter view | yes | not in scope | strong |
| cathedral_jelly (favourite) | yes (v1), top three-quarter view | yes | not in scope | strongest of the set |

Previews are 512 px on the long side, transparent WebP, cut out from the concept. Superseded versions and the raw cut-outs are kept in `.cache/agent-c/` (git-ignored).

## Honest design notes

- **Cathedral Jelly**: the best result. The rose-window stained-glass bell reads instantly from above, the 3-colour palette holds (rose, violet, cyan), and the glow is only where the brief puts it. Close to Casper's favourite on the reference sheet, with a clear identity of its own.
- **Temple Manta**: strong. Carved stone wing plates and a central turquoise rune seal, near-black, grey and turquoise. Two weaker points: the light trails run from the seal to the tail instead of streaming from the wingtips, and the face has a faint smile. Fine as a concept; worth fixing before 3D.
- **Storm Marlin**: v1 had a literal canvas ship's sail and a zig-zag lightning sticker across the whole body. v2 fixes both: a torn fin membrane with lightning veins, copper coils and sparks on the bill. It is still less polished than the reference marlin, with flatter shading and an open mouth. The silhouette is right. A higher-quality pass is worth it before the boss model.
- **Seaglass Puffer**: v1 had a huge orange cartoon eye and no amber. v2 has a frowning brow, a smaller eye and green and amber sea-glass pebbles. The signature is very readable from above. The lips are slightly cartoonish.
- **Old Bellbuoy**: strong and readable: a barnacled brass bell fused into the brow, bronze, sea green and cream. The teeth are a bit exaggerated, and the bell has a hanging ring that makes it look slightly like a hat.
- **Sunscale Sardine**: clean, sleek and the most "house style" of the commons. The coins read from above. The rows of coins look a little stacked on rather than grown as scales, but it is acceptable for a common fish.
- **Driftwood Perch**: template test fish (v1 had a cartoon eye with a big highlight and mixed wood and scales at random). v2 is a real perch silhouette with the rusty nail on the dorsal fin. Two weaknesses: the driftwood grain is subtle (it reads as a bleached fish with wooden fins more than a fish made of driftwood), and the teal bands have a slight glow even though the brief says no glow.
- **Kelp Ribbonfish**: the ruffled kelp-blade frill and gold bladder beads work, and it is distinctive. The body is shorter and thicker than a true ribbonfish, and the head reads a bit like a pike. Fine for M1.
- **Tidepool Goby**: v1 wore a literal hat with a brim, which was rejected. In v2 the anemone grows out of the head and reads well from above. The body is more of a generic rockfish than a goby, and the coral-orange plastic look is the closest to "generic cute" in the set.
- **Chartfish — needs another pass.** The sea-chart back with a red X reads very well from above, but the map shows **real-world continents (the Americas)**, which clashes with a fictional island world. It also has a compass rose that the prompt banned, and a fleshy cartoon face with lips. v1 was worse (N/S letters and a red plus sign). I had used my one regeneration. The fix is one more Qwen run (~20 s) with "fictional islands" wording and a stronger negative prompt for continents, world map and lips.

Rules check: no googly eyes left in the final set, no limbs, no random glowing dots, every body is straight, and no two fish share body plan + palette (the four fusiform commons all use different palettes).

## 3D (TRELLIS.2): blocked by the network limit
- `gr3_trellis_2_text_to_3d_preprocess_image` accepts the Qwen-Image `hf.space` output URL directly and returns a local cut-out PNG. That part works.
- `gr3_trellis_2_text_to_3d_generate_3d` (driftwood_perch, resolution 1024, decimation 50k, which is the tool's minimum, texture 1024, seed 42) succeeded on the server, but **it returns only `hf.space` URLs** (`trellis_output_...rrd` and `trellis_output_...glb`). Nothing arrives as a local file, unlike the images. Per the brief I stopped the 3D step there and did not try any workaround. The other 6 M1 fish were not run, so their quota was not spent.
- The perch `.glb` that was generated (a temporary Gradio file that will probably expire within hours):
  `https://prithivmlmods-trellis-2-text-to-3d.hf.space/--replicas/q69np/gradio_api/file=/tmp/gradio/768728d0e2e869864367195977bb5e8c949e9b9f15671869dbcacbbf969032a9/trellis_output_2026-11-05T231245.glb`
- So nothing exists yet under `public/assets/fish/<id>/model.glb`, and the gltf-transform cleanup (decimation to 3–6k tris, length 1 on +Z, pivot, 512 textures, meshopt) has not been run.

## Background removal
`not-lain/background-removal` returned "Not Found" twice (the space seems to be down or its API has changed). I did the cut-outs **locally** instead, with `rembg` (installed through pip into `.cache/agent-c/venv`) and the IS-Net general-use model (downloaded from rembg's GitHub releases). This used no GPU quota. The masks were clean; small holes punched through eyes and coins were filled automatically (`.cache/agent-c/scripts/fixholes.py`).

## Quota
About 6.6 min of the ~18 min budget (estimate: 15 Qwen-Image runs at ~20 s, 1 TRELLIS preprocess, 1 TRELLIS generate at ~90 s). The tools don't report real GPU seconds. Ledger: `docs/art-ledger.md`. That leaves about 11 min for today if the 3D route is unblocked.

## For the lead (interfaces)
- `public/assets/fish/manifest.json` has all 10 ids with **`"path": null`, `"status": "concept"`, `"tris": 0`** plus `preview` and `previewSize`. `concept` is not in the `final|temp` enum and `path: null` is new, so please confirm the contract. Agent A's loader (`src/core/assets.js`, not written yet) must skip entries without a `path` (never fall back to a primitive). Agent B can use `preview` for the catch card now.
- Body types: the master prompt's animation table has no `flat` row, but `chartfish` is `flat` (as INTERFACES allows). Agent A needs a flat swim profile (a vertical body-edge ripple, like a flounder).
- Sunscale Sardine's "swims in schools" is behaviour for Agent A, not art.

## Casper must decide
1. **How do the 3D models get here?** Options:
   a. Casper opens the TRELLIS.2 space (`prithivMLmods/TRELLIS.2-Text-to-3D`) in his browser, uploads the 7 concepts from `art/concepts/fish/` (the space removes backgrounds itself), downloads the 7 `.glb` files and attaches them to the chat. Agent C then cleans them to spec. This is the fastest route.
   b. Casper downloads only the perch `.glb` from the URL above (if it is still live) so the cleanup pipeline can be tested on one model first.
   c. Wait for a Hugging Face tool that returns 3D files locally the way it returns images.
2. Chartfish: approve one more concept pass (fictional islands instead of real continents, no compass rose, calmer face).
3. Are Temple Manta, Storm Marlin and Cathedral Jelly approved as concepts? Fixes I suggest before 3D: wingtip light ribbons on the manta and a higher-polish marlin render.
4. Approve or reject the concept look of the M1 seven, especially whether the goby is too "cute" and whether the perch should look more like driftwood.

## Files written
- `art/prompt-template.md` (house-style template v2 + changelog)
- `art/concepts/reference/house-style.png`
- `art/concepts/fish/<id>.webp` × 10
- `public/assets/fish/<id>/preview.webp` × 10, `public/assets/fish/manifest.json`
- `docs/art-ledger.md` (created; Agent C rows), `CREDITS.md` (Fish section), `docs/handoff/shots/agent-c-fish-sheet.png`, this file
- Work files: `.cache/agent-c/` (all concept versions, `.url` files with the Qwen output URLs, cut-outs, scripts, rembg venv)
