// Agent B. The shop at the counter (master prompt 9b.1, docs/UI_BIBLE.md §2):
// sections Sell / Gear / Tackle / Bait / Build, sub-tabs per section, 3-up tiles, details in a bottom drawer.
// Paintings: Agent F's screen.shop.l<n> backdrop, npc.shopkeeper, gear.<slot>.<id> and building.<id>.l<n> cards.
// Models: Agent G's gear/boats manifests and Agent D's world manifest (building levels, plots), turning in the drawer.
import { h, ico, fmt, fmtKg, money, fill, artImg, inkOn, plural, fmtDuration } from '../dom.js';
import { fishPose, artPath } from '../../economy/data.js';
import { BUILDINGS, sizeClassById, fullName, slotInfo } from '../../economy/rules.js';
import { attachGearPreview, detachAllGearPreviews, gearManifestReady, hasGearModel } from '../gear-preview.js';
import { Place, Tabs, TabsSpacer, Tile, TileGrid, Drawer, Plate, StatRow, changeGate } from '../kit.js';
import { isVisitor, hostName } from '../net.js';

const SECTIONS = [
  { id: 'sell', icon: 'scale', label: 'Sell' },
  { id: 'gear', icon: 'rod', label: 'Gear' },
  { id: 'tackle', icon: 'hook', label: 'Tackle' },
  { id: 'bait', icon: 'worm', label: 'Bait' },
  { id: 'build', icon: 'hammer', label: 'Build' },
];
const SUBS = {
  gear: [{ id: 'rod', icon: 'rod', label: 'Rods' }, { id: 'reel', icon: 'reel', label: 'Reels' }, { id: 'line', icon: 'line', label: 'Lines' }],
  tackle: [
    { id: 'hook', icon: 'hook', label: 'Hooks' }, { id: 'sinker', icon: 'sinker', label: 'Sinkers' }, { id: 'float', icon: 'float', label: 'Floats' },
    { id: 'leader', icon: 'leader', label: 'Leaders' }, { id: 'lure', icon: 'lure', label: 'Lures' }, { id: 'tool', icon: 'net', label: 'Tools' },
  ],
  build: [
    { id: 'buildings', icon: 'house', label: 'Houses' }, { id: 'land', icon: 'plot', label: 'Land' }, { id: 'piers', icon: 'pier', label: 'Piers' },
    { id: 'boats', icon: 'boat', label: 'Boats' }, { id: 'crew', icon: 'crew', label: 'Crew' }, { id: 'decor', icon: 'plot', label: 'Decor' },
  ],
};
const SLOT_ICON = { rod: 'rod', reel: 'reel', line: 'line', bait: 'worm', hook: 'hook', sinker: 'sinker', float: 'float', leader: 'leader', lure: 'lure', tool: 'net' };
const TOOL_LINE = {
  landing_net: 'Lands the last metre: fewer fish slip off at your feet.',
  gaff: 'Lands the giants the net cannot hold.',
  polarized_glasses: 'Shows fish shadows deeper under the surface.',
  tackle_box: 'Saves most of your tackle when the line snaps.',
  bait_bucket: 'Every bait stack lasts longer.',
};

// helpers other screens still import
export function sheetHead(title, subtitle, onClose, portrait = null) {
  return h('header.sheet__head', portrait, h('div.sheet__title', h('h2', title), subtitle ? h('p', subtitle) : null),
    h('button.btn.btn--round.sheet__close', { 'aria-label': 'Close', on: { click: onClose } }, ico('close')));
}
export function keepScroll(root, fn) {
  const body = root.querySelector('.sheet__body, .tilegrid');
  const y = body?.scrollTop ?? 0;
  fn();
  const nb = root.querySelector('.sheet__body, .tilegrid');
  if (nb) nb.scrollTop = y;
}
export function variantToken(economy, variantId) {
  const v = economy.variant(variantId ?? 'basic');
  if (!v || v.kind === 'basic') return null;
  return h('span.pebble.vtoken', { style: { '--pebble': v.accent, color: inkOn(v.accent) } }, `${v.name} ×${fmt(v.valueMult)}`);
}

