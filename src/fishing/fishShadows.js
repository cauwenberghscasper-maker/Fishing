// Soft dark fish silhouettes under the water surface: one instanced draw call for every fish
// (and kelp, when its model is missing). Drawn after the water so they read even in deep water;
// deeper fish are blurrier and fainter. They swim with the same vertex function as real models.
import * as THREE from 'three';
import { GLSL_SWIM } from './swim.js';
import { getSilhouetteAtlas, ATLAS_GRID } from './silhouettes.js';

const MAX_INSTANCES = 160;   // one instanced draw call; the open sea holds a lot of fish
const FILL = 232 / 256; // drawn fish length / cell size in the atlas

const vertexShader = /* glsl */`
  attribute vec4 aSwimA;   // body, phase, amp, freq
  attribute vec4 aSwimB;   // bend, retract, inflate, atlas cell
  attribute vec4 aLook;    // opacity, highlight, blur bias, glow strength
  attribute vec3 aGlowCol;
  attribute vec3 aTint;
  varying vec2 vUv;
  varying vec4 vLook;
  varying vec3 vGlowCol;
  varying vec3 vTint;
  #include <fog_pars_vertex>
  ${GLSL_SWIM}
  void main() {
    vec3 p = position;
    vec3 q = swimDisplace(p, aSwimA, aSwimB);
    vec4 wp = modelMatrix * instanceMatrix * vec4(q.x, 0.0, q.z, 1.0);
    float cell = aSwimB.w;
    float cx = mod(cell, ${ATLAS_GRID}.0);
    float cy = floor(cell / ${ATLAS_GRID}.0);
    vUv = (vec2(cx, ${ATLAS_GRID - 1}.0 - cy) + vec2(0.5 + p.z, 0.5 + p.x)) / ${ATLAS_GRID}.0;
    vLook = aLook;
    vGlowCol = aGlowCol;
    vTint = aTint;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */`
  uniform sampler2D uAtlas;
  uniform vec3 uHighlight;
  uniform float uTime;
  varying vec2 vUv;
  varying vec4 vLook;
  varying vec3 vGlowCol;
  varying vec3 vTint;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture(uAtlas, vUv, vLook.z);
    float a = t.r * vLook.x;
    float rim = smoothstep(0.04, 0.3, t.r) * (1.0 - smoothstep(0.35, 0.8, t.r)) * vLook.y;
    float pulse = 0.75 + 0.25 * sin(uTime * 5.0);
    vec3 col = vTint * a + vGlowCol * t.g * vLook.w + uHighlight * rim * pulse;
    float alpha = clamp(a + rim * 0.25, 0.0, 1.0);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      col = mix(col, fogColor * alpha * 0.4, fogFactor);
      alpha *= 1.0 - fogFactor * 0.6;
    #endif
    gl_FragColor = vec4(col, alpha);
  }`;

export function createFishShadows() {
  const geo = new THREE.PlaneGeometry(1, 1, 2, 16);
  geo.rotateX(-Math.PI / 2); // x across, z along the body (head at +z)
  const swimA = new Float32Array(MAX_INSTANCES * 4);
  const swimB = new Float32Array(MAX_INSTANCES * 4);
  const look = new Float32Array(MAX_INSTANCES * 4);
  const glowCol = new Float32Array(MAX_INSTANCES * 3);
  const tint = new Float32Array(MAX_INSTANCES * 3);
  const attrs = {
    aSwimA: new THREE.InstancedBufferAttribute(swimA, 4).setUsage(THREE.DynamicDrawUsage),
    aSwimB: new THREE.InstancedBufferAttribute(swimB, 4).setUsage(THREE.DynamicDrawUsage),
    aLook: new THREE.InstancedBufferAttribute(look, 4).setUsage(THREE.DynamicDrawUsage),
    aGlowCol: new THREE.InstancedBufferAttribute(glowCol, 3),
    aTint: new THREE.InstancedBufferAttribute(tint, 3),
  };
  for (const [k, v] of Object.entries(attrs)) geo.setAttribute(k, v);

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uAtlas: { value: null },
    uHighlight: { value: new THREE.Color('#ffe7a8').multiplyScalar(1.6) },
    uTime: { value: 0 },
  }]);
  uniforms.uAtlas.value = getSilhouetteAtlas();

  const material = new THREE.ShaderMaterial({
    name: 'FishSilhouettes',
    uniforms,
    vertexShader,
    fragmentShader,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  const mesh = new THREE.InstancedMesh(geo, material, MAX_INSTANCES);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.name = 'fish-silhouettes';

  const free = [];
  for (let i = MAX_INSTANCES - 1; i >= 0; i--) free.push(i);
  const used = new Set();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  function refreshCount() {
    let max = -1;
    for (const i of used) max = Math.max(max, i);
    mesh.count = max + 1;
  }

  return {
    mesh,
    uniforms,
    // Returns a handle; tint is the silhouette colour (linear), glow the signature glow colour.
    acquire({ cell, body, tint: tintColor, glow }) {
      const i = free.pop();
      if (i === undefined) return null;
      used.add(i);
      swimA[i * 4] = body;
      swimB[i * 4 + 3] = cell;
      const t = tintColor || new THREE.Color(0.004, 0.022, 0.024);
      tint[i * 3] = t.r; tint[i * 3 + 1] = t.g; tint[i * 3 + 2] = t.b;
      const g = glow || new THREE.Color(0, 0, 0);
      glowCol[i * 3] = g.r; glowCol[i * 3 + 1] = g.g; glowCol[i * 3 + 2] = g.b;
      attrs.aGlowCol.needsUpdate = true;
      attrs.aTint.needsUpdate = true;
      mesh.setMatrixAt(i, hidden);
      refreshCount();
      return i;
    },
    release(i) {
      if (i === null || i === undefined || !used.has(i)) return;
      used.delete(i);
      free.push(i);
      look[i * 4] = 0;
      mesh.setMatrixAt(i, hidden);
      mesh.instanceMatrix.needsUpdate = true;
      refreshCount();
    },
    // pose: x, y, z, heading (0 = +z), length (m), width scale; swim: phase, amp, freq, bend, retract, inflate
    set(i, pose, swim, lookv) {
      if (i === null || i === undefined) return;
      const len = pose.length / FILL;
      q.setFromAxisAngle(up, pose.heading);
      s.set(len * (pose.width || 1), 1, len);
      m4.compose(new THREE.Vector3(pose.x, pose.y, pose.z), q, s);
      mesh.setMatrixAt(i, m4);
      swimA[i * 4 + 1] = swim.phase;
      swimA[i * 4 + 2] = swim.amp;
      swimA[i * 4 + 3] = swim.freq;
      swimB[i * 4] = swim.bend || 0;
      swimB[i * 4 + 1] = swim.retract || 0;
      swimB[i * 4 + 2] = swim.inflate || 0;
      look[i * 4] = lookv.opacity;
      look[i * 4 + 1] = lookv.highlight || 0;
      look[i * 4 + 2] = lookv.blur || 0;
      look[i * 4 + 3] = lookv.glow || 0;
    },
    commit(time) {
      uniforms.uTime.value = time;
      mesh.instanceMatrix.needsUpdate = true;
      attrs.aSwimA.needsUpdate = true;
      attrs.aSwimB.needsUpdate = true;
      attrs.aLook.needsUpdate = true;
    },
  };
}
