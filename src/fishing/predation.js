// Predators in the fight. While you reel in a fish, a bigger one can hunt it: its shadow races in,
// then it strikes. Sometimes it bites your fish off the hook (lost); otherwise it gets hooked too and
// you fight both at once — land them for a DOUBLE CATCH. Very rarely an even bigger fish swallows the
// pair: TRIPLE CATCH. Hauling the small fish to the shore before the hunter arrives saves it.
// Tuning in public/data/predation.json (food chain, chances, timings). Host/solo only (fish authority).
import { rollCatch } from './fight.js';
import { fishInfo, rosterFor, timeAllows } from './fishData.js';

const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const DEFAULTS = {
  chance: 0.12, perfectCastMult: 1.35, after: [2.5, 7], minStamina: 0.18,
  protectedTiers: ['big', 'boss', 'legendary'],
  stalk: { startDistance: [5.5, 8.5], searchRadius: 16, speed: 4.2, sprint: 7.5, maxTime: 3.2 },
  strike: { tensionSpike: 0.32, stealChance: 0.3, slowmo: 0.4, shake: 0.5 },
  load: { pullShare: 0.8, staminaShare: 1, learnMoves: true },
  triple: { chance: 0.15, after: [2, 5] },
  food: {},
};

export function predationConfig(state) {
  const d = state.data?.predation || {};
  return {
    ...DEFAULTS, ...d,
    stalk: { ...DEFAULTS.stalk, ...d.stalk },
    strike: { ...DEFAULTS.strike, ...d.strike },
    load: { ...DEFAULTS.load, ...d.load },
    triple: { ...DEFAULTS.triple, ...d.triple },
    food: d.food || DEFAULTS.food,
  };
}

/** Species on this island (and awake at this hour) that would eat `preyId`, with their weights. */
function huntersOf(cfg, state, preyId, hour, exclude) {
  const roster = new Set(rosterFor(state, state.world.islandId));
  const out = [];
  for (const [id, f] of Object.entries(cfg.food)) {
    if (!roster.has(id) || exclude.has(id) || !(f.eats || []).includes(preyId)) continue;
    if (!timeAllows(fishInfo(state, id).time, hour)) continue;
    out.push({ id, w: f.weight ?? 1 });
  }
  return out;
}

function pickWeighted(list) {
  let r = Math.random() * list.reduce((s, c) => s + c.w, 0);
  for (const c of list) { r -= c.w; if (r <= 0) return c; }
  return list[0];
}

