// Agent B. Shop, market, idle crew, buildings, land, offline earnings, logbook records.
// Coins are earned only. There is no real-money purchase anywhere in the game.
// UI calls the `economy` API; other systems talk through events (docs/INTERFACES.md).
import {
  SLOTS, BUILDINGS, groupOf, itemOf, deriveGear, priceOf, batchPrices, sizeClassFor, sizeClassById,
  coolerCapacity, crewSlots, crewBunks, crewSpots, hireCost, buildingLevel, hotFishOf, incomeRates, offlineEarnings,
  offlineCapHours, islandRequirements, dayKey, testMult, variantOf, slotInfo, variantSets, nextPlot, nextPier, nextBoat, boatOf, pierDepth,
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
    decor: [...(p.island.decor ?? [])],
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
  return (cfg.byTier?.[fish?.tier] ?? 0) + (fish?.pearls ?? 0) + (sizeClass === 'trophy' ? cfg.trophyBonus ?? 0 : 0);
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
  // Mastery (a well-fought catch sells for more) and double/triple catches from predators (Agent A).
  const bonus = Number(payload.mastery?.valueMult);
  if (Number.isFinite(bonus) && bonus > 1) { entry.bonus = Math.min(5, bonus); entry.grade = String(payload.mastery.grade ?? ''); }
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
    multi: payload.multi ?? null, mastery: payload.mastery ?? null,
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
    machines: (prev?.machines ?? 0) + earn.machines,
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

// ---------------------------------------------------------------- 4.7b: gear that wears, breaks and runs out
const isStack = (item) => !!item && (item.unlimited || Number.isFinite(item.stack));
let fightWeight = 0;

function useBait() {
  const p = P();
  const bait = itemOf(data(), 'bait', p.gear.bait);
  if (!bait || bait.unlimited) return;
  const keep = p.owned.tools?.includes('bait_bucket') && Math.random() < (data().economy?.wear?.baitBucketSave ?? 0.25);
  if (!keep) p.stacks[p.gear.bait] = Math.max(0, (p.stacks[p.gear.bait] ?? 0) - 1);
  if (!(p.stacks[p.gear.bait] > 0)) {
    E.emit('gear:out', { slot: 'bait', id: p.gear.bait });
    p.gear.bait = 'breadcrust';
  }
  refreshGear();
  changed('stacks', 'gear');
}

function wearAfterFight(weight, snapped) {
  const p = P();
  const w = data().economy?.wear ?? {};
  const line = itemOf(data(), 'line', p.gear.line);
  const rod = itemOf(data(), 'rod', p.gear.rod);
  if (line?.wear) {
    const ratio = Math.min(2, Math.max(0.2, weight / (line.stats?.strength ?? 2.5)));
    p.condition.lineWear = Math.min(1, (p.condition.lineWear ?? 0) + line.wear * (data().economy?.wear?.lineWearMult ?? 1) * ratio * (snapped ? 2 : 1));
  }
  if (rod?.durability && !rod.unbreakable) {
    const over = Math.max(0, weight - (rod.stats?.rating ?? 3) * (w.strainFrom ?? 0.6));
    if (over > 0) {
      // One fight can only take a share of the rod's life: even a monster never snaps it outright.
      const add = Math.min(over * (w.strainPerKg ?? 6), rod.durability * (w.maxStrainPerFight ?? 1));
      const before = (p.condition.rodStrain[p.gear.rod] ?? 0) / rod.durability;
      p.condition.rodStrain[p.gear.rod] = (p.condition.rodStrain[p.gear.rod] ?? 0) + add;
      const after = p.condition.rodStrain[p.gear.rod] / rod.durability;
      if (before < 0.7 && after >= 0.7 && after < 1) E.emit('gear:strained', { slot: 'rod', id: p.gear.rod, strain: after });
      if (p.condition.rodStrain[p.gear.rod] >= rod.durability) {
        p.condition.rodBroken[p.gear.rod] = true;
        E.emit('gear:broken', { slot: 'rod', id: p.gear.rod });
      }
    }
  }
  if (snapped) {
    // the terminal tackle goes with the fish; the tackle box keeps the spares
    const lost = [];
    const box = p.owned.tools?.includes('tackle_box');
    for (const slot of ['hook', 'sinker', 'float', 'leader']) {
      const id = p.gear[slot];
      const item = id ? itemOf(data(), slot, id) : null;
      if (!item || item.cost === 0) continue;
      if (box && Math.random() < (w.tackleBoxSave ?? 0.6)) continue;
      p.owned[groupOf(slot)] = p.owned[groupOf(slot)].filter((x) => x !== id);
      p.gear[slot] = slot === 'leader' ? null : Object.entries(data().items?.[groupOf(slot)] ?? {}).find(([, it]) => it.cost === 0)?.[0] ?? null;
      lost.push({ slot, id });
    }
    if (p.gear.lure) {
      p.stacks[p.gear.lure] = Math.max(0, (p.stacks[p.gear.lure] ?? 0) - 1);
      lost.push({ slot: 'lure', id: p.gear.lure });
      if (!(p.stacks[p.gear.lure] > 0)) p.gear.lure = null;
    }
    if (lost.length) E.emit('gear:lost', { items: lost });
  }
  refreshGear();
  changed('condition', 'gear', 'stacks', 'owned');
}

function wireWearEvents() {
  E.on('cast:land', useBait);
  E.on('fight:start', ({ weight } = {}) => { fightWeight = Number.isFinite(weight) ? weight : 0; });
  E.on('fish:caught', ({ weight } = {}) => { wearAfterFight(Number.isFinite(weight) ? weight : fightWeight, false); fightWeight = 0; });
  E.on('fish:lost', ({ reason } = {}) => { if (fightWeight) wearAfterFight(fightWeight, reason === 'snap'); fightWeight = 0; });
}

// ---------------------------------------------------------------- building placement (9b.6)
let pendingBuild = null;
let ackTimer = 0;

function buildOffer(kind, id) {
  if (kind === 'building' || kind === 'upgrade') {
    const b = buildingLevel(data(), P(), id);
    if (!b) return fail('missing');
    if (!b.next) return fail('max');
    if (!b.siteOwned) return fail('site', { plot: b.def.site });
    const level = b.index + 1;
    // a building that is not standing yet gets placed by the player; one that stands is upgraded on the spot
    const isNew = !(b.built && b.index > 0);
    return { ok: true, kind: isNew ? 'building' : 'upgrade', level, cost: b.next.cost, name: b.next.name, model: b.next.model ?? `${id}_l${level}` };
  }
  if (kind === 'plot') {
    const def = data().economy?.plots?.[id];
    if (!def) return fail('missing');
    if (nextPlot(data(), P()) !== id) return fail('order');
    return { ok: true, kind, level: 1, cost: def.cost, name: def.name, model: def.model ?? `plot_${id}` };
  }
  if (kind === 'pier') {
    const next = nextPier(data(), P());
    if (!next || next.id !== id) return fail('order');
    if (!next.plotOwned) return fail('site', { plot: next.plot });
    return { ok: true, kind, level: 1, cost: next.cost, name: next.name, model: next.model ?? id };
  }
  return fail('kind');
}

let pendingDecor = null;  // { uid, item, cost, moveIndex? }: a decoration in the player's hand
let pendingMove = null;   // building id being moved (Casper 10 Nov: customise your island)

function finishBuild(where) {
  const b = pendingBuild;
  if (!b) return;
  pendingBuild = null;
  clearTimeout(ackTimer);
  let r;
  if (b.kind === 'building' || b.kind === 'upgrade') r = economy.upgradeBuilding(b.id, where);
  else if (b.kind === 'plot') r = economy.buyPlot(b.id);
  else if (b.kind === 'pier') r = economy.buyPier(b.id);
  E.emit('build:done', { kind: b.kind, id: b.id, level: b.level, name: b.name, ok: !!r?.ok, reason: r?.reason });
}

function wireBuildEvents() {
  E.on('build:placing', ({ id } = {}) => {
    if (pendingBuild && (!id || id === pendingBuild.id)) { pendingBuild.acked = true; clearTimeout(ackTimer); }
  });
  E.on('build:placed', ({ id, x, z, rot } = {}) => {
    if (pendingDecor && id === pendingDecor.uid) {
      // A decoration set down: charged now (cancelling costs nothing); moving one is free.
      const d = pendingDecor;
      pendingDecor = null;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const list = (P().island.decor ??= []);
      if (d.moveIndex != null) { if (list[d.moveIndex]) list[d.moveIndex] = { ...list[d.moveIndex], x, z, rot: rot || 0 }; }
      else {
        if (!spend(d.cost)) return;
        list.push({ uid: d.uid, item: d.item, x, z, rot: rot || 0 });
      }
      changed('island', 'coins');
      islandChanged({ decorated: d.uid });
      return;
    }
    if (pendingMove && id === pendingMove) {
      // A building moved to a new place (free, any time): keep its level, store where it stands.
      const cur = P().island.buildings[id];
      pendingMove = null;
      if (cur && Number.isFinite(x) && Number.isFinite(z)) {
        P().island.buildings[id] = { ...cur, x, z, rot: Number.isFinite(rot) ? rot : cur.rot ?? 0 };
        changed('island');
        islandChanged({ moved: id });
      }
      return;
    }
    if (pendingBuild && (!id || id === pendingBuild.id)) finishBuild({ x, z, rot });
  });
  E.on('build:cancel', ({ id } = {}) => {
    if (pendingMove && id === pendingMove) { pendingMove = null; return; }
    if (pendingDecor && id === pendingDecor.uid) { pendingDecor = null; return; }
    if (pendingBuild && (!id || id === pendingBuild.id)) {
      const b = pendingBuild;
      pendingBuild = null;
      clearTimeout(ackTimer);
      E.emit('build:done', { kind: b.kind, id: b.id, ok: false, reason: 'cancel', name: b.name });
    }
  });
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
  /** A fish snatched from the basket (wading too deep, Agent A's wading.js). Picks one at random. */
  loseCatch() {
    const p = P();
    if (!p.cooler.length) return null;
    const c = p.cooler.splice(Math.floor(Math.random() * p.cooler.length), 1)[0];
    E.emit('catch:stolen', { catchId: c.id, fishId: c.fishId });
    changed('cooler');
    return c;
  },
  /** Let a fish from the cooler go back into the sea (no coins). */
  releaseCatch(catchId) {
    const p = P();
    const i = p.cooler.findIndex((c) => c.id === catchId);
    if (i < 0) return fail('missing');
    p.cooler.splice(i, 1);
    changed('cooler');
    E.emit('catch:released', { catchId });
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

  /** A fish won from a treasure chest: lands like a catch (reveal, logbook), no fight, no rod wear. */
  grantFish(payload) { onCaught(payload); },
  /** A treasure chest's winnings (treasure.js): coins and pearls straight into the purse. */
  grantTreasure({ coins = 0, pearls = 0 } = {}) {
    if (coins > 0) addCoins(Math.round(coins));
    if (pearls > 0) P().pearls += Math.round(pearls);
    changed('coins', 'pearls');
    return { coins, pearls };
  },

  // --- gear
  owns: (slot, id) => {
    const item = itemOf(data(), slot, id);
    if (isStack(item)) return item.unlimited || (P().stacks?.[id] ?? 0) > 0;
    return P().owned[groupOf(slot)]?.includes(id) ?? false;
  },
  stackOf: (id) => P().stacks?.[id] ?? 0,
  /** Buy an item. Stack items (bait, lures) can be bought again: `packs` x item.stack each time. */
  buyItem(slot, id, packs = 1) {
    const item = itemOf(data(), slot, id);
    if (!item) return fail('missing');
    const p = P();
    const group = groupOf(slot);
    const stack = isStack(item);
    if (!stack && p.owned[group].includes(id)) return fail('owned');
    if (item.unlimited) return fail('owned');
    const n = stack ? Math.max(1, packs | 0) : 1;
    const cost = item.cost * n;
    if (!spend(cost)) return fail('coins', { need: cost - p.coins });
    if (!p.owned[group].includes(id)) p.owned[group].push(id);
    if (stack) p.stacks[id] = (p.stacks[id] ?? 0) + (item.stack ?? 1) * n;
    if (slot !== 'tool') p.gear[slot] = id;
    if (slot === 'rod') delete p.condition.rodBroken[id];
    if (slot === 'line') p.condition.lineWear = 0;
    refreshGear();
    changed('owned', 'gear', 'coins', 'stacks');
    return { ok: true, item, added: stack ? (item.stack ?? 1) * n : 1 };
  },
  equipItem(slot, id) {
    const p = P();
    if (id === null && slotInfo(slot)?.optional) { p.gear[slot] = null; refreshGear(); changed('gear'); return { ok: true }; }
    if (!economy.owns(slot, id)) return fail('not-owned');
    p.gear[slot] = id;
    refreshGear();
    changed('gear');
    return { ok: true };
  },
  /** 4.7b repairs at the shop. */
  repairCost(rodId = P().gear.rod) {
    const item = itemOf(data(), 'rod', rodId);
    return Math.max(10, Math.round((item?.cost ?? 0) * (data().economy?.wear?.repairShare ?? 0.3)));
  },
  repairRod(rodId = P().gear.rod) {
    const p = P();
    if (!p.condition.rodBroken[rodId] && !(p.condition.rodStrain[rodId] > 0)) return fail('fine');
    const cost = economy.repairCost(rodId);
    if (!spend(cost)) return fail('coins', { need: cost - p.coins });
    delete p.condition.rodBroken[rodId];
    delete p.condition.rodStrain[rodId];
    refreshGear();
    changed('condition', 'coins');
    return { ok: true, cost };
  },
  respoolCost: () => itemOf(data(), 'line', P().gear.line)?.respool ?? 5,
  respool() {
    const p = P();
    if (!(p.condition.lineWear > 0.001)) return fail('fine');
    const cost = economy.respoolCost();
    if (!spend(cost)) return fail('coins', { need: cost - p.coins });
    p.condition.lineWear = 0;
    refreshGear();
    changed('condition', 'coins');
    return { ok: true, cost };
  },
  rodStrain() {
    const p = P();
    const rod = itemOf(data(), 'rod', p.gear.rod);
    if (!rod?.durability) return 0;
    return Math.min(1, (p.condition.rodStrain[p.gear.rod] ?? 0) / rod.durability);
  },

  // --- harbour
  /** Apply a building level now (used by the placement flow; `where` = { x, z, rot } from Agent A). */
  /** Buy a decoration: placement mode opens; coins are taken when it is set down. */
  buyDecor(item) {
    if (visiting()) return fail('visitor');
    const def = data().economy?.decor?.items?.[item];
    if (!def) return fail('missing');
    if (pendingBuild || pendingMove || pendingDecor) return fail('busy');
    if (P().coins < def.cost) return fail('coins', { need: def.cost - P().coins });
    if ((P().island.decor?.length ?? 0) >= 150) return fail('full');
    const uid = `decor_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
    pendingDecor = { uid, item, cost: def.cost };
    E.emit('build:start', { kind: 'decor', id: uid, level: 1, model: def.model, place: true });
    return { ok: true, name: def.name };
  },
  /** Pick a placed decoration up again: refund part of its price. */
  removeDecor(uid) {
    if (visiting()) return fail('visitor');
    const list = P().island.decor ?? [];
    const i = list.findIndex((d) => d.uid === uid);
    if (i < 0) return fail('missing');
    const def = data().economy?.decor?.items?.[list[i].item];
    list.splice(i, 1);
    const back = Math.round((def?.cost ?? 0) * (data().economy?.decor?.refundShare ?? 0.5));
    if (back > 0) addCoins(back);
    changed('island', 'coins');
    islandChanged({ undecorated: uid });
    return { ok: true, refund: back, name: def?.name };
  },
  /** Take back the decoration placed last (the shop's "Take back last"). */
  removeLastDecor() { const l = P().island.decor ?? []; return l.length ? economy.removeDecor(l[l.length - 1].uid) : fail('missing'); },

  /** Pick a built building up and put it somewhere else on your land (free). */
  moveBuilding(id) {
    if (visiting()) return fail('visitor');
    const b = buildingLevel(data(), P(), id);
    if (!b || !b.built || b.index < 1) return fail('missing');
    if (pendingBuild || pendingMove) return fail('busy');
    pendingMove = id;
    E.emit('build:start', { kind: 'building', id, level: b.index, model: b.model ?? `${id}_l${b.index}`, place: true, move: true });
    return { ok: true, name: b.name };
  },

  upgradeBuilding(id, where = null) {
    if (visiting()) return fail('visitor');
    const b = buildingLevel(data(), P(), id);
    if (!b) return fail('missing');
    if (!b.next) return fail('max');
    if (!b.siteOwned) return fail('site', { plot: b.def.site });
    if (!spend(b.next.cost)) return fail('coins', { need: b.next.cost - P().coins });
    const fin = (n, d) => (Number.isFinite(n) ? n : d);
    P().island.buildings[id] = {
      level: b.index + 1,
      x: fin(where?.x, b.x ?? null),
      z: fin(where?.z, b.z ?? null),
      rot: fin(where?.rot, b.rot ?? 0),
    };
    if (id === 'cooler') refillFromHeld();
    changed('island', 'coins');
    islandChanged({ upgraded: id, level: b.index + 1 });
    return { ok: true, level: b.index + 1, name: b.next.name };
  },

  /**
   * Start a build (9b.6, INTERFACES "Building placement"): checks, then emits build:start for Agent A.
   * kind: 'building' (new, placed by the player) | 'upgrade' | 'plot' | 'pier'. Coins are charged on build:placed.
   */
  startBuild(kind, id) {
    if (visiting()) return fail('visitor');
    if (pendingBuild) return fail('busy');
    const offer = buildOffer(kind, id);
    if (!offer.ok) return offer;
    if (P().coins < offer.cost) return fail('coins', { need: offer.cost - P().coins });
    pendingBuild = { kind: offer.kind, id, level: offer.level, cost: offer.cost, name: offer.name, acked: false };
    E.emit('build:start', { kind: offer.kind, id, level: offer.level, model: offer.model, place: offer.kind === 'building' });
    clearTimeout(ackTimer);
    ackTimer = setTimeout(() => {
      // nobody answered (placement mode not there yet): finish at the default spot so the game never stalls
      if (pendingBuild && !pendingBuild.acked) finishBuild({ x: null, z: null, rot: 0 });
    }, 1500);
    return { ok: true, pending: true, name: offer.name };
  },
  get pendingBuild() { return pendingBuild; },
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
  wireBuildEvents();
  wireWearEvents();

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
