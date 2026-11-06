// Fishing controller: explore → aim → cast → wait (nibbles, bite, hook) → fight → catch.
// Emits every Agent A event in docs/INTERFACES.md with the documented payloads.
import * as THREE from 'three';
import { createAim } from './aim.js';
import { createLine } from './line.js';
import { createRod } from './rod.js';
import { createFight, rollCatch } from './fight.js';
import { createHud } from './hud.js';
import { MOVES } from './moves.js';
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
  let pointer = null;     // { id, x0, y0 } pointer that owns the main button
  let fightThrottle = 0;
  let reelTickTimer = 0;
  let retrieve = null;    // reel-in animation
  let modal = false;
  let heldFish = null;    // fish shown at the catch until the catch moment ends
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
      hud.setMainLabel(biting ? 'Hook!' : flight.active ? '...' : 'Reel in');
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
    player.pose('castWind', { timeScale: 0.6 });
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
    fishSystem.setLure({ x: c.x, z: c.z, perfect: c.perfect, attraction });
    events.emit('cast:land', { x: c.x, z: c.z, depth: Math.round(c.depth * 100) / 100, perfect: Boolean(c.perfect) });
    if (c.perfect) { hud.toast('Perfect cast'); audio.perfect(); }
    rod.tipWorld(tip);
    line.setLength(tip.distanceTo(lure.pos) * 1.05);
    player.pose(null);
    refreshButton();
  }

  // --- waiting / hook ----------------------------------------------------------------------
  function tryHook() {
    if (mode !== 'wait' || flight.active || retrieve) return;
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
  function startFight(fish) {
    fishSystem.take(fish);
    fightFish = fish;
    fightInfo = fish.info;
    const roll = rollCatch(fish.info, lastCast?.perfect);
    fish.catchRoll = roll;
    const castAngle = Math.atan2(lure.pos.x - player.position.x, lure.pos.z - player.position.z);
    fight = createFight({
      fish, info: fish.info, ...roll, state, island, water, splashes,
      playerPos: player.position, castAngle,
      hooks: {
        shake: (a) => cameraRig.shake(a),
        move: (id, m) => { hint(`move:${id}`, m.hint); if (m.air) audio.splash(m.air.height > 1 ? 1.4 : 0.5); },
        bow: () => { hud.toast('Bowed!', 0.8); audio.hook(); },
        tired: () => hud.toast('It\'s tiring, bring it in!', 1.4),
        thrash: () => audio.splash(0.4),
      },
    });
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
    const roll = fish.catchRoll;
    if (status === 'caught') {
      events.emit('fish:caught', {
        fishId: fish.id,
        variant: fish.variant || 'basic',
        weight: roll.weight,
        sizeClass: roll.sizeClass,
        islandId: state.world.islandId,
        perfectCast: Boolean(lastCast?.perfect),
      });
      splashes.splash(player.position.x, player.position.z, 0.6);
      audio.catchChime();
      navigator.vibrate?.([30, 40, 60]);
      fishSystem.finish(fish, 'held');
      heldFish = fish;
      events.emit('fish:landed-show', { uid: fish.uid, fishId: fish.id, variant: fish.variant || 'basic', object: fish.object });
      line.hide();
      lure.inWater = false;
      player.pose('celebrate', { once: true });
      catchTimer = 2.0;
      setMode('catch');
    } else {
      events.emit('fish:lost', { fishId: fish.id, variant: fish.variant || 'basic', reason: status });
      if (status === 'snap') { audio.snap(); hud.toast('Snap! The line broke'); cameraRig.shake(0.4); }
      else { audio.lost(); hud.toast('It threw the hook'); }
      fishSystem.finish(fish, 'escaped');
      line.hide();
      lure.inWater = false;
      player.pose(null);
      setMode('explore');
    }
    fight = null;
    fightFish = null;
    reeling = false;
    steer = 0;
    hud.setMainPressed(false);
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
    else if (mode === 'wait') tryHook();
    else if (mode === 'fight') {
      reeling = true;
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
  }

  // Tapping anywhere on the game during the bite window also sets the hook (bigger target).
  document.getElementById('game')?.addEventListener('pointerdown', () => {
    if (modal) return;
    if (mode === 'wait' && fishSystem.biteProgress()) tryHook();
    else if (mode === 'fight' && fight?.state.bowWindow) bowTap = true;
  });

  // Desktop: Space acts as the main button (aim with the mouse from the button), A/D steer.
  input.onKey((code, down) => {
    if (code === 'Space') {
      if (down) {
        if (mode === 'explore') {
          // Quick cast straight ahead of the player for keyboard users.
          const c = hud.buttonCentre();
          beginAim(c.x, c.y);
          aim.pointer(c.x, c.y - aim.maxDrag * 0.6);
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
    } else if (mode === 'explore') state.world.mode = 'explore';
  });

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
  function screenOf(v) {
    tmp.copy(v).project(cameraRig.camera);
    const r = hudRoot.getBoundingClientRect();
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, visible: tmp.z < 1 };
  }

  function update(dt, realDt) {
    // Rod pose follows the hand.
    player.handAnchor.getWorldPosition(hand);
    let yaw = player.facing;
    let pitch = 0.78;
    let bend = 0.04;
    if (mode === 'aim') {
      const p = Math.min(1, aim.dragLength / aim.maxDrag);
      pitch = 0.9 + p * 0.95;            // drawn back over the shoulder
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
      aim.update(realDt, tip, player.position);
      if (aim.info.hasAim) player.faceTowards(aim.target.x, aim.target.z);
      cameraRig.setFocus(
        THREE.MathUtils.lerp(player.position.x, aim.info.hasAim ? aim.target.x : player.position.x, 0.5), 0,
        THREE.MathUtils.lerp(player.position.z, aim.info.hasAim ? aim.target.z : player.position.z + 3, 0.5),
      );
    } else if (mode === 'wait') {
      if (flight.active) updateFlight(dt);
      else if (retrieve) updateRetrieve(dt);
      else {
        // Lure floats with the swell; nibbles dip it, a bite drags it under.
        const bp = fishSystem.biteProgress();
        lure.dip = Math.max(0, lure.dip - dt * 0.5);
        const sink = bp ? 0.22 + Math.sin(performance.now() * 0.03) * 0.05 : lure.dip;
        lure.pos.y = water.surfaceY(lure.pos.x, lure.pos.z) - sink;
        lure.bobTimer -= dt;
        if (lure.bobTimer <= 0) { water.addRipple(lure.pos.x, lure.pos.z, 0.14); lure.bobTimer = 1.8; }
        line.setLength(tip.distanceTo(lure.pos) * (bp ? 1.0 : 1.06));
      }
      cameraRig.setFocus(THREE.MathUtils.lerp(player.position.x, lure.pos.x, 0.45), 0, THREE.MathUtils.lerp(player.position.z, lure.pos.z, 0.45));
      refreshButton();
    } else if (mode === 'fight' && fight) {
      const input = { reeling: reeling || keyReel, steer: keySteer || steer, bowTap };
      bowTap = false;
      const status = modal ? 'fighting' : fight.update(dt, input);
      const fp = fight.fishPoint();
      lure.pos.set(fp.x, water.surfaceY(fp.x, fp.z) - (fightFish.airY > 0 ? -fightFish.airY : 0.12), fp.z);
      line.setTension(fight.state.tension);
      line.setLength(tip.distanceTo(lure.pos) * (1.0 + (1 - fight.state.tension) * 0.08));
      hud.setMeters(fight.state.tension, fight.state.stamina, { danger: fight.state.overload > 0.2 });
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
      cameraRig.setFocus(THREE.MathUtils.lerp(player.position.x, fp.x, 0.45), 0, THREE.MathUtils.lerp(player.position.z, fp.z, 0.45));
      if (status !== 'fighting') endFight(status);
    } else if (mode === 'catch') {
      cameraRig.setFocus(player.position.x, 0, player.position.z);
      if (heldFish) {
        // Held up in front of the player, turning slowly (catch-card turntable pose).
        player.handAnchor.getWorldPosition(hand);
        const o = heldFish.object;
        o.position.set(hand.x + Math.sin(player.facing) * 0.35, hand.y + 0.25, hand.z + Math.cos(player.facing) * 0.35);
        o.rotation.set(0, o.rotation.y + realDt * 1.6, Math.PI / 2 * 0.15);
        heldFish.swim.set('landed');
      }
      if (!modal) catchTimer -= realDt;
      if (catchTimer <= 0) {
        if (heldFish) { fishSystem.finish(heldFish, 'caught'); heldFish = null; }
        player.pose(null);
        setMode('explore');
      }
    } else {
      cameraRig.setFocus(player.position.x, 0, player.position.z);
    }

    // Line and lure
    if (line.active) {
      line.update(dt, tip, lure.pos, cameraRig.camera, (x, z) => water.surfaceY(x, z));
      if (mode !== 'fight') line.setTension(fishSystem.biteProgress() ? 0.5 : 0);
    }
    if (lure.model) {
      lure.model.visible = line.active;
      lure.model.position.copy(lure.pos);
    }

    // Overlay
    const frame = {};
    const j = input.joystick;
    if (j.active) frame.joystick = { active: true, ox: j.ox, oy: j.oy, vx: j.vx, vy: j.vy, radius: input.JOY_RADIUS };
    if (mode === 'aim') {
      const info = aim.info;
      frame.aim = {
        drag: aim.dragVector, dragLength: aim.dragLength, deadZone: aim.deadZone, maxDrag: aim.maxDrag,
        hasAim: info.hasAim, valid: info.valid, band: info.band.name, depth: info.depth, fish: info.fishInside,
        reticle: info.hasAim ? screenOf(aim.target) : null, perfect: aim.perfectNow,
      };
    }
    const bp = mode === 'wait' && fishSystem.biteProgress();
    if (bp) {
      const s = screenOf(lure.pos);
      frame.bite = { x: s.x, y: s.y, remaining: bp.remaining, window: bp.window };
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
