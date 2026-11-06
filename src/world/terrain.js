// Island heightfield + painted terrain shader (sand, wet sand, grass, columnar basalt, seabed).
import * as THREE from 'three';
import { GLSL_NOISE } from './glslNoise.js';

const SHORE = 0.16; // height of a shape's edge above the water line

function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { sum += amp * (valueNoise(x * f, z * f) * 2 - 1); f *= 2.03; amp *= 0.5; }
  return sum;
}

// Analytic height + rockiness for a layout. Used to build the mesh and for gameplay queries
// outside the mesh.
export function createHeightFunction(layout) {
  const shapes = layout.shapes.map((s) => ({ ...s, c: Math.cos(s.rot || 0), s: Math.sin(s.rot || 0) }));
  const { depth: maxDepth, fall } = layout.seabed;

  return function sample(x, z) {
    let h = -Infinity;
    let rough = 0;
    let rock = 0;
    for (const sh of shapes) {
      const dx = x - sh.x, dz = z - sh.z;
      const lx = dx * sh.c + dz * sh.s;
      const lz = -dx * sh.s + dz * sh.c;
      const dist = Math.hypot(lx, lz);
      const r = Math.hypot(lx / sh.rx, lz / sh.rz);
      const d = r > 1e-5 ? dist - dist / r : -Math.min(sh.rx, sh.rz); // metres outside the edge
      let hs;
      let t = 0;
      if (d <= 0) {
        t = Math.min(1, -d / sh.edge);
        t = t * t * (3 - 2 * t);
        hs = SHORE + (sh.top - SHORE) * t;
      } else {
        // Gentle turquoise shelf near the shore, then a drop-off into deep teal.
        hs = SHORE - maxDepth * (1 - Math.exp(-Math.pow(d / fall, 1.7))) - d * 0.01;
      }
      h = h === -Infinity ? hs : smax(h, hs, sh.cliff ? 0.9 : 1.6);
      rough = Math.max(rough, sh.rough * t);
      if (sh.cliff || sh.rocky) rock = Math.max(rock, t * (sh.cliff ? 1 : 0.7));
    }
    const n = fbm(x * 0.13, z * 0.13);
    h += n * rough;
    // Gentle sand dunes on the seabed so caustics and the refraction have something to bend.
    if (h < 0) h += fbm(x * 0.21 + 17, z * 0.21) * 0.35 * Math.min(1, -h / 2);
    return { h, rock };
  };
}

