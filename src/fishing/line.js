// Fishing line: a stiff monofilament from the rod tip to the lure, drawn as a thin camera-facing
// ribbon that catches the low sun. One clean sagging curve when slack, dead straight under tension.
import * as THREE from 'three';

const N = 30;
const WIDTH = 0.022;

export function createLine() {
  const pos = Array.from({ length: N }, () => new THREE.Vector3());
  const prev = Array.from({ length: N }, () => new THREE.Vector3());
  let restLength = 1;
  let active = false;
  let tension = 0;
  let sag = 0;
  let windT = 0;

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
        float a = mix(0.95, 0.55, under);   // still clearly there under the surface
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
      sag = 0;
      restLength = length ?? from.distanceTo(to);
    },
    hide() { active = false; mesh.visible = false; },
    setLength(l) { restLength = Math.max(0.2, l); },
    setTension(t) { tension = t; material.uniforms.uTension.value = t; },
    setLight(l) { material.uniforms.uLight.value = l; },
    // tip and end are pinned; surfaceY(x, z) gives the water height.
    // Casper 12 Nov: "the rope shouldn't disappear or look so flexible". A fishing line is stiff
    // monofilament, not a rope: it hangs in one clean curve from the rod tip, lies along the water
    // when slack, and pulls dead straight as the tension comes on. So the shape is computed, not
    // simulated: a single sagging span (sag from the slack and the tension, eased so it never
    // jitters), a breath of wind, and the part past the water's edge dropping to the lure.
    update(dt, tip, end, camera, surfaceY) {
      if (!active) return;
      const span = tip.distanceTo(end);
      const slack = Math.max(0, restLength - span);
      // Sag wanted: a slack line bellies, a loaded line is straight. Capped so it never loops.
      const want = Math.min(span * 0.22, 0.25 + Math.sqrt(slack * span) * 0.35) * (1 - Math.min(1, tension * 1.25));
      sag += (want - sag) * Math.min(1, dt * 5);
      windT += dt;
      const sway = Math.sin(windT * 1.3) * 0.012 * span * (1 - Math.min(1, tension * 2));
      // Sideways direction for the wind sway.
      tmpB.subVectors(end, tip); tmpB.y = 0;
      const sl = tmpB.length() || 1;
      const sx = -tmpB.z / sl, sz = tmpB.x / sl;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const p = pos[i].lerpVectors(tip, end, t);
        const bow = 4 * t * (1 - t);
        // The belly sits nearer the lure (the rod end is held up).
        const belly = bow * (0.6 + 0.8 * t) * 0.75;
        p.y -= sag * belly;
        p.x += sx * sway * bow; p.z += sz * sway * bow;
        // Above the lure's depth the line never dips under the surface until its last stretch:
        // slack line floats on the water, it does not dive through it.
        if (t < 0.93) {
          const sy = surfaceY(p.x, p.z) + 0.015;
          if (p.y < sy) p.y = sy;
        }
      }
      pos[0].copy(tip);
      pos[N - 1].copy(end);
      // Ribbon facing the camera.
      for (let i = 0; i < N; i++) {
        const p = pos[i];
        const q = pos[Math.min(N - 1, i + 1)];
        const o = pos[Math.max(0, i - 1)];
        tmpA.subVectors(q, o).normalize();
        view.subVectors(camera.position, p).normalize();
        const dist = p.distanceTo(camera.position);
        const px = (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / (window.innerHeight || 800) / (camera.zoom || 1);
        tmpB.crossVectors(tmpA, view).normalize().multiplyScalar(Math.max(WIDTH, px * 0.9));   // >= ~1.8 px wide: never vanishes on a far cast
        positions[i * 6] = p.x + tmpB.x; positions[i * 6 + 1] = p.y + tmpB.y; positions[i * 6 + 2] = p.z + tmpB.z;
        positions[i * 6 + 3] = p.x - tmpB.x; positions[i * 6 + 4] = p.y - tmpB.y; positions[i * 6 + 5] = p.z - tmpB.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