export function createPredation({ state, events, fishSystem, fight, hooked, roll, island, playerPos, hour, perfect, hooks }) {
  const cfg = predationConfig(state);
  const line = [{ fish: hooked, roll }];          // everything on the end of the line, prey first
  let t = 0;
  let nextAt = null;
  let hunter = null;                              // { fish, t, sprint }
  let result = null;

  const eligible = fishSystem.authority !== false && !cfg.protectedTiers.includes(hooked.info.tier);
  const firstHunters = () => huntersOf(cfg, state, line[line.length - 1].fish.id, hour, new Set(line.map((l) => l.fish.id)));
  if (eligible && firstHunters().length) {
    const chance = cfg.chance * (perfect ? cfg.perfectCastMult : 1) * (state.test && state.debugPredators ? 100 : 1);
    if (Math.random() < chance) nextAt = rand(cfg.after[0], cfg.after[1]);
  }

  function top() { return line[line.length - 1].fish; }

  // A live fish of that species nearby, else a new one out in deeper water beyond the fight.
  function summon(id) {
    const prey = top();
    const live = fishSystem.list
      .filter((f) => f.id === id && !f.controlled && !f.gone && !f.held && !f.remote && !f.air)
      .map((f) => ({ f, d: Math.hypot(f.pos.x - prey.pos.x, f.pos.z - prey.pos.z) }))
      .filter((c) => c.d < cfg.stalk.searchRadius)
      .sort((a, b) => a.d - b.d)[0];
    if (live) return live.f;
    const away = Math.atan2(prey.pos.x - playerPos.x, prey.pos.z - playerPos.z);
    for (let i = 0; i < 12; i++) {
      const a = away + rand(-1.1, 1.1);
      const r = rand(cfg.stalk.startDistance[0], cfg.stalk.startDistance[1]);
      const x = prey.pos.x + Math.sin(a) * r, z = prey.pos.z + Math.cos(a) * r;
      if (island.waterDepthAt(x, z) > 1.2) return fishSystem.spawn(id, x, z);
    }
    return null;
  }

  function beginHunt() {
    nextAt = null;
    const options = huntersOf(cfg, state, top().id, hour, new Set(line.map((l) => l.fish.id)));
    if (!options.length) return;
    const f = summon(pickWeighted(options).id);
    if (!f) return;
    fishSystem.take(f);
    f.fade = Math.max(f.fade, 0.6);
    hunter = { fish: f, t: 0 };
    hooks.toast(`Something is hunting your ${top().info.name}!`, 2.2);
    hooks.warn();
    events.emit('predator:stalk', { uid: f.uid, fishId: f.id, variant: f.variant || 'basic', preyUid: top().uid });
  }

  function updateHunt(dt) {
    const f = hunter.fish;
    const prey = top();
    hunter.t += dt;
    const dx = prey.pos.x - f.pos.x, dz = prey.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const turn = wrap(want - f.heading);
    f.heading = wrap(f.heading + Math.max(-5 * dt, Math.min(5 * dt, turn)));
    f.turnRate = turn * 2;
    const k = Math.min(1, hunter.t / cfg.stalk.maxTime);
    const sp = cfg.stalk.speed + (cfg.stalk.sprint - cfg.stalk.speed) * k * k;
    f.speed += (sp - f.speed) * (1 - Math.exp(-4 * dt));
    const step = Math.min(dist, f.speed * dt);
    f.pos.x += Math.sin(f.heading) * step;
    f.pos.z += Math.cos(f.heading) * step;
    f.depthTarget = Math.max(0.3, (prey.depthTarget || 0.45) + 0.15);
    f.swim.set('run');
    if (Math.random() < dt * 3) hooks.ripple(f.pos.x, f.pos.z, 0.3);
    if (dist < 0.5 + f.length * 0.35 || hunter.t > cfg.stalk.maxTime + 1.5) strike();
  }

  function strike() {
    const f = hunter.fish;
    hunter = null;
    const p = top().pos;
    hooks.splash(p.x, p.z, 2.0);
    hooks.shake(cfg.strike.shake);
    hooks.slowmo(cfg.strike.slowmo, 0.45);
    hooks.chomp();
    fight.state.tension = Math.min(1, fight.state.tension + cfg.strike.tensionSpike);
    if (Math.random() < cfg.strike.stealChance) {
      // It bit clean through: everything on the line is gone, the thief swims off with it.
      result = { stolen: true, by: f };
      hooks.toast(`The ${f.info.name} bit it off the hook!`, 2.2);
      events.emit('predator:strike', { uid: f.uid, fishId: f.id, hooked: false, count: line.length });
      return;
    }
    const r = rollCatch(f.info, false);
    f.catchRoll = r;
    line.push({ fish: f, roll: r });
    fight.addLoad(r.strength, f.behaviour, cfg.load);
    const n = line.length;
    hooks.toast(n >= 3 ? `TRIPLE! A ${f.info.name} swallowed the lot!` : `A ${f.info.name} took it: double on the line!`, 2.4);
    events.emit('predator:strike', { uid: f.uid, fishId: f.id, hooked: true, count: n });
    if (n === 2 && Math.random() < cfg.triple.chance * (state.test && state.debugPredators ? 100 : 1)) {
      nextAt = t + rand(cfg.triple.after[0], cfg.triple.after[1]);
    }
  }

  // Each hunter on the line has the fish before it in its jaws and follows its every move.
  function followLine(dt) {
    for (let i = 1; i < line.length; i++) {
      const prey = line[i - 1].fish;
      const f = line[i].fish;
      const back = f.length * 0.32;
      f.heading = prey.heading + Math.sin(t * 9 + i) * 0.12;
      f.pos.x = prey.pos.x - Math.sin(prey.heading) * back;
      f.pos.z = prey.pos.z - Math.cos(prey.heading) * back;
      f.airY = prey.airY || 0;
      f.depthTarget = (prey.depthTarget || 0.45) + 0.05;
      f.speed = prey.speed;
      f.turnRate = prey.turnRate;
      f.swim.set(fight.state.landing ? 'tired' : 'thrash');
      void dt;
    }
  }

  function update(dt) {
    if (result) return result;
    t += dt;
    const s = fight.state;
    if (hunter) {
      if (s.landing) {
        // You hauled it in first: the hunter turns away.
        const f = hunter.fish;
        hunter = null;
        fishSystem.finish(f, 'escaped');
        hooks.toast('You beat it to the shore!', 1.6);
      } else updateHunt(dt);
    } else if (nextAt !== null && t >= nextAt && !s.landing && s.stamina > cfg.minStamina) beginHunt();
    followLine(dt);
    return result;
  }

  /** The fight ended without a catch: hunters still on (or chasing) the line swim away. */
  function release(status) {
    if (hunter) { fishSystem.finish(hunter.fish, 'escaped'); hunter = null; }
    if (status === 'predator') {
      // The thief ate the line's catch.
      for (const l of line) fishSystem.finish(l.fish, 'caught');
      fishSystem.finish(result.by, 'escaped');
      return;
    }
    for (const l of line.slice(1)) fishSystem.finish(l.fish, 'escaped');
  }

  return {
    update,
    release,
    get line() { return line; },
    get hunting() { return Boolean(hunter); },
    /** Debug: send a hunter now. */
    force() { if (!hunter && !result) { nextAt = null; beginHunt(); } return Boolean(hunter); },
  };
}
