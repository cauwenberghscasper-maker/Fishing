# Agent B — Economy, UI & Save: handoff

## Status
Round 1 (done):
- [x] Fonts self-hosted in `public/fonts/`; **Chartroom locked by Casper** (IM Fell English SC + Alegreya Sans)
- [x] `src/ui/theme.css`: the contract for Agent A (variables + `.btn`, `.btn--primary`, `.btn--round`, `.meter`, `.meter__fill`, `.meter--tension`, `.meter--stamina`, `.toast`)
- [x] `docs/type-specimen.html` + `docs/handoff/shots/type-specimen.png`
- [x] Data: `fish.json`, `islands.json`, `items.json`, `economy.json`
- [x] Save, economy, all UI screens; verified at 390×844, 320×568, 844×390

Round 2 (Casper's new features):
- [x] Lock Chartroom: the other pairings' CSS, fonts, `?type` switch and Settings row are removed; the specimen page shows Chartroom only, and `type-specimen.png` keeps the comparison
- [x] Variants: `public/data/variants.json`, pricing, catch card moment, logbook variants + set bonuses (code in; visual check pending)
- [x] Island growth: sandbar + fixed plots, `pier_1`…`pier_6`, buildings l1–l3, boats; first-15-minutes tuning (save v3 with migration)
- [x] Art registry wiring: gear, islands, buildings, variant emblems, title/loading + tips, `npc.shopkeeper`, `fishdex.<islandId>` (slots hide until the file loads)
- [x] Gear models: `model` keys in `items.json` (lines get `material`), turning 3D preview in the shop through Agent A's loader
- [x] Co-op: visitor mode hides island purchases (UI + economy refuse), group toasts, `#hud-net` slot
- [ ] Verification + screenshots

## What works, as the player sees it (round 1)
- **Top bar:** a brass coin plaque (coins, plus pearls once you have any), a glowing line "+5 a minute from your harbour" once the crew earns, and three brass porthole buttons: Cooler (with a 7/12 count), Logbook and Settings.
- **Context action:** walking into a zone shows a carved nameboard plank at the bottom centre ("Open the shop", "Chart a course", "Hire a fisher", "Improve the cooler", "Raise new land"). Piers show nothing; that is Agent A's cast control.
- **Catch card** (on `fish:caught`): a specimen label on chart paper with sea-glass tokens (New to your logbook, Heaviest yet, Perfect cast, +pearls), the fish name, its story, and ledger lines with dotted leaders (Weight, Size as a rubber stamp, Worth). The buttons are Keep and "Sell for N". A sea window shows Agent C's preview when the manifest has one, and hides otherwise. A full cooler swaps Keep for "Let it go".
- **Shop** (three chart-index tabs):
  - **Sell:** today's hot fish, rows with weight, stamp, In demand / Price falling, and "Sell all for N".
  - **Buy gear:** paper price tags with a name, flavour, stat differences and a price, "Use this" or "In use".
  - **Harbour:** crew, night watch, buildings, land.
- **Cooler, Logbook, Sea chart, Settings, While-you-were-away letter, toasts:** see the screenshots list.
- Coins are earned only. There is no real-money anything.

## Type
Casper picked **Chartroom**: IM Fell English SC for titles and names, Alegreya Sans for text and numbers (tabular lining figures). The specimen PNG keeps the three-way comparison on record.

## Balance (round 1; updated in round 2 below)
- **Sell price** = base value × weight factor (0.8–1.2) × size class (Small 0.8 / Fair 1.0 / Large 1.3 / Trophy 1.8) × market (hot fish ×1.5; selling more than 8 of one species drops its price 2% per fish, floor 60%, recovering 1 fish per 2 min) × (1 + shop bonus).
- **Crew:** about 4.7 coins a minute per fisher. **Offline:** up to 8 h; the night watch raises it to 10/12/16/24 h.

## Save
- Key `fishing-v1` (test `fishing-test-v1`), versioned, with `MIGRATIONS` + `sanitizeProfile` in `src/save/profile.js`.
- An unreadable save is kept as `fishing-v1-unreadable-<time>`.
- Autosave on change (debounced), on hide/pagehide, and every 15 s. `lastSeen` drives offline earnings.

## For Agent A
- **Theme:** `app.js` imports `theme.css` and injects `fonts/fonts.css` before `startWorld`.
  - Meters: `fill.style.width` or `--value` (0..1); `is-danger` on `.meter--tension`.
  - `.btn--round` is 52 px (`--size`). `#ui *` is border-box.
- Keep the bottom centre free (about 64 px above the safe area) for the context plank.
- `rules.js` exports `sizeClassFor`, `rollWeight` (and in round 2 `rollVariant`).
- `state.gear` = `{ rodId, reelId, lineId, baitId, rodPower, castDistance, steadiness, reelSpeed, lineStrength, baitAttraction, hearts }`.
- `state.profile.settings` = `{ sound, quality: 'low'|'auto'|'high' }`, with a `settings:changed` event.
- `ui:modal { open }` on every sheet or card.

## Proposals for the lead (INTERFACES.md)
- **New B events:** `catch:landed { catch, isNew, isRecord, value, pearls, coolerFull, hot }`, `catch:released`, `offline:ready`, `idle:income`, `settings:changed`.
- **Debug hooks:** `state.economy` (economy API) and `window.__ui` (open screens).
- **Optional:** add `<link rel="stylesheet" href="fonts/fonts.css">` to `index.html` for a faster first paint.

## Decisions for Casper (round 1)
1. Selling only at the shop (the Cooler button is read-only away from the shop)?
2. Crew strength: one fisher earns about 30% of active fishing. OK?
3. Baits are permanent (buy once), not consumables. OK?

## Screenshots (`docs/handoff/shots/`)
`type-specimen.png`, `agent-b-catch-card.png`, `agent-b-catch-card-image-slot.png`, `agent-b-shop-sell.png`, `agent-b-shop-buy-after.png`, `agent-b-shop-harbour-crew.png`, `agent-b-landscape-shop-sell.png`, `agent-b-small-catch.png`, `agent-b-logbook.png`, `agent-b-travel.png`, `agent-b-offline.png`, `agent-b-settings.png`. Round 2 shots will replace these where screens changed.
