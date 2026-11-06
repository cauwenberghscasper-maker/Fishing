// Agent B. Shop, market, idle crew, buildings, land, offline earnings, logbook records.
// Coins are earned only. There is no real-money purchase anywhere in the game.
// UI calls the `economy` API; other systems talk through events (docs/INTERFACES.md).
import {
  SLOTS, BUILDINGS, groupOf, itemOf, deriveGear, priceOf, batchPrices, sizeClassFor, sizeClassById,
  coolerCapacity, crewSlots, crewBunks, crewSpots, hireCost, buildingLevel, hotFishOf, incomeRates, offlineEarnings,
  offlineCapHours, islandRequirements, dayKey, testMult, variantOf, variantSets, nextPlot, nextPier, nextBoat, boatOf, pierDepth,
} from './rules.js';

let S = null;   // state
let E = null;   // events
let lastTick = 0;

const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });
// co-op: on a friend's island (state.net.mode 'visitor') the land, piers, buildings, boats and crew are theirs
const visiting = () => S?.net?.mode === 'visitor';
const data = () => S.data;
const P = () => S.profile;

function changed(...keys) {
  E.emit('profile:changed', { keys });
}

function addCoins(delta, { earned = delta > 0 } = {}) {
  if (!delta) return;
  const p = P();
  p.coins = Math.max(0, Math.round(p.coins + delta));
  if (earned && delta > 0) p.stats.earned += delta;
  E.emit('coins:changed', { coins: p.coins, delta });
}

function spend(cost) {
  if (P().coins < cost) return false;
  addCoins(-cost, { earned: false });
  return true;
}

function refreshGear() {
  S.gear = deriveGear(data(), P());
  E.emit('gear:changed', S.gear);
}

function islandChanged(extra = {}) {
  const p = P();
  E.emit('island:changed', {
    plots: [...p.island.plots],
    piers: [...p.island.piers],
    buildings: { ...p.island.buildings },
    boat: p.island.boat,
    workers: p.workers.map((w) => ({ id: w.id, name: w.name })),
    ...extra,
  });
}

// ---------------------------------------------------------------- catches
function recordCatch(c) {
  const p = P();
  let dex = p.fishdex[c.fishId];
  const isNew = !dex;
  const isRecord = !isNew && c.weight > (dex.heaviest ?? 0);
  if (isNew) dex = p.fishdex[c.fishId] = { count: 1, heaviest: c.weight, heaviestSize: c.sizeClass, first: c.at, variants: {}, sets: {} };
  else {
    dex.count += 1;
    if (isRecord) { dex.heaviest = c.weight; dex.heaviestSize = c.sizeClass; }
  }
  dex.variants ??= {};
  dex.sets ??= {};
  const isNewVariant = !dex.variants[c.variant];
  dex.variants[c.variant] = (dex.variants[c.variant] ?? 0) + 1;

  // logbook goals: a complete morph set / every variant of this species pays once
  const completed = [];
  const fish = data().fish?.[c.fishId];
  for (const set of variantSets(data(), dex)) {
    if (!set.done || dex.sets[set.id]) continue;
    dex.sets[set.id] = true;
    const coins = Math.round((fish?.baseValue ?? 0) * (set.coinsPerBase ?? 0)) * testMult(data(), S.test, 'coins');
    if (coins) addCoins(coins);
    if (set.pearls) p.pearls += set.pearls;
    completed.push({ id: set.id, name: set.name, coins, pearls: set.pearls ?? 0 });
  }
  return { isNew, isRecord, isNewVariant, completed };
}

function pearlsFor(fish, sizeClass) {
  const cfg = data().economy?.pearls ?? {};
  return (cfg.byTier?.[fish?.tier] ?? 0) + (sizeClass === 'trophy' ? cfg.trophyBonus ?? 0 : 0);
}

