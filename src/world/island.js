// Builds an island from its layout: terrain, props from the world manifest, walkable decks,
// colliders and interaction zones. Rebuilds props when the economy changes the island.
import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { loadModel, pickAsset } from '../core/assets.js';
import { collidersFor, drawColliderDebug } from './colliders.js';

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

  // A pier is a straight chain of 3 m modules; its deck is an oriented rectangle.
  function pierFrame(def) {
    const [x0, z0] = def.from;
    const [x1, z1] = def.to;
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    return { x0, z0, ux: dx / len, uz: dz / len, len, rot: Math.atan2(dx, dz) };
  }

  function deckAt(x, z) {
    for (const d of decks) {
      const rx = x - d.x0, rz = z - d.z0;
      const along = rx * d.ux + rz * d.uz;
      const across = -rx * d.uz + rz * d.ux;
      if (along >= -0.15 && along <= d.len + 0.05 && Math.abs(across) <= d.width / 2 - 0.12) return d;
    }
    return null;
  }

  function placementY(entry, x, z, float) {
    if (float) return 0;
    const placement = entry?.placement || 'ground';
    if (placement === 'water' || placement === 'shore') return 0;
    // Sink ground props a touch so slopes never show a floating edge.
    return terrain.heightAt(x, z) - 0.04;
  }

  // Only a model that actually loaded can block the player, with its own footprint.
  async function addProp(id, x, z, rot, scale, float, group = propsGroup) {
    const model = await loadModel('world', id);
    if (!model) return null;
    const obj = model.scene;
    obj.position.set(x, placementY(model.entry, x, z, float), z);
    obj.rotation.y = rot || 0;
    if (scale && scale !== 1) obj.scale.multiplyScalar(scale);
    obj.userData.assetId = id;
    obj.userData.colliders = collidersFor(id, model.entry, x, z, rot || 0, (scale || 1) * (Number(model.entry.scale) || 1));
    group.add(obj);
    return obj;
  }

  function rebuildColliders() {
    colliders = [];
    const visit = (o) => { if (o.userData.colliders && o.visible !== false) colliders.push(...o.userData.colliders); };
    propsGroup.children.forEach(visit);
    extraGroups.forEach((g) => g.children.forEach(visit));
    if (debugColliders) {
      debugColliders = drawColliderDebug(group, colliders, debugColliders);
      debugColliders.userData.lift((x, z) => groundAt(x, z));
    }
  }
  const extraGroups = [];
  let debugColliders = new URLSearchParams(location.search).get('debug') === 'colliders' ? true : null;

  function seeded(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  async function placeProps() {
    propsGroup.clear();
    colliders = [];
    const jobs = [];
    const builtPiers = [];

    for (const p of layout.props) {
      const id = pickAsset('world', p.asset);
      if (!id) continue;
      jobs.push(addProp(id, p.x, p.z, p.rot, p.scale, p.float));
    }

    for (const pier of layout.piers || []) {
      const f = pierFrame(pier);
      const count = pier.modules.length;
      let complete = true;
      pier.modules.forEach((mod, i) => {
        const id = pickAsset('world', [mod, 'pier_straight']);
        if (!id) { complete = false; return; }
        const along = (i + 0.5) * (f.len / count);
        jobs.push(addProp(id, f.x0 + f.ux * along, f.z0 + f.uz * along, f.rot, 1, true));
      });
      if (complete) builtPiers.push({ ...f, id: pier.id, width: pier.width, height: 0.75 });
    }

    for (const bed of layout.scatter || []) {
      const id = pickAsset('world', bed.asset);
      if (!id) continue;
      const rand = seeded(bed.seed || 1);
      let placed = 0;
      for (let tries = 0; tries < bed.count * 6 && placed < bed.count; tries++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * bed.r;
        const x = bed.x + Math.cos(a) * r, z = bed.z + Math.sin(a) * r;
        const scale = bed.scale[0] + rand() * (bed.scale[1] - bed.scale[0]);
        const rot = rand() * Math.PI * 2;
        if (bed.minDepth && -terrain.heightAt(x, z) < bed.minDepth) continue;
        placed++;
        jobs.push(addProp(id, x, z, rot, scale, false).then((obj) => {
          if (obj) obj.userData.sway = { phase: rand() * 6.28, amount: 0.06 + rand() * 0.05 };
        }));
      }
    }

    await Promise.all(jobs);
    decks = builtPiers;
    rebuildColliders();
    hasKelpModel = Boolean(pickAsset('world', ['kelp_a']));
  }

  let hasKelpModel = false;

  // Underwater plants sway gently (no skeleton: a small rotation wobble per instance).
  function updateSway(time) {
    for (const obj of propsGroup.children) {
      const s = obj.userData.sway;
      if (!s) continue;
      obj.rotation.x = Math.sin(time * 0.9 + s.phase) * s.amount;
      obj.rotation.z = Math.cos(time * 0.7 + s.phase * 1.3) * s.amount * 0.7;
    }
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
      if (c.type === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return false;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false;
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
    addProp,
    rebuildColliders,
    registerGroup(g) { if (!extraGroups.includes(g)) extraGroups.push(g); },
    get hasKelpModel() { return hasKelpModel; },
    updateSway,
    get colliders() { return colliders; },
    get props() { return propsGroup; },
    zone(id) { return layout.zones.find((z) => z.id === id) || null; },
    deckAt,
  };
}
