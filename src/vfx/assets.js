// Agent E: loads the VFX texture registry (public/assets/vfx/manifest.json) and the variant looks
// (public/data/variants-look.json). Every texture the effects use is looked up by key here.
// A key whose file is missing gets a small procedural stand-in so effects never break, and the
// stand-in is logged once so a missing painted texture is easy to spot.
import * as THREE from 'three';

const MANIFEST_URL = 'assets/vfx/manifest.json';
const LOOKS_URL = 'data/variants-look.json';
const POWERS_URL = 'data/powers.json'; // Agent A (optional: effect counts such as shards/zones)

const loader = new THREE.TextureLoader();
const cache = new Map();
let manifest = {};
let looks = {};
let powers = {};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function loadVfxData() {
  [manifest, looks, powers] = await Promise.all([fetchJson(MANIFEST_URL), fetchJson(LOOKS_URL), fetchJson(POWERS_URL)]);
  return { manifest, looks, powers };
}

export const vfxManifest = () => manifest;
export const variantLooks = () => looks;
export const powerData = () => powers;

export function lookFor(variant) {
  return looks[variant] || null;
}

export function atlasInfo(key = 'sprites') {
  const e = manifest[key];
  return { grid: e?.grid || [4, 4], frames: e?.frames || {} };
}

export function frameIndex(name, key = 'sprites') {
  const f = atlasInfo(key).frames[name];
  if (typeof f === 'number') return f;
  if (f && typeof f.cell === 'number') return f.cell;
  return 16; // procedural soft dot
}

// Returns a THREE.Texture immediately; the image streams in. Colour textures are sRGB.
export function vfxTexture(key, { repeat = false } = {}) {
  const ck = `${key}|${repeat}`;
  if (cache.has(ck)) return cache.get(ck);
  const entry = manifest[key];
  let tex;
  if (entry?.path) {
    tex = loader.load(entry.path, undefined, undefined, () => {
      console.warn(`[vfx] texture ${key} failed (${entry.path}); using a stand-in`);
      const fb = fallbackTexture(key);
      tex.image = fb.image;
      tex.needsUpdate = true;
    });
  } else {
    tex = fallbackTexture(key);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  tex.name = `vfx:${key}`;
  cache.set(ck, tex);
  return tex;
}

// --- procedural stand-ins (only used while a painted texture is missing) -------------------
const warned = new Set();
function fallbackTexture(key) {
  if (!warned.has(key)) { warned.add(key); console.info(`[vfx] stand-in texture for "${key}"`); }
  const size = key === 'sprites' ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const rnd = mulberry(hash(key));
  if (key === 'sprites') {
    const [cols] = atlasInfo().grid;
    const cell = size / cols;
    for (let i = 0; i < cols * cols; i++) {
      const cx = (i % cols + 0.5) * cell, cy = (Math.floor(i / cols) + 0.5) * cell;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.45);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
    }
  } else if (key.startsWith('dc_ring') || key.startsWith('dc_rune')) {
    g.strokeStyle = '#fff';
    for (let r = 0; r < 3; r++) {
      g.lineWidth = r === 0 ? size * 0.035 : size * 0.012;
      g.beginPath();
      g.arc(size / 2, size / 2, size * (0.46 - r * 0.07), 0, Math.PI * 2);
      g.stroke();
    }
  } else if (key.startsWith('rb_') || key === 'tx_beam') {
    const grd = g.createLinearGradient(0, 0, size, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  } else {
    // veins / blobs: a few random strokes so overlays still animate visibly
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      let x = rnd() * size, y = rnd() * size;
      g.lineWidth = 1 + rnd() * 3;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.userData.standIn = true;
  return tex;
}

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const col = (hex, fallback = '#ffffff') => new THREE.Color(hex || fallback);
