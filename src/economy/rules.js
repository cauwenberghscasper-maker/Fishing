// Agent B. Pure economy rules: no state mutation, no DOM. Numbers come from public/data/*.json.
// Agent A may import sizeClassFor / rollWeight / rollVariant to stay consistent with the shop.

export const SLOTS = [
  { slot: 'rod', group: 'rods', label: 'Rod' },
  { slot: 'reel', group: 'reels', label: 'Reel' },
  { slot: 'line', group: 'lines', label: 'Line' },
  { slot: 'bait', group: 'baits', label: 'Bait', stack: true },
  { slot: 'hook', group: 'hooks', label: 'Hook' },
  { slot: 'sinker', group: 'sinkers', label: 'Sinker' },
  { slot: 'float', group: 'floats', label: 'Float' },
  { slot: 'leader', group: 'leaders', label: 'Leader', optional: true },
  { slot: 'lure', group: 'lures', label: 'Lure', optional: true, stack: true },
  { slot: 'tool', group: 'tools', label: 'Tool', tool: true },   // tools are owned, never equipped, always active
];
export const groupOf = (slot) => SLOTS.find((s) => s.slot === slot)?.group;
export const slotInfo = (slot) => SLOTS.find((s) => s.slot === slot);
export const EQUIP_SLOTS = SLOTS.filter((s) => !s.tool).map((s) => s.slot);

export const BUILDINGS = ['shop', 'cooler', 'workers_hut', 'smokehouse', 'aquarium', 'boat_dock', 'net_rig', 'reel_mill', 'cannery'];
/** Idle machines: each level earns coinsPerHour on its own; the cannery also multiplies what the crew, nets and machines bring in. */
export const MACHINES = ['net_rig', 'reel_mill', 'cannery'];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const entries = (obj) => Object.entries(obj ?? {}).filter(([k]) => !k.startsWith('_'));

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

// ---------------------------------------------------------------- variants
export const variantIds = (data) => entries(data.variants).map(([id]) => id);

export function variantOf(data, id) {
  const v = data.variants?.[id];
  return v && !String(id).startsWith('_') ? { id, ...v } : { id: 'basic', kind: 'basic', name: '', valueMult: 1, pearls: 0, lore: '' };
}

/** Roll weights for the variants on an island in a weather (normalised to 1). */
export function variantOdds(data, islandId, weather) {
  const list = entries(data.variants).map(([id, v]) => {
    const w = (v.chance ?? 0) * (v.islandBoost?.[islandId] ?? 1) * (weather ? v.weatherBoost?.[weather] ?? 1 : 1);
    return [id, w];
  });
  const total = list.reduce((a, [, w]) => a + w, 0) || 1;
  return Object.fromEntries(list.map(([id, w]) => [id, w / total]));
}

/** Roll a variant when a fish spawns (Agent A). */
export function rollVariant(data, islandId = 'driftwood_cove', weather = null, rng = Math.random) {
  const odds = variantOdds(data, islandId, weather);
  let r = rng();
  for (const [id, p] of Object.entries(odds)) {
    r -= p;
    if (r <= 0) return id;
  }
  return 'basic';
}

/** "Ember Driftback", "The Gilded Old Mooring". */
export function fullName(fishName, variant) {
  const vn = variant?.name;
  if (!vn) return fishName;
  return fishName.startsWith('The ') ? `The ${vn} ${fishName.slice(4)}` : `${vn} ${fishName}`;
}

/** Variant sets for the logbook: [{ id, name, ids, have, done }] */
export function variantSets(data, dexEntry) {
  const all = variantIds(data);
  return entries(data.economy?.variantSets).map(([id, s]) => {
    const ids = s.ids === 'all' ? all : s.ids;
    const caught = dexEntry?.variants ?? {};
    const have = ids.filter((v) => caught[v] > 0).length;
    return { id, name: s.name, ids, have, total: ids.length, done: have >= ids.length, coinsPerBase: s.coinsPerBase, pearls: s.pearls };
  });
}

// ---------------------------------------------------------------- buildings, land, piers, boats
export function buildingLevel(data, profile, id) {
  const def = data.economy?.buildings?.[id];
  if (!def) return null;
  const raw = profile.island?.buildings?.[id];
  const lvl = typeof raw === 'object' && raw ? raw.level : raw;
  const i = Math.min(Math.max(0, Number.isFinite(lvl) ? lvl : 0), def.levels.length - 1);
  const built = i > 0 || def.levels[0]?.name !== 'Not built';
  const where = typeof raw === 'object' && raw ? { x: raw.x ?? null, z: raw.z ?? null, rot: raw.rot ?? 0 } : { x: null, z: null, rot: 0 };
  return { index: i, level: i, ...def.levels[i], built, next: def.levels[i + 1] ?? null, def, siteOwned: (profile.island?.plots ?? []).includes(def.site ?? 'sandbar'), ...where };
}

