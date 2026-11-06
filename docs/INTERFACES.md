# Interfaces between systems

Read `docs/MASTER_PROMPT.md` first. This file is the contract that lets agents work in parallel. Change it only through the lead (write proposals in your handoff note).

## Boot order (`src/main.js`, lead)
1. `loadData(state)` — `src/economy/data.js` (B) fills `state.data` from `public/data/*.json` (`fish`, `islands`, `items`, `economy`, `fishBehaviour`).
2. `loadProfile(state, events)` — `src/save/profile.js` (B) fills `state.profile` and `state.gear`.
3. `startEconomy({ state, events })` — `src/economy/index.js` (B).
4. `startUI({ root, state, events })` — `src/ui/app.js` (B). `root` is `#ui`.
5. `startWorld({ canvas, state, events })` — `src/world/game.js` (A). `canvas` is `#game`. Sets `state.render = { THREE, scene, camera, renderer, clock }` and adds per-frame callbacks via `state.render.onFrame(fn(dt, t))`.
6. `startVfx({ state, events })` — `src/vfx/index.js` (E). Uses `state.render` to draw into A's scene.
7. `startNet({ state, events })` — `src/net/index.js` (H). Does nothing until the player hosts or joins (or the URL has `?join=CODE`).
8. `game:ready` is emitted; `window.__game = { state, events }`.

