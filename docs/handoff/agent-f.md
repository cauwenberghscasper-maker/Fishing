# Agent F — Illustrations (handoff, live)

_Updated after every step. Status: IN PROGRESS (started 6 Nov 21:28 Brussels)._

## Plan / progress
1. [x] Style template `art/illustration-template.md` (v1.1, tested on 2 gear items on the paper mock)
2. [x] Gear cards, all 21 (`gear.<slot>.<itemId>`) → `public/art/gear/<slot>_<itemId>.webp`, 512², transparent. Contact sheet: `docs/handoff/shots/agent-f-gear.png`
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

## Gear: known flaws (each item had at most one redo)
- `bait.sandworms`: the worms have small eyes and mouths (Qwen-Image-Fast can't paint faceless worms; both takes had faces). G: model them eyeless, three lugworms on one hook twisting three ways.
- `bait.tar_leech`: one sucker disc reads like an eyeball and it has short pink legs. G: model a smooth ringed leech with plain sucker discs at both ends, no legs; keep the tar drips and the stuck barnacle.
- `reel.marigold_ratchet`: the barnacle cones under the wheel have dark openings that read a little like eyes. G: plain grey cones.
- `reel.sextant_reel`: faint numeral-like marks on the arc. G: plain tick marks, no numbers.
- `bait.glass_shrimp`: the inner organ looks like a tiny swallowed fish (kept: it fits "like the things that eat them").
- `line.tarred_hemp` keeps a chunk of pier plank under the post (the story is "the dock").
- If quota is left over at the end, sandworms and tar leech are the first candidates for a Qwen-Image (full, with a negative prompt) repaint.

## Notes for Agent G, per item (what the painting shows)
- Rods (all bare, no reel/line): splitcane = hex bamboo, mismatched wraps, cork grip, twine splint; driftwood_whip = twisted grey branch, side-twig stub, red core, seed pod, tarred-cord grip; greenheart = green-black shaft, brass fittings, red wraps, anchor end cap + leather lending tag with wax seal; whalebone_arc = bow-curved bone rib, scrimshaw whale, finger holes, plaited grip; tidecaster = mahogany, verdigris bronze ferrules, bell-mouth end cap with clapper + a second small bell; lighthouse_spar = red/white banded spar, brass fittings, glowing prism end cap + hanging prism lens.
- Reels: click_reel = rusty red/black centre-pin, two wooden knobs; tinker_winch = open pocket-watch case, gears behind cracked glass, copper patches, chain, bone knob; marigold_ratchet = orange toothed ratchet wheel, flower plate, rope knot; lantern_drum = drum with glowing round window, iron spokes, carry ring, horn vent; sextant_reel = brass sextant arc + mirror arm, gear train, two ebony knobs.
- Baits: breadcrust (+ feather, hook), sandworms (3 on one hook), glass_shrimp (glowing gut line), tar_leech, dusk_krill (5 on one hook, violet/amber glow).
