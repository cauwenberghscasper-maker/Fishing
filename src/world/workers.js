// Hired fishers (master prompt 4.6/4.8, Casper: "every hired fisher spawns as a worker"):
// each worker in the profile is one of D's worker characters. It walks from the camp to a free
// fishing spot, then fishes for real: cast, wait with the line out, reel, now and then a cheer.
import * as THREE from 'three';
import { loadModel, pickAsset } from '../core/assets.js';
import { CLIP_PATTERNS } from './player.js';

const MODELS = ['worker_netmender', 'worker_deckhand', 'worker_angler'];
const WALK_SPEED = 1.8;
const rand = (a, b) => a + Math.random() * (b - a);

function bindClips(model, animations) {
  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  for (const [action, patterns] of Object.entries(CLIP_PATTERNS)) {
    let clip = null;
    for (const re of patterns) { if (clip) break; clip = animations.find((c) => re.test(c.name)) || null; }
    if (clip) clips[action] = mixer.clipAction(clip);
  }
  let current = null;
  return {
    mixer,
    play(name, { once = false, fade = 0.25 } = {}) {
      const a = clips[name] || clips.idle;
      if (!a || (a === current && !once)) return;
      a.reset();
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = once;
      if (current && current !== a) a.crossFadeFrom(current, fade, false);
      a.play();
      current = a;
    },
  };
}

