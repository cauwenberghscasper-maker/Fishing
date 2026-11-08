# UI bible — how every menu is laid out

Casper (8 Nov, after playing): "I'm not happy with most menus and layout." "Tabs must not become scrollable; items should be categorized, in separate shop menus for each type; smaller, showing multiple at the same time."

What he saw: every screen was the same template, a full-height parchment sheet with a dashed border, a big title top-left, an × top-right and a long vertical list of wide rows. That template is banned. This file overrides older layout notes; master prompt 9b (painted places) still applies, and this is how those places are laid out.

## 1. Hard rules
1. **No long lists.** Items are **tiles in a grid**: 3 per row at 390 px wide (4 at ≥ 430 px and in landscape), tile ≈ 108×132 px: painted art on top, name (1–2 lines), price or stat, and a state mark (owned ✓ / equipped ring / locked / broken).
2. **One category = one view.** Never mix rods, bait and buildings in one list. A category with ≤ 9 items fits on one screen **without scrolling**. If one ever has more, split it into sub-categories, don't scroll.
3. **Tabs never scroll.** At most 6 tabs in a row, icon + short word (one word), equal width, all visible at 320 px. More categories → a two-level structure (a section picks a stall, the stall has its own ≤ 6 tabs).
4. **Details go in a bottom drawer**, not a new page: tap a tile → a drawer slides up over the bottom ~45% with the big art or turning 3D model, the stats as before → after, and one primary action. The grid stays visible above it.
5. **Screens are places, not sheets.** The painted backdrop (F) fills the screen edge to edge; the UI sits on objects in it (hooks, shelves, a scale, a board, a chart). No dashed parchment frame around everything.
6. **Small title.** One line, ≤ 22 px high, inside the place (a carved sign, a label on the basket rim), never a 40 px headline. Close is a small round brass button in the top corner, always in the same spot (top-right, safe area), plus back gesture / tap outside.
7. **Thumb zone.** The primary action of every screen sits in the bottom third. Nothing important in the top-left corner.
8. **Text diet.** No paragraphs in menus. Lore lives in the detail drawer, max 1 line. Requirements are icons + numbers ("🪙 1,500 · 5 species"), drawn as painted icons, not sentences.
9. **Readable at arm's length:** body ≥ 14 px, numbers ≥ 16 px tabular, contrast ≥ 4.5:1 on the painted backdrop (use a soft plate behind text where the painting is busy).

## 2. Layout per screen (390×844 portrait)

### Shop (at the counter) — sections, then stalls
```
┌───────────────────────────────┐
│ [carved sign: Hullhouse]  (×) │  small, inside the painting
│  shopkeeper ░░ wall with hooks│
│ ┌─────┬─────┬─────┬─────┬────┐│  section tabs, never scroll:
│ │Sell │Gear │Tackle│Bait │Build││  icon + one word
│ └─────┴─────┴─────┴─────┴────┘│
│ ┌──sub-tabs (only in Gear/Tackle)┐
│ │ Rods │ Reels │ Lines │        │  ≤ 6, icons
│ ┌────┐ ┌────┐ ┌────┐           │
│ │art │ │art │ │art │           │  3-up tile grid
│ │name│ │name│ │name│           │  all items of the
│ │ 🪙 │ │ ✓  │ │ 🔒 │           │  category visible
│ └────┘ └────┘ └────┘           │
│ ┌────┐ ┌────┐ ┌────┐           │
│ └────┘ └────┘ └────┘           │
│ [repair / re-spool plate]      │  only when relevant
└───────────────────────────────┘
tap tile → drawer: 3D model turning · stats before→after · [Buy 🪙 450] / [Equip]
```
- **Sell**: the fish on the counter as a 3- or 4-up grid of fish tiles (rest pose, weight, price), the brass scale with **Sell all 🪙 7,300** big at the bottom. Tap a fish → drawer with Sell / Keep.
- **Gear**: sub-tabs Rods · Reels · Lines.
- **Tackle**: sub-tabs Hooks · Sinkers · Floats · Leaders · Lures.
- **Bait**: one grid; stacks show "×12"; buy ×5 / ×20 in the drawer.
- **Build**: sub-tabs Buildings · Land · Piers · Boats → tiles with the painted building card; tap → drawer with the 3D model, level path l1→l2→l3, cost, **Place it** (starts A's placement mode).
- **Tools** (net, gaff, glasses, tackle box, bait bucket) live in Tackle as a sixth sub-tab or in Gear, whichever keeps ≤ 6.

### Cooler (looking into the basket)
```
┌───────────────────────────────┐
│ [label on rim: Wicker basket 3/8] (×)
│   ╭─────── basket ───────╮    │
│   │ fish  fish  fish fish│    │  fish lie in the basket as a
│   │ fish  ...            │    │  4-up grid of rest-pose cut-outs,
│   │ empty slots = woven  │    │  empty slots shown as weave/ice
│   ╰──────────────────────╯    │
│  [Sell all 🪙 7,300] on a brass tally plate │ bottom third
└───────────────────────────────┘
tap fish → drawer: hero pose · weight · size · value · [Sell 🪙 900] [Release]
```

### Logbook (journal)
```
island picker: a row of ≤ 8 small painted island stamps (no scroll; locked = grey)
page: the island's header painting (thin strip) + 3-up grid of fish portraits
      (caught = sketch portrait + ✓ variants dots; not caught = ink silhouette)
tap → drawer: portrait, lore line, heaviest, variants caught as 12 small emblems
```

### Sea chart
The painted chart fills the screen; islands are pins on it (unlocked glow, locked padlock). Tap a pin → drawer: island card art, one line, requirements as icon+number, **Sail there**. No list.

### Settings (captain's drawer)
A small drawer, not full screen: 4–5 compartments as tiles (Sound, Graphics, Language later, Save, Test tools in test mode only). No paragraph text.

### Catch reveal
Keep the current direction (it works): light rays, hero pose, weight tag, Keep = basket, Sell = scale. Smaller title, one line of lore max.

## 3. Tiles and drawer — one shared component kit
- `Tile` (art, name, value, state), `TileGrid` (3/4-up, no scroll for ≤ 9), `Tabs` (≤ 6, icon+word, equal width), `Drawer` (bottom sheet, swipe down to close), `Plate` (brass/wood plate for primary actions), `Sign` (small carved title).
- Every screen is built from these. Same sizes, same spots, so the player learns them once.

## 4. Check before shipping a screen
Screenshot at 390×844 and 320×568 with real data and ask:
- Can I see every item of this category without scrolling?
- Do the tabs fit without scrolling at 320 px?
- Is the primary action in the bottom third?
- Is there any paragraph or any dashed parchment sheet left? (Remove it.)
- Is it a place from this world, or a form? (Make it a place.)
