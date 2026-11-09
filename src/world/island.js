// The home island, built from what the player owns (master prompt 4.6, 9b.6):
// plots (land rises out of the sea), pier modules, buildings per level, the boat, the camp.
// Source: state.profile.island, or for co-op visitors the host's island:changed (source 'net').
// Colliders, decks and zones always follow what is actually loaded and visible.
import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { loadModel, pickAsset, assetEntry } from '../core/assets.js';
import { collidersFor, drawColliderDebug } from './colliders.js';

const WADE_DEPTH = 1.0;    // the player can wade this deep (past 0.45 is deep water, where big fish hunt: wading.js)
const MAX_SLOPE = 1.05;
const RISE_TIME = 2.8;     // seconds for a plot to rise
const BUILD_TIME = 1.9;    // construction animation
const PIER_MODULE = 3.0;

// --- reading the owned island --------------------------------------------------------------
export function normalizeIsland(src, data) {
  const plots = new Set(['sandbar', ...(Array.isArray(src?.plots) ? src.plots : [])]);
  const piers = Array.isArray(src?.piers) ? src.piers.filter((p) => typeof p === 'string') : [];
  const buildings = {};
  const defs = data?.economy?.buildings || {};
  for (const [id, v] of Object.entries(src?.buildings || {})) {
    const o = typeof v === 'number' ? { level: v } : (v && typeof v === 'object' ? v : null);
    if (!o) continue;
    const level = Number(o.level) || 0;
    if (level <= 0) continue;
    const lv = defs[id]?.levels?.[level];
    const model = lv?.model || `${id}_l${level}`;
    buildings[id] = { level, model, x: Number.isFinite(o.x) ? o.x : null, z: Number.isFinite(o.z) ? o.z : null, rot: Number(o.rot) || 0 };
  }
  return {
    plots,
    piers,
    buildings,
    boat: typeof src?.boat === 'string' ? src.boat : 'rowboat',
    workers: Array.isArray(src?.workers) ? src.workers : [],
  };
}

function islandSource(state, netPayload) {
  if (netPayload && state.net?.role === 'visitor') return netPayload;
  const p = state.profile;
  return p ? { ...p.island, workers: p.workers } : null;
}

