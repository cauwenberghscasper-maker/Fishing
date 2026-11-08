// Colliders that match what you see (Casper 9b.7). Source, in order:
// 1. the manifest's `collider` (Agent D): { type: 'circle', x, z, r } | { type: 'box', x, z, w, d, rot } | [shapes] | null,
//    in model space (metres, before placement; the prop's scale applies);
// 2. until D ships those: the model's real `bounds` footprint, only for solid structures and rocks.
// Everything else (plants, clutter, kelp, decks) never blocks.
import * as THREE from 'three';

const SOLID_CATEGORIES = new Set(['structure', 'building']);
const WALKABLE_IDS = /^(pier_|boat_dock|tide_pool|plot_|sandbar)/;

function footprintShapes(id, entry) {
  if (WALKABLE_IDS.test(id)) return [];
  const b = entry.bounds;
  if (!b?.min || !b?.max) return [];
  const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
  if (Math.max(w, d) < 0.7) return [];
  const rock = /^(rock_|cliff_columns|columns_steps)/.test(id);
  if (!rock && !SOLID_CATEGORIES.has(entry.category)) return [];
  const shrink = rock ? 0.78 : 0.86;
  return [{ type: 'box', x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2, w: w * shrink, d: d * shrink, rot: 0 }];
}

export function collidersFor(id, entry, x, z, rot, scale = 1) {
  let shapes;
  if (entry && 'collider' in entry) shapes = entry.collider === null ? [] : [].concat(entry.collider);
  else shapes = footprintShapes(id, entry || {});
  const c = Math.cos(rot), s = Math.sin(rot);
  return shapes.filter(Boolean).map((sh) => {
    // Rotate the local offset by the prop's yaw (three.js Y rotation).
    const lx = (sh.x || 0) * scale, lz = (sh.z || 0) * scale;
    const wx = x + lx * c + lz * s;
    const wz = z - lx * s + lz * c;
    if (sh.type === 'box') {
      const r = rot + (sh.rot || 0);
      return { type: 'box', x: wx, z: wz, hw: (sh.w * scale) / 2, hd: (sh.d * scale) / 2, rot: r, cos: Math.cos(r), sin: Math.sin(r), source: id };
    }
    return { type: 'circle', x: wx, z: wz, r: (sh.r || 0.5) * scale, source: id };
  });
}

// ?debug=colliders: outlines on the ground (debug only).
export function drawColliderDebug(parent, colliders, previous) {
  if (previous && previous !== true) previous.removeFromParent();
  const pts = [];
  for (const c of colliders) {
    const ring = [];
    if (c.type === 'box') {
      for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]) {
        const lx = ax * c.hw, lz = az * c.hd;
        const r = c.rot;
        ring.push(new THREE.Vector3(c.x + lx * Math.cos(r) + lz * Math.sin(r), 0, c.z - lx * Math.sin(r) + lz * Math.cos(r)));
      }
    } else {
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ring.push(new THREE.Vector3(c.x + Math.cos(a) * c.r, 0, c.z + Math.sin(a) * c.r));
      }
    }
    for (let i = 0; i < ring.length - 1; i++) pts.push(ring[i], ring[i + 1]);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff3366, depthTest: false }));
  lines.renderOrder = 999;
  lines.name = 'debug-colliders';
  lines.onBeforeRender = () => {};
  // Lift each outline to the ground under it.
  const pos = geo.attributes.position;
  parent.add(lines);
  lines.userData.lift = (heightAt) => {
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(heightAt(pos.getX(i), pos.getZ(i)), 0) + 0.08);
    pos.needsUpdate = true;
  };
  return lines;
}
