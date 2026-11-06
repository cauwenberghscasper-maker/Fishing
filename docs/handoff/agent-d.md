# Agent D — World & Character Assets (handoff, live)

_Updated after every step. Status: IN PROGRESS._

## Key art (done)
- `art/concepts/world/driftwood_cove_key.webp`: Driftwood Cove from the game camera (take 2 of 2, Qwen-Image, 3:4). This is the reference everything on the island is judged against.
- `art/concepts/world/driftwood_cove_shop_detail.webp`: take 1, closer. Kept as the reference for the signature shop (upturned boat hull, mast, oar sign, patched awning).
- **Cove story:** an old net-mender settled here and built everything from what the tide brought in. The shop is a hull and salvaged planks under a patched red sail awning with a blue ship's door. A wrecked red fishing boat lies beached and lived in. Piers are patched with whatever came ashore. Nets dry on oars, and ship lanterns hang on rope-wrapped posts. There are basalt tide pools and deep teal water.

## Loader conventions (for Agent A)
- GLBs are meshopt and quantized, so call `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`.
- One shared external texture: `assets/world/_shared/cove_atlas.jpg` (+ `cove_net.png`), referenced as `../_shared/...`. Dedupe after load by material name: `cove_atlas` (opaque), `cove_atlas_ds` (double-sided), `cove_glow` (emissive lantern glass), `cove_net` (alpha mask). One shared material per name gives one texture and the best batching.
- Weathering and AO are baked into vertex colours (COLOR_0, multiplied); keep `vertexColors`.
- Metres, Y-up, front = +Z. Origin = base centre on the ground, except water pieces (pier_*, boat_dock, boat_skiff, tide_pool_a, rock_shore): origin at WATER LEVEL. Pier deck top y=0.75; modules are 3.0 m along Z.
- Lantern assets list a suggested point light in the manifest (`light`).

## Manifests
- `public/assets/world/manifest.json`, `public/assets/character/manifest.json`: published (valid JSON, filled as assets land).

## Plan / progress
1. [x] Key art (2 takes, ~40 s GPU)
2. [x] Shared painted atlas `public/assets/world/_shared/cove_atlas.jpg` (1024², 4×4 hand-painted swatches: driftwood, plank, tar wood, chipped red/blue/white/teal paint, patched sailcloth, rope, basalt, sand, foliage, grass, moss, brass, rust, shell, coral, lantern glow), plus `cove_net.png` (alpha net). Painted procedurally by our own script; palette sampled from the key art.
3. [x] Nature: palms ×4 (bespoke), basalt boulders ×5, basalt-column cliffs ×3 (signature edge of the cove), sea-grape bushes ×3, beach grass ×2, driftwood ×2, starfish, shells, kelp, seaweed pile, tide pool
4. [x] Bespoke Blender builds: Hull House shop, Marigold fisher's hut, sail-tent workers' hut, rib-arch boat dock, skiff, pier modules ×4 + steps, fences ×2, lantern post + hanging lantern, signpost
5. [ ] Player character (KayKit base, recoloured, fisher gear) + clips; worker NPC
6. [ ] Contact sheets, CREDITS, final notes

## Sources checked (GitHub/npm only)
- KayKit Adventurers 1.0 — github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 — CC0 (LICENSE.txt checked)
- Kenney kits (Nature Kit 2.1, Pirate Kit 1.1, Fantasy Town Kit 1.0, Food Kit 1.2) via the CC0 mirror github.com/ETdoFresh/kenney.nl — each kit's License.txt says CC0
- KayKit Medieval Hexagon, Restaurant Bits, Dungeon Remastered — CC0 repos on github.com/KayKit-Game-Assets
- npm `@netforge/asset-library-files` (CC0 Quaternius/Kenney copies), checked but not used yet
