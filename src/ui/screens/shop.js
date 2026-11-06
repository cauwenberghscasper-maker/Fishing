// Agent B. The harbour shop: sell the cooler, buy gear, grow the harbour (crew, buildings, land, night watch).
import { h, ico, fmt, fmtKg, money, fishWindow, plural, fmtDuration, fill } from '../dom.js';
import { fishPreview } from '../../economy/data.js';
import { SLOTS, BUILDINGS, sizeClassById, marketMult } from '../../economy/rules.js';

const TABS = [
  { id: 'sell', label: 'Sell' },
  { id: 'buy', label: 'Buy gear' },
  { id: 'harbour', label: 'Harbour' },
];
const SUBTITLE = {
  sell: 'Sell what is in your cooler.',
  buy: 'Rods, reels, lines and bait.',
  harbour: 'Crew, buildings and land.',
};
const GROUP_TITLE = { rod: 'Rods', reel: 'Reels', line: 'Lines', bait: 'Bait' };

export function sheetHead(title, subtitle, onClose) {
  return h('header.sheet__head',
    h('div.sheet__title', h('h2', title), subtitle ? h('p', subtitle) : null),
    h('button.btn.btn--round.sheet__close', { 'aria-label': 'Close', on: { click: onClose } }, ico('close')));
}

/** Re-render a sheet body while keeping the scroll position. */
export function keepScroll(root, fn) {
  const body = root.querySelector('.sheet__body');
  const y = body?.scrollTop ?? 0;
  fn();
  const nb = root.querySelector('.sheet__body');
  if (nb) nb.scrollTop = y;
}

export function shopSheet(ctx, { tab = 'sell', focus = null } = {}) {
  const { state, economy, ui } = ctx;
  let current = tab;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Shop' });

  function render() {
    const shopName = economy.building('shop')?.name ?? 'Shop';
    const tabs = h('div.tabs', { role: 'tablist' }, TABS.map((t) => h('button.tab', {
      role: 'tab',
      'aria-selected': String(t.id === current),
      on: { click: () => { current = t.id; focus = null; render(); root.querySelector('.sheet__body').scrollTop = 0; } },
    }, t.id === 'sell' && state.profile.cooler.length ? `${t.label} (${state.profile.cooler.length})` : t.label)));
    const parts = current === 'sell' ? sellTab(ctx) : current === 'buy' ? buyTab(ctx) : harbourTab(ctx);
    fill(root, 
      sheetHead(shopName, SUBTITLE[current], () => ui.close()),
      tabs,
      h('div.sheet__body', { role: 'tabpanel' }, parts.body),
      parts.foot ?? null,
    );
  }

  render();
  return {
    id: 'shop',
    el: root,
    refresh: () => keepScroll(root, render),
    onOpen: () => {
      if (!focus) return;
      const target = root.querySelector(`[data-focus="${focus}"]`);
      target?.scrollIntoView({ block: 'start' });
    },
  };
}

