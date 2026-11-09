// Strong-fish moves, referenced by id from fish-behaviour.json `moves`.
// pull: multiplier on the fish's pull; line: how fast it takes line; spike: instant tension;
// reelTension: tension multiplier while reeling; damage: stamina damage multiplier;
// air: leap/skip arc; bow: tap at the peak to bow the rod; hint: first-time tip for the player.
export const MOVES = {
  run: { dur: [1.4, 2.2], pull: 1.9, line: 2.2, swim: 'run', flipSide: true, hint: 'It runs! Ease off or steer against it' },
  dive: { dur: [1.0, 1.4], pull: 1.5, spike: 0.22, depth: 2.2, swim: 'dive', hint: 'Dive! Watch the tension' },
  leap: { dur: [1.1, 1.1], pull: 0.4, air: { height: 1.5, dur: 1.0, hops: 1 }, bow: true, spikeNoBow: 0.32, swim: 'leap', shake: 0.25, hint: 'Leap! Tap at the top to bow the rod' },
  zigzag: { dur: [2.0, 2.8], pull: 1.2, flipEvery: 0.55, steerBonus: 1.6, swim: 'run', hint: 'Zig-zag: steer against each turn' },
  sulk: { dur: [2.0, 3.0], pull: 0.9, reelTension: 1.5, damage: 0.3, depth: 'bottom', swim: 'tired', hint: 'Sulking on the bottom: pump, don\'t crank' },
  burst: { dur: [0.5, 0.7], pull: 2.7, line: 1.6, swim: 'thrash', shake: 0.35, hint: null },
  thrash: { dur: [1.4, 1.8], pull: 1.3, oscillate: 0.16, damage: 1.2, swim: 'thrash', shake: 0.3, splashEvery: 0.32, hint: 'Thrashing: keep the line in the green' },
  skip: { dur: [1.2, 1.4], pull: 0.8, air: { height: 0.45, dur: 0.36, hops: 3 }, bow: true, spikeNoBow: 0, swim: 'leap', hint: 'Skipping! Tap as it clears the water' },
  playdead: { dur: [1.5, 2.2], pull: 0.08, line: 0, swim: 'still', next: 'bolt', hint: 'It went still like a branch...' },
  bolt: { dur: [0.8, 1.1], pull: 2.9, line: 2.6, spikeIfReeling: 0.3, swim: 'run', shake: 0.3, hint: 'Bolt! Should have eased off' },
  hug: { dur: [1.8, 2.6], pull: 0.7, reelTension: 1.7, damage: 0.2, depth: 'bottom', swim: 'still', sand: true, hint: 'Suctioned to the sand: let the line rest' },
  shell: { dur: [2.0, 2.8], pull: 0.0, line: 0, damage: 0, reelGain: 0, regen: 0.03, retract: 1, swim: 'still', hint: 'Hiding in its shell: wait for it to peek out' },
  // Sailcloth ray: catches the current like a sail and kites wide; steering against it pays double.
  kite: { dur: [1.8, 2.6], pull: 1.4, line: 1.8, flipSide: true, steerBonus: 2.2, swim: 'run', hint: 'It kites on the current: steer hard against it' },
  // Knotted needlefish: ties itself in knots, the tension wobbles; keep it in the green.
  coil: { dur: [1.4, 2.0], pull: 1.0, oscillate: 0.22, flipEvery: 0.4, damage: 1.3, swim: 'thrash', hint: 'Knotting up: ride the wobble, keep the line green' },
  // Lampfin gurnard: flares its lantern fins (barely pulls), then bursts away; reeling into the glare spikes the line.
  glare: { dur: [1.0, 1.4], pull: 0.15, line: 0, spikeIfReeling: 0.25, swim: 'still', next: 'burst', hint: 'Its lanterns flare: ease off before it bursts' },
  // Oyster hoarder: clamps its shell-cheeks shut on the line; heavy pull, little damage. Pump, don't crank.
  clamp: { dur: [1.8, 2.6], pull: 1.6, reelTension: 1.6, damage: 0.35, depth: 'bottom', swim: 'tired', shake: 0.2, hint: 'Clamped shut: short pumps, let the tension fall between' },
  // Moonwake ribbonfish: vanishes under its wake and runs; the line goes nearly slack, then snaps tight.
  vanish: { dur: [1.0, 1.4], pull: 0.3, line: 2.4, depth: 2.5, swim: 'dive', next: 'run', hint: 'It vanished under the wake: reel the slack in fast' },
  inflate: { dur: [2.6, 3.4], pull: 0.6, reelTension: 1.9, passiveDrain: 0.035, inflate: 1, swim: 'tired', hint: 'Puffed up! Reeling now spikes the line, wait it out' },
};
