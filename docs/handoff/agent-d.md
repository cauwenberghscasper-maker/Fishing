# Agent D — World & Character Assets (handoff, live)

_Updated after every step. Status: IN PROGRESS._

## Key art (done)
- `art/concepts/world/driftwood_cove_key.webp`: Driftwood Cove from the game camera (take 2 of 2, Qwen-Image, 3:4). This is the reference everything on the island is judged against.
- `art/concepts/world/driftwood_cove_shop_detail.webp`: take 1, closer. Kept as the reference for the signature shop (upturned boat hull, mast, oar sign, patched awning).
- **Cove story:** an old net-mender settled here and built everything from what the tide brought in. The shop is a hull and salvaged planks under a patched red sail awning with a blue ship's door. A wrecked red fishing boat lies beached and lived in. Piers are patched with whatever came ashore. Nets dry on oars, and ship lanterns hang on rope-wrapped posts. There are basalt tide pools and deep teal water.

## Manifests
- `public/assets/world/manifest.json`, `public/assets/character/manifest.json`: published (valid JSON, filled as assets land).

## Plan / progress
1. [x] Key art (2 takes, ~40 s GPU)
2. [ ] Shared painted atlas `public/assets/world/_shared/cove_atlas.webp` (palette sampled from the key art)
3. [ ] Kit pieces repainted, weathered and recombined (nature, props)
4. [ ] Bespoke Blender builds: shop, pier modules, boat dock, workers' hut, fisher's hut (beached boat), skiff
5. [ ] Player character (KayKit base, recoloured, fisher gear) + clips; worker NPC
6. [ ] Contact sheets, CREDITS, final notes

## Sources checked (GitHub/npm only)
- KayKit Adventurers 1.0 — github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 — CC0 (LICENSE.txt checked)
- Kenney kits (Nature Kit 2.1, Pirate Kit 1.1, Fantasy Town Kit 1.0, Food Kit 1.2) via the CC0 mirror github.com/ETdoFresh/kenney.nl — each kit's License.txt says CC0
- KayKit Medieval Hexagon, Restaurant Bits, Dungeon Remastered — CC0 repos on github.com/KayKit-Game-Assets
- npm `@netforge/asset-library-files` (CC0 Quaternius/Kenney copies), checked but not used yet
