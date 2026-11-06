// Agent B. Pure economy rules: no state mutation, no DOM. Numbers come from public/data/economy.json.
// Agent A may import sizeClassFor / rollWeight to stay consistent with the shop.

export const SLOTS = [
  { slot: 'rod', group: 'rods', label: 'Rod' },
  { slot: 'reel', group: 'reels', label: 'Reel' },
  { slot: 'line', group: 'lines', label: 'Line' },
  { slot: 'bait', group: 'baits', label: 'Bait' },
];
export const groupOf = (slot) => SLOTS.find((s) => s.slot === slot)?.group;

export const BUILDINGS = ['shop', 'cooler', 'workers_hut', 'smokehouse', 'aquarium', 'boat_dock'];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 0..1 position of a weight inside the fish's weight range. */
export function weightT(fish, weight) {
  if (!fish?.weight) return 0.5;
  const [min, max] = fish.weight;
  return max > min ? clamp01((weight - min) / (max - min)) : 0.5;
}

/** Size class object for a fish + weight. */
export function sizeClassFor(data, fishId, weight) {
  const classes = data.economy?.sizeClasses ?? [];
  const t = weightT(data.fish?.[fishId], weight);
  return classes.find((c) => t < c.below) ?? classes[classes.length - 1] ?? { id: 'normal', name: 'Fair', mult: 1 };
}

export function sizeClassById(data, id) {
  return (data.economy?.sizeClasses ?? []).find((c) => c.id === id) ?? null;
}

/** Suggested weight roll (Agent A may use it): heavier fish are rarer, a perfect cast helps. */
export function rollWeight(data, fishId, perfect = false, rng = Math.random) {
  const fish = data.fish?.[fishId];
  if (!fish) return 1;
  const roll = data.economy?.weightRoll ?? { skew: 1.35, perfectSkew: 1 };
  const t = Math.pow(rng(), perfect ? roll.perfectSkew : roll.skew);
  const [min, max] = fish.weight;
  return Math.round((min + (max - min) * t) * 100) / 100;
}

// ---------------------------------------------------------------- buildings
export function buildingLevel(data, profile, id) {
  const def = data.economy?.buildings?.[id];
  if (!def) return null;
  const i = Math.min(Math.max(0, profile.island?.buildings?.[id] ?? 0), def.levels.length - 1);
  return { index: i, ...def.levels[i], next: def.levels[i + 1] ?? null, def };
}

export const coolerCapacity = (data, profile) => buildingLevel(data, profile, 'cooler')?.capacity ?? 12;
export const shopBonus = (data, profile) => buildingLevel(data, profile, 'shop')?.sellBonus ?? 0;

export function crewSlots(data, profile) {
  const hut = buildingLevel(data, profile, 'workers_hut')?.slots ?? 2;
  const plots = (profile.island?.plots ?? []).reduce((n, id) => n + (data.economy?.plots?.[id]?.crewSpots ?? 0), 0);
  return hut + plots;
}

export function hireCost(data, profile) {
  const w = data.economy?.workers ?? { hireCost: 120, costGrowth: 1.8 };
  return Math.round(w.hireCost * Math.pow(w.costGrowth, profile.workers?.length ?? 0));
}

export function netCount(data, profile) {
  return (profile.island?.plots ?? []).reduce((n, id) => n + (data.economy?.plots?.[id]?.nets ?? 0), 0);
}

// ---------------------------------------------------------------- market
export function dayKey(time = Date.now()) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The fish the buyers want today: same for everyone on the same date, drawn from unlocked islands. */
export function hotFishOf(data, profile, time = Date.now()) {
  const exclude = data.economy?.market?.hotFish?.excludeTiers ?? ['big'];
  const islands = profile.unlockedIslands?.length ? profile.unlockedIslands : ['driftwood_cove'];
  const pool = Object.entries(data.fish ?? {})
    .filter(([, f]) => islands.includes(f.island) && !exclude.includes(f.tier))
    .map(([id]) => id)
    .sort();
  if (!pool.length) return null;
  return pool[hashString(dayKey(time)) % pool.length];
}

/** Market multiplier for one more fish of a species (hot bonus x saturation). extra = fish already queued in this sale. */
export function marketMult(data, profile, fishId, extra = 0, hotId = hotFishOf(data, profile)) {
  const m = data.economy?.market ?? {};
  const hot = hotId === fishId ? m.hotFish?.bonus ?? 1.5 : 1;
  const s = m.saturation ?? { freeUnits: 8, dropPerUnit: 0.02, floor: 0.6 };
  const units = (profile.market?.saturation?.[fishId] ?? 0) + extra;
  const drop = Math.max(0, units - s.freeUnits) * s.dropPerUnit;
  return hot * Math.max(s.floor, 1 - drop);
}

export function testMult(data, test, kind) {
  if (!test) return 1;
  const t = data.economy?.test ?? {};
  return kind === 'idle' ? t.idleMult ?? 100 : t.coinMult ?? 100;
}

/** Sell price of one catch: base x weight factor x size class x market x shop. */
export function priceOf(data, profile, test, c, extra = 0, hotId) {
  const fish = data.fish?.[c.fishId];
  if (!fish) return 0;
  const e = data.economy ?? {};
  const t = weightT(fish, c.weight);
  const wf = e.sell?.weightFactor ?? { atMin: 0.8, atMax: 1.2 };
  const weightFactor = wf.atMin + (wf.atMax - wf.atMin) * t;
  const size = sizeClassById(data, c.sizeClass) ?? sizeClassFor(data, c.fishId, c.weight);
  const market = marketMult(data, profile, c.fishId, extra, hotId === undefined ? hotFishOf(data, profile) : hotId);
  const raw = fish.baseValue * weightFactor * size.mult * market * (1 + shopBonus(data, profile));
  return Math.max(e.sell?.minPrice ?? 1, Math.round(raw)) * testMult(data, test, 'coins');
}

