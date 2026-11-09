// Fish AI: population by habitat / depth band / time of day, personalities around the lure
// (approach, circle, nibble, bite), schools that skip over the surface, flee and respawn.
// Fish are drawn as silhouettes until their model exists in Agent C's manifest.
import * as THREE from 'three';
import { createSwimState, applySwimToModel } from './swim.js';
import { cellIndex } from './silhouettes.js';
import { fishInfo, rosterFor, TIER_POPULATION, TIER_RANK, timeAllows } from './fishData.js';
import { loadModel, hasAsset, rawAssetEntry } from '../core/assets.js';
import { rollVariant } from './variants.js';
import { masteryConfig } from './mastery.js';

const GIANT_CHANCE = 0.04;   // giants of their kind (fishAgents makeFish, fight.js rollCatch)

const PERSONALITY = {
  shy: { notice: 4.5, approach: 0.75, circles: [2.2, 3.8], spook: 1.8, loseInterest: 0.15 },
  greedy: { notice: 7.5, approach: 1.6, circles: [0.3, 1.0], spook: 0.5, loseInterest: 0 },
  cautious: { notice: 5.5, approach: 0.9, circles: [1.5, 3.0], spook: 1.2, loseInterest: 0.3 },
  aggressive: { notice: 6.5, approach: 2.2, circles: [0, 0.25], spook: 0.2, loseInterest: 0 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let uidCounter = 0;
// Fish read larger than life from the high camera (the key art does the same).
const DISPLAY_SCALE = 1.5;

export function createFishSystem({ state, island, water, splashes, events, under, shadows, lighting, audio }) {
  const fish = [];
  const habitats = island.layout.habitats;
  let lure = null;          // { x, z, perfect, t0 }
  let engaged = null;       // fish working the lure
  let engageTimer = 0;
  let populationTimer = 0;
  let worldTime = 0;
  const listeners = { nibble: new Set() };
  // Co-op: the host simulates fish; visitors render the host's snapshots (Agent H).
  let authority = true;
  const netTargets = new Map(); // uid -> latest snapshot entry (visitors)

  // Where the player is looking (camera target): new fish favour areas near it, so the water you
  // can see is busy even though the habitats now ring the whole island.
  const viewer = { x: 0, z: 0, set: false };
  function pickArea(areas) {
    if (!viewer.set || areas.length < 3) return areas[Math.floor(Math.random() * areas.length)];
    let total = 0;
    const w = areas.map((a) => { const d = Math.hypot(a.x - viewer.x, a.z - viewer.z); const v = 1 / (1 + (d / 22) ** 2); total += v; return v; });
    let r = Math.random() * total;
    for (let i = 0; i < areas.length; i++) { r -= w[i]; if (r <= 0) return areas[i]; }
    return areas[areas.length - 1];
  }

  function areaPoint(habitatName, minDepth) {
    const hab = habitats[habitatName] || habitats.mid;
    for (let tries = 0; tries < 40; tries++) {
      const area = pickArea(hab.areas);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * area.r;
      const x = area.x + Math.cos(a) * r, z = area.z + Math.sin(a) * r;
      if (island.waterDepthAt(x, z) >= Math.max(1.2, minDepth ?? hab.minDepth)) return { x, z, area };
    }
    // Every try landed on land (a plot rose over this habitat): any water point in any habitat.
    for (const h of Object.values(habitats)) for (const area of h.areas) {
      if (island.waterDepthAt(area.x, area.z) >= 1) return { x: area.x, z: area.z, area };
    }
    const area = hab.areas[0];
    return { x: area.x, z: area.z, area };
  }

  // The deepest direction from here (fish that hit the shore swim out to sea, not toward a home
  // that new land may now cover).
  function deeperHeading(x, z) {
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = island.waterDepthAt(x + Math.sin(a) * 2.5, z + Math.cos(a) * 2.5);
      if (!best || d > best.d) best = { a, d };
    }
    return best.a;
  }

  function depthFor(f, x, z) {
    const water = island.waterDepthAt(x, z);
    const hab = f.behaviour.habitat;
    if (hab === 'bottom') return Math.max(0.25, water - 0.18);
    if (hab === 'surface') return Math.min(water - 0.2, 0.35 + Math.random() * 0.3);
    const [a, b] = f.info.depth;
    // Fish keep to the upper water so the silhouettes stay readable; the band still orders them.
    const d = Math.min(1.8, 0.4 + (a + Math.random() * (b - a)) * 0.22);
    return Math.max(0.3, Math.min(d, water - 0.25));
  }

  function makeFish(id, at = null, school = null, variant = null, forcedUid = null) {
    const info = fishInfo(state, id);
    const behaviour = info.behaviour;
    if (!behaviour) return null;
    const habitat = behaviour.habitat || 'mid';
    const p = at || areaPoint(habitat);
    const swim = createSwimState(behaviour);
    const glow = behaviour.glow ? new THREE.Color(behaviour.glow.color) : null;
    if (forcedUid && forcedUid > uidCounter) uidCounter = forcedUid;
    // Every fish has its own size, and you can see it: a bigger shadow is a heavier catch. One in
    // ~25 is a giant of its kind (well past the normal range). Schools share their leader's size.
    let sizeU = school?.leader?.sizeU != null ? Math.max(0, Math.min(1, school.leader.sizeU + rand(-0.1, 0.1))) : Math.pow(Math.random(), 1.5);
    if (!school && Math.random() < GIANT_CHANCE * (Math.hypot(p.x, p.z) > 35 ? 2 : 1)) sizeU = 1 + rand(0.15, 0.6);
    const sizeLook = (0.72 + 0.56 * Math.min(1, sizeU)) * (sizeU > 1 ? 1 + (sizeU - 1) * 1.6 : 1);
    const f = {
      uid: forcedUid || ++uidCounter,
      id,
      info,
      behaviour,
      personality: PERSONALITY[behaviour.personality] || PERSONALITY.cautious,
      pos: new THREE.Vector3(p.x, 0, p.z),
      heading: Math.random() * Math.PI * 2,
      speed: 0,
      turnRate: 0,
      depth: 0.6,
      depthTarget: 0.6,
      home: p.area || { x: p.x, z: p.z, r: 5 },
      wander: null,
      state: 'wander',
      stateTime: 0,
      timer: rand(1, 3),
      swim,
      length: (behaviour.length || 0.8) * DISPLAY_SCALE * sizeLook,
      sizeU,
      fade: 0,
      highlight: 0,
      retract: 0,
      inflate: 0,
      air: null,            // skip/leap: { t, dur, height, hops }
      controlled: false,    // fight system drives it
      cooldown: 0,
      school,
      slot: null,
      shadow: null,
      // Elemental fish: 3x as common as the base tables near shore, up to 10x far out at sea (Casper 9 Nov: "way too rare").
      variant: variant || rollVariant(state, state.world.islandId, state.world.weather, 3 + 7 * THREE.MathUtils.smoothstep(Math.hypot(p.x, p.z), 22, 60)),
      object: null,          // anchor Object3D (Agent E attaches variant looks here)
      model: null,
      swimUniforms: null,
      gone: false,
    };
    f.depth = f.depthTarget = depthFor(f, p.x, p.z);
    // Elemental fish glow their element's colour through the water, so you can spot and chase them.
    const look = state.data?.variantsLook?.[f.variant];
    f.elementGlow = look?.kind === 'element' && look.color ? new THREE.Color(look.color) : null;
    f.shadow = shadows.acquire({
      cell: cellIndex(behaviour.silhouette || 'generic'),
      body: swim.bodyId,
      glow: f.elementGlow ? f.elementGlow.clone().multiplyScalar(0.9) : glow ? glow.multiplyScalar(behaviour.glow.strength ?? 0.6) : null,
    });
    if (f.shadow === null) return null;
    f.object = new THREE.Group();
    f.object.name = `fish:${id}#${f.uid}`;
    f.object.userData = { uid: f.uid, fishId: id, variant: f.variant, length: f.length, body: swim.body, hasModel: false, depth: f.depth };
    f.object.position.set(f.pos.x, -f.depth, f.pos.z);
    under.add(f.object);
    attachModel(f);
    fish.push(f);
    events.emit('fish:spawn', { uid: f.uid, fishId: id, variant: f.variant, object: f.object });
    return f;
  }

  async function attachModel(f) {
    const modelId = f.info.model;
    if (!hasAsset('fish', modelId)) return;
    const m = await loadModel('fish', modelId);
    if (!m || f.gone) return;
    f.model = m.scene;
    f.model.scale.multiplyScalar(f.length);
    f.swimUniforms = applySwimToModel(f.model, f.swim.body);
    f.object.add(f.model);
    f.object.userData.hasModel = true;
  }

  function spawnSchool(id) {
    const info = fishInfo(state, id);
    const [a, b] = info.behaviour.school || [5, 7];
    const n = randInt(a, b);
    const leader = makeFish(id);
    if (!leader) return;
    const school = { leader, members: [leader], skipTimer: rand(5, 11) };
    leader.school = school;
    for (let i = 1; i < n; i++) {
      const slot = { x: rand(-0.9, 0.9), z: -0.45 * i + rand(-0.3, 0.3) };
      const f = makeFish(id, { x: leader.pos.x + slot.x, z: leader.pos.z + slot.z, area: leader.home }, school);
      if (!f) break;
      f.slot = slot;
      f.heading = leader.heading;
      f.depth = f.depthTarget = leader.depth + rand(-0.08, 0.08);
      school.members.push(f);
    }
  }

  function removeFish(f) {
    if (f.gone) return;
    f.gone = true;
    shadows.release(f.shadow);
    f.shadow = null;
    events.emit('fish:despawn', { uid: f.uid, fishId: f.id, variant: f.variant, object: f.object });
    f.object.removeFromParent();
    const i = fish.indexOf(f);
    if (i >= 0) fish.splice(i, 1);
    if (engaged === f) engaged = null;
    if (f.school) {
      f.school.members = f.school.members.filter((m) => m !== f);
      if (f.school.leader === f && f.school.members.length) {
        f.school.leader = f.school.members[0];
        f.school.leader.slot = null;
      }
    }
  }

  // Keep each species at its population for the current hour.
  function maintainPopulation() {
    // Recycle: a lone fish far out of view (and not busy) makes room for one near the player.
    if (viewer.set) {
      for (const f of fish) {
        if (f.controlled || f === engaged || f.school || f.gone || f.held || f.hotspot) continue;
        if (Math.hypot(f.pos.x - viewer.x, f.pos.z - viewer.z) > 62) { removeFish(f); break; }
      }
    }
    const roster = rosterFor(state, state.world.islandId);
    const hour = lighting.hour;
    let budget = fish.length < 40 ? 4 : 1;
    for (const id of roster) {
      const info = fishInfo(state, id);
      if (!info.behaviour || !timeAllows(info.time, hour)) continue;
      const target = TIER_POPULATION[info.tier] ?? 1;
      const isSchool = Boolean(info.behaviour.school);
      // Hot-spot fish (sea.js) are extra: they don't count against the island's population.
      const count = isSchool
        ? new Set(fish.filter((f) => f.id === id && f.school && !f.hotspot).map((f) => f.school)).size
        : fish.filter((f) => f.id === id && !f.hotspot).length;
      if (count < target) {
        if (isSchool) spawnSchool(id); else makeFish(id);
        // Staggered fade-in, but never an empty sea: fill fast while the water is thin.
        if (--budget <= 0) return;
      }
    }
  }

  function steerTo(f, tx, tz, dt, turn) {
    const desired = Math.atan2(tx - f.pos.x, tz - f.pos.z);
    const d = wrapAngle(desired - f.heading);
    const step = THREE.MathUtils.clamp(d, -turn * dt, turn * dt);
    f.heading = wrapAngle(f.heading + step);
    f.turnRate = step / Math.max(dt, 1e-4);
  }

  function advance(f, dt) {
    const nx = f.pos.x + Math.sin(f.heading) * f.speed * dt;
    const nz = f.pos.z + Math.cos(f.heading) * f.speed * dt;
    // Never swim onto the beach or into the sandy shallows (Casper 9 Nov: fish sat inside the island's
    // shallow edge): at least 0.9 m of water, more for big fish, measured at the nose.
    const minD = Math.max(0.9 + f.length * 0.35, (habitats[f.behaviour.habitat]?.minDepth ?? 1) * 0.6);
    const reach = f.length * 0.5;
    const ahead = island.waterDepthAt(nx + Math.sin(f.heading) * reach, nz + Math.cos(f.heading) * reach);
    if (!f.controlled && ahead < minD && f.state !== 'bite') {
      const homeWet = island.waterDepthAt(f.home.x, f.home.z) >= minD;
      if (homeWet) steerTo(f, f.home.x, f.home.z, dt, 6);
      else {
        // Its home is land now: find new water and make it home.
        const a = deeperHeading(f.pos.x, f.pos.z);
        f.heading = wrapAngle(f.heading + THREE.MathUtils.clamp(wrapAngle(a - f.heading), -6 * dt, 6 * dt));
        f.pos.x += Math.sin(f.heading) * Math.max(1, f.speed) * dt;
        f.pos.z += Math.cos(f.heading) * Math.max(1, f.speed) * dt;
        if (island.waterDepthAt(f.pos.x, f.pos.z) >= minD + 0.5) f.home = { x: f.pos.x, z: f.pos.z, r: 4 };
      }
      f.wander = null;
      return;
    }
    f.pos.x = nx;
    f.pos.z = nz;
  }

  function setState(f, s, timer = 0) {
    f.state = s;
    f.stateTime = 0;
    f.timer = timer;
  }

  function flee(f, fromX, fromZ) {
    const a = Math.atan2(f.pos.x - fromX, f.pos.z - fromZ);
    f.heading = a;
    setState(f, 'flee', rand(1.4, 2.2));
    f.cooldown = rand(8, 14);
    if (engaged === f) engaged = null;
  }

  // --- behaviour per state -------------------------------------------------------------
  function updateWander(f, dt) {
    const cruise = f.behaviour.cruise || 0.8;
    if (f.school && f.slot && f.school.leader !== f) {
      const L = f.school.leader;
      const c = Math.cos(L.heading), s = Math.sin(L.heading);
      const tx = L.pos.x + f.slot.x * c + f.slot.z * s;
      const tz = L.pos.z - f.slot.x * s + f.slot.z * c;
      const dist = Math.hypot(tx - f.pos.x, tz - f.pos.z);
      steerTo(f, tx, tz, dt, 5);
      f.speed += ((L.speed + dist * 0.9) - f.speed) * (1 - Math.exp(-4 * dt));
      f.swim.set('idle');
      return;
    }
    // Driftback-style "lie still like driftwood".
    if (f.behaviour.idleStill && f.timer <= 0) {
      if (f.state === 'still') { setState(f, 'wander', rand(3, 6)); }
      else if (Math.random() < f.behaviour.idleStill) { setState(f, 'still', rand(2.5, 5)); }
      else f.timer = rand(3, 6);
    }
    if (f.state === 'still') {
      f.speed *= Math.exp(-3 * dt);
      f.swim.set('still');
      return;
    }
    if (!f.wander || Math.hypot(f.wander.x - f.pos.x, f.wander.z - f.pos.z) < 0.6) {
      const p = areaPoint(f.behaviour.habitat || 'mid');
      // Stay near home most of the time.
      f.wander = Math.random() < 0.8 && p.area !== f.home
        ? { x: f.home.x + rand(-1, 1) * f.home.r, z: f.home.z + rand(-1, 1) * f.home.r }
        : { x: p.x, z: p.z };
      if (island.waterDepthAt(f.wander.x, f.wander.z) < 0.6) f.wander = { x: p.x, z: p.z };
      f.cruiseNow = cruise * rand(0.6, 1.1);
    }
    steerTo(f, f.wander.x, f.wander.z, dt, 1.6);
    f.speed += ((f.cruiseNow || cruise) - f.speed) * (1 - Math.exp(-2 * dt));
    f.swim.set('idle');

    // Schools skip across the surface like thrown pebbles.
    if (f.school && f.school.leader === f) {
      f.school.skipTimer -= dt;
      if (f.school.skipTimer <= 0) {
        f.school.skipTimer = rand(7, 14);
        f.school.members.forEach((m, i) => {
          if (!m.controlled && !m.air && (m.state === 'wander')) {
            m.air = { t: -i * 0.09, dur: 0.36, height: rand(0.25, 0.4), hops: randInt(2, 4), skip: true };
          }
        });
      }
    }
  }

  function updateAir(f, dt) {
    const a = f.air;
    a.t += dt;
    if (a.t < 0) return;
    if (!a.started) {
      a.started = true;
      splashes.splash(f.pos.x, f.pos.z, 0.25, { x: Math.sin(f.heading), z: Math.cos(f.heading) });
      water.addRipple(f.pos.x, f.pos.z, 0.4);
    }
    const k = Math.min(1, a.t / a.dur);
    f.airY = Math.sin(k * Math.PI) * a.height;
    f.speed = 4.2;
    f.swim.set('leap');
    if (k >= 1) {
      water.addRipple(f.pos.x, f.pos.z, 0.45);
      splashes.splash(f.pos.x, f.pos.z, 0.3);
      a.hops -= 1;
      if (a.hops > 0) { a.t = -0.06; a.started = false; }
      else { f.air = null; f.airY = 0; }
    }
  }

  function updateEngaged(f, dt) {
    const L = lure;
    if (!L) { setState(f, 'wander', rand(2, 4)); engaged = null; return; }
    const dx = L.x - f.pos.x, dz = L.z - f.pos.z;
    const dist = Math.hypot(dx, dz);
    const P = f.personality;
    const cruise = f.behaviour.cruise || 0.8;
    switch (f.state) {
      case 'approach': {
        const ang = Math.atan2(f.pos.x - L.x, f.pos.z - L.z);
        steerTo(f, L.x + Math.sin(ang) * 0.9, L.z + Math.cos(ang) * 0.9, dt, 3.2);
        f.speed += (cruise * 1.5 * P.approach + 0.4 - f.speed) * (1 - Math.exp(-3 * dt));
        f.swim.set('inspect');
        f.depthTarget = Math.max(0.25, Math.min(f.depthTarget, 0.55));
        if (dist < 1.4) {
          setState(f, 'inspect', rand(P.circles[0], P.circles[1]));
          f.circleDir = Math.random() < 0.5 ? -1 : 1;
        }
        break;
      }
      case 'inspect': {
        const ang = Math.atan2(f.pos.x - L.x, f.pos.z - L.z) + f.circleDir * 1.1 * dt * 3;
        const r = 0.85 + Math.sin(f.stateTime * 1.7) * 0.15;
        steerTo(f, L.x + Math.sin(ang) * r, L.z + Math.cos(ang) * r, dt, 4.5);
        f.speed += (0.65 - f.speed) * (1 - Math.exp(-3 * dt));
        f.swim.set('inspect');
        if (f.timer <= 0) {
          if (Math.random() < P.loseInterest) {
            flee(f, L.x, L.z);
            f.state = 'leave';
            engageTimer = rand(1.5, 3);
          } else {
            const [a, b] = f.behaviour.nibbles || [1, 3];
            f.nibblesLeft = randInt(a, b);
            setState(f, 'nibble', 0);
            f.nibblePhase = 'in';
          }
        }
        break;
      }
      case 'nibble': {
        if (f.nibblesLeft <= 0) { setState(f, 'strike', 0); break; }
        if (f.nibblePhase === 'in') {
          steerTo(f, L.x, L.z, dt, 7);
          f.speed += (1.4 - f.speed) * (1 - Math.exp(-6 * dt));
          f.swim.set('nibble');
          if (dist < 0.22 + f.length * 0.35) {
            f.nibblePhase = 'out';
            f.timer = rand(0.5, 1.0);
            f.nibblesLeft -= 1;
            water.addRipple(L.x, L.z, 0.28);
            for (const fn of listeners.nibble) fn(f);
          }
        } else {
          const ang = Math.atan2(f.pos.x - L.x, f.pos.z - L.z);
          steerTo(f, L.x + Math.sin(ang) * 0.8, L.z + Math.cos(ang) * 0.8, dt, 5);
          f.speed += (0.5 - f.speed) * (1 - Math.exp(-4 * dt));
          f.swim.set('inspect');
          if (f.timer <= 0) f.nibblePhase = 'in';
        }
        break;
      }
      case 'strike': {
        steerTo(f, L.x, L.z, dt, 9);
        f.speed += (2.6 * Math.max(1, P.approach) - f.speed) * (1 - Math.exp(-8 * dt));
        f.swim.set('bite');
        if (dist < 0.2 + f.length * 0.35) {
          setState(f, 'bite', f.behaviour.hookWindow || 0.8);
          f.biteWindow = f.timer;
          splashes.splash(L.x, L.z, 0.9);
          water.addRipple(L.x, L.z, 1.2);
          water.addRipple(L.x, L.z, 0.7, 0.18);
          events.emit('bite', { fishId: f.id });
        }
        break;
      }
      case 'bite': {
        // Holding the lure: thrash in place, tugging it under.
        f.speed *= Math.exp(-6 * dt);
        f.pos.x += (L.x - Math.sin(f.heading) * f.length * 0.35 - f.pos.x) * (1 - Math.exp(-10 * dt));
        f.pos.z += (L.z - Math.cos(f.heading) * f.length * 0.35 - f.pos.z) * (1 - Math.exp(-10 * dt));
        f.swim.set('thrash');
        if (f.timer <= 0) {
          events.emit('hook:result', { fishId: f.id, success: false });
          events.emit('fish:lost', { fishId: f.id, variant: f.variant, reason: 'escape' });
          flee(f, L.x, L.z);
          engageTimer = rand(2, 4);
        }
        break;
      }
      default:
        break;
    }
  }

  // The last few species landed (variety weighting in pickEngager).
  const recentCatches = [];
  events.on('fish:caught', ({ fishId } = {}) => { if (fishId) { recentCatches.push(fishId); if (recentCatches.length > 5) recentCatches.shift(); } });

  function pickEngager() {
    if (!lure) return null;
    const bait = state.gear?.baitId;
    const candidates = [];
    for (const f of fish) {
      if (f.controlled || f.cooldown > 0 || f.air || f.state === 'flee') continue;
      if (f.school && f.school.leader !== f && Math.random() < 0.6) continue;
      const d = Math.hypot(f.pos.x - lure.x, f.pos.z - lure.z);
      const baitBonus = f.info.bait.length ? (f.info.bait.includes(bait) ? 1.5 : 0.7) : 1;
      // A taunted lure (rhythmic twitches) is noticed from much further away.
      const taunt = lure.taunt || 0;
      if (d > f.personality.notice * baitBonus * (1 + taunt * 1.2)) continue;
      const rank = TIER_RANK[f.info.tier] ?? 0;
      // Rarer fish are less likely; a perfect cast tilts the odds towards them.
      let w = (1 / (1 + rank * 1.2)) * baitBonus * (1.3 - d / (f.personality.notice * 1.6));
      if (lure.perfect) w *= 1 + rank * 0.8;
      if (taunt) w *= 1 + rank * taunt * 1.4;
      // Variety: species you just caught bite less, ones missing from your Fishdex bite more.
      const recent = recentCatches.filter((id) => id === f.id).length;
      if (recent) w *= Math.pow(0.45, recent);
      if (!state.profile?.fishdex?.[f.id]) w *= 1.6;
      // Lucky streak from Great/Perfect fights: rarer species bite more often.
      const luck = state.world.luck || 0;
      if (luck) { const st = masteryConfig(state).streak; w *= 1 + rank * luck * (st.rareWeight + (lure.perfect ? st.perfectCastWeight : 0)); }
      candidates.push({ f, w: Math.max(0.01, w) });
    }
    if (!candidates.length) return null;
    let total = candidates.reduce((s, c) => s + c.w, 0);
    let r = Math.random() * total;
    for (const c of candidates) { r -= c.w; if (r <= 0) return c.f; }
    return candidates[0].f;
  }

  function updateVisual(f, dt) {
    const surfaceY = water.surfaceY(f.pos.x, f.pos.z, worldTime);
    f.swim.update(dt, f.speed, f.turnRate);
    f.depth += (f.depthTarget - f.depth) * (1 - Math.exp(-1.5 * dt));
    const airY = f.airY || 0;
    const y = airY > 0 ? surfaceY + airY : surfaceY - f.depth;
    f.fade = Math.min(1, f.fade + dt * 0.8);
    if (f.fadeOut) f.fade = Math.max(0, f.fade - dt * 1.4);
    f.highlight += ((f.highlightTarget || 0) - f.highlight) * (1 - Math.exp(-10 * dt));
    // Camouflage (kelp wraith): faint while slow, shows itself when it moves.
    const camo = f.behaviour.camouflage ? THREE.MathUtils.lerp(f.behaviour.camouflage, 1, Math.min(1, f.speed / 1.2)) : 1;
    const depthOpacity = THREE.MathUtils.lerp(0.86, 0.34, THREE.MathUtils.smoothstep(f.depth, 0.3, 6));
    const inAir = airY > 0.02 || f.held;
    const glowBase = f.elementGlow ? 0.7 + 0.3 * Math.sin(worldTime * 4 + f.uid) : f.behaviour.glow ? (f.behaviour.glow.dusk ? 0.25 + 0.75 * lighting.dusk : 1) : 0;
    shadows.set(f.shadow,
      { x: f.pos.x, y: inAir ? -0.05 : y, z: f.pos.z, heading: f.heading, length: f.length * (1 + f.inflate * 0.15), width: 1 },
      { phase: f.swim.phase(), amp: f.swim.amp, freq: f.swim.base.freq, bend: f.swim.bend, retract: f.retract, inflate: f.inflate },
      {
        opacity: (f.model || inAir ? 0 : depthOpacity * camo) * f.fade,
        highlight: f.highlight,
        blur: Math.min(3, f.depth * 0.5),
        glow: glowBase * f.fade * (inAir ? 0 : 1),
      });
    if (!f.held) {
      f.object.position.set(f.pos.x, y, f.pos.z);
      f.object.rotation.set(f.pitch || 0, f.heading, f.roll || 0, 'YXZ');
    }
    f.object.userData.depth = inAir ? -airY : f.depth;
    f.object.userData.inAir = inAir;
    f.object.userData.fade = f.fade;
    if (f.model) {
      const u = f.swimUniforms;
      u.uSwimA.value.set(f.swim.bodyId, f.swim.phase(), f.swim.amp, f.swim.base.freq);
      u.uSwimB.value.set(f.swim.bend, f.retract, f.inflate, 0);
      f.model.visible = f.fade > 0.05;
    }
  }

  function update(dt, time) {
    worldTime = time;
    populationTimer -= dt;
    if (authority && populationTimer <= 0) { populationTimer = 0.7; maintainPopulation(); }

    if (authority && lure && !engaged) {
      engageTimer -= dt;
      if (engageTimer <= 0) {
        const f = pickEngager();
        if (f) {
          engaged = f;
          f.wander = null;
          setState(f, 'approach');
          if (f.air) { f.air = null; f.airY = 0; }
        }
        engageTimer = rand(1.2, 2.4);
      }
    }

    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      f.stateTime += dt;
      f.timer -= dt;
      f.cooldown = Math.max(0, f.cooldown - dt);
      if (!authority && !f.controlled && f !== engaged) {
        followSnapshot(f, dt);
      } else if (f.remote) {
        // Fought by another player: their snapshots drive it (host side).
        followSnapshot(f, dt);
      } else if (!f.controlled && !f.air && f !== engaged && island.waterDepthAt(f.pos.x, f.pos.z) < 0.6) {
        // Land rose right on top of it: it's gone, the population brings a new one in open water.
        // In the sandy shallows (or under land that rose): swim straight out; if it can't, it's gone.
        f.stranded = (f.stranded || 0) + dt;
        const a = deeperHeading(f.pos.x, f.pos.z);
        f.heading = wrapAngle(f.heading + THREE.MathUtils.clamp(wrapAngle(a - f.heading), -8 * dt, 8 * dt));
        f.pos.x += Math.sin(f.heading) * 2.5 * dt;
        f.pos.z += Math.cos(f.heading) * 2.5 * dt;
        if (f.stranded > 2.5 || island.waterDepthAt(f.pos.x, f.pos.z) < 0.15) { removeFish(f); continue; }
      } else if (!f.controlled) {
        f.stranded = 0;
        if (f.air) updateAir(f, dt);
        else if (f === engaged) updateEngaged(f, dt);
        else if (f.state === 'flee' || f.state === 'leave') {
          f.speed += (3.4 - f.speed) * (1 - Math.exp(-5 * dt));
          f.swim.set('run');
          f.depthTarget = Math.min(f.depthTarget + dt * 0.4, 1.6);
          if (f.timer <= 0) { setState(f, 'wander', rand(2, 4)); f.wander = null; }
        } else updateWander(f, dt);
        if (!f.air) f.airY = 0;
        advance(f, dt);
        if (!f.air && f.state === 'wander' && Math.random() < dt * 0.02) f.depthTarget = depthFor(f, f.pos.x, f.pos.z);
      }
      updateVisual(f, dt);
      if (f.fadeOut && f.fade <= 0) removeFish(f);
    }
    shadows.commit(time);
  }

  function followSnapshot(f, dt) {
    const t = netTargets.get(f.uid);
    if (!t) return;
    const k = 1 - Math.exp(-8 * dt);
    const dx = t.x - f.pos.x, dz = t.z - f.pos.z;
    f.pos.x += dx * k;
    f.pos.z += dz * k;
    f.speed = Math.min(4, Math.hypot(dx, dz) * 4);
    const dh = Math.atan2(Math.sin(t.heading - f.heading), Math.cos(t.heading - f.heading));
    f.heading += dh * k;
    f.turnRate = dh * 2;
    f.depthTarget = t.depth;
    f.airY = t.airY || 0;
    f.retract = t.retract || 0;
    f.inflate = t.inflate || 0;
    f.swim.set(t.swim || 'idle');
  }

  function snapshot() {
    return fish.filter((f) => !f.gone).map((f) => ({
      uid: f.uid, id: f.id, variant: f.variant,
      x: +f.pos.x.toFixed(2), z: +f.pos.z.toFixed(2), heading: +f.heading.toFixed(3),
      depth: +f.depth.toFixed(2), airY: +(f.airY || 0).toFixed(2), length: +f.length.toFixed(2),
      state: f.state, swim: f.swim.stateName, retract: +f.retract.toFixed(2), inflate: +f.inflate.toFixed(2),
      remote: f.remote || null,
    }));
  }

  // Visitors: create/update/remove local fish to mirror the host.
  function applySnapshot(list) {
    if (!Array.isArray(list)) return;
    const seen = new Set();
    for (const e of list) {
      if (!e || typeof e.uid !== 'number') continue;
      seen.add(e.uid);
      netTargets.set(e.uid, e);
      let f = fish.find((c) => c.uid === e.uid);
      if (!f) {
        f = makeFish(e.id, { x: e.x, z: e.z, area: { x: e.x, z: e.z, r: 5 } }, null, e.variant, e.uid);
        if (!f) continue;
        f.heading = e.heading;
        f.depth = f.depthTarget = e.depth;
        if (e.length) f.length = e.length;
      }
    }
    for (const f of [...fish]) {
      if (!seen.has(f.uid) && !f.controlled && f !== engaged) removeFish(f);
    }
  }

  return {
    get list() { return fish; },
    get authority() { return authority; },
    setAuthority(on) {
      authority = Boolean(on);
      if (!authority) { for (const f of [...fish]) if (!f.controlled) removeFish(f); }
      netTargets.clear();
    },
    snapshot,
    applySnapshot,
    // Co-op bite: playerId omitted/local → this fish bites our lure now;
    // another player → the host stops simulating it (that player's fight drives it).
    netBite(uid, playerId, localId) {
      const f = fish.find((c) => c.uid === uid);
      if (!f || f.controlled || f.gone) return false;
      if (playerId && playerId !== localId) {
        f.remote = playerId;
        if (engaged === f) engaged = null;
        return true;
      }
      if (!lure) return false;
      if (engaged && engaged !== f && !engaged.controlled) setState(engaged, 'wander', 2);
      engaged = f;
      f.fade = 1;
      setState(f, 'strike', 0);
      return true;
    },
    setRemoteTarget(e) { if (e && typeof e.uid === 'number') netTargets.set(e.uid, e); },
    releaseRemote(uid) { const f = fish.find((c) => c.uid === uid); if (f) f.remote = null; },
    get engaged() { return engaged; },
    update,
    onNibble(fn) { listeners.nibble.add(fn); return () => listeners.nibble.delete(fn); },
    setLure(l) {
      lure = l;
      if (!l) {
        if (engaged && !engaged.controlled) { setState(engaged, 'wander', 2); engaged = null; }
        return;
      }
      engageTimer = rand(0.8, 2.8) * (l.perfect ? 0.55 : 1) / Math.max(0.5, l.attraction || 1);
      // A splash right on top of shy fish scares them off.
      for (const f of fish) {
        const d = Math.hypot(f.pos.x - l.x, f.pos.z - l.z);
        if (!f.controlled && d < f.personality.spook) flee(f, l.x, l.z);
      }
    },
    moveLure(x, z) { if (lure) { lure.x = x; lure.z = z; } },
    // Tap during the wait: hook a biting fish, or spook one that is only inspecting.
    /**
     * The player twitched the lure (taunting). good = on the beat. A good twitch makes a curious fish
     * commit sooner; a sloppy or frantic one can spook it. Returns 'spooked' | 'teased' | 'none'.
     */
    twitch(good, frantic = false) {
      if (!lure) return 'none';
      water.addRipple(lure.x, lure.z, good ? 0.45 : 0.3);
      const f = engaged;
      if (!f || f.controlled) return 'none';
      if (['approach', 'inspect', 'nibble'].includes(f.state)) {
        const spook = frantic ? 0.7 : good ? 0 : 0.3 * (f.personality.spook || 1);
        if (Math.random() < spook) {
          events.emit('fish:lost', { fishId: f.id, variant: f.variant, reason: 'spooked' });
          flee(f, lure.x, lure.z);
          engageTimer = rand(2, 3.5);
          return 'spooked';
        }
        if (good) {
          // Teased into it: fewer nibbles, it goes for the strike.
          if (f.state === 'nibble') f.nibblesLeft = Math.max(0, (f.nibblesLeft || 0) - 1);
          else f.timer = Math.min(f.timer, 0.3);
          return 'teased';
        }
      }
      return 'none';
    },
    /** Where the player is looking (camera target), for spawn placement near them. */
    setViewer(x, z) { viewer.x = x; viewer.z = z; viewer.set = true; },
    /** Spawn a fish right here (hot spots: sea.js). Returns the fish or null. */
    spawnAt(id, x, z, { variant = null, school = false, r = 5 } = {}) {
      const area = { x, z, r };
      if (school && fishInfo(state, id).behaviour?.school) {
        const leader = makeFish(id, { x, z, area }, null, variant);
        if (!leader) return null;
        const [a, b] = fishInfo(state, id).behaviour.school;
        const sc = { leader, members: [leader], skipTimer: rand(5, 11) };
        leader.school = sc;
        for (let i = 1; i < randInt(a, b); i++) {
          const slot = { x: rand(-0.9, 0.9), z: -0.45 * i + rand(-0.3, 0.3) };
          const m = makeFish(id, { x: x + slot.x, z: z + slot.z, area }, sc, variant);
          if (!m) break;
          m.slot = slot; m.heading = leader.heading; m.depth = m.depthTarget = leader.depth + rand(-0.08, 0.08);
          sc.members.push(m);
        }
        return leader;
      }
      return makeFish(id, { x, z, area }, null, variant);
    },
    /** A full taunt can call something rare in from further out (once per cast). */
    summonRare(minRank = 2) {
      if (!lure) return null;
      const hour = lighting.hour;
      const ids = rosterFor(state, state.world.islandId).filter((id) => {
        const info = fishInfo(state, id);
        const r = TIER_RANK[info.tier] ?? 0;
        return r >= minRank && info.tier !== 'boss' && info.behaviour && timeAllows(info.time, hour);
      });
      if (!ids.length) return null;
      const id = ids[Math.floor(Math.random() * ids.length)];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = rand(5, 8);
        const x = lure.x + Math.sin(a) * r, z = lure.z + Math.cos(a) * r;
        if (island.waterDepthAt(x, z) > 1.5) {
          const f = makeFish(id, { x, z, area: { x, z, r: 4 } });
          if (engaged && !engaged.controlled) { setState(engaged, 'wander', 2); }
          engaged = f;
          setState(f, 'approach');
          return f;
        }
      }
      return null;
    },
    tryHook() {
      const f = engaged;
      if (!f) return { result: 'none' };
      if (f.state === 'bite') return { result: 'hooked', fish: f };
      if (['approach', 'inspect', 'nibble', 'strike'].includes(f.state)) {
        events.emit('hook:result', { fishId: f.id, success: false });
        events.emit('fish:lost', { fishId: f.id, variant: f.variant, reason: 'spooked' });
        if (lure) flee(f, lure.x, lure.z);
        engageTimer = rand(2.5, 4);
        return { result: 'spooked', fish: f };
      }
      return { result: 'none' };
    },
    biteProgress() {
      const f = engaged;
      if (!f || f.state !== 'bite') return null;
      return { fish: f, remaining: f.timer, window: f.biteWindow };
    },
    take(f) {
      f.controlled = true;
      f.air = null;
      if (f.school) {
        f.school.members = f.school.members.filter((m) => m !== f);
        if (f.school.leader === f && f.school.members.length) { f.school.leader = f.school.members[0]; f.school.leader.slot = null; }
        f.school = null;
      }
      engaged = null;
    },
    // Fish leaves the scene (caught or escaped with the hook).
    finish(f, how) {
      if (how === 'caught') { removeFish(f); return; }
      if (how === 'held') {
        // Held up at the catch: the anchor leaves the water; the caller positions it.
        f.held = true;
        f.controlled = true;
        f.airY = 0;
        f.object.userData.inAir = true;
        if (f.model) f.model.visible = true;
        return;
      }
      f.controlled = false;
      f.retract = 0;
      f.inflate = 0;
      flee(f, f.pos.x - Math.sin(f.heading), f.pos.z - Math.cos(f.heading));
      f.fadeOut = true;
    },
    highlightWithin(x, z, r) {
      for (const f of fish) {
        f.highlightTarget = Math.hypot(f.pos.x - x, f.pos.z - z) < r + f.length * 0.3 && !f.air ? 1 : 0;
      }
    },
    clearHighlight() { for (const f of fish) f.highlightTarget = 0; },
    countWithin(x, z, r) {
      return fish.filter((f) => Math.hypot(f.pos.x - x, f.pos.z - z) < r + f.length * 0.3).length;
    },
    // Debug helpers
    spawn(id, x, z, variant) {
      const info = fishInfo(state, id);
      if (!info.behaviour) return null;
      if (x === undefined || x === null) return makeFish(id, null, null, variant);
      return makeFish(id, { x, z, area: { x, z, r: 4 } }, null, variant);
    },
    remove: removeFish,
    forceBite(id, variant) {
      if (!lure) return null;
      let f = engaged;
      if (!f || (id && f.id !== id)) {
        if (f && !f.controlled) setState(f, 'wander', 2);
        f = (!variant && fish.find((c) => (!id || c.id === id) && !c.controlled && !c.air))
          || makeFish(id || 'driftback', { x: lure.x + 1.5, z: lure.z + 1.0, area: { x: lure.x, z: lure.z, r: 4 } }, null, variant);
        if (!f) return null;
      }
      engaged = f;
      f.pos.set(lure.x + 0.6, 0, lure.z + 0.4);
      f.heading = Math.atan2(lure.x - f.pos.x, lure.z - f.pos.z);
      f.fade = 1;
      setState(f, 'strike', 0);
      return f;
    },
    clear() { for (const f of [...fish]) removeFish(f); },
    // Catch moment for fish without a model yet: their painted cut-out on a camera-facing card.
    showCard(f) {
      if (f.model || f.card) return;
      const entry = rawAssetEntry('fish', f.info.model) || rawAssetEntry('fish', f.id);
      const url = entry?.preview || entry?.hero;
      if (!url) return;
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 });
      const card = new THREE.Sprite(mat);
      card.renderOrder = 40;
      card.name = 'fish-card';
      f.card = card;
      f.object.add(card);
      new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.needsUpdate = true;
        const aspect = tex.image.height / tex.image.width;
        const w = Math.max(0.7, Math.min(1.6, f.length * 0.9));
        card.scale.set(w, w * aspect, 1);
        mat.opacity = 1;
      });
    },
  };
}