function onCaught(payload = {}) {
  const p = P();
  const fishId = String(payload.fishId ?? '');
  const fish = data().fish?.[fishId];
  if (!fish) console.warn('[economy] caught an unknown fish id', fishId);
  const weight = Number.isFinite(payload.weight) && payload.weight > 0 ? Math.round(payload.weight * 100) / 100 : fish?.weight?.[0] ?? 0.1;
  const sizeClass = sizeClassById(data(), payload.sizeClass)?.id ?? sizeClassFor(data(), fishId, weight).id;
  const variant = variantOf(data(), payload.variant ?? 'basic');
  const entry = {
    id: `c${++p.catchSeq}`,
    fishId,
    variant: variant.id,
    weight,
    sizeClass,
    islandId: payload.islandId ?? S.world?.islandId ?? 'driftwood_cove',
    perfect: !!payload.perfectCast,
    at: Date.now(),
  };
  const { isNew, isRecord, isNewVariant, completed } = recordCatch(entry);
  const pearls = pearlsFor(fish, sizeClass) + (variant.pearls ?? 0);
  if (pearls) p.pearls += pearls;
  p.stats.caught += 1;

  // an older catch still waiting for a decision (should not happen while the card is open): sell it
  if (p.held) sellHeld();

  const coolerFull = p.cooler.length >= coolerCapacity(data(), p);
  if (coolerFull) p.held = entry;
  else p.cooler.push(entry);

  const value = priceOf(data(), p, S.test, entry);
  changed('cooler', 'fishdex', 'pearls', 'stats');
  E.emit('catch:landed', {
    catch: entry, variant, isNew, isRecord, isNewVariant, sets: completed, value, pearls, coolerFull, hot: hotFishOf(data(), p) === fishId,
  });
}

function sellHeld() {
  const p = P();
  if (!p.held) return 0;
  const c = p.held;
  const price = priceOf(data(), p, S.test, c);
  p.held = null;
  saturate(c.fishId, 1);
  p.stats.sold += 1;
  addCoins(price);
  E.emit('catch:sold', { catchId: c.id, fishId: c.fishId, price });
  return price;
}

function saturate(fishId, units) {
  const m = P().market;
  m.saturation[fishId] = (m.saturation[fishId] ?? 0) + units;
}

// ---------------------------------------------------------------- idle tick
function recover(seconds) {
  const sat = P().market.saturation;
  const per = (data().economy?.market?.saturation?.recoverPerMinute ?? 0.5) / 60;
  for (const id of Object.keys(sat)) {
    sat[id] -= per * seconds;
    if (sat[id] <= 0) delete sat[id];
  }
}

function grantOffline(seconds) {
  const p = P();
  const minAway = data().economy?.offline?.minAwaySeconds ?? 60;
  const earn = offlineEarnings(data(), p, S.test, seconds);
  recover(seconds);
  const total = earn.total;
  if (total <= 0) return;
  if (seconds < minAway) {
    // a short pause: just pay it, no card
    addCoins(total);
    return;
  }
  const prev = p.pendingOffline;
  p.pendingOffline = {
    seconds: (prev?.seconds ?? 0) + earn.seconds,
    capped: !!(prev?.capped || earn.capped),
    crew: (prev?.crew ?? 0) + earn.crew,
    nets: (prev?.nets ?? 0) + earn.nets,
    aquarium: (prev?.aquarium ?? 0) + earn.aquarium,
    crewFish: (prev?.crewFish ?? 0) + earn.crewFish,
    total: (prev?.total ?? 0) + total,
  };
  changed('pendingOffline');
  E.emit('offline:ready', p.pendingOffline);
}

function tick() {
  const p = P();
  if (!p) return;
  // while hidden, timers are throttled: wait and settle the whole gap (capped) when the player is back
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  p.lastSeen = now;
  if (dt <= 0) return;
  if (dt > 5) { grantOffline(dt); return; }   // the tab slept or was closed
  recover(dt);
  const rate = incomeRates(data(), p, S.test).total;
  if (rate <= 0) return;
  p.idle.carry += rate * dt;
  const whole = Math.floor(p.idle.carry);
  if (whole >= 1) {
    p.idle.carry -= whole;
    addCoins(whole);
    E.emit('idle:income', { coins: whole });
    changed('coins');
  }
}

