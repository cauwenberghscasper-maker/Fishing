// Reel and fight (master prompt 4.3). Tension + stamina; hold to reel, release to let it run;
// drag sideways to steer against the fish; line snaps on sustained max tension; data-driven moves.
import * as THREE from 'three';
import { MOVES } from './moves.js';
import { createBossController } from './boss.js';

const rand = (a, b) => a + Math.random() * (b - a);
const MAX_LINE = 38;

export function createFight({ fish, info, weight, sizeClass, strength, state, island, water, splashes, playerPos, castAngle, hooks, power = null }) {
  const b = fish.behaviour;
  const g = state.gear || {};
  const gear = {
    rodPower: g.rodPower || 1,
    reelSpeed: g.reelSpeed || 1,
    lineStrength: g.lineStrength || 1,
  };
  const boss = createBossController(b);
  const moveIds = (boss ? boss.moves : b.moves || []).filter((id) => MOVES[id]);
  const [moveMin, moveMax] = b.moveEvery || [2.5, 4];

  const s = {
    tension: 0.35,
    stamina: 1,
    distance: Math.max(2.5, Math.hypot(fish.pos.x - playerPos.x, fish.pos.z - playerPos.z)),
    angle: Math.atan2(fish.pos.x - playerPos.x, fish.pos.z - playerPos.z),
    side: Math.random() < 0.5 ? -1 : 1,
    sideTimer: rand(1.5, 3),
    move: null,
    moveId: null,
    moveT: 0,
    moveDur: 0,
    nextMove: rand(1.2, 2.2),
    overload: 0,
    slack: 0,
    landing: false,
    landT: 0,
    bowed: false,
    bowWindow: false,
    hop: 0,
    t: 0,
    lastSplash: 0,
    good: 0,
    status: 'fighting',
  };
  const anchorAngle = castAngle;
  let pullBase = (b.pull ?? 0.4) * strength;
  let staminaPool = (b.stamina ?? 8) * (0.85 + (strength - 0.85) * 1.2);

  function startMove(id) {
    const m = MOVES[id];
    s.move = m;
    s.moveId = id;
    s.moveT = 0;
    s.moveDur = rand(m.dur[0], m.dur[1]);
    s.bowed = false;
    s.hop = 0;
    if (m.spike) s.tension = Math.min(1, s.tension + m.spike);
    if (m.flipSide) s.side *= -1;
    if (m.shake) hooks.shake(m.shake);
    if (m.air) {
      const p = fishPoint();
      splashes.splash(p.x, p.z, m.air.height > 1 ? 1.6 : 0.5);
      water.addRipple(p.x, p.z, m.air.height > 1 ? 1.4 : 0.5);
    }
    if (m.sand) { const p = fishPoint(); water.addRipple(p.x, p.z, 0.6); }
    hooks.move(id, m);
  }

  function endMove() {
    const next = s.move?.next;
    s.move = null;
    s.moveId = null;
    fish.retract = 0;
    fish.inflate = 0;
    fish.airY = 0;
    s.nextMove = rand(moveMin, moveMax);
    if (next && MOVES[next]) startMove(next);
  }

  function fishPoint() {
    return { x: playerPos.x + Math.sin(s.angle) * s.distance, z: playerPos.z + Math.cos(s.angle) * s.distance };
  }

  // Steering: screen x of the fish's sideways motion vs the player's horizontal drag.
  function lateralScreenX() {
    return Math.cos(s.angle) * s.side;
  }

  function update(dt, input) {
    if (s.status !== 'fighting') return s.status;
    s.t += dt;
    const m = s.move;
    const reeling = input.reeling && !s.landing;
    const steer = THREE.MathUtils.clamp(input.steer || 0, -1, 1);
    const lat = lateralScreenX();
    const latSign = Math.sign(lat) || 1;
    const latMag = Math.min(1, Math.abs(lat) * 1.6 + 0.25);
    const good = Math.max(0, -steer * latSign) * latMag;
    const bad = Math.max(0, steer * latSign) * latMag;
    s.good = good - bad;

    // Moves
    if (!s.landing) {
      if (m) {
        s.moveT += dt;
        if (m.flipEvery && (s.moveT % m.flipEvery) < dt) s.side *= -1;
        if (m.air) updateAir(m, dt, input);
        if (m.spikeIfReeling && reeling && s.moveT < dt * 1.5) s.tension = Math.min(1, s.tension + m.spikeIfReeling);
        if (m.splashEvery && s.t - s.lastSplash > m.splashEvery) {
          const p = fishPoint();
          splashes.splash(p.x, p.z, 0.6);
          water.addRipple(p.x, p.z, 0.6);
          s.lastSplash = s.t;
          hooks.thrash?.();
        }
        fish.retract += ((m.retract || 0) - fish.retract) * (1 - Math.exp(-8 * dt));
        fish.inflate += ((m.inflate || 0) - fish.inflate) * (1 - Math.exp(-6 * dt));
        if (s.moveT >= s.moveDur) endMove();
      } else {
        s.nextMove -= dt;
        fish.retract *= Math.exp(-6 * dt);
        fish.inflate *= Math.exp(-4 * dt);
        if (s.nextMove <= 0 && moveIds.length) startMove(moveIds[Math.floor(Math.random() * moveIds.length)]);
      }
      s.sideTimer -= dt;
      if (s.sideTimer <= 0) { s.side *= -1; s.sideTimer = rand(1.6, 3.4); }
    }

    // Elemental superpower (variant fish): its rules modify the fight while it runs.
    const pm = power ? power.update(dt, api, input) : null;
    if (pm?.snap) { s.status = 'snap'; return s.status; }
    if (pm?.flipEvery && (s.t % pm.flipEvery) < dt) s.side *= -1;
    if (pm && pm.airY !== null) fish.airY = Math.max(0, pm.airY);

    const tired = s.stamina < 0.2 ? 0.55 : 1;
    const pull = s.landing ? 0.05 : pullBase * (m?.pull ?? 1) * tired * (pm?.pull ?? 1);

    // Tension
    if (reeling && !(m && m.reelGain === 0)) {
      let rise = (0.24 + pull * 0.95) * (m?.reelTension ?? 1) * (pm?.tensionRise ?? 1) / gear.lineStrength;
      rise *= 1 - good * 0.38 + bad * 0.55;
      s.tension += rise * dt;
    } else {
      s.tension -= (0.6 - Math.min(0.4, pull * 0.3)) * dt;
      s.tension = Math.max(s.tension, Math.min(0.35, pull * 0.18));
    }
    if (m?.oscillate) s.tension += Math.sin(s.t * 26) * m.oscillate * dt * 9;
    if (m && m.reelGain === 0) s.tension *= Math.exp(-1.6 * dt);
    s.tension = THREE.MathUtils.clamp(s.tension, 0, 1);

    // Stamina
    const zone = THREE.MathUtils.smoothstep(s.tension, 0.16, 0.38) * (1 - THREE.MathUtils.smoothstep(s.tension, 0.86, 0.98));
    if (reeling) {
      const steerBonus = 1 + good * (m?.steerBonus ?? 1) * 0.9;
      const dmg = (1 / staminaPool) * (0.7 + 0.45 * gear.rodPower) * zone * (m?.damage ?? 1) * steerBonus * (s.damageMult ?? 1);
      s.stamina -= dmg * dt;
      if (boss) { const r = boss.damage(dmg * dt); if (r.phaseChanged) hooks.phase?.(r); }
    } else {
      s.stamina += (m?.regen ?? 0.012) * dt;
    }
    if (m?.passiveDrain && !reeling) s.stamina -= m.passiveDrain * dt;
    s.stamina = THREE.MathUtils.clamp(s.stamina, 0, 1);

    // Distance (line in/out)
    if (s.landing) {
      s.landT += dt;
      s.distance -= (2.4 + s.distance * 0.9) * dt;
      s.tension += (0.42 - s.tension) * (1 - Math.exp(-4 * dt));
    } else {
      const reelIn = reeling ? gear.reelSpeed * 1.6 * (m?.reelGain ?? 1) * (pm?.reelGain ?? 1) * (1 - Math.min(0.85, pull * 0.5)) : 0;
      const lineOut = pull * (m?.line ?? 0.55) * (reeling ? 0.45 : 1);
      s.distance += (lineOut - reelIn) * dt;
      // A fish close to the rod still has fight left: it makes a run.
      if (s.distance < 2.2 && s.stamina > 0.05 && !m) startMove(moveIds.includes('run') ? 'run' : (moveIds[0] || 'run'));
      s.distance = Math.max(1.6, s.distance);
    }

    // Sideways drift around the player, held back by good steering, kept in the water.
    const drift = s.landing ? 0 : s.side * (0.12 + pull * 0.22) * (1 - good * 0.8 + bad * 0.4) / Math.max(1.5, s.distance * 0.35);
    let nextAngle = s.angle + drift * dt;
    const off = Math.atan2(Math.sin(nextAngle - anchorAngle), Math.cos(nextAngle - anchorAngle));
    if (Math.abs(off) > 1.15) { nextAngle = anchorAngle + Math.sign(off) * 1.15; s.side = -Math.sign(off); }
    const tx = playerPos.x + Math.sin(nextAngle) * s.distance, tz = playerPos.z + Math.cos(nextAngle) * s.distance;
    if (island.waterDepthAt(tx, tz) < 0.5) {
      s.side *= -1;
      // Pull the fish back towards the cast line if it ran out of water.
      nextAngle = s.angle + Math.sign(Math.atan2(Math.sin(anchorAngle - s.angle), Math.cos(anchorAngle - s.angle))) * dt * 0.4;
    }
    s.angle = nextAngle;

    // Snap / slack / spool
    if (s.tension >= 0.985) s.overload += dt; else s.overload = Math.max(0, s.overload - dt * 1.4);
    const snapTime = 0.75 + 0.35 * gear.lineStrength;
    if (s.overload > snapTime) s.status = 'snap';
    const relaxing = m && (m.pull ?? 1) < 0.2;
    if (s.tension < 0.07 && !s.landing && !relaxing) s.slack += dt; else s.slack = Math.max(0, s.slack - dt * 2);
    if (s.slack > 3.4) s.status = 'escape';
    if (s.distance > MAX_LINE) s.status = 'escape';

    if (!s.landing && s.stamina <= 0) {
      s.landing = true;
      if (s.move) endMove();
      hooks.tired?.();
    }
    if (s.landing && s.distance <= 3.2) s.status = 'caught'; // the catch burst takes it from here

    applyFishPose(dt);
    return s.status;
  }

  function updateAir(m, dt, input) {
    const hopDur = m.air.dur;
    const hopT = s.moveT - s.hop * (hopDur + 0.08);
    const k = THREE.MathUtils.clamp(hopT / hopDur, 0, 1);
    fish.airY = Math.sin(k * Math.PI) * m.air.height;
    s.bowWindow = m.bow && k > 0.3 && k < 0.7;
    if (input.bowTap && s.bowWindow && !s.bowed) {
      s.bowed = true;
      s.stamina = Math.max(0, s.stamina - 0.07 * (m.air.height > 1 ? 1.4 : 0.6));
      s.tension = Math.max(0.2, s.tension - 0.15);
      hooks.bow?.();
    }
    if (k >= 1) {
      const p = fishPoint();
      splashes.splash(p.x, p.z, m.air.height > 1 ? 1.8 : 0.5);
      water.addRipple(p.x, p.z, m.air.height > 1 ? 1.5 : 0.5);
      if (!s.bowed && m.spikeNoBow) s.tension = Math.min(1, s.tension + m.spikeNoBow * (input.reeling ? 1 : 0.35));
      if (m.air.height > 1) hooks.shake(0.3);
      s.hop += 1;
      s.bowed = false;
      if (s.hop >= m.air.hops) { fish.airY = 0; s.bowWindow = false; s.moveT = s.moveDur; }
    }
  }

  function applyFishPose(dt) {
    const p = fishPoint();
    fish.pos.x = p.x;
    fish.pos.z = p.z;
    const away = s.angle;
    const targetHeading = s.landing ? away + Math.PI : away + s.side * 0.55;
    const d = Math.atan2(Math.sin(targetHeading - fish.heading), Math.cos(targetHeading - fish.heading));
    fish.heading += d * (1 - Math.exp(-6 * dt));
    fish.turnRate = d * 2;
    fish.speed = s.landing ? 0.6 : 0.8 + pullBase * (s.move?.pull ?? 1);
    const water = island.waterDepthAt(p.x, p.z);
    let depth = 0.45;
    const m = s.move;
    if (m?.depth === 'bottom') depth = Math.max(0.4, water - 0.2);
    else if (typeof m?.depth === 'number') depth = Math.min(m.depth, water - 0.2);
    if (s.landing) depth = 0.15;
    fish.depthTarget = Math.max(0.15, depth);
    fish.swim.set(s.landing ? 'tired' : (m?.swim || (s.tension > 0.6 ? 'thrash' : 'run')));
  }

  const api = {
    state: s,
    update,
    fishPoint,
    get power() { return power; },
    get lateral() { return lateralScreenX(); },
    get boss() { return boss; },
    // A predator got hooked on top of the fish (double/triple catch): more pull, more fight left.
    addLoad(addStrength, behaviour, share = {}) {
      const pull = (behaviour?.pull ?? 0.4) * addStrength * (share.pullShare ?? 0.8);
      const pool = (behaviour?.stamina ?? 8) * (0.85 + (addStrength - 0.85) * 1.2) * (share.staminaShare ?? 1);
      const left = s.stamina * staminaPool;
      staminaPool += pool;
      pullBase += pull;
      s.stamina = Math.min(1, (left + pool) / staminaPool);
      if (share.learnMoves !== false) for (const id of behaviour?.moves || []) if (MOVES[id] && !moveIds.includes(id)) moveIds.push(id);
    },
  };
  return api;
}

// Weight roll and size class. A perfect cast nudges the roll up.
export function rollCatch(info, perfect) {
  let u = Math.pow(Math.random(), 1.7);
  if (perfect) u = Math.max(u, Math.pow(Math.random(), 1.2));
  const [lo, hi] = info.weight;
  const weight = Math.round((lo + (hi - lo) * u) * 100) / 100;
  const sizeClass = u < 0.3 ? 'small' : u < 0.75 ? 'normal' : u < 0.95 ? 'large' : 'trophy';
  const strength = 0.85 + 0.35 * u;
  return { weight, sizeClass, strength };
}
