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