// ---------------------------------------------------------------- sell
function sellTab({ state, economy, ui }) {
  const p = state.profile;
  const fishData = state.data.fish ?? {};
  const hotId = economy.hotFish();
  const body = [];

  if (hotId && fishData[hotId]) {
    const bonus = Math.round(((state.data.economy?.market?.hotFish?.bonus ?? 1.5) - 1) * 100);
    body.push(h('p.hot-line', ico('flame'), h('span', `Buyers want ${fishData[hotId].name} today. They pay ${bonus}% more for it.`)));
  }

  if (!p.cooler.length) {
    body.push(h('div.empty', h('strong', 'Nothing to sell'), 'Your cooler is empty. Cast a line from the pier and bring something back.'));
    return { body, foot: null };
  }

  const list = h('ul.lots');
  for (const c of p.cooler) {
    const f = fishData[c.fishId] ?? { name: c.fishId };
    const size = sizeClassById(state.data, c.sizeClass);
    const price = economy.price(c);
    const mult = marketMult(state.data, p, c.fishId, 0, null);
    list.append(h('li.lot',
      fishWindow('lot__mark', fishPreview(state, c.fishId)),
      h('div.lot__main',
        h('div.lot__name', f.name),
        h('div.lot__meta',
          h('span.t-num', fmtKg(c.weight)),
          size ? h(`span.stamp.stamp--${size.id}`, size.name) : null,
          c.fishId === hotId ? h('span.pebble.pebble--amber', 'In demand') : null,
          mult < 0.95 ? h('span.lot__drop', 'Price falling') : null)),
      h('div.lot__sell',
        h('button.btn', { 'aria-label': `Sell ${f.name} for ${fmt(price)}`, on: { click: () => { economy.sellCatch(c.id); } } }, money(price)))));
  }
  body.push(list);

  const { total } = economy.sellAllPreview();
  const cap = economy.coolerCapacity();
  const foot = h('footer.sheet__foot',
    h('p.foot-note', h('b.t-num', `${p.cooler.length} of ${cap}`), ' ', h('br'), 'in your cooler'),
    h('button.btn.btn--primary', {
      on: { click: () => { const r = economy.sellAll(); if (r.ok) ui.toast(`Sold ${plural(r.count, 'fish', 'fish')} for ${fmt(r.total)}`); } },
    }, h('span', 'Sell all for'), h('span.t-num', fmt(total))));
  return { body, foot };
}

// ---------------------------------------------------------------- buy
const STAT_ROWS = {
  rod: [
    { key: 'castDistance', label: 'Reach', fmt: (v) => `${v} m`, diff: (d) => `${d > 0 ? '+' : ''}${d}` },
    { key: 'steadiness', label: 'Steady', fmt: (v) => `${Math.round(v * 100)}`, diff: (d) => `${d > 0 ? '+' : ''}${Math.round(d * 100)}` },
    { key: 'rodPower', label: 'Power', fmt: (v) => `${v.toFixed(2)}×`, diff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}` },
  ],
  reel: [{ key: 'reelSpeed', label: 'Reel speed', fmt: (v) => `${v.toFixed(2)}×`, diff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}` }],
  line: [{ key: 'lineStrength', label: 'Strength', fmt: (v) => `${v.toFixed(2)}×`, diff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}` }],
  bait: [{ key: 'attraction', label: 'Lure', fmt: (v) => `${v.toFixed(2)}×`, diff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}` }],
};

function baitBrings(state, baitId) {
  const fish = Object.entries(state.data.fish ?? {}).filter(([, f]) => f.bait?.includes(baitId));
  if (!fish.length) return null;
  const known = fish.filter(([id]) => state.profile.fishdex[id]).map(([, f]) => f.name);
  const unknown = fish.length - known.length;
  const parts = [...known];
  if (unknown) parts.push(unknown === 1 ? 'one fish you have not met' : `${unknown} fish you have not met`);
  return `Brings ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0]}.`;
}

function buyTab(ctx) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  const body = [];
  for (const { slot, group } of SLOTS) {
    const all = Object.entries(state.data.items?.[group] ?? {}).sort((a, b) => a[1].cost - b[1].cost);
    const owned = all.filter(([id]) => p.owned[group].includes(id));
    const next = all.filter(([id]) => !p.owned[group].includes(id)).slice(0, 2);
    const equippedId = p.gear[slot];
    const equipped = economy.item(slot, equippedId);
    // older rods, reels and lines are strictly worse: keep them in the locker. Every bait brings different fish: show all.
    const eqCost = equipped?.cost ?? 0;
    const ownedShown = slot === 'bait' ? owned : owned.filter(([id, it]) => id === equippedId || it.cost >= eqCost);
    const older = owned.length - ownedShown.length;
    body.push(h('h3.section-title', { 'data-focus': slot }, GROUP_TITLE[slot]));
    const list = h('ul.gear-list');
    for (const [id, item] of [...ownedShown, ...next]) list.append(gearTag(ctx, slot, id, item, equippedId, equipped));
    if (older > 0) list.append(h('li.slot-label.locker-note', `${plural(older, 'older piece')} in your locker.`));
    body.push(list);
  }
  return { body };
}

