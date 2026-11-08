# Hugging Face ZeroGPU quota ledger

Daily quota ~25 min GPU, resets ~22:45 Brussels. Agent C budget ~18 min, Agent D max 5 min.

| Time (Brussels) | Agent | Tool | What | Est. GPU s |
|---|---|---|---|---|
| 23:05 | C | Qwen-Image | driftwood_perch concept (template test v1) | ~20 |
| 23:06 | C | Qwen-Image | driftwood_perch concept (template v2, kept) | ~20 |
| 23:07 | C | Qwen-Image | sunscale_sardine concept v1 (kept) | ~20 |
| 23:07 | C | Qwen-Image | chartfish concept v1 | ~20 |
| 23:07 | C | Qwen-Image | tidepool_goby concept v1 | ~20 |
| 23:08 | C | Qwen-Image | chartfish concept v2 (kept; v1 had letters + plus sign) | ~20 |
| 23:08 | C | Qwen-Image | tidepool_goby concept v2 (kept; v1 wore a literal hat) | ~20 |
| 23:08 | C | Qwen-Image | kelp_ribbon concept v1 (kept) | ~20 |
| 23:09 | C | Qwen-Image | seaglass_puffer concept v1 | ~20 |
| 23:09 | C | Qwen-Image | bellbuoy_bass concept v1 (kept) | ~20 |
| 23:10 | C | Qwen-Image | seaglass_puffer concept v2 (kept; v1 eye too big, no amber) | ~20 |
| 23:10 | C | Qwen-Image | storm_marlin concept v1 | ~20 |
| 23:11 | C | Qwen-Image | storm_marlin concept v2 (kept; v1 had canvas sail + body zigzag) | ~20 |
| 23:12 | C | Qwen-Image | temple_manta concept v1 (kept) | ~20 |
| 23:12 | C | Qwen-Image | cathedral_jelly concept v1 (kept) | ~20 |
| 23:12 | C | TRELLIS.2 preprocess | driftwood_perch cut-out | ~5 |
| 23:13 | C | TRELLIS.2 generate_3d | driftwood_perch 3D (res 1024, 50k faces, tex 1024, seed 42) - output only as hf.space URL, not usable from sandbox; 3D step stopped | ~90 |
| 23:17 | C | (none) | background removal done locally with rembg (not-lain/background-removal returned 'Not Found' twice) | 0 |

**Agent C total (estimate): 15 Qwen-Image runs x ~20 s + TRELLIS preprocess ~5 s + 1 TRELLIS generate_3d ~90 s = ~6.6 min of ~18 min budget.** Estimates only: the tools do not report actual GPU seconds.

### Agent D (world) — 6 Nov
| Time (Brussels) | Agent | Tool | What | Est. GPU s |
|---|---|---|---|---|
| 11:18 | D | Qwen-Image | Driftwood Cove key art take 1, 9:16, seed 1357887856 (kept as `art/concepts/world/driftwood_cove_shop_detail.webp`: shop reference) | ~20 |
| 11:19 | D | Qwen-Image | Driftwood Cove key art take 2, 3:4, seed 1214929966 (kept as `art/concepts/world/driftwood_cove_key.webp`) | ~20 |

