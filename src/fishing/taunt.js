// Taunting: while the lure sits in the water, tap in rhythm to twitch it. A ring pulses on the lure;
// twitches on the beat build the taunt (bigger, rarer fish notice from further away and commit
// sooner), off-beat twitches can spook a curious fish, and frantic tapping spooks it for sure.
// A full taunt can call a rare fish in from the deep, once per cast. Hold the button to reel in.
// Tuning in public/data/mastery.json "taunt".

const DEFAULTS = {
  period: 0.8,         // seconds between beats
  window: 0.13,        // ± seconds around a beat that count as on the beat
  frantic: 0.28,       // taps closer together than this are frantic
  gain: 0.22,          // per good twitch
  miss: 0.1,           // lost per off-beat twitch
  decayAfter: 1.6,     // seconds without a twitch before it fades
  decay: 0.12,         // per second
  summonChance: 0.55,  // chance a full taunt calls a rare fish
  sizeBonus: 0.6,      // how much a full taunt pushes the size roll up
};

export function createTaunt({ state, hooks }) {
  const cfg = { ...DEFAULTS, ...(state.data?.mastery?.taunt || {}) };
  let t = 0, level = 0, since = 99, lastTap = -9, summoned = false, flash = null;

  function reset() { t = 0; level = 0; since = 99; lastTap = -9; summoned = false; flash = null; }

  function tap() {
    const phase = t % cfg.period;
    const off = Math.min(phase, cfg.period - phase);
    const frantic = t - lastTap < cfg.frantic;
    const good = !frantic && off <= cfg.window;
    lastTap = t;
    since = 0;
    level = Math.max(0, Math.min(1, level + (good ? cfg.gain : -cfg.miss)));
    flash = { text: frantic ? 'Too fast!' : good ? (off < cfg.window * 0.4 ? 'Perfect!' : 'Good') : 'Off beat', ok: good, t: 0 };
    hooks.twitch(good, frantic, level);
    if (level >= 1 && !summoned) {
      summoned = true;
      hooks.full(Math.random() < cfg.summonChance * (state.test && state.debugTaunt ? 100 : 1));
    }
  }

  function update(dt) {
    t += dt;
    since += dt;
    if (since > cfg.decayAfter) level = Math.max(0, level - cfg.decay * dt);
    if (flash) { flash.t += dt; if (flash.t > 0.6) flash = null; }
  }

  return {
    reset, tap, update,
    get level() { return level; },
    /** HUD: beat progress 0..1 (1 = on the beat), taunt level, last feedback. */
    get view() { return { beat: (t % cfg.period) / cfg.period, level, flash }; },
    /** Size roll bonus for the fish that takes a taunted lure. */
    get sizeBonus() { return level * cfg.sizeBonus; },
  };
}
