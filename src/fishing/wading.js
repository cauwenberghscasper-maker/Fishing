// Wading out deep. The player can walk past the safe shallows into deeper water to cast further, but
// out there the island's bigger fish hunt them: a fin circles in (warning, sound, ripples), and if the
// player is still in deep water when it arrives it strikes, knocks them back toward land and snatches
// a fish from their basket. Back in the shallows in time = safe. Tuning: data/predation.json "wading".
// Host/solo only (fish authority); never during a fight, cast or menu.

const DEFAULTS = {
  safeDepth: 0.45,          // deeper than this counts as deep water
  graceSeconds: 2.5,        // time in deep water before anything notices
  chancePerSecond: 0.22,    // at the deepest wade; scales with depth past safeDepth
  maxDepth: 1.0,            // must match island WADE_MAX
  cooldown: [10, 18],
  stalk: { startDistance: [6, 8], speed: 3.2, sprint: 7.5, time: 2.8 },
  knockback: 2.4,
  stealFish: true,
  hunters: ['kelp_wraith', 'lampfin_gurnard', 'oyster_hoarder', 'seaglass_puffer', 'moonwake_ribbonfish', 'old_mooring'],
};

const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createWadingDanger({ state, events, island, player, fishSystem, economy, hooks }) {
  const d = state.data?.predation?.wading || {};
  const cfg = { ...DEFAULTS, ...d, stalk: { ...DEFAULTS.stalk, ...d.stalk } };
  let deepFor = 0;
  let cooldown = 0;
  let hunter = null;   // { fish, t }

  function depthAt(p) { return Math.max(0, -island.groundAt(p.x, p.z)); }

  function pickHunter() {
    const ids = new Set(fishSystem.list.map((f) => f.id));
    const roster = cfg.hunters.filter((id) => state.data?.fish?.[id]?.island === state.world.islandId);
    if (!roster.length) return null;
    // Prefer a species that's already swimming nearby, so it feels like *that* fish noticed you.
    const near = roster.filter((id) => ids.has(id));
    const pool = near.length && Math.random() < 0.6 ? near : roster;
    const id = pool[Math.floor(Math.random() * pool.length)];
    const p = player.position;
    // Come from deeper water: the direction where the ground falls away.
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = rand(cfg.stalk.startDistance[0], cfg.stalk.startDistance[1]);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const depth = island.waterDepthAt(x, z);
      if (depth > 1.4 && (!best || depth > best.depth)) best = { x, z, depth };
    }
    if (!best) return null;
    const live = fishSystem.list.find((f) => f.id === id && !f.controlled && !f.gone && !f.held && !f.remote && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 14);
    return live || fishSystem.spawn(id, best.x, best.z);
  }

  function start() {
    const f = pickHunter();
    if (!f) { cooldown = 4; return; }
    fishSystem.take(f);
    f.fade = Math.max(f.fade, 0.6);
    hunter = { fish: f, t: 0 };
    hooks.toast('Something is circling you!', 2.4);
    hooks.warn();
    events.emit('wade:stalk', { uid: f.uid, fishId: f.id });
  }

  function release(f, how) {
    fishSystem.finish(f, how);
    hunter = null;
    cooldown = rand(cfg.cooldown[0], cfg.cooldown[1]);
  }

  function strike() {
    const f = hunter.fish;
    const p = player.position;
    hooks.splash(p.x, p.z, 2.2);
    hooks.chomp();
    hooks.shake(0.6);
    // Knock the player toward land: step along the direction where the ground rises.
    let dir = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = p.x + Math.sin(a) * cfg.knockback, z = p.z + Math.cos(a) * cfg.knockback;
      const g = island.groundAt(x, z);
      if (island.isWalkable(x, z) && (!dir || g > dir.g)) dir = { x, z, g };
    }
    if (dir) player.teleport(dir.x, dir.z);
    const lost = cfg.stealFish ? economy?.loseCatch?.() : null;
    const name = lost ? (state.data?.fish?.[lost.fishId]?.name || 'fish') : null;
    hooks.toast(lost ? `It stole your ${name}!` : `A ${f.info.name} bit at you!`, 2.6);
    events.emit('wade:strike', { uid: f.uid, fishId: f.id, stole: lost?.fishId ?? null });
    release(f, 'escaped');
  }

  function update(dt, canHunt) {
    cooldown = Math.max(0, cooldown - dt);
    const p = player.position;
    const depth = depthAt(p);
    const deep = depth > cfg.safeDepth + 0.02;
    if (hunter) {
      const f = hunter.fish;
      if (!canHunt || !deep) {
        // Made it back to the shallows (or something took over): it turns away.
        if (!deep && canHunt) hooks.toast('Safe in the shallows.', 1.2);
        release(f, 'escaped');
        return;
      }
      hunter.t += dt;
      const dx = p.x - f.pos.x, dz = p.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      const k = Math.min(1, hunter.t / cfg.stalk.time);
      // Circle first, then close in.
      const want = Math.atan2(dx, dz) + (1 - k) * 1.1;
      const turn = wrap(want - f.heading);
      f.heading = wrap(f.heading + Math.max(-4 * dt, Math.min(4 * dt, turn)));
      f.turnRate = turn * 2;
      const sp = cfg.stalk.speed + (cfg.stalk.sprint - cfg.stalk.speed) * k * k;
      f.speed += (sp - f.speed) * (1 - Math.exp(-4 * dt));
      f.pos.x += Math.sin(f.heading) * f.speed * dt;
      f.pos.z += Math.cos(f.heading) * f.speed * dt;
      f.depthTarget = 0.25;
      f.swim.set('run');
      if (Math.random() < dt * 4) hooks.ripple(f.pos.x, f.pos.z, 0.35);
      if ((dist < 0.9 && hunter.t > cfg.stalk.time * 0.6) || hunter.t > cfg.stalk.time + 1.5) strike();
      return;
    }
    if (!canHunt || !deep) { deepFor = 0; return; }
    deepFor += dt;
    if (deepFor < cfg.graceSeconds || cooldown > 0) return;
    const k = Math.min(1, (depth - cfg.safeDepth) / Math.max(0.05, cfg.maxDepth - cfg.safeDepth));
    const boost = state.test && state.debugPredators ? 50 : 1;
    if (Math.random() < cfg.chancePerSecond * (0.35 + 0.65 * k) * dt * boost) start();
  }

  return {
    update,
    get hunting() { return Boolean(hunter); },
    /** Debug: send a hunter now (only when standing in deep water). */
    force() { if (!hunter && depthAt(player.position) > cfg.safeDepth) start(); return Boolean(hunter); },
  };
}
