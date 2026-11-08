// Agent B. All UI except Agent A's in-world fishing controls (#hud-fishing) and Agent H's co-op controls (#hud-net).
import './theme.css';
import './ui.css';
import './places.css';
import './kit.css';
import { h, ico, fmt, fmtKg, money, artImg } from './dom.js';
import { economy } from '../economy/index.js';
import { artPath } from '../economy/data.js';
import { fullName } from '../economy/rules.js';
import { catchReveal } from './screens/reveal.js';
import { sfx, initSfx } from './sfx.js';
import { shopSheet } from './screens/shop.js';
import { travelSheet } from './screens/travel.js';
import { logbookSheet } from './screens/logbook.js';
import { settingsSheet } from './screens/settings.js';
import { offlineLetter } from './screens/offline.js';
import { coolerSheet } from './screens/cooler.js';
import { titleScreen } from './screens/title.js';
import { isVisitor, playerName } from './net.js';

const BUILDING_ICONS = { shop: 'scale', cooler: 'cooler', workers_hut: 'hat', smokehouse: 'flame', aquarium: 'fish', boat_dock: 'boat' };
const EMOTES = { wave: 'waves', cheer: 'cheers', big_one: 'shouts "Big one!"', bigone: 'shouts "Big one!"', point: 'points at the water' };

