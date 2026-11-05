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
