// Agent B. Versioned player profile in localStorage. Players must never lose progress:
// - every load runs the migration list, then sanitizeProfile (fills gaps, repairs bad values)
// - an unreadable save is copied to a backup key before starting fresh
// - autosave on profile:changed (debounced), on visibilitychange/pagehide, and every 15 s
import { BUILDINGS, deriveGear } from '../economy/rules.js';

export const PROFILE_VERSION = 2;
export const SAVE_KEY = 'fishing-v1';
export const TEST_SAVE_KEY = 'fishing-test-v1';

// Fish ids retired in the 6 Nov redesign (master prompt 5.2) → their replacements.
const RETIRED_FISH = {
  sunscale_sardine: 'glasswing_sardine',
  driftwood_perch: 'driftback',
  chartfish: 'compass_flounder',
  tidepool_goby: 'shellback_blenny',
  kelp_ribbon: 'kelp_wraith',
  bellbuoy_bass: 'old_mooring',
};

/** Ordered migrations. Each takes a profile at version `to - 1` and returns it at version `to`. Never remove one. */
export const MIGRATIONS = [
  {
    to: 1,
    // v0: anything saved before versioning (or the M0 stub). Only shape fixes; sanitize fills the rest.
    up: (p) => ({ ...p, version: 1 }),
  },
  {
    to: 2,
    // v2: rename retired fish ids in the cooler and the logbook, merging logbook records.
    up: (p) => {
      const rename = (id) => RETIRED_FISH[id] ?? id;
      const cooler = Array.isArray(p.cooler) ? p.cooler.map((c) => ({ ...c, fishId: rename(c?.fishId) })) : p.cooler;
      const fishdex = {};
      for (const [id, rec] of Object.entries(p.fishdex ?? {})) {
        const to = rename(id);
        const prev = fishdex[to];
        fishdex[to] = prev
          ? { ...prev, count: (prev.count ?? 0) + (rec?.count ?? 0), heaviest: Math.max(prev.heaviest ?? 0, rec?.heaviest ?? 0) }
          : rec;
      }
      return { ...p, cooler, fishdex, version: 2 };
    },
  },
];

const num = (v, fallback = 0, min = 0) => (Number.isFinite(v) && v >= min ? v : fallback);
const int = (v, fallback = 0, min = 0) => Math.floor(num(v, fallback, min));
const strArr = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);

export function newProfile(data, test = false) {
  const start = data.economy?.start ?? {};
  const now = Date.now();
  const gear = { rod: 'splitcane', reel: 'click_reel', line: 'cotton_line', bait: 'breadcrust', ...start.gear };
  return {
    version: PROFILE_VERSION,
    createdAt: now,
    lastSeen: now,
    coins: test && data.economy?.test?.startCoins ? data.economy.test.startCoins : start.coins ?? 15,
    pearls: start.pearls ?? 0,
    gear,
    owned: { rods: [gear.rod], reels: [gear.reel], lines: [gear.line], baits: [gear.bait] },
    cooler: [],
    held: null,
    catchSeq: 0,
    fishdex: {},
    island: { plots: [], buildings: Object.fromEntries(BUILDINGS.map((b) => [b, 0])) },
    workers: [],
    unlockedIslands: ['driftwood_cove'],
    currentIsland: 'driftwood_cove',
    watch: 0,
    market: { saturation: {}, at: now },
    idle: { carry: 0 },
    pendingOffline: null,
    stats: { caught: 0, sold: 0, earned: 0, lost: 0 },
    settings: { sound: true, quality: 'auto' },
  };
}

function cleanCatch(c) {
  if (!c || typeof c !== 'object' || typeof c.fishId !== 'string') return null;
  return {
    id: typeof c.id === 'string' ? c.id : `c${Math.random().toString(36).slice(2, 9)}`,
    fishId: c.fishId,
    weight: num(c.weight, 0),
    sizeClass: typeof c.sizeClass === 'string' ? c.sizeClass : 'normal',
    islandId: typeof c.islandId === 'string' ? c.islandId : 'driftwood_cove',
    perfect: !!c.perfect,
    at: num(c.at, Date.now()),
  };
}

