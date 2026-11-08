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
- **Fishdex** collection with records (heaviest), silhouettes for unknown fish, and every variant caught per species.

### 4.4b Variants and elemental superpowers (Casper: "really over the top")
Every catch rolls a variant when the fish spawns. The same species can show up plain or supercharged.
- **Basic** (most catches): the species exactly as designed.
- **Basic morphs** (uncommon, modest value bonus ×1.5–2, a look change only): `bleached` (sun-bleached, pale, almost white), `inkdark` (near-black, its signature glow brighter), `gilded` (gold-leaf edges). Done with a material/palette shift on the same model.
- **Elemental variants** (rare to very rare, value ×5–25, chance boosted on the matching island and weather): the fish is overcharged by one of the 8 elements. **Over the top is the point**: a full-body shader overlay, a particle aura, its own light, and in the fight a **superpower** that throws the whole screen into chaos, which the player has to counter. Every power has a clear telegraph and a counter so it stays fair on a phone.

| Variant | Look (overlay + aura) | Superpower in the fight | Player's counter |
|---|---|---|---|
| `storm` | crackling lightning veins, arcs jumping between fins, static sparks | the sky goes dark, it calls **lightning strikes down along your line**, screen flash + shake + slow-mo crack | slack the line (release) during the telegraph or it snaps |
| `frost` | glacier-ice crust, frost breath, snow swirl | **freezes the sea** around the lure into a sheet of ice, the reel freezes solid | tap the ice shards to break free, then reel fast |
| `ember` | molten cracks, ember trail, heat haze | **boils the water**, the line overheats, **lava bombs** rain onto the pier | step out of the marked impact zones, ease off to cool the line |
| `bloom` | moss and flowers erupting along the body, pollen | **kelp and vines erupt** from the water and tangle your line | swipe to cut the vines |
| `rune` | glowing glyph rings orbiting the body | draws **glyph circles and teleports** between them, the pull direction flips | re-aim the pull toward the new circle |
| `abyss` | ink-black body, dozens of glowing eyes opening | **lights out**: the screen goes black, only its glow and your line are visible | follow the glow, pull against it |
| `tide` | water spiralling around it, foam crown | raises a **rogue wave** that floods the pier and lifts the fish into the sky | hold steady (don't reel) while the wave passes |
| `rust` | anchor-chain scales, barnacle armour, sparks of grinding metal | **anchors itself**: a huge chain drags the line down, the heaviest pull in the game | pump the rod in rhythm |

- Variant name shows on the catch card and in the Fishdex ("Ember Driftback"). Collecting every variant of a species is a long-term goal (bonus coins, pearls).
- Variants are visual and mechanical layers on the shared fish model: no separate model per variant.

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

### 4.6 Home island: start small, grow big (Casper: "start small, get bigger over time")
- **Day one is tiny:** a sandbar barely bigger than a boat, one crooked pier stub, a tarp lean-to, a driftwood fire, your rowboat. The rest of the cove from the key art is still sea and rocks; it has to be earned.
- **The island grows in real 3D:** buying a land plot raises it out of the sea (animated: water drains off, sand settles, plants pop up). Plots have their own shape and character, for example the Palm Spit, Tide-pool Shelf, Basalt Cliff (later the lighthouse), Kelp Shallows, Wreck Beach (the beached red boat), and the Old Mooring's Deep. The full-grown island matches the key art and goes beyond it.
- **Piers grow too:** pier modules are bought and placed; each new pier reaches deeper water and new fish.
- Buildings: Shop (sell/buy), Cooler (catch capacity), Smokehouse (turns fish into higher-value goods over time), Aquarium (displays caught species, earns visitor income, shows rare fish swimming), Boat dock (travel, boat upgrades), Workers' hut (hire fishers), Net & crab-pot spots.
- **Every building level is its own model** (at least 3 levels each): for example the shop starts as a crate stall under a sail, becomes the upturned-hull shop, then a two-storey hull with a crow's nest. Workers you hire appear on the island as their own characters.

**Fixed ids (every agent uses these):**
- Island core: `sandbar` (what you start on). Plots, in a sensible buying order: `palm_spit`, `tidepool_shelf`, `wreck_beach`, `kelp_shallows`, `basalt_cliff`, `mooring_deep`. Model ids `plot_<plotId>` (terrain dressing; A sculpts the terrain shape).
- Pier modules: `pier_*` from D's kit, bought as `pier_1` … `pier_6`.
- Buildings × levels: `shop`, `cooler`, `smokehouse`, `aquarium`, `boat_dock`, `workers_hut`, each `l1`, `l2`, `l3` → model ids `<building>_l<n>` (e.g. `shop_l2` is the upturned-hull shop). Day one has only the `shop_l1` crate stall and the tarp lean-to `camp_l0`.
- Boats: `rowboat` (start), `patched_skiff`, `sail_sloop`, `storm_cutter`.
- Gear: the item ids in `public/data/items.json` (rods, reels, lines, baits); model ids `<slot>.<itemId>` (e.g. `rod.greenheart`).

### 4.6b Everything has its own model
- **Gear:** every rod, reel and bait in `items.json` has its own 3D model. The rod and reel are visible in the player's hands, the bait on the hook, and all of them in a turning 3D preview in the shop. Lines are a material (colour, thickness, glow) on the line rope.
- **Boats:** every boat upgrade is its own model (rowboat → patched skiff → sail sloop → later islands' boats), visible at the dock and used for travel.
- **Workers, nets, crab pots, smokehouse racks, aquarium tanks**: all real models, levelled where they upgrade.

### 4.7 Shop and economy
- Currency: coins. Later a second earned-only currency (e.g. pearls from rare catches) for special gear. **Never sold for real money**, no paid currency.
- Sell price = base value × weight factor × size class × market modifier.
- **Market:** a daily "hot fish" with a bonus, prices recover slowly if you flood one species.
- Buy: rods, reels, lines, bait, lures, boat upgrades, building upgrades, land plots, workers.

### 4.7b Gear that wears, breaks and runs out, plus real tackle (Casper, 8 Nov)
"When your rod breaks you have to buy a new and better one, a better line, extra bait for catching bigger fish. Some other real fishing gear, all with art." Gear becomes a loop of its own: fish bigger → gear strains → upgrade. It must feel fair, never stuck:
- **Rods** have a weight rating (kg) and durability. Fighting a fish heavier than the rating with tension in the red strains the rod: creaking sounds, the rod model bends further, painted crack marks on the tension dial. Push too long and it **breaks**: the fish is gone, and the rod is broken until you repair it at the shop (~30% of its price) or buy a better one. The starter rod can bend but never breaks, so nobody is ever stuck.
- **Lines** have a strength (kg test) and wear. Every fight wears them a little, more when tension stays high. A worn line snaps sooner. A snap loses everything on the end of the line (hook, sinker, float, leader, lure or bait). Re-spool at the shop or buy a stronger line.
- **Bait is consumable** and sold in stacks. One bait is used per bite (stolen bait is lost too). Better bait attracts bigger and rarer fish, and each bait has its favourites. Bread crust is free and unlimited, so you can always fish.
- **Real tackle, all new item slots, each with a painted card (F) and a 3D model (G), named with a story like the rest:**
  - **Hooks** (J-hook, circle hook, treble, big-game forged hook): the hook window and how often a fish throws the hook; small hooks can't hold big fish.
  - **Sinkers** (split shot, egg sinker, pyramid sinker, cannonball lead): how deep the bait sinks, so which depth band (and fish) you reach.
  - **Floats/bobbers** (cork float, quill float, lantern float for night): how clearly the bite shows (a longer, clearer bite window).
  - **Leaders** (gut leader, wire leader, chain leader): toothy fish (gar, pike, eels) bite through the main line without one.
  - **Lures** (spoon, spinner, popper, jig, feathered fly): reusable instead of bait, attract predators, lost on a snap. Each moves differently in the water.
  - **Tools** (not on the line): landing net (lands fish faster; also powers the co-op "Net it!"), gaff (needed to land trophies and bosses), polarized glasses (see fish shadows deeper and spot rarity shimmer), tackle box (more bait and lure stacks), bait bucket (keeps live bait fresh = better attraction).
- The shop shows every item as its painted card plus a turning 3D model, with stats as clear before/after comparisons, and a repair/re-spool counter.
- Everything is in `items.json`; numbers live in data so balancing never needs code.

### 4.8 Idle
- Workers fish automatically at owned spots (they catch from the island's common/uncommon pool at a rate).
- Nets/crab pots fill over time; smokehouse processes; aquarium earns visitors.
- Offline earnings on return (summary card), capped at 8 h, cap upgradable.
- All rates in data/economy.json so balancing never needs code changes.
- Later: prestige ("New Tide") that resets coins/island for a permanent multiplier.

### 4.10 Co-op: up to 4 friends on one island (Casper, 6 Nov)
- **Model (Casper's choice): visit the host's island.** The host taps "Invite friends", gets a short room code and a share link (`?join=CODE`, Web Share API on phones). Up to 3 friends join, 4 players in total. A 5th is turned away politely.
- Everyone keeps their **own** progress: their own coins, gear, cooler and Fishdex in their own save. The island, its plots, buildings and boat are the host's. Visitors can fish, sell at the host's shop (their own coins) and fight, but can't buy land or buildings on someone else's island.
- **What makes it fun together:**
  - see each other walk, aim, cast and fight, with name tags in each player's colour
  - when a friend hooks something big, the others see the tension, can run over and **help land it** (a "Net it!" action that drains the fish's stamina)
  - elemental superpowers hit everyone nearby (lightning on the pier, lava bombs, the rogue wave), so the group dodges together
  - catches are announced to the group with the full reveal
  - quick emotes: wave, cheer, "big one!", point
  - later (M3), co-op boss fights where up to 4 lines are in the same boss
- **No accounts, no cloud saves needed.** Supabase project `fishing` (free plan, separate from everything else) is used only for Realtime: broadcast plus presence on a channel per room. URL `https://lhnayyewhxgsamwwmcxe.supabase.co`; the publishable key goes in `src/net/config.js` (publishable keys are meant for the browser).
- **Host-authoritative:** the host's game simulates the fish (spawns, AI, variants, bites for everyone's lures) and the island state; visitors send their own player state and actions and render what the host says. If the host leaves, the room ends gracefully and visitors go back to their own island with a message.
- **Free-tier budget:** Realtime counts every delivered message. Send player state at 4–6 Hz only while something changes, events only on change, fish snapshots at ~2 Hz for fish near players, and interpolate. Target ≤ 30 messages/s for a full room of 4. Write the math in the handoff.
- Single-player must work exactly as before when nobody joins, and offline.

### 4.9 Save
- localStorage key `fishing-v1`, versioned, with `sanitizeProfile` + migrations. Players must never lose progress.
- Debug hooks: `window.__game` (state), `?test=100` fast mode (100× coins/idle, unlock buttons) with a separate save key.

---

## 5. Art direction

### 5.1 House style (locked by Casper)
Reference: the "rare fish sheet" Casper picked (`art/concepts/reference/house-style.png`) — sleek stylized 3D creatures with polished, iridescent scales, crisp silhouettes and **bioluminescent accents**, glowing beautifully against dark teal water. World art is in the matching painterly-stylized direction (Casper picked style B: hand-painted adventure, warm light, rich colour).

**Casper's verdict on the first concept round (6 Nov):** `temple_manta` is the best, `storm_marlin` is good. **These two are the quality bar.** Everything else was not good enough; `bellbuoy_bass` (Old Bellbuoy) is rejected. Casper's standing order: **everything unique, nothing AI generic.**

### 5.0 The anti-generic test (applies to every deliverable: fish, world, UI, text)
If you could get the result by typing "<thing> fantasy game asset" into any generator or by dropping a free kit into a scene, it is generic and it gets redone. Every piece needs one specific idea that only this game has.

**Why the first round failed and the manta/marlin passed:** the failures were a normal fish with an object stuck on it (a bell on a bass, an anemone "hat" on a goby, a printed world map on a flounder, gold coins on a sardine), plus cute cartoon faces and pastel all-over colour. The manta and marlin work because the element *is* the anatomy: the manta's wings *are* carved temple stone with a rune seal grown into its back, the marlin's bill *is* a lightning rod and its dorsal fin *is* a torn storm sail. Dark, rich base colour, glow only on the signature part, strong silhouette, no face acting.

### 5.2 Rules for every fish
- **The element is the anatomy, not an accessory.** Never a normal fish with a thing attached. The body, fins or skin themselves are made of the idea.
- **Silhouette test:** filled solid black, the fish is still recognisable and different from every other fish in the game.
- **Element + one signature feature + strict 3-colour palette.** Dark, rich base; glow only where the design calls for it.
- **Identity on top:** the camera looks down, so the signature feature must read from above (back, dorsal fin, top pattern).
- **No face acting:** small realistic eyes (or glowing slits), no lips, no smiles, no big pupils, no cute. Not plastic-toy gloss, not pastel all over.
- **A one-line story** per fish (who it is, why it fights) that drives its design and its moves.
- No two fish share a body plan + palette. No random glowing dots, no "fantasy fish #47".
- Design briefs (redo all in the house style):
  - **Storm Marlin** (Storm): bill is a lightning rod with copper coil bands and jumping sparks; dorsal fin a tattered storm sail with glowing lightning veins. Palette: iridescent blue, silver, electric yellow.
  - **Temple Manta** (Rune): back is an ancient relic, carved stone plates on the wing edges and a glowing turquoise rune seal in the centre; light ribbons trail from the wingtips. Palette: near-black, stone grey, turquoise.
  - **Cathedral Jelly** (Deep): bell is a stained-glass dome lit from within (rose window), tentacles like aurora ribbons. Palette: rose, violet, cyan.
  - **Kintsugi Koi** (Fire): cracked porcelain body sealed with molten gold, crimson veil tail, embers. Palette: white, gold, crimson.
  - **Glacier Pike** (Frost): translucent glacier ice, its last meal frozen inside its belly, icicle teeth, frost ridge. Palette: ice blue, white, navy.
  - **Mossback Carp** (Bloom): ancient sleepy carp with a tiny living garden and a frog on its back, root barbels. Palette: moss, bark, blossom pink.
  - **Wreck Grouper** (Rust): grumpy veteran, anchor chain in its jaw, broken cutlass in its back, barnacle crown. Palette: rust, sea green, weathered brown.
  - Commons/uncommons per island follow the same rules (simpler, smaller, but each with one hook).
- **M1 roster, Driftwood Cove (Tide)**, redesigned after Casper's feedback. Ids are fixed; every agent uses them. Each design is a starting brief: the fish-art agent makes 3 clearly different takes per fish for Casper to choose from.
  | id | Name | Tier | Body | Signature = anatomy (reads from above) | Palette | Story |
  |---|---|---|---|---|---|---|
  | `glasswing_sardine` | Glasswing Sardine | common | fusiform, small, schools | body clear as blown glass with one glowing spine line inside; long wing-like pectoral fins | clear glass, turquoise, silver | schools skip over the surface like thrown pebbles |
  | `driftback` | Driftback | common | fusiform | the fish *is* a twisted, sun-bleached driftwood branch: grain for scales, knot-holes for eyes, dried-seaweed fronds for a dorsal fin | bleached grey, sea green, rust | lies still among real driftwood, then bolts |
  | `compass_flounder` | Compass Flounder | common | flat | round flat disc divided into a compass rose by raised bone ridges; a long needle-spine on its back that slowly turns to point north | brass, sand, ink blue | old navigators followed it home |
  | `shellback_blenny` | Shellback Blenny | uncommon | small, rear half coiled | lives in a spiral seashell like a hermit crab; only a frilled head and fins stick out | coral pink, cream, deep violet | bites the hook, then retreats into its shell |
  | `kelp_wraith` | Kelp Wraith | uncommon | eel | the whole body is built from overlapping kelp blades (leafy-seadragon idea), amber float-bulbs along the spine that glow at dusk | olive, amber, deep brown | invisible in the kelp until it moves |
  | `seaglass_puffer` | Seaglass Puffer | rare | bulky | body *is* a cluster of frosted sea-glass shards; inflating spreads them into a spiky glass sphere; small sharp eyes, no smile | bottle green, frosted white, amber | the tide polished it for a hundred years |
  | `old_mooring` | The Old Mooring | big (tutorial) | huge catfish | barbels *are* frayed mooring ropes, iron mooring ring through its lip, jaw bristling with old hooks and lures from every angler who lost it, barnacle-crusted tar-black hide | tar black, rope tan, rust | the one that got away, for fifty years |
- **Picks (6 Nov, Casper didn't object to the recommendations):** glasswing_sardine A, driftback A, compass_flounder B, shellback_blenny C, kelp_wraith A, seaglass_puffer A (B = its inflated pose). old_mooring: direction C (fins and tail fray into hemp rope fibre), needs a new pass. Takes live in `art/concepts/fish/_takes/<id>_<A|B|C>.webp`. Font: **Chartroom** (IM Fell English SC + Alegreya Sans). Shop: the **upturned-hull** shop from `driftwood_cove_shop_detail.webp`.
- **Approved (quality bar):** `storm_marlin`, `temple_manta`. **Not approved yet:** `cathedral_jelly` (redo later, not needed for M1). **Rejected:** `bellbuoy_bass` and the first versions of the other six commons; their old ids (`sunscale_sardine`, `driftwood_perch`, `chartfish`, `tidepool_goby`, `kelp_ribbon`) are retired.

### 5.3 World
- Camera: perspective, angled top-down (~55° pitch), soft follow, slight zoom-out while fighting.
- **Water is the star of every screen:** a custom stylized shader with depth colour, shoreline foam, caustics in shallows, visible fish shadows, splash and ripple effects. Dark, rich teal in deep water so glowing fish pop.
- Each island has its own palette, light and particles (fireflies, snow, embers, rain, glyph motes).
- **Key art first:** before building an island, make one key-art image of it from the game camera (Qwen-Image, style B) at `art/concepts/world/<island>_key.webp`. Every model, texture, light and colour on that island is judged against it.
- **Free kits are base meshes, not the look.** Everyone recognises the out-of-the-box Kenney, KayKit and Quaternius style; shipping it unchanged is generic. Kit pieces get repainted with our own painted texture atlas, weathered (edge wear, salt crust, moss, rope wraps, nails, patches), made asymmetric and combined into new shapes. Signature pieces (shop, piers, boat dock, workers' hut, boat) are bespoke builds in Blender (`bpy`) with a story: who built it, what was patched, what washed up against it.

### 5.4 Hard bans
- **No visible primitive geometry** (three.js boxes, spheres, cylinders, cones) as game art, ever. Primitives only for invisible colliders and debug.
- No paid assets. No assets without a licence that allows it. No assets from Ascendant Arena.
- **No AI-generic fonts.** Banned: Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Nunito, Arial/Helvetica, system-ui, and the overused "mobile game" faces Fredoka, Lilita One, Luckiest Guy, Bangers, Baloo. Typography must have character that belongs to this world (sea charts, carved wood, stained glass, bioluminescence). Free fonts only (Google Fonts / OFL), self-hosted. The UI agent shows Casper 3 type pairings in a real game-UI mock before locking one.
- No generic default UI. Banned: rounded-rectangle cards with soft drop shadows, gradient pill buttons, glassmorphism panels, emoji, icon sets used raw, flat "Level 2 Rod" labels. The UI is made of this world's materials: chart paper, brass instruments, carved driftwood, rope, sea glass, bioluminescent ink. Gear has names and a line of flavour text.

### 5.5 Asset sources, in this order
1. **Free CC0 kits** for environment, props and characters: Quaternius, KayKit, Kenney, Poly Pizza (CC0 only). Check the licence of every file; record it in `CREDITS.md`.
2. **Generated on Casper's Hugging Face** when no free asset fits (all fish, landmarks, signature buildings):
   - Concepts: **Qwen-Image** (`mcp-tools/Qwen-Image`, final quality). Z-Image Turbo only for quick tests.
   - Background removal: `not-lain/background-removal` before 3D.
   - 3D: **TRELLIS.2** image → 3D (MIT) gives the best meshes, but it only returns an `hf.space` link this workspace can't download. It is used only when Casper runs it himself and attaches the `.glb` files.
   - **Default fish 3D route: Blender (`bpy` from PyPI; a venv already exists in `.cache/agent-d/venv`).** Build each fish from its approved concept: a straight side view plus a matching top view (`mcp-tools/Qwen-Image-Edit-Angles` or a second Qwen-Image render with the same description), loft the body from the two silhouettes, project the painted concept onto it, fins as alpha-cut cards from the concept, export glTF to spec (5.6). Start with `storm_marlin` and judge it before doing more.
   - Animation reference clips: Wan 2.2 image-to-video (optional).
   - HF ZeroGPU quota is about 25 min/day and resets around 22:45 Brussels time. Keep a quota ledger in `docs/art-ledger.md`; stop and report before you run out.
3. Never fall back to primitives. If an asset is missing, the feature waits or uses a clearly temporary model from a CC0 kit.

**Everything generated gets used (Casper's rule).** Never generate an image or model without a destination. Before generating, add its entry to the right registry: fish/world/gear manifests for models, `public/data/art.json` for 2D art (illustrations, cards, badges, VFX textures, title art), each with `path` and `usedBy` (which screen, system or model uses it). Concept and reference images live in `art/concepts/` and must be referenced by the model or design they fed (manifest field `concept`). Register art *before* generating it with `"planned": true` on the entry; remove `planned` the moment the file exists. Game code (A, B, E) skips planned entries, so the live game never requests a file that isn't there. `node tools/check-art.mjs` lists every shipped file that nothing references, every non-planned entry whose file is missing, and the planned list separately; the lead runs it before each commit, and the list must be empty except for work in progress named in a handoff note.

**HF quota is the bottleneck for "a lot of art":** share it with the ledger in `docs/art-ledger.md`. Use `mcp-tools/Qwen-Image-Fast` for volume work (icons, gear, VFX textures) when it passes the anti-generic bar; full `mcp-tools/Qwen-Image` for hero art. Measure real GPU time per call and write it in the ledger. On a quota error: stop generating, carry on with non-GPU work, continue after the reset (~22:45 Brussels).

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
| Flat | whole-body ripple along the edge fins, hugs the bottom, bursts of sand when it moves | flounders |
| Shelled | body stays still, head and fins flutter, pulls back into the shell when scared | shellback blenny |

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
public/assets/world/ public/assets/character/ + manifests    Agent D (island growth stages, buildings per level, workers)
src/vfx/  public/assets/vfx/  public/data/variants-look.json Agent E (variant looks + superpower VFX)
public/data/variants.json                                     Agent B (chances, multipliers, names, lore)
public/data/powers.json                                       Agent A (superpower mechanics, telegraphs, counters)
public/art/  public/data/art.json                             Agent F (illustrations; B wires them into the UI)
public/assets/gear/ public/assets/boats/ + manifests          Agent G (rods, reels, baits, boats)
src/net/  (#hud-net contents)                                 Agent H (co-op multiplayer)
tools/check-art.mjs                                           lead
CREDITS.md                                                   Agent D (C, E, F, G append their sections)
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
- **Agent D — World & Character Assets:** Driftwood Cove models (kits repainted + bespoke Blender builds), the island growth stages (starting sandbar, plot dressing sets), every building at every level, workers, the player character with clips; licences in CREDITS.md.
- **Agent E — Variants & Superpower VFX:** the basic morph and elemental variant looks (shader overlays, auras, lights) and the over-the-top superpower effects (lightning storms, freezing sea, lava bombs, vines, glyph teleports, lights-out, rogue wave, anchor chain), with HF-generated textures and sprites. Code in `src/vfx/`, driven by A's events.
- **Agent F — Illustrations:** painted art the UI shows: gear cards for every item, island cards for the sea chart, building cards per level, variant emblems, title/loading art. Registered in `public/data/art.json`; Agent B wires them in.
- **Agent H — Co-op Multiplayer:** rooms, invites, presence, the Supabase Realtime transport (plus a local transport for testing), syncing players, fish, fights, powers and the host's island, remote player avatars, the co-op actions and emotes (section 4.10).
- **Agent G — Gear & Boats:** a 3D model for every rod, reel and bait in `items.json` and every boat level, from HF concepts + Blender; rod tip and hand grip marked as nodes so A can attach the line and the hand.

Every agent ends with `docs/handoff/<agent>.md`: what was done, what is missing, what needs Casper's decision, and screenshots/contact sheets where visual.

---

## 9. Milestones

**M1 — Vertical slice (Driftwood Cove):** walk the island, aim + cast with the full aim mode, bite + hook, reel minigame, 6 unique common fish + 1 big tutorial fish, catch card, sell at the shop, buy one rod and one bait, hire one worker (idle), offline earnings, save/load. Real models only, real water shader, chosen font.
**M2:** boat travel, Wreck Reef, strong-fish moves, home island expansion (first land plot), aquarium, Fishdex.
**M3:** first boss fight (Wreck Grouper), more islands with their legendaries, smokehouse, market events, prestige.

## 9b. Casper's first playtest on his phone (8 Nov) — top priority
**All menu layouts follow `docs/UI_BIBLE.md`:** grids of small tiles, categories in separate shop sections, tabs that never scroll, bottom drawers for details.
1. **"The screens are too generic and ugly."** A parchment card with a dashed border and dotted lines (the cooler, the catch card) is exactly the generic look we must not ship. **Every screen becomes a painted place or object from this world**, with its own illustration as the backdrop and the UI living *in* it:
   - **Cooler** → looking down into the actual container: a wicker basket (later an ice chest, then a smokehouse rack) lined with seaweed and ice, with your caught fish lying in it as painted cut-outs. Tap a fish to see it. How full the basket looks shows the capacity. Upgrading changes the painting. **Selling works right inside the cooler too (Casper, 8 Nov):** sell a single fish from its detail view, or sell the whole basket at once, wherever you are on the island.
   - **Shop** → standing at the upturned-hull shop's counter: the shopkeeper (painted portrait, with a story) behind it, gear hanging on hooks on the wall, and a brass scale for selling (fish go on the scale, coins slide across).
   - **Harbour / building tab** → a carpenter's plan board: building cards pinned on it, each with its painting and a turning 3D model.
   - **Logbook / Fishdex** → a leather field journal: island header paintings, sketched fish portraits, ink silhouettes for unknown fish, pressed-paper texture.
   - **Travel** → a painted sea chart with the island cards pinned on it.
   - **Settings** → the captain's drawer.
2. **"The fish pictures are all the same pose and not rewarding enough."** Every fish gets several *different* painted poses: a **hero pose** for the catch reveal (leaping, twisting, thrashing, each fish in its own way: the sardine skipping off the surface with its glass wings spread, the puffer bursting into its spiky sphere, the flounder flipping like a coin, the kelp wraith unfurling), a **resting pose** lying in the cooler, and a **journal portrait**. Never the same side-on pose twice.
3. **The catch must feel like a reward** (the catch card gets completely redesigned):
   - in the world, the fish bursts out of the water in slow motion while the camera punches in, with a splash; the player holds it up
   - then a full-screen reveal: the island's or element's painted backdrop with light rays, the hero pose big in the centre, the weight counting up, a size stamp slammed on, and coins flying into the purse with sound
   - painted ribbons for **NEW SPECIES** / **RECORD**; for elemental variants, the variant name huge, with E's effects
   - Keep/Sell as two physical choices (drop it in the basket / put it on the scale), not form buttons
   - no dotted-line form rows, no plain parchment box
4. **"Dragging to cast is not smooth."** First fix is in (the aim glides after the thumb, slow sway instead of shake). A polishes it further on a real phone feel: haptic ticks, pull-back tension, nothing that jumps.
5. **"The player doesn't have a model."** The model is there, but from the camera only the wide straw hat is visible. The camera gets a lower, more side-on pitch (closer to 45–50°) and comes closer; the hat brim shrinks; the player gets a subtle rim light so they always read.
6. **"Buildings bought in the shop need art and a 3D model that gets placed, so we can expand the island."** Buying a building enters a **placement mode** on the island: the camera lifts, the building's 3D model follows your finger as a ghost, snaps to build spots on land you own (green when valid, red when not), and you can rotate it before confirming. Then it's built with an animation (scaffolding, dust, hammering) and stays where you put it (`profile.island.buildings[id] = { level, x, z, rot }`). Upgrades swap the model on the spot (l1 → l2 → l3), each with its own painting and model. Buying land raises a new plot out of the sea and adds new build spots. The island visibly grows from the tiny sandbar.
8. **"The cast button and the UI around casting should also get custom art."** The current CSS sunburst disc with a rope and a dark ellipse is generic. Everything in `#hud-fishing` gets painted art made for it (F paints, A wires, keys `hud.*` in art.json):
   - the cast button as a real object (for example a carved cork rod grip with a brass reel, in idle / pressed / aiming states), and the reel button for the fight
   - the pull-back band as a painted fishing line
   - the perfect-timing ring
   - the tension gauge as a bending rod or brass dial, the fish stamina as the fish's own painted spirit or silhouette draining
   - the hook prompt ("Strike!") as painted lettering, and the hint labels on painted tags
   
   The scene must also stay readable at every hour: dusk and night may be moody but never muddy-dark (Casper's screenshot at dusk is too dark and brown).
9. **"For animation, use correct models."** Every animated thing uses a real rigged model with real clips: the player, the workers and the shopkeeper are D's rigged characters, playing proper clips (walk, run, cast, reel, hold up, idle). No sliding T-poses, no primitive stand-ins, no moving a static mesh around as fake animation. Fish use their 3D models with the vertex-shader swim; until a fish's model exists it stays a shadow under the water, never a box. Building and boat animations move the real model (rising out of the scaffold, rocking on the water).
7. **"Sometimes you walk into invisible, badly cut 3D models."** Two bugs to kill for good:
   - **invisible walls:** collision must match what you see. Every collider comes from the model's real footprint (D ships a simple collider shape per model in the manifest; A uses only those). Nothing blocks you that isn't visibly there, and a debug view (`?debug=colliders`) shows them.
   - **badly cut models:** no model may have cut-off parts, missing faces, holes you can see through, or floating pieces. D audits every world model from the game camera and from eye level (contact sheet), fixes or replaces the bad ones, and uses double-sided materials only where that's right (leaves, cloth).

## 10. Definition of done (every change)
- `npm run build && python3 -I tools/smoke.py <out.png>` passes (the build served under `/Fishing/` like GitHub Pages, at 390×844, no page errors, game ready). The game is public: every push to `main` goes live, so it must never be left broken.
- Screenshot at 390×844 checked by eye: no primitives visible, text readable, nothing overflows.
- Art matches section 5; licences recorded; `node tools/check-art.mjs` reports nothing unused.
- Committed with a player-facing message and pushed. Big or risky work goes to a branch + PR for Casper.
