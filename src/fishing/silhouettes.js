// Top-down fish silhouettes, drawn once into an atlas (R = soft silhouette, G = glow mask).
// Until a fish has a real model it is shown as this soft dark shape under the water; each
// silhouette follows the fish's brief so it reads from above (master prompt 5.2).
import * as THREE from 'three';

export const SILHOUETTE_CELLS = ['glasswing', 'driftback', 'compass', 'shellback', 'kelpwraith', 'puffer', 'mooring', 'kelp', 'generic'];
const GRID = 3;
const CELL = 256;
const UNIT = 232; // pixels per fish length

// Outline from (x, halfWidth) samples along the body, head at +x.
function bodyPath(g, samples) {
  g.beginPath();
  g.moveTo(samples[0][0] * UNIT, 0);
  for (const [x, w] of samples) g.lineTo(x * UNIT, -w * UNIT);
  for (let i = samples.length - 1; i >= 0; i--) g.lineTo(samples[i][0] * UNIT, samples[i][1] * UNIT);
  g.closePath();
}

function smoothBody(g, pts) {
  // Catmull-Rom through the upper outline, mirrored for the lower one.
  const up = pts.map(([x, w]) => [x * UNIT, -w * UNIT]);
  const down = pts.slice().reverse().map(([x, w]) => [x * UNIT, w * UNIT]);
  const all = [...up, ...down];
  g.beginPath();
  g.moveTo(all[0][0], all[0][1]);
  for (let i = 0; i < all.length; i++) {
    const p0 = all[(i - 1 + all.length) % all.length], p1 = all[i];
    const p2 = all[(i + 1) % all.length], p3 = all[(i + 2) % all.length];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  g.closePath();
}

function tailFork(g, x0, len, spread) {
  g.beginPath();
  g.moveTo(x0 * UNIT, -0.02 * UNIT);
  g.quadraticCurveTo((x0 - len * 0.5) * UNIT, -spread * 0.4 * UNIT, (x0 - len) * UNIT, -spread * UNIT);
  g.quadraticCurveTo((x0 - len * 0.55) * UNIT, 0, (x0 - len) * UNIT, spread * UNIT);
  g.quadraticCurveTo((x0 - len * 0.5) * UNIT, spread * 0.4 * UNIT, x0 * UNIT, 0.02 * UNIT);
  g.closePath();
  g.fill();
}

const DRAW = {
  glasswing(g, glow) {
    smoothBody(g, [[0.46, 0.0], [0.36, 0.045], [0.18, 0.07], [0.0, 0.062], [-0.2, 0.042], [-0.36, 0.02]]);
    g.fill();
    tailFork(g, -0.35, 0.15, 0.1);
    // Long wing-like pectorals (clear glass: lighter).
    g.globalAlpha = 0.55;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.2 * UNIT, s * 0.05 * UNIT);
      g.quadraticCurveTo(0.02 * UNIT, s * 0.3 * UNIT, -0.24 * UNIT, s * 0.3 * UNIT);
      g.quadraticCurveTo(-0.06 * UNIT, s * 0.16 * UNIT, 0.04 * UNIT, s * 0.055 * UNIT);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    glow.lineWidth = 4;
    glow.lineCap = 'round';
    glow.beginPath();
    glow.moveTo(0.38 * UNIT, 0);
    glow.lineTo(-0.36 * UNIT, 0);
    glow.stroke();
  },
  driftback(g) {
    // Twisted branch: knotted, uneven outline, a broken twig stub, ragged tail.
    bodyPath(g, [[0.47, 0.0], [0.44, 0.035], [0.36, 0.06], [0.27, 0.07], [0.2, 0.058], [0.12, 0.082], [0.04, 0.07],
      [-0.06, 0.06], [-0.13, 0.072], [-0.22, 0.05], [-0.3, 0.04], [-0.38, 0.026], [-0.41, 0.02]]);
    g.fill();
    g.lineCap = 'round';
    g.lineWidth = 0.035 * UNIT;
    g.beginPath();
    g.moveTo(0.06 * UNIT, -0.05 * UNIT);
    g.lineTo(-0.03 * UNIT, -0.16 * UNIT);
    g.lineTo(-0.07 * UNIT, -0.19 * UNIT);
    g.stroke();
    g.lineWidth = 0.02 * UNIT;
    for (const [a, b] of [[-0.4, -0.08], [-0.41, 0.0], [-0.39, 0.07]]) {
      g.beginPath();
      g.moveTo(-0.38 * UNIT, b * 0.3 * UNIT);
      g.lineTo((a - 0.1) * UNIT, b * UNIT * 1.3);
      g.stroke();
    }
    // Dried-seaweed frond dorsal trailing off the back.
    g.globalAlpha = 0.5;
    g.lineWidth = 0.012 * UNIT;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo((0.15 - i * 0.08) * UNIT, 0);
      g.quadraticCurveTo((0.05 - i * 0.08) * UNIT, (0.06 + i * 0.01) * UNIT, (-0.05 - i * 0.09) * UNIT, (0.09 + i * 0.012) * UNIT);
      g.stroke();
    }
    g.globalAlpha = 1;
  },
  compass(g, glow) {
    // Round disc with frilled edge fins, small tail; glow: needle spine + rose ridges.
    g.globalAlpha = 0.6;
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = 1 + 0.05 * Math.sin(a * 22);
      g.lineTo(Math.cos(a) * 0.39 * r * UNIT, Math.sin(a) * 0.33 * r * UNIT);
    }
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.ellipse(0.02 * UNIT, 0, 0.33 * UNIT, 0.28 * UNIT, 0, 0, Math.PI * 2);
    g.fill();
    tailFork(g, -0.36, 0.13, 0.08);
    glow.lineWidth = 5;
    glow.lineCap = 'round';
    glow.beginPath();
    glow.moveTo(0.3 * UNIT, 0);
    glow.lineTo(-0.22 * UNIT, 0);
    glow.stroke();
    glow.globalAlpha = 0.35;
    glow.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI + Math.PI / 8;
      glow.beginPath();
      glow.moveTo(Math.cos(a) * 0.28 * UNIT, Math.sin(a) * 0.24 * UNIT);
      glow.lineTo(-Math.cos(a) * 0.28 * UNIT, -Math.sin(a) * 0.24 * UNIT);
      glow.stroke();
    }
    glow.globalAlpha = 1;
  },
  shellback(g) {
    // Spiral shell at the rear, frilled head and fan fins poking out in front.
    g.beginPath();
    g.ellipse(-0.12 * UNIT, 0, 0.25 * UNIT, 0.22 * UNIT, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-0.36 * UNIT, 0.03 * UNIT, 0.09 * UNIT, 0.07 * UNIT, 0.3, 0, Math.PI * 2);
    g.fill();
    smoothBody(g, [[0.4, 0.0], [0.34, 0.07], [0.22, 0.095], [0.1, 0.1], [0.02, 0.09]]);
    g.fill();
    g.globalAlpha = 0.7;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(0.16 * UNIT, s * 0.14 * UNIT, 0.06 * UNIT, 0.05 * UNIT, s * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = 0.32 - i * 0.03;
      g.beginPath();
      g.moveTo(x * UNIT, -0.02 * UNIT);
      g.lineTo((x - 0.02) * UNIT, (-0.08 - (i % 2) * 0.02) * UNIT);
      g.stroke();
    }
    g.globalAlpha = 1;
    // Whorl: carve a faint spiral groove into the shell.
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.35;
    g.lineWidth = 5;
    g.beginPath();
    for (let t = 0; t < 1; t += 0.01) {
      const a = t * Math.PI * 4.2;
      const r = (0.02 + t * 0.19) * UNIT;
      g.lineTo(-0.12 * UNIT + Math.cos(a) * r, Math.sin(a) * r * 0.9);
    }
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  },
  kelpwraith(g, glow) {
    // A ribbon of overlapping kelp blades with amber bulbs down the spine.
    const spine = (t) => [0.48 - t * 0.96, Math.sin(t * Math.PI * 2) * 0.025];
    g.lineWidth = 0.05 * UNIT;
    g.lineCap = 'round';
    g.beginPath();
    for (let t = 0; t <= 1.001; t += 0.02) { const [x, y] = spine(t); g.lineTo(x * UNIT, y * UNIT); }
    g.stroke();
    for (let i = 1; i < 11; i++) {
      const t = i / 11.5;
      const [x, y] = spine(t);
      const size = 0.75 + 0.25 * Math.sin(t * Math.PI);
      for (const s of [-1, 1]) {
        g.save();
        g.translate(x * UNIT, y * UNIT);
        g.rotate(s * 2.35 + (i % 2) * 0.15);
        g.globalAlpha = 0.8;
        g.beginPath();
        g.ellipse(0.055 * UNIT * size, 0, 0.07 * UNIT * size, 0.022 * UNIT * size, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;
    for (let i = 1; i < 8; i++) {
      const [x, y] = spine(i / 8.5);
      glow.beginPath();
      glow.arc(x * UNIT, y * UNIT, 0.016 * UNIT, 0, Math.PI * 2);
      glow.fill();
    }
  },
  puffer(g, glow) {
    // Cluster of angular sea-glass shards with short spikes; small tail.
    const n = 13;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = (0.22 + ((i * 7) % 5) * 0.012) * UNIT;
      const a2 = a + Math.PI / n;
      g.lineTo(0.04 * UNIT + Math.cos(a) * r, Math.sin(a) * r * 0.92);
      g.lineTo(0.04 * UNIT + Math.cos(a2) * (r + 0.05 * UNIT), Math.sin(a2) * (r + 0.05 * UNIT) * 0.92);
    }
    g.closePath();
    g.fill();
    tailFork(g, -0.2, 0.18, 0.09);
    glow.globalAlpha = 0.5;
    glow.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      glow.beginPath();
      glow.moveTo(0.04 * UNIT + Math.cos(a) * 0.05 * UNIT, Math.sin(a) * 0.05 * UNIT);
      glow.lineTo(0.04 * UNIT + Math.cos(a + 0.4) * 0.19 * UNIT, Math.sin(a + 0.4) * 0.18 * UNIT);
      glow.stroke();
    }
    glow.globalAlpha = 1;
  },
  mooring(g) {
    // Huge catfish: broad flat head, rope barbels trailing back, ring through the lip.
    smoothBody(g, [[0.47, 0.0], [0.44, 0.1], [0.34, 0.15], [0.2, 0.14], [0.05, 0.12], [-0.12, 0.09], [-0.28, 0.055], [-0.36, 0.035]]);
    g.fill();
    g.beginPath();
    g.moveTo(-0.34 * UNIT, -0.03 * UNIT);
    g.quadraticCurveTo(-0.46 * UNIT, -0.12 * UNIT, -0.5 * UNIT, -0.06 * UNIT);
    g.quadraticCurveTo(-0.47 * UNIT, 0, -0.5 * UNIT, 0.06 * UNIT);
    g.quadraticCurveTo(-0.46 * UNIT, 0.12 * UNIT, -0.34 * UNIT, 0.03 * UNIT);
    g.fill();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(0.2 * UNIT, s * 0.17 * UNIT, 0.09 * UNIT, 0.045 * UNIT, s * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.lineCap = 'round';
    g.lineWidth = 0.022 * UNIT;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.42 * UNIT, s * 0.1 * UNIT);
      g.bezierCurveTo(0.42 * UNIT, s * 0.3 * UNIT, 0.12 * UNIT, s * 0.26 * UNIT, -0.06 * UNIT, s * 0.4 * UNIT);
      g.stroke();
      g.lineWidth = 0.012 * UNIT;
      g.beginPath();
      g.moveTo(0.43 * UNIT, s * 0.05 * UNIT);
      g.quadraticCurveTo(0.36 * UNIT, s * 0.16 * UNIT, 0.22 * UNIT, s * 0.27 * UNIT);
      g.stroke();
      g.lineWidth = 0.022 * UNIT;
    }
    g.lineWidth = 0.014 * UNIT;
    g.beginPath();
    g.arc(0.475 * UNIT, 0, 0.035 * UNIT, 0, Math.PI * 2);
    g.stroke();
  },
  kelp(g) {
    g.lineCap = 'round';
    g.lineWidth = 0.012 * UNIT;
    g.beginPath();
    g.moveTo(-0.48 * UNIT, 0);
    g.lineTo(0.46 * UNIT, 0);
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const x = -0.4 + i * 0.1;
      const s = i % 2 ? 1 : -1;
      g.beginPath();
      g.ellipse((x + 0.04) * UNIT, s * 0.04 * UNIT, 0.08 * UNIT, 0.03 * UNIT, s * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.ellipse(-0.36 * UNIT, 0, 0.03 * UNIT, 0.026 * UNIT, 0, 0, Math.PI * 2);
    g.fill();
  },
  generic(g) {
    smoothBody(g, [[0.46, 0.0], [0.38, 0.07], [0.2, 0.1], [0.0, 0.09], [-0.2, 0.06], [-0.36, 0.025]]);
    g.fill();
    tailFork(g, -0.35, 0.15, 0.11);
  },
};

