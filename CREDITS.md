# Credits and licences

Every third-party or generated asset in the game is listed here with its source and licence.

## Tools and models
- three.js — MIT
- Qwen-Image (concept art) — Apache-2.0
- TRELLIS.2 (image → 3D) — MIT

## World and character assets
_(Agent D)_

## Fish
All fish art is generated on Casper's Hugging Face account (user Casper565); no third-party fish assets are used.
- Concepts (`art/concepts/fish/<id>.webp`): Qwen-Image via `mcp-tools/Qwen-Image` — model licence Apache-2.0. Prompt template: `art/prompt-template.md`.
- Previews (`public/assets/fish/<id>/preview.webp`): those concepts with the background removed locally by rembg (MIT) using the IS-Net general-use model (`isnet-general-use.onnx`, from the rembg GitHub releases, Apache-2.0).
- 3D models: not yet in the game. TRELLIS.2 (MIT, `prithivMLmods/TRELLIS.2-Text-to-3D` space) was tested but its `.glb` output could not be brought into the repo (see `docs/handoff/agent-c.md`).

| id | Concept | Preview | 3D |
|---|---|---|---|
| sunscale_sardine | Qwen-Image, seed 2050885286 | rembg cut-out | — |
| driftwood_perch | Qwen-Image, seed 1237474659 | rembg cut-out | — |
| chartfish | Qwen-Image, seed 1530408753 | rembg cut-out | — |
| tidepool_goby | Qwen-Image, seed 1197820759 | rembg cut-out | — |
| kelp_ribbon | Qwen-Image, seed 256695851 | rembg cut-out | — |
| seaglass_puffer | Qwen-Image, seed 348315005 | rembg cut-out | — |
| bellbuoy_bass | Qwen-Image, seed 346850465 | rembg cut-out | — |
| storm_marlin | Qwen-Image, seed 1519908445 | rembg cut-out | — |
| temple_manta | Qwen-Image, seed 2053703266 | rembg cut-out | — |
| cathedral_jelly | Qwen-Image, seed 1330003283 | rembg cut-out | — |

## Fonts
_(Agent B)_