/** A turning 3D model (+ painting behind it) for the drawer. kind: gear | boats | world. */
function showcase(art, modelId, kind = 'gear') {
  if (!art && !modelId) return null;
  const show = h('div.showcase', { hidden: true });
  const reveal = () => { show.hidden = false; };
  const img = artImg(art, 'showcase__art', { alt: '', onShow: reveal });
  if (img) show.append(img);
  if (modelId) {
    const canvas = h('canvas.showcase__model', { 'aria-hidden': 'true' });
    show.append(canvas);
    gearManifestReady().then(() => {
      if (!hasGearModel(modelId, kind)) { canvas.remove(); return; }
      attachGearPreview(canvas, modelId, { kind, onReady: () => { canvas.classList.add('is-live'); reveal(); }, onMissing: () => canvas.remove() });
    });
  }
  return show;
}

export function shopSheet(ctx, { tab = 'sell', focus = null } = {}) {
  const { state, economy, ui } = ctx;
  // old entry points: tab 'buy' → gear, 'harbour' → build
  let section = { buy: 'gear', harbour: 'build' }[tab] ?? tab;
  const subOf = { gear: 'rod', tackle: 'hook', build: focus === 'land' ? 'land' : focus === 'crew' || focus === 'workers_hut' ? 'crew' : focus === 'boats' ? 'boats' : focus === 'decor' ? 'decor' : 'buildings' };
  const shopLevel = economy.building('shop')?.index || 1;
  const place = Place({
    id: 'shop',
    art: artPath(state, `screen.shop.l${shopLevel}`) ?? artPath(state, 'screen.shop'),
    sign: economy.building('shop')?.name ?? 'Shop',
    label: 'Shop',
    onClose: () => ui.close(),
  });
  const drawer = Drawer(place.drawerHost);
  let drawerFor = null;
  // Your money, always in view while you shop (Casper 9 Nov).
  const purseCoins = h('span.purse__coins.t-num');
  const pursePearls = h('span.t-num');
  const pursePearlBox = h('span.purse__pearls', ico('pearl'), pursePearls);
  const purse = h('div.purse__plate.plaque.shop-purse', { role: 'status', 'aria-label': 'Money available' }, ico('coin'), purseCoins, pursePearlBox);
  place.root.querySelector('.place__top')?.insertBefore(purse, place.root.querySelector('.place__close'));
  function refreshPurse() {
    purseCoins.textContent = fmt(state.profile.coins);
    pursePearls.textContent = fmt(state.profile.pearls);
    pursePearlBox.hidden = state.profile.pearls <= 0;
  }
  refreshPurse();   // re-render the open drawer after a purchase

  // the shopkeeper, behind the counter (a cut-out painting; left out until it exists)
  const keeper = h('div.shopkeeper');
  const face = artImg(artPath(state, 'npc.shopkeeper'), '', { alt: 'The shopkeeper', slot: keeper });
  if (face) keeper.append(face);

  function render() {
    detachAllGearPreviews();
    const p = state.profile;
    const tabs = Tabs(SECTIONS.map((s) => ({ ...s, art: tabArt(s.id), badge: s.id === 'sell' && p.cooler.length ? String(p.cooler.length) : null })), section,
      (id) => { section = id; drawer.close(); render(); }, { label: 'Shop sections' });
    const sub = SUBS[section] ? Tabs(SUBS[section].map((t) => ({ ...t, art: tabArt(t.id) })), subOf[section], (id) => { subOf[section] = id; drawer.close(); render(); }, { level: 2, label: 'Categories' }) : TabsSpacer();
    let view;
    if (section === 'sell') view = sellView(ctx, drawer, setDrawer);
    else if (section === 'gear' || section === 'tackle') view = gearView(ctx, subOf[section], drawer, setDrawer);
    else if (section === 'bait') view = gearView(ctx, 'bait', drawer, setDrawer);
    else view = buildView(ctx, subOf.build, drawer, setDrawer);
    fill(place.body, face ? keeper : null, h('div.counter', tabs, sub, view.grid, view.plate ?? h('div.plate-spacer', { 'aria-hidden': 'true' })));
    if (drawer.isOpen && drawerFor) drawerFor();
  }
  function setDrawer(fn) { drawerFor = fn; fn(); }
  // painted category icons (art.json icon.tab.*); sub-tab ids are singular, the art keys plural
  function tabArt(id) {
    const key = { rod: 'rods', reel: 'reels', line: 'lines', hook: 'hooks', sinker: 'sinkers', float: 'floats', leader: 'leaders', lure: 'lures', tool: 'tools' }[id] ?? id;
    return artPath(state, `icon.tab.${key}`);
  }

  // every price the shop can show, so a redraw happens exactly when something becomes affordable
  const prices = [
    ...Object.values(state.data.items ?? {}).flatMap((g) => (typeof g === 'object' ? Object.values(g).map((i) => i?.cost).filter(Number.isFinite) : [])),
    ...Object.values(state.data.economy?.buildings ?? {}).flatMap((b) => (b?.levels ?? []).map((l) => l.cost)),
    ...['plots', 'piers', 'boats'].flatMap((k) => Object.values(state.data.economy?.[k] ?? {}).map((x) => x?.cost).filter(Number.isFinite)),
    ...(state.data.economy?.offline?.watch ?? []).map((w) => w.cost),
  ];
  const gate = changeGate();
  const sig = () => {
    const p = state.profile;
    return JSON.stringify([section, subOf, p.cooler.map((c) => c.id), p.gear, p.owned, p.stacks, p.condition, p.island, p.workers.length, p.watch, economy.hotFish(), economy.hireCost(), Object.entries(p.market?.saturation ?? {}).map(([k, v]) => k + Math.round(v))]);
  };
  gate(sig(), state.profile.coins, prices);
  render();
  return {
    id: 'shop',
    el: place.root,
    layerClass: 'is-place',
    refresh: () => { refreshPurse(); if (gate(sig(), state.profile.coins, prices)) render(); },
    onClose: () => detachAllGearPreviews(),
    dismiss: () => { if (drawer.isOpen) drawer.close(); else ui.close(); },
  };
}