function injectFonts() {
  if (document.querySelector('link[data-ui-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'fonts/fonts.css';
  link.dataset.uiFonts = '';
  document.head.append(link);
}

/** The title screen is for players: automated runs (navigator.webdriver) and ?notitle skip it; ?title=1 forces it. */
function wantsTitle() {
  const q = new URLSearchParams(location.search);
  if (q.has('title')) return q.get('title') !== '0';
  if (q.has('notitle')) return false;
  return !navigator.webdriver;
}

export async function startUI({ root, state, events }) {
  injectFonts();

  const ctx = { state, events, economy, ui: null };
  initSfx(() => state.profile?.settings?.sound !== false);

  // ------------------------------------------------------------ layers
  const hudLayer = h('div.ui-layer.hud-layer');
  const modalHost = h('div.ui-layer.modal-host');
  root.prepend(hudLayer);
  root.append(modalHost);

  // ------------------------------------------------------------ toasts
  const toasts = h('div.toasts', { 'aria-live': 'polite' });
  function toast(content, kind = '', { art = null, ms = 2600 } = {}) {
    const t = h(`div.toast${kind ? '.toast--' + kind : ''}`);
    const img = artImg(art, 'toast__emblem', { alt: '' });
    if (img) t.append(img);
    t.append(...[content].flat());
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 280); }, ms);
  }

  // ------------------------------------------------------------ modal manager
  let current = null;
  let titleUp = false;
  const queue = [];
  function mount(view) {
    current = view;
    const layer = h(`div.modal-layer${view.layerClass ? '.' + view.layerClass : ''}`, { on: { click: (e) => { if (e.target === layer) dismiss(); } } }, view.el);
    if (view.layerStyle) for (const [k, v] of Object.entries(view.layerStyle)) layer.style.setProperty(k, v);
    view.layer = layer;
    modalHost.replaceChildren(layer);
    modalHost.style.pointerEvents = 'auto';
    view.el.setAttribute('tabindex', '-1');
    view.el.focus({ preventScroll: true });
    view.onOpen?.();
  }
  function open(view, { queued = false } = {}) {
    if ((current || titleUp) && queued) { queue.push(view); return; }
    const wasOpen = !!current || titleUp;
    if (current) current.onClose?.();
    mount(view);
    if (!wasOpen) events.emit('ui:modal', { open: true, id: view.id });
    actionDock.hidden = true;
  }
  function close() {
    if (!current) return;
    current.onClose?.();
    current = null;
    modalHost.replaceChildren();
    modalHost.style.pointerEvents = '';
    if (queue.length) { mount(queue.shift()); return; }
    events.emit('ui:modal', { open: false });
    actionDock.hidden = !actionZone;
  }
  function dismiss() {
    if (!current) return;
    if (current.dismiss) current.dismiss();
    else close();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });

  const ui = ctx.ui = {
    toast, open, close,
    get current() { return current; },
    openShop: (opts) => open(shopSheet(ctx, opts)),
    openCooler: () => open(coolerSheet(ctx)),
    openTravel: () => open(travelSheet(ctx)),
    openLogbook: () => open(logbookSheet(ctx)),
    openSettings: () => open(settingsSheet(ctx)),
    buildingIcon: (id) => BUILDING_ICONS[id] ?? 'hammer',
    flyCoins,
    atShop: () => actionZone?.kind === 'shop' || state.world?.zone === 'shop',
  };

  // ------------------------------------------------------------ top bar
  const coinsEl = h('span.purse__coins.t-num', fmt(state.profile.coins));
  const pearlsEl = h('span.t-num', fmt(state.profile.pearls));
  const pearlsBox = h('span.purse__pearls', ico('pearl'), pearlsEl);
  const sepEl = h('span.purse__sep');
  const plate = h('div.purse__plate.plaque', { role: 'status', 'aria-label': 'Coins and pearls' }, ico('coin'), coinsEl, sepEl, pearlsBox);
  const rateNum = h('span.t-num');
  const rateUnit = h('span');
  const rateFrom = h('span.purse__rate-from', ' from your harbour');
  const rateEl = h('div.purse__rate', rateNum, rateUnit, rateFrom);
  const coolerCount = h('span.badge-count.pebble.t-num');
  const coolerBtn = h('button.btn.btn--round', { 'aria-label': 'Cooler', on: { click: () => ui.openCooler() } }, ico('cooler'), coolerCount);
  const logBtn = h('button.btn.btn--round', { 'aria-label': 'Logbook', on: { click: () => ui.openLogbook() } }, ico('logbook'));
  const setBtn = h('button.btn.btn--round', { 'aria-label': 'Settings', on: { click: () => ui.openSettings() } }, ico('dividers'));
  const hudTop = h('div.hud-top',
    h('div.purse', plate, rateEl),
    h('div.hud-buttons', coolerBtn, logBtn, setBtn));

  let shownCoins = state.profile.coins;
  let tween = 0;
  function animateCoins(target) {
    cancelAnimationFrame(tween);
    const from = shownCoins;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 380);
      shownCoins = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      coinsEl.textContent = fmt(shownCoins);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
    if (target > from) { plate.classList.remove('coin-pop'); void plate.offsetWidth; plate.classList.add('coin-pop'); }
  }

  function refreshHud() {
    const p = state.profile;
    if (!p) return;
    pearlsEl.textContent = fmt(p.pearls);
    pearlsBox.hidden = sepEl.hidden = p.pearls <= 0;
    const perMin = economy.incomePerMinute();
    rateEl.hidden = perMin <= 0;
    rateNum.textContent = `+${fmt(perMin >= 1 ? perMin : perMin * 60)}`;
    rateUnit.textContent = perMin >= 1 ? ' a minute' : ' an hour';
    const cap = economy.coolerCapacity();
    const n = p.cooler.length;
    coolerCount.textContent = `${n}/${cap}`;
    coolerCount.classList.toggle('is-full', n >= cap);
    coolerBtn.setAttribute('aria-label', `Cooler, ${n} of ${cap} fish`);
  }

  // ------------------------------------------------------------ context action (zone:enter / zone:exit)
  const actionDock = h('div.action-dock');
  actionDock.hidden = true;
  let actionZone = null;
  function actionFor(zone) {
    const { kind, zoneId } = zone;
    const visitor = isVisitor(state);   // on a friend's island only the shop is ours to use
    if (kind === 'shop') return { icon: 'scale', label: 'Open the shop', go: () => ui.openShop({ tab: state.profile.cooler.length ? 'sell' : 'buy' }) };
    if (visitor) return null;
    if (kind === 'boat') return { icon: 'compass', label: 'Chart a course', go: () => ui.openTravel() };
    if (kind === 'plot') return { icon: 'plot', label: 'Raise new land', go: () => ui.openShop({ tab: 'harbour', focus: 'land' }) };
    if (kind === 'building') {
      const def = state.data.economy?.buildings?.[zoneId];
      if (zoneId === 'workers_hut') return { icon: 'hat', label: 'Hire a fisher', go: () => ui.openShop({ tab: 'harbour', focus: 'crew' }) };
      if (zoneId === 'shop') return actionFor({ kind: 'shop', zoneId });
      if (zoneId === 'boat_dock') return { icon: 'compass', label: 'Chart a course', go: () => ui.openTravel() };
      return { icon: 'hammer', label: def ? `Improve the ${def.name.toLowerCase()}` : 'Build', go: () => ui.openShop({ tab: 'harbour', focus: zoneId }) };
    }
    return null;   // piers and fishing spots belong to Agent A's controls
  }
  function showAction(zone) {
    const a = actionFor(zone);
    if (!a) return;
    actionZone = zone;
    const btn = h('button.btn.btn--primary.action-enter', { on: { click: a.go } }, ico(a.icon), h('span', a.label));
    actionDock.replaceChildren(btn);
    actionDock.hidden = !!current || titleUp;
  }
  events.on('zone:enter', (z = {}) => showAction(z));
  events.on('zone:exit', (z = {}) => {
    if (!actionZone || (z.zoneId && z.zoneId !== actionZone.zoneId)) return;
    actionZone = null;
    actionDock.hidden = true;
    actionDock.replaceChildren();
  });

  // coins fly from where they were earned (the scale) into the purse, clinking as they land
  function flyCoins(fromRect, amount) {
    const to = plate.querySelector('svg').getBoundingClientRect();
    const n = Math.max(3, Math.min(10, Math.round(Math.log2(amount + 1) * 1.6)));
    for (let i = 0; i < n; i++) {
      const coin = h('span.flying-coin', ico('coin'));
      const sx = fromRect.left + fromRect.width / 2 + (Math.random() - 0.5) * fromRect.width * 0.5;
      const sy = fromRect.top + fromRect.height / 2 + (Math.random() - 0.5) * 20;
      coin.style.left = `${sx}px`;
      coin.style.top = `${sy}px`;
      coin.style.setProperty('--tx', `${to.left + to.width / 2 - sx}px`);
      coin.style.setProperty('--ty', `${to.top + to.height / 2 - sy}px`);
      coin.style.setProperty('--arc', `${-60 - Math.random() * 80}px`);
      coin.style.animationDelay = `${i * 55}ms`;
      hudLayer.append(coin);
      setTimeout(() => sfx.coin(), 520 + i * 55);
      setTimeout(() => coin.remove(), 700 + i * 55);
    }
  }

  hudLayer.append(hudTop, actionDock, toasts);
  if (state.test) hudLayer.append(h('div.test-ribbon', 'Test mode: ×100 coins'));

  // ------------------------------------------------------------ events
  events.on('coins:changed', ({ coins }) => { animateCoins(coins); refreshHud(); current?.refresh?.(); });
  events.on('profile:changed', () => { refreshHud(); current?.refresh?.(); });
  events.on('catch:landed', (info) => open(catchReveal(ctx, info), { queued: true }));
  events.on('offline:ready', () => {
    if (current?.id === 'offline') current.refresh?.();
    else if (!queue.some((v) => v.id === 'offline')) open(offlineLetter(ctx), { queued: true });
  });

  // ------------------------------------------------------------ co-op (Agent H's events; B shows group toasts)
  // B never listens to island:changed, so the host's island (source: 'net') is never written into a visitor's profile.
  events.on('net:catch', ({ playerId, fishId, variant = 'basic', weight } = {}) => {
    const f = state.data.fish?.[fishId];
    if (!f) return;
    const v = economy.variant(variant);
    const name = fullName(f.name, v);
    const who = playerName(state, playerId);
    const colour = state.net?.players?.[playerId]?.color;
    const text = `${who} landed ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}${Number.isFinite(weight) ? `, ${fmtKg(weight)}` : ''}`;
    toast([colour ? h('span.toast__who', { style: { background: colour }, 'aria-hidden': 'true' }) : null, h('span', text)].filter(Boolean),
      v.kind === 'element' ? 'glow' : '',
      { art: v.kind === 'basic' ? null : artPath(state, `variant.${v.id}`), ms: v.kind === 'element' ? 4200 : 2800 });
  });
  events.on('net:player-joined', ({ name } = {}) => toast(`${name ?? 'A friend'} came aboard`));
  events.on('net:player-left', ({ name } = {}) => toast(`${name ?? 'A friend'} sailed home`));
  events.on('net:emote', ({ playerId, emote } = {}) => toast(`${playerName(state, playerId)} ${EMOTES[emote] ?? emote}`));
  for (const ev of ['net:joined', 'net:left']) events.on(ev, () => { refreshHud(); current?.refresh?.(); if (actionZone) showAction(actionZone); });

  refreshHud();

  // ------------------------------------------------------------ title / loading screen
  if (wantsTitle()) {
    titleUp = true;
    events.emit('ui:modal', { open: true, id: 'title' });
    const title = titleScreen(ctx, {
      onStart: () => {
        titleUp = false;
        events.emit('title:closed', {});
        if (queue.length) { mount(queue.shift()); return; }
        events.emit('ui:modal', { open: false });
        actionDock.hidden = !actionZone;
      },
    });
    root.append(title.el);
    events.once('game:ready', () => title.ready());
    // never trap the player on a loading screen if a system fails to boot
    setTimeout(() => title.ready(), 15000);
  }

  if (state.profile.pendingOffline) open(offlineLetter(ctx), { queued: true });

  window.__ui = ui;   // debug hook next to window.__game (opens screens from the console or tests)
  return ui;
}

export { money };