## Co-op (master prompt 4.10, Agent H)
- `state.net` (H owns): `{ mode: 'solo'|'host'|'visitor', room, selfId, players: { [id]: { name, color, isHost } } }`. Everyone else only reads it. Solo = exactly the old single-player behaviour.
- **Visitor mode rules:** B hides land/building/boat purchases when `state.net.mode === 'visitor'` (the visitor's own coins, gear, cooler and Fishdex still work, including selling at the shop). A renders the host's island from the `island:changed` that H emits with the host's island state (payload gets `source: 'net'`), not from the visitor's own profile.
- **Fish authority (A provides, H uses):** `state.world.fish = { setAuthority(bool), snapshot() → [{ uid, fishId, variant, x, z, depth, state, heading }], apply(snapshotArray), forceBite(uid, playerId) }`. The host keeps authority, and H broadcasts `snapshot()` at ~2 Hz plus events. Visitors call `setAuthority(false)` and feed `apply()`, and their lures ask the host for bites.
- **Local player state (A provides, H reads):** `state.world.self = { x, z, heading, anim, mode, lure: {x, z}|null, tension, fishUid }`.
- **Remote avatars and their lines** are drawn by H into `state.render.scene` (D's character model, recoloured per player, name tag), and E's power effects are triggered for remote powers by H re-emitting `power:*` with `remote: true`.
- **Events from H:** `net:joined`, `net:left`, `net:player-joined`, `net:player-left` (`{ id, name }`), `net:catch` (`{ playerId, fishId, variant, weight }`, so B shows a group toast), `net:help` (`{ fromId, toId }`, a friend helps land your fish; A applies the stamina drain), `net:emote` (`{ playerId, emote }`).
- `#hud-net` (in index.html) is H's container for the invite/room button, the player list and emotes. Use B's theme classes.

## Variants and superpowers (master prompt 4.4b)
- `public/data/variants.json` (B): `{ "<variantId>": { kind: "basic|morph|element", name, element?, chance, islandBoost: { "<islandId>": x }, weatherBoost?, valueMult, lore } }`. Ids: `basic`, `bleached`, `inkdark`, `gilded`, `storm`, `frost`, `ember`, `bloom`, `rune`, `abyss`, `tide`, `rust`.
- `public/data/powers.json` (A): per elemental variant the fight mechanic: `{ "<variantId>": { power, telegraph: seconds, duration, cooldown, effect: {...}, counter: "slack|tap|step|swipe|reaim|follow|hold|pump" } }`.
- `public/data/variants-look.json` (E): per variant the visual settings (overlay texture, colours, aura, light, sound cue name).
- A rolls the variant when a fish spawns (B's chances), shows it, runs its power in the fight; E draws every look and effect; B prices it and records it in the Fishdex.

## Event bus (`src/core/events.js`)
`events.on(name, fn) → off()`, `events.once(name, fn)`, `events.emit(name, payload)`.

### Emitted by Agent A (world / fishing)
| Event | Payload | When |
|---|---|---|
| `zone:enter` / `zone:exit` | `{ zoneId, kind }` kind: `shop`, `pier`, `boat`, `building`, `plot` | player walks into/out of an interaction zone |
| `aim:start` / `aim:end` | `{}` / `{ cancelled }` | aim mode |
| `cast:land` | `{ x, z, depth, perfect }` | lure hits the water |
| `bite` | `{ fishId }` | real bite (hook window opens) |
| `hook:result` | `{ fishId, success }` | |
| `fight:start` | `{ fishId, weight, sizeClass, strength }` | fish hooked |
| `fight:update` | `{ tension, stamina, hp? }` 0..1 | throttled ~10/s |
| `fish:caught` | `{ fishId, variant, weight, sizeClass, islandId, perfectCast }` | fish landed (`variant` defaults to `basic`) |
| `fish:lost` | `{ fishId, variant, reason }` reason: `snap`, `escape`, `spooked` | |
| `fish:spawn` / `fish:despawn` | `{ uid, fishId, variant, object }` (`object` = the fish's THREE.Object3D) | a fish appears/disappears (E attaches the variant look) |
| `fish:landed-show` | `{ uid, fishId, variant, object }` | the fish is held up / shown at the catch (E plays the reveal burst) |
| `power:telegraph` | `{ uid, variant, power, target: {x, z}, duration }` | a superpower is about to fire (E shows the warning) |
| `power:start` / `power:end` | `{ uid, variant, power, target, success? }` | the superpower fires / ends (`success` = player countered it) |
| `island:grown` | `{ plotId }` | A finished the land-rising animation for a plot |

### Emitted by Agent B (economy / UI / save)
| Event | Payload | When |
|---|---|---|
| `profile:changed` | `{ keys: [...] }` | anything saved changed |
| `coins:changed` | `{ coins, delta }` | |
| `gear:changed` | `state.gear` | equip/buy |
| `island:changed` | `{ plots, buildings }` | land plot bought / building upgraded (A rebuilds the island visuals) |
| `travel:request` | `{ islandId }` | player chose a destination at the boat dock |
| `ui:modal` | `{ open: bool }` | a menu opened/closed (A pauses input) |
| `catch:kept` / `catch:sold` | `{ catchId }` | |

B listens to `fish:caught` to add the catch, `zone:enter` to show the right action button (Shop, Travel, Build...).

## Shared state (`src/core/state.js`)
- `state.profile` (B owns, saved): `version, coins, pearls, gear{rod,reel,line,bait}, cooler[], fishdex{}, island{plots,buildings}, workers[], lastSeen, unlockedIslands[]`.
- `state.gear` (B derives, A reads): `{ rodPower, castDistance, steadiness, reelSpeed, lineStrength, baitId, hearts }`.
- `state.data` (B loads): ids in `fish.json` must match the fish ids in the master prompt and the model ids in `public/assets/fish/manifest.json`.
- `state.world` (A owns): `islandId, mode, zone`.
- `state.test` true with `?test=100`.

## Fishing controls in the DOM
Agent A owns the contents of `#hud-fishing` (cast button, aim feedback, tension/stamina meters during the fight) and its logic. It must use Agent B's theme so the UI stays one style:
- CSS variables (B defines in `src/ui/theme.css`): `--font-display`, `--font-body`, `--font-num`, `--c-ink`, `--c-paper`, `--c-sea`, `--c-glow`, `--c-danger`, `--c-gold`.
- Classes: `.btn`, `.btn--primary`, `.btn--round`, `.meter`, `.meter__fill`, `.meter--tension`, `.meter--stamina`, `.toast`.
Until B lands the theme, A uses these names anyway; nothing else.

## Data files (`public/data/`)
- `fish.json` (B): `{ "<id>": { name, island, tier, element, baseValue, weight: [min,max], depth: [min,max], bait: [...], time: "any|day|night", weather: "any|...", model: "<id>" } }`
- `fish-behaviour.json` (A): `{ "<id>": { body: "fusiform|eel|ray|jelly|bulky|flat|shelled", personality, stamina, pull, moves: [...], swim: { amp, freq, speed } } }`
- `islands.json`, `items.json`, `economy.json` (B).

## 2D art registry (`public/data/art.json`, Agent F; B and E read it)
```json
{ "gear.rod.greenheart": { "path": "art/gear/rod_greenheart.webp", "usedBy": "ui/shop gear card", "concept": null, "licence": "generated: Qwen-Image (Apache-2.0)" } }
```
Key scheme: `gear.<slot>.<itemId>`, `island.<islandId>`, `building.<buildingId>.<level>`, `variant.<variantId>` (emblem), `title.main`, `title.loading`, `vfx.<name>` (E). The UI looks art up by key and hides the slot when an entry is missing.

## Asset manifests
Model manifests: `public/assets/fish/manifest.json` (C), `public/assets/world/manifest.json` + `public/assets/character/manifest.json` (D), `public/assets/gear/manifest.json` + `public/assets/boats/manifest.json` (G). Gear ids equal the item ids in `items.json` (G's manifest key `rod.greenheart` etc.); every gear model has empty nodes `grip` (where the hand holds it) and, for rods, `tip` (where the line starts). Building levels in D's manifest are ids like `shop_l1`, `shop_l2`, `shop_l3`; island plots `plot_<plotId>` with their dressing.
Every manifest entry may carry `concept` (the concept image it was built from) so `tools/check-art.mjs` can see the concept is used.
`public/assets/fish/manifest.json` (C), `public/assets/world/manifest.json` and `public/assets/character/manifest.json` (D):
```json
{ "chartfish": { "path": "assets/fish/chartfish/model.glb", "scale": 1, "body": "flat", "tris": 4200, "licence": "generated (Qwen-Image Apache-2.0 → TRELLIS.2 MIT)", "status": "final|temp" } }
```
`status` is `concept` (only art, `path: null`), `temp` or `final`. Fish entries may also have `preview` (path to `preview.webp`). Agent A's loader (`src/core/assets.js`) reads all manifests and skips entries whose `path` is null. Missing model = the thing is not shown (never a primitive placeholder).

## Downloads
See master prompt 5.5: GitHub, npm and Hugging Face tool outputs only. Work files and raw downloads go in `.cache/` (git-ignored); only cleaned, licensed assets go into `public/assets/...`.

## Git
- Agents never commit, push or switch branches. The lead commits and pushes.
- Cloning a third-party asset repo from GitHub into `.cache/` is fine (`--depth 1`, one clone at a time).
