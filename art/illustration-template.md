# Illustration template (Agent F, v1)

Owner: Agent F. Applies to every 2D painting the UI shows: gear cards, island cards, building cards, variant emblems, title and loading art. Registry: `public/data/art.json` (key scheme in `docs/INTERFACES.md`).
Quality bar: the world key art `art/concepts/world/driftwood_cove_key.webp` + `driftwood_cove_shop_detail.webp` (painted style B) and the approved fish `art/concepts/fish/temple_manta.webp` / `storm_marlin.webp` (dark rich base, glow only on the signature part). The UI it sits on: chart paper, ink teal, brass, driftwood, Chartroom type (`docs/handoff/shots/type-specimen.png`).

## The house look, in one paragraph
Hand-painted adventure illustration: visible brushwork, warm golden low-sun key light from the upper left, cool teal bounce from below, rich saturated colour with a dark, rich base. Everything is **used and specific**: salt crust, thumb-polish, re-wound wraps, mismatched repairs, verdigris, chipped paint. Glow only where the story puts it (the lantern window, the dusk krill, the lighthouse glass), never sprinkled. No text, letters or numbers anywhere in the image (the UI sets every word in Chartroom).

## The anti-generic test, applied to illustrations (master prompt 5.0)
Before keeping an image, ask:
1. **Could "<item> fantasy game icon" in any generator give this?** If yes, redo. A rod must be *Grandpa's* rod (the repairs, the tally scratches), not "a fishing rod".
2. **Is the story in the object's material?** The Tinker Winch's side plate *is* a pocket-watch case; the Tidecaster's ferrules *are* bell bronze. Not an object with a sticker on it.
3. **One object, readable at card size.** At 120 px wide the silhouette still tells it apart from its neighbours in the same slot.
4. **Buildable** (gear and buildings feed Agents G and D): every part visible, no part hidden behind another, ends of the object inside the frame, plain background.
5. **No stock-icon look:** no glossy bevel, no white outline, no radial burst behind the object, no plastic sheen, no floating sparkles.

## Templates

### Gear card (rods, reels, lines, baits) — `mcp-tools/Qwen-Image-Fast`, 1:1, cut out with rembg
```
{Name}, a {kind} for a hand-painted fishing adventure game. A single prop painting.
The object: {materials and parts, described as what it IS made of}.
Story in the object: {the flavour line turned into a visible detail}.
Composition: one object only, {orientation}, three-quarter view, the whole object inside the frame with empty margin all around, every part clearly visible and readable.
Style: hand-painted digital painting with visible brush strokes, warm golden late-afternoon light from the upper left, soft teal bounce light from below, rich deep colours, weathered and well-used, crisp silhouette.
Background: a plain, flat, even dark teal colour with no shadows, no reflections and no surface.
No text, no letters, no numbers, no signature anywhere.
```
- Rods: `the rod alone with an empty reel seat, no reel and no fishing line, laid diagonally from the lower left (the handle, closest and largest) to the upper right (the thin tip), seen slightly from above`. (v1 test: without "no reel" Fast adds a reel, which belongs to another slot.)
- Reels: `seen from the front-left at three-quarter angle so the side plate, crank handle and mounting foot all show`.
- Lines: `wound on its winder/spool, a short loose end trailing`.
- Baits: `threaded on one small hand-forged bronze hook, seen at three-quarter angle, filling the middle of the frame`.
- Output: `public/art/gear/<slot>_<itemId>.webp`, 512×512, transparent (rembg IS-Net cut-out). The raw 1:1 render is kept in `.cache/agent-f/raw/` as Agent G's build reference.

### Island key art (`mcp-tools/Qwen-Image`, 3:4) and island card
```
Key art of {Island}, an island in a hand-painted fishing adventure game, seen from the game camera: angled top-down view at about 55 degrees, looking down at a small island and the water around it.
{The island's landmarks from master prompt 4.5 + islands.json feel, hazard and legendary hint}.
Palette: {islands.json palette}, with the sea going from bright shallows to deep dark teal so glowing fish shadows read.
Light: {island weather/time}.
Style: hand-painted adventure game key art, visible brushwork, rich colour, crisp readable shapes, same painterly look as a premium hand-painted adventure game.
No text, no letters, no UI, no people.
```
- Saved full size as `art/concepts/world/<island>_key.webp` (the build reference), then centre-cropped to 768×512 for `public/art/islands/<island>.webp` (sea-chart card, `island.<id>`, `concept` = the key art). Driftwood Cove's card is a crop of Agent D's existing key art (no GPU).

### Building card — `mcp-tools/Qwen-Image-Fast`, 4:3
```
{Building name}, level {n} of the {building} on Driftwood Cove in a hand-painted fishing adventure game, seen from the game camera (angled top-down, about 55 degrees), standing alone on a small patch of warm sand at the water's edge.
{What it is at this level, how it grew from the level before, who built it, what was patched, what washed up against it}.
Composition: the whole building centred, complete, every side and the roof readable, nothing in front of it.
Style: hand-painted, visible brushwork, warm golden light, rich colours, weathered driftwood and sun-faded paint.
No text, no letters, no signs with writing, no people.
```
- Output 768×576, `public/art/buildings/<id>_l<n>.webp`. Each level keeps the previous level's core visible inside the bigger build so the upgrade reads.

### Variant emblem — `mcp-tools/Qwen-Image-Fast`, 1:1, cut out
```
A round brass-rimmed medallion emblem for the {Variant} variant in a hand-painted fishing game: a thick worn brass ring with rivets, inside it {the element as one bold painted motif} on a {dark base} ground.
One strong simple motif filling the medallion, readable when tiny. Painted, warm brass, rich colour, glow only on the motif.
Front view, centred, plain flat dark background around the medallion. No text, no letters, no numbers.
```
- Output 256×256 (`path`) and 128×128 (`icon`), transparent, `public/art/variants/<id>.webp` / `<id>_128.webp`.

### Title and loading — `mcp-tools/Qwen-Image`, 9:16
- `title.main`: the hero moment (an elemental fish erupting from the sea beside the cove at dusk); the upper third kept as calm sky for the logo.
- `title.loading`: a quiet moment that reads behind a progress bar; the lower quarter kept calm.
- Output 1080 wide max, `public/art/title/<name>.webp`.

## Negative prompt (Qwen-Image only; Fast has none, so the prompt carries the "no" lines)
```
text, letters, numbers, words, signage, watermark, logo, signature, UI, icon border, white outline, glossy bevel, radial burst, sparkles, plastic, 3D render, photo, low resolution, blurry, multiple objects, cluttered background, people, hands, cute face
```

## Changelog
- v1 (6 Nov): first version, tested on Harbourmaster's Greenheart and Tinker's Brass Winch with Qwen-Image-Fast (1:1, 8 steps, ~12 s wall clock each). Both passed the anti-generic test on the paper mock (`.cache/agent-f/sheets/test1.png`): the story details (lending tag + wax seal, pocket-watch case + copper grudge patch) carry the item. Fast adds a fake painter's signature bottom right and a floor shadow; the rembg cut-out removes both, so they are harmless for cut-out art.
- v1.1 (6 Nov): rods explicitly "no reel, no line" (the test rod came with a reel); background line made stricter. Tinker's Brass Winch test kept as final.