export const coolerCapacity = (data, profile) => buildingLevel(data, profile, 'cooler')?.capacity ?? 8;
export const shopBonus = (data, profile) => buildingLevel(data, profile, 'shop')?.sellBonus ?? 0;

export function crewBunks(data, profile) {
  return buildingLevel(data, profile, 'workers_hut')?.slots ?? 0;
}
export function crewSpots(data, profile) {
  const e = data.economy ?? {};
  const plots = (profile.island?.plots ?? []).reduce((n, id) => n + (e.plots?.[id]?.crewSpots ?? 0), 0);
  const piers = (profile.island?.piers ?? []).reduce((n, id) => n + (e.piers?.[id]?.crewSpots ?? 0), 0);
  return (e.workers?.baseSpots ?? 1) + plots + piers;
}
/** A fisher needs a bunk and a spot to fish from. */
export function crewSlots(data, profile) {
  return Math.min(crewBunks(data, profile), crewSpots(data, profile));
}

export function hireCost(data, profile) {
  const w = data.economy?.workers ?? { hireCost: 80, costGrowth: 1.8 };
  return Math.round(w.hireCost * Math.pow(w.costGrowth, profile.workers?.length ?? 0));
}

export function netCount(data, profile) {
  return (profile.island?.plots ?? []).reduce((n, id) => n + (data.economy?.plots?.[id]?.nets ?? 0), 0);
}

const byOrder = (obj) => entries(obj).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

export function nextPlot(data, profile) {
  const owned = profile.island?.plots ?? [];
  return byOrder(data.economy?.plots).find(([id]) => !owned.includes(id))?.[0] ?? null;
}

/** Next pier in order, and whether its plot is owned. */
export function nextPier(data, profile) {
  const owned = profile.island?.piers ?? [];
  const found = byOrder(data.economy?.piers).find(([id]) => !owned.includes(id));
  if (!found) return null;
  const [id, def] = found;
  return { id, ...def, plotOwned: (profile.island?.plots ?? []).includes(def.plot ?? 'sandbar') };
}

/** Deepest water the piers reach (metres). The sandbar stub reaches about 3 m. */
export function pierDepth(data, profile) {
  return (profile.island?.piers ?? []).reduce((d, id) => Math.max(d, data.economy?.piers?.[id]?.depth ?? 0), 3);
}

export function boatOf(data, profile) {
  const id = profile.island?.boat ?? 'rowboat';
  const def = data.economy?.boats?.[id];
  return def ? { id, ...def } : { id: 'rowboat', name: 'Rowboat', tier: 1, reach: 1 };
}

