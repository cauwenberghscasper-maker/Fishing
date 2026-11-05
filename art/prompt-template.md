# Fish concept prompt template (house style)

Owner: Agent C. Used with Qwen-Image (`mcp-tools/Qwen-Image`, tool `Qwen_Image_generate_image`, 16 steps default).
Reference: `art/concepts/reference/house-style.png` (Casper's rare fish sheet: sleek stylized 3D creatures, polished iridescent scales, crisp silhouettes, bioluminescent accents, dark teal background).

## Rules this template enforces
- One fish, side view, full body, perfectly straight (no curl), head to the right, centred, plain dark teal background (clean cut-out for background removal and TRELLIS.2).
- Element + ONE signature feature that reads from above (described as sitting on the back / top), strict 3-colour palette **mapped to body parts**, a personality.
- Grounded anatomy ("realistic <species> anatomy") so the model does not drift into toy/cartoon proportions.
- Small realistic dark eye. No googly or cartoon eyes, no random glowing dots, no limbs, no props unless they are the signature.
- Bioluminescent accents only when the design names them (`{glow}`); otherwise the line says "no glow".

## Template v2 (side view: fusiform / eel / bulky / flat fish)

```
A single {name}, an elegant stylized fantasy fish for a premium 3D mobile fishing game, {element} element.
Strict side view profile, full body visible, perfectly straight horizontal body, head pointing right, tail to the left, centered with empty space around it.
Realistic {species} anatomy, {body}.
{material}.
Signature feature: {signature}, clearly visible along its back and top.
Strict three-colour palette: {c1} {part1}, {c2} {part2}, {c3} {part3}.
{glow}
Personality: {personality}, shown through posture and fin shape, small realistic dark eye.
Sleek stylized 3D game creature render, polished glossy lacquered finish with a subtle iridescent sheen, crisp clean silhouette, hand-crafted collectible look, soft rim light, gentle top light.
Plain dark teal studio background, no other objects.
```

Aspect ratio: `16:9` for long fish (sardine, perch, goby, bass, eel, marlin); `4:3` for puffer and flounder; `1:1` for manta and jelly.

## Top three-quarter variant (ray / jelly favourites)
Replace the "Strict side view" line with:
```
Seen from a high three-quarter top view, full body visible, symmetrical, centered with empty space around it.
```

## Negative prompt (always)
```
text, watermark, logo, blurry, low resolution, googly eyes, big cartoon eyes, cute chibi, toy, arms, hands, legs, multiple creatures, school of fish, cluttered background, bubbles, seabed, coral, plants, photorealistic photo, curled body, bent body, cropped, random glowing dots, sparkles
```

## Glow line values
- No glow: `No glowing parts, no bioluminescence.`
- With glow: `Subtle bioluminescent accent only on {where}, nowhere else.`

## Changelog
- v1 (test on driftwood_perch, seed 1537272886): good silhouette and nail, but cartoon eye with a big highlight, wood and scales mixed at random, generic "toy" feel. Kept in `.cache/agent-c/concepts/driftwood_perch_v1.webp` only.
- v2 (driftwood_perch, seed 1237474659, kept): added "realistic <species> anatomy", "small realistic dark eye", "toy" in the negative, palette mapped to body parts, glossy lacquered finish with iridescent sheen. Result reads as a real perch made of driftwood, nail on the dorsal fin, teal perch bands. Much closer to the reference.
