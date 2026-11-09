# Lead notes for the agents (read on resume)

## 8 Nov, 20:10 — changes the lead made while agents were paused
- **dom.js `h()`**: style objects now set CSS custom properties (`--n` …) with setProperty. This was why every Tabs row stacked vertically on Casper's phone.
- **Shop (Casper: "very clear squared UI over long tabs", "same layout even when empty", "specific logos for each category")**:
  - Tabs are square tiles with painted category icons: `icon.tab.*` in art.json (19 icons, public/art/icons/). `Tabs` items accept `art`; shop.js maps sub-tab ids to the plural icon keys (`tabArt`).
  - The layout is fixed in every section: a sub-tab row or `TabsSpacer()`, `TileGrid` always pads to at least 6 places (2 rows of 3) with visible empty hooks (`.tile--empty`), the plate or `.plate-spacer`. Empty states are drawn inside the grid frame (`TileGrid([], { empty: '…' })`). Keep it that way for every screen (cooler, logbook, chart, drawer).
  - Rows are measured identical across sections (tabs 69, sub 56, grid 336, plate 56 at 390×844).
- **Shopkeeper**: Casper asked for a different, curvier, more attractive keeper. `npc.shopkeeper` is now **Marin Ballast** (new story in art.json); Nell is archived in art/concepts/_rejected/.
- **Casting HUD**: hud.* art exists (cast/reel buttons, tension dial + needle, stamina level, ring, strike splash, line band, crack, tag). Cast/reel buttons are wired in src/fishing/hud.js; A wires the rest.
- Tackle and building tiles still show drawn placeholder icons until F paints `gear.<slot>.<id>` and `building.<id>.l<n>`.

## 8 Nov, 21:15 — more lead changes
- Shop tiles: item art sits directly on the paper tag (no dark picture box), `object-fit: contain`, never cropped. Tab icons are one style: CSS turns every painted icon into a gilded engraving (dark ink on the selected brass tab), fixed size 32 px (sub-tabs 22 px). Casper approved this direction; keep it for every menu.
- Art now live: all 24 tackle cards, 18 building cards (`building.<id>.l1..l3`), 11 variant emblems, 8 island stamps + chart cards, title/loading art, hud set, 19 tab icons.
- Player trap fix in src/world/island.js `resolveMove`: a step that leads out of a collider is always allowed (a building that appears around the player can never trap them).

## 9 Nov, 13:35 — Casper: "implement everything" (all generated art must be visible in the game)
`node tools/check-art.mjs` now has a "NOT SHOWN IN THE GAME" list: registered art that no code asks for. It must be empty.
Open now: screen.cooler.l0–l3 + fish rest poses in the cooler (B), stamp.* + fish portraits in the logbook (B), hud.* gauges/ring/strike/line/crack (A), fish 3D models in the water (A uses, C builds).
