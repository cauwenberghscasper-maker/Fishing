// Fishing grounds (Casper 9 Nov: "special locations for certain fishes that change with time",
// "different places around spawn island with different colours, 3d models, sunken ships,
// colourful coral"). Named places round the island (layout.grounds): each tints the water its own
// colour (water.setTints), has landmark models on its seabed (island props), and keeps its own
// residents in the water, a different set by day, at dusk and at night. Arriving with the lure
// (or the camera) names the place and who lives there right now.
import { fishInfo, timeAllows } from './fishData.js';

const SLOTS = ['day', 'dusk', 'night'];
export function slotFor(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 17.5) return 'day';
  if ((h >= 17.5 && h < 20.5) || (h >= 5 && h < 7)) return 'dusk';
  return 'night';
}

export function createGrounds({ state, island, water, fishSystem, lighting, hooks }) {
  const grounds = (island.layout.grounds || []).map((g) => ({ ...g, fish: [] }));
  let slot = null;
  let check = 0;
  let here = null;
  const seen = new Set();

  // Night and dusk deepen each place's colour a little (the light under the water changes).
  function applyTints() {
    const k = slot === 'night' ? 0.8 : slot === 'dusk' ? 0.95 : 1;
    water.setTints?.(grounds.map((g) => ({ x: g.x, z: g.z, r: g.r * 1.25, color: g.tint, strength: (g.strength ?? 0.5) * k })));
  }

  const residents = (g) => (g.residents?.[slot] || []).filter((id) => {
    const info = fishInfo(state, id);
    return info?.behaviour && timeAllows(info.time ?? 'any', lighting.hour) !== false;
  });

  function keepStocked(g, viewer) {
    g.fish = g.fish.filter((f) => !f.gone && f.ground === g.id && Math.hypot(f.pos.x - g.x, f.pos.z - g.z) < g.r * 2.5);
    if (Math.hypot(viewer.x - g.x, viewer.z - g.z) > 55) return;   // only places near where you look
    const ids = residents(g);
    if (!ids.length) return;
    const want = Math.min(4, 2 + Math.floor(ids.length / 2));
    if (g.fish.length >= want) return;
    // The rarest residents turn up less: pick by tier, commons most.
    const id = ids[Math.floor(Math.random() * ids.length)];
    let at = null;
    for (let i = 0; i < 10 && !at; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * g.r * 0.7;
      const x = g.x + Math.sin(a) * r, z = g.z + Math.cos(a) * r;
      if (island.waterDepthAt(x, z) >= 1.2) at = { x, z };
    }
    if (!at) return;
    const f = fishSystem.spawnAt(id, at.x, at.z, { r: g.r * 0.75 });
    if (f) { f.ground = g.id; f.hotspot = f.hotspot || `ground:${g.id}`; g.fish.push(f); }
  }

  function update(dt, viewer, lure) {
    const s = slotFor(lighting.hour);
    if (s !== slot) {
      slot = s;
      applyTints();
      // Last slot's residents drift off as the light changes.
      for (const g of grounds) for (const f of g.fish) f.hotspot = null;
      for (const g of grounds) g.fish = [];
    }
    check -= dt;
    if (check > 0) return;
    check = 1.2;
    if (fishSystem.authority !== false) for (const g of grounds) keepStocked(g, viewer);
    // Arriving: the lure landing in a ground names it (first visit: with who lives there).
    const p = lure || null;
    const now = p ? grounds.find((g) => Math.hypot(p.x - g.x, p.z - g.z) < g.r) : null;
    if (now && now !== here) {
      const names = residents(now).map((id) => fishInfo(state, id)?.name).filter(Boolean).slice(0, 3);
      hooks.enter?.(now, slot, names, !seen.has(now.id));
      seen.add(now.id);
    }
    here = now || (p ? null : here);
  }

  return {
    update,
    get list() { return grounds; },
    get slot() { return slot; },
    at(x, z) { return grounds.find((g) => Math.hypot(x - g.x, z - g.z) < g.r) || null; },
  };
}
export { SLOTS };