export function createTerrain(layout, palette) {
  const sample = createHeightFunction(layout);
  const size = layout.size;
  const seg = layout.resolution;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rockAttr = new Float32Array(pos.count);
  const grid = new Float32Array((seg + 1) * (seg + 1));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const { h, rock } = sample(x, z);
    pos.setY(i, h);
    rockAttr[i] = rock;
    grid[i] = h;
  }
  geo.setAttribute('aRock', new THREE.BufferAttribute(rockAttr, 1));
  geo.computeVertexNormals();

  const uniforms = {
    uTime: { value: 0 },
    uSandDry: { value: new THREE.Color(palette.sand.dry) },
    uSandWet: { value: new THREE.Color(palette.sand.wet) },
    uSandUnder: { value: new THREE.Color(palette.sand.under) },
    uGrass: { value: new THREE.Color(palette.grass.base) },
    uGrassTip: { value: new THREE.Color(palette.grass.tip) },
    uGrassDark: { value: new THREE.Color(palette.grass.dark) },
    uRock: { value: new THREE.Color(palette.rock.base) },
    uRockLight: { value: new THREE.Color(palette.rock.light) },
    uMoss: { value: new THREE.Color(palette.rock.moss) },
  };

  const material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRock;
        varying vec3 vTerrainPos;
        varying vec3 vTerrainNormal;
        varying float vRock;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);
        vRock = aRock;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform vec3 uSandDry, uSandWet, uSandUnder, uGrass, uGrassTip, uGrassDark, uRock, uRockLight, uMoss;
        varying vec3 vTerrainPos;
        varying vec3 vTerrainNormal;
        varying float vRock;
        float terrainRough;
        ${GLSL_NOISE}
        // Columnar basalt: vertical cells (voronoi in xz) cut by irregular horizontal joints.
        float basalt(vec3 p) {
          vec2 g = p.xz * 0.95;
          vec2 i = floor(g), f = fract(g);
          float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 r = o + hash22(i + o) * 0.85 - f;
            float d = dot(r, r);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
          }
          float edge = smoothstep(0.0, 0.16, sqrt(d2) - sqrt(d1));
          float joint = smoothstep(0.0, 0.08, abs(fract(p.y * 0.55 + vnoise(p.xz * 1.3) * 0.6) - 0.5) - 0.42);
          return edge * (1.0 - joint * 0.6);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vTerrainPos;
          vec3 nrm = normalize(vTerrainNormal);
          float slope = 1.0 - clamp(nrm.y, 0.0, 1.0);
          float big = fbm3(p.xz * 0.06);
          float mid = fbm3(p.xz * 0.35 + 3.1);
          float fine = vnoise(p.xz * 3.7);

          // Sand: warm gold, wind ripples, darker wet band that follows the wash.
          vec3 sand = uSandDry * (0.9 + 0.16 * big + 0.04 * fine);
          float rip = sin(dot(p.xz, vec2(0.62, 0.78)) * 5.5 + mid * 7.0);
          float ripMask = smoothstep(0.2, 0.9, p.y) * 0.9;
          sand = mix(sand, sand * vec3(1.12, 1.08, 0.98), smoothstep(0.55, 1.0, rip) * ripMask * 0.6);
          sand = mix(sand, sand * vec3(0.86, 0.84, 0.86), smoothstep(-0.55, -1.0, rip) * ripMask * 0.5);
          float wash = 0.26 + 0.1 * sin(uTime * 0.55 + mid * 2.5) + 0.05 * sin(uTime * 1.3 + p.x * 0.3);
          float wet = 1.0 - smoothstep(wash, wash + 0.32, p.y);
          sand = mix(sand, uSandWet * (0.9 + 0.2 * fine), wet * 0.9);
          float under = smoothstep(0.05, -1.2, p.y);
          sand = mix(sand, uSandUnder * (0.95 + 0.08 * mid), under);

          // Grass: tops of cliffs and headlands, a few tufts at the back of the beach.
          float grassH = smoothstep(1.15, 1.9, p.y + mid * 0.7) * (1.0 - smoothstep(0.32, 0.55, slope));
          float grassMask = grassH;
          vec3 grass = mix(uGrassDark, uGrass, 0.55 + 0.45 * mid);
          grass = mix(grass, uGrassTip, smoothstep(0.2, 0.8, fine * 0.6 + big * 0.5 + 0.2));

          // Rock: steep faces and rocky shapes.
          float rockMask = smoothstep(0.42, 0.62, slope + (vRock - 0.5) * 0.35 + mid * 0.08);
          rockMask = max(rockMask, smoothstep(0.55, 0.9, vRock) * smoothstep(0.3, 0.5, slope + fine * 0.15));
          float cols = basalt(p);
          vec3 rock = mix(uRock, uRockLight, 0.25 + 0.35 * big + 0.2 * fine);
          rock *= 0.55 + 0.45 * cols;
          float ledge = smoothstep(0.55, 0.85, nrm.y) * smoothstep(0.2, 0.7, mid + 0.4);
          rock = mix(rock, uMoss * (0.8 + 0.3 * fine), ledge * 0.7 * step(0.4, p.y));
          rock = mix(rock, uRock * 0.55, under * 0.5);

          vec3 col = sand;
          col = mix(col, grass, grassMask);
          col = mix(col, rock, rockMask);
          diffuseColor.rgb = col;
          terrainRough = mix(mix(0.95, 0.42, wet * (1.0 - under)), 0.85, rockMask);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = terrainRough;`);
  };

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';

  const half = size / 2;
  const cell = size / seg;
  function heightAt(x, z) {
    const gx = (x + half) / cell;
    const gz = (z + half) / cell;
    if (gx < 0 || gz < 0 || gx >= seg || gz >= seg) return sample(x, z).h;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const row = seg + 1;
    const a = grid[iz * row + ix], b = grid[iz * row + ix + 1];
    const c = grid[(iz + 1) * row + ix], d = grid[(iz + 1) * row + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  function slopeAt(x, z) {
    const e = 0.35;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  return { mesh, uniforms, heightAt, slopeAt, sample };
}