export function createWorkers({ island, state, events, under, render }) {
  const group = new THREE.Group();
  group.name = 'workers';
  under.add(group);
  const crew = new Map(); // workerId -> worker

  // Fishing spots: fixed shore spots, spots along the pier modules, and plot-gated ones.
  function spots() {
    const out = [];
    const d = island.decks[0];
    for (const s of island.layout.workerSpots) {
      if (s.plot && !island.owned.plots.has(s.plot)) continue;
      if (s.pier) {
        if (!d || d.len < s.pier * 3) continue;
        const along = s.pier * 3 - 1.2;
        const px = d.x0 + d.ux * along + -d.uz * s.side * 0.65;
        const pz = d.z0 + d.uz * along + d.ux * s.side * 0.65;
        out.push({ x: px, z: pz, face: [px + -d.uz * s.side * 6, pz + d.ux * s.side * 6] });
      } else out.push({ x: s.x, z: s.z, face: s.face });
    }
    return out;
  }

  function lureTarget(spot) {
    const dx = spot.face[0] - spot.x, dz = spot.face[1] - spot.z;
    const len = Math.hypot(dx, dz) || 1;
    for (const k of [6, 5, 7, 4, 8, 3]) {
      const x = spot.x + (dx / len) * k + rand(-0.8, 0.8), z = spot.z + (dz / len) * k + rand(-0.8, 0.8);
      if (island.waterDepthAt(x, z) > 0.6) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(spot.x + (dx / len) * 5, 0, spot.z + (dz / len) * 5);
  }

  async function spawn(w, index) {
    const modelId = pickAsset('character', [MODELS[index % MODELS.length], ...MODELS]);
    if (!modelId) return;
    const worker = { id: w.id, name: w.name, state: 'walk', t: 0, path: null, spot: null, lure: null, rig: null, root: new THREE.Group() };
    crew.set(w.id, worker);
    const m = await loadModel('character', modelId);
    if (!m || !crew.has(w.id)) return;
    worker.model = m.scene;
    worker.root.add(m.scene);
    worker.anim = bindClips(m.scene, m.animations);
    m.scene.traverse((o) => { if (!worker.hand && o.isBone && /hand.?slot.?r|hand_r|right.?hand/i.test(o.name)) worker.hand = o; });
    worker.rig = render.createAnglerRig?.();
    const camp = island.layout.camp;
    worker.root.position.set(camp.x + rand(-0.8, 0.8), 0, camp.z + 2.2);
    worker.root.position.y = island.groundAt(worker.root.position.x, worker.root.position.z);
    group.add(worker.root);
    assignSpot(worker);
    events.emit('worker:spawn', { workerId: w.id, name: w.name, object: worker.root });
  }

  function assignSpot(worker) {
    const taken = new Set([...crew.values()].filter((c) => c !== worker && c.spot).map((c) => c.spot.key));
    const free = spots().map((s) => ({ ...s, key: `${s.x.toFixed(1)},${s.z.toFixed(1)}` })).find((s) => !taken.has(s.key));
    worker.spot = free || null;
    worker.state = free ? 'walk' : 'idle';
  }

  function remove(id) {
    const w = crew.get(id);
    if (!w) return;
    w.rig?.dispose();
    w.root.removeFromParent();
    crew.delete(id);
  }

  function sync() {
    const list = state.net?.role === 'visitor' ? (island.owned.workers || []) : (state.profile?.workers || []);
    const ids = new Set(list.map((w) => w.id));
    for (const id of [...crew.keys()]) if (!ids.has(id)) remove(id);
    list.forEach((w, i) => { if (!crew.has(w.id)) spawn(w, i); });
    // New land or pier modules can free better spots for idle workers.
    for (const w of crew.values()) if (w.state === 'idle') assignSpot(w);
  }

  events.on('island:changed', () => setTimeout(sync, 50));
  events.on('island:grown', () => sync());

  const hand = new THREE.Vector3();
  function update(dt) {
    for (const w of crew.values()) {
      if (!w.model) continue;
      w.anim.mixer.update(dt);
      const p = w.root.position;
      w.t += dt;
      if (w.state === 'walk' && w.spot) {
        const dx = w.spot.x - p.x, dz = w.spot.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          w.state = 'cast';
          w.t = 0;
          w.root.rotation.y = Math.atan2(w.spot.face[0] - p.x, w.spot.face[1] - p.z);
          w.anim.play('castWind', { once: true });
        } else {
          const step = Math.min(d, WALK_SPEED * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          p.y = island.groundAt(p.x, p.z);
          w.root.rotation.y = Math.atan2(dx, dz);
          w.anim.play('walk');
        }
      } else if (w.state === 'idle') {
        w.anim.play('idle');
      } else if (w.state === 'cast') {
        if (w.t > 0.45 && !w.lure) { w.anim.play('cast', { once: true }); w.lure = lureTarget(w.spot); w.lureFly = 0; }
        if (w.lure) {
          w.lureFly = Math.min(1, w.lureFly + dt / 0.9);
          if (w.lureFly >= 1) { w.state = 'wait'; w.t = 0; w.waitFor = rand(5, 11); w.anim.play('waitIdle'); render.addRipple?.(w.lure.x, w.lure.z, 0.5); }
        }
      } else if (w.state === 'wait') {
        if (w.t > w.waitFor) { w.state = 'reel'; w.t = 0; w.anim.play('reel'); render.splash?.(w.lure.x, w.lure.z, 0.4); render.addRipple?.(w.lure.x, w.lure.z, 0.8); }
        else if (Math.random() < dt * 0.4) render.addRipple?.(w.lure.x, w.lure.z, 0.15);
      } else if (w.state === 'reel') {
        // Line comes in.
        const k = Math.min(1, dt * 0.45);
        w.lure.x += (p.x - w.lure.x) * k;
        w.lure.z += (p.z - w.lure.z) * k;
        if (w.t > 2.6) {
          const caught = Math.random() < 0.5;
          w.lure = null;
          w.state = caught ? 'cheer' : 'cast';
          w.t = 0;
          if (caught) w.anim.play('celebrate', { once: true });
          else w.anim.play('castWind', { once: true });
        }
      } else if (w.state === 'cheer' && w.t > 1.8) {
        w.state = 'cast'; w.t = 0; w.anim.play('castWind', { once: true });
      }

      // Rod + line from the hand bone.
      if (w.rig) {
        (w.hand || w.root).getWorldPosition(hand);
        if (!w.hand) hand.y += 1.1;
        const yaw = w.root.rotation.y;
        let lurePos = null;
        if (w.lure) {
          lurePos = w.lure.clone();
          if (w.state === 'cast') {
            const k = w.lureFly;
            lurePos.lerpVectors(hand, w.lure, k);
            lurePos.y += Math.sin(k * Math.PI) * 2;
          } else lurePos.y = -0.02;
        }
        const pitch = w.state === 'cast' && !w.lure ? 1.6 : (w.state === 'reel' ? 1.0 : 0.7);
        w.rig.update({ hand, yaw, pitch, bend: w.state === 'reel' ? 0.5 : 0.08, lure: lurePos, tension: w.state === 'reel' ? 0.6 : 0 }, dt, render.camera);
      }
    }
  }

  return { group, sync, update, get crew() { return crew; } };
}