function gearTag({ state, economy, ui }, slot, id, item, equippedId, equipped) {
  const p = state.profile;
  const isEquipped = id === equippedId;
  const isOwned = economy.owns(slot, id);
  const stats = h('ul.gear__stats', STAT_ROWS[slot].map((row) => {
    const v = item.stats?.[row.key] ?? 0;
    const d = v - (equipped?.stats?.[row.key] ?? 0);
    const dEl = !isEquipped && Math.abs(d) > 1e-6 ? h(`span.d.${d > 0 ? 'd--up' : 'd--down'}`, row.diff(d)) : null;
    return h('li', row.label, h('span.v', row.fmt(v)), dEl);
  }));

  let note = null;
  let button;
  if (isEquipped) {
    button = h('span.in-use', ico('check'), 'In use');
  } else if (isOwned) {
    button = h('button.btn', { on: { click: () => { economy.equipItem(slot, id); ui.toast(`${item.name} is ready`); } } }, 'Use this');
  } else {
    const short = item.cost - p.coins;
    button = h('button.btn', {
      'aria-disabled': short > 0 ? 'true' : null,
      'aria-label': `Buy ${item.name} for ${fmt(item.cost)}`,
      on: {
        click: () => {
          const r = economy.buyItem(slot, id);
          if (r.ok) ui.toast(`Bought the ${item.name}`);
          else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need)} more coins`, 'danger');
        },
      },
    }, money(item.cost));
    note = short > 0 ? `${fmt(short)} more to go` : equipped ? `Replaces ${equipped.name}` : null;
  }
  if (slot === 'bait') note = baitBrings(state, id) ?? note;

  return h(`li.gear.tag${isEquipped ? '.is-equipped' : ''}`,
    h('div.gear__head', h('h4.gear__name', item.name)),
    h('p.gear__flavour', item.flavour),
    stats,
    h('div.gear__foot', h('span.slot-label', note ?? ''), button));
}

// ---------------------------------------------------------------- harbour
function buildingEffect(state, id, lvl) {
  if (!lvl) return '';
  switch (id) {
    case 'shop': return lvl.sellBonus ? `Buyers pay ${Math.round(lvl.sellBonus * 100)}% more for every fish.` : 'Buyers pay the going rate.';
    case 'cooler': return `Holds ${lvl.capacity} fish.`;
    case 'workers_hut': return `Room for ${lvl.slots} fishers${lvl.rateMult > 1 ? `, who work ${Math.round((lvl.rateMult - 1) * 100)}% faster` : ''}.`;
    case 'smokehouse': return lvl.crewBonus ? `The crew's catch sells for ${Math.round(lvl.crewBonus * 100)}% more.` : 'Smokes the crew’s catch so it sells for more.';
    case 'aquarium': return lvl.coinsPerSpeciesHour ? `Visitors pay ${lvl.coinsPerSpeciesHour} an hour for each species in your logbook.` : 'Visitors would pay to see your logbook species.';
    case 'boat_dock': {
      const isle = Object.values(state.data.islands ?? {}).find((i) => i.index === lvl.reach);
      return `Your boat reaches as far as ${isle?.name ?? `island ${lvl.reach}`}.`;
    }
    default: return '';
  }
}

function priceButton({ state, ui }, cost, label, action, okText) {
  const short = cost - state.profile.coins;
  return h('button.btn', {
    'aria-disabled': short > 0 ? 'true' : null,
    'aria-label': `${label} for ${fmt(cost)}`,
    on: {
      click: () => {
        const r = action();
        if (r.ok) ui.toast(okText(r));
        else if (r.reason === 'coins') ui.toast(`You need ${fmt(r.need ?? short)} more coins`, 'danger');
      },
    },
  }, money(cost));
}

function work(icon, name, now, next, extra = null, focusId = null) {
  return h('li.work', focusId ? { 'data-focus': focusId } : null,
    h('div.work__icon', ico(icon)),
    h('div.work__name', name, extra),
    h('div.work__now', now),
    next);
}

function knots(level, total) {
  return h('span.knots', { 'aria-label': `Stage ${level + 1} of ${total}` }, Array.from({ length: total }, (_, i) => h(`i${i <= level ? '.on' : ''}`)));
}

function harbourTab(ctx) {
  const { state, economy, ui } = ctx;
  const p = state.profile;
  const body = [];
  const rates = economy.incomeRates();

  // crew
  body.push(h('h3.section-title', { 'data-focus': 'crew' }, 'Crew'));
  const crew = h('ul.works');
  const slots = economy.crewSlots();
  const names = p.workers.map((w) => w.name);
  const crewNow = names.length
    ? `${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0]} ${names.length > 1 ? 'fish' : 'fishes'} the shallows for you: about ${fmt(rates.crew * 60)} coins a minute, also while you are away.`
    : 'Nobody fishes for you yet. A hired fisher works the shallows all day and keeps going while you are away.';
  const hireNext = p.workers.length < slots
    ? h('div.work__next', h('p', `${p.workers.length} of ${slots} bunks taken.`), priceButton(ctx, economy.hireCost(), 'Hire a fisher', () => economy.hireWorker(), (r) => `${r.name} joined your crew`))
    : h('div.work__next', h('p', `All ${slots} bunks are taken. A bigger workers' hut or new land makes room.`));
  crew.append(work('hat', 'Hire a fisher', crewNow, hireNext));

  const watch = economy.nextWatch();
  const capH = economy.offlineCapHours();
  crew.append(work('hourglass', 'Night watch', `Your harbour keeps earning for up to ${capH} hours while you are away.`,
    watch
      ? h('div.work__next', h('p', h('b', watch.name), `: ${watch.hours} hours.`, h('i', watch.about)), priceButton(ctx, watch.cost, watch.name, () => economy.buyWatch(), (r) => `${r.name}: the harbour now earns for ${r.hours} hours`))
      : h('div.work__next', h('p', 'The harbour never sleeps.'))));
  body.push(crew);

  // buildings
  body.push(h('h3.section-title', { 'data-focus': 'buildings' }, 'Buildings'));
  const list = h('ul.works');
  for (const id of BUILDINGS) {
    const b = economy.building(id);
    if (!b) continue;
    const built = !(b.index === 0 && b.name === 'Not built');
    const title = built ? b.name : b.def.name;
    const now = built ? buildingEffect(state, id, b) : `Not built yet. ${b.def.about}`;
    const next = b.next
      ? h('div.work__next', h('p', `${built ? 'Next' : 'Build'}: `, h('b', b.next.name), '. ', buildingEffect(state, id, b.next)),
        priceButton(ctx, b.next.cost, `${built ? 'Upgrade to' : 'Build'} ${b.next.name}`, () => economy.upgradeBuilding(id), (r) => `${b.def.name}: now the ${r.name}`))
      : h('div.work__next', h('p', 'As good as it gets.'));
    list.append(work(ui.buildingIcon(id), title, now, next, knots(b.index, b.def.levels.length), id));
  }
  body.push(list);

  // land
  body.push(h('h3.section-title', { 'data-focus': 'land' }, 'Land'));
  const land = h('ul.works');
  const nextPlot = economy.nextPlot();
  const plots = state.data.economy?.plots ?? {};
  if (nextPlot) {
    const def = plots[nextPlot];
    land.append(work('plot', def.name, def.about,
      h('div.work__next', h('p', 'Raise it from the sea.'), priceButton(ctx, def.cost, `Raise ${def.name}`, () => economy.buyPlot(nextPlot), (r) => `${r.name} rose from the sea`))));
  }
  if (p.island.plots.length) {
    land.append(h('li.crew-names', `Your land: ${p.island.plots.map((id) => plots[id]?.name ?? id).join(', ')}.`));
  } else if (!nextPlot) {
    land.append(h('li.crew-names', 'Every plot is raised.'));
  }
  body.push(land);
  return { body };
}

export { fmtDuration };