// ---------------------------------------------------------------- Sell: fish on the counter, the scale below
function sellView(ctx, drawer, setDrawer) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  const hotId = economy.hotFish();
  if (!p.cooler.length) {
    return { grid: TileGrid([], { label: 'Your catch', empty: 'Nothing to sell yet. Catch fish from the pier.' }) };
  }
  const tiles = p.cooler.map((c) => {
    const f = state.data.fish?.[c.fishId] ?? { name: c.fishId };
    const v = economy.variant(c.variant);
    const name = fullName(f.name, v);
    return Tile({
      fish: true,
      art: fishPose(state, c.fishId, 'rest'),
      name,
      value: [money(economy.price(c))],
      badge: c.fishId === hotId ? 'Hot' : v.kind !== 'basic' ? `×${fmt(v.valueMult)}` : null,
      label: `${name}, ${fmtKg(c.weight)}, worth ${fmt(economy.price(c))}`,
      onTap: () => setDrawer(() => drawer.open(...fishDrawer(ctx, c, drawer))),
    });
  });
  const { total } = economy.sellAllPreview();
  const grid = TileGrid(tiles, { label: 'Your catch' });
  grid.classList.add('tilegrid--fish');
  const plate = Plate([h('span', 'Sell all'), money(total)], (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = economy.sellAll();
    if (r.ok) ui.flyCoins?.(rect, r.total);
  }, { label: `Sell all ${p.cooler.length} fish for ${fmt(total)} coins` });
  return { grid, plate };
}

export function fishDrawer(ctx, c, drawer, { keepLabel = 'Keep', onKeep = null } = {}) {
  const { state, economy, ui } = ctx;
  const f = state.data.fish?.[c.fishId] ?? { name: c.fishId };
  const v = economy.variant(c.variant);
  const name = fullName(f.name, v);
  const size = sizeClassById(state.data, c.sizeClass);
  const price = economy.price(c);
  const art = fishPose(state, c.fishId, 'hero');
  const pic = h('div.drawer__fish');
  const img = artImg(art, '', { alt: '' });
  if (img) pic.append(img); else pic.append(ico('fish'));
  return [
    pic,
    h('h3.drawer__title', name),
    h('div.drawer__facts', h('span.t-num', fmtKg(c.weight)), size ? h(`span.stamp.stamp--${size.id}`, size.name) : null, variantToken(economy, c.variant)),
    h('div.drawer__actions',
      Plate(keepLabel, () => { onKeep?.(); drawer.close(); }, { kind: 'wood' }),
      Plate([h('span', 'Sell'), money(price)], (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const r = economy.sellCatch(c.id);
        drawer.close();
        if (r.ok) ui.flyCoins?.(rect, r.price);
      }, { label: `Sell ${name} for ${fmt(price)} coins` })),
  ];
}

