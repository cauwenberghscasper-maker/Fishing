// Fishing controller: explore → aim → cast → wait (nibbles, bite, hook) → fight → catch.
// Emits every Agent A event in docs/INTERFACES.md with the documented payloads.
import * as THREE from 'three';
import { createAim } from './aim.js';
import { createLine } from './line.js';
import { createRod } from './rod.js';
import { createFight, rollCatch } from './fight.js';
import { createHud } from './hud.js';
import { MOVES } from './moves.js';
import { createPowerRunner, powerFor } from './powers.js';
import { createPredation } from './predation.js';
import { createMastery, updateStreak } from './mastery.js';
import { createSurge, islandElement } from './surge.js';
import { createTaunt } from './taunt.js';
import { createMinigames } from './minigames.js';
import { createTreasure } from './treasure.js';
import { variantInfo } from './variants.js';
import { isElemental } from './variants.js';
import { audio } from '../core/audio.js';
import { loadModel, pickAsset } from '../core/assets.js';

const AIM_TIME_SCALE = 0.25;
const HINTS_SEEN = new Set();

export function createFishing({ state, events, loop, input, cameraRig, player, island, water, splashes, fishSystem, under, surface, hudRoot }) {
  const hud = createHud({ root: hudRoot });
  const aim = createAim({ island, fishSystem, water, state });
  const line = createLine();
  const rod = createRod();
  surface.add(aim.group, line.mesh);
  under.add(rod.root);

  const lure = { pos: new THREE.Vector3(), model: null, dip: 0, bobTimer: 0, inWater: false };
  const flight = { active: false, t: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), apex: 2, cast: null };
  let mode = 'explore';
  let lastCast = null;
  let fight = null;
  let fightFish = null;
  let fightInfo = null;
  let catchTimer = 0;
  let reeling = false;
  let steer = 0;
  let keySteer = 0;
  let bowTap = false;
  let pressEdge = false;
  const powerTaps = [];
  const powerSwipes = [];
  let swipe = null;
  let pointer = null;     // { id, x0, y0 } pointer that owns the main button
  let fightThrottle = 0;
  let reelTickTimer = 0;
  let retrieve = null;    // reel-in animation
  let haul = null;        // a sunken chest coming up on the line: { t, spot, c, from, to, dur }
  const treasure = createTreasure({ under, surface, island, water, splashes, events, audio });
  events.on('treasure:closed', () => treasure.close());
  let modal = false;
  let held = [];          // fish shown at the catch until the catch moment ends (2–3 on a double/triple)
  let burst = null;       // the fish leaping out of the water into the player's hands
  let caughtQueue = [];   // fish:caught payloads; one reveal at a time, the next when the last closes
  let caughtDelay = 0;
  let predation = null;   // hunters striking the fish on the line (predation.js)
  let mastery = null;     // the perfect-fight gauge (mastery.js)
  let surge = null;       // mid-fight upgrade minigame (surge.js)
  let surgeTap = false;
  let minigames = null;   // snag + landing (minigames.js)
  let overmatched = null; // a monster on a rod too weak for it
  const gestures = [];
  let lureState = null;   // the lure object the fish system reads (taunt level lives on it)
  let waitHold = null;    // press-and-hold in wait mode reels in; a tap twitches (taunt)
  const taunt = createTaunt({
    state,
    hooks: {
      twitch: (good, frantic, level) => {
        if (lureState) lureState.taunt = level;
        lure.dip = Math.max(lure.dip, good ? 0.12 : 0.07);
        splashes.splash(lure.pos.x, lure.pos.z, good ? 0.35 : 0.2);
        if (good) { audio.tick(); navigator.vibrate?.(10); }
        const r = fishSystem.twitch(good, frantic);
        if (r === 'spooked') { hud.toast(frantic ? 'Too frantic, it fled' : 'Off beat, it fled', 1.4); audio.lost(); }
        hint('taunt', 'Tap on the pulse. Hold to reel in');
      },
      full: (summon) => {
        if (lureState) lureState.taunt = 1;
        const f = summon ? fishSystem.summonRare() : null;
        hud.toast(f ? 'Something big took notice...' : 'Big fish are watching', 2.2);
        if (f) { audio.lurk(); navigator.vibrate?.([20, 50, 20]); }
      },
    },
  });
  const tip = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  async function loadGear() {
    await rod.load();
    const id = pickAsset('world', ['bobber', 'float', 'lure']) || pickAsset('character', ['bobber', 'float', 'lure']);
    if (!id) return;
    const kind = pickAsset('world', [id]) ? 'world' : 'character';
    const m = await loadModel(kind, id);
    if (!m) return;
    lure.model = m.scene;
    lure.model.visible = false;
    surface.add(lure.model);
  }

  function setMode(next) {
    mode = next;
    state.world.mode = modal && next === 'explore' ? 'menu' : next;
    const camMode = { explore: 'explore', aim: 'aim', wait: 'wait', fight: 'fight', hooked: 'fight', catch: 'catch' }[next] || 'explore';
    cameraRig.setMode(camMode);
    const fishingNow = next !== 'explore';
    if (fishingNow) input.lock('fishing'); else input.unlock('fishing');
    player.lockMovement(fishingNow);
    hud.showMeters(next === 'fight' || next === 'hooked');
    refreshButton();
  }

  function refreshButton() {
    if (mode === 'explore') hud.setMainLabel('Cast', { ariaLabel: 'Hold to aim, pull back and release to cast' });
    else if (mode === 'aim') hud.setMainLabel('Aim');
    else if (mode === 'wait') {
      const biting = fishSystem.biteProgress();
      hud.setMainLabel(biting ? 'Hook!' : flight.active ? '' : 'Tease', { ariaLabel: biting ? 'Hook the fish' : 'Tap on the pulse to tease fish, hold to reel the line in' });
    } else if (mode === 'fight' || mode === 'hooked') hud.setMainLabel('Reel', { ariaLabel: 'Hold to reel, drag sideways to steer' });
    else hud.setMainLabel('', { hidden: true });
  }

  function hint(id, text) {
    if (!text || HINTS_SEEN.has(id)) return;
    HINTS_SEEN.add(id);
    hud.toast(text, 2.2);
  }

  // --- aim ---------------------------------------------------------------------------------
  function beginAim(x, y) {
    if (mode !== 'explore' || modal) return false;
    const c = hud.buttonCentre();
    aim.begin(c.x, c.y);
    aim.pointer(x, y);
    loop.setTimeScale(AIM_TIME_SCALE, 6);
    setMode('aim');
    player.pose('castWind', { once: true, then: 'aimLoop', timeScale: 1.6 });
    events.emit('aim:start', {});
    return true;
  }

  function endAim() {
    const result = aim.release();
    loop.setTimeScale(1, 10);
    events.emit('aim:end', { cancelled: result.cancelled });
    if (result.cancelled) {
      if (result.reason === 'land') hud.toast('No water there');
      player.pose(null);
      setMode('explore');
      return;
    }
    startFlight(result);
  }

  function cancelAim() {
    if (mode !== 'aim') return;
    aim.end();
    loop.setTimeScale(1, 10);
    events.emit('aim:end', { cancelled: true });
    player.pose(null);
    setMode('explore');
  }

  // --- cast flight -------------------------------------------------------------------------
  function startFlight(cast) {
    rod.tipWorld(tip);
    flight.active = true;
    flight.t = 0;
    flight.dur = 0.5 + cast.distance * 0.035;
    flight.from.copy(tip);
    flight.to.set(cast.x, 0, cast.z);
    flight.apex = cast.apex;
    flight.cast = cast;
    lure.pos.copy(tip);
    lure.inWater = false;
    line.show(tip, lure.pos, 0.3);
    player.pose('cast', { once: true });
    player.faceTowards(cast.x, cast.z);
    setMode('wait');
  }

  function updateFlight(dt) {
    flight.t += dt;
    const k = Math.min(1, flight.t / flight.dur);
    lure.pos.lerpVectors(flight.from, flight.to, k);
    lure.pos.y += flight.apex * 4 * k * (1 - k);
    line.setLength(flight.from.distanceTo(lure.pos) * 1.08 + 0.3);
    if (k >= 1) landLure();
  }

  function landLure() {
    flight.active = false;
    const c = flight.cast;
    lure.inWater = true;
    lure.pos.set(c.x, water.surfaceY(c.x, c.z), c.z);
    splashes.splash(c.x, c.z, 0.8);
    water.addRipple(c.x, c.z, 1.0);
    water.addRipple(c.x, c.z, 0.5, 0.25);
    audio.plop();
    cameraRig.shake(0.08);
    lastCast = { ...c };
    const attraction = state.gear?.baitAttraction || 1;
    lureState = { x: c.x, z: c.z, perfect: c.perfect, attraction, taunt: 0 };
    taunt.reset();
    // Landed on a sunken chest (sea.js): it comes up on the line instead of a fish.
    const chest = sea?.claimChest?.(c.x, c.z);
    if (chest) { startHaul(chest); return; }
    fishSystem.setLure(lureState);
    events.emit('cast:land', { x: c.x, z: c.z, depth: Math.round(c.depth * 100) / 100, perfect: Boolean(c.perfect) });
    if (c.perfect) { hud.toast('Perfect cast'); audio.perfect(); }
    rod.tipWorld(tip);
    line.setLength(tip.distanceTo(lure.pos) * 1.05);
    player.pose('waitIdle');
    refreshButton();
  }

  // --- treasure haul ----------------------------------------------------------------------
  function startHaul(spot) {
    fishSystem.setLure(null);
    hud.toast(spot.chest === 'gold' ? 'Something heavy… and golden!' : 'Something heavy on the line… a chest!', 2);
    audio.perfect?.();
    navigator.vibrate?.([30, 40, 60]);
    const px = player.position.x, pz = player.position.z;
    const dx = spot.x - px, dz = spot.z - pz, d = Math.hypot(dx, dz) || 1;
    haul = { t: 0, spot, c: null, from: new THREE.Vector3(spot.x, -1.2, spot.z), to: new THREE.Vector3(px + (dx / d) * 1.3, 0, pz + (dz / d) * 1.3), dur: THREE.MathUtils.clamp(d * 0.06, 1.3, 3) };
    treasure.lift(spot).then((c) => { if (haul) haul.c = c; else c.group.removeFromParent(); });
    player.pose('reel');
  }

  function updateHaul(dt) {
    const H = haul;
    H.t += dt;
    rod.tipWorld(tip);
    const rise = 0.9;
    const pos = lure.pos;
    if (H.t < rise) {
      // It breaks the surface: the line goes taut and the water boils.
      const k = H.t / rise;
      pos.set(H.from.x, THREE.MathUtils.lerp(H.from.y, 0, k * k), H.from.z);
      if (Math.random() < dt * 14) splashes.splash(H.from.x + (Math.random() - 0.5), H.from.z + (Math.random() - 0.5), 0.3);
      if (Math.random() < dt * 6) water.addRipple(H.from.x, H.from.z, 0.6);
      cameraRig.shake(0.02);
    } else {
      const k = Math.min(1, (H.t - rise) / H.dur);
      const e = k * k * (3 - 2 * k);
      pos.lerpVectors(new THREE.Vector3(H.from.x, 0, H.from.z), H.to, e);
      pos.y = Math.max(water.surfaceY(pos.x, pos.z) - 0.1, 0) + Math.sin(k * Math.PI) * 0.8 * (k > 0.7 ? 1 : 0.3);
      if (Math.random() < dt * 10 && k < 0.85) water.addRipple(pos.x, pos.z, 0.35);
      if (k >= 1) {
        if (H.c) treasure.land(H.c, H.to.x, H.to.z, player.position.x, player.position.z, H.spot.chest);
        haul = null;
        line.hide();
        lure.inWater = false;
        player.pose(null);
        setMode('explore');
        return;
      }
    }
    if (H.c) {
      H.c.group.position.copy(pos);
      H.c.group.rotation.y += dt * 0.8;
      H.c.group.rotation.z = Math.sin(H.t * 5) * 0.12;
    }
    line.setTension(0.75);
    line.setLength(tip.distanceTo(pos) * 1.0);
    cameraRig.frame(player.position.x, player.position.z, pos.x, pos.z, { bias: 0.6, margin: 5 });
  }

  // --- waiting / hook ----------------------------------------------------------------------
  function tryHook() {
    if (mode !== 'wait' || flight.active || retrieve || haul) return;
    const r = fishSystem.tryHook();
    if (r.result === 'hooked') startFight(r.fish);
    else if (r.result === 'spooked') { hud.toast('Too early, it fled'); audio.lost(); }
    else startRetrieve();
  }

  function startRetrieve() {
    fishSystem.setLure(null);
    retrieve = { t: 0, from: lure.pos.clone() };
    player.pose('reel');
  }

  function updateRetrieve(dt) {
    retrieve.t += dt;
    const k = Math.min(1, retrieve.t / 0.7);
    rod.tipWorld(tip);
    lure.pos.lerpVectors(retrieve.from, tip, k * k);
    if (k < 0.8) lure.pos.y = Math.max(lure.pos.y, water.surfaceY(lure.pos.x, lure.pos.z));
    if (Math.random() < dt * 8 && k < 0.7) water.addRipple(lure.pos.x, lure.pos.z, 0.2);
    line.setLength(tip.distanceTo(lure.pos) + 0.1);
    if (k >= 1) {
      retrieve = null;
      line.hide();
      lure.inWater = false;
      player.pose(null);
      setMode('explore');
    }
  }

  // --- fight -------------------------------------------------------------------------------
  // An elemental fish's superpower for the fight (also when it turns elemental mid-fight: surge.js).
  function makePower(fish) {
    const powerDef = isElemental(state, fish.variant) ? powerFor(state, fish.variant) : null;
    return powerDef ? createPowerRunner(powerDef, {
      fish,
      variant: fish.variant,
      events,
      hooks: {
        project: (v) => screenOf(tmp.set(v.x, v.y ?? 0, v.z)),
        playerPos: player.position,
        linePoint: (t) => {
          const pts = line.points;
          const i = Math.max(0, Math.min(pts.length - 1, Math.round(t * (pts.length - 1))));
          return pts[i].clone();
        },
        shake: (a, sec) => cameraRig.shakeFor(a, sec),
        slowmo: (k, sec) => loop.slowmo(k, sec),
        toast: (text, sec) => hud.toast(text, sec),
        splash: (x, z, st) => { splashes.splash(x, z, st); water.addRipple(x, z, st); },
        // Ember: you may walk out of the impact zones while you keep the line.
        setWalk: (on) => {
          if (on) { input.unlock('fishing'); player.lockMovement(false); }
          else if (mode === 'fight') { input.lock('fishing'); player.lockMovement(true); }
        },
      },
    }) : null;
  }

  // The fish on the line turns into a new variant mid-fight (surge, perfect hold or pump): splash,
  // shake, its name in gold, and an elemental one fights back with its superpower.
  function transform(fish, to) {
    if (!fish || fish.variant === to) return;
    fish.variant = to;
    if (fish.object) fish.object.userData.variant = to;
    events.emit('fish:variant', { uid: fish.uid, fishId: fish.id, variant: to, object: fish.object });
    const v = variantInfo(state, to);
    splashes.splash(fish.pos.x, fish.pos.z, 2.4); water.addRipple(fish.pos.x, fish.pos.z, 2.0); water.addRipple(fish.pos.x, fish.pos.z, 1.2, 0.25);
    cameraRig.shakeFor(0.5, 0.5); loop.slowmo(0.4, 0.8); audio.perfect(); navigator.vibrate?.([40, 30, 80]);
    hud.toast(`${(v.name || to).toUpperCase()} ${fish.info.name.toUpperCase()}! ×${v.valueMult ?? 1}`, 2.6);
    if (v.kind === 'element') {
      const p = makePower(fish);
      if (p) fight?.setPower(p);
    }
  }

  function startFight(fish) {
    fishSystem.take(fish);
    fightFish = fish;
    fightInfo = fish.info;
    const roll = rollCatch(fish.info, lastCast?.perfect, taunt.sizeBonus, fish.sizeU);
    if (roll.sizeClass === 'giant') hud.toast(`A GIANT ${fish.info.name}!`, 2.2);
    if (taunt.level > 0.5) hint('taunt-size', 'It took the lure hard!');
    fish.catchRoll = roll;
    const castAngle = Math.atan2(lure.pos.x - player.position.x, lure.pos.z - player.position.z);
    const power = makePower(fish);
    fight = createFight({
      power,
      fish, info: fish.info, ...roll, state, island, water, splashes,
      playerPos: player.position, castAngle,
      hooks: {
        shake: (a) => cameraRig.shake(a),
        move: (id, m) => { hint(`move:${id}`, m.hint); if (m.air) audio.splash(m.air.height > 1 ? 1.4 : 0.5); },
        bow: () => { hud.toast('Bowed!', 0.8); audio.hook(); mastery?.bow(); },
        tired: () => hud.toast('It\'s tiring, bring it in!', 1.4),
        thrash: () => audio.splash(0.4),
      },
    });
    predation = createPredation({
      state, events, fishSystem, fight, hooked: fish, roll, island, playerPos: player.position,
      hour: state.world.hour ?? 12, perfect: Boolean(lastCast?.perfect),
      hooks: {
        toast: (text, sec) => hud.toast(text, sec),
        warn: () => { audio.lurk(); navigator.vibrate?.([20, 60, 20, 60, 20]); cameraRig.shakeFor(0.12, 0.6); },
        chomp: () => { audio.chomp(); navigator.vibrate?.([80, 30, 120]); },
        splash: (x, z, st) => { splashes.splash(x, z, st); water.addRipple(x, z, st); water.addRipple(x, z, st * 0.5, 0.2); },
        ripple: (x, z, st) => water.addRipple(x, z, st),
        shake: (a) => cameraRig.shakeFor(a, 0.4),
        slowmo: (k, sec) => loop.slowmo(k, sec),
      },
    });
    mastery = createMastery({
      state, fight,
      hooks: {
        grade: (g) => {
          hud.setMasteryGrade(g.id, g.name);
          if (surge?.maybeStart(g.id)) return;
          hud.toast(g.id === 'perfect' ? 'PERFECT FIGHT!' : `${g.name} fight!`, 1.4);
          if (g.id === 'perfect') { audio.perfect(); navigator.vibrate?.([20, 30, 40]); } else audio.tick();
        },
      },
    });
    surge = createSurge({
      state, fish,
      hooks: {
        begin: (name) => {
          hud.toast(`${name} surge! Tap as the rings close`, 2.0);
          audio.lurk(); navigator.vibrate?.([30, 40, 30]);
          loop.slowmo(0.55, 3.6);
        },
        beat: (hit) => { if (hit) { audio.tick(); navigator.vibrate?.(25); } else audio.lost(); },
        end: ({ hits, to }) => {
          if (!to) { hud.toast(hits ? `The surge faded (${hits}/3)` : 'The surge faded', 1.6); return; }
          transform(fish, to);
        },
      },
    });
    // Too strong for this rod (monsters): it takes the line and snaps it, with a clear reason.
    overmatched = fish.info.minRating && (state.gear?.rating ?? 0) < fish.info.minRating ? { t: 0, need: fish.info.minRating } : null;
    if (overmatched) { hud.toast(`${fish.info.name}! Far too strong...`, 1.6); cameraRig.shakeFor(0.7, 1.2); audio.lurk(); navigator.vibrate?.([60, 40, 120, 40, 200]); }
    hud.setMasteryGrade(null);
    fishSystem.setLure(null);
    audio.hook();
    navigator.vibrate?.(40);
    events.emit('hook:result', { fishId: fish.id, success: true });
    events.emit('fight:start', { fishId: fish.id, weight: roll.weight, sizeClass: roll.sizeClass, strength: Math.round(fight.state.tension * 0 + roll.strength * (fish.behaviour.pull ?? 0.4) * 100) / 100 });
    hud.toast(`${fish.info.name} is on!`, 1.4);
    setMode('fight');
    player.pose('reel');
  }

  function endFight(status) {
    const fish = fightFish;
    const onLine = predation ? predation.line : [{ fish, roll: fish.catchRoll }];
    if (status === 'caught') {
      const count = onLine.length;
      const grade = mastery?.grade || null;
      caughtQueue = onLine.map(({ fish: f, roll }, i) => {
        const r = mastery ? mastery.rewardFor(f.variant || 'basic') : { grade: null, valueMult: 1, variant: f.variant || 'basic' };
        // A clean landing (minigames.js) adds its bonus on top of the fight grade.
        const landBonus = minigames?.valueBonus ?? 1;
        if (landBonus > 1) { r.valueMult = (r.valueMult || 1) * landBonus; r.grade = r.grade || 'good'; }
        if (r.upgraded) hud.toast(`A perfect fight: it ranked up to ${variantInfo(state, r.variant).name}!`, 2.2);
        return {
        fishId: f.id,
        variant: r.variant,
        ...(r.grade ? { mastery: { grade: r.grade, valueMult: r.valueMult } } : {}),
        weight: roll.weight,
        sizeClass: roll.sizeClass,
        islandId: state.world.islandId,
        perfectCast: Boolean(lastCast?.perfect),
        ...(count > 1 ? { multi: { count, index: i + 1 } } : {}),
        };
      });
      const streak = updateStreak(state, 'caught', grade);
      if (streak.after > streak.before) setTimeout(() => hud.toast(`Lucky streak ${streak.after}: rarer fish are biting`, 2.4), 1600);
      if (count > 1) events.emit('catch:multi', { count, fishIds: onLine.map((l) => l.fish.id) });
      startCatchBurst(onLine.map((l) => l.fish));
    } else {
      const streak = updateStreak(state, status, null);
      if (streak.before > 0) setTimeout(() => hud.toast('Your lucky streak is over', 1.8), 1800);
      for (const l of onLine) events.emit('fish:lost', { fishId: l.fish.id, variant: l.fish.variant || 'basic', reason: status });
      if (status === 'snap') { audio.snap(); hud.snapFlash(); hud.toast(onLine.length > 1 ? 'Snap! They took the line' : 'Snap! The line broke'); cameraRig.shake(0.4); }
      else if (status === 'predator') audio.lost();   // predation.js already said who ate it
      else if (status === 'monster') { audio.snap(); hud.snapFlash(); cameraRig.shake(0.6); hud.toast(`It snapped your line! Needs a rod rated ${overmatched?.need ?? '?'} kg+`, 3.2); }
      else { audio.lost(); hud.toast('It threw the hook'); }
      if (predation) predation.release(status);
      if (status !== 'predator') fishSystem.finish(fish, 'escaped');
      line.hide();
      lure.inWater = false;
      player.pose(null);
      setMode('explore');
    }
    fight?.power?.stop(fight);
    fight = null;
    predation = null;
    mastery = null;
    surge = null;
    minigames = null;
    fightFish = null;
    reeling = false;
    steer = 0;
    hud.setMainPressed(false);
  }

  // --- the catch moment (9b.3) -----------------------------------------------------------
  // The fish bursts out of the water in slow motion, the camera punches in, the player holds it
  // up; then fish:landed-show (in-world moment) and fish:caught (B's full-screen reveal).
  function startCatchBurst(list) {
    held = list;
    const n = list.length;
    burst = { t: 0, dur: 1.05 + (n - 1) * 0.12, trail: 0, from: [] };
    list.forEach((f, i) => {
      fishSystem.finish(f, 'held');
      fishSystem.showCard(f);
      const from = new THREE.Vector3(f.pos.x, water.surfaceY(f.pos.x, f.pos.z), f.pos.z);
      burst.from.push(from);
      splashes.splash(from.x, from.z, 2.0 + i * 0.4);
      water.addRipple(from.x, from.z, 1.6);
      water.addRipple(from.x, from.z, 0.9, 0.2);
    });
    audio.splash(1.6 + (n - 1) * 0.4);
    loop.slowmo(n > 1 ? 0.28 : 0.35, 0.75 + (n - 1) * 0.25);
    cameraRig.shakeFor(0.45 + (n - 1) * 0.15, 0.35);
    line.hide();
    lure.inWater = false;
    player.pose('holdUp');
    navigator.vibrate?.(n > 2 ? [40, 40, 60, 40, 90, 40, 140] : n > 1 ? [30, 40, 60, 40, 100] : [30, 40, 60]);
    if (n === 2) hud.toast('DOUBLE CATCH!', 2.4);
    if (n >= 3) hud.toast('TRIPLE CATCH!!!', 3.0);
    catchTimer = 2.6;
    setMode('catch');
  }

  // Fish i of n held up: fanned out side by side in front of the player.
  function holdPoint(out, i = 0, n = 1) {
    player.handAnchor.getWorldPosition(hand);
    const side = (i - (n - 1) / 2) * 0.75;
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    return out.set(hand.x + fx * 0.45 + fz * side, hand.y + 0.35 + Math.abs(side) * -0.15, hand.z + fz * 0.45 - fx * side);
  }

  function updateCatch(dt, realDt) {
    const n = held.length;
    if (burst) {
      burst.t += dt;
      held.forEach((f, i) => {
        const o = f.object;
        if (!o) return;
        // Staggered: each fish leaves the water a beat after the one before.
        const k = Math.min(1, Math.max(0, (burst.t - i * 0.12) / (burst.dur - (n - 1) * 0.12)));
        const to = holdPoint(new THREE.Vector3(), i, n);
        const e = 1 - Math.pow(1 - k, 2);
        o.position.lerpVectors(burst.from[i], to, e);
        o.position.y += Math.sin(k * Math.PI) * (2.2 + i * 0.4);
        o.rotation.set(0, o.rotation.y + dt * (9 - i * 2), Math.sin(k * Math.PI * 2) * 0.6);
        f.swim.set('landed');
      });
      burst.trail -= dt;
      if (burst.trail <= 0 && burst.t < burst.dur * 0.6) {
        burst.trail = 0.07;
        for (const f of held) if (f.object) splashes.splash(f.object.position.x, f.object.position.z, 0.25);
      }
      if (burst.t >= burst.dur) {
        burst = null;
        audio.catchChime();
        for (const f of held) events.emit('fish:landed-show', { uid: f.uid, fishId: f.id, variant: f.variant || 'basic', object: f.object });
        caughtDelay = 0.75;
      }
    } else {
      held.forEach((f, i) => {
        if (!f.object) return;
        holdPoint(f.object.position, i, n);
        f.object.rotation.set(0, f.object.rotation.y + realDt * 1.6, 0.15);
        f.swim.set('landed');
      });
    }
    // One reveal at a time: the next fish:caught goes out once the previous reveal has closed.
    if (caughtDelay > 0 && !modal) {
      caughtDelay -= realDt;
      if (caughtDelay <= 0 && caughtQueue.length) events.emit('fish:caught', caughtQueue.shift());
    }
  }

  // --- input -------------------------------------------------------------------------------
  const btn = hud.main;
  btn.addEventListener('pointerdown', (e) => {
    if (modal || pointer) return;
    e.preventDefault();
    pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    pressMain(e.clientX, e.clientY);
  });
  btn.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    moveMain(e.clientX, e.clientY);
  });
  const up = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pointer = null;
    releaseMain(e.type === 'pointercancel');
  };
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  function pressMain(x, y) {
    if (mode === 'explore') beginAim(x, y);
    else if (mode === 'wait') {
      if (haul) { /* hauling a chest */ } else if (fishSystem.biteProgress() || flight.active || retrieve) tryHook();
      else waitHold = { t: 0 };
    } else if (mode === 'fight') {
      reeling = true;
      pressEdge = true;
      surgeTap = true;
      if (fight?.state.bowWindow) bowTap = true;
      hud.setMainPressed(true);
    }
  }
  function moveMain(x, y) {
    if (mode === 'aim') aim.pointer(x, y);
    else if (mode === 'fight' && pointer) steer = THREE.MathUtils.clamp((x - pointer.x0) / 70, -1, 1);
  }
  function releaseMain(cancelled) {
    if (mode === 'aim') { if (cancelled) cancelAim(); else endAim(); }
    if (mode === 'fight') { reeling = false; steer = 0; hud.setMainPressed(false); }
    if (mode === 'wait' && waitHold) {
      const quick = waitHold.t < 0.4;
      waitHold = null;
      if (quick && !cancelled && !flight.active && !retrieve && !haul) taunt.tap();
    }
  }

  // Tapping anywhere on the game during the bite window also sets the hook (bigger target).
  // During a fight, taps and swipes on the game feed the superpower counters.
  const gameEl = document.getElementById('game');
  const rel = (e) => { const r = hudRoot.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  gameEl?.addEventListener('pointerdown', (e) => {
    if (modal) return;
    if (mode === 'wait' && fishSystem.biteProgress()) tryHook();
    else if (mode === 'wait' && !flight.active && !retrieve && !haul) taunt.tap();
    else if (mode === 'fight') {
      surgeTap = true;
      if (fight?.state.bowWindow) bowTap = true;
      const p = rel(e);
      swipe = { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y };
    }
  });
  gameEl?.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id || mode !== 'fight') return;
    const p = rel(e);
    if (Math.hypot(p.x - swipe.x, p.y - swipe.y) > 8) {
      powerSwipes.push({ x0: swipe.x, y0: swipe.y, x1: p.x, y1: p.y });
      swipe.x = p.x; swipe.y = p.y;
    }
  });
  const endSwipe = (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const p = rel(e);
    if (mode === 'fight' && Math.hypot(p.x - swipe.x0, p.y - swipe.y0) < 14) powerTaps.push(p);
    if (mode === 'fight' && Math.hypot(p.x - swipe.x0, p.y - swipe.y0) >= 40) gestures.push({ dx: p.x - swipe.x0, dy: p.y - swipe.y0 });
    swipe = null;
  };
  gameEl?.addEventListener('pointerup', endSwipe);
  gameEl?.addEventListener('pointercancel', endSwipe);

  // Desktop: Space acts as the main button (aim with the mouse from the button), A/D steer.
  input.onKey((code, down) => {
    if (code === 'Space') {
      if (down) {
        if (mode === 'explore') {
          // Quick cast straight ahead of the player for keyboard users.
          const c = hud.buttonCentre();
          const ps = screenOf(tmp2.set(player.position.x, player.position.y + 0.9, player.position.z));
          beginAim(c.x, c.y);
          aim.pointer(ps.x, ps.y + aim.maxDrag * 0.7);   // pull straight down: cast straight ahead
        } else pressMain(0, 0);
      } else releaseMain(false);
    }
    if (mode === 'fight' && ['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(code)) {
      const dir = code === 'KeyA' || code === 'ArrowLeft' ? -1 : 1;
      keySteer = down ? dir : (keySteer === dir ? 0 : keySteer);
    }
  });

  events.on('ui:modal', ({ open } = {}) => {
    modal = Boolean(open);
    if (modal) {
      if (mode === 'aim') cancelAim();
      reeling = false;
      if (pointer) pointer = null;
      if (mode === 'explore') state.world.mode = 'menu';
    } else {
      if (mode === 'explore') state.world.mode = 'explore';
      if (mode === 'catch' && caughtQueue.length) caughtDelay = 0.45;   // next fish of a double/triple
    }
  });

  // Rod condition: warn before it goes, say so plainly when it does (the shop counter repairs it).
  events.on('gear:strained', ({ strain } = {}) => setTimeout(() => hud.toast(`Your rod is creaking (${Math.round((strain ?? 0.7) * 100)}%). Mend it at the shop`, 2.6), 2200));
  events.on('gear:broken', () => setTimeout(() => { audio.snap(); hud.toast('Your rod broke! Repair it at the shop', 3.0); }, 2200));

  // Countering a superpower is the most masterful thing you can do in a fight.
  events.on('power:end', ({ success, remote } = {}) => { if (success && !remote) mastery?.countered(); });

  fishSystem.onNibble((f) => {
    lure.dip = 0.08;
    audio.nibble();
    void f;
  });
  events.on('bite', () => {
    audio.bite();
    navigator.vibrate?.([70, 40, 140]);
    cameraRig.shake(0.18);
    refreshButton();
  });

  // --- frame -------------------------------------------------------------------------------
  let sea = null;
  const tmp2 = new THREE.Vector3();
  function screenOf(v) {
    tmp.copy(v).project(cameraRig.camera);
    const r = hudRoot.getBoundingClientRect();
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, visible: tmp.z < 1 };
  }

  function update(dt, realDt) {
    if (sea) treasure.sync(sea.spots);
    treasure.update(dt, performance.now() / 1000);
    // Rod pose follows the hand.
    player.handAnchor.getWorldPosition(hand);
    let yaw = player.facing;
    let pitch = 0.78;
    let bend = 0.04;
    if (mode === 'aim') {
      const p = aim.power;
      pitch = 0.9 + p * 0.95;            // drawn back over the shoulder
      bend = 0.05 + p * 0.25;            // the rod loads up as you pull
      if (aim.info.hasAim) yaw = Math.atan2(aim.target.x - player.position.x, aim.target.z - player.position.z);
    } else if (mode === 'wait') {
      pitch = flight.active ? 0.35 : 0.62;
      const bp = fishSystem.biteProgress();
      bend = bp ? 0.45 : 0.08 + lure.dip * 2;
      yaw = Math.atan2(lure.pos.x - player.position.x, lure.pos.z - player.position.z);
    } else if (mode === 'fight' && fight) {
      const T = fight.state.tension;
      pitch = 0.95 + T * 0.25;
      bend = 0.15 + T * 0.85;
      yaw = fight.state.angle + Math.sin(performance.now() * 0.03) * T * 0.02;
    } else if (mode === 'catch') {
      pitch = 1.2;
    }
    if (mode === 'wait' || mode === 'fight') player.faceTowards(player.position.x + Math.sin(yaw), player.position.z + Math.cos(yaw));
    rod.pose(hand, yaw, pitch, bend, realDt);
    rod.tipWorld(tip);

    // Mode logic
    if (mode === 'aim') {
      aim.update(realDt, tip, player.position, screenOf(tmp2.set(player.position.x, player.position.y + 0.9, player.position.z)));
      if (aim.info.hasAim) player.faceTowards(aim.target.x, aim.target.z);
      // Feel: haptic ticks entering the perfect window and when a fish swims into the reticle,
      // a rope creak per quarter of pull-back.
      const fx = aim.takeFeel();
      if (fx.perfectEdge) { navigator.vibrate?.(8); audio.tick(); }
      if (fx.fishEdge) navigator.vibrate?.(14);
      if (fx.powerStep) { audio.creak(fx.powerStep); navigator.vibrate?.(4 + fx.powerStep * 2); }
      // Frame the player and the aim point together, however far the cast reaches.
      if (aim.info.hasAim) cameraRig.frame(player.position.x, player.position.z, aim.target.x, aim.target.z, { bias: 0.5, margin: 4 });
      else cameraRig.setFocus(player.position.x, 0, player.position.z + 1.5);
    } else if (mode === 'wait') {
      if (flight.active) updateFlight(dt);
      else if (haul) updateHaul(dt);
      else if (retrieve) updateRetrieve(dt);
      else {
        taunt.update(realDt);
        // Holding the button reels the line in (a tap twitches the lure instead).
        if (waitHold) { waitHold.t += realDt; if (waitHold.t >= 0.4) { waitHold = null; tryHook(); } }
        // Lure floats with the swell; nibbles dip it, a bite drags it under.
        const bp = fishSystem.biteProgress();
        lure.dip = Math.max(0, lure.dip - dt * 0.5);
        const sink = bp ? 0.22 + Math.sin(performance.now() * 0.03) * 0.05 : lure.dip;
        lure.pos.y = water.surfaceY(lure.pos.x, lure.pos.z) - sink;
        lure.bobTimer -= dt;
        if (lure.bobTimer <= 0) { water.addRipple(lure.pos.x, lure.pos.z, 0.14); lure.bobTimer = 1.8; }
        line.setLength(tip.distanceTo(lure.pos) * (bp ? 1.0 : 1.06));
      }
      // Follow the lure wherever it lands (Casper: long endgame casts must stay in view).
      cameraRig.frame(player.position.x, player.position.z, lure.pos.x, lure.pos.z, { bias: 0.6, margin: 5 });
      refreshButton();
    } else if (mode === 'fight' && fight) {
      const input = { reeling: reeling || keyReel, steer: keySteer || steer, bowTap, pressEdge, taps: powerTaps.splice(0), swipes: powerSwipes.splice(0) };
      bowTap = false;
      pressEdge = false;
      if (!modal) mastery?.update(dt, input);
      if (!modal) {
        const surgeOwns = surge?.update(dt, surgeTap);
        minigames?.update(dt, { gestures: gestures.splice(0), tap: surgeTap && !surgeOwns, steer: input.steer ?? 0 });
      } else gestures.length = 0;
      surgeTap = false;
      player.pose(fight.state.tension > 0.72 ? 'struggle' : 'reel');
      let status = modal ? 'fighting' : fight.update(dt, input);
      if (status === 'fighting' && !modal && predation?.update(dt)?.stolen) status = 'predator';
      if (status === 'caught' && minigames?.holdLanding) status = 'fighting';   // wait for the landing tap
      if (overmatched && status === 'fighting') { overmatched.t += dt; fight.state.tension = Math.min(1, fight.state.tension + dt * 0.8); if (overmatched.t > 1.6) status = 'monster'; }
      const fp = fight.fishPoint();
      lure.pos.set(fp.x, water.surfaceY(fp.x, fp.z) - (fightFish.airY > 0 ? -fightFish.airY : 0.12), fp.z);
      line.setTension(fight.state.tension);
      line.setLength(tip.distanceTo(lure.pos) * (1.0 + (1 - fight.state.tension) * 0.08));
      hud.setMeters(fight.state.tension, fight.state.stamina, { danger: fight.state.overload > 0.2, mastery: mastery?.value ?? 0 });
      fightThrottle -= realDt;
      if (fightThrottle <= 0) {
        fightThrottle = 0.1;
        const payload = { tension: round2(fight.state.tension), stamina: round2(fight.state.stamina) };
        if (fight.boss) payload.hp = round2(fight.boss.hp);
        events.emit('fight:update', payload);
      }
      if (input.reeling) {
        reelTickTimer -= realDt;
        if (reelTickTimer <= 0) { audio.reelTick(fight.state.tension); reelTickTimer = 0.07; }
      }
      // The fish and its minigame rings always stay on screen; the player may slip out on long fights.
      cameraRig.frame(player.position.x, player.position.z, fp.x, fp.z, { bias: 0.62, margin: 6 });
      if (status !== 'fighting') endFight(status);
    } else if (mode === 'catch') {
      const focus = held[0]?.object?.position || player.position;
      cameraRig.setFocus(THREE.MathUtils.lerp(player.position.x, focus.x, 0.5), 0, THREE.MathUtils.lerp(player.position.z, focus.z, 0.5));
      updateCatch(dt, realDt);
      // B's reveal opens a modal: the moment lasts until it closes (or a short timeout).
      if (!modal && !burst && !caughtQueue.length) catchTimer -= realDt;
      if (catchTimer <= 0) {
        for (const f of held) fishSystem.finish(f, 'caught');
        held = [];
        player.pose(null);
        setMode('explore');
      }
    } else {
      cameraRig.setFocus(player.position.x, 0, player.position.z);
    }

    // Line and lure
    if (line.active) {
      line.update(dt, tip, lure.pos, cameraRig.camera, (x, z) => water.surfaceY(x, z));
      if (mode !== 'fight') line.setTension(haul ? 0.75 : fishSystem.biteProgress() ? 0.5 : 0);
    }
    if (lure.model) {
      lure.model.visible = line.active;
      lure.model.position.copy(lure.pos);
    }

    // Overlay
    const frame = {};
    // Hot spots (sea.js): a label over each on screen, an arrow at the screen edge for the rest.
    if (sea && sea.spots.length && mode !== 'catch' && !modal) {
      frame.hotspots = sea.spots.map((s) => {
        tmp2.set(s.x, 0.2, s.z);
        const p = screenOf(tmp2);
        return { x: p.x, y: p.y, visible: p.visible, label: s.label, color: s.color, kind: s.kind, fade: Math.min(1, s.t / 1.5, Math.max(0, s.dur - s.t) / 3) };
      });
    }
    const j = input.joystick;
    if (j.active) frame.joystick = { active: true, ox: j.ox, oy: j.oy, vx: j.vx, vy: j.vy, radius: input.JOY_RADIUS };
    if (mode === 'aim') {
      const info = aim.info;
      frame.aim = {
        drag: aim.dragVector, dragLength: aim.dragLength, deadZone: aim.deadZone, maxDrag: aim.maxDrag, power: aim.power, centre: aim.centre, moved: aim.moved,
        hasAim: info.hasAim, valid: info.valid, band: info.band.name, depth: info.depth, fish: info.fishInside,
        reticle: info.hasAim ? screenOf(aim.target) : null, perfect: aim.perfectNow,
      };
    }
    const bp = mode === 'wait' && fishSystem.biteProgress();
    if (bp) {
      const s = screenOf(lure.pos);
      frame.bite = { x: s.x, y: s.y, remaining: bp.remaining, window: bp.window };
    } else if (mode === 'wait' && !flight.active && !retrieve && lure.inWater) {
      frame.taunt = { ...screenOf(lure.pos), ...taunt.view };
    }
    if (mode === 'fight' && fight) {
      const fp = fight.fishPoint();
      frame.fight = {
        fish: screenOf(tmp.set(fp.x, 0, fp.z).clone()),
        lateral: fight.lateral,
        bowWindow: fight.state.bowWindow,
        steer: keySteer || steer,
        good: fight.state.good,
      };
      const sv = surge?.view;
      if (sv) frame.surge = { ...sv, fish: frame.fight.fish };
      const mv = minigames?.view;
      if (mv) frame.minigame = { ...mv, fish: frame.fight.fish };
      const pw = fight.power;
      if (pw && pw.phase !== 'cooldown') {
        const d = pw.detail || {};
        const px = (v) => screenOf(tmp.set(v.x, 0.05, v.z));
        const radiusPx = (v, r) => { const a = px(v); const b = screenOf(tmp.set(v.x + r, 0.05, v.z)); return Math.abs(b.x - a.x); };
        frame.power = {
          counter: pw.def.counter,
          phase: pw.phase,
          t: pw.t,
          telegraph: pw.def.telegraph,
          duration: pw.def.duration,
          heat: pw.heat,
          shards: d.shards?.map((sh) => ({ ...px(sh), broken: sh.broken })),
          bombs: d.bombs?.map((b) => ({ ...px(b), r: radiusPx(b, b.radius), landed: b.landed, hit: b.hit })),
          vines: d.vines?.map((v) => ({ ...screenOf(line.points[Math.round(v.t * (line.points.length - 1))].clone()), cut: v.cut })),
          glyphs: d.glyphs?.map((g) => ({ ...px(g), done: g.done })),
          beat: d.beat ? { phase: d.phase ?? 0, window: d.window / d.beat, pumps: d.pumps || 0, needed: d.needed } : null,
        };
      }
    }
    hud.draw(frame, realDt);
    line.setLight(1);
  }

  let keyReel = false;
  input.onKey((code, down) => { if (code === 'Space' && mode === 'fight') keyReel = down; });

  setMode('explore');

  return {
    hud,
    rod,
    line,
    aim,
    loadGear,
    update,
    get mode() { return mode; },
    get fight() { return fight; },
    get lure() { return lure; },
    refresh() { refreshButton(); },
    get fightFishUid() { return fightFish ? fightFish.uid : null; },
    // Co-op: a friend helps land the fish (net:help) — drains stamina on the fighter's side.
    helpFromFriend() {
      if (!fight || fight.state.landing) return;
      fight.state.stamina = Math.max(0, fight.state.stamina - 0.08);
      fight.state.tension = Math.max(0.2, fight.state.tension - 0.1);
      hud.toast('A friend lends a hand!', 1.0);
    },
    // Debug: cast straight to a point (bypasses aim; still emits aim + cast events).
    debugCast(x, z, perfect = false) {
      if (mode !== 'explore') return false;
      const depth = island.waterDepthAt(x, z);
      if (depth < 0.3) return false;
      events.emit('aim:start', {});
      events.emit('aim:end', { cancelled: false });
      rod.tipWorld(tip);
      setMode('aim');
      startFlight({ x, z, depth, perfect, distance: Math.hypot(x - player.position.x, z - player.position.z), apex: 2.5 });
      return true;
    },
    debugHook() { tryHook(); },
    setSea(s) { sea = s; },
    /** Debug: haul a chest of a tier right now (as if a cast landed on one). */
    debugChest(tier = 'gold') { const p = player.position; startHaul({ id: -Math.random(), chest: tier, x: p.x + 6, z: p.z + 6 }); setMode('wait'); line.show(tip, lure.pos, 0.3); return true; },
    // Debug: send a hunter at the fish on the line right now (double catch); call again once it's on for a triple.
    debugPredator() { return predation ? predation.force() : false; },
    debugSurge() { return surge ? surge.force() : false; },
    debugSnag(kind) { return minigames ? minigames.force(kind) : false; },
    get minigameView() { return minigames?.view ?? null; },
    get surgeView() { return surge?.view ?? null; },
    get tauntView() { return taunt.view; },
    get fightVariant() { return fightFish?.variant ?? null; },
    debugMastery(v = 1) { if (mastery) mastery.fill(v); return mastery?.value ?? null; },
    get onLine() { return predation ? predation.line.map((l) => l.fish.id) : []; },
    debugReel(on, s = 0) { if (mode === 'fight') { reeling = on; steer = s; } },
    debugFinishFight(status = 'caught') {
      if (!fight) return false;
      if (status === 'caught') { fight.state.stamina = 0; fight.state.landing = true; fight.state.distance = 1.7; }
      fight.state.status = status;
      endFight(status);
      return true;
    },
    debugAimFrame(x, y) {
      // Start aim from the button and drag to (x, y) without releasing (screenshots).
      const c = hud.buttonCentre();
      if (mode === 'explore') { beginAim(c.x, c.y); }
      aim.pointer(x, y);
    },
    debugReleaseAim() { if (mode === 'aim') endAim(); },
    debugStartMove(id) { if (fight && MOVES[id]) { fight.state.nextMove = 0; fight.state.move = null; } },
  };
}

function round2(v) { return Math.round(v * 100) / 100; }
