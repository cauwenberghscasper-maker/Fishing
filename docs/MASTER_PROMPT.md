# Fishing Game — Master Prompt

Working title: **Fishing** (repo `cauwenberghscasper-maker/Fishing`). Owner: Casper.
This file is the single source of truth for every agent working on the game. Read it fully before you touch anything. If something here conflicts with your own taste, this file wins. If something is unclear, write the question in your handoff note instead of guessing on things that are expensive to redo.

**This game is completely separate from Ascendant Arena.** Never read from, write to, copy from or push to the `ascendant-arena` repo, its branches, its asset pipeline or its assets.

---

## 1. Vision

A 3D fishing adventure on a chain of islands, seen from an angled top-down camera, with an idle economy underneath.
You walk around your island, take your time to aim a cast, hook fish that get stronger the further you go, fight the strongest ones, sell your catch, and grow your island into a fishing empire that keeps earning while you are away.

### Pillars
1. **The cast is a skill moment.** Aiming is slow, deliberate and satisfying. The player can take as long as they want, and patience is rewarded.
2. **Every fish is a character.** No filler fish, no recolours. Each one has an element, a signature feature and its own behaviour on the line.
3. **Fish fight back.** Common fish are a reel minigame; strong fish fight with moves; bosses are real fights.
4. **Always something to grow.** Coins → gear → new islands → bigger catches → bigger island → more idle income.
5. **Hand-crafted look, no generic art.** Real models only, distinctive UI, no default fonts, no "AI generic" look.

---

## 2. Decisions taken (Casper can overrule)

These were open questions; the team proceeds on these until Casper says otherwise.
- **Platform:** mobile browser first (phones, portrait 390×844 as the main target), also works in landscape and on desktop. Static site on GitHub Pages from `main`.
- **Fighting:** both. A tension/stamina reel minigame for every fish, special moves for strong fish, multi-phase boss fights where the player also dodges attacks while reeling.
- **Idle:** yes. Hired fishers, nets and buildings earn while the game is closed (offline earnings, capped, cap upgradable).
- **Language of UI:** English.

---

## 3. Core loop

1. Walk on an island (joystick or tap-to-move).
2. Go to a fishing spot (pier, rocks, boat). Fish shadows are visible in the water.
3. **Aim and cast** (section 4.1).
4. Wait for a **bite**, then **hook** with good timing.
5. **Reel and fight** (section 4.3).
6. Catch card: fish, weight, size class, value, new-species flag. Into the cooler.
7. Sell at the shop or keep for collection/aquarium. Buy gear and upgrades.
8. Upgrade the home island, hire idle workers, unlock the next island.

---

## 4. Systems

### 4.1 Aim and cast (the heart of the game)
- Press and hold the cast control to enter **aim mode**. Time slows to ~25%, the camera eases forward and tilts a little more down over the water.
- **Drag to aim** (slingshot): direction = drag direction, distance = drag length. No time limit.
- A **trajectory arc** and a **landing reticle** on the water. The reticle shows depth (colour band) and highlights fish shadows inside its radius.
- **Steadiness:** the reticle wobbles at first and steadies the longer you hold still → patience gives accuracy. Moving the thumb resets some wobble.
- **Perfect cast** window on release (subtle timing ring) → bonus bite speed and rarity chance.
- Rod stats change max distance and wobble. Bait changes which fish come.
- Later islands add **wind** (Storm island) that bends the arc, and **currents** that drift the lure.
- Cancel: drag back to the centre.

### 4.2 Bite and hook
- Fish near the lure inspect it (approach, circle, nibble taps) according to their personality: shy, greedy, cautious, aggressive.
- The bobber/lure reacts. The real bite is a clear signal (sound + splash + haptic). Tap to hook within a window that shrinks for rarer fish. Too early = fish spooked.