**Agent D total today (estimate): 2 Qwen-Image runs ≈ 40 s of the 4 min budget.**
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take A (kept) | ~20 |
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take B (kept) | ~20 |
| 6 Nov 11:21 | C | Qwen-Image | glasswing_sardine take C r1 (rejected: arrow through mouth) | ~20 |
| 6 Nov 11:22 | C | Qwen-Image | glasswing_sardine take C r2 (kept, weakest) | ~20 |
| 6 Nov 11:23 | C | Qwen-Image | driftback takes A, B, C | ~60 |
| 6 Nov 11:25 | C | Qwen-Image | compass_flounder takes A, B, C r1 (B kept; A smile, C badge rejected) | ~60 |
| 6 Nov 11:26 | C | Qwen-Image | compass_flounder A r2, C r2 (kept with flaws noted) | ~40 |
| 6 Nov 11:28 | C | Qwen-Image | shellback_blenny A, B, C r1 (all fail: toy gloss, lips, hook in mouth) | ~48 (16 s each, wall-clock upper bound from here on) |
| 6 Nov 11:28 | C | Qwen-Image | shellback_blenny A r2 (kept) | ~16 |
| 6 Nov 11:29 | C | Qwen-Image | shellback_blenny B r2, C r2 (kept) | ~32 |
| 6 Nov 11:31 | C | Qwen-Image | kelp_wraith A, B, C r1 (A kept; B necklace, C cloth hood rejected) | ~48 |
| 6 Nov 11:32 | C | Qwen-Image | kelp_wraith B r2, C r2 (kept, flaws noted) | ~32 |
| 6 Nov 11:34 | C | Qwen-Image | seaglass_puffer A, B, C r1 (all lips; C fake signature text) | ~48 |
| 6 Nov 11:35 | C | Qwen-Image | seaglass_puffer A, B, C r2 (kept; faces still fail: teeth/lips) | ~48 |
| 6 Nov 11:37 | C | Qwen-Image | old_mooring A, B, C r1 (all fail: rope tied round neck, prompt text leaked, teeth) | ~48 |
| 6 Nov 11:38 | C | Qwen-Image | old_mooring A, B, C r2 (kept; still teeth/collar, needs another pass) | ~48 |
| 6 Nov 11:42 | C | Qwen-Image-Edit-Angles | storm_marlin top view (failed: 'Error!', input URL from 5 Nov likely expired) | ~5 |
| 6 Nov 11:42 | C | Qwen-Image | storm_marlin top-down render (unusable: model drew a side view again); top-view attempts stopped | ~16 |

### Agent G (gear & boats) — 6 Nov (budget until the 22:45 reset: 3 min)
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock incl. queue, upper bound) |
|---|---|---|---|---|
| 21:29 | G | Qwen-Image | rowboat concept, 4:3, seed 1380675061 (kept: oar mast with shirt sail, tin patch, blue plank) | 25 |
| 21:30 | G | Qwen-Image | patched_skiff concept, 4:3, seed 1333915167 (kept: blue ship's door on a crate wheelhouse, stovepipe; hole left open in the art, the model patches it) | 25 |
| 21:30 | G | Qwen-Image | sail_sloop concept, 4:3, seed 153471756 (kept: patched sail, arched cabin roof, brass porthole) | 25 |
| 21:31 | G | Qwen-Image | storm_cutter concept, 4:3, seed 2120398157 (kept: tarred hull, copper rods + verdigris, storm sails with glowing scorch veins; the stray fern on the jib is not modelled) | 25 |

**Agent G total before reset: 4 runs ≈ 100 s of the 180 s budget.**

### Agent F (illustrations) — 6 Nov, before the 22:45 reset (budget 3 min)
Wall-clock measured with timestamps around each call; Qwen-Image-Fast (8 steps) runs ~4–6 s per call when called back to back, so the GPU share is lower than these numbers.
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound) |
|---|---|---|---|---|
| 21:31 | F | Qwen-Image-Fast | template test 1: rod greenheart, 1:1, seed 4101 (rejected: came with a reel) | 12 |
| 21:31 | F | Qwen-Image-Fast | template test 2: reel tinker_winch, 1:1, seed 4102 (kept, final) | 12 |
| 21:33 | F | Qwen-Image-Fast | 6 rods v1, seeds 4201–4206 (all rejected: Fast ignores "no reel", every rod got a reel + line) | 33 (6 calls) |
| 21:34 | F | Qwen-Image-Fast | rod splitcane v2, reel-free wording, seed 4301 (kept) | 5 |
| 21:35 | F | Qwen-Image-Fast | rods driftwood_whip, greenheart, whalebone_arc, tidecaster, lighthouse_spar v2, seeds 4302–4306 (all kept) | 25 (5 calls) |

**Agent F total before reset: 14 Fast calls ≈ 87 s wall-clock (upper bound) of the 180 s budget.**