// ---------------------------------------------------------------- Gear / Tackle / Bait
const STATS = {
  rod: [['Reach', 'castDistance', (v) => `${v} m`], ['Steady', 'steadiness', (v) => `${Math.round(v * 100)}`], ['Power', 'rodPower', (v) => `${v.toFixed(2)}×`], ['Rated', 'rating', (v) => `${v} kg`]],
  reel: [['Reel speed', 'reelSpeed', (v) => `${v.toFixed(2)}×`]],
  line: [['Strength', 'strength', (v) => `${v} kg`]],
  bait: [['Lure', 'attraction', (v) => `${v.toFixed(2)}×`]],
  hook: [['Hold', 'hookHold', (v) => `${v.toFixed(2)}×`], ['Bite window', 'biteWindow', (v) => `${v.toFixed(2)}×`]],
  sinker: [['Depth', 'depthReach', (v) => `${v} m`]],
  float: [['Bite window', 'biteWindow', (v) => `${v.toFixed(2)}×`]],
  leader: [['Leader', 'leader', (v) => `${v} kg`]],
  lure: [['Lure', 'lure', (v) => `${v.toFixed(2)}×`]],
  tool: [],
};

function baitBrings(state, baitId) {
  const fish = Object.entries(state.data.fish ?? {}).filter(([, f]) => f.bait?.includes(baitId));
  if (!fish.length) return null;
  const known = fish.filter(([id]) => state.profile.fishdex[id]).map(([, f]) => f.name);
  const unknown = fish.length - known.length;
  return `Brings ${[...known, unknown ? `${unknown} unknown` : null].filter(Boolean).join(', ')}.`;
}

function gearView(ctx, slot, drawer, setDrawer) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  const group = slotInfo(slot)?.group;
  const items = Object.entries(state.data.items?.[group] ?? {}).sort((a, b) => a[1].cost - b[1].cost);
  const equippedId = p.gear[slot];
  const tiles = items.map(([id, item]) => {
    const owned = economy.owns(slot, id);
    const equipped = slot === 'tool' ? owned : id === equippedId;
    const broken = slot === 'rod' && p.condition?.rodBroken?.[id];
    const stack = Number.isFinite(item.stack) ? economy.stackOf(id) : null;
    const value = equipped && slot !== 'tool' ? h('span.tile__state', 'In use')
      : owned && slot === 'tool' ? h('span.tile__state', 'Owned')
      : owned && !Number.isFinite(item.stack) ? h('span.tile__state', 'Owned')
      : item.unlimited ? h('span.tile__state', 'Free')
      : money(item.cost);
    return Tile({
      art: artPath(state, `gear.${slot}.${id}`),
      icon: SLOT_ICON[slot],
      name: item.name,
      value,
      state: broken ? 'broken' : equipped ? 'equipped' : owned ? 'owned' : null,
      badge: stack ? `×${stack}` : null,
      label: `${item.name}${broken ? ', broken' : equipped ? ', in use' : owned ? ', owned' : `, ${fmt(item.cost)} coins`}`,
      onTap: () => setDrawer(() => drawer.open(...gearDrawer(ctx, slot, id, item, drawer))),
    });
  });
  // the repair / re-spool spot, only when something needs it
  let plate = null;
  if (slot === 'rod' && (p.condition?.rodBroken?.[equippedId] || economy.rodStrain() > 0.5)) {
    const cost = economy.repairCost();
    plate = Plate([ico('wrench'), h('span', p.condition.rodBroken?.[equippedId] ? 'Repair rod' : 'Mend rod'), money(cost)], () => {
      const r = economy.repairRod();
      if (r.ok) ui.toast('Your rod is good as new');
      else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
    }, { disabled: cost > p.coins });
  } else if (slot === 'line' && (p.condition?.lineWear ?? 0) > 0.25) {
    const cost = economy.respoolCost();
    plate = Plate([ico('line'), h('span', `Re-spool (${Math.round(p.condition.lineWear * 100)}% worn)`), money(cost)], () => {
      const r = economy.respool();
      if (r.ok) ui.toast('Fresh line on the reel');
      else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
    });
  }
  return { grid: TileGrid(tiles, { label: slotInfo(slot)?.label ?? slot }), plate };
}

// What a better rod opens up (Casper 9 Nov: buying gear should always say what you get): fish
// whose water is newly in casting reach, monsters it is now strong enough to land, and how much
// further it throws (further out = bigger, rarer fish).
const REACH = { open: 24, deep: 30, abyss: 40 };
function rodUnlocks(state, item, cur) {
  const island = state.world?.islandId || 'driftwood_cove';
  const cast = item.stats?.castDistance ?? 0, rating = item.stats?.rating ?? 0;
  const cast0 = cur?.stats?.castDistance ?? 0, rating0 = cur?.stats?.rating ?? 0;
  const fresh = [];
  for (const [fid, f] of Object.entries(state.data.fish ?? {})) {
    if (!f || f.island !== island) continue;
    const need = REACH[state.data.fishBehaviour?.[fid]?.habitat];
    const reach = need && cast0 < need && cast >= need;
    const strong = f.minRating && rating0 < f.minRating && rating >= f.minRating;
    if (reach || strong) fresh.push(state.profile.fishdex?.[fid] ? f.name : `${f.name} (new)`);
  }
  const further = cast - cast0;
  const parts = [];
  if (fresh.length) parts.push(`Opens up: ${fresh.slice(0, 4).join(', ')}${fresh.length > 4 ? ` +${fresh.length - 4} more` : ''}.`);
  if (further > 0) parts.push(`Casts ${further} m further: out there the fish run bigger and rarer.`);
  return parts.join(' ') || null;
}

