// Fishing line: verlet rope from the rod tip to the lure, drawn as a thin camera-facing ribbon
// that catches the low sun. Sags when slack, snaps straight under tension.
import * as THREE from 'three';

const N = 30;
const WIDTH = 0.022;

export function createLine() {
  const pos = Array.from({ length: N }, () => new THREE.Vector3());
  const prev = Array.from({ length: N }, () => new THREE.Vector3());
  let restLength = 1;
  let active = false;
  let tension = 0;

  const vertCount = N * 2;
  const positions = new Float32Array(vertCount * 3);
  const along = new Float32Array(vertCount);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    along[a] = along[a + 1] = i / (N - 1);
  }
  along[(N - 1) * 2] = along[(N - 1) * 2 + 1] = 1;
  geo.setIndex(idx);

  const material = new THREE.ShaderMaterial({
    name: 'FishingLine',
    uniforms: {
      uColor: { value: new THREE.Color('#fff1cc') },
      uTension: { value: 0 },
      uLight: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aAlong;
      varying float vAlong;
      varying float vWorldY;
      void main() {
        vAlong = aAlong;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uTension;
      uniform float uLight;
      varying float vAlong;
      varying float vWorldY;
      void main() {
        float under = smoothstep(0.02, -0.35, vWorldY);
        vec3 c = uColor * uLight * (1.0 + uTension * 0.8);
        float a = mix(0.9, 0.25, under);
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 15;
  mesh.visible = false;
  mesh.name = 'fishing-line';

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const view = new THREE.Vector3();

  function reset(from, to) {
    for (let i = 0; i < N; i++) {
      pos[i].lerpVectors(from, to, i / (N - 1));
      prev[i].copy(pos[i]);
    }
  }

  return {
    mesh,
    get points() { return pos; },
    get active() { return active; },
    show(from, to, length) {
      active = true;
      mesh.visible = true;
      reset(from, to);
      restLength = length ?? from.distanceTo(to);
    },
    hide() { active = false; mesh.visible = false; },
    setLength(l) { restLength = Math.max(0.2, l); },
    setTension(t) { tension = t; material.uniforms.uTension.value = t; },
    setLight(l) { material.uniforms.uLight.value = l; },
    // tip and end are pinned; surfaceY(x, z) gives the water height for buoyancy.
    update(dt, tip, end, camera, surfaceY) {
      if (!active) return;
      const seg = restLength / (N - 1);
      const sub = Math.min(dt, 1 / 30);
      for (let i = 1; i < N - 1; i++) {
        const p = pos[i];
        const v = tmpA.subVectors(p, prev[i]);
        const sy = surfaceY(p.x, p.z);
        const inWater = p.y < sy;
        v.multiplyScalar(inWater ? 0.82 : 0.985);
        prev[i].copy(p);
        p.add(v);
        p.y += (inWater ? -0.6 : -9.8) * sub * sub;
        if (inWater && p.y < sy - 0.6) p.y = sy - 0.6;
      }
      pos[0].copy(tip);
      pos[N - 1].copy(end);
      for (let it = 0; it < 14; it++) {
        for (let i = 0; i < N - 1; i++) {
          const a = pos[i], b = pos[i + 1];
          const d = tmpB.subVectors(b, a);
          const len = d.length() || 1e-6;
          // Rope: only resists stretching, never pushes.
          if (len <= seg) continue;
          const diff = (len - seg) / len;
          const wa = i === 0 ? 0 : 0.5;
          const wb = i + 1 === N - 1 ? 0 : 0.5;
          const s = wa + wb || 1;
          a.addScaledVector(d, (diff * wa) / s);
          b.addScaledVector(d, (-diff * wb) / s);
        }
        pos[0].copy(tip);
        pos[N - 1].copy(end);
      }
      // Under tension the line straightens regardless of the solver.
      if (tension > 0.05) {
        const k = Math.min(1, tension * 1.4);
        for (let i = 1; i < N - 1; i++) {
          tmpA.lerpVectors(tip, end, i / (N - 1));
          pos[i].lerp(tmpA, k * 0.35);
        }
      }
      // Ribbon facing the camera.
      for (let i = 0; i < N; i++) {
        const p = pos[i];
        const q = pos[Math.min(N - 1, i + 1)];
        const o = pos[Math.max(0, i - 1)];
        tmpA.subVectors(q, o).normalize();
        view.subVectors(camera.position, p).normalize();
        tmpB.crossVectors(tmpA, view).normalize().multiplyScalar(WIDTH * (1 + p.distanceTo(camera.position) * 0.012));
        positions[i * 6] = p.x + tmpB.x; positions[i * 6 + 1] = p.y + tmpB.y; positions[i * 6 + 2] = p.z + tmpB.z;
        positions[i * 6 + 3] = p.x - tmpB.x; positions[i * 6 + 4] = p.y - tmpB.y; positions[i * 6 + 5] = p.z - tmpB.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
