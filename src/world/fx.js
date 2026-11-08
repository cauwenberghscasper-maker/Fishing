// Splash spray: soft droplet particles thrown up by casts, bites, leaps and skipping fish.
import * as THREE from 'three';

const MAX = 480;

export function createSplashes({ color = '#e9fff6', gravity = 9.2, name = 'splash-spray' } = {}) {
  const positions = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX * 2);   // age, lifetime
  const sizes = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i < MAX; i++) life[i * 2 + 1] = 0;

  const material = new THREE.ShaderMaterial({
    name: 'SplashSpray',
    uniforms: {
      uScale: { value: 400 },
      uColor: { value: new THREE.Color(color) },
      uLight: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute vec2 aLife;
      attribute float aSize;
      uniform float uScale;
      varying float vFade;
      void main() {
        float t = aLife.y > 0.0 ? aLife.x / aLife.y : 1.0;
        vFade = (1.0 - t) * step(t, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = vFade <= 0.0 ? 0.0 : aSize * (0.6 + 0.4 * (1.0 - t)) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uLight;
      varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float body = smoothstep(0.5, 0.25, r);
        float hi = smoothstep(0.22, 0.0, length(c - vec2(-0.12, -0.12)));
        vec3 col = uColor * uLight * (0.8 + hi * 0.8);
        gl_FragColor = vec4(col * body * vFade, body * vFade * 0.85);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 20;
  points.name = name;

  function emit(x, y, z, vx, vy, vz, size, lifetime) {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i * 2] = 0; life[i * 2 + 1] = lifetime;
    sizes[i] = size;
  }

  return {
    points,
    setViewportHeight(px, fovDeg) {
      material.uniforms.uScale.value = px / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    },
    setLight(l) { material.uniforms.uLight.value = l; },
    // strength: 0.3 nibble, 1 cast, 2 big leap
    splash(x, z, strength = 1, dir = null) {
      const n = Math.round(10 + strength * 22);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const out = (0.4 + Math.random() * 1.4) * (0.6 + strength * 0.5);
        let vx = Math.cos(a) * out, vz = Math.sin(a) * out;
        if (dir) { vx += dir.x * 1.5 * strength; vz += dir.z * 1.5 * strength; }
        const vy = (1.6 + Math.random() * 2.6) * (0.55 + strength * 0.45);
        emit(x + Math.cos(a) * 0.08, 0.02, z + Math.sin(a) * 0.08, vx, vy, vz,
          0.05 + Math.random() * 0.07 * (0.7 + strength * 0.4), 0.45 + Math.random() * 0.45);
      }
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const lt = life[i * 2 + 1];
        if (lt <= 0) continue;
        let age = life[i * 2] + dt;
        if (age >= lt) { life[i * 2 + 1] = 0; life[i * 2] = 0; continue; }
        life[i * 2] = age;
        vel[i * 3 + 1] -= gravity * dt;
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < -0.05) life[i * 2] = lt; // back in the water / ground
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}
