# Fish concept prompt template (house style, v3, round 2)

Owner: Agent C. Tool: Qwen-Image (`mcp-tools/Qwen-Image`, `Qwen_Image_generate_image`, default 16 steps).
Quality bar: `art/concepts/fish/temple_manta.webp` and `art/concepts/fish/storm_marlin.webp` (approved by Casper). Older style reference: `art/concepts/reference/house-style.png`.

## The rules the prompt must carry (master prompt 5.0 / 5.2)
1. **The element is the anatomy.** Describe body, skin and fins *as* the idea ("its dorsal fin is a torn storm sail"), never "a fish with X on it". If a sentence can be read as "fish + object", rewrite it.
2. **Silhouette test.** Name the outline shape in the prompt (cross, disc, star, beaded chain, coil...). Filled black, it must differ from every other fish.
3. **Element + one signature (reads from above) + strict 3-colour palette.** The palette is mapped to body parts, with the **dark, rich base** named first.
4. **Glow only on the signature part**, or "no glow anywhere".
5. **No face acting:** small realistic eye (or glowing slit), mouth closed, no expression. The negative prompt bans cute, lips, smile, big pupils, pastel and plastic-toy gloss.
6. **One-line story** goes into the prompt as a demeanour, because it changes posture and fin shape.
7. Straight side view, head right, plain dark teal background (needed for cut-out and for the Blender build). Flat fish (flounder) use a high top view, because their identity is the top.

## Template

```
{Name}, a {tier} {element}-element creature for a premium stylized 3D fishing game, creature concept render.
Strict side view profile, full body visible, perfectly straight horizontal body, head pointing right, tail to the left, centered with empty space around it. Silhouette: {outline}.
Anatomy: {the body/skin/fins described AS the element idea}.
Signature, readable from above: {signature part}.
Strict three-colour palette: {dark base colour} base on {part}, {colour 2} on {part}, {colour 3} on {part}. Dark rich base, not pastel.
{GLOW}
Story: {one-line story}; it looks {demeanour}.
Face: small realistic {eye} eye, mouth closed, no expression.
Sleek stylized 3D game creature render in the style of premium collectible game art, crisp clean silhouette, polished iridescent surfaces where it fits, soft rim light, gentle top light.
Plain dark teal studio background, no other objects.
```

- `{GLOW}` = `Bioluminescent glow only on {part}, nowhere else.` or `No glow anywhere.`
- Flat fish: replace the view line with `Seen from a high top view, the flat body lying horizontal, head pointing right, centered with empty space around it.`
- Aspect: `16:9` long fish and eels, `4:3` puffer and blenny, `1:1` flounder.

## Negative prompt (base; add per-fish bans)
```
cute, kawaii, chibi, cartoon face, smile, lips, open mouth, big eyes, large pupils, googly eyes, eyebrows, facial expression, pastel colours, plastic toy, vinyl figure, accessories, hat, text, letters, watermark, logo, blurry, low resolution, arms, hands, legs, multiple creatures, school of fish, cluttered background, bubbles, seabed, photorealistic photo, curled body, bent body, cropped, random glowing dots, sparkles
```
(Old Mooring removes `open mouth` only if a take needs the hooked jaw visible; kelp_wraith never bans "kelp", only "kelp forest background".)

## Anti-generic check before keeping a take
Put it next to the manta and the marlin:
- Is the idea *in* the body, or stuck on it?
- Dark base + one glow zone, or pastel all over?
- Eye small, mouth shut, no "character" face?
- Filled black, does it read as this fish and not "a fish"?
- Could "<name> fantasy fish" in any generator give the same thing? If yes, redo.

## Changelog
- v1/v2 (5 Nov, round 1): normal fish + object; rejected by Casper except the manta and marlin, whose prompts already described the element as anatomy. v3 makes that the rule.
- v3 (6 Nov): anatomy-first wording, silhouette line, dark-base palette, face line, story line, stronger negative prompt.