### Agent F (illustrations) — quota day from the 22:45 reset (budget 7 min = 420 s)
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound) |
|---|---|---|---|---|
| 6 Nov 23:10 | C | Qwen-Image | old_mooring r3 #1 (tail frays into hemp broom; binding band + rivets; kept as alternative in .cache) | 25 (measured wall) |
| 6 Nov 23:11 | C | Qwen-Image | old_mooring r3 #2 (kept: tail, anal and rear dorsal are frayed hemp, closed mouth, no collar, no text) → art/concepts/fish/old_mooring.webp | 16 (measured wall) |

### Agent E (VFX) — 6 Nov after the reset (budget 5 min). Qwen-Image-Fast measured 4.1 s wall-clock per call (incl. network) on the first call.
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound) |
|---|---|---|---|---|
| 23:10 | E | Qwen-Image-Fast | ov_storm lightning veins, 1:1, seed 1026350579 (kept) | 4.1 |
| 23:11 | E | Qwen-Image-Fast | ov_frost frost ferns, seed 1080126647 (kept) | ~5 |
| 23:11 | E | Qwen-Image-Fast | ov_ember molten cracks, seed 540948197 (kept, corner squiggle cropped) | ~5 |
| 23:11 | E | Qwen-Image-Fast | ov_bloom moss + blossoms, seed 1327665935 (kept) | ~5 |
| 23:11 | E | Qwen-Image-Fast | ov_rune glyph diamonds, seed 226330997 (kept, stone border cropped off) | ~5 |
| 23:11 | E | Qwen-Image-Fast | ov_abyss r1, seed 2105944050 (rejected: jellyfish wallpaper, not ink) | ~5 |
| 23:11 | E | Qwen-Image-Fast | ov_tide foam swirls, seed 1615269290 (kept, lace border cropped off) | ~5 |
| 23:12 | E | Qwen-Image-Fast | ov_abyss r2 ink smoke, seed 135192334 (kept; cropped to the ink, three small jellyfish cut out) | ~4 |
| 23:12 | E | Qwen-Image-Fast | ov_rust chain-link scales, seed 631845911 (kept; anchor icon cropped out) | ~4 |
| 23:12 | E | Qwen-Image-Fast | ov_gilt gold leaf, seed 706702832 (kept) | ~4 |
| 23:12 | E | Qwen-Image-Fast | sprite spark, seed 1985022120 (kept; grunge frame cropped) | ~4 |
| 23:12 | E | Qwen-Image-Fast | sprite ember, seed 1696627362 (kept as a flame lick; coals cropped) | ~4 |
| 23:12 | E | Qwen-Image-Fast | sprite snow crystal, seed 1488150069 (kept) | ~4 |
| 6 Nov 23:13 | C | Qwen-Image-Edit-Angles | glasswing_sardine bird's-eye (tilt -1): output is a mirrored side view, not a top view → top views for side-profile fish dropped, back painted from concept colours instead | 12 (measured wall) |
| 6 Nov 23:14 | C | Qwen-Image | temple_manta top view (kept, seed 169155133, rotated head → +X) → art/concepts/fish/temple_manta_top.webp | 18 (measured wall) |
| 23:13 | E | Qwen-Image-Fast | sprite smoke, seed 1436702567 (kept) | ~4 |
| 23:13 | E | Qwen-Image-Fast | sprite petal, seed 483881582 (kept) | ~4 |
| 23:13 | E | Qwen-Image-Fast | sprite kelp leaf, seed 1121738927 (kept) | ~4 |
| 23:13 | E | Qwen-Image-Fast | sprite glyph sheet 2x2, seed 2002347507 (kept, sliced into glyph_a..d) | ~4 |
| 23:13 | E | Qwen-Image-Fast | sprite abyss eye, seed 1199825940 (kept; corner squiggle cropped) | ~4 |
| 23:13 | E | Qwen-Image-Fast | sprite foam splash, seed 1252743348 (kept; sea strip cropped) | ~4 |
| 6 Nov 23:15 | C | Qwen-Image | rivet_snapper concept (kept, seed 411904017; lips a bit thick, rivets on flank more than spine) | 16 (measured wall) |
| 23:14 | E | Qwen-Image-Fast | sprite metal sparks, seed 554256181 (kept; frame + rod cropped) | ~4 |
| 23:14 | E | Qwen-Image-Fast | sprite lava bomb, seed 2092538232 (kept) | ~4 |
| 23:14 | E | Qwen-Image-Fast | sprite ice shard, seed 876104653 (kept) | ~4 |
| 23:14 | E | Qwen-Image-Fast | sprite flare, seed 1153275784 (kept; frame cropped) | ~4 |
| 23:14 | E | Qwen-Image-Fast | rb_lightning bolt strip 9:16, seed 638409354 (kept; straightened per row) | ~4 |
| 23:14 | E | Qwen-Image-Fast | rb_vine strip 9:16, seed 1392030837 (kept) | ~4 |

