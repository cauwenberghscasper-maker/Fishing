// Tileable textures for the water, generated once at startup (no downloads, unique to this game).
import * as THREE from 'three';

function makeRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Periodic value noise on an integer lattice of `period` cells.
function periodicNoise(period, rand) {
  const lattice = new Float32Array(period * period);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  return (u, v) => {
    const x = u * period, y = v * period;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const at = (i, j) => lattice[((j % period + period) % period) * period + ((i % period + period) % period)];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// RG = surface normal xy, B = height, A = foam breakup noise.
export function createWaterNormalTexture(size = 256) {
  const rand = makeRand(7);
  const octaves = [
    { n: periodicNoise(6, rand), a: 0.45 },
    { n: periodicNoise(12, rand), a: 1.0 },
    { n: periodicNoise(24, rand), a: 0.5 },
    { n: periodicNoise(48, rand), a: 0.22 },
  ];
  const foamNoise = [periodicNoise(8, rand), periodicNoise(24, rand)];
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let h = 0;
      for (const o of octaves) h += o.n(u, v) * o.a;
      // Ridged shaping gives the sharper, painted wavelet crests.
      h = 1 - Math.abs(h / 2 - 0.5) * 2;
      height[y * size + x] = h * h;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (i, j) => height[((j + size) % size) * size + ((i + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(height[y * size + x] * 255);
      const u = x / size, v = y / size;
      data[i + 3] = Math.round((foamNoise[0](u, v) * 0.65 + foamNoise[1](u, v) * 0.35) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Caustic network: F2 - F1 voronoi with wrapped feature points.
export function createCausticTexture(size = 256, cells = 9) {
  const rand = makeRand(31);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([i + rand(), j + rand()]);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x / size) * cells, py = (y / size) * cells;
      const ci = Math.floor(px), cj = Math.floor(py);
      let f1 = 9, f2 = 9;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = ci + di, jj = cj + dj;
          const wi = ((ii % cells) + cells) % cells, wj = ((jj % cells) + cells) % cells;
          const p = pts[wj * cells + wi];
          const fx = p[0] + (ii - wi) - px, fy = p[1] + (jj - wj) - py;
          const d = Math.hypot(fx, fy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      const e = f2 - f1;
      const c = Math.pow(Math.max(0, 1 - e / 0.32), 3.2);
      const i = (y * size + x) * 4;
      const v = Math.round(c * 255);
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