/** Next boat in tier order, and whether the dock fits it. */
export function nextBoat(data, profile) {
  const cur = boatOf(data, profile);
  const found = entries(data.economy?.boats).sort((a, b) => a[1].tier - b[1].tier).find(([, b]) => b.tier > cur.tier);
  if (!found) return null;
  const [id, def] = found;
  const maxBoat = buildingLevel(data, profile, 'boat_dock')?.maxBoat ?? 1;
  return { id, ...def, dockFits: def.tier <= maxBoat };
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

/** Sell price of one catch: base x weight factor x size class x variant x market x shop. */
export function priceOf(data, profile, test, c, extra = 0, hotId) {
  const fish = data.fish?.[c.fishId];
  if (!fish) return 0;
  const e = data.economy ?? {};
  const t = weightT(fish, c.weight);
  const wf = e.sell?.weightFactor ?? { atMin: 0.8, atMax: 1.2 };
  const weightFactor = wf.atMin + (wf.atMax - wf.atMin) * t;
  const size = sizeClassById(data, c.sizeClass) ?? sizeClassFor(data, c.fishId, c.weight);
  const variant = variantOf(data, c.variant ?? 'basic');
  const market = marketMult(data, profile, c.fishId, extra, hotId === undefined ? hotFishOf(data, profile) : hotId);
  const raw = fish.baseValue * (e.sell?.globalMult ?? 1) * (e.sell?.seasonMult ?? 1) * weightFactor * size.mult * (variant.valueMult ?? 1) * (c.bonus ?? 1) * market * (1 + shopBonus(data, profile));
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
  const rod = itemOf(data, 'rod', g.rod);
  const reel = itemOf(data, 'reel', g.reel);
  const line = itemOf(data, 'line', g.line);
  const bait = itemOf(data, 'bait', g.bait);
  const hook = itemOf(data, 'hook', g.hook);
  const sinker = itemOf(data, 'sinker', g.sinker);
  const float = itemOf(data, 'float', g.float);
  const leader = itemOf(data, 'leader', g.leader);
  const lure = itemOf(data, 'lure', g.lure);
  const tools = new Set(profile.owned?.tools ?? []);
  const cond = profile.condition ?? {};
  const lineWear = cond.lineWear ?? 0;
  return {
    // 4.7b tackle (Agent A reads these)
    hookId: g.hook ?? null, sinkerId: g.sinker ?? null, floatId: g.float ?? null, leaderId: g.leader ?? null, lureId: g.lure ?? null,
    rating: rod?.stats?.rating ?? 3,
    rodBroken: !!cond.rodBroken?.[g.rod],
    strength: Math.round((line?.stats?.strength ?? 2.5) * (1 - 0.5 * lineWear) * 100) / 100,
    lineWear,
    hookHold: hook?.stats?.hookHold ?? 1,
    depthReach: sinker?.stats?.depthReach ?? 3,
    biteWindow: (hook?.stats?.biteWindow ?? 1) * (float?.stats?.biteWindow ?? 1),
    leader: leader?.stats?.leader ?? 0,
    lure: lure?.stats?.lure ?? 0,
    lureTargets: lure?.targets ?? [],
    baitLeft: bait?.unlimited ? Infinity : profile.stacks?.[g.bait] ?? 0,
    lureLeft: g.lure ? profile.stacks?.[g.lure] ?? 0 : 0,
    net: tools.has('landing_net'), gaff: tools.has('gaff'), glasses: tools.has('polarized_glasses'),
    tackleBox: tools.has('tackle_box'), baitBucket: tools.has('bait_bucket'),
    rodId: g.rod, reelId: g.reel, lineId: g.line, baitId: g.bait,
    rodModel: rod?.model ?? null, reelModel: reel?.model ?? null, baitModel: bait?.model ?? null,
    lineMaterial: line?.material ?? null,
    rodPower: rod?.stats?.rodPower ?? 1,
    castDistance: rod?.stats?.castDistance ?? 14,
    steadiness: rod?.stats?.steadiness ?? 0.3,
    reelSpeed: reel?.stats?.reelSpeed ?? 1,
    lineStrength: line?.stats?.lineStrength ?? 1,
    baitAttraction: bait?.stats?.attraction ?? 1,
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
  // Idle upgrade ladders (economy.json crewTraining): each tier multiplies crew / net income.
  const T = data.economy?.crewTraining ?? {};
  const trainMult = 1 + (profile.training ?? 0) * (T.training?.bonusPerTier ?? 0);
  const netMult = 1 + (profile.netting ?? 0) * (T.netting?.bonusPerTier ?? 0);
  const crew = fishPerSecond * crewCatchValue(data) * (1 + (smoke?.crewBonus ?? 0)) * mult * trainMult;
  const nets = netCount(data, profile) * ((data.economy?.nets?.coinsPerHour ?? 60) / 3600) * mult * netMult;
  const species = Object.keys(profile.fishdex ?? {}).length;
  const aquarium = species * ((aqua?.coinsPerSpeciesHour ?? 0) / 3600) * mult;
  const factory = 1 + (buildingLevel(data, profile, 'cannery')?.factoryBonus ?? 0);
  let machines = 0;
  for (const id of MACHINES) machines += (buildingLevel(data, profile, id)?.coinsPerHour ?? 0) / 3600;
  machines *= mult * factory;
  const crewF = crew * factory, netsF = nets * factory;
  return { crew: crewF, nets: netsF, aquarium, machines, total: crewF + netsF + aquarium + machines, fishPerSecond };
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
    machines: Math.floor(r.machines * s),
    crewFish: Math.floor(r.fishPerSecond * s),
    get total() { return this.crew + this.nets + this.aquarium + this.machines; },
  };
}

// ---------------------------------------------------------------- islands
export function islandRequirements(data, profile, islandId) {
  const isle = data.islands?.[islandId];
  if (!isle) return null;
  const u = isle.unlock ?? {};
  const species = Object.keys(profile.fishdex ?? {}).length;
  const boat = boatOf(data, profile);
  const reqs = [];
  if (u.coins) reqs.push({ kind: 'coins', need: u.coins, have: profile.coins, met: profile.coins >= u.coins });
  if (u.species) reqs.push({ kind: 'species', need: u.species, have: species, met: species >= u.species });
  if (u.legendary) {
    const have = !!profile.fishdex?.[u.legendary];
    reqs.push({ kind: 'legendary', fishId: u.legendary, have, met: have });
  }
  reqs.push({ kind: 'boat', need: isle.index, have: boat.reach, met: boat.reach >= isle.index });
  return reqs;
}