function gearDrawer(ctx, slot, id, item, drawer) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  const equippedId = p.gear[slot];
  const equipped = equippedId ? economy.item(slot, equippedId) : null;
  const owned = economy.owns(slot, id);
  const isTool = slot === 'tool';
  const isEquipped = !isTool && id === equippedId;
  const rows = (STATS[slot] ?? []).map(([label, key, f]) => {
    const now = equipped?.stats?.[key];
    const then = item.stats?.[key];
    if (then == null) return null;
    if (isEquipped || now == null) return StatRow(label, f(then), null);
    return StatRow(label, f(now), f(then), then > now ? true : then < now ? false : null);
  });
  const lines = [];
  if (slot === 'bait') lines.push(baitBrings(state, id));
  if (slot === 'lure' && item.targets?.length) lines.push(`Best for ${item.targets.map((t) => state.data.fish?.[t]?.name ?? t).join(', ')}.`);
  if (isTool) lines.push(TOOL_LINE[id] ?? null);
  if (slot === 'rod' && !isEquipped) lines.push(rodUnlocks(state, item, equipped));
  if (slot === 'rod' && item.unbreakable) lines.push('Never breaks.');
  if (slot === 'rod' && isEquipped && economy.rodStrain() > 0) lines.push(p.condition.rodBroken?.[id] ? 'Broken. Repair it here at the counter.' : `Strained ${Math.round(economy.rodStrain() * 100)}%.`);
  if (slot === 'line' && isEquipped && p.condition.lineWear > 0.01) lines.push(`${Math.round(p.condition.lineWear * 100)}% worn.`);

  const buy = (packs = 1) => (e) => {
    const r = economy.buyItem(slot, id, packs);
    if (r.ok) ui.toast(Number.isFinite(item.stack) ? `+${r.added} ${item.name}` : `Bought the ${item.name}`);
    else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
  };
  const actions = [];
  const short = (n) => item.cost * n > p.coins;
  if (Number.isFinite(item.stack)) {
    actions.push(Plate([h('span', `×${item.stack}`), money(item.cost)], buy(1), { disabled: short(1), kind: 'wood', label: `Buy ${item.stack} for ${fmt(item.cost)}` }));
    actions.push(Plate([h('span', `×${item.stack * 4}`), money(item.cost * 4)], buy(4), { disabled: short(4), label: `Buy ${item.stack * 4} for ${fmt(item.cost * 4)}` }));
    if (owned && !isEquipped) actions.unshift(Plate('Use', () => { economy.equipItem(slot, id); }, { kind: 'wood' }));
  } else if (isTool) {
    actions.push(owned ? h('p.drawer__done', ico('check'), 'Always with you') : Plate([h('span', 'Buy'), money(item.cost)], buy(1), { disabled: short(1) }));
  } else if (slot === 'rod' && owned && p.condition.rodBroken?.[id]) {
    // A broken rod (in use or not): repair it here, with a clear answer either way.
    const cost = economy.repairCost(id);
    actions.push(Plate([ico('wrench'), h('span', 'Repair'), money(cost)], () => {
      const r = economy.repairRod(id);
      if (r.ok) { ui.toast('Your rod is good as new'); drawer.close(); }
      else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
    }, { disabled: cost > p.coins }));
  } else if (!owned && !item.unlimited) {
    actions.push(Plate([h('span', 'Buy'), money(item.cost)], buy(1), { disabled: short(1) }));
  } else if (!isEquipped) {
    actions.push(Plate('Use this', () => economy.equipItem(slot, id)));
  } else {
    if (slot === 'rod' && (p.condition.rodBroken?.[id] || economy.rodStrain() > 0)) {
      const cost = economy.repairCost(id);
      actions.push(Plate([ico('wrench'), h('span', 'Mend'), money(cost)], () => {
        const r = economy.repairRod(id);
        if (r.ok) { ui.toast('Your rod is good as new'); drawer.close(); }
        else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
      }, { disabled: cost > p.coins }));
    } else if (slot === 'line' && p.condition.lineWear > 0.01) {
      actions.push(Plate([h('span', 'Re-spool'), money(economy.respoolCost())], () => economy.respool()));
    } else actions.push(h('p.drawer__done', ico('check'), 'In use'));
    if (slotInfo(slot)?.optional) actions.push(Plate('Take off', () => economy.equipItem(slot, null), { kind: 'wood' }));
  }
  const stack = Number.isFinite(item.stack) ? economy.stackOf(id) : null;
  return [
    showcase(artPath(state, `gear.${slot}.${id}`), slot === 'line' ? null : item.model),
    h('h3.drawer__title', item.name, stack ? h('span.drawer__stack.t-num', ` ×${stack}`) : null),
    h('p.drawer__line', item.flavour),
    rows.some(Boolean) ? h('div.drawer__stats', rows) : null,
    ...lines.filter(Boolean).map((l) => h('p.drawer__note', l)),
    h('div.drawer__actions', actions),
  ];
}

