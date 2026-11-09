// More minigames inside the fight (Casper 9 Nov: "more minigames during the fishing"). Drawn at the
// fish, which the camera always keeps on screen.
//   snag    — the line catches on kelp or rock: swipe the arrows shown, in order, to free it.
//             Clean = the fish loses heart (stamina) and mastery rises; a miss spikes the tension
//             and the fish gets a second wind.
//   landing — at the very end, a needle sweeps a gauge: tap in the gold to land it clean
//             (+25% value); miss and it still comes in, just not as cleanly.
// Tuning in public/data/mastery.json "minigames".

const DEFAULTS = {
  snag: { chance: 0.4, after: [4, 9], arrows: [2, 4], timePerArrow: 1.3, cleanDamage: 0.12, missTension: 0.3, missStamina: 0.12 },
  landing: { at: 0.12, sweep: 1.1, gold: 0.16, bonus: 1.25 },
};
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createMinigames({ state, fight, hooks }) {
  const d = state.data?.mastery?.minigames || {};
  const cfg = { snag: { ...DEFAULTS.snag, ...d.snag }, landing: { ...DEFAULTS.landing, ...d.landing } };
  const rand = (a, b) => a + Math.random() * (b - a);
  let t = 0;
  let snag = null;       // { arrows: [...], i, timer, result }
  let snagAt = Math.random() < cfg.snag.chance * (state.test && state.debugMinigames ? 100 : 1) ? rand(cfg.snag.after[0], cfg.snag.after[1]) : null;
  let landing = null;    // { t, done, hit }
  let landed = null;     // 'clean' | 'rough'
  let flash = null;

  function startSnag() {
    const n = Math.round(rand(cfg.snag.arrows[0], cfg.snag.arrows[1]));
    const keys = Object.keys(DIRS);
    snag = { arrows: Array.from({ length: n }, () => keys[Math.floor(Math.random() * keys.length)]), i: 0, timer: cfg.snag.timePerArrow };
    snagAt = null;
    hooks.snag();
  }

  function endSnag(ok) {
    const s = fight.state;
    if (ok) {
      s.stamina = Math.max(0, s.stamina - cfg.snag.cleanDamage);
      flash = { text: 'Freed!', ok: true, t: 0 };
    } else {
      s.tension = Math.min(1, s.tension + cfg.snag.missTension);
      s.stamina = Math.min(1, s.stamina + cfg.snag.missStamina);
      flash = { text: 'Snagged!', ok: false, t: 0 };
    }
    snag = null;
    hooks.snagEnd(ok);
  }

  /** gestures: [{dx, dy}] finished swipes this frame (screen space); tap: a tap this frame. */
  function update(dt, { gestures = [], tap = false } = {}) {
    t += dt;
    if (flash) { flash.t += dt; if (flash.t > 0.8) flash = null; }
    const s = fight.state;
    if (snag) {
      snag.timer -= dt;
      for (const g of gestures) {
        const want = DIRS[snag.arrows[snag.i]];
        const len = Math.hypot(g.dx, g.dy) || 1;
        const dot = (g.dx * want[0] + g.dy * want[1]) / len;
        if (dot > 0.7) {
          snag.i++;
          hooks.arrow(true);
          snag.timer = cfg.snag.timePerArrow;
          if (snag.i >= snag.arrows.length) { endSnag(true); return; }
        } else { hooks.arrow(false); endSnag(false); return; }
      }
      if (snag && snag.timer <= 0) endSnag(false);
      return;
    }
    if (snagAt !== null && t >= snagAt && !s.landing && s.stamina > 0.3 && !landing) startSnag();
    // The landing gauge: once, when the fish is nearly spent.
    if (!landing && !landed && s.stamina <= cfg.landing.at && s.stamina > 0) {
      landing = { t: 0 };
      hooks.landing();
    }
    if (landing) {
      landing.t += dt;
      if (landing.t > 3.2) tap = true;   // no tap in time: it still comes in, roughly
      if (tap) {
        const k = needle();
        const hit = landing.t <= 3.2 && Math.abs(k - 0.5) <= cfg.landing.gold / 2;
        landed = hit ? 'clean' : 'rough';
        flash = { text: hit ? 'Clean landing!' : 'Rough landing', ok: hit, t: 0 };
        landing = null;
        hooks.landed(hit);
      }
    }
  }

  // 0..1..0 sweep of the landing needle.
  function needle() { const p = (landing.t / cfg.landing.sweep) % 2; return p < 1 ? p : 2 - p; }

  return {
    update,
    get busy() { return Boolean(snag || landing); },
    /** True while the landing gauge waits for a tap: the fight should not end yet. */
    get holdLanding() { return Boolean(landing); },
    get valueBonus() { return landed === 'clean' ? cfg.landing.bonus : 1; },
    get view() {
      if (!snag && !landing && !flash) return null;
      return {
        snag: snag ? { arrows: snag.arrows, i: snag.i, k: snag.timer / cfg.snag.timePerArrow } : null,
        landing: landing ? { needle: needle(), gold: cfg.landing.gold } : null,
        flash,
      };
    },
    forceSnag() { if (!snag) startSnag(); return true; },
  };
}
