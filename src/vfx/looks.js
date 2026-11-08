// Agent E: variant looks on a fish anchor (master prompt 4.4b).
// - body shader: recolour, a scrolling painted overlay (albedo and/or glow), fresnel rim, iridescence,
//   pulsing signature glow (the fish's emissive map is the signature mask), a sweeping shine band.
//   Injected with onBeforeCompile on top of Agent A's swim patch (chained, cache key extended).
// - aura: particles that follow the fish (sparks, snow swirl, embers, petals, glyph orbit, eyes, foam helix, grinding sparks)
// - underglow: a painted glow decal on the water surface above the fish so it reads from the camera even as a shadow
// - light: a request to the shared light pool
import * as THREE from 'three';
import { vfxTexture, frameIndex } from './assets.js';
import { decal, ribbon, boltPath, rnd } from './fx.js';

const GLSL_PARS = /* glsl */`
  uniform float uVfxTime, uVfxOn, uBodyAmt, uBodyGain, uBodyBias, uOvScale, uOvAlbedo, uOvEmissive, uOvTop, uOvEdge, uOvCrackle, uOvPulse;
  uniform float uRimAmt, uRimPow, uIrid, uSigBoost, uSigTintAmt, uMatAmt, uMetal, uRough, uShine, uFlick, uBoost;
  uniform vec2 uOvScroll;
  uniform vec3 uBodyTint, uOvAlbedoTint, uOvEmTint, uRimColor, uSigTint, uShineColor, uVfxCenter;
  uniform float uVfxInvLen;
  uniform sampler2D uOvTex;
  varying vec3 vVfxObj;
  varying vec3 vVfxObjN;
  vec4 vfxOverlay() {
    vec3 p = (vVfxObj - uVfxCenter) * uVfxInvLen;
    vec3 n = normalize(vVfxObjN);
    vec2 sc = uOvScroll * uVfxTime;
    vec4 side = texture2D(uOvTex, vec2(p.z, p.y) * uOvScale + sc);
    vec4 top = texture2D(uOvTex, vec2(p.z, p.x) * uOvScale + sc + 0.37);
    vec4 t = mix(side, top, smoothstep(0.3, 0.8, abs(n.y)));
    float cover = clamp(max(max(t.r, t.g), t.b) * 1.5, 0.0, 1.0);
    if (uOvTop > 0.0) cover *= mix(1.0, smoothstep(-0.2, 0.6, n.y), uOvTop);
    return vec4(t.rgb, cover);
  }
`;