### Agent D (world) — 6 Nov after the 22:45 reset (budget 2 min, then "use what remains" per the coordinator)
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound, measured) |
|---|---|---|---|---|
| 23:11 | D | Qwen-Image | sandbar + camp_l0 day one, 3:4, seed 1845003901 → `art/concepts/world/sandbar_day_one.webp` (concept of sandbar, camp_l0, pier_stub) | 23 |
| 23:11 | D | Qwen-Image | Palm Spit, seed 465431656 → `plot_palm_spit.webp` (plot_palm_spit, hammock, coconut_pile) | 16 |
| 23:12 | D | Qwen-Image | Wreck Beach (the Marigold), seed 619830783 → `plot_wreck_beach.webp` (plot_wreck_beach, fisher_hut, wreck_ribs) | 16 |
| 23:12 | D | Qwen-Image | Tide-pool Shelf, seed 1447000093 → `plot_tidepool_shelf.webp` (plot_tidepool_shelf, tide_pool_a) | 16 |
| 23:13 | D | Qwen-Image | Kelp Shallows, seed 628603662 → `plot_kelp_shallows.webp` (plot_kelp_shallows, kelp_a, crab_pot, net_rack) | 16 |
| 23:13 | D | Qwen-Image | Basalt Cliff + lantern cairn, seed 422225526 → `plot_basalt_cliff.webp` (plot_basalt_cliff, cairn_lantern, cliff_columns_a/b, columns_steps) | 16 |
| 23:14 | D | Qwen-Image | Old Mooring's Deep, seed 2093174824 → `plot_mooring_deep.webp` (plot_mooring_deep, mooring_dolphin) | 27 |
| 23:14 | D | Qwen-Image | worker line-up (Wim, Juno, Sef), 16:9, seed 1492899539 → `workers_lineup.webp` (worker_netmender, worker_deckhand, worker_angler) | 29 |
| 23:15 | D | Qwen-Image | player fisher, 3 poses, 16:9, seed 1842486621 → `fisher_player.webp` (fisher_player) | 16 |

