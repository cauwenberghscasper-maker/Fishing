// Vertex-shader swim (master prompt section 6). Fish models face +Z, length 1, pivot at the centre.
// One GLSL function drives both real models (via onBeforeCompile) and the silhouette decals, so
// a fish moves the same way before and after its model lands.
import * as THREE from 'three';

export const BODY_TYPES = { fusiform: 0, eel: 1, ray: 2, jelly: 3, bulky: 4, flat: 5, shelled: 6 };

// Body profile defaults (per-fish amp/freq/speed in fish-behaviour.json override these).
export const BODY_DEFAULTS = {
  fusiform: { amp: 0.07, freq: 1.0, speed: 5 },
  eel: { amp: 0.12, freq: 1.75, speed: 4.5 },
  ray: { amp: 0.12, freq: 0.6, speed: 2.4 },
  jelly: { amp: 0.12, freq: 1.0, speed: 2.0 },
  bulky: { amp: 0.05, freq: 1.0, speed: 2.6 },
  flat: { amp: 0.07, freq: 1.5, speed: 4.0 },
  shelled: { amp: 0.08, freq: 2.0, speed: 9.0 },
};

// How each behaviour state scales the swim (multipliers on amp and speed). States blend in JS.
export const SWIM_STATES = {
  idle: { amp: 1.0, speed: 1.0 },
  inspect: { amp: 0.7, speed: 0.8 },
  nibble: { amp: 1.3, speed: 1.8 },
  bite: { amp: 1.8, speed: 2.6 },
  thrash: { amp: 2.6, speed: 3.4 },
  run: { amp: 1.6, speed: 2.4 },
  dive: { amp: 1.4, speed: 2.0 },
  leap: { amp: 2.2, speed: 3.0 },
  tired: { amp: 0.45, speed: 0.5 },
  landed: { amp: 3.2, speed: 4.5 },
  still: { amp: 0.08, speed: 0.3 },
};

export const GLSL_SWIM = /* glsl */`
vec3 swimDisplace(vec3 p, vec4 swimA, vec4 swimB) {
  float body = swimA.x, phase = swimA.y, amp = swimA.z, freq = swimA.w;
  float bend = swimB.x, retract = swimB.y, inflate = swimB.z;
  const float TAU = 6.2831853;
  float s = clamp(0.5 - p.z, 0.0, 1.0); // 0 at the head, 1 at the tail
  vec3 q = p;
  if (body < 0.5) {            // fusiform: travelling wave, 0 at head, max at tail
    float env = 0.12 * s + 0.88 * s * s;
    q.x += amp * env * sin(TAU * freq * s * 0.5 - phase);
  } else if (body < 1.5) {     // eel: 1.5-2 wavelengths over the body
    float env = 0.35 + 0.65 * s;
    q.x += amp * env * sin(TAU * freq * s - phase);
  } else if (body < 2.5) {     // ray: wing flap travelling front to back
    float w = pow(clamp(abs(p.x) * 2.0, 0.0, 1.0), 1.6);
    q.y += amp * w * sin(phase - s * freq * 3.0);
  } else if (body < 3.5) {     // jelly: bell pulse, tentacles sway with delay
    float pulse = sin(phase);
    float bell = smoothstep(-0.1, 0.2, p.y);
    q.xz *= 1.0 - amp * 0.6 * pulse * bell;
    q.y *= 1.0 + amp * 0.8 * pulse * bell;
    q.x += amp * (1.0 - bell) * sin(phase - p.y * 5.0) * (-p.y);
  } else if (body < 4.5) {     // bulky: slow wobble, fin flutter, inflates
    float tail = smoothstep(0.72, 1.0, s);
    q.x += amp * 0.6 * s * sin(phase * 0.6);
    float fin = smoothstep(0.26, 0.5, abs(p.x));
    q.y += amp * fin * sin(phase * 2.6 + p.z * 9.0);
    q.x += amp * 0.9 * tail * sin(phase * 1.4);
    q *= 1.0 + inflate * 0.6 * (1.0 - tail);
  } else if (body < 5.5) {     // flat: ripple runs round the edge fins, body stays on the bottom
    float r = length(p.xz * 2.0);
    float edge = smoothstep(0.5, 0.95, r);
    float ang = atan(p.x, p.z);
    q.y += amp * edge * sin(ang * 3.0 + phase);
    q.x += amp * 0.5 * smoothstep(0.82, 1.0, s) * sin(phase * 0.8);
  } else {                     // shelled: shell (rear half) still, head and fins flutter, retracts
    float head = smoothstep(-0.05, 0.25, p.z);
    q.x += amp * head * sin(phase + p.z * 8.0) * 0.6;
    float fin = smoothstep(0.1, 0.28, abs(p.x)) * head;
    q.y += amp * fin * sin(phase * 1.7 + p.z * 6.0);
    q.z -= retract * head * 0.42;
    q.xy *= 1.0 - retract * head * 0.65;
  }
  q.x += bend * s * s * 0.35; // turning
  return q;
}
`;

// Patches every mesh material in a fish model; returns the shared uniforms to drive it.
export function applySwimToModel(object, bodyName) {
  const uniforms = {
    uSwimA: { value: new THREE.Vector4(BODY_TYPES[bodyName] ?? 0, 0, 0.07, 1) },
    uSwimB: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  object.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const patched = mats.map((m) => {
      const mat = m.clone();
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSwimA = uniforms.uSwimA;
        shader.uniforms.uSwimB = uniforms.uSwimB;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            uniform vec4 uSwimA;
            uniform vec4 uSwimB;
            ${GLSL_SWIM}`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            transformed = swimDisplace(transformed, uSwimA, uSwimB);`);
      };
      mat.customProgramCacheKey = () => 'fish-swim-v1';
      return mat;
    });
    o.material = Array.isArray(o.material) ? patched : patched[0];
    o.frustumCulled = false; // displaced vertices can leave the static bounds
  });
  return uniforms;
}

// Smoothly blended swim parameters for one fish.
export function createSwimState(behaviour) {
  const body = behaviour?.body || 'fusiform';
  const base = { ...BODY_DEFAULTS[body], ...(behaviour?.swim || {}) };
  const cur = { amp: base.amp, speed: base.speed };
  let target = SWIM_STATES.idle;
  let phase = Math.random() * 10;
  let bend = 0;
  return {
    body,
    bodyId: BODY_TYPES[body] ?? 0,
    base,
    phase: () => phase,
    get amp() { return cur.amp; },
    get bend() { return bend; },
    set(stateName) { target = SWIM_STATES[stateName] || SWIM_STATES.idle; },
    update(dt, moveSpeed = 0, turnRate = 0) {
      const k = 1 - Math.exp(-5 * dt);
      cur.amp += (base.amp * target.amp - cur.amp) * k;
      // Tail beat follows actual swimming speed a little, so drifting fish slow their beat.
      const speedTarget = base.speed * target.speed * (0.65 + Math.min(1.2, moveSpeed) * 0.35);
      cur.speed += (speedTarget - cur.speed) * k;
      phase += cur.speed * dt;
      bend += (THREE.MathUtils.clamp(turnRate * 0.35, -0.6, 0.6) - bend) * k;
    },
    get speed() { return cur.speed; },
  };
}
