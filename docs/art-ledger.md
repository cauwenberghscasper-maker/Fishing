# Hugging Face ZeroGPU quota ledger

Daily quota ~25 min GPU, resets ~22:45 Brussels. Agent C budget ~18 min, Agent D max 5 min.

| Time (Brussels) | Agent | Tool | What | Est. GPU s |
|---|---|---|---|---|
| 23:05 | C | Qwen-Image | driftwood_perch concept (template test v1) | ~20 |
| 23:06 | C | Qwen-Image | driftwood_perch concept (template v2, kept) | ~20 |
| 23:07 | C | Qwen-Image | sunscale_sardine concept v1 (kept) | ~20 |
| 23:07 | C | Qwen-Image | chartfish concept v1 | ~20 |
| 23:07 | C | Qwen-Image | tidepool_goby concept v1 | ~20 |
| 23:08 | C | Qwen-Image | chartfish concept v2 (kept; v1 had letters + plus sign) | ~20 |
| 23:08 | C | Qwen-Image | tidepool_goby concept v2 (kept; v1 wore a literal hat) | ~20 |
| 23:08 | C | Qwen-Image | kelp_ribbon concept v1 (kept) | ~20 |
| 23:09 | C | Qwen-Image | seaglass_puffer concept v1 | ~20 |
| 23:09 | C | Qwen-Image | bellbuoy_bass concept v1 (kept) | ~20 |
| 23:10 | C | Qwen-Image | seaglass_puffer concept v2 (kept; v1 eye too big, no amber) | ~20 |
| 23:10 | C | Qwen-Image | storm_marlin concept v1 | ~20 |
| 23:11 | C | Qwen-Image | storm_marlin concept v2 (kept; v1 had canvas sail + body zigzag) | ~20 |
| 23:12 | C | Qwen-Image | temple_manta concept v1 (kept) | ~20 |
| 23:12 | C | Qwen-Image | cathedral_jelly concept v1 (kept) | ~20 |
| 23:12 | C | TRELLIS.2 preprocess | driftwood_perch cut-out | ~5 |
| 23:13 | C | TRELLIS.2 generate_3d | driftwood_perch 3D (res 1024, 50k faces, tex 1024, seed 42) - output only as hf.space URL, not usable from sandbox; 3D step stopped | ~90 |
| 23:17 | C | (none) | background removal done locally with rembg (not-lain/background-removal returned 'Not Found' twice) | 0 |

**Agent C total (estimate): 15 Qwen-Image runs x ~20 s + TRELLIS preprocess ~5 s + 1 TRELLIS generate_3d ~90 s = ~6.6 min of ~18 min budget.** Estimates only: the tools do not report actual GPU seconds.

### Agent D (world) — 6 Nov
| Time (Brussels) | Agent | Tool | What | Est. GPU s |
|---|---|---|---|---|
| 11:18 | D | Qwen-Image | Driftwood Cove key art take 1, 9:16, seed 1357887856 (kept as `art/concepts/world/driftwood_cove_shop_detail.webp`: shop reference) | ~20 |
| 11:19 | D | Qwen-Image | Driftwood Cove key art take 2, 3:4, seed 1214929966 (kept as `art/concepts/world/driftwood_cove_key.webp`) | ~20 |

**Agent D total today (estimate): 2 Qwen-Image runs ≈ 40 s of the 4 min budget.**
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take A (kept) | ~20 |
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take B (kept) | ~20 |
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take C r1 (rejected: arrow through mouth) | ~20 |
| 6 Nov 11:22 | C | Qwen-Image | glasswing_sardine take C r2 (kept, weakest) | ~20 |
| 6 Nov 11:23 | C | Qwen-Image | driftback takes A, B, C | ~60 |
| 6 Nov 11:25 | C | Qwen-Image | compass_flounder takes A, B, C r1 (B kept; A smile, C badge rejected) | ~60 |
| 6 Nov 11:26 | C | Qwen-Image | compass_flounder A r2, C r2 (kept with flaws noted) | ~40 |
| 6 Nov 11:28 | C | Qwen-Image | shellback_blenny A, B, C r1 (all fail: toy gloss, lips, hook in mouth) | ~48 (16 s each, wall-clock upper bound from here on) |
| 6 Nov 11:28 | C | Qwen-Image | shellback_blenny A r2 (kept) | ~16 |
| 6 Nov 11:29 | C | Qwen-Image | shellback_blenny B r2, C r2 (kept) | ~32 |
| 6 Nov 11:31 | C | Qwen-Image | kelp_wraith A, B, C r1 (A kept; B necklace, C cloth hood rejected) | ~48 |
| 6 Nov 11:32 | C | Qwen-Image | kelp_wraith B r2, C r2 (kept, flaws noted) | ~32 |
| 6 Nov 11:34 | C | Qwen-Image | seaglass_puffer A, B, C r1 (all lips; C fake signature text) | ~48 |
| 6 Nov 11:35 | C | Qwen-Image | seaglass_puffer A, B, C r2 (kept; faces still fail: teeth/lips) | ~48 |
| 6 Nov 11:37 | C | Qwen-Image | old_mooring A, B, C r1 (all fail: rope tied round neck, prompt text leaked, teeth) | ~48 |
| 6 Nov 11:38 | C | Qwen-Image | old_mooring A, B, C r2 (kept; still teeth/collar, needs another pass) | ~48 |
| 6 Nov 11:42 | C | Qwen-Image-Edit-Angles | storm_marlin top view (failed: 'Error!', input URL from 5 Nov likely expired) | ~5 |
| 6 Nov 11:42 | C | Qwen-Image | storm_marlin top-down render (unusable: model drew a side view again); top-view attempts stopped | ~16 |

### Agent G (gear & boats) — 6 Nov (budget until the 22:45 reset: 3 min)
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock incl. queue, upper bound) |
|---|---|---|---|---|
| 21:29 | G | Qwen-Image | rowboat concept, 4:3, seed 1380675061 (kept: oar mast with shirt sail, tin patch, blue plank) | 25 |
| 21:30 | G | Qwen-Image | patched_skiff concept, 4:3, seed 1333915167 (kept: blue ship's door on a crate wheelhouse, stovepipe; hole left open in the art, the model patches it) | 25 |
| 21:30 | G | Qwen-Image | sail_sloop concept, 4:3, seed 153471756 (kept: patched sail, arched cabin roof, brass porthole) | 25 |
| 21:31 | G | Qwen-Image | storm_cutter concept, 4:3, seed 2120398157 (kept: tarred hull, copper rods + verdigris, storm sails with glowing scorch veins; the stray fern on the jib is not modelled) | 25 |

**Agent G total before reset: 4 runs ≈ 100 s of the 180 s budget.**