**Agent D after the reset: 9 Qwen-Image calls ≈ 175 s wall-clock (upper bound; true GPU time is lower).** No quota error yet. Stopped because every further image would have had no model to feed (Casper's "everything gets used" rule). Building concepts come from Agent F's cards.

### Agent G (gear & boats) — quota day from the 22:45 reset (budget 5 min, then on Casper's word: keep going until the quota error)
Wall-clock per call measured from timestamps around each call (upper bound for GPU time).
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound) |
|---|---|---|---|---|
| 23:11 | G | Qwen-Image | rowboat side elevation, 16:9, seed 1028245812 → `art/concepts/boats/rowboat_side.webp` (sideView) | 31 |
| 23:12 | G | Qwen-Image | patched_skiff side elevation, 16:9, seed 1305129494 → `patched_skiff_side.webp` | 24 |
| 23:12 | G | Qwen-Image | sail_sloop side elevation, 16:9, seed 1643131062 → `sail_sloop_side.webp` (mast top cropped) | 31 |
| 23:13 | G | Qwen-Image | storm_cutter side elevation, 16:9, seed 1026374623 → `storm_cutter_side.webp` (stray cannon not modelled) | 30 |
| 23:14 | G | Qwen-Image | reel click_reel view, 1:1, seed 1575089667 → `art/concepts/gear/reel_click_reel.webp` | 30 |
| 23:14 | G | Qwen-Image | reel marigold_ratchet view, 1:1, seed 338259590 → `art/concepts/gear/reel_marigold_ratchet.webp` | 34 |
| 23:15 | G | Qwen-Image | reel lantern_drum view, 1:1, seed 1354093819 → `art/concepts/gear/reel_lantern_drum.webp` | 26 |
| 23:15 | G | Qwen-Image | reel sextant_reel view, 1:1, seed 196736892 → `art/concepts/gear/reel_sextant_reel.webp` | 33 |
| 23:16 | G | Qwen-Image | bait breadcrust view r1, seed 1872379263 (rejected: bread slice with an eye; archived `art/concepts/gear/_rejected/bait_breadcrust_r1.webp`) | 30 |
| 23:16 | G | Qwen-Image | bait breadcrust view r2, seed 1352641987 → `art/concepts/gear/bait_breadcrust.webp` (kept) | 25 |
| 23:17 | G | Qwen-Image | bait sandworms view r1, seed 1646565991 (rejected: faces with teeth; archived `_rejected/bait_sandworms_g_r1.webp`). Session cut off by the usage limit here (logged 8 Nov) | 30 |

**Agent G total, quota day from 6 Nov 22:45: 11 Qwen-Image runs ≈ 324 s wall-clock (upper bound).**
| 23:15 | E | Qwen-Image (full) | dc_rune_circle hero, 1:1, seed 1126855628 (kept: stone ring + glowing sigil band; centre knot is a known Celtic shape, the band glyphs lean futhark, acceptable for a water decal) | 26 (measured) |
| 23:10 | F | Qwen-Image-Fast | reels click_reel, marigold_ratchet, lantern_drum, sextant_reel, seeds 4401–4404 (click + lantern kept; marigold "barnacles" drew as ghost shapes, sextant arc had numerals) | 23 (4 calls) |
| 23:11 | F | Qwen-Image-Fast | redo marigold_ratchet (4502) + sextant_reel (4504), both kept with small flaws noted in the handoff | 12 (2 calls) |
| 23:12 | F | Qwen-Image-Fast | baits breadcrust, sandworms, glass_shrimp, tar_leech, dusk_krill (4601–4605) + lines cotton, tarred_hemp, gutstring, silkweed_braid, keepers_wire (4701–4705); kept: krill, sandworms, all 5 lines | 42 (10 calls) |
| 23:13 | F | Qwen-Image-Fast | redo breadcrust (4611, kept), sandworms (4612, rejected: still faces), glass_shrimp (4613, kept), tar_leech (4614, kept with flaw) | 25 (4 calls) |
| 6 Nov 23:16 | C | Qwen-Image | 3 parallel: keg_boxfish r1 (fail: fish wearing a barrel, lips, 'Signature' text), chainlink_pipefish r1 (fail: horse head with ears, smoking pipe, chain laid on body), porthole_ray (kept, seed 737461294) | 80 total (measured wall, 3 calls) |
| 23:16 | E | Qwen-Image-Fast | rb_chain 9:16, seed 1251878007 (kept; chain cropped above the anchor) | ~4 |
| 23:16 | E | Qwen-Image-Fast | dc_ring warning ring, seed 1854124777 (kept; grey frame cropped) | ~4 |
| 23:16 | E | Qwen-Image-Fast | dc_ice sea-ice sheet, seed 1729793985 (kept) | ~4 |
| 23:16 | E | Qwen-Image-Fast | tx_wave r1, seed 750135846 (rejected: grid lines + horizon) | ~4 |
| 23:16 | E | Qwen-Image-Fast | tx_beam light pillar 9:16, seed 465143084 (kept) | ~4 |
| 23:16 | E | Qwen-Image-Fast | tx_burst radial burst, seed 1556274774 (kept) | ~4 |

