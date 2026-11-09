// Sunken treasure chests in the world (Casper 9 Nov: a rare chest you can find, with its own
// animation). A chest hot spot (sea.js) has a real chest on the seabed: banded planks, a brass lock,
// a soft pulsing glow through the water and bubbles. Cast onto it and it comes up on the line
// (fishing/index.js haul), lands at your feet, rattles, and its lid bursts open as the reels screen
// (ui/screens/treasure.js) appears. Wood, silver and gold chests look different.
// Built from three.js primitives so it never waits on a model; a Blender build named
// treasure_chest_<tier> (with a node named "lid") replaces it when it exists.
import * as THREE from 'three';
import { loadModel, pickAsset } from '../core/assets.js';

const LOOK = {
  wood: { wood: 0x7a4a22, band: 0x8f6a2c, glow: 0xffc85a },
  silver: { wood: 0x5c4a3a, band: 0xb9c6d2, glow: 0xbfe8ff },
  gold: { wood: 0x8a3e1a, band: 0xe0a92a, glow: 0xffe27a },
};

function plankTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    g.fillStyle = '#7d7d7d'; g.fillRect(0, y, 64, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(90,90,90,${0.15 + Math.random() * 0.2})`; g.fillRect(Math.random() * 64, y + 3 + Math.random() * 10, 10 + Math.random() * 20, 1); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let planks = null;

/** A chest: { group, lid (pivot), glow }. Size ~0.9 m wide. */
export function buildChest(tier = 'wood') {
  planks ??= plankTexture();
  const L = LOOK[tier] || LOOK.wood;
  const wood = new THREE.MeshStandardMaterial({ color: L.wood, map: planks, roughness: 0.85 });
  const band = new THREE.MeshStandardMaterial({ color: L.band, metalness: 0.75, roughness: 0.35 });
  const group = new THREE.Group();
  const W = 0.9, D = 0.58, H = 0.42;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wood);
  body.position.y = H / 2;
  group.add(body);
  for (const x of [-W * 0.36, W * 0.36]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, H + 0.02, D + 0.03), band);
    b.position.set(x, H / 2, 0);
    group.add(b);
  }
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.05, D + 0.03), band);
  rim.position.y = H;
  group.add(rim);
  // Lid: a half-barrel hinged at the back edge.
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, W, 16, 1, false, 0, Math.PI), wood);
  shell.rotation.z = Math.PI / 2;   // axis along the width, the half-round on top
  shell.position.set(0, 0, D / 2);
  lid.add(shell);
  for (const x of [-W * 0.36, W * 0.36]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(D / 2 + 0.02, D / 2 + 0.02, 0.07, 16, 1, false, 0, Math.PI), band);
    b.rotation.z = Math.PI / 2;
    b.position.set(x, 0, D / 2);
    lid.add(b);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.05), band);
  lock.position.set(0, -0.03, D + 0.01);
  lid.add(lock);
  group.add(lid);
  // The glow inside (seen through the water, and bursting out when it opens).
  const glow = new THREE.PointLight(L.glow, 0.0, 4, 2);
  glow.position.set(0, H + 0.1, 0);
  group.add(glow);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  group.add(halo);
  group.scale.setScalar(1.25);
  return { group, lid, glow, halo, open: -1.9 };
}

export function createTreasure({ under, surface, island, water, splashes, events, audio }) {
  const sunk = new Map();   // spot id -> { chest, spot }
  let shown = null;         // the chest at your feet: { chest, t, phase }

  async function make(tier) {
    const id = pickAsset('world', [`treasure_chest_${tier}`]);
    if (id) {
      const m = await loadModel('world', id);
      const lid = m?.scene.getObjectByName('lid');
      if (m && lid) {
        const glow = new THREE.PointLight(LOOK[tier]?.glow ?? 0xffc85a, 0, 4, 2);
        glow.position.y = 0.6;
        m.scene.add(glow);
        return { group: m.scene, lid, glow, halo: null, open: -1.3 };
      }
    }
    return buildChest(tier);
  }

  function sync(spots) {
    const live = new Set();
    for (const s of spots) {
      if (!s.chest) continue;
      live.add(s.id);
      if (sunk.has(s.id)) continue;
      const entry = { spot: s, chest: null };
      sunk.set(s.id, entry);
      make(s.chest).then((c) => {
        if (!sunk.has(s.id)) return;
        entry.chest = c;
        const depth = island.waterDepthAt(s.x, s.z);
        c.group.position.set(s.x, -Math.min(Math.max(0.6, depth - 0.15), 1.5), s.z);
        c.group.rotation.y = Math.random() * Math.PI * 2;
        c.lid.rotation.x = (c.open ?? -1.9) * 0.08;   // ajar: light leaks out
        c.glow.intensity = 1.2;
        under.add(c.group);
      });
    }
    for (const [id, e] of sunk) if (!live.has(id) && !e.lifted) { e.chest?.group.removeFromParent(); sunk.delete(id); }
  }

  return {
    sync,
    /** The claimed chest leaves the seabed and rides the line: returns its object (or a new one). */
    async lift(spot) {
      const e = sunk.get(spot.id);
      sunk.delete(spot.id);
      const c = e?.chest || (await make(spot.chest));
      c.group.removeFromParent();
      c.lid.rotation.x = 0;
      surface.add(c.group);
      return c;
    },
    /** Set down at the player's feet; the reels open after the rattle. */
    land(c, x, z, faceX, faceZ, tier) {
      c.group.position.set(x, Math.max(0, island.groundAt?.(x, z) ?? 0), z);
      c.group.rotation.set(0, Math.atan2(faceX - x, faceZ - z), 0);
      shown = { c, t: 0, tier, opened: false, s0: c.group.scale.x };
      splashes.splash(x, z, 0.6);
      audio?.plop?.();
    },
    update(dt, time) {
      for (const e of sunk.values()) {
        if (!e.chest) continue;
        e.chest.glow.intensity = 0.9 + Math.sin(time * 3 + e.spot.id) * 0.5;
        if (e.chest.halo) e.chest.halo.material.opacity = 0.18 + Math.sin(time * 3 + e.spot.id) * 0.1;
        e.chest.group.position.x = e.spot.x; e.chest.group.position.z = e.spot.z;
      }
      if (shown) {
        const s = shown;
        s.t += dt;
        const g = s.c.group;
        if (s.t < 0.9) { g.rotation.z = Math.sin(s.t * 40) * 0.06 * (1 - s.t / 0.9); g.position.y += Math.sin(s.t * 30) * 0.004; }
        else {
          g.rotation.z = 0;
          if (!s.opened) { s.opened = true; events.emit('treasure:open', { tier: s.tier }); }
          const k = Math.min(1, (s.t - 0.9) / 0.45);
          s.c.lid.rotation.x = (s.c.open ?? -1.9) * (1 - Math.pow(1 - k, 3)) - Math.sin(k * Math.PI) * 0.25;
          s.c.glow.intensity = 3 * k;
          if (s.c.halo) s.c.halo.material.opacity = 0.45 * k;
        }
        if (s.closing != null) {
          s.closing += dt;
          const k = Math.min(1, s.closing / 0.8);
          g.scale.setScalar(s.s0 * (1 - k * k));
          g.position.y += dt * 0.6;
          if (k >= 1) { g.removeFromParent(); shown = null; }
        }
      }
    },
    close() { if (shown) shown.closing = 0; },
    get busy() { return Boolean(shown); },
  };
}
