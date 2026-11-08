// Agent E: building blocks shared by looks, powers and the catch moment.
// - decal(): flat painted quads on the water / pier (rings with a fill sweep, glyph circles, ice sheet, underglow)
// - ribbon(): camera-facing textured strips along a polyline (lightning, vines, chain, the glowing line, beams)
// - screen(): one full-screen quad for darkness, tint, flash, frost edges and the abyss spotlight
// - lightPool(): a fixed number of point lights handed to whatever needs them most this frame
import * as THREE from 'three';
import { vfxTexture } from './assets.js';

const PREMULT = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

// ---------------------------------------------------------------- decals
const decalVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const decalFrag = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uAlpha, uTime, uSpin, uFill, uPolar, uRepeat, uFlicker, uCover, uSoft, uAdd, uPulse;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float ang = atan(p.y, p.x);
    vec2 uv;
    if (uPolar > 0.5) uv = vec2(ang / 6.2831853 * uRepeat + uTime * uSpin, r * 0.8 - uTime * 0.05);
    else { float c = cos(uTime * uSpin), s = sin(uTime * uSpin); uv = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * uRepeat + 0.5; }
    vec4 t = texture2D(uMap, uv);
    float mask = 1.0;
    if (uSoft > 0.0) mask = smoothstep(1.0, 1.0 - uSoft, r);            // round soft edge
    if (uCover < 1.0) mask *= smoothstep(uCover + 0.06, uCover - 0.02, r); // spreading sheet
    float sweep = fract((ang / 6.2831853) + 0.25);                      // fill sweep from 12 o'clock
    float fill = uFill >= 1.0 ? 1.0 : (0.35 + 0.65 * step(sweep, uFill));
    float pulse = 1.0 + uPulse * sin(uTime * 9.0);
    float fl = 1.0 - uFlicker + uFlicker * fract(sin(floor(uTime * 14.0) * 43.1) * 4375.5);
    vec3 rgb = t.rgb * uColor * mask * fill * pulse * fl * uAlpha;
    float a = t.a * max(max(t.r, t.g), t.b) * mask * uAlpha * (1.0 - uAdd);
    gl_FragColor = vec4(rgb, a);
  }`;

export function decal(key, { size = 2, color = '#ffffff', alpha = 1, polar = false, repeat = 1, spin = 0, soft = 0.25, add = 1, flicker = 0, fill = 1, cover = 1, order = 8, pulse = 0, tex = null } = {}) {
  const map = tex || vfxTexture(key, { repeat: polar || repeat !== 1 });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uTime: { value: 0 },
      uSpin: { value: spin }, uFill: { value: fill }, uPolar: { value: polar ? 1 : 0 }, uRepeat: { value: repeat },
      uFlicker: { value: flicker }, uCover: { value: cover }, uSoft: { value: soft }, uAdd: { value: add }, uPulse: { value: pulse },
    },
    vertexShader: decalVert, fragmentShader: decalFrag, transparent: true, depthWrite: false, ...PREMULT,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(size);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  mesh.userData.u = mat.uniforms;
  return mesh;
}

// ---------------------------------------------------------------- ribbons
const ribVert = /* glsl */`
  attribute float aT;
  varying vec2 vUv;
  varying float vT;
  void main() { vUv = uv; vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ribFrag = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uAlpha, uAdd, uHead, uScroll, uTime, uEdge;
  varying vec2 vUv;
  varying float vT;
  void main() {
    if (vT > uHead) discard;                       // grows from the start (vines, chain)
    vec4 t = texture2D(uMap, vec2(vUv.x, vUv.y + uTime * uScroll));
    float edge = uEdge > 0.0 ? smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x) : 1.0;
    float tip = smoothstep(uHead, uHead - 0.04, vT);
    vec3 rgb = t.rgb * uColor * uAlpha * edge * tip;
    float a = t.a * max(max(t.r, t.g), t.b) * 1.6 * uAlpha * edge * tip * (1.0 - uAdd);
    gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0));
  }`;

export function ribbon(key, { width = 0.5, color = '#ffffff', alpha = 1, add = 1, segments = 24, repeat = 1, order = 912, depthTest = true, edge = 0, scroll = 0 } = {}) {
  const n = segments + 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const at = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i < n; i++) {
    const t = i / segments;
    uv.set([0, t * repeat, 1, t * repeat], i * 4);
    at[i * 2] = at[i * 2 + 1] = t;
    if (i < segments) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aT', new THREE.BufferAttribute(at, 1));
  geo.setIndex(idx);
  const map = vfxTexture(key, { repeat: true });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uAdd: { value: add }, uHead: { value: 1.01 }, uScroll: { value: scroll }, uTime: { value: 0 }, uEdge: { value: edge } },
    vertexShader: ribVert, fragmentShader: ribFrag, transparent: true, depthWrite: false, depthTest, side: THREE.DoubleSide, ...PREMULT,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  const u = mat.uniforms;
  const a = new THREE.Vector3(), d = new THREE.Vector3(), side = new THREE.Vector3(), view = new THREE.Vector3();
  // points: array of Vector3 (resampled to the segment count); widths: number or fn(t)
  mesh.userData = {
    u,
    set(points, camera, w = width) {
      const m = points.length - 1;
      for (let i = 0; i < n; i++) {
        const f = (i / segments) * m;
        const k = Math.min(m - 1, Math.floor(f));
        a.copy(points[k]).lerp(points[k + 1], f - k);
        d.subVectors(points[k + 1], points[k]).normalize();
        view.subVectors(camera.position, a).normalize();
        side.crossVectors(d, view).normalize();
        const ww = (typeof w === 'function' ? w(i / segments) : w) * 0.5;
        pos[i * 6] = a.x - side.x * ww; pos[i * 6 + 1] = a.y - side.y * ww; pos[i * 6 + 2] = a.z - side.z * ww;
        pos[i * 6 + 3] = a.x + side.x * ww; pos[i * 6 + 4] = a.y + side.y * ww; pos[i * 6 + 5] = a.z + side.z * ww;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
  return mesh;
}

// Jagged lightning path from a to b (fresh every call so bolts flicker between shapes).
export function boltPath(a, b, jag = 0.6, steps = 12, out = []) {
  out.length = 0;
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const perp1 = new THREE.Vector3(d.z, 0, -d.x).normalize();
  if (perp1.lengthSq() < 0.01) perp1.set(1, 0, 0);
  const perp2 = new THREE.Vector3().crossVectors(d, perp1).normalize();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = a.clone().addScaledVector(d, t);
    if (i > 0 && i < steps) {
      const amp = jag * len * 0.06 * Math.sin(t * Math.PI);
      p.addScaledVector(perp1, (Math.random() - 0.5) * 2 * amp).addScaledVector(perp2, (Math.random() - 0.5) * amp);
    }
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- screen overlay
export function screen() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uDark: { value: 0 }, uDarkColor: { value: new THREE.Color(0, 0, 0) },
      uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uHole: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uHole2: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
      uEdge: { value: 0 }, uEdgeColor: { value: new THREE.Color(1, 1, 1) }, uEdgeMap: { value: null },
      uAspect: { value: 0.46 }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uDark, uFlash, uEdge, uAspect, uTime;
      uniform vec3 uDarkColor, uFlashColor, uEdgeColor;
      uniform vec4 uHole, uHole2;
      uniform sampler2D uEdgeMap;
      varying vec2 vUv;
      float hole(vec4 h) {
        if (h.z <= 0.0) return 0.0;
        vec2 d = (vUv - h.xy) * vec2(uAspect, 1.0);
        return smoothstep(h.z, h.z * h.w, length(d));
      }
      void main() {
        float keep = max(hole(uHole), hole(uHole2));
        vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
        float vig = smoothstep(0.15, 0.75, length(c));
        float dark = uDark * (0.75 + 0.25 * vig) * (1.0 - keep);
        vec3 rgb = uDarkColor * dark;
        float a = dark;
        if (uEdge > 0.0) {
          float e = smoothstep(0.55 - uEdge * 0.35, 0.95, max(abs(vUv.x - 0.5) * 2.0, abs(vUv.y - 0.5) * 2.0) + 0.15 * vig);
          vec3 fr = texture2D(uEdgeMap, vUv * vec2(uAspect, 1.0) * 1.6).rgb;
          float m = e * clamp(dot(fr, vec3(0.5)) * 1.6, 0.0, 1.0) * uEdge;
          rgb = rgb * (1.0 - m) + uEdgeColor * fr * m * 1.4;
          a = a + m * (1.0 - a) * 0.7;
        }
        rgb += uFlashColor * uFlash;
        gl_FragColor = vec4(rgb, a);
      }`,
    transparent: true, depthTest: false, depthWrite: false, ...PREMULT,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 900;
  mesh.name = 'vfx-screen';
  mesh.visible = false;
  return mesh;
}

// ---------------------------------------------------------------- light pool
// A fixed light count: changing the number of lights recompiles every lit material, so the
// pool is created once and unused lights sit at intensity 0.
export function lightPool(scene, count = 2) {
  const lights = [];
  for (let i = 0; i < count; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 4, 1.6);
    l.name = `vfx-light-${i}`;
    scene.add(l);
    lights.push(l);
  }
  let requests = [];
  return {
    lights,
    // called every frame by whoever wants light; highest priority wins
    want(priority, x, y, z, color, intensity, distance) { requests.push({ priority, x, y, z, color, intensity, distance }); },
    update() {
      requests.sort((a, b) => b.priority - a.priority);
      lights.forEach((l, i) => {
        const r = requests[i];
        if (!r) { l.intensity = 0; return; }
        l.position.set(r.x, r.y, r.z);
        l.color.set(r.color);
        l.intensity = r.intensity;
        l.distance = r.distance;
      });
      requests = [];
    },
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
