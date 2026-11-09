// Building placement (9b.6, INTERFACES "Building placement").
// build:start → ack build:placing at once. New buildings: the camera lifts, the model follows the
// finger as a ghost, snaps to free build spots on owned land (green valid / red not), Turn rotates,
// Build confirms (build:placed) or Cancel (build:cancel). Upgrades, plots and piers confirm at once;
// their animation plays when B's island:changed arrives (island.js).
import * as THREE from 'three';
import { loadModel, pickAsset, assetEntry } from '../core/assets.js';

const SNAP_RADIUS = 4.5;

function spotRingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffe2a0') }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        float ring = smoothstep(0.06, 0.0, abs(r - 0.82)) ;
        float dash = step(0.5, fract(atan(p.y, p.x) * 2.546 + uTime * 0.4));
        float a = ring * mix(0.45, 1.0, dash) + smoothstep(0.82, 0.0, r) * 0.12;
        gl_FragColor = vec4(uColor * a * 1.4, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

function ghostify(object) {
  const mats = [];
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const g = list.map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.62;
      c.depthWrite = false;
      if ('emissive' in c) c.emissive = new THREE.Color('#2fbf6a');
      mats.push(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? g : g[0];
  });
  return mats;
}

export function createPlacement({ state, events, island, player, cameraRig, input, hud, surface, under, fishing }) {
  let job = null; // { kind, id, level, model, ghost, mats, x, z, rot, valid, markers }
  const markers = new THREE.Group();
  markers.name = 'build-spots';
  surface.add(markers);
  const ringGeo = new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2);
  const ringMat = spotRingMaterial();

  // Buttons (B's theme names only; layout inline).
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:0;right:0;bottom:calc(22px + env(safe-area-inset-bottom));display:none;justify-content:center;gap:12px;pointer-events:none;';
  bar.innerHTML = `
    <button type="button" class="btn" data-act="cancel" style="pointer-events:auto;min-height:48px;min-width:88px;">Cancel</button>
    <button type="button" class="btn btn--round" data-act="turn" style="pointer-events:auto;width:56px;height:56px;" aria-label="Turn the building">Turn</button>
    <button type="button" class="btn btn--primary" data-act="build" style="pointer-events:auto;min-height:48px;min-width:112px;">Build here</button>`;
  hud.root.appendChild(bar);
  const buildBtn = bar.querySelector('[data-act="build"]');
  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!job) return;
    if (act === 'cancel') cancel();
    if (act === 'turn') { job.rot += Math.PI / 4; applyGhost(); navigator.vibrate?.(6); }
    if (act === 'build' && job.valid) confirm();
  });

  function spotsFor(id, modelId) {
    const water = assetEntry('world', modelId || '')?.placement === 'water' || id === 'boat_dock';
    if (water) {
      // Water buildings go at the shore line next to owned land.
      const d = island.layout.defaultBuildingSpots[id];
      return d ? [{ x: d.x, z: d.z, rot: d.rot, water: true }] : [];
    }
    return island.freeSpots(id);
  }

  function landOk(x, z, water) {
    if (water) return island.waterDepthAt(x, z) > 0.4 && island.waterDepthAt(x, z) < 3;
    for (const [ox, oz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) {
      if (island.terrain.heightAt(x + ox, z + oz) < 0.15) return false;
      if (island.terrain.slopeAt(x + ox, z + oz) > 0.8) return false;
    }
    for (const b of Object.values(island.buildings)) if (b.obj && Math.hypot(b.x - x, b.z - z) < 3) return false;
    return true;
  }

  function applyGhost() {
    if (!job) return;
    const g = job.ghost;
    const y = job.water ? 0 : island.groundAt(job.x, job.z);
    if (g) {
      g.position.set(job.x, y, job.z);
      g.rotation.y = job.rot;
      const col = new THREE.Color(job.valid ? '#2fbf6a' : '#e0614a');
      for (const m of job.mats) { if (m.emissive) m.emissive.copy(col).multiplyScalar(0.55); m.opacity = job.valid ? 0.7 : 0.45; }
    }
    buildBtn.disabled = !job.valid;
    buildBtn.setAttribute('aria-disabled', job.valid ? 'false' : 'true');
  }

  function moveTo(x, z) {
    if (!job) return;
    let best = null;
    let bestD = SNAP_RADIUS;
    for (const s of job.spots) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) {
      if (job.snapped !== best) { navigator.vibrate?.(8); job.rot = best.rot; }
      job.snapped = best;
      job.x = best.x; job.z = best.z; job.water = Boolean(best.water); job.valid = true;
    } else {
      job.snapped = null;
      job.x = x; job.z = z;
      job.valid = landOk(x, z, job.water);
    }
    applyGhost();
  }

  // Finger on the game: the ghost follows (pointer handlers stay passive outside placement).
  const canvas = document.getElementById('game');
  let dragId = null;
  canvas?.addEventListener('pointerdown', (e) => { if (!job) return; dragId = e.pointerId; follow(e); });
  canvas?.addEventListener('pointermove', (e) => { if (job && e.pointerId === dragId) follow(e); });
  canvas?.addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });
  function follow(e) {
    const p = player.groundPointFromScreen(e.clientX, e.clientY);
    if (p) moveTo(p.x, p.z);
  }

  async function start({ kind, id, level, model, place } = {}) {
    if (!id) return;
    events.emit('build:placing', { id });
    if (!place || kind !== 'building') {
      // Upgrade / plot / pier: no placement; B charges, island:changed animates it.
      const b = island.buildings[id];
      events.emit('build:placed', { kind, id, level, x: b?.x ?? null, z: b?.z ?? null, rot: b?.rot ?? 0 });
      showcase(kind, id, b);
      return;
    }
    if (job) cancel();
    const modelId = pickAsset('world', [model, `${id}_l${level}`, `${id}_l1`]);
    job = { kind, id, level, model: modelId, ghost: null, mats: [], x: 0, z: 0, rot: 0, valid: false, spots: [], water: false };
    job.spots = spotsFor(id, modelId);
    for (const s of job.spots) {
      const m = new THREE.Mesh(ringGeo, ringMat);
      m.position.set(s.x, (s.water ? 0 : island.groundAt(s.x, s.z)) + 0.06, s.z);
      m.renderOrder = 25;
      markers.add(m);
    }
    state.world.mode = 'build';
    input.lock('build');
    player.lockMovement(true);
    hud.setMainLabel('', { hidden: true });
    bar.style.display = 'flex';
    cameraRig.setMode('build');
    const first = job.spots[0] || { x: player.position.x + 2, z: player.position.z, rot: 0 };
    cameraRig.setFocus(first.x, 0, first.z + 1);
    if (modelId) {
      const m = await loadModel('world', modelId);
      if (m && job && job.id === id) {
        job.ghost = m.scene;
        job.ghost.userData.ghost = true;
        job.mats = ghostify(job.ghost);
        under.add(job.ghost);
      }
    }
    if (job) moveTo(first.x, first.z);
    if (job && !job.spots.length) hud.toast('No free spot: drag it onto open sand', 2.2);
  }

  function exit() {
    job?.ghost?.removeFromParent();
    markers.clear();
    job = null;
    bar.style.display = 'none';
    input.unlock('build');
    player.lockMovement(false);
    state.world.mode = 'explore';
    fishing.refresh?.();
    cameraRig.setMode('explore');
  }

  function confirm() {
    const j = job;
    events.emit('build:placed', { kind: j.kind, id: j.id, level: j.level, x: +j.x.toFixed(2), z: +j.z.toFixed(2), rot: +j.rot.toFixed(3) });
    exit();
    showcase('building', j.id, { x: j.x, z: j.z });
  }

  function cancel() {
    const j = job;
    if (!j) return;
    events.emit('build:cancel', { id: j.id });
    exit();
  }

  // Point the camera at what is being built so the animation is seen.
  let show = null;
  function showcase(kind, id, at) {
    let p = at && Number.isFinite(at.x) ? at : null;
    if (kind === 'plot') p = island.layout.plots[id] || p;
    if (kind === 'pier') {
      const d = island.decks[0];
      if (d) p = { x: d.x0 + d.ux * (d.len + 1.5), z: d.z0 + d.uz * (d.len + 1.5) };
    }
    if (!p) return;
    show = { x: p.x, z: p.z, t: kind === 'plot' ? 3.6 : 2.6 };
  }

  return {
    get active() { return Boolean(job); },
    // Debug/test: confirm at the current (snapped) spot.
    confirmNow() { if (job && job.valid) { confirm(); return true; } if (job) { cancel(); } return false; },
    start,
    cancel,
    // Called each frame: camera focus while placing or showing a build.
    update(realDt) {
      ringMat.uniforms.uTime.value += realDt;
      if (job) {
        cameraRig.setMode('build');
        cameraRig.setFocus(job.x, 0, job.z + 1);
        return true;
      }
      if (show) {
        show.t -= realDt;
        cameraRig.setFocus(show.x, 0, show.z + 1);
        if (show.t <= 0) show = null;
        return true;
      }
      return false;
    },
  };
}