**Agent E running total at 23:16: 36 Fast (~4.2 s each ≈ 151 s) + 1 full Qwen-Image (26 s) ≈ 177 s of the 5 min.** The coordinator asked to keep going past 5 min until the quota error (Casper wants today's quota used).
| 23:17 | F | Qwen-Image | island key art ×7, 3:4, seeds 5101–5107 (wreck_reef, mossback_bayou, frostfang_fjord, ember_caldera, stormspire_isles, sunken_temple, the_abyss); wreck_reef has a fake UI coin counter painted in, sunken_temple drew a seal *animal* on the manta: both get one redo | 114 (7 calls, ~16 s each) |

**Agent F, quota day from 6 Nov 22:45: ~216 s logged (Fast ~102 s + Qwen-Image 114 s).**
| 6 Nov 23:18 | C | Qwen-Image | 3 parallel: keg_boxfish r2 (kept as weak concept: still reads as fish in a barrel, lips), chainlink_pipefish r2 (kept: links along body, coral fringes; chain still reads laid-on), cannon_gar r1 (fail: printed text, teeth, barrel bolted in front of mouth) | ~81 total (measured wall, 3 calls) |

### Agent E — 8 Nov (budget 150 s, Qwen-Image-Fast ~4 s each)
| Time (Brussels) | Agent | Tool | What | GPU s (wall-clock upper bound) |
|---|---|---|---|---|
| 6 Nov 23:17 | E | Qwen-Image-Fast | tx_wave r2 (kept, top sky strip cropped), impact_storm, impact_frost, impact_ember, impact_bloom, impact_rune (all kept) — logged late, made at the end of the 6 Nov session | ~25 |
| 8 Nov 14:45 | C | — | registered hero/rest/portrait slots for 9 fish (manifest ) before generating; budget 450 s | 0 |
| 8 Nov 14:47 | C | Qwen-Image | 3 heroes parallel: glasswing_sardine (kept, seed 1826341839, fishing line erased), driftback (kept, seed 2020121917), compass_flounder r1 (weak: needle reads as a dart, no coin flip) | 61 total (measured wall) |
| 8 Nov 14:41 | E | Qwen-Image-Fast | impact_abyss, seed 1979775937 (kept; a jellyfish in the centre masked out) | ~4 (20 s wall-clock, queue) |
| 8 Nov 14:41 | E | Qwen-Image-Fast | impact_tide splash crown from above, seed 2090758680 (kept) | ~4 (20 s wall) |
| 8 Nov 14:42 | E | Qwen-Image-Fast | impact_rust, seed 2030689579 (kept) | ~4 (20 s wall) |
| 8 Nov 14:42 | E | Qwen-Image-Fast | splash_crown side view, seed 2095431640 (kept; water strip cropped) | ~4 (20 s wall) |
| 8 Nov 14:43 | E | Qwen-Image-Fast | foam_ring, seed 1122456442 (kept; outer doily lace masked off) | ~4 (20 s wall) |
| 8 Nov 14:43 | E | Qwen-Image-Fast | spray_fan, seed 1140175299 (kept; water strip cropped) | ~4 (20 s wall) |
| 8 Nov 14:44 | E | Qwen-Image-Fast | backdrop.storm 9:16, seed 401785626 (kept; small painted fish at the bottom inpainted out locally) | ~4 |
| 8 Nov 14:44 | E | Qwen-Image-Fast | backdrop.frost 9:16, seed 233954903 (kept; small fish inpainted out) | ~4 |
| 8 Nov 14:44 | E | Qwen-Image-Fast | backdrop.ember r1, seed 1216421437 (rejected: cartoon fuse bombs + a fish) | ~4 |
| 8 Nov 14:45 | E | Qwen-Image-Fast | backdrop.bloom 9:16, seed 1245496282 (kept; frog inpainted out) | ~4 |