/** Repair any profile into a valid current one. Unknown fish/items are kept where harmless, never crash the game. */
export function sanitizeProfile(raw, data, test = false) {
  const base = newProfile(data, test);
  const p = raw && typeof raw === 'object' ? raw : {};
  const items = data.items ?? {};
  const out = { ...base };

  out.version = PROFILE_VERSION;
  out.createdAt = num(p.createdAt, base.createdAt);
  out.lastSeen = Math.min(num(p.lastSeen, base.lastSeen), Date.now());
  out.coins = int(p.coins, base.coins);
  out.pearls = int(p.pearls, base.pearls);
  out.catchSeq = int(p.catchSeq, 0);

  // owned gear: keep starters, drop ids no longer in items.json
  out.owned = {};
  for (const group of ['rods', 'reels', 'lines', 'baits']) {
    const known = Object.keys(items[group] ?? {});
    const owned = strArr(p.owned?.[group]).filter((id) => !known.length || known.includes(id));
    const starters = known.filter((id) => (items[group][id]?.cost ?? 1) === 0);
    out.owned[group] = [...new Set([...starters, ...base.owned[group].filter((id) => !known.length || known.includes(id)), ...owned])];
  }
  out.gear = { ...base.gear };
  for (const [slot, group] of [['rod', 'rods'], ['reel', 'reels'], ['line', 'lines'], ['bait', 'baits']]) {
    const id = p.gear?.[slot];
    out.gear[slot] = typeof id === 'string' && out.owned[group].includes(id) ? id : out.owned[group][0] ?? base.gear[slot];
  }

  out.cooler = (Array.isArray(p.cooler) ? p.cooler : []).map(cleanCatch).filter(Boolean);
  out.held = cleanCatch(p.held);

  out.fishdex = {};
  for (const [id, r] of Object.entries(p.fishdex && typeof p.fishdex === 'object' ? p.fishdex : {})) {
    if (!r || typeof r !== 'object') continue;
    out.fishdex[id] = {
      count: int(r.count, 1, 0),
      heaviest: num(r.heaviest, 0),
      heaviestSize: typeof r.heaviestSize === 'string' ? r.heaviestSize : 'normal',
      first: num(r.first, Date.now()),
    };
  }

  const econ = data.economy ?? {};
  out.island = { plots: [], buildings: { ...base.island.buildings } };
  const plotIds = Object.keys(econ.plots ?? {});
  out.island.plots = strArr(p.island?.plots).filter((id) => !plotIds.length || plotIds.includes(id));
  for (const b of BUILDINGS) {
    const max = (econ.buildings?.[b]?.levels?.length ?? 1) - 1;
    out.island.buildings[b] = Math.min(int(p.island?.buildings?.[b], 0), Math.max(0, max));
  }

  out.workers = (Array.isArray(p.workers) ? p.workers : [])
    .filter((w) => w && typeof w === 'object')
    .map((w, i) => ({ id: typeof w.id === 'string' ? w.id : `w${i + 1}`, name: typeof w.name === 'string' ? w.name : 'Deckhand', hiredAt: num(w.hiredAt, Date.now()) }));

  const islandIds = Object.keys(data.islands ?? {});
  out.unlockedIslands = [...new Set(['driftwood_cove', ...strArr(p.unlockedIslands).filter((id) => !islandIds.length || islandIds.includes(id))])];
  out.currentIsland = out.unlockedIslands.includes(p.currentIsland) ? p.currentIsland : 'driftwood_cove';
  out.watch = Math.min(int(p.watch, 0), econ.offline?.watch?.length ?? 0);

  out.market = {
    saturation: Object.fromEntries(Object.entries(p.market?.saturation ?? {}).filter(([, v]) => Number.isFinite(v) && v > 0)),
    at: num(p.market?.at, Date.now()),
  };
  out.idle = { carry: num(p.idle?.carry, 0) % 1 };
  const po = p.pendingOffline;
  out.pendingOffline = po && typeof po === 'object' && num(po.total, 0) > 0
    ? { seconds: num(po.seconds, 0), capped: !!po.capped, crew: int(po.crew), nets: int(po.nets), aquarium: int(po.aquarium), crewFish: int(po.crewFish), total: int(po.total) }
    : null;
  out.stats = {
    caught: int(p.stats?.caught), sold: int(p.stats?.sold), earned: int(p.stats?.earned), lost: int(p.stats?.lost),
  };
  out.settings = {
    sound: p.settings?.sound !== false,
    quality: ['low', 'auto', 'high'].includes(p.settings?.quality) ? p.settings.quality : 'auto',
  };
  return out;
}

export function migrate(raw) {
  let p = raw && typeof raw === 'object' ? { ...raw } : {};
  let v = Number.isInteger(p.version) ? p.version : 0;
  for (const m of MIGRATIONS) {
    if (m.to > v) { p = m.up(p); v = m.to; }
  }
  return p;
}

// ---------------------------------------------------------------- storage
let storageOk = true;
function storage() {
  try { return storageOk ? window.localStorage : null; } catch { storageOk = false; return null; }
}

function keyFor(state) { return state.test ? TEST_SAVE_KEY : SAVE_KEY; }

export function readSave(state) {
  const ls = storage();
  if (!ls) return null;
  const key = keyFor(state);
  const text = ls.getItem(key);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    // keep the broken save so it can be recovered by hand; never overwrite it silently
    try { ls.setItem(`${key}-unreadable-${Date.now()}`, text); } catch { /* full */ }
    console.warn('[save] unreadable save kept as backup', err);
    return null;
  }
}

let saveState = null;
let saveTimer = 0;

export function saveProfile(state = saveState) {
  if (!state?.profile) return false;
  clearTimeout(saveTimer);
  saveTimer = 0;
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(keyFor(state), JSON.stringify(state.profile));
    return true;
  } catch (err) {
    console.warn('[save] could not write', err);
    return false;
  }
}

export function scheduleSave(delay = 500) {
  if (saveTimer) return;
  saveTimer = setTimeout(() => saveProfile(), delay);
}

/** Wipe this save (Settings → Erase). Test and normal saves are separate. */
export function eraseSave(state) {
  const ls = storage();
  clearTimeout(saveTimer);
  saveTimer = 0;
  state.profile = null;
  try { ls?.removeItem(keyFor(state)); } catch { /* ignore */ }
}

export async function loadProfile(state, events) {
  saveState = state;
  const raw = readSave(state);
  const migrated = migrate(raw ?? {});
  state.profile = sanitizeProfile(raw ? migrated : null, state.data, state.test);
  state.gear = deriveGear(state.data, state.profile);
  state.saveInfo = { key: keyFor(state), fresh: !raw, storage: !!storage() };

  if (events) {
    events.on('profile:changed', () => scheduleSave());
    const flush = () => {
      if (!state.profile) return;
      state.profile.lastSeen = Date.now();
      saveProfile(state);
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    setInterval(() => { if (document.visibilityState === 'visible') flush(); }, 15000);
  }
  saveProfile(state);
  return state.profile;
}
