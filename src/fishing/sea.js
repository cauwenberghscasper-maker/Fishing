// The open sea round the island (Casper 9 Nov: "a 360° playground", "dynamically finding fish").
// Hot spots appear in the water within reach of your rod, all the way round the island, last a
// while and move on:
//   frenzy  — a feeding school churning the surface: splashes, leaping fish, quick bites
//   glimmer — elemental fish glowing their element's colour through the water (worth ×5 and up)
//   giant   — one big rare fish cruising with a heavy wake
// Every hot spot is real fish in real water (fishAgents spawnAt); the HUD points to it from the
// screen edge. Tuning in public/data/sea.json. Host/solo only (fish authority).
import { fishInfo, rosterFor, TIER_RANK, timeAllows } from './fishData.js';
import { variantTable } from './variants.js';
import { islandElement } from './surge.js';

const DEFAULTS = {
  maxActive: 3, firstAfter: [4, 8], every: [14, 26],
  kinds: {
    frenzy: { weight: 5, label: 'Feeding frenzy', color: '#f4e3b0', dur: [55, 80], minDepth: 3, schools: [1, 2], extra: [2, 3] },
    glimmer: { weight: 3, label: 'Glimmer', color: '#7fe8ff', dur: [45, 70], minDepth: 5, count: [1, 3], homeElement: 0.6 },
    giant: { weight: 2, label: 'Giant', color: '#ff9a6a', dur: [60, 90], minDepth: 7, minRank: 2 },
  },
  reach: { beyondShore: [6, 0.85] },
};

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function createSea({ state, events, fishSystem, island, water, splashes, lighting, hooks }) {
  const d = state.data?.sea || {};
  const cfg = { ...DEFAULTS, ...d, kinds: { ...DEFAULTS.kinds, ...d.kinds }, reach: { ...DEFAULTS.reach, ...d.reach } };
  const spots = [];
  let nextIn = rand(cfg.firstAfter[0], cfg.firstAfter[1]);
  let uid = 0;

  function species(filter) {
    const hour = lighting.hour;
    return rosterFor(state, state.world.islandId).filter((id) => {
      const info = fishInfo(state, id);
      return info.behaviour && timeAllows(info.time, hour) && filter(info, id);
    });
  }

  // A point within reach: walk out from the island centre along a bearing to the last shore, then
  // out past it by up to ~85% of the rod's cast distance.
  function placeSpot(minDepth) {
    const reach = Math.max(12, state.gear?.castDistance || 14);
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const sx = Math.sin(a), sz = Math.cos(a);
      let shore = 0;
      for (let r = 0; r < 80; r += 1) if (island.waterDepthAt(sx * r, sz * r) < 0.5) shore = r;
      const r = shore + rand(cfg.reach.beyondShore[0], Math.max(cfg.reach.beyondShore[0] + 2, reach * cfg.reach.beyondShore[1]));
      const x = sx * r, z = sz * r;
      if (island.waterDepthAt(x, z) < minDepth) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 14)) continue;
      return { x, z };
    }
    return null;
  }

  function chooseKind() {
    const list = Object.entries(cfg.kinds);
    let r = Math.random() * list.reduce((s, [, k]) => s + (k.weight || 0), 0);
    for (const [id, k] of list) { r -= k.weight || 0; if (r <= 0) return id; }
    return list[0][0];
  }

  function elementVariant(k) {
    const table = variantTable(state);
    const elements = Object.keys(table).filter((id) => table[id]?.kind === 'element');
    if (!elements.length) return null;
    return Math.random() < (k.homeElement ?? 0.6) ? islandElement(state, state.world.islandId) : pick(elements);
  }

  function open(kindId) {
    const k = cfg.kinds[kindId];
    const at = placeSpot(k.minDepth || 3);
    if (!at) return null;
    const s = { id: ++uid, kind: kindId, label: k.label, color: k.color, x: at.x, z: at.z, t: 0, dur: rand(k.dur[0], k.dur[1]), fish: [], fx: 0 };
    const tag = (f) => { if (f) { f.hotspot = s.id; s.fish.push(f); } return f; };
    if (kindId === 'frenzy') {
      const schooling = species((info) => Boolean(info.behaviour.school) && (TIER_RANK[info.tier] ?? 0) <= 1);
      const any = species((info) => !info.behaviour.school && (TIER_RANK[info.tier] ?? 0) <= 2 && info.tier !== 'big');
      for (let i = 0; i < randInt(k.schools[0], k.schools[1]) && schooling.length; i++) {
        const leader = fishSystem.spawnAt(pick(schooling), s.x + rand(-2, 2), s.z + rand(-2, 2), { school: true, r: 4 });
        if (leader?.school) for (const m of leader.school.members) tag(m);
      }
      for (let i = 0; i < randInt(k.extra[0], k.extra[1]) && any.length; i++) tag(fishSystem.spawnAt(pick(any), s.x + rand(-3, 3), s.z + rand(-3, 3), { r: 5 }));
    } else if (kindId === 'glimmer') {
      const pool = species((info) => !info.behaviour.school && info.tier !== 'big' && info.tier !== 'boss');
      for (let i = 0; i < randInt(k.count[0], k.count[1]) && pool.length; i++) {
        tag(fishSystem.spawnAt(pick(pool), s.x + rand(-3, 3), s.z + rand(-3, 3), { variant: elementVariant(k), r: 5 }));
      }
    } else if (kindId === 'giant') {
      const pool = species((info) => (TIER_RANK[info.tier] ?? 0) >= (k.minRank ?? 2) && info.tier !== 'boss');
      if (pool.length) tag(fishSystem.spawnAt(pick(pool), s.x, s.z, { r: 6 }));
    }
    if (!s.fish.length) return null;
    spots.push(s);
    hooks.announce(s);
    events.emit('sea:hotspot', { id: s.id, kind: s.kind, x: s.x, z: s.z });
    return s;
  }

  function close(s) {
    // The hot spot moves on: its fish become ordinary fish of the sea (the recycler thins them out).
    for (const f of s.fish) if (f.hotspot === s.id) f.hotspot = null;
    spots.splice(spots.indexOf(s), 1);
    events.emit('sea:hotspot-end', { id: s.id });
  }

  // Life on the water so you can spot it from afar.
  function effects(s, dt) {
    s.fx -= dt;
    const live = s.fish.filter((f) => !f.gone && f.hotspot === s.id);
    if (s.fx > 0) return;
    if (s.kind === 'frenzy') {
      s.fx = 0.12;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3;
      splashes.splash(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r, rand(0.25, 0.6));
      if (Math.random() < 0.3) water.addRipple(s.x + rand(-2, 2), s.z + rand(-2, 2), 0.5);
    } else if (s.kind === 'glimmer') {
      s.fx = 0.35;
      const f = pick(live);
      if (f) { water.addRipple(f.pos.x, f.pos.z, 0.35); if (Math.random() < 0.4) splashes.splash(f.pos.x, f.pos.z, 0.25); }
    } else if (s.kind === 'giant') {
      s.fx = 0.9;
      const f = live[0];
      if (f) { water.addRipple(f.pos.x, f.pos.z, 1.1); water.addRipple(f.pos.x - Math.sin(f.heading) * 1.5, f.pos.z - Math.cos(f.heading) * 1.5, 0.7, 0.2); }
    }
  }

  function update(dt) {
    if (fishSystem.authority === false) return;
    for (const s of [...spots]) {
      s.t += dt;
      // Follow its fish: a hot spot is where its fish are.
      const live = s.fish.filter((f) => !f.gone && f.hotspot === s.id);
      if (live.length) {
        s.x += (live.reduce((a, f) => a + f.pos.x, 0) / live.length - s.x) * Math.min(1, dt * 0.5);
        s.z += (live.reduce((a, f) => a + f.pos.z, 0) / live.length - s.z) * Math.min(1, dt * 0.5);
      }
      if (s.t > s.dur || !live.length) { close(s); continue; }
      effects(s, dt);
    }
    nextIn -= dt;
    if (nextIn <= 0) {
      nextIn = rand(cfg.every[0], cfg.every[1]);
      if (spots.length < cfg.maxActive) open(chooseKind());
    }
  }

  return {
    update,
    get spots() { return spots; },
    /** Debug: open a hot spot of a kind now. */
    force(kind = 'frenzy') { return open(cfg.kinds[kind] ? kind : 'frenzy'); },
  };
}
