// Aim mode (master prompt 4.1): slingshot drag from the cast button, trajectory arc, landing
// reticle (depth band colour, compass ticks, fish inside it light up), wobble that settles while
// the thumb holds still, and a timing ring for the perfect cast.
import * as THREE from 'three';

const ARC_POINTS = 40;
const RETICLE_R = 1.1;          // metres
const DEAD_ZONE = 30;           // px: release inside = cancel
const PERFECT_PERIOD = 1.3;     // s (real time)

export const DEPTH_BANDS = [
  { max: 0.3, name: 'No water', color: '#e0614a' },
  { max: 1.5, name: 'Shallows', color: '#7ff5df' },
  { max: 4.0, name: 'Mid-water', color: '#3fbbe0' },
  { max: Infinity, name: 'Deep water', color: '#9a86ff' },
];

export function depthBand(depth) {
  return DEPTH_BANDS.find((b) => depth < b.max) || DEPTH_BANDS[DEPTH_BANDS.length - 1];
}

function createArcMesh() {
  const positions = new Float32Array(ARC_POINTS * 2 * 3);
  const along = new Float32Array(ARC_POINTS * 2);
  const idx = [];
  for (let i = 0; i < ARC_POINTS; i++) {
    along[i * 2] = along[i * 2 + 1] = i / (ARC_POINTS - 1);
    if (i < ARC_POINTS - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(idx);
  const material = new THREE.ShaderMaterial({
    name: 'AimArc',
    uniforms: { uTime: { value: 0 }, uLen: { value: 10 }, uColor: { value: new THREE.Color('#ffe6a6') }, uValid: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aAlong;
      varying float vAlong;
      void main() { vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uLen, uValid;
      uniform vec3 uColor;
      varying float vAlong;
      void main() {
        float dash = step(0.45, fract(vAlong * uLen * 1.6 - uTime * 1.8));
        float fade = smoothstep(0.0, 0.12, vAlong) * (0.55 + 0.45 * vAlong);
        vec3 c = mix(vec3(0.9, 0.35, 0.28), uColor, uValid) * 1.6;
        float a = dash * fade * 0.85;
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  return { mesh, positions, geo, material };
}

function createReticleMesh() {
  const size = RETICLE_R * 2 * 2.7;
  const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    name: 'AimReticle',
    uniforms: {
      uBand: { value: new THREE.Color('#7ff5df') },
      uGold: { value: new THREE.Color('#ffd27a') },
      uRing: { value: 2.0 },        // timing ring radius in reticle radii
      uPerfect: { value: 0 },
      uWobble: { value: 0.5 },      // uncertainty radius in reticle radii
      uValid: { value: 1 },
      uTime: { value: 0 },
      uScale: { value: 2.7 },
    },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() { vP = (uv - 0.5) * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBand, uGold;
      uniform float uRing, uPerfect, uWobble, uValid, uTime, uScale;
      varying vec2 vP;
      float ring(float r, float at, float w) { return smoothstep(w, 0.0, abs(r - at)); }
      void main() {
        vec2 p = vP * uScale;            // 1.0 = reticle radius
        float r = length(p);
        float ang = atan(p.y, p.x);
        vec3 band = mix(vec3(0.95, 0.38, 0.3), uBand, uValid);
        float outer = ring(r, 1.0, 0.07);
        float inner = ring(r, 0.62, 0.035) * 0.55;
        // Compass ticks: 4 long cardinal, 4 short.
        float tick = 0.0;
        float a8 = abs(fract(ang / 6.2831853 * 8.0 + 0.5) - 0.5);
        float a4 = abs(fract(ang / 6.2831853 * 4.0 + 0.5) - 0.5);
        tick += step(a4, 0.02) * step(1.05, r) * step(r, 1.32);
        tick += step(a8, 0.025) * step(1.05, r) * step(r, 1.18) * 0.7;
        float dotc = smoothstep(0.09, 0.05, r);
        float spread = smoothstep(uWobble + 0.04, uWobble - 0.04, r) * 0.16 * uValid;
        float timing = ring(r, uRing, mix(0.05, 0.09, uPerfect)) * uValid * smoothstep(2.6, 2.2, uRing);
        vec3 col = band * (outer * 1.4 + inner + spread) + uGold * (tick * 1.3 + dotc * 1.6) + mix(band, uGold * 2.0, uPerfect) * timing;
        float a = clamp(outer * 0.95 + inner + tick * 0.9 + dotc + spread + timing * (0.5 + uPerfect * 0.5), 0.0, 1.0);
        if (uValid < 0.5) {
          float cross = smoothstep(0.08, 0.0, abs(abs(p.x) - abs(p.y))) * step(r, 0.7);
          col += band * cross * 1.4;
          a = max(a, cross);
        }
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 29;
  mesh.frustumCulled = false;
  return { mesh, material };
}

export function createAim({ island, fishSystem, water, state }) {
  const arc = createArcMesh();
  const reticle = createReticleMesh();
  const group = new THREE.Group();
  group.name = 'aim';
  group.add(arc.mesh, reticle.mesh);
  group.visible = false;

  const target = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();  // reticle centre without wobble (follows the thumb, smoothed)
  const rawAim = new THREE.Vector3();    // where the thumb points this frame
  let wobbleNow = 0;                     // smoothed wobble amplitude, so it never jumps
  let aimed = false;                     // first aiming frame snaps, later frames glide
  const start = new THREE.Vector3();
  let active = false;
  let anchor = { x: 0, y: 0 };
  let drag = { x: 0, y: 0 };
  let lastPointer = null;
  let holdStill = 0;
  let realTime = 0;
  let startTime = 0;
  let valid = false;
  let hasAim = false;
  let depth = 0;
  let band = DEPTH_BANDS[1];
  let fishInside = 0;
  const seeds = [Math.random() * 10, Math.random() * 10, Math.random() * 10, Math.random() * 10];
  // Feel: edges the controller turns into haptic ticks and sounds.
  const feel = { perfectEdge: false, fishEdge: false, powerStep: 0 };
  let wasPerfect = false;
  let lastFishInside = 0;
  let lastPowerStep = 0;
  let power = 0;

  function gear() {
    const g = state.gear || {};
    return {
      maxCast: g.castDistance || 14,
      steadiness: g.steadiness ?? 0.5,
    };
  }

  function maxDragPx() {
    return Math.max(140, Math.min(320, Math.min(window.innerHeight, window.innerWidth * 1.6) * 0.36));
  }

  // A slow sway that settles while the thumb is still: patience gives accuracy,
  // but dragging itself must feel smooth (Casper: "dragging to cast is not smooth").
  function wobbleAmount(dist) {
    const g = gear();
    const base = (0.18 + dist * 0.035) * (1.3 - g.steadiness * 0.75);
    const settle = 0.1 + 0.9 * Math.exp(-holdStill / 0.9);
    return base * settle;
  }

  function perfectPhase() {
    const phase = ((realTime - startTime) / PERFECT_PERIOD) % 1;
    const ringR = 2.5 - 1.65 * phase;
    return { ringR, perfect: Math.abs(ringR - 1) < 0.15 };
  }

  return {
    group,
    get active() { return active; },
    get info() {
      return { valid, hasAim, depth, band, fishInside, distance: hasAim ? Math.hypot(aimPoint.x - start.x, aimPoint.z - start.z) : 0 };
    },
    begin(anchorX, anchorY) {
      active = true;
      anchor = { x: anchorX, y: anchorY };
      drag = { x: 0, y: 0 };
      holdStill = 0;
      startTime = realTime;
      hasAim = false;
      lastPointer = null;
      wobbleNow = 0;
      aimed = false;
      wasPerfect = false;
      lastFishInside = 0;
      lastPowerStep = 0;
      power = 0;
      group.visible = true;
    },
    pointer(x, y) {
      drag = { x: x - anchor.x, y: y - anchor.y };
      if (lastPointer) {
        // moving the thumb unsettles the aim a little, never all the way back
        const moved = Math.hypot(x - lastPointer.x, y - lastPointer.y);
        holdStill = Math.max(0, holdStill - Math.min(moved, 40) * 0.006);
      }
      lastPointer = { x, y };
    },
    get dragVector() { return drag; },
    get power() { return hasAim ? power : 0; },
    // Read-and-clear the feel edges for this frame.
    takeFeel() {
      const out = { ...feel };
      feel.perfectEdge = false; feel.fishEdge = false; feel.powerStep = 0;
      return out;
    },
    get dragLength() { return Math.hypot(drag.x, drag.y); },
    get deadZone() { return DEAD_ZONE; },
    get maxDrag() { return maxDragPx(); },
    update(realDt, rodTip, playerPos) {
      realTime += realDt;
      if (!active) return;
      holdStill += realDt;
      const len = Math.hypot(drag.x, drag.y);
      hasAim = len > DEAD_ZONE;
      const g = gear();
      start.copy(rodTip);
      if (!hasAim) {
        arc.mesh.visible = false;
        reticle.mesh.visible = false;
        fishSystem.clearHighlight();
        return;
      }
      arc.mesh.visible = true;
      reticle.mesh.visible = true;
      // Pull back to throw: the cast goes opposite to the drag (camera looks north, no yaw).
      power = Math.pow(THREE.MathUtils.clamp((len - DEAD_ZONE) / (maxDragPx() - DEAD_ZONE), 0, 1), 1.1);
      const step = Math.min(4, Math.floor(power * 4 + 0.001));
      if (step > lastPowerStep) feel.powerStep = step;
      lastPowerStep = step;
      const dist = 2.5 + power * (g.maxCast - 2.5);
      const dx = -drag.x / len, dz = -drag.y / len;
      rawAim.set(playerPos.x + dx * dist, 0, playerPos.z + dz * dist);
      // Glide after the thumb instead of jumping between touch samples (~60 ms lag, frame-rate independent).
      if (!aimed) { aimPoint.copy(rawAim); aimed = true; }
      else aimPoint.lerp(rawAim, 1 - Math.exp(-realDt / 0.06));
      const wTarget = wobbleAmount(dist);
      wobbleNow += (wTarget - wobbleNow) * (1 - Math.exp(-realDt / 0.35));
      const w = wobbleNow;
      const t = realTime;
      // slow, smooth sway (0.6–1.4 Hz) instead of a fast shake
      const nx = Math.sin(t * 1.3 + seeds[0]) * 0.6 + Math.sin(t * 0.8 + seeds[1]) * 0.4;
      const nz = Math.sin(t * 1.1 + seeds[2]) * 0.6 + Math.sin(t * 0.6 + seeds[3]) * 0.4;
      target.set(aimPoint.x + nx * w, 0, aimPoint.z + nz * w);

      depth = island.waterDepthAt(target.x, target.z);
      band = depthBand(depth);
      valid = depth >= 0.3 && !island.deckAt(target.x, target.z);
      const y = valid ? water.surfaceY(target.x, target.z) + 0.04 : Math.max(0, island.groundAt(target.x, target.z)) + 0.05;
      target.y = y;
      reticle.mesh.position.copy(target);
      const u = reticle.material.uniforms;
      u.uBand.value.set(band.color);
      u.uValid.value = valid ? 1 : 0;
      u.uWobble.value = Math.min(2.2, w / RETICLE_R + 0.15);
      const pp = perfectPhase();
      u.uRing.value = pp.ringR;
      u.uPerfect.value = pp.perfect ? 1 : 0;
      if (pp.perfect && !wasPerfect && valid) feel.perfectEdge = true;
      wasPerfect = pp.perfect;
      u.uTime.value = realTime;
      fishSystem.highlightWithin(target.x, target.z, RETICLE_R * 1.3);
      fishInside = fishSystem.countWithin(target.x, target.z, RETICLE_R * 1.3);
      if (fishInside > lastFishInside && valid) feel.fishEdge = true;
      lastFishInside = fishInside;

      // Trajectory: parabola from the rod tip, apex grows with distance.
      const apex = 1.2 + dist * 0.2;
      const view = new THREE.Vector3();
      for (let i = 0; i < ARC_POINTS; i++) {
        const k = i / (ARC_POINTS - 1);
        const px = THREE.MathUtils.lerp(start.x, target.x, k);
        const pz = THREE.MathUtils.lerp(start.z, target.z, k);
        const py = THREE.MathUtils.lerp(start.y, target.y, k) + apex * 4 * k * (1 - k);
        const tx = target.x - start.x, tz = target.z - start.z;
        view.set(-tz, 0, tx).normalize().multiplyScalar(0.05 + k * 0.05);
        arc.positions[i * 6] = px + view.x; arc.positions[i * 6 + 1] = py; arc.positions[i * 6 + 2] = pz + view.z;
        arc.positions[i * 6 + 3] = px - view.x; arc.positions[i * 6 + 4] = py; arc.positions[i * 6 + 5] = pz - view.z;
      }
      arc.geo.attributes.position.needsUpdate = true;
      arc.material.uniforms.uTime.value = realTime;
      arc.material.uniforms.uLen.value = dist;
      arc.material.uniforms.uValid.value = valid ? 1 : 0;
    },
    // Returns the cast or { cancelled: true }.
    release() {
      const len = Math.hypot(drag.x, drag.y);
      const result = (!hasAim || len <= DEAD_ZONE || !valid)
        ? { cancelled: true, reason: !hasAim || len <= DEAD_ZONE ? 'centre' : 'land' }
        : {
          cancelled: false,
          x: target.x,
          z: target.z,
          depth,
          perfect: perfectPhase().perfect,
          distance: Math.hypot(target.x - start.x, target.z - start.z),
          apex: 1.2 + Math.hypot(aimPoint.x - start.x, aimPoint.z - start.z) * 0.2,
        };
      this.end();
      return result;
    },
    end() {
      active = false;
      group.visible = false;
      lastPointer = null;
      fishSystem.clearHighlight();
    },
    get target() { return target; },
    get anchor() { return anchor; },
    get perfectNow() { return active && hasAim && perfectPhase().perfect; },
  };
}