export function createIsland({ layout, events, state, splashes, dust, audio, water }) {
  const group = new THREE.Group();
  group.name = `island:${layout.id}`;
  let owned = normalizeIsland(islandSource(state, null), state.data);
  const terrain = createTerrain(layout, layout.palette, owned.plots);
  group.add(terrain.mesh);

  const groups = {};
  for (const name of ['props', 'plots', 'piers', 'buildings', 'boat', 'camp']) {
    groups[name] = new THREE.Group();
    groups[name].name = name;
    group.add(groups[name]);
  }
  const propsGroup = groups.props;
  const extraGroups = [];

  let colliders = [];
  let decks = [];
  let zones = [];
  const activeZones = new Set();
  let currentZone = null;
  const tweens = [];
  let netPayload = null;
  let rising = null;          // plot animation in progress
  const buildingObjs = {};    // id -> { obj, level, model, x, z, rot }
  let pierCount = -1;
  let boatId = null;
  let hasKelpModel = false;
  let debugColliders = new URLSearchParams(location.search).get('debug') === 'colliders' ? true : null;

  // --- helpers ---------------------------------------------------------------------------
  function placementY(entry, x, z, float) {
    if (float) return 0;
    const placement = entry?.placement || 'ground';
    if (placement === 'water' || placement === 'shore') return 0;
    // The height the land is rising to (terrain.sample), not the grid mid-rise: props on a plot that is
    // still coming up out of the sea must stand on its new ground, not be buried at the old seabed.
    const h = terrain.sample(x, z).h;
    if (placement === 'island') return Math.max(0, h) - 0.05;
    return h - 0.04;
  }

  // Only a model that actually loaded can block the player, with its own footprint.
  async function addProp(id, x, z, rot, scale, float, target = propsGroup, kind = 'world') {
    const model = await loadModel(kind, id);
    if (!model) return null;
    const obj = model.scene;
    obj.position.set(x, placementY(model.entry, x, z, float), z);
    obj.rotation.y = rot || 0;
    if (scale && scale !== 1) obj.scale.multiplyScalar(scale);
    obj.userData.assetId = id;
    obj.userData.colliders = collidersFor(id, model.entry, x, z, rot || 0, (scale || 1) * (Number(model.entry.scale) || 1));
    target.add(obj);
    return obj;
  }

  function seeded(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function rebuildColliders() {
    colliders = [];
    const visit = (o) => { if (o.userData.colliders && o.visible !== false && !o.userData.ghost) colliders.push(...o.userData.colliders); };
    for (const g of Object.values(groups)) g.children.forEach(visit);
    extraGroups.forEach((g) => g.children.forEach(visit));
    if (debugColliders) {
      debugColliders = drawColliderDebug(group, colliders, debugColliders);
      debugColliders.userData.lift((x, z) => groundAt(x, z));
    }
  }

  // --- tweens ---------------------------------------------------------------------------
  function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }
  const easeOutBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

  // --- plots ----------------------------------------------------------------------------
  // A plot's dressing: D's plot_<id> model if there is one, plus the layout props tagged with the
  // plot (palms, rocks, lanterns...). Both rise with the land when the plot is bought.
  async function addPlotDressing(id, animate) {
    const def = layout.plots[id];
    if (!def) return;
    const jobs = [];
    const modelId = def.model ? pickAsset('world', [def.model]) : null;
    if (modelId) jobs.push(addProp(modelId, def.x, def.z, def.rot, 1, false, groups.plots));
    for (const p of layout.props) {
      if (p.plot !== id) continue;
      const pid = pickAsset('world', p.asset);
      if (pid) jobs.push(addProp(pid, p.x, p.z, p.rot, p.scale, p.float, groups.plots));
    }
    for (const obj of await Promise.all(jobs)) {
      if (!obj) continue;
      obj.userData.plot = id;
      if (animate) {
        const y1 = obj.position.y;
        obj.position.y = y1 - 2.6;
        tween(RISE_TIME, (k) => { obj.position.y = y1 - 2.6 * (1 - (k * k * (3 - 2 * k))); });
      }
    }
  }

  function raisePlot(id) {
    const def = layout.plots[id];
    const anim = terrain.setPlots(owned.plots, true);
    rising = { id, anim };
    if (def) {
      // Water drains off: rings and spray around the rising land.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        water?.addRipple(def.x + Math.cos(a) * 5.5, def.z + Math.sin(a) * 4, 1.2, i * 0.08);
        splashes?.splash(def.x + Math.cos(a) * 5, def.z + Math.sin(a) * 3.5, 0.8);
      }
    }
    audio?.splash?.(1.6);
    tween(RISE_TIME, (k) => { terrain.uniforms.uGrow.value = k; }, () => {
      anim.commit();
      rising = null;
      if (def) for (let i = 0; i < 14; i++) dust?.splash(def.x + (Math.random() - 0.5) * 9, def.z + (Math.random() - 0.5) * 6, 0.6);
      layoutDependentRefresh();
      events.emit('island:grown', { plotId: id });
    });
    addPlotDressing(id, true);
  }

  // --- piers ----------------------------------------------------------------------------
  function pierFrame(count) {
    const L = layout.pierLine;
    const len = Math.hypot(L.dir[0], L.dir[1]);
    const ux = L.dir[0] / len, uz = L.dir[1] / len;
    return { x0: L.from[0], z0: L.from[1], ux, uz, rot: Math.atan2(ux, uz), len: PIER_MODULE * count, width: L.width, height: 0.75, id: 'pier_main' };
  }

  async function buildPier(count, animateFrom = null) {
    const L = layout.pierLine;
    groups.piers.clear();
    const f = pierFrame(count);
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const isEnd = i === count - 1 && count > 1;
      const mod = i === 0 ? L.stub : isEnd ? L.end : L.modules[(i - 1) % L.modules.length];
      const id = pickAsset('world', [mod, 'pier_straight']);
      if (!id) continue;
      const along = (i + 0.5) * PIER_MODULE;
      jobs.push(addProp(id, f.x0 + f.ux * along, f.z0 + f.uz * along, f.rot, 1, true, groups.piers).then((obj) => {
        if (obj && animateFrom !== null && i >= animateFrom) {
          obj.position.y = 3;
          tween(0.9 + (i - animateFrom) * 0.15, (k) => { obj.position.y = 3 * (1 - k) * (1 - k); }, () => {
            splashes?.splash(obj.position.x, obj.position.z, 1.0);
            dust?.splash(obj.position.x, obj.position.z, 0.5);
          });
        }
      }));
    }
    await Promise.all(jobs);
    decks = groups.piers.children.length ? [{ ...f, len: PIER_MODULE * groups.piers.children.length }] : [];
    // A water building (boat dock) adds its own deck.
    for (const b of Object.values(buildingObjs)) if (b.deck) decks.push(b.deck);
  }

  // --- buildings ------------------------------------------------------------------------
  function buildingSpot(id, b) {
    if (b.x !== null && b.z !== null) return { x: b.x, z: b.z, rot: b.rot };
    return layout.defaultBuildingSpots[id] || { x: 0, z: -3, rot: 0 };
  }

  function modelChain(id, b) {
    const ids = [b.model];
    for (let l = b.level; l >= 1; l--) ids.push(`${id}_l${l}`);
    // Older single-level kit names from D.
    ids.push({ shop: 'shop_hullhouse', workers_hut: 'workers_hut', cooler: 'cooler', boat_dock: 'boat_dock' }[id]);
    return ids.filter(Boolean);
  }

  async function placeBuilding(id, b, animate) {
    const prev = buildingObjs[id];
    const spot = buildingSpot(id, b);
    const modelId = pickAsset('world', modelChain(id, b));
    if (!modelId) { if (prev) prev.obj?.removeFromParent(); buildingObjs[id] = { ...b, ...spot, obj: null }; return; }
    if (prev?.obj && prev.modelId === modelId && prev.x === spot.x && prev.z === spot.z) {
      prev.obj.rotation.y = spot.rot;
      buildingObjs[id] = { ...prev, ...b, ...spot };
      return;
    }
    const obj = await addProp(modelId, spot.x, spot.z, spot.rot, 1, false, groups.buildings);
    if (!obj) return;
    obj.userData.building = id;
    const entry = assetEntry('world', modelId);
    let deck = null;
    if (entry?.placement === 'water') {
      deck = { x0: spot.x - Math.sin(spot.rot) * 1.5, z0: spot.z - Math.cos(spot.rot) * 1.5, ux: Math.sin(spot.rot), uz: Math.cos(spot.rot), len: 3, width: 4, height: 0.75, id: `deck_${id}` };
    }
    buildingObjs[id] = { ...b, ...spot, obj, modelId, deck };
    if (animate) construct(obj, prev?.obj);
    else prev?.obj?.removeFromParent();
  }

  // Construction: the old model sinks into a dust cloud, the new one grows up with a bounce
  // while hammers knock.
  function construct(obj, old) {
    const s0 = obj.scale.clone();
    obj.scale.set(s0.x * 0.9, s0.y * 0.02, s0.z * 0.9);
    let hammer = 0;
    if (old) {
      old.userData.colliders = null; // the old level stops blocking at once
      tween(0.5, (k) => { old.scale.y = Math.max(0.01, 1 - k); }, () => { old.removeFromParent(); rebuildColliders(); });
    }
    tween(BUILD_TIME, (k) => {
      const e = Math.min(1.08, easeOutBack(k));
      obj.scale.set(s0.x * (0.9 + 0.1 * k), s0.y * Math.max(0.02, e), s0.z * (0.9 + 0.1 * k));
      hammer += 1;
      if (hammer % 9 === 0 && k < 0.85) {
        dust?.splash(obj.position.x + (Math.random() - 0.5) * 3, obj.position.z + (Math.random() - 0.5) * 3, 0.4);
        audio?.hammer?.();
      }
    }, () => {
      obj.scale.copy(s0);
      rebuildColliders();
      for (let i = 0; i < 8; i++) dust?.splash(obj.position.x + (Math.random() - 0.5) * 3.5, obj.position.z + (Math.random() - 0.5) * 3.5, 0.7);
    });
  }

  // --- boat -----------------------------------------------------------------------------
  async function placeBoat(id) {
    if (id === boatId) return;
    boatId = id;
    groups.boat.clear();
    const kind = pickAsset('boats', [id]) ? 'boats' : null;
    if (!kind) return;
    // Moored at the boat dock when there is one, else beside the pier stub.
    const dock = buildingObjs.boat_dock;
    const spot = dock?.obj ? { x: dock.x - Math.sin(dock.rot) * 2.2, z: dock.z - Math.cos(dock.rot) * 2.2, rot: dock.rot + Math.PI / 2 } : layout.boatSpot;
    const obj = await addProp(id, spot.x, spot.z, spot.rot, 1, true, groups.boat, 'boats');
    if (obj) obj.userData.boat = { phase: Math.random() * 6, baseY: obj.position.y };
  }

  // --- zones ----------------------------------------------------------------------------
  function rebuildZones() {
    zones = [...layout.zones];
    for (const [id, b] of Object.entries(buildingObjs)) {
      if (!b.obj) continue;
      const kind = id === 'shop' ? 'shop' : id === 'boat_dock' ? 'boat' : 'building';
      zones.push({ id, kind, x: b.x + Math.sin(b.rot) * 2.4, z: b.z + Math.cos(b.rot) * 2.4, r: 2.2 });
    }
    const camp = layout.camp;
    if (groups.camp.children.length) zones.push({ id: 'camp', kind: 'building', x: camp.x + 0.4, z: camp.z + 2.6, r: 1.8 });
    if (decks[0]) {
      const d = decks[0];
      zones.push({ id: 'pier_1', kind: 'pier', x: d.x0 + d.ux * (d.len - 1.2), z: d.z0 + d.uz * (d.len - 1.2), r: 2.2 });
    }
    if (groups.boat.children.length && !buildingObjs.boat_dock?.obj) {
      const s = layout.boatSpot;
      zones.push({ id: 'boat', kind: 'boat', x: s.x - 1.6, z: s.z - 1.2, r: 1.6 });
    }
    // A buy-land zone at the edge of what is owned (B shows "Build").
    zones.push({ id: 'plot_shore', kind: 'plot', x: layout.spawn.x - 2.8, z: layout.spawn.z + 2.6, r: 1.6 });
  }

  function layoutDependentRefresh() {
    rebuildZones();
    rebuildColliders();
  }

  // --- full build & incremental changes --------------------------------------------------
  async function build() {
    const jobs = [];
    for (const p of layout.props) {
      if (p.plot) continue;   // plot props come with their plot (addPlotDressing)
      const id = pickAsset('world', p.asset);
      if (id) jobs.push(addProp(id, p.x, p.z, p.rot, p.scale, p.float).then((o) => { if (o) o.userData.plot = p.plot || null; }));
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
    const campId = pickAsset('world', [layout.camp.model]);
    if (campId) jobs.push(addProp(campId, layout.camp.x, layout.camp.z, layout.camp.rot, 1, false, groups.camp));
    for (const id of owned.plots) jobs.push(addPlotDressing(id, false));
    await Promise.all(jobs);
    await Promise.all(Object.entries(owned.buildings).map(([id, b]) => placeBuilding(id, b, false)));
    pierCount = 1 + owned.piers.length;
    await buildPier(pierCount);
    await placeBoat(owned.boat);
    hasKelpModel = Boolean(pickAsset('world', ['kelp_a']));
    layoutDependentRefresh();
  }

  // Bring the visuals in line with a new owned state, animating what changed.
  async function applyOwned(next, { animate = true, skipBuild = null } = {}) {
    const before = owned;
    owned = next;
    for (const id of next.plots) {
      if (!before.plots.has(id)) {
        if (animate) raisePlot(id);
        else { terrain.setPlots(next.plots, false).commit(); addPlotDressing(id, false); }
      }
    }
    // Plots never shrink in normal play; a co-op island swap rebuilds everything instead.
    for (const [id, b] of Object.entries(next.buildings)) {
      const prev = buildingObjs[id];
      const changed = !prev || prev.level !== b.level || (b.x !== null && (prev.x !== b.x || prev.z !== b.z || prev.rot !== b.rot));
      if (changed && id !== skipBuild) await placeBuilding(id, b, animate);
    }
    for (const id of Object.keys(buildingObjs)) {
      if (!next.buildings[id]) { buildingObjs[id].obj?.removeFromParent(); delete buildingObjs[id]; }
    }
    const count = 1 + next.piers.length;
    if (count !== pierCount) {
      const from = pierCount > 0 && animate ? pierCount - 1 : null;
      pierCount = count;
      await buildPier(count, from);
    }
    await placeBoat(next.boat);
    layoutDependentRefresh();
  }

  events.on('island:changed', (payload = {}) => {
    if (payload.source === 'net') netPayload = payload;
    else if (state.net?.role === 'visitor') return; // a visitor shows the host's island only
    const src = islandSource(state, netPayload) || payload;
    applyOwned(normalizeIsland(src, state.data), { animate: true, skipBuild: payload.placedId || null });
  });

  // --- gameplay queries -------------------------------------------------------------------
  function deckAt(x, z) {
    for (const d of decks) {
      const rx = x - d.x0, rz = z - d.z0;
      const along = rx * d.ux + rz * d.uz;
      const across = -rx * d.uz + rz * d.ux;
      if (along >= -0.15 && along <= d.len + 0.05 && Math.abs(across) <= d.width / 2 - 0.12) return d;
    }
    return null;
  }

  function groundAt(x, z) {
    const h = terrain.heightAt(x, z);
    const d = deckAt(x, z);
    return d ? Math.max(h, d.height) : h;
  }

  function blockedByCollider(x, z) {
    for (const c of colliders) {
      if (c.type === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return c;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return c;
    }
    return null;
  }

  // ground the player could stand on, ignoring colliders (for walking out of something that spawned around them)
  function terrainOk(x, z) {
    if (deckAt(x, z)) return true;
    return terrain.heightAt(x, z) >= -WADE_DEPTH && terrain.slopeAt(x, z) <= MAX_SLOPE;
  }

  function isWalkable(x, z) {
    if (deckAt(x, z)) return !blockedByCollider(x, z);
    const h = terrain.heightAt(x, z);
    if (h < -WADE_DEPTH) return false;
    if (terrain.slopeAt(x, z) > MAX_SLOPE) return false;
    return !blockedByCollider(x, z);
  }

  // Move with sliding: full step, else the closest direction within ±75° (so the player
  // glides along walls and round rocks instead of stopping dead).
  function resolveMove(from, dx, dz) {
    const tx = from.x + dx, tz = from.z + dz;
    if (isWalkable(tx, tz)) return { x: tx, z: tz, blocked: false };
    // Never trap the player: if a building appeared around them (bought or upgraded while standing
    // at it, Casper: "players get caught inside the shop"), any step that leads outward is allowed.
    const inside = blockedByCollider(from.x, from.z);
    if (inside && terrainOk(tx, tz)) {
      const before = (from.x - inside.x) ** 2 + (from.z - inside.z) ** 2;
      const after = (tx - inside.x) ** 2 + (tz - inside.z) ** 2;
      if (after > before) return { x: tx, z: tz, blocked: false };
    }
    const len = Math.hypot(dx, dz);
    const a0 = Math.atan2(dx, dz);
    for (const off of [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.3, -1.3]) {
      const a = a0 + off;
      const k = Math.cos(off);
      const nx = from.x + Math.sin(a) * len * k, nz = from.z + Math.cos(a) * len * k;
      if (isWalkable(nx, nz)) return { x: nx, z: nz, blocked: true };
    }
    return { x: from.x, z: from.z, blocked: true };
  }

  // Debug: why a point is not walkable (walk test, ?debug=colliders).
  function whyBlocked(x, z) {
    const c = blockedByCollider(x, z);
    if (c) return `collider:${c.source}`;
    if (deckAt(x, z)) return null;
    if (terrain.heightAt(x, z) < -WADE_DEPTH) return 'water';
    if (terrain.slopeAt(x, z) > MAX_SLOPE) return 'slope';
    return null;
  }

  function waterDepthAt(x, z) {
    return Math.max(0, -terrain.heightAt(x, z));
  }

  function updateZones(pos) {
    let best = null;
    let bestD = Infinity;
    for (const z of zones) {
      const d = Math.hypot(pos.x - z.x, pos.z - z.z);
      const inside = activeZones.has(z.id) ? d < z.r + 0.4 : d < z.r;
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
    for (const id of [...activeZones]) {
      if (!zones.some((z) => z.id === id)) { activeZones.delete(id); events.emit('zone:exit', { zoneId: id, kind: 'building' }); }
    }
    if (best !== currentZone) {
      currentZone = best;
      state.world.zone = best;
    }
  }

  function update(dt, time) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    for (const obj of propsGroup.children) {
      const s = obj.userData.sway;
      if (!s) continue;
      obj.rotation.x = Math.sin(time * 0.9 + s.phase) * s.amount;
      obj.rotation.z = Math.cos(time * 0.7 + s.phase * 1.3) * s.amount * 0.7;
    }
    for (const obj of groups.boat.children) {
      const b = obj.userData.boat;
      if (!b) continue;
      obj.position.y = b.baseY + Math.sin(time * 1.1 + b.phase) * 0.05;
      obj.rotation.z = Math.sin(time * 0.8 + b.phase) * 0.03;
    }
  }

  // Build spots on owned land that no building uses (placement mode).
  function freeSpots(ignoreId = null) {
    const spots = [];
    for (const id of owned.plots) {
      for (const s of layout.plots[id]?.spots || []) {
        const taken = Object.entries(buildingObjs).some(([bid, b]) => bid !== ignoreId && b.obj && Math.hypot(b.x - s.x, b.z - s.z) < 2.5);
        if (!taken) spots.push({ ...s, plot: id });
      }
    }
    return spots;
  }

  return {
    group,
    terrain,
    layout,
    build,
    placeProps: build,
    applyOwned,
    groundAt,
    onDeck: (x, z) => Boolean(deckAt(x, z)),
    isWalkable,
    blockedByCollider,
    whyBlocked,
    resolveMove,
    waterDepthAt,
    updateZones,
    update,
    updateSway: () => {},
    addProp,
    rebuildColliders,
    freeSpots,
    construct,
    placeBuilding,
    registerGroup(g) { if (!extraGroups.includes(g)) extraGroups.push(g); },
    deckAt,
    get owned() { return owned; },
    get decks() { return decks; },
    get colliders() { return colliders; },
    get zones() { return zones; },
    get props() { return propsGroup; },
    get buildings() { return buildingObjs; },
    get hasKelpModel() { return hasKelpModel; },
    get rising() { return rising; },
    pierFrame: () => (decks[0] || null),
    zone(id) { return zones.find((z) => z.id === id) || null; },
  };
}
