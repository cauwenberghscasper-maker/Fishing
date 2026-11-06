# Interfaces between systems

Read `docs/MASTER_PROMPT.md` first. This file is the contract that lets agents work in parallel. Change it only through the lead (write proposals in your handoff note).

## Boot order (`src/main.js`, lead)
1. `loadData(state)` — `src/economy/data.js` (B) fills `state.data` from `public/data/*.json` (`fish`, `islands`, `items`, `economy`, `fishBehaviour`).
2. `loadProfile(state, events)` — `src/save/profile.js` (B) fills `state.profile` and `state.gear`.
3. `startEconomy({ state, events })` — `src/economy/index.js` (B).
4. `startUI({ root, state, events })` — `src/ui/app.js` (B). `root` is `#ui`.
5. `startWorld({ canvas, state, events })` — `src/world/game.js` (A). `canvas` is `#game`.
6. `game:ready` is emitted; `window.__game = { state, events }`.

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
| `fish:caught` | `{ fishId, weight, sizeClass, islandId, perfectCast }` | fish landed |
| `fish:lost` | `{ fishId, reason }` reason: `snap`, `escape`, `spooked` | |

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

## Asset manifests
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
