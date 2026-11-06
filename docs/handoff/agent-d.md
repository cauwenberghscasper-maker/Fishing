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
5. [x] Player character `fisher_player` (KayKit Rogue, CC0) recoloured (faded blue shirt, rust neckerchief, ochre rolled trousers, tar-brown boots), with fisher gear on bones: woven straw hat with a glowing teal fish-scale charm in the band (head), tackle satchel on a tar-leather strap (chest/hips), rolled cuffs (lower legs). 18 clips, see the character manifest. Rod attaches to bone `handslot.r`.
6. [x] Workers on the same rig: `worker_netmender` (Barbarian: white beard, cream sweater, rust knit cap, net bundle with floats), `worker_deckhand` (Rogue_Hooded: yellow oilskin hood + coat, rope bandolier), `worker_angler` (Mage: olive oilcloth coat, conical straw hat, wicker creel). 9 clips each, incl. fish_idle, cast, reel_loop, sit_idle.
7. [ ] Island growth: `sandbar`, `camp_l0`, plot dressings `plot_<plotId>` ×6
8. [ ] Buildings × 3 levels (`<building>_l1..l3`), concepts = Agent F's building cards when they land
9. [ ] Contact sheets, CREDITS, final notes

## Character clips (fisher_player)
| clip | game action | source |
|---|---|---|
| idle / walk / run | idle, walk, run | KayKit Idle / Walking_A / Running_A |
| fish_idle | waiting for a bite, rod out | authored (Idle + rod-holding arm layer) |
| cast_windup | aim:start | KayKit Throw 0–0.40 s, retimed |
| cast_aim | aim mode loop | authored from the Throw peak + breathing sway |
| cast_release | cast release | KayKit Throw 0.40–1.37 s |
| reel_loop | reeling (fight) | authored: left hand cranks, 2 turns per loop |
| struggle_loop | strong pull / high tension | authored on KayKit Blocking: braced legs, lean back, shaking |
| hold_up_fish | fish:landed-show / catch card | authored: catch presented at chest height |
| celebrate | rare catch / perfect cast | KayKit Cheer |
| dodge_left / dodge_right / dodge_back | boss dodge | KayKit Dodge_* |
| hit, pick_up, interact, sit_idle | boss hit, pick up, buildings, rest | KayKit Hit_A, PickUp, Interact, Sit_Floor_Idle |

**Gaps (honest):** there is no true rod-cast motion in any CC0 pack on GitHub. The cast is KayKit's overhand Throw split in two; it reads as an overhead cast. reel_loop, struggle_loop and hold_up_fish are procedural layers that read well at game-camera distance but would benefit from a hand-keyed or mocap pass. Chibi proportions mean "hold up" is at chest height, not overhead. A rod-specific clip set could come from Quaternius *Universal Animation Library 2* (CC0, has fishing; itch.io/quaternius.com only, so Casper would need to attach it; see Downloads).

## Gear and boats → Agent G
`fishing_rod`, `bobber`, `lure`, `boat_skiff` stay in the world manifest as `temp` until G's versions land; then the lead or I remove them.

## Sources checked (GitHub/npm only)
- KayKit Adventurers 1.0 — github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 — CC0 (LICENSE.txt checked)
- Kenney kits (Nature Kit 2.1, Pirate Kit 1.1, Fantasy Town Kit 1.0, Food Kit 1.2) via the CC0 mirror github.com/ETdoFresh/kenney.nl — each kit's License.txt says CC0
- KayKit Medieval Hexagon, Restaurant Bits, Dungeon Remastered — CC0 repos on github.com/KayKit-Game-Assets
- npm `@netforge/asset-library-files` (CC0 Quaternius/Kenney copies), checked but not used yet