function drawCell(name, blur) {
  const sil = document.createElement('canvas');
  const glowC = document.createElement('canvas');
  sil.width = sil.height = glowC.width = glowC.height = CELL;
  const shape = document.createElement('canvas');
  shape.width = shape.height = CELL;
  const g = shape.getContext('2d');
  g.translate(CELL / 2, CELL / 2);
  g.fillStyle = g.strokeStyle = '#fff';
  const gg = glowC.getContext('2d');
  gg.translate(CELL / 2, CELL / 2);
  gg.fillStyle = gg.strokeStyle = '#fff';
  DRAW[name](g, gg);
  // Soften: draw the crisp shape blurred via the shadow trick (works on every mobile browser).
  const s = sil.getContext('2d');
  s.shadowColor = '#fff';
  s.shadowBlur = blur;
  s.shadowOffsetX = CELL * 4;
  s.drawImage(shape, -CELL * 4, 0);
  s.shadowBlur = 0;
  s.shadowOffsetX = 0;
  s.globalAlpha = 0.55;
  s.drawImage(shape, 0, 0);
  return { sil, glow: glowC };
}

let atlasTexture = null;

export function getSilhouetteAtlas() {
  if (atlasTexture) return atlasTexture;
  const size = CELL * GRID;
  const data = new Uint8Array(size * size * 4);
  SILHOUETTE_CELLS.forEach((name, idx) => {
    const { sil, glow } = drawCell(name, name === 'kelp' ? 5 : 4);
    const sd = sil.getContext('2d').getImageData(0, 0, CELL, CELL).data;
    const gd = glow.getContext('2d').getImageData(0, 0, CELL, CELL).data;
    const cx = (idx % GRID) * CELL;
    const cy = Math.floor(idx / GRID) * CELL;
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const si = (y * CELL + x) * 4;
        // DataTexture rows start at the bottom; flip so cell rows match canvas rows.
        const di = ((size - 1 - (cy + y)) * size + cx + x) * 4;
        data[di] = Math.max(sd[si], sd[si + 3] ? sd[si] : 0) * (sd[si + 3] / 255);
        data[di + 1] = gd[si + 3];
        data[di + 2] = 0;
        data[di + 3] = 255;
      }
    }
  });
  atlasTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  atlasTexture.generateMipmaps = true;
  atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.colorSpace = THREE.NoColorSpace;
  atlasTexture.needsUpdate = true;
  return atlasTexture;
}

// UV offset (bottom-left corner in texture space) and scale for a cell.
export function cellIndex(name) {
  const i = SILHOUETTE_CELLS.indexOf(name);
  return i < 0 ? SILHOUETTE_CELLS.indexOf('generic') : i;
}

export const ATLAS_GRID = GRID;
