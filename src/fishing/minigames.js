// More minigames inside the fight (Casper 9 Nov: "more minigames during the fishing"). Drawn at the
// fish, which the camera always keeps on screen.
//   snag    — the line catches on kelp or rock: swipe the arrows shown, in order, to free it.
//             Clean = the fish loses heart (stamina) and mastery rises; a miss spikes the tension
//             and the fish gets a second wind.
//   pump    — heavy fish (bulky, jellies, flatfish): a ring pulses on the fish four times; tap
//             on each pulse to pump the rod and haul it up.
//   hold    — fast fish (runners, darters): a marker drifts on a bar; steer (drag sideways) to
//             keep it in the middle until the bar fills.
//   landing — at the very end, a needle sweeps a gauge: tap in the gold to land it clean
//             (+25% value); miss and it still comes in, just not as cleanly.
// Which mid-fight minigame a fish brings depends on its type (behaviour.minigames, else its body).
// Tuning in public/data/mastery.json "minigames".

const DEFAULTS = {
  midChance: 0.6,
  snag: { chance: 0.4, after: [4, 9], arrows: [2, 4], timePerArrow: 1.3, cleanDamage: 0.12, missTension: 0.3, missStamina: 0.12 },
  pump: { beats: 4, period: 0.75, window: 0.16, damagePerHit: 0.045, missTension: 0.12 },
  hold: { time: 2.6, drift: 1.1, steer: 2.2, zone: 0.3, damage: 0.14, failTension: 0.28, limit: 6 },
  landing: { at: 0.12, sweep: 1.1, gold: 0.16, bonus: 1.25 },
};
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const BY_BODY = { eel: ['snag'], bulky: ['pump'], jelly: ['pump'], flat: ['pump', 'hold'], ray: ['hold'], shelled: ['pump'], fusiform: ['hold', 'snag'] };

export function createMinigames({ state, fight, behaviour = {}, hooks }) {
  const d = state.data?.mastery?.minigames || {};
  const cfg = { ...DEFAULTS, ...d, snag: { ...DEFAULTS.snag, ...d.snag }, pump: { ...DEFAULTS.pump, ...d.pump }, hold: { ...DEFAULTS.hold, ...d.hold }, landing: { ...DEFAULTS.landing, ...d.landing } };
  const rand = (a, b) => a + Math.random() * (b - a);
  const kinds = behaviour.minigames || BY_BODY[behaviour.body] || ['snag'];
  const big = (behaviour.stamina ?? 8) >= 20;   // monsters and legends bring every one of theirs
  let t = 0;
  let snag = null;       // { arrows: [...], i, timer }
  let pump = null;       // { t, beat, hits, judged }
  let hold = null;       // { m, v, inZone, t }
  const queue = [];      // [{ kind, at }]
  {
    const n = big ? kinds.length : Math.random() < cfg.midChance * (state.test && state.debugMinigames ? 100 : 1) ? 1 : 0;
    let at = rand(cfg.snag.after[0], cfg.snag.after[1]);
    const pickFrom = [...kinds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) { queue.push({ kind: pickFrom[i % pickFrom.length], at }); at += rand(6, 10); }
  }
  let snagAt = null;
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

  function startPump() { pump = { t: -0.4, beat: 0, hits: 0, judged: false }; hooks.pump?.(); }
  function startHold() { hold = { m: 0, v: (Math.random() < 0.5 ? -1 : 1) * cfg.hold.drift, inZone: 0, t: 0, left: false }; hooks.hold?.(); }

  function updatePump(dt, tap) {
    const P = cfg.pump, s = fight.state;
    pump.t += dt;
    if (pump.t < 0) return;
    const off = pump.t - P.period;
    if (!pump.judged && tap && off > -P.window * 2) {
      pump.judged = true;
      const hit = Math.abs(off) <= P.window;
      if (hit) { pump.hits++; s.stamina = Math.max(0, s.stamina - P.damagePerHit); } else s.tension = Math.min(1, s.tension + P.missTension);
      hooks.arrow(hit);
    }
    if (!pump.judged && off > P.window) { pump.judged = true; s.tension = Math.min(1, s.tension + P.missTension); hooks.arrow(false); }
    if (pump.t > P.period + 0.2) {
      pump.beat++; pump.t = 0; pump.judged = false;
      if (pump.beat >= P.beats) {
        const ok = pump.hits >= P.beats - 1;
        const perfect = pump.hits >= P.beats;
        flash = { text: perfect ? 'Perfect pump!' : ok ? 'Hauled up!' : `Pumped ${pump.hits}/${P.beats}`, ok, t: 0 };
        pump = null;
        hooks.snagEnd(ok, perfect);
      }
    }
  }

  function updateHold(dt, steer) {
    const H = cfg.hold, s = fight.state;
    hold.t += dt;
    if (Math.random() < dt * 0.8) hold.v = -hold.v * rand(0.8, 1.3);       // it darts the other way
    hold.m += (hold.v - steer * H.steer) * dt;
    if (Math.abs(hold.m) <= H.zone) hold.inZone += dt;
    else if (hold.inZone > 0.15) hold.left = true;
    if (Math.abs(hold.m) > 1 || hold.t > H.limit) {
      s.tension = Math.min(1, s.tension + H.failTension);
      flash = { text: 'It got away from you!', ok: false, t: 0 };
      hold = null; hooks.snagEnd(false); return;
    }
    if (hold.inZone >= H.time) {
      s.stamina = Math.max(0, s.stamina - H.damage);
      const perfect = !hold.left;
      flash = { text: perfect ? 'Perfect hold!' : 'Held it!', ok: true, t: 0 };
      hold = null; hooks.snagEnd(true, perfect);
    }
  }

  /** gestures: [{dx, dy}] finished swipes this frame (screen space); tap: a tap this frame; steer: -1..1. */
  function update(dt, { gestures = [], tap = false, steer = 0 } = {}) {
    t += dt;
    if (flash) { flash.t += dt; if (flash.t > 0.8) flash = null; }
    const s = fight.state;
    if (pump) { updatePump(dt, tap); return; }
    if (hold) { updateHold(dt, steer); return; }
    if (!snag && queue.length && t >= queue[0].at && !s.landing && s.stamina > 0.25 && !landing) {
      const { kind } = queue.shift();
      if (kind === 'pump') { startPump(); return; }
      if (kind === 'hold') { startHold(); return; }
      startSnag(); return;
    }
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
    get busy() { return Boolean(snag || pump || hold || landing); },
    /** True while the landing gauge waits for a tap: the fight should not end yet. */
    get holdLanding() { return Boolean(landing); },
    get valueBonus() { return landed === 'clean' ? cfg.landing.bonus : 1; },
    get view() {
      if (!snag && !pump && !hold && !landing && !flash) return null;
      return {
        snag: snag ? { arrows: snag.arrows, i: snag.i, k: snag.timer / cfg.snag.timePerArrow } : null,
        pump: pump ? { k: Math.max(0, pump.t) / cfg.pump.period, beat: pump.beat, beats: cfg.pump.beats, hits: pump.hits } : null,
        hold: hold ? { m: hold.m, zone: cfg.hold.zone, fill: hold.inZone / cfg.hold.time } : null,
        landing: landing ? { needle: needle(), gold: cfg.landing.gold } : null,
        flash,
      };
    },
    forceSnag() { if (!snag) startSnag(); return true; },
    force(kind) { if (kind === 'pump') startPump(); else if (kind === 'hold') startHold(); else startSnag(); return true; },
  };
}
