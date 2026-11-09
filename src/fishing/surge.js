// The surge: a chance, mid-fight, to upgrade the fish on your line. Fight well (the mastery gauge)
// and the sea may pour its element into the fish: a ring closes in on it three times; tap as each
// ring meets the fish. Three hits turn it into the island's elemental variant (worth ×5 and up, and
// it fights back with its superpower), two hits gild it, fewer and the surge fades. Once per fight.
// Tuning in public/data/mastery.json "surge".
import { variantTable, stepUp, isElemental } from './variants.js';

const DEFAULTS = {
  chanceAtGood: 0.3,
  chanceAtGreat: 0.65,
  beats: 3,
  beatTime: 1.15,       // seconds for a ring to close in
  window: 0.16,         // ± seconds around the meet that count as a hit
  gap: 0.35,            // pause between rings
  needForElement: 3,
  needForGild: 2,
  gildTo: 'gilded',
};

/** The elemental variant that belongs to this island (highest island boost), e.g. tide on Driftwood Cove. */
export function islandElement(state, islandId) {
  let best = null;
  for (const [id, v] of Object.entries(variantTable(state))) {
    if (!v || v.kind !== 'element') continue;
    const b = v.islandBoost?.[islandId] || 0;
    if (b > 1 && (!best || b > best.b)) best = { id, b };
  }
  return best?.id || 'tide';
}

export function createSurge({ state, fish, hooks }) {
  const d = state.data?.mastery?.surge || {};
  const cfg = { ...DEFAULTS, ...d };
  let phase = 'idle';      // idle → running → done
  let beat = 0, t = 0, hits = 0, judged = false, result = null;
  let flash = null;        // { text, ok, t } for the HUD
  const target = islandElement(state, state.world.islandId);
  const kind = () => variantTable(state)[fish.variant]?.kind || 'basic';
  const eligible = () => kind() !== 'element';

  function maybeStart(gradeId) {
    if (phase !== 'idle' || !eligible()) return false;
    const chance = gradeId === 'great' || gradeId === 'perfect' ? cfg.chanceAtGreat : gradeId === 'good' ? cfg.chanceAtGood : 0;
    if (Math.random() >= chance * (state.test && state.debugSurge ? 100 : 1)) return false;
    start();
    return true;
  }

  function start() {
    phase = 'running'; beat = 0; t = -0.6; hits = 0; judged = false;
    const v = variantTable(state)[target];
    hooks.begin(v?.name || 'Tide');
  }

  function judge(hit) {
    judged = true;
    if (hit) hits++;
    flash = { text: hit ? (Math.abs(t - cfg.beatTime) < cfg.window * 0.4 ? 'Perfect!' : 'Hit!') : 'Miss', ok: hit, t: 0 };
    hooks.beat(hit, beat);
  }

  function finish() {
    phase = 'done';
    const from = fish.variant || 'basic';
    let to = null;
    if (hits >= cfg.needForElement) to = target;
    else if (hits >= cfg.needForGild && !isElemental(state, from)) to = stepUp(state, from, 2);   // two ranks up the ladder
    result = { hits, from, to };
    hooks.end(result);
  }

  /** Called every fight frame. `tap` = the player tapped this frame. Returns true while it owns taps. */
  function update(dt, tap) {
    if (flash) { flash.t += dt; if (flash.t > 0.7) flash = null; }
    if (phase !== 'running') return false;
    t += dt;
    if (t < 0) return true;
    if (!judged && tap && t > cfg.beatTime - cfg.window * 2.2) judge(Math.abs(t - cfg.beatTime) <= cfg.window);
    if (!judged && t > cfg.beatTime + cfg.window) judge(false);
    if (t > cfg.beatTime + cfg.gap) {
      beat++;
      if (beat >= cfg.beats) { finish(); return false; }
      t = 0; judged = false;
    }
    return true;
  }

  return {
    maybeStart,
    update,
    force() { if (phase === 'idle' && eligible()) start(); return phase === 'running'; },
    /** HUD: ring progress 0..1 (1 = the ring meets the fish), beats done, hits so far. */
    get view() {
      if (phase !== 'running' && !flash) return null;
      return {
        running: phase === 'running',
        k: phase === 'running' ? Math.max(0, Math.min(1.15, t / cfg.beatTime)) : 0,
        beat, beats: cfg.beats, hits, element: target, flash,
      };
    },
    get running() { return phase === 'running'; },
    get result() { return result; },
  };
}