// ---------------------------------------------------------------- Build: buildings, land, piers, boats, crew
function levelPath(def, current) {
  return h('ol.levelpath', def.levels.slice(1).map((l, i) => h(`li${i + 1 <= current ? '.is-done' : ''}${i + 1 === current + 1 ? '.is-next' : ''}`, h('span.t-num', `${i + 1}`), h('span', l.name))));
}

function buildingLine(state, id, lvl) {
  if (!lvl) return '';
  switch (id) {
    case 'shop': return lvl.sellBonus ? `Buyers pay ${Math.round(lvl.sellBonus * 100)}% more.` : 'Buyers pay the going rate.';
    case 'cooler': return `Holds ${lvl.capacity} fish.`;
    case 'workers_hut': return `Bunks for ${lvl.slots}${lvl.rateMult > 1 ? `, ${Math.round((lvl.rateMult - 1) * 100)}% faster` : ''}.`;
    case 'smokehouse': return `Crew catch sells for ${Math.round((lvl.crewBonus ?? 0) * 100)}% more.`;
    case 'aquarium': return `${lvl.coinsPerSpeciesHour ?? 0} an hour per species.`;
    case 'boat_dock': return `Fits a ${(Object.values(state.data.economy?.boats ?? {}).find((b) => b?.tier === lvl.maxBoat)?.name ?? 'boat').toLowerCase()}.`;
    case 'net_rig':
    case 'reel_mill': return `Earns ${lvl.coinsPerHour ?? 0} an hour on its own.`;
    case 'cannery': return `${lvl.coinsPerHour ?? 0} an hour, and all idle income +${Math.round((lvl.factoryBonus ?? 0) * 100)}%.`;
    default: return '';
  }
}