function inject(shader, u) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vVfxObj;\nvarying vec3 vVfxObjN;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvVfxObj = position; vVfxObjN = normal;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + GLSL_PARS)
    .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      vec4 vfxOv = vfxOverlay();
      float vfxL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(diffuseColor.rgb, uBodyTint * (vfxL * uBodyGain + uBodyBias), uBodyAmt * uVfxOn);
      diffuseColor.rgb = mix(diffuseColor.rgb, vfxOv.rgb * uOvAlbedoTint * 1.4, vfxOv.a * uOvAlbedo * uVfxOn);`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, uMetal, uMatAmt * uVfxOn);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, uRough, uMatAmt * uVfxOn);`)
    .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
      {
        float sig = 0.0;
        #ifdef USE_EMISSIVEMAP
          sig = clamp(max(max(emissiveColor.r, emissiveColor.g), emissiveColor.b) * 1.5, 0.0, 1.0);
        #endif
        float pulse = 0.75 + 0.25 * sin(uVfxTime * 3.0) + uOvPulse * 0.35 * sin(uVfxTime * 1.7 + vVfxObj.z * 6.0);
        vec3 viewDir = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), uRimPow);
        float sigL = dot(totalEmissiveRadiance, vec3(0.333));
        vec3 sigCol = mix(totalEmissiveRadiance, uSigTint * sigL * 1.5, uSigTintAmt);
        vec3 add = sigCol * (uSigBoost - 1.0) * pulse;
        float crack = 1.0 - uOvCrackle + uOvCrackle * uFlick;
        float edgeM = uOvEdge > 0.0 ? smoothstep(0.25, 0.8, fr) : 1.0;
        add += vfxOv.rgb * uOvEmTint * uOvEmissive * vfxOv.a * crack * pulse * edgeM;
        add += uRimColor * fr * uRimAmt * pulse;
        if (uIrid > 0.0) add += (0.5 + 0.5 * cos(6.2831 * (fr * 1.3 + uVfxTime * 0.05 + vec3(0.0, 0.33, 0.67)))) * fr * uIrid;
        vec3 p = (vVfxObj - uVfxCenter) * uVfxInvLen;
        float band = exp(-pow((p.z + p.y * 0.4 - uShine) * 9.0, 2.0));
        add += uShineColor * band * step(-0.9, uShine) * 2.5;
        totalEmissiveRadiance += add * uVfxOn * uBoost;
      }`);
}

const C = (h, d = '#000000') => new THREE.Color(h || d);

function makeUniforms(look) {
  const b = look.body || {}, o = look.overlay || {}, r = look.rim || {}, s = look.signature || {}, m = look.material || {};
  return {
    uVfxTime: { value: 0 }, uVfxOn: { value: 1 }, uBoost: { value: 1 }, uFlick: { value: 1 },
    uBodyTint: { value: C(b.tint) }, uBodyAmt: { value: b.amount ?? 0 }, uBodyGain: { value: b.gain ?? 1 }, uBodyBias: { value: b.bias ?? 0 },
    uOvTex: { value: vfxTexture(o.texture || 'ov_tide', { repeat: true }) }, uOvScale: { value: o.scale ?? 2 }, uOvScroll: { value: new THREE.Vector2(...(o.scroll || [0, 0])) },
    uOvAlbedo: { value: o.albedo ?? 0 }, uOvAlbedoTint: { value: C(o.albedoTint, '#ffffff') }, uOvEmissive: { value: o.emissive ?? 0 }, uOvEmTint: { value: C(o.emissiveTint, '#ffffff') },
    uOvTop: { value: o.top ?? 0 }, uOvEdge: { value: o.edge ?? 0 }, uOvCrackle: { value: o.crackle ?? 0 }, uOvPulse: { value: o.pulse ?? 0 },
    uRimColor: { value: C(r.color) }, uRimAmt: { value: r.amount ?? 0 }, uRimPow: { value: r.power ?? 3 }, uIrid: { value: look.iridescence ?? 0 },
    uSigBoost: { value: s.boost ?? 1 }, uSigTint: { value: C(s.tint, '#ffffff') }, uSigTintAmt: { value: s.tintAmount ?? 0 },
    uMatAmt: { value: m.amount ?? 0 }, uMetal: { value: m.metal ?? 0 }, uRough: { value: m.rough ?? 0.5 },
    uShine: { value: -2 }, uShineColor: { value: C(look.shine?.color, '#ffffff') },
    uVfxCenter: { value: new THREE.Vector3() }, uVfxInvLen: { value: 1 },
  };
}

// Patch every mesh under `root` once (A's swim patch stays: we chain onBeforeCompile).
function patchModel(root, uniforms) {
  let patched = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.vfxPatched) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.every((m) => m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial))) return;
    o.geometry.computeBoundingBox?.();
    const bb = o.geometry.boundingBox;
    const u = { ...uniforms, uVfxCenter: { value: bb ? bb.getCenter(new THREE.Vector3()) : new THREE.Vector3() }, uVfxInvLen: { value: bb ? 1 / Math.max(0.001, bb.max.z - bb.min.z) : 1 } };
    for (const m of mats) {
      const prev = m.onBeforeCompile;
      const prevKey = m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile = (shader, renderer) => { prev?.call(m, shader, renderer); inject(shader, u); };
      m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|vfx1`;
      m.needsUpdate = true;
    }
    o.userData.vfxPatched = true;
    patched++;
  });
  return patched;
}

