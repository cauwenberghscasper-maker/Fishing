# Agent A — Engine & Fishing (handoff, live)

_Updated after every milestone. Status: IN PROGRESS (priority 1 done, now variants/powers → island growth → co-op hooks)._

| Milestone | Status |
|---|---|
| fish-behaviour.json (7 M1 ids, `flat` + `shelled` bodies) | done |
| Core: loop (+slow-mo), input (joystick, tap-to-move, keys), asset loader (5 manifests), adaptive quality, synth audio | done |
| Render pipeline (depth pre-pass → water → bloom → ACES grade + vignette) | done |
| Water shader (depth colour, refraction, caustics, shore foam + wash lines, ripple rings) | done |
| Island terrain + Driftwood Cove layout with D's props, pier modules, kelp beds | done |
| Camera (follow, aim lean-in, fight zoom-out, timed shake) | done |
| Player (D's character + clips when it lands; walking, wading wakes, zones) | done (no character model yet) |
| Aim / cast (slingshot, arc, compass reticle, depth band, wobble, perfect ring) | done |
| Fish AI + silhouettes + swim shader | done |
| Bite / hook | done |
| Fight (tension, stamina, steering, snap, slack, 13 moves) | done |
| `state.render` contract + `shake` / `slowmo`, `fish:spawn/despawn/landed-show` | done |
| Variants (roll at spawn) + `powers.json` | roll done, powers.json written, fight mechanics in progress |
| Island growth (sandbar → plots), building levels, boats, gear models | pending |
| Co-op hooks for Agent H | pending |

## What the player sees (now)
- Golden-afternoon Driftwood Cove: golden sand with wind ripples and a wet band that follows the wash, olive grass on the cliff tops, basalt cliffs, D's piers/palms/rocks/kelp. Water runs from turquoise shallows with white wash lines into emerald, then dark teal deep water.
- Walk with a floating left-thumb joystick (brass compass bezel) or tap to move; WASD on desktop. You can wade into the shallows (wake ripples).
- **Cast**: hold the round Cast button, pull back (slingshot) and the world drops to 25 % speed. A dashed arc and a compass reticle land on the water. The reticle colour shows the depth band (Shallows / Mid-water / Deep water + metres + fish count), and fish inside it light up. The reticle wobbles less the longer your thumb holds still. A gold timing ring shrinks onto it; release while it overlaps for a **Perfect cast**. Release in the centre to cancel.
- Fish swim as soft dark silhouettes (one per species, drawn from the briefs: glass-winged sardine, branch-shaped driftback with a twig stub, compass disc, spiral-shelled blenny, kelp-leaf eel with amber bulbs, shard puffer, rope-barbelled catfish). Deeper fish are blurrier and fainter. Sardine schools skip over the surface. Kelp wraiths are faint until they move. Driftbacks lie still.
- Fish come by personality: shy, greedy, cautious, aggressive. They approach, circle, nibble (the line twitches, small ripple, tick) and then **bite** (splash, thunk sound, vibration, gold "!" ring that shrinks with the hook window). Tap the button or anywhere to hook. Too early and it flees.
- **Fight**: hold Reel (tension rises), release to let it run, drag sideways against the red arrow to steer. Meters use B's `.meter--tension` / `.meter--stamina`. Moves come from the data (`run, dive, leap` with "Bow!" at the peak, `zigzag, sulk, burst, thrash`) plus signatures: sardine `skip`, driftback `playdead → bolt`, flounder `hug`, blenny `shell`, puffer `inflate`. A first-time tip appears for each move. Sustained max tension snaps the line; too much slack lets it throw the hook.
- Catch: the fish is held up and turns, celebrate pose, `fish:caught`; B's catch card takes over.

## Contract notes for the lead / other agents
- `state.render = { THREE, scene, camera, renderer, clock, under, surface, onFrame(fn(dt,t)), shake(amp, seconds), slowmo(scale, seconds), heightAt, waterDepthAt, addRipple, splash, player, lure, rodTip }`. Objects in `under` are seen through the water (refracted, depth-tinted). Objects in `surface` draw over the water.
- `fish:spawn/despawn/landed-show.object` is an anchor `Group` that follows the fish (position, heading, depth). `userData = { uid, fishId, variant, length, body, hasModel, depth, inAir, fade }`. The fish model, when C ships one, is a child of it. Silhouette-only fish still get an anchor, so E can attach auras.
- Debug: `__game.world` (after `game:ready`) → `teleport(zoneId|x,z)`, `cast(x,z,perfect)`, `forceBite(id, variant)`, `hook()`, `reel(on, steer)`, `finishFight(status)`, `spawnFish(id,x,z,variant)`, `setTime(hour)`, `setQuality(name)`, `fish()`, `aimTo(x,y)`, `releaseAim()`, `timeScale(s)`. URL: `?quality=high|medium|low|lowest`, `?hour=21`, `?maxdt=0.25` (headless tests only).
- `?test=100` multiplies elemental variant chances ×30 so powers can be played.

## Needs from other agents
- **D**: player character + clips (I map idle/walk/run/castWind/cast/reel/struggle/celebrate/holdUp/dodge by name; an optional `clips: { action: clipName }` map in the manifest entry wins). Hand bone named like `handslot.r` / `hand_r`. Then `camp_l0`, `shop_l1..3`, `<building>_l<n>`, `plot_<plotId>`.
- **G**: `rod.<itemId>` with `grip` + `tip` nodes (loader bakes grip→tip onto +Y and bends it). The `lines` section is read for the rope colour once it lands.
- **C**: fish models replace silhouettes automatically (manifest `path` non-null). Facing +Z, length 1.
- **B**: `variants.json` (A uses a fallback mirroring the ids until then); plot ids in `economy.json` should become the master-prompt ids (`palm_spit`, …). B's file still has `gull_spit` etc.

## Screenshots
`docs/handoff/shots/agent-a-*.png` (added at the end of each milestone).