/** Prices for selling a list of catches in order (each sale saturates the market a little more). */
export function batchPrices(data, profile, test, list) {
  const queued = {};
  const hotId = hotFishOf(data, profile);
  return list.map((c) => {
    const p = priceOf(data, profile, test, c, queued[c.fishId] ?? 0, hotId);
    queued[c.fishId] = (queued[c.fishId] ?? 0) + 1;
    return p;
  });
}

// ---------------------------------------------------------------- gear
export function itemOf(data, slot, id) {
  return data.items?.[groupOf(slot)]?.[id] ?? null;
}

/** Derived stats the fishing code reads (state.gear). */
export function deriveGear(data, profile) {
  const g = profile.gear ?? {};
  const rod = itemOf(data, 'rod', g.rod)?.stats ?? {};
  const reel = itemOf(data, 'reel', g.reel)?.stats ?? {};
  const line = itemOf(data, 'line', g.line)?.stats ?? {};
  const bait = itemOf(data, 'bait', g.bait)?.stats ?? {};
  return {
    rodId: g.rod, reelId: g.reel, lineId: g.line, baitId: g.bait,
    rodPower: rod.rodPower ?? 1,
    castDistance: rod.castDistance ?? 14,
    steadiness: rod.steadiness ?? 0.3,
    reelSpeed: reel.reelSpeed ?? 1,
    lineStrength: line.lineStrength ?? 1,
    baitAttraction: bait.attraction ?? 1,
    hearts: data.economy?.start?.hearts ?? 3,
  };
}

// ---------------------------------------------------------------- idle income
/** Average value of one crew catch on the home island, before multipliers. */
export function crewCatchValue(data, islandId = 'driftwood_cove') {
  const w = data.economy?.workers ?? {};
  const tiers = w.pool ?? ['common', 'uncommon'];
  let sum = 0, weight = 0;
  for (const f of Object.values(data.fish ?? {})) {
    if (f.island !== islandId || !tiers.includes(f.tier)) continue;
    const sw = f.spawnWeight ?? 1;
    sum += f.baseValue * sw; weight += sw;
  }
  return weight ? (sum / weight) * (w.valueMult ?? 0.5) : 0;
}

/** Coins per second from each idle source. */
export function incomeRates(data, profile, test) {
  const w = data.economy?.workers ?? { catchSeconds: 90 };
  const hut = buildingLevel(data, profile, 'workers_hut');
  const smoke = buildingLevel(data, profile, 'smokehouse');
  const aqua = buildingLevel(data, profile, 'aquarium');
  const mult = testMult(data, test, 'idle');
  const crewN = profile.workers?.length ?? 0;
  const fishPerSecond = crewN * (hut?.rateMult ?? 1) / (w.catchSeconds ?? 90);
  const crew = fishPerSecond * crewCatchValue(data) * (1 + (smoke?.crewBonus ?? 0)) * mult;
  const nets = netCount(data, profile) * ((data.economy?.nets?.coinsPerHour ?? 60) / 3600) * mult;
  const species = Object.keys(profile.fishdex ?? {}).length;
  const aquarium = species * ((aqua?.coinsPerSpeciesHour ?? 0) / 3600) * mult;
  return { crew, nets, aquarium, total: crew + nets + aquarium, fishPerSecond };
}

export function offlineCapHours(data, profile) {
  const o = data.economy?.offline ?? { capHours: 8, watch: [] };
  const n = profile.watch ?? 0;
  return n > 0 ? o.watch?.[n - 1]?.hours ?? o.capHours : o.capHours;
}

/** What the harbour earned during `seconds` away (capped). */
export function offlineEarnings(data, profile, test, seconds) {
  const capS = offlineCapHours(data, profile) * 3600;
  const s = Math.max(0, Math.min(seconds, capS));
  const r = incomeRates(data, profile, test);
  return {
    seconds: s,
    awaySeconds: seconds,
    capped: seconds > capS,
    crew: Math.floor(r.crew * s),
    nets: Math.floor(r.nets * s),
    aquarium: Math.floor(r.aquarium * s),
    crewFish: Math.floor(r.fishPerSecond * s),
    get total() { return this.crew + this.nets + this.aquarium; },
  };
}

// ---------------------------------------------------------------- islands
export function islandRequirements(data, profile, islandId) {
  const isle = data.islands?.[islandId];
  if (!isle) return null;
  const u = isle.unlock ?? {};
  const species = Object.keys(profile.fishdex ?? {}).length;
  const reach = buildingLevel(data, profile, 'boat_dock')?.reach ?? 2;
  const reqs = [];
  if (u.coins) reqs.push({ kind: 'coins', need: u.coins, have: profile.coins, met: profile.coins >= u.coins });
  if (u.species) reqs.push({ kind: 'species', need: u.species, have: species, met: species >= u.species });
  if (u.legendary) {
    const have = !!profile.fishdex?.[u.legendary];
    reqs.push({ kind: 'legendary', fishId: u.legendary, have, met: have });
  }
  reqs.push({ kind: 'dock', need: isle.index, have: reach, met: reach >= isle.index });
  return reqs;
}