// One look per fish anchor.
export function createLook({ object, variant, look, ctx }) {
  const { surfaceFx, underFx, surface, camera, lights } = ctx;
  const kind = look.kind;
  const uniforms = makeUniforms(look);
  const elemental = kind === 'element';
  const len = object.userData?.length || 0.8;
  let glow = null;
  let arcs = [];
  let t = 0;
  let emitAcc = 0;
  let boost = 1;           // reveal / power push
  let shineT = -1;
  const orbiters = [];
  const tmp = new THREE.Vector3();

  if (elemental && look.underglow) {
    const g = look.underglow;
    glow = decal(g.texture, { size: (g.size || 3) * Math.max(0.7, len), color: g.color, alpha: g.strength ?? 1, polar: g.polar !== false, repeat: 3, spin: g.spin || 0, flicker: g.flicker || 0, soft: 0.9, order: 6 });
    surface.add(glow);
  }
  if (elemental && look.aura?.arcs) {
    for (let i = 0; i < look.aura.arcs; i++) {
      const r = ribbon('rb_lightning', { width: 0.12, color: look.color, add: 1, segments: 8, order: 14 });
      r.userData.path = [];
      ctx.under.add(r);
      arcs.push(r);
    }
  }
  const frames = (look.aura?.frames || []).map((f) => frameIndex(f));
  const col = new THREE.Color(look.color || '#ffffff');
  const acc = new THREE.Color(look.accent || look.color || '#ffffff');

  function bodyPoint(out) { // random point on the fish body in world space
    object.getWorldPosition(out);
    const h = object.rotation.y;
    const s = rnd(-0.5, 0.5) * len;
    out.x += Math.sin(h) * s + rnd(-0.08, 0.08) * len;
    out.z += Math.cos(h) * s + rnd(-0.08, 0.08) * len;
    out.y += rnd(-0.05, 0.12) * len;
    return out;
  }

  function spawnOrbiters() {
    const a = look.aura;
    if (!a || !(a.kind === 'orbit' || a.kind === 'eyes')) return;
    const n = underFx.n(a.count || 8);
    for (let i = 0; i < n; i++) {
      const eyes = a.kind === 'eyes';
      orbiters.push(underFx.emit({
        x: eyes ? rnd(-0.5, 0.5) * len : 0, y: eyes ? rnd(0.05, 0.3) * len : 0.12 * len, z: eyes ? rnd(-0.6, 0.6) * len : 0,
        follow: object, life: eyes ? rnd(2.5, 5) : 1e9, frame: frames[i % frames.length], size: rnd(a.size[0], a.size[1]) * Math.max(0.8, len),
        aspect: eyes ? 0.55 : 1, add: 1, color: eyes ? acc : col, alpha: 1.4, fadeIn: 0.3,
        orbit: eyes ? null : { r: 0.55 * len + (i % 2) * 0.18 * len, a: (i / n) * Math.PI * 2, speed: (i % 2 ? -1 : 1) * 0.9, bob: 0.06 },
        open: eyes ? 1 : 0, spin: eyes ? 0 : 0.8, rot: 0,
      }));
    }
  }
  spawnOrbiters();

  function update(dt, time) {
    t += dt;
    uniforms.uVfxTime.value = time;
    uniforms.uBoost.value = boost;
    if (Math.random() < dt * 15) uniforms.uFlick.value = Math.random() < 0.35 ? 0.15 : rnd(0.6, 1.3);
    if (shineT >= 0) { shineT += dt; uniforms.uShine.value = -0.9 + shineT * 2.2; if (shineT > 1) { shineT = -1; uniforms.uShine.value = -2; } }
    else if (kind === 'morph' && Math.random() < dt * 0.15) shineT = 0; // idle glint every few seconds

    if (!object.userData.vfxModelDone) {
      if (patchModel(object, uniforms) > 0) object.userData.vfxModelDone = true;
    }
    object.getWorldPosition(tmp);
    const fade = object.userData.fade ?? 1;
    if (glow) {
      glow.position.set(tmp.x, 0.03, tmp.z);
      const depth = Math.max(0, -tmp.y);
      glow.userData.u.uTime.value = time;
      glow.userData.u.uAlpha.value = (look.underglow.strength ?? 1) * fade * Math.max(0.35, 1 - depth * 0.25) * Math.min(2, boost) * (0.85 + 0.15 * Math.sin(time * 2.4));
      glow.visible = fade > 0.02;
    }
    if (elemental && look.light) {
      const L = look.light;
      const fl = 1 - (L.flicker || 0) * Math.random();
      lights.want(ctx.priorityOf(object), tmp.x, Math.max(0.4, tmp.y + 0.6), tmp.z, L.color, L.intensity * fl * boost * fade, (L.distance || 4) * Math.min(1.6, boost));
    }
    if (!elemental || fade < 0.05) return;
    // aura emission
    const a = look.aura;
    if (!a) return;
    emitAcc += dt * underFx.n(a.rate || 0) * Math.min(3, boost);
    while (emitAcc >= 1) {
      emitAcc -= 1;
      const p = bodyPoint(new THREE.Vector3());
      const f = frames[Math.floor(Math.random() * frames.length)] ?? 16;
      const size = rnd(a.size[0], a.size[1]) * Math.max(0.8, len);
      const life = rnd(a.life?.[0] ?? 0.5, a.life?.[1] ?? 1);
      if (a.kind === 'crackle') underFx.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-0.4, 0.4), vy: rnd(0, 0.6), vz: rnd(-0.4, 0.4), life, frame: f, size, add: 1, color: col, alpha: 1.6, flicker: 0.6, fadeIn: 0.01 });
      else if (a.kind === 'swirl') underFx.emit({ x: 0, y: rnd(0, 0.3) * len, z: rnd(-0.4, 0.4) * len, follow: object, orbit: { r: rnd(0.35, 0.6) * len, a: rnd(0, 6.28), speed: 1.6, bob: 0.08 }, vy: -0.05, life, frame: f, size, add: 1, color: col, alpha: 1.2, spin: 1.5 });
      else if (a.kind === 'rise') underFx.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-0.15, 0.15), vy: rnd(0.5, 1.1), vz: rnd(-0.15, 0.15), drag: 0.6, life, frame: f, size, add: 1, color: col, alpha: 1.5, flicker: 0.25, grow: -0.5 });
      else if (a.kind === 'drift') underFx.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: rnd(-0.2, 0.2), vy: rnd(0.1, 0.35), vz: rnd(-0.2, 0.2), drag: 0.8, life, frame: f, size, add: 0, color: new THREE.Color(1, 1, 1), alpha: 1, spin: rnd(-2, 2) });
      else if (a.kind === 'helix') underFx.emit({ x: 0, y: 0.05 * len, z: rnd(-0.5, 0.5) * len, follow: object, orbit: { r: 0.45 * len, a: t * 5 + rnd(0, 0.4), speed: 4, bob: 0.12 }, life, frame: f, size, add: 0.4, color: new THREE.Color(1, 1, 1), alpha: 1, spin: 2 });
      else if (a.kind === 'sparks') {
        const n = Math.random() < (a.burst || 0) ? 5 : 1;
        for (let k = 0; k < n; k++) underFx.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-1.6, 1.6), vy: rnd(0.5, 2.2), vz: rnd(-1.6, 1.6), gravity: 6, life, frame: f, size, aspect: 1, stretch: 0.08, add: 1, color: col, alpha: 1.8 });
      }
    }
    // extras: frost breath, ember smoke, pollen dots, tide crown spray, abyss eyes respawn
    if (a.breath && Math.random() < dt * 0.9) { const h = object.rotation.y; underFx.emit({ x: tmp.x + Math.sin(h) * 0.55 * len, y: tmp.y + 0.05, z: tmp.z + Math.cos(h) * 0.55 * len, vx: Math.sin(h) * 0.5, vy: 0.25, vz: Math.cos(h) * 0.5, drag: 1.2, life: 1.4, frame: frameIndex(a.breath), size: 0.25 * len, grow: 1.6, add: 0.3, color: new THREE.Color('#d8f6ff'), alpha: 0.55 }); }
    if (a.smoke && Math.random() < dt * 2) { const p = bodyPoint(new THREE.Vector3()); underFx.emit({ x: p.x, y: p.y + 0.1, z: p.z, vy: 0.5, drag: 0.5, life: 1.3, frame: frameIndex('smoke'), size: 0.18 * len, grow: 1.5, add: 0, color: new THREE.Color('#5a4a44'), alpha: 0.35 }); }
    if (a.pollen && Math.random() < dt * 8) { const p = bodyPoint(new THREE.Vector3()); underFx.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-0.2, 0.2), vy: rnd(0.1, 0.4), vz: rnd(-0.2, 0.2), drag: 0.5, life: 1.6, frame: 16, size: 0.05, add: 1, color: new THREE.Color('#ffe27a'), alpha: 1.5, flicker: 0.3 }); }
    if (a.crown && Math.random() < dt * 1.5) { const h = object.rotation.y; underFx.emit({ x: tmp.x + Math.sin(h) * 0.4 * len, y: tmp.y + 0.15, z: tmp.z + Math.cos(h) * 0.4 * len, vy: 1.2, gravity: 3, life: 0.6, frame: frameIndex('foam'), size: 0.25 * len, grow: 0.8, add: 0.2, color: new THREE.Color(1, 1, 1), alpha: 0.9 }); }
    if (a.kind === 'eyes') { for (let i = orbiters.length - 1; i >= 0; i--) if (orbiters[i].age >= orbiters[i].life - dt) orbiters.splice(i, 1); if (orbiters.length < underFx.n(a.count || 8) && Math.random() < dt * 2) spawnOrbitersOne(); }
    // storm: arcs jumping between fins
    for (const r of arcs) {
      if (Math.random() < dt * 12) {
        const p1 = bodyPoint(new THREE.Vector3()), p2 = bodyPoint(new THREE.Vector3());
        p2.y += 0.15 * len;
        boltPath(p1, p2, 2.5, 8, r.userData.path);
        r.userData.set(r.userData.path, camera, 0.09 * Math.max(0.8, len));
        r.visible = Math.random() < 0.75;
      }
      r.userData.u.uAlpha.value = fade * boost;
    }
  }
  function spawnOrbitersOne() {
    const a = look.aura;
    orbiters.push(underFx.emit({ x: rnd(-0.5, 0.5) * len, y: rnd(0.05, 0.3) * len, z: rnd(-0.6, 0.6) * len, follow: object, life: rnd(2.5, 5), frame: frames[0], size: rnd(a.size[0], a.size[1]) * Math.max(0.8, len), aspect: 0.55, add: 1, color: acc, alpha: 1.4, open: 1, rot: 0, fadeIn: 0.3 }));
  }

  return {
    variant,
    look,
    object,
    uniforms,
    update,
    shine() { shineT = 0; },
    setBoost(b) { boost = b; },
    dispose() {
      glow?.removeFromParent();
      for (const r of arcs) r.removeFromParent();
      underFx.clearFollow(object);
      uniforms.uVfxOn.value = 0;
    },
  };
}
