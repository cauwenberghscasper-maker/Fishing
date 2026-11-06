# Agent C — Fish Art handoff

## Round 2 (6 Nov) — status, updated after every step

| Step | Status |
|---|---|
| 1. Retire rejected round-1 art | done |
| 2. Choice sheet, 3 takes × 7 fish | done: `docs/handoff/shots/agent-c-choices.png` |
| 3. Message to the lead with the sheet | sent |
| 4. Blender 3D: storm_marlin, then temple_manta | in progress |
| 5. Quota ledger | ongoing (`docs/art-ledger.md`) |

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
