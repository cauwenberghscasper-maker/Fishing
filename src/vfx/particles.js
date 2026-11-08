// Agent E: instanced billboard particles. One draw call per layer, any number of effects.
// Each particle: atlas frame, tint, size (w/h aspect), spin, gravity, drag, velocity stretch,
// additive or alpha (premultiplied blend: alpha 0 = pure add, alpha 1 = normal "over").
import * as THREE from 'three';

const vert = /* glsl */`
  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute vec4 iSize;   // w, h, stretch, rotation
  attribute vec4 iCol;    // rgb tint (can be > 1), alpha
  attribute vec2 iMisc;   // frame, additive
  uniform float uGrid;
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vAdd;
  void main() {
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    vec2 corner = position.xy;
    float c = cos(iSize.w), s = sin(iSize.w);
    vec2 off = vec2(corner.x * iSize.x, corner.y * iSize.y);
    if (iSize.z > 0.0) {
      vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
      float sp = length(vv.xy);
      vec2 d = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
      vec2 n = vec2(-d.y, d.x);
      off = n * corner.x * iSize.x + d * corner.y * (iSize.y + sp * iSize.z);
    } else {
      off = vec2(off.x * c - off.y * s, off.x * s + off.y * c);
    }
    mv.xy += off;
    gl_Position = projectionMatrix * mv;
    float f = iMisc.x;
    vec2 cellUv = position.xy + 0.5;
    vUv = (vec2(mod(f, uGrid), uGrid - 1.0 - floor(f / uGrid)) + cellUv) / uGrid;
    vCol = iCol;
    vAdd = iMisc.y;
    if (f > 15.5) vUv = vec2(-1.0) + cellUv; // procedural soft dot
  }`;

const frag = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vAdd;
  void main() {
    vec4 t;
    if (vUv.x < -0.001) {
      vec2 p = vUv + 1.0 - 0.5;
      float r = length(p) * 2.0;
      float d = smoothstep(1.0, 0.0, r);
      t = vec4(vec3(d * d), d);
    } else t = texture2D(uMap, vUv);
    vec3 rgb = t.rgb * vCol.rgb * vCol.a;
    float a = t.a * vCol.a * (1.0 - vAdd);
    if (rgb.r + rgb.g + rgb.b + a < 0.003) discard;
    gl_FragColor = vec4(rgb, a);
  }`;

export function createParticles({ texture, max = 900, grid = 4, renderOrder = 950, depthTest = true, name = 'vfx-particles' }) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const A = (n) => new Float32Array(max * n);
  const pos = A(3), vel = A(3), size = A(4), colA = A(4), misc = A(2);
  const mk = (arr, n) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', mk(pos, 3));
  geo.setAttribute('iVel', mk(vel, 3));
  geo.setAttribute('iSize', mk(size, 4));
  geo.setAttribute('iCol', mk(colA, 4));
  geo.setAttribute('iMisc', mk(misc, 2));
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    name,
    uniforms: { uMap: { value: texture }, uGrid: { value: grid } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.name = name;

  // CPU state (structure of arrays)
  const P = [];
  let budget = 1; // quality scale on emission counts

  function emit(o) {
    if (P.length >= max) P.shift();
    const p = {
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life || 1, age: 0,
      size: o.size || 0.3, aspect: o.aspect || 1, grow: o.grow ?? 0, stretch: o.stretch || 0,
      rot: o.rot ?? Math.random() * 6.283, spin: o.spin || 0,
      frame: o.frame ?? 16, add: o.add ?? 1,
      r: o.color?.r ?? 1, g: o.color?.g ?? 1, b: o.color?.b ?? 1, a: o.alpha ?? 1,
      gravity: o.gravity || 0, drag: o.drag || 0,
      fadeIn: o.fadeIn ?? 0.08, flicker: o.flicker || 0,
      follow: o.follow || null, ox: 0, oy: 0, oz: 0,
      orbit: o.orbit || null, open: o.open || 0,
    };
    if (p.follow) { p.ox = o.x; p.oy = o.y; p.oz = o.z; }
    P.push(p);
    return p;
  }

  const tmp = new THREE.Vector3();
  function update(dt) {
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); i--; continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k - p.gravity * dt; p.vz *= k;
      let x, y, z;
      if (p.follow) {
        p.ox += p.vx * dt; p.oy += p.vy * dt; p.oz += p.vz * dt;
        let ox = p.ox, oy = p.oy, oz = p.oz;
        if (p.orbit) { // orbit around the anchor's up axis
          const a = p.orbit.a + p.age * p.orbit.speed;
          ox += Math.cos(a) * p.orbit.r; oz += Math.sin(a) * p.orbit.r; oy += Math.sin(a * 2 + p.orbit.a) * (p.orbit.bob || 0);
        }
        p.follow.getWorldPosition(tmp);
        x = tmp.x + ox; y = tmp.y + oy; z = tmp.z + oz;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        x = p.x; y = p.y; z = p.z;
      }
      const t = p.age / p.life;
      let alpha = p.a * Math.min(1, p.age / Math.max(0.001, p.fadeIn)) * (1 - t * t);
      if (p.flicker) alpha *= 1 - p.flicker + p.flicker * Math.random();
      const s = p.size * (1 + p.grow * t);
      let h = s * p.aspect;
      if (p.open) h *= Math.min(1, Math.sin(Math.min(1, t * p.open) * Math.PI) * 1.4); // eyes open then close
      const j3 = n * 3, j4 = n * 4, j2 = n * 2;
      pos[j3] = x; pos[j3 + 1] = y; pos[j3 + 2] = z;
      vel[j3] = p.vx; vel[j3 + 1] = p.vy; vel[j3 + 2] = p.vz;
      size[j4] = s; size[j4 + 1] = h; size[j4 + 2] = p.stretch; size[j4 + 3] = p.rot + p.spin * p.age;
      colA[j4] = p.r; colA[j4 + 1] = p.g; colA[j4 + 2] = p.b; colA[j4 + 3] = alpha;
      misc[j2] = p.frame; misc[j2 + 1] = p.add;
      n++;
    }
    geo.instanceCount = n;
    for (const k of ['iPos', 'iVel', 'iSize', 'iCol', 'iMisc']) {
      const at = geo.attributes[k];
      at.clearUpdateRanges?.();
      at.addUpdateRange?.(0, n * at.itemSize);
      at.needsUpdate = true;
    }
  }

  return {
    mesh,
    emit,
    update,
    get count() { return P.length; },
    get budget() { return budget; },
    setBudget(b) { budget = b; },
    // n scaled by quality, at least 1
    n(count) { return Math.max(1, Math.round(count * budget)); },
    clearFollow(obj) { for (let i = P.length - 1; i >= 0; i--) if (P[i].follow === obj) { P[i] = P[P.length - 1]; P.pop(); } },
  };
}
