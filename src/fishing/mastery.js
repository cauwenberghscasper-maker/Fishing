import { stepUp } from './variants.js';
// The mastery gauge (perfect fishing during a fight). Fill it by reeling with the tension in the sweet
// band, steering against the fish, bowing at leaps and countering superpowers; red-lining drains it.
// A fuller gauge tires the fish faster, so a well-played fight is a short one. Grades (Good / Great /
// Perfect) lock in once reached and raise the catch's value; a Perfect fight can turn the fish gilded.
// Great and Perfect fights build a lucky streak (state.world.luck) that tilts the next bites towards
// rarer species. Losing a fish ends the streak. Tuning in public/data/mastery.json.

const DEFAULTS = {
  band: [0.4, 0.86],
  gain: { zone: 0.11, steer: 0.07, bow: 0.14, counter: 0.18, strike: 0.1 },
  loss: { redline: 0.3, slack: 0.05 },
  damageBonus: 1.6,
  fatigue: { after: 30, drainPerSecond: 0.025 },
  grades: [
    { id: 'good', at: 0.4, name: 'Good', valueMult: 1.2 },
    { id: 'great', at: 0.7, name: 'Great', valueMult: 1.5, streak: 1 },
    { id: 'perfect', at: 1.0, name: 'Perfect', valueMult: 2.5, streak: 2, upgrade: { chance: 0.45, to: 'next', steps: [1, 2] } },
  ],
  streak: { max: 3, rareWeight: 0.7, perfectCastWeight: 0.4 },
};

export function masteryConfig(state) {
  const d = state.data?.mastery || {};
  return {
    ...DEFAULTS, ...d,
    gain: { ...DEFAULTS.gain, ...d.gain },
    loss: { ...DEFAULTS.loss, ...d.loss },
    fatigue: { ...DEFAULTS.fatigue, ...d.fatigue },
    streak: { ...DEFAULTS.streak, ...d.streak },
    grades: d.grades || DEFAULTS.grades,
  };
}

export function createMastery({ state, fight, hooks }) {
  const cfg = masteryConfig(state);
  let value = 0;
  let grade = null;   // best grade reached (locked in)
  let t = 0;

  function bump(k) { value = Math.min(1, value + k); }

  function update(dt, input) {
    const s = fight.state;
    t += dt;
    if (!s.landing) {
      const reeling = input.reeling;
      const inBand = s.tension >= cfg.band[0] && s.tension <= cfg.band[1];
      if (reeling && inBand) value += cfg.gain.zone * dt + cfg.gain.steer * Math.max(0, s.good) * dt;
      if (s.tension > 0.92) value -= cfg.loss.redline * dt;
      else if (s.tension < 0.1 && !reeling) value -= cfg.loss.slack * dt;
      value = Math.max(0, Math.min(1, value));
      // Long fights get a nudge: past `after` seconds the fish tires on its own.
      if (t > cfg.fatigue.after) s.stamina = Math.max(0, s.stamina - cfg.fatigue.drainPerSecond * dt);
    }
    // Lock in the best grade reached.
    for (const g of cfg.grades) {
      if (value >= g.at - 1e-6 && (!grade || g.at > grade.at)) {
        grade = g;
        hooks.grade(g);
      }
    }
    s.damageMult = 1 + value * cfg.damageBonus;
  }

  /** Rewards for the landed fish (called once per fish on the line). */
  function rewardFor(variant) {
    if (!grade) return { grade: null, valueMult: 1, variant };
    let v = variant;
    const up = grade.upgrade;
    if (up && up.to === 'next') {
      // A Perfect fight steps the catch up the rank ladder (Casper 9 Nov: Common → … → Legendary).
      if (Math.random() < up.chance) v = stepUp(state, variant || 'basic', up.steps ? up.steps[0] + Math.floor(Math.random() * (up.steps[1] - up.steps[0] + 1)) : 1);
    } else {
      const exists = !up || state.data?.variants?.[up.to];
      if (up && exists && (up.from || ['basic']).includes(variant || 'basic') && Math.random() < up.chance) v = up.to;
    }
    return { grade: grade.id, valueMult: grade.valueMult ?? 1, variant: v, upgraded: v !== variant };
  }

  return {
    update,
    rewardFor,
    bow() { bump(cfg.gain.bow); },
    countered() { bump(cfg.gain.counter); },
    strike() { bump(cfg.gain.strike); },
    get value() { return value; },
    get grade() { return grade; },
    /** Debug: fill the gauge. */
    fill(v = 1) { value = Math.max(0, Math.min(1, v)); },
  };
}

/** The lucky streak after a fight: Great/Perfect raise it, a lost fish ends it. Returns the new level. */
export function updateStreak(state, outcome, grade) {
  const cfg = masteryConfig(state);
  const w = state.world;
  const before = w.luck || 0;
  if (outcome !== 'caught') w.luck = 0;
  else if (grade?.streak) w.luck = Math.min(cfg.streak.max, before + grade.streak);
  return { before, after: w.luck || 0 };
}