### 4.3 Reel and fight
- **All fish:** line **tension** bar + fish **stamina** bar. Hold to reel (raises tension), release to let it run. Tension maxed too long → line snaps. Stamina empty → fish lands.
- Steering: drag sideways to pull against the fish's direction (bonus stamina damage).
- **Strong fish moves** (data-driven per fish): run, dive (tension spike), leap (tap at the peak to "bow the rod"), zig-zag, sulk at the bottom, burst.
- **Bosses:** multi-phase fights. The fish has HP phases; the player has hearts. While reeling, the boss attacks the player's position with telegraphed elemental moves (lightning circles, ice shards, lava splash, rune pulse, sting clouds); the player steps out of the zones (joystick) while keeping tension. Phase changes play a short leap/roar moment.
- Gear stats: rod power, reel speed, line strength, bait attraction, and later boss gear (hearts, dodge).

### 4.4 Fish
- Tiers: common, uncommon, rare, epic, legendary, boss. Size classes per catch (small, normal, large, trophy) with a weight roll.
- **Strength scales with island and tier:** stamina, pull force, move set, aggression.
- Every fish entry (data/fish.json): id, name, island, tier, element, personality, moves, depth band, time of day/weather, bait preference, base value, weight range, model id, swim profile, signature feature.
- **Fishdex** collection with records (heaviest), silhouettes for unknown fish.

### 4.5 Islands
Each island = its own element, look, weather/hazard, fish roster and legendary/boss.

| # | Island | Element | Feel | Legendary / boss |
|---|---|---|---|---|
| 1 | Driftwood Cove (home) | Tide | sunny sand, piers, shop, your base | — (tutorial big fish) |
| 2 | Wreck Reef | Rust | shipwrecks, coral, cannons | Wreck Grouper |
| 3 | Mossback Bayou | Bloom | swamp, lilies, mangroves, fireflies | Mossback Carp |
| 4 | Frostfang Fjord | Frost | glacier cliffs, ice floes | Glacier Pike |
| 5 | Ember Caldera | Fire | black sand, lava falls, hot springs | Kintsugi Koi |
| 6 | Stormspire Isles | Storm | sea stacks, wind, lightning rods | Storm Marlin |
| 7 | Sunken Temple | Rune | half-drowned ruins, glowing glyphs | Temple Manta |
| 8 | The Abyss | Deep | night sea, bioluminescence | Cathedral Jelly (+ final boss later) |

Travel by boat from the home pier. Unlock by coins + a catch requirement.

### 4.6 Home island upgrades and expansion
- The home island **grows**: buy new land plots that rise out of the sea (animated), new piers, buildings.
- Buildings: Shop (sell/buy), Cooler (catch capacity), Smokehouse (turns fish into higher-value goods over time), Aquarium (displays caught species, earns visitor income, shows rare fish swimming), Boat dock (travel, boat upgrades), Workers' hut (hire fishers), Net & crab-pot spots.
- Each building has levels with visible model changes.

### 4.7 Shop and economy
- Currency: coins. Later a second earned-only currency (e.g. pearls from rare catches) for special gear. **Never sold for real money**, no paid currency.
- Sell price = base value × weight factor × size class × market modifier.
- **Market:** a daily "hot fish" with a bonus, prices recover slowly if you flood one species.
- Buy: rods, reels, lines, bait, lures, boat upgrades, building upgrades, land plots, workers.

