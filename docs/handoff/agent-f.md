# Agent F — Illustrations (handoff, live)

_Updated after every step. Status: IN PROGRESS (started 6 Nov 21:28 Brussels)._

## Plan / progress
1. [x] Style template `art/illustration-template.md` (v1.1, tested on 2 gear items on the paper mock)
2. [ ] Gear cards, 21 items (`gear.<slot>.<itemId>`) — rods 6/6 painted, reels 1/5, lines 0/5, baits 0/5
3. [ ] Island key art + cards (8 painted + Driftwood Cove crop)
4. [ ] Building cards 6 × 3
5. [ ] Variant emblems 11
6. [ ] Title + loading

## Registry
`public/data/art.json`: all 60 keys registered up front (paths, `usedBy`, `licence`, `size`, `alpha`, `concept` for islands). Missing files are harmless in the live game: B's `artImg` removes the slot on a load error. `tools/check-art.mjs` lists them as MISSING until painted.

## Work files
`.cache/agent-f/raw/` (uncut renders: Agent G's build references), `.cache/agent-f/raw/_rejected/`, `.cache/agent-f/cut/`, `.cache/agent-f/scripts/` (`registry.py` rebuilds Agent F's art.json keys, `cut.py` rembg cut-out, `sheet_gear.py` contact sheet).

## Notes for Agent G
- Each gear card is cut out to transparency; the uncut 1024² render with the same name is in `.cache/agent-f/raw/<slot>_<itemId>.webp`.
- Rods are painted bare (no reel, no line): Qwen-Image-Fast kept adding a reel until the words "reel" and "line" were removed from the prompt.
