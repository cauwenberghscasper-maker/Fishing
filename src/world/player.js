// Player: character model + clips from Agent D's character manifest, joystick / tap-to-move
// walking on the island, wading wakes, contact shadow, and a hand anchor for the rod.
import * as THREE from 'three';
import { loadModel, pickAsset, assetEntry } from '../core/assets.js';

const WALK_SPEED = 3.0;
const RUN_SPEED = 5.4;
const TURN_RATE = 12;

// Clip name patterns per game action, best match first. Gaps are listed in the handoff.
const CLIP_PATTERNS = {
  idle: [/^idle$/i, /idle/i],
  waitIdle: [/^fish_idle$/i, /^idle$/i],
  walk: [/^walk$/i, /^walk(ing)?(_a)?$/i, /walk/i],
  run: [/^run$/i, /^run(ning)?(_a)?$/i, /run/i],
  castWind: [/^cast_windup$/i, /cast.*wind|wind.?up/i, /throw/i],
  aimLoop: [/^cast_aim$/i, /aim/i],
  cast: [/^cast_release$/i, /cast.*release|^cast$/i, /throw/i],
  reel: [/^reel_loop$/i, /reel/i, /use_item|interact/i],
  struggle: [/^struggle_loop$/i, /struggle|lean/i, /block(ing)?$/i],
  celebrate: [/^celebrate$/i, /celebrat|cheer|victory/i],
  holdUp: [/^hold_up_fish$/i, /hold.*up|show/i, /pick.?up/i],
  dodge: [/^dodge_left$/i, /dodge|roll/i],
  hit: [/^hit$/i, /hit/i],
  interact: [/^interact$/i],
  sit: [/^sit_idle$/i, /sit.*idle/i],
};

function makeContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(20,12,4,0.55)');
  grad.addColorStop(0.6, 'rgba(20,12,4,0.22)');
  grad.addColorStop(1, 'rgba(20,12,4,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlayer({ island, input, cameraRig, water, events, state }) {
  const root = new THREE.Group();
  root.name = 'player';
  const spawn = island.layout.spawn;
  const position = root.position;
  position.set(spawn.x, island.groundAt(spawn.x, spawn.z), spawn.z);
  let facing = spawn.facing ?? Math.PI;
  let desiredFacing = facing;
  let speed = 0;
  let moveTarget = null;
  let wakeTimer = 0;
  let model = null;
  let mixer = null;
  const clips = {};
  let currentAction = null;
  let currentName = '';
  let override = null; // { name, until } one-shot or held fishing pose
  const handAnchor = new THREE.Object3D();
  handAnchor.position.set(0.32, 1.15, 0.25); // fallback: right hand height when no rig
  root.add(handAnchor);
  let handBone = null;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.renderOrder = 2;
  shadow.name = 'player-contact-shadow';
  const shadowRoot = new THREE.Group();
  shadowRoot.add(shadow);

  async function loadCharacter() {
    const id = pickAsset('character', ['fisher_player', 'player', 'fisher']);
    if (!id) return false;
    const m = await loadModel('character', id);
    if (!m) return false;
    model = m.scene;
    const entry = assetEntry('character', id);
    if (entry.rotY) model.rotation.y = entry.rotY;
    root.add(model);
    mixer = new THREE.AnimationMixer(model);
    const all = m.animations;
    for (const [action, patterns] of Object.entries(CLIP_PATTERNS)) {
      let clip = null;
      for (const re of patterns) {
        if (clip) break;
        clip = all.find((c) => re.test(c.name)) || null;
      }
      if (clip) clips[action] = mixer.clipAction(clip);
    }
    model.traverse((o) => {
      if (!handBone && o.isBone && /hand.?slot.?r|hand.?r$|right.?hand|hand_r|r_hand/i.test(o.name)) handBone = o;
    });
    if (handBone) {
      handAnchor.removeFromParent();
      handAnchor.position.set(0, 0, 0);
      handBone.add(handAnchor);
    }
    // One-shot clips can chain into a loop (cast wind-up → aim hold).
    mixer.addEventListener('finished', (e) => {
      if (chainNext && e.action === currentAction) {
        const next = chainNext;
        chainNext = null;
        play(next, 0.15);
      }
    });
    play('idle', 0);
    return true;
  }
  let chainNext = null;

  function play(name, fade = 0.22, { once = false, timeScale = 1, then = null } = {}) {
    chainNext = once ? then : null;
    const action = clips[name] || (name === 'run' ? clips.walk : null) || (name === 'aimLoop' ? clips.castWind : null) || clips.idle;
    if (!action || (action === currentAction && !once)) return;
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    if (currentAction && currentAction !== action) action.crossFadeFrom(currentAction, fade, false);
    action.play();
    currentAction = action;
    currentName = name;
  }

  // Ray-march the camera ray against the heightfield/decks for tap-to-move.
  const raycaster = new THREE.Raycaster();
  function groundPointFromScreen(sx, sy) {
    const rect = document.getElementById('game')?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cameraRig.camera);
    const { origin, direction } = raycaster.ray;
    let prevT = 0;
    for (let t = 0.5; t < 200; t += 0.35) {
      const x = origin.x + direction.x * t, y = origin.y + direction.y * t, z = origin.z + direction.z * t;
      const g = Math.max(island.groundAt(x, z), 0);
      if (y <= g) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const mx = origin.x + direction.x * mid, mz = origin.z + direction.z * mid;
          if (origin.y + direction.y * mid <= Math.max(island.groundAt(mx, mz), 0)) hi = mid; else lo = mid;
        }
        return new THREE.Vector3(origin.x + direction.x * hi, 0, origin.z + direction.z * hi);
      }
      prevT = t;
    }
    return null;
  }

  input.onTap(({ x, y }) => {
    if (state.world.mode !== 'explore') return;
    const p = groundPointFromScreen(x, y);
    if (p) {
      moveTarget = p;
      events.emit('player:moveTarget', { x: p.x, z: p.z });
    }
  });

  let locked = false;

  function update(dt, realDt) {
    const mv = input.moveVector();
    let wish = new THREE.Vector2(0, 0);
    let wishSpeed = 0;
    if (!locked) {
      if (mv.x || mv.y) {
        moveTarget = null;
        // Camera looks north: screen right = +x, screen down = +z.
        wish.set(mv.x, mv.y);
        const mag = Math.min(1, wish.length());
        wishSpeed = mag > 0.82 ? RUN_SPEED : WALK_SPEED * Math.max(0.35, mag / 0.82);
        wish.normalize();
      } else if (moveTarget) {
        const dx = moveTarget.x - position.x, dz = moveTarget.z - position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) moveTarget = null;
        else {
          wish.set(dx / d, dz / d);
          wishSpeed = d > 6 ? RUN_SPEED : WALK_SPEED;
        }
      }
    }
    // Smooth speed so starts/stops do not pop.
    speed += (wishSpeed - speed) * (1 - Math.exp(-10 * dt));
    if (wishSpeed > 0.01) desiredFacing = Math.atan2(wish.x, wish.y);
    if (speed > 0.05 && wish.lengthSq() > 0) {
      const res = island.resolveMove(position, wish.x * speed * dt, wish.y * speed * dt);
      position.x = res.x;
      position.z = res.z;
      if (res.blocked && moveTarget) moveTarget = null;
    }
    position.y = island.groundAt(position.x, position.z);

    // Turn towards the desired facing along the shortest arc.
    let df = desiredFacing - facing;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    facing += df * (1 - Math.exp(-TURN_RATE * dt));
    root.rotation.y = facing;

    // Contact shadow sits on the ground (or the deck), fades while wading.
    const depth = -position.y;
    shadowRoot.position.set(position.x, position.y + 0.03, position.z);
    shadow.material.opacity = depth > 0 ? Math.max(0, 1 - depth * 3) : 1;

    // Wading wake.
    if (depth > 0.05 && speed > 0.4) {
      wakeTimer -= dt;
      if (wakeTimer <= 0) {
        water.addRipple(position.x, position.z, 0.35 + Math.min(0.4, speed * 0.06));
        wakeTimer = 0.32;
      }
    }

    if (mixer) {
      if (!override) {
        if (speed > 4.2) play('run');
        else if (speed > 0.5) play('walk', 0.2, { timeScale: Math.max(0.6, speed / WALK_SPEED) });
        else play('idle', 0.3);
      }
      mixer.update(dt);
    }

    island.updateZones(position);
  }

  return {
    root,
    shadowRoot,
    position,
    handAnchor,
    get hasModel() { return Boolean(model); },
    get facing() { return facing; },
    get speed() { return speed; },
    get clipsAvailable() { return Object.keys(clips); },
    get animName() { return currentName || 'idle'; },
    load: loadCharacter,
    update,
    // Face a world point (aiming, fighting).
    faceTowards(x, z) { desiredFacing = Math.atan2(x - position.x, z - position.z); },
    lockMovement(on) { locked = on; if (on) { moveTarget = null; } },
    // Fishing poses: name from CLIP_PATTERNS; null returns to locomotion.
    pose(name, opts) {
      if (!name) { override = null; return; }
      override = { name };
      play(name, 0.18, opts);
    },
    teleport(x, z) {
      position.set(x, island.groundAt(x, z), z);
      moveTarget = null;
      speed = 0;
    },
    groundPointFromScreen,
  };
}