### 4.8 Idle
- Workers fish automatically at owned spots (they catch from the island's common/uncommon pool at a rate).
- Nets/crab pots fill over time; smokehouse processes; aquarium earns visitors.
- Offline earnings on return (summary card), capped at 8 h, cap upgradable.
- All rates in data/economy.json so balancing never needs code changes.
- Later: prestige ("New Tide") that resets coins/island for a permanent multiplier.

### 4.9 Save
- localStorage key `fishing-v1`, versioned, with `sanitizeProfile` + migrations. Players must never lose progress.
- Debug hooks: `window.__game` (state), `?test=100` fast mode (100× coins/idle, unlock buttons) with a separate save key.

---

## 5. Art direction

### 5.1 House style (locked by Casper)
Reference: the "rare fish sheet" Casper picked — sleek stylized 3D creatures with polished, iridescent scales, crisp silhouettes and **bioluminescent accents**, glowing beautifully against dark teal water. World art is in the matching painterly-stylized direction (Casper picked style B: hand-painted adventure, warm light, rich colour). Confirmed favourites: **swordfish/marlin, manta, jellyfish** (anglerfish and crystal koi pending Casper's yes).

### 5.2 Rules for every fish
- **Element + one signature feature + strict 3-colour palette.** A fish must be recognisable from its silhouette and signature alone.
- **Identity on top:** the camera looks down, so the signature feature must read from above (back, dorsal fin, top pattern).
- **No AI-generic look:** no googly/huge cartoon eyes, no random glowing dots, no "fantasy fish #47". No two fish share a body plan + palette.
- Design briefs (redo all in the house style):
  - **Storm Marlin** (Storm): bill is a lightning rod with copper coil bands and jumping sparks; dorsal fin a tattered storm sail with glowing lightning veins. Palette: iridescent blue, silver, electric yellow.
  - **Temple Manta** (Rune): back is an ancient relic, carved stone plates on the wing edges and a glowing turquoise rune seal in the centre; light ribbons trail from the wingtips. Palette: near-black, stone grey, turquoise.
  - **Cathedral Jelly** (Deep): bell is a stained-glass dome lit from within (rose window), tentacles like aurora ribbons. Palette: rose, violet, cyan.
  - **Kintsugi Koi** (Fire): cracked porcelain body sealed with molten gold, crimson veil tail, embers. Palette: white, gold, crimson.
  - **Glacier Pike** (Frost): translucent glacier ice, its last meal frozen inside its belly, icicle teeth, frost ridge. Palette: ice blue, white, navy.
  - **Mossback Carp** (Bloom): ancient sleepy carp with a tiny living garden and a frog on its back, root barbels. Palette: moss, bark, blossom pink.
  - **Wreck Grouper** (Rust): grumpy veteran, anchor chain in its jaw, broken cutlass in its back, barnacle crown. Palette: rust, sea green, weathered brown.
  - Commons/uncommons per island follow the same rules (simpler, smaller, but each with one hook).
- **M1 roster, Driftwood Cove (Tide)** — ids are fixed, every agent uses them:
  | id | Name | Tier | Body | Signature (reads from above) | Palette |
  |---|---|---|---|---|---|
  | `sunscale_sardine` | Sunscale Sardine | common | fusiform, small | scales are little mirror coins that flash sunlight; swims in schools | silver, gold, deep blue |
  | `driftwood_perch` | Driftwood Perch | common | fusiform | body grained like sun-bleached driftwood, one rusty nail as a fin spine | bleached tan, grey, teal |
  | `chartfish` | Chartfish | common | flat (flounder) | back is a faded sea chart with a small red X | parchment, ink blue, red |
  | `tidepool_goby` | Tidepool Goby | uncommon | fusiform, tiny | wears a sea anemone like a hat that sways | coral orange, cream, violet |
  | `kelp_ribbon` | Kelp Ribbonfish | uncommon | eel | looks like a strand of kelp with gold air-bladder beads | olive, gold, brown |
  | `seaglass_puffer` | Seaglass Puffer | rare | bulky | inflates into a ball of frosted sea-glass pebbles | sea-glass green, white, amber |
  | `bellbuoy_bass` | Old Bellbuoy | big (tutorial) | fusiform, large | a barnacled brass bell grown into its forehead that rings when it thrashes | bronze, sea green, cream |

### 5.3 World
- Camera: perspective, angled top-down (~55° pitch), soft follow, slight zoom-out while fighting.
- **Water is the star of every screen:** a custom stylized shader with depth colour, shoreline foam, caustics in shallows, visible fish shadows, splash and ripple effects. Dark, rich teal in deep water so glowing fish pop.
- Each island has its own palette, light and particles (fireflies, snow, embers, rain, glyph motes).

### 5.4 Hard bans
- **No visible primitive geometry** (three.js boxes, spheres, cylinders, cones) as game art, ever. Primitives only for invisible colliders and debug.
- No paid assets. No assets without a licence that allows it. No assets from Ascendant Arena.
- **No AI-generic fonts.** Banned: Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Nunito, Arial/Helvetica, system-ui, and the overused "mobile game" faces Fredoka, Lilita One, Luckiest Guy, Bangers, Baloo. Typography must have character that belongs to this world (sea charts, carved wood, stained glass, bioluminescence). Free fonts only (Google Fonts / OFL), self-hosted. The UI agent shows Casper 3 type pairings in a real game-UI mock before locking one.
- No generic default UI (plain rounded rectangles, default shadows). UI is themed.

### 5.5 Asset sources, in this order
1. **Free CC0 kits** for environment, props and characters: Quaternius, KayKit, Kenney, Poly Pizza (CC0 only). Check the licence of every file; record it in `CREDITS.md`.
2. **Generated on Casper's Hugging Face** when no free asset fits (all fish, landmarks, signature buildings):
   - Concepts: **Qwen-Image** (`mcp-tools/Qwen-Image`, final quality). Z-Image Turbo only for quick tests.
   - Background removal: `not-lain/background-removal` before 3D.
   - 3D: **TRELLIS.2** image → 3D (MIT).
   - Animation reference clips: Wan 2.2 image-to-video (optional).
   - HF ZeroGPU quota is about 25 min/day and resets around 22:45 Brussels time. Keep a quota ledger in `docs/art-ledger.md`; stop and report before you run out.
3. Never fall back to primitives. If an asset is missing, the feature waits or uses a clearly temporary model from a CC0 kit.

**Downloads:** the work sandbox can only reach GitHub and the package registries (npm, pip). Respect that limit: never route downloads around it (no CI relays, proxies, mirrors of blocked sites or other tricks). What works:
- Files that the Hugging Face tools return arrive as local files in the tool results.
- CC0 packs that are published on GitHub (for example KayKit's own repos, or CC0 packs re-hosted on GitHub) or on npm can be cloned/installed directly. Check the licence in the repo.
- Anything else: list exactly which files are needed (name + URL) in your handoff note; Casper downloads them and attaches them to the chat.

### 5.6 Model specs
- Fish: modelled straight (no curl), facing +Z, length 1.0 unit, pivot at centre of mass, side-view concept on a plain background for TRELLIS. 3–6k triangles (legendary/boss up to 12k). Textures 512 (1024 for bosses).
- Props 1–4k tris, buildings up to 10k, character up to 10k.
- Format: `.glb` (meshopt/quantized via gltf-transform), one folder per asset: `public/assets/<kind>/<id>/model.glb` + `preview.webp`.
- Budgets on phones: 60 FPS target, ≤ 300k triangles on screen, ≤ 150 draw calls, pixel ratio capped at 1.6.

---

## 6. Animation plan (decided before modelling)

### Fish (no skeleton, vertex-shader swim, per body type)
| Body type | Motion | Fish |
|---|---|---|
| Fusiform | travelling sine wave, 0 at head → max at tail | marlin, koi, pike, grouper, carp, commons |
| Eel | long wave, 1.5–2 wavelengths over the body | eels, serpents |
| Ray | sinusoidal wing flap, phase from front to back, gentle glide | manta |
| Jelly | bell pulse (scale squash), tentacles sway with delay | jellyfish |
| Bulky | slow wobble + fin flutter | puffers, anglers |

States for every fish: idle swim, approach/inspect, nibble, bite, thrash on line, run, dive, leap (whole-body arc + splash), tired, landed flop, catch-card turntable. Bosses add: charge, slam, element special, phase roar. Shader parameters (amplitude, frequency, speed) are per-fish data so states blend smoothly.

### Player
- A rigged CC0 character with clips: idle, walk, run, cast wind-up, cast release, reel loop, struggle/lean back, celebrate, hold up fish, dodge.
- Rod is a separate mesh on the hand bone; rod bends under tension (vertex bend). Line is a verlet rope from rod tip to lure.

---

## 7. Tech

- three.js (current release) + Vite, plain JavaScript ES modules, no framework for the game. Build to `dist/`, deployed to GitHub Pages by a GitHub Actions workflow on push to `main`.
- Mobile first: multi-touch (one pointer id per control), buttons ≥ 44 CSS px, safe-area insets, no horizontal overflow. Test at 390×844, 320×568 and 844×390.
- Data-driven: `data/fish.json`, `data/islands.json`, `data/items.json`, `data/economy.json`.
- Systems talk through a tiny event bus (`src/core/events.js`) and a shared state object (`src/core/state.js`). See `docs/INTERFACES.md`.
- Adaptive quality: bloom → shadows → resolution steps down on weak devices.

### Folder layout and ownership
Everything loaded at runtime lives under `public/` (Vite copies it as-is). Paths in code are relative (`assets/...`, never `/assets/...`) because the site runs under `/Fishing/` on GitHub Pages.
```
index.html, vite.config.js, package.json, .github/   lead
src/main.js                                  lead (wiring only)
src/core/        events, state, loop, asset loader, input    Agent A
src/world/       renderer, camera, water shader, islands     Agent A
src/fishing/     aim, cast, bite, reel, fight, fish AI/swim  Agent A
src/economy/     shop, market, idle, buildings, upgrades     Agent B
src/save/        profile, migrations, offline earnings       Agent B
src/ui/          HUD, menus, catch card, theme CSS           Agent B
public/data/fish.json, islands.json, items.json, economy.json   Agent B
public/data/fish-behaviour.json                              Agent A
public/fonts/                                                Agent B
art/concepts/fish/   art/concepts/world/   concept images    Agent C / Agent D
public/assets/fish/<id>/ + public/assets/fish/manifest.json  Agent C
public/assets/world/ public/assets/character/ + manifests    Agent D
CREDITS.md                                                   Agent D (C appends its section)
docs/                                                        lead (agents write docs/handoff/<agent>.md)
.cache/          raw downloads and work files (git-ignored)  everyone, in a subfolder per agent
```
Stay inside your folders. Need something elsewhere → write it in your handoff note; the lead integrates.

---

## 8. Agents

- **Lead:** owns this file, integration, review, checks, pushes, talks to Casper.
- **Agent A — Engine & Fishing:** renderer, camera, water, island scene, input, player movement, aim/cast/bite/reel/fight, fish swim shader and AI.
- **Agent B — Economy, UI & Save:** data files, shop, market, idle workers/buildings, island upgrades, offline earnings, save/migrations, all UI, typography (3 pairings for Casper first).
- **Agent C — Fish Art:** concepts in the house style (favourites first), background removal, TRELLIS.2 models, cleanup to spec, preview renders, quota ledger.
- **Agent D — World & Character Assets:** find and import CC0 kits for Driftwood Cove first (sand, rocks, palms, piers, shop, huts, boat, props), the player character with clips, rod; licences in CREDITS.md; generate landmarks only when no kit fits.

Every agent ends with `docs/handoff/<agent>.md`: what was done, what is missing, what needs Casper's decision, and screenshots/contact sheets where visual.

---

## 9. Milestones

**M1 — Vertical slice (Driftwood Cove):** walk the island, aim + cast with the full aim mode, bite + hook, reel minigame, 6 unique common fish + 1 big tutorial fish, catch card, sell at the shop, buy one rod and one bait, hire one worker (idle), offline earnings, save/load. Real models only, real water shader, chosen font.
**M2:** boat travel, Wreck Reef, strong-fish moves, home island expansion (first land plot), aquarium, Fishdex.
**M3:** first boss fight (Wreck Grouper), more islands with their legendaries, smokehouse, market events, prestige.

## 10. Definition of done (every change)
- `npm run build` passes, no console errors, loads on a phone-size viewport.
- Screenshot at 390×844 checked by eye: no primitives visible, text readable, nothing overflows.
- Art matches section 5; licences recorded.
- Committed with a player-facing message and pushed. Big or risky work goes to a branch + PR for Casper.
