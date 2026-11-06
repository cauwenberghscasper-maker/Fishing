# Agent B — Economy, UI & Save: handoff (work in progress)

_Updated after each step. Status at the top._

## Status
- [x] Fonts self-hosted in `public/fonts/` (+ `fonts.css`, OFL licences)
- [x] `src/ui/theme.css` — the contract for Agent A (variables + `.btn`, `.btn--primary`, `.btn--round`, `.meter`, `.meter__fill`, `.meter--tension`, `.meter--stamina`, `.toast`)
- [x] `docs/type-specimen.html` + `docs/handoff/shots/type-specimen.png` (sent to lead)
- [x] Data files (`fish.json`, `islands.json`, `items.json`, `economy.json`)
- [x] Save (`src/save/profile.js`)
- [x] Economy (`src/economy/`)
- [x] UI screens (`src/ui/`): code written, `npm run build` passes; visual check next
- [ ] Verification + screenshots

## For Agent A (theme contract)
- Import nothing: `src/ui/app.js` imports `theme.css` and injects `fonts/fonts.css` at `startUI`, which runs before `startWorld`.
- Meters: set the fill with `fill.style.width = '62%'` **or** `meter.style.setProperty('--value', 0.62)`. Add class `is-danger` (or `data-state="danger"`) on `.meter--tension` near the snap point; it turns red and throbs.
- `.btn--round` is 52 px (set `--size` to change). Put an inline `<svg>` with `stroke="currentColor"` inside; it glows.
- Keep the bottom-centre strip (about 64 px above the safe area) free: Agent B's context action button (Shop, Travel, Build…) sits there.