function buildView(ctx, sub, drawer, setDrawer) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  if (isVisitor(state)) return { grid: TileGrid([], { label: 'Build', empty: `This is ${hostName(state)}'s island. Build on your own.` }) };
  const plots = state.data.economy?.plots ?? {};
  const plotName = (id) => plots[id]?.name ?? id;
  const start = (kind, id) => {
    const r = economy.startBuild(kind, id);
    if (r.ok) { ui.close(); ui.toast(kind === 'plot' ? `${r.name}: rising from the sea` : `${r.name}: choose a spot`); }
    else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
    else if (r.reason === 'site') ui.toast(`Raise ${plotName(r.plot)} first`, 'danger');
    else if (r.reason === 'busy') ui.toast('Finish the build you started first', 'danger');
  };
  let tiles = [];
  if (sub === 'buildings') {
    tiles = BUILDINGS.map((id) => {
      const b = economy.building(id);
      const level = b.built && b.index > 0 ? b.index : 0;
      const next = b.next;
      const art = artPath(state, `building.${id}.l${Math.max(1, next ? level + 1 : level)}`);
      return Tile({
        art, icon: ctx.ui.buildingIcon(id), name: b.def.name,
        value: next ? money(next.cost) : h('span.tile__state', 'Finished'),
        state: !next ? 'owned' : !b.siteOwned ? 'locked' : null,
        badge: level ? `L${level}` : null,
        onTap: () => setDrawer(() => {
          const bb = economy.building(id);
          const nn = bb.next;
          const lvlNow = bb.built && bb.index > 0 ? bb.index : 0;
          drawer.open(
            showcase(artPath(state, `building.${id}.l${Math.max(1, nn ? lvlNow + 1 : lvlNow)}`), nn?.model ?? bb.model ?? null, 'world'),
            h('h3.drawer__title', nn ? nn.name : bb.name),
            h('p.drawer__line', nn ? `${nn.about ?? ''} ${buildingLine(state, id, nn)}` : buildingLine(state, id, bb)),
            levelPath(bb.def, lvlNow),
            !bb.siteOwned ? h('p.drawer__note', `Stands on ${plotName(bb.def.site)}. Raise it first.`) : null,
            h('div.drawer__actions', nn
              ? Plate([h('span', lvlNow ? 'Upgrade' : 'Place it'), money(nn.cost)], () => start('building', id), { disabled: !bb.siteOwned || nn.cost > p.coins })
              : h('p.drawer__done', ico('check'), 'Finished'),
              // Move it anywhere on your land, any time, for free (Casper 10 Nov: customise the island).
              lvlNow ? h('button.btn.drawer__move', { type: 'button', on: { click: () => {
                const r = economy.moveBuilding(id);
                if (r.ok) { ui.close(); ui.toast(`${r.name}: drag it to its new place`); }
                else if (r.reason === 'busy') ui.toast('Finish the build you started first', 'danger');
              } } }, 'Move') : null));
        }),
      });
    });
  } else if (sub === 'land') {
    const next = economy.nextPlot();
    tiles = Object.entries(plots).filter(([k]) => !k.startsWith('_') && k !== 'sandbar').sort((a, b) => a[1].order - b[1].order).map(([id, def]) => {
      const owned = p.island.plots.includes(id);
      return Tile({
        icon: 'plot', name: def.name,
        value: owned ? h('span.tile__state', 'Yours') : money(def.cost),
        state: owned ? 'owned' : id === next ? null : 'locked',
        onTap: () => setDrawer(() => drawer.open(
          showcase(null, def.model, 'world'),
          h('h3.drawer__title', def.name),
          h('p.drawer__line', def.about),
          h('div.drawer__actions', owned ? h('p.drawer__done', ico('check'), 'Yours')
            : id === next ? Plate([h('span', 'Raise it'), money(def.cost)], () => start('plot', id), { disabled: def.cost > p.coins })
            : h('p.drawer__note', `Raise ${plotName(next)} first.`)))),
      });
    });
  } else if (sub === 'decor') {
    // Decorations: buy as many as you like and set each down anywhere on your land.
    const D = state.data.economy?.decor ?? {};
    const have = p.island.decor ?? [];
    const count = (item) => have.filter((d) => d.item === item).length;
    tiles = Object.entries(D.items ?? {}).map(([id, def]) => Tile({
      icon: 'plot', name: def.name,
      value: money(def.cost),
      state: def.cost > p.coins ? 'locked' : null,
      onTap: () => setDrawer(() => drawer.open(
        showcase(null, def.model, 'world'),
        h('h3.drawer__title', def.name),
        h('p.drawer__line', `Set it down anywhere on your land. You have ${count(id)} on the island.`),
        h('div.drawer__actions',
          Plate([h('span', 'Place one'), money(def.cost)], () => {
            const r = economy.buyDecor(id);
            if (r.ok) { ui.close(); ui.toast(`${r.name}: drag it where you want it`); }
            else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
            else if (r.reason === 'full') ui.toast('The island is full of decorations', 'danger');
            else if (r.reason === 'busy') ui.toast('Finish the build you started first', 'danger');
          }, { disabled: def.cost > p.coins }),
          have.length ? h('button.btn.drawer__move', { type: 'button', on: { click: () => {
            const r = economy.removeLastDecor();
            if (r.ok) ui.toast(`${r.name ?? 'Decoration'} taken back${r.refund ? `: +${fmt(r.refund)} coins` : ''}`);
          } } }, 'Take back last') : null))),
    }));
  } else if (sub === 'piers') {
    const next = economy.nextPier();
    tiles = Object.entries(state.data.economy?.piers ?? {}).filter(([k]) => !k.startsWith('_')).map(([id, def]) => {
      const owned = p.island.piers.includes(id);
      const isNext = next?.id === id;
      return Tile({
        icon: 'pier', name: def.name,
        value: owned ? h('span.tile__state', `${def.depth} m`) : money(def.cost),
        state: owned ? 'owned' : isNext && next.plotOwned ? null : 'locked',
        onTap: () => setDrawer(() => drawer.open(
          h('h3.drawer__title', def.name),
          h('p.drawer__line', `${def.about} Water ${def.depth} m deep.`),
          h('div.drawer__actions', owned ? h('p.drawer__done', ico('check'), 'Built')
            : isNext && next.plotOwned ? Plate([h('span', 'Build it'), money(def.cost)], () => start('pier', id), { disabled: def.cost > p.coins })
            : h('p.drawer__note', isNext ? `Needs ${plotName(def.plot)}.` : 'Build the piers before it first.')))),
      });
    });
  } else if (sub === 'boats') {
    const cur = economy.boat();
    const nb = economy.nextBoat();
    tiles = Object.entries(state.data.economy?.boats ?? {}).filter(([k]) => !k.startsWith('_')).sort((a, b) => a[1].tier - b[1].tier).map(([id, def]) => {
      const owned = def.tier <= cur.tier;
      const isNext = nb?.id === id;
      return Tile({
        icon: 'boat', name: def.name,
        value: id === cur.id ? h('span.tile__state', 'Yours') : owned ? h('span.tile__state', 'Sold') : money(def.cost),
        state: id === cur.id ? 'equipped' : owned ? 'owned' : isNext && nb.dockFits ? null : 'locked',
        onTap: () => setDrawer(() => drawer.open(
          showcase(null, id, 'boats'),
          h('h3.drawer__title', def.name),
          h('p.drawer__line', def.about),
          h('div.drawer__actions', id === cur.id ? h('p.drawer__done', ico('check'), 'Tied up at your dock')
            : isNext && nb.dockFits ? Plate([h('span', 'Buy'), money(def.cost)], () => { const r = economy.buyBoat(id); if (r.ok) ui.toast(`The ${r.name} is tied up at the dock`); }, { disabled: def.cost > p.coins })
            : h('p.drawer__note', isNext ? 'Needs a bigger boat dock.' : owned ? 'Traded in for a better boat.' : 'Buy the boats before it first.')))),
      });
    });
  } else {
    // crew: everyone you hired, one tile to hire, one for the night watch
    const slots = economy.crewSlots();
    const bunks = economy.crewBunks();
    tiles = p.workers.map((w) => Tile({ icon: 'hat', name: w.name, value: h('span.tile__state', 'Fishing'), state: 'owned', onTap: () => {} }));
    const canHire = p.workers.length < slots;
    tiles.push(Tile({
      icon: 'crew', name: 'Hire a fisher', value: canHire ? money(economy.hireCost()) : h('span.tile__state', bunks ? 'No room' : 'No hut'),
      state: canHire ? null : 'locked',
      onTap: () => setDrawer(() => drawer.open(
        h('h3.drawer__title', 'Hire a fisher'),
        h('p.drawer__line', `About ${fmt(economy.incomeRates().crew * 60 / Math.max(1, p.workers.length) || 4.7)} coins a minute each, also while you are away.`),
        h('p.drawer__note', `${p.workers.length} of ${slots} places. ${bunks === 0 ? "Build the workers' hut first." : p.workers.length >= bunks ? 'A bigger hut makes room.' : p.workers.length >= slots ? 'A pier or new land gives them a spot.' : ''}`),
        h('div.drawer__actions', canHire
          ? Plate([h('span', 'Hire'), money(economy.hireCost())], () => { const r = economy.hireWorker(); if (r.ok) ui.toast(`${r.name} joined your crew`); else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger'); }, { disabled: economy.hireCost() > p.coins })
          : null))),
    }));
    const watch = economy.nextWatch();
    tiles.push(Tile({
      icon: 'hourglass', name: 'Night watch', value: watch ? money(watch.cost) : h('span.tile__state', `${economy.offlineCapHours()} h`),
      state: watch ? null : 'owned',
      onTap: () => setDrawer(() => drawer.open(
        h('h3.drawer__title', watch ? watch.name : 'Night watch'),
        h('p.drawer__line', `The harbour earns for ${economy.offlineCapHours()} h while you are away${watch ? `; this makes it ${watch.hours} h` : ''}.`),
        h('div.drawer__actions', watch
          ? Plate([h('span', 'Hire'), money(watch.cost)], () => { const r = economy.buyWatch(); if (r.ok) ui.toast(`${r.name}: ${r.hours} hours`); }, { disabled: watch.cost > p.coins })
          : h('p.drawer__done', ico('check'), 'The harbour never sleeps')))),
    }));
  }
  return { grid: TileGrid(tiles, { label: sub }) };
}

export { fmtDuration, plural };
