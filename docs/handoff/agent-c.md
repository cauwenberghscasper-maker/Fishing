# Agent C — Fish Art handoff

## Round 2 (6 Nov) — status, updated after every step

| Step | Status |
|---|---|
| 1. Retire rejected round-1 art | done |
| 2. Choice sheet, 3 takes × 7 fish | in progress |
| 3. Message to the lead with the sheet | pending |
| 4. Blender 3D: storm_marlin, then temple_manta | pending |
| 5. Quota ledger | ongoing (`docs/art-ledger.md`) |

### Step 1 — retired
- Moved to `art/concepts/fish/_rejected/`: sunscale_sardine, driftwood_perch, chartfish, tidepool_goby, kelp_ribbon, bellbuoy_bass, and the round-1 seaglass_puffer (as `seaglass_puffer_round1.webp`, since 5.2 rejects the first versions of all six commons; the id `seaglass_puffer` stays for the redesign).
- Deleted their `public/assets/fish/<id>/` folders and manifest entries. The manifest now holds storm_marlin, temple_manta and cathedral_jelly (all `status: concept`, `path: null`).
- The Fish section of CREDITS.md is updated to match.

---

## Round 1 (5 Nov) — summary
- 10 concepts with Qwen-Image. Casper approved temple_manta (best) and storm_marlin (good); cathedral_jelly is not approved yet; everything else is rejected.
- TRELLIS.2 works, but only returns `hf.space` links, so the route is dropped (master prompt 5.5 now makes Blender the default).
- `not-lain/background-removal` returned "Not Found"; cut-outs are made locally with rembg (pip) + IS-Net (GitHub release) in `.cache/agent-c/venv`. No GPU used.
- Quota used on 5 Nov: ~6.6 min (estimate).
