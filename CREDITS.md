# Credits and licences

Every third-party or generated asset in the game is listed here with its source and licence.

## Tools and models
- three.js — MIT
- Qwen-Image (concept art) — Apache-2.0
- TRELLIS.2 (image → 3D) — MIT

## World and character assets
_(Agent D)_
- **KayKit Character Pack: Adventurers 1.0** by Kay Lousberg (www.kaylousberg.com), CC0 1.0. https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0. Base meshes, rig and clips for `fisher_player` (Rogue), `worker_netmender` (Barbarian), `worker_deckhand` (Rogue_Hooded), `worker_angler` (Mage) and `worker_boatwright` (Knight). All are recoloured, re-geared and given authored fishing clips by Agent D.
- **KayKit Medieval Hexagon Pack 1.0** by Kay Lousberg, CC0 1.0. https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0. Crate base meshes in `crate_stack` (repainted, re-stacked, lashed).
- **Kenney Nature Kit 2.1** by Kenney (www.kenney.nl), CC0 1.0. https://kenney.nl/assets/nature-kit, via the CC0 mirror https://github.com/ETdoFresh/kenney.nl. Checked as base meshes; the shipped cliffs, bushes and rocks were rebuilt bespoke.
- **Kenney Pirate Kit 1.1, Fantasy Town Kit 1.0, Food Kit 1.2** by Kenney, CC0 1.0 (same mirror). Reference only; nothing ships unchanged.
- **Everything else in `public/assets/world/` and the fisher gear** (hat, satchel, cuffs, nets, charms) is original work by Agent D, built in Blender (bpy) and released CC0 with the game. It is all painted with our own procedural atlas, `public/assets/world/_shared/cove_atlas.jpg` and `cove_net.png`.
- **Concept art** in `art/concepts/world/` was generated with Qwen-Image / Qwen-Image-Lightning (Apache-2.0) on Casper's Hugging Face. Building cards in `public/art/buildings/` are by Agent F.
- Tools: Blender 5.2 (bpy, GPL; output is ours), glTF-Transform (MIT), meshoptimizer (MIT), three.js (MIT).

## Fish
All fish art is generated on Casper's Hugging Face account (user Casper565); no third-party fish assets are used.
- Concepts (`art/concepts/fish/<id>.webp`): Qwen-Image via `mcp-tools/Qwen-Image` — model licence Apache-2.0. Prompt template: `art/prompt-template.md`.
- Previews (`public/assets/fish/<id>/preview.webp`): those concepts with the background removed locally by rembg (MIT) using the IS-Net general-use model (`isnet-general-use.onnx`, from the rembg GitHub releases, Apache-2.0).
- 3D models: built in Blender (`bpy`, GPL; the output models are our own work) from the concepts. TRELLIS.2 (MIT) is not used, because its output can't be downloaded here.

| id | Concept | Preview | 3D |
|---|---|---|---|
| storm_marlin | Qwen-Image, seed 1519908445 (approved) | rembg cut-out | pending |
| temple_manta | Qwen-Image, seed 2053703266 (approved) | rembg cut-out | pending |
| cathedral_jelly | Qwen-Image, seed 1330003283 (not approved yet) | rembg cut-out | — |

Round-2 Driftwood Cove takes (glasswing_sardine, driftback, compass_flounder, shellback_blenny, kelp_wraith, seaglass_puffer, old_mooring) are choice-sheet concepts in `.cache/agent-c/`; each one is added here once Casper picks it. The rejected round-1 concepts live in `art/concepts/fish/_rejected/`. They are not used in the game.

## Fonts
Self-hosted in `public/fonts/` (licence texts: `public/fonts/OFL-*.txt`), from the `@fontsource` npm packages (latin subset, woff2). Both are licensed under the SIL Open Font License 1.1. Type pairing "Chartroom", picked by Casper.

| Font | Used for | Copyright |
|---|---|---|
| IM Fell English SC | titles, fish and gear names, the carved plank buttons | The IM Fell types are digitised by Igino Marini; OFL notice as shipped by Google Fonts |
| Alegreya Sans (500, 500 italic, 700, 800) | text and all numbers | Copyright 2013 The Alegreya Sans Project Authors (github.com/huertatipografica/Alegreya-Sans) |

## UI icons and textures
- UI icons (`src/ui/icons.js`): original SVG drawings made for this game by Agent B. No icon set is used.
- Paper and driftwood textures (`src/ui/textures/`): generated procedurally by Agent B (numpy noise). Our own work.
