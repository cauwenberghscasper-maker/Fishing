// Builds an island from its layout: terrain, props from the world manifest, walkable decks,
// colliders and interaction zones. Rebuilds props when the economy changes the island.
import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { loadModel, pickAsset } from '../core/assets.js';

const WADE_DEPTH = 0.45;   // the player can wade this deep
const MAX_SLOPE = 0.95;

export function createIsland({ layout, events, state }) {
  const group = new THREE.Group();
  group.name = `island:${layout.id}`;
  const terrain = createTerrain(layout, layout.palette);
  group.add(terrain.mesh);

  const propsGroup = new THREE.Group();
  propsGroup.name = 'props';
  group.add(propsGroup);

  let colliders = [];   // { x, z, r }
  let decks = [];       // active decks with precomputed frames
  const activeZones = new Set();
  let currentZone = null;

  function buildDeck(def) {
    const [x0, z0] = def.from;
    const [x1, z1] = def.to;
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    return { ...def, x0, z0, ux: dx / len, uz: dz / len, len };
  }

  function deckAt(x, z) {
    for (const d of decks) {
      const rx = x - d.x0, rz = z - d.z0;
      const along = rx * d.ux + rz * d.uz;
      const across = -rx * d.uz + rz * d.ux;
      if (along >= -0.2 && along <= d.len + 0.2 && Math.abs(across) <= d.width / 2) return d;
    }
    return null;
  }

  async function placeProps() {
    propsGroup.clear();
    colliders = [];
    const loadedIds = new Set();
    const jobs = layout.props.map(async (p) => {
      const id = pickAsset('world', p.asset);
      if (!id) return;
      const model = await loadModel('world', id);
      if (!model) return;
      loadedIds.add(id);
      const obj = model.scene;
      obj.position.set(p.x, p.float ? 0 : terrain.heightAt(p.x, p.z), p.z);
      obj.rotation.y = p.rot || 0;
      if (p.scale) obj.scale.multiplyScalar(p.scale);
      obj.userData.prop = { ...p, id };
      propsGroup.add(obj);
      if (p.collide > 0) colliders.push({ x: p.x, z: p.z, r: p.collide });
    });
    await Promise.all(jobs);
    decks = layout.decks.filter((d) => pickAsset('world', d.asset)).map(buildDeck);
    return loadedIds;
  }

  function groundAt(x, z) {
    const h = terrain.heightAt(x, z);
    const d = deckAt(x, z);
    return d ? Math.max(h, d.height) : h;
  }

  function onDeck(x, z) { return Boolean(deckAt(x, z)); }

  function isWalkable(x, z) {
    if (deckAt(x, z)) return true;
    const h = terrain.heightAt(x, z);
    if (h < -WADE_DEPTH) return false;
    if (terrain.slopeAt(x, z) > MAX_SLOPE) return false;
    for (const c of colliders) {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false;
    }
    return true;
  }

  // Move with sliding: full step, else each axis separately.
  function resolveMove(from, dx, dz) {
    const tx = from.x + dx, tz = from.z + dz;
    if (isWalkable(tx, tz)) return { x: tx, z: tz, blocked: false };
    if (isWalkable(from.x + dx, from.z)) return { x: from.x + dx, z: from.z, blocked: true };
    if (isWalkable(from.x, from.z + dz)) return { x: from.x, z: from.z + dz, blocked: true };
    return { x: from.x, z: from.z, blocked: true };
  }

  // Water depth below the surface at a point (0 on land).
  function waterDepthAt(x, z) {
    return Math.max(0, -terrain.heightAt(x, z));
  }

  function zoneActive(z) {
    return !z.needsDeck || decks.some((d) => d.id === z.needsDeck);
  }

  function updateZones(pos) {
    let best = null;
    let bestD = Infinity;
    for (const z of layout.zones) {
      if (!zoneActive(z)) continue;
      const d = Math.hypot(pos.x - z.x, pos.z - z.z);
      const inside = activeZones.has(z.id) ? d < z.r + 0.4 : d < z.r; // small hysteresis
      if (inside) {
        if (!activeZones.has(z.id)) {
          activeZones.add(z.id);
          events.emit('zone:enter', { zoneId: z.id, kind: z.kind });
        }
        if (d < bestD) { bestD = d; best = z.id; }
      } else if (activeZones.has(z.id)) {
        activeZones.delete(z.id);
        events.emit('zone:exit', { zoneId: z.id, kind: z.kind });
      }
    }
    if (best !== currentZone) {
      currentZone = best;
      state.world.zone = best;
    }
  }

  events.on('island:changed', () => { placeProps(); });

  return {
    group,
    terrain,
    layout,
    placeProps,
    groundAt,
    onDeck,
    isWalkable,
    resolveMove,
    waterDepthAt,
    updateZones,
    get decks() { return decks; },
    get colliders() { return colliders; },
    get props() { return propsGroup; },
    zone(id) { return layout.zones.find((z) => z.id === id) || null; },
  };
}