// ---------------------------------------------------------------- public API
export const economy = {
  get ready() { return !!S; },

  // --- reading
  price: (c) => priceOf(data(), P(), S.test, c),
  coolerCapacity: () => coolerCapacity(data(), P()),
  sellAllPreview() {
    const prices = batchPrices(data(), P(), S.test, P().cooler);
    return { total: prices.reduce((a, b) => a + b, 0), prices };
  },
  hotFish: () => hotFishOf(data(), P()),
  incomePerMinute: () => incomeRates(data(), P(), S.test).total * 60,
  incomeRates: () => incomeRates(data(), P(), S.test),
  offlineCapHours: () => offlineCapHours(data(), P()),
  building: (id) => buildingLevel(data(), P(), id),
  crewSlots: () => crewSlots(data(), P()),
  crewBunks: () => crewBunks(data(), P()),
  crewSpots: () => crewSpots(data(), P()),
  boat: () => boatOf(data(), P()),
  nextBoat: () => nextBoat(data(), P()),
  nextPier: () => nextPier(data(), P()),
  pierDepth: () => pierDepth(data(), P()),
  variant: (id) => variantOf(data(), id),
  hireCost: () => hireCost(data(), P()),
  islandRequirements: (id) => islandRequirements(data(), P(), id),
  /** A rough price for showing what a fish is worth (fair size, no market). */
  item: (slot, id) => itemOf(data(), slot, id),

  // --- catches
  keepCatch(catchId) {
    const p = P();
    if (p.held?.id === catchId) return fail('cooler-full');
    if (!p.cooler.some((c) => c.id === catchId)) return fail('missing');
    E.emit('catch:kept', { catchId });
    return { ok: true };
  },
  releaseHeld() {
    const p = P();
    if (!p.held) return fail('missing');
    const id = p.held.id;
    p.held = null;
    changed('cooler');
    E.emit('catch:released', { catchId: id });
    return { ok: true };
  },
  sellCatch(catchId) {
    const p = P();
    if (p.held?.id === catchId) {
      const price = sellHeld();
      changed('cooler', 'coins', 'market');
      return { ok: true, price };
    }
    const i = p.cooler.findIndex((c) => c.id === catchId);
    if (i < 0) return fail('missing');
    const c = p.cooler[i];
    const price = priceOf(data(), p, S.test, c);
    p.cooler.splice(i, 1);
    saturate(c.fishId, 1);
    p.stats.sold += 1;
    addCoins(price);
    E.emit('catch:sold', { catchId: c.id, fishId: c.fishId, price });
    changed('cooler', 'coins', 'market');
    return { ok: true, price };
  },
  sellAll() {
    const p = P();
    if (!p.cooler.length) return fail('empty');
    const list = p.cooler.splice(0);
    const prices = batchPrices(data(), p, S.test, list);
    let total = 0;
    list.forEach((c, i) => {
      saturate(c.fishId, 1);
      total += prices[i];
      E.emit('catch:sold', { catchId: c.id, fishId: c.fishId, price: prices[i] });
    });
    p.stats.sold += list.length;
    addCoins(total);
    changed('cooler', 'coins', 'market');
    return { ok: true, total, count: list.length };
  },

  // --- gear
  owns: (slot, id) => P().owned[groupOf(slot)]?.includes(id) ?? false,
  buyItem(slot, id) {
    const item = itemOf(data(), slot, id);
    if (!item) return fail('missing');
    const p = P();
    const group = groupOf(slot);
    if (p.owned[group].includes(id)) return fail('owned');
    if (!spend(item.cost)) return fail('coins', { need: item.cost - p.coins });
    p.owned[group].push(id);
    p.gear[slot] = id;
    refreshGear();
    changed('owned', 'gear', 'coins');
    return { ok: true, item };
  },
  equipItem(slot, id) {
    const p = P();
    if (!p.owned[groupOf(slot)]?.includes(id)) return fail('not-owned');
    p.gear[slot] = id;
    refreshGear();
    changed('gear');
    return { ok: true };
  },

  // --- harbour
  upgradeBuilding(id) {
    if (visiting()) return fail('visitor');
    const b = buildingLevel(data(), P(), id);
    if (!b) return fail('missing');
    if (!b.next) return fail('max');
    if (!b.siteOwned) return fail('site', { plot: b.def.site });
    if (!spend(b.next.cost)) return fail('coins', { need: b.next.cost - P().coins });
    P().island.buildings[id] = b.index + 1;
    if (id === 'cooler') refillFromHeld();
    changed('island', 'coins');
    islandChanged({ upgraded: id, level: b.index + 1 });
    return { ok: true, level: b.index + 1, name: b.next.name };
  },
  nextPlot: () => nextPlot(data(), P()),
  buyPlot(id) {
    if (visiting()) return fail('visitor');
    const def = data().economy?.plots?.[id];
    if (!def) return fail('missing');
    if (P().island.plots.includes(id)) return fail('owned');
    if (economy.nextPlot() !== id) return fail('order');
    if (!spend(def.cost)) return fail('coins', { need: def.cost - P().coins });
    P().island.plots.push(id);
    changed('island', 'coins');
    islandChanged({ raised: id });
    return { ok: true, name: def.name };
  },
  buyPier(id) {
    if (visiting()) return fail('visitor');
    const next = nextPier(data(), P());
    if (!next || next.id !== id) return fail('order');
    if (!next.plotOwned) return fail('site', { plot: next.plot });
    if (!spend(next.cost)) return fail('coins', { need: next.cost - P().coins });
    P().island.piers.push(id);
    changed('island', 'coins');
    islandChanged({ pierBuilt: id, depth: pierDepth(data(), P()) });
    return { ok: true, name: next.name, depth: next.depth };
  },
  buyBoat(id) {
    if (visiting()) return fail('visitor');
    const next = nextBoat(data(), P());
    if (!next || next.id !== id) return fail('order');
    if (!next.dockFits) return fail('dock');
    if (!spend(next.cost)) return fail('coins', { need: next.cost - P().coins });
    P().island.boat = id;
    changed('island', 'coins');
    islandChanged({ boatBought: id });
    return { ok: true, name: next.name };
  },
  hireWorker() {
    if (visiting()) return fail('visitor');
    const p = P();
    if (p.workers.length >= crewSlots(data(), p)) {
      return fail(p.workers.length >= crewBunks(data(), p) ? 'bunks' : 'spots');
    }
    const cost = hireCost(data(), p);
    if (!spend(cost)) return fail('coins', { need: cost - p.coins });
    const names = data().economy?.workers?.names ?? ['Deckhand'];
    const used = new Set(p.workers.map((w) => w.name));
    const name = names.find((n) => !used.has(n)) ?? `Deckhand ${p.workers.length + 1}`;
    p.workers.push({ id: `w${Date.now().toString(36)}`, name, hiredAt: Date.now() });
    changed('workers', 'coins');
    islandChanged({ hired: name });
    return { ok: true, name };
  },
  nextWatch() {
    return data().economy?.offline?.watch?.[P().watch] ?? null;
  },
  buyWatch() {
    const w = economy.nextWatch();
    if (!w) return fail('max');
    if (!spend(w.cost)) return fail('coins', { need: w.cost - P().coins });
    P().watch += 1;
    changed('watch', 'coins');
    return { ok: true, name: w.name, hours: w.hours };
  },

  // --- islands
  unlockIsland(id) {
    const p = P();
    if (p.unlockedIslands.includes(id)) return fail('owned');
    const reqs = islandRequirements(data(), p, id);
    if (!reqs) return fail('missing');
    const unmet = reqs.find((r) => !r.met);
    if (unmet) return fail('requirements', { unmet });
    const cost = data().islands[id].unlock?.coins ?? 0;
    if (!spend(cost)) return fail('coins');
    p.unlockedIslands.push(id);
    changed('unlockedIslands', 'coins');
    return { ok: true };
  },
  travel(id) {
    if (visiting()) return fail('visitor');
    const p = P();
    if (!p.unlockedIslands.includes(id)) return fail('locked');
    p.currentIsland = id;
    changed('currentIsland');
    E.emit('travel:request', { islandId: id });
    return { ok: true };
  },

  // --- offline
  collectOffline() {
    const p = P();
    const po = p.pendingOffline;
    if (!po) return fail('none');
    p.pendingOffline = null;
    addCoins(po.total);
    changed('coins', 'pendingOffline');
    return { ok: true, total: po.total };
  },

  // --- settings / test
  setSetting(key, value) {
    P().settings[key] = value;
    changed('settings');
    E.emit('settings:changed', { ...P().settings });
  },
  testGrantCoins() {
    if (!S.test) return fail('test-only');
    addCoins(data().economy?.test?.grantCoins ?? 10000);
    changed('coins');
    return { ok: true };
  },
  testUnlockIslands() {
    if (!S.test) return fail('test-only');
    P().unlockedIslands = Object.keys(data().islands ?? {});
    changed('unlockedIslands');
    return { ok: true };
  },
  /** Debug helper: pretend the player was away for `seconds` (used by tests and the settings screen in test mode). */
  simulateAway(seconds) {
    grantOffline(seconds);
  },
  day: () => dayKey(),
  testMult: () => testMult(data(), S.test, 'coins'),
};

function refillFromHeld() {
  const p = P();
  if (p.held && p.cooler.length < coolerCapacity(data(), p)) {
    p.cooler.push(p.held);
    p.held = null;
  }
}

export function startEconomy({ state, events }) {
  S = state;
  E = events;
  const p = state.profile;
  state.gear = deriveGear(state.data, p);
  state.economy = economy;   // handy for debugging via window.__game.state.economy

  events.on('fish:caught', onCaught);

  // offline earnings since the last session; the tick below handles any gap > 5 s
  lastTick = Math.min(p.lastSeen ?? Date.now(), Date.now());
  tick();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });

  // tell A the starting gear and island layout once everything is wired
  events.once('game:ready', () => {
    E.emit('gear:changed', state.gear);
    if (!visiting()) islandChanged({ initial: true });   // a visitor's island view comes from Agent H (source: 'net')
  });
  return economy;
}

export { SLOTS, BUILDINGS };
