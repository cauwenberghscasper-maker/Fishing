// Agent B. All UI except Agent A's in-world fishing controls (#hud-fishing).
import './theme.css';
import './ui.css';
import { h, ico, fmt, money } from './dom.js';
import { activePairing } from './type-pairing.js';
import { economy } from '../economy/index.js';
import { catchCard } from './screens/catch.js';
import { shopSheet } from './screens/shop.js';
import { travelSheet } from './screens/travel.js';
import { logbookSheet } from './screens/logbook.js';
import { settingsSheet } from './screens/settings.js';
import { offlineLetter } from './screens/offline.js';
import { coolerSheet } from './screens/cooler.js';

const BUILDING_ICONS = { shop: 'scale', cooler: 'cooler', workers_hut: 'hat', smokehouse: 'flame', aquarium: 'fish', boat_dock: 'boat' };

function injectFonts() {
  if (document.querySelector('link[data-ui-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'fonts/fonts.css';
  link.dataset.uiFonts = '';
  document.head.append(link);
}

export async function startUI({ root, state, events }) {
  injectFonts();
  document.documentElement.dataset.type = activePairing();

  const ctx = { state, events, economy, ui: null };

  // ------------------------------------------------------------ layers
  const hudLayer = h('div.ui-layer.hud-layer');
  const modalHost = h('div.ui-layer.modal-host');
  root.prepend(hudLayer);
  root.append(modalHost);

  // ------------------------------------------------------------ toasts
  const toasts = h('div.toasts', { 'aria-live': 'polite' });
  function toast(text, kind = '') {
    const t = h(`div.toast${kind ? '.toast--' + kind : ''}`, text);
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 280); }, 2600);
  }

  // ------------------------------------------------------------ modal manager
  let current = null;
  const queue = [];
  function mount(view) {
    current = view;
    const layer = h('div.modal-layer', { on: { click: (e) => { if (e.target === layer) dismiss(); } } }, view.el);
    view.layer = layer;
    modalHost.replaceChildren(layer);
    modalHost.style.pointerEvents = 'auto';
    view.onOpen?.();
    view.el.setAttribute('tabindex', '-1');
    view.el.focus({ preventScroll: true });
  }
  function open(view, { queued = false } = {}) {
    if (current && queued) { queue.push(view); return; }
    const wasOpen = !!current;
    if (current) { current.onClose?.(); }
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
    atShop: () => actionZone?.kind === 'shop' || state.world?.zone === 'shop',
  };

  // ------------------------------------------------------------ top bar
  const coinsEl = h('span.purse__coins.t-num', fmt(state.profile.coins));
  const pearlsEl = h('span.t-num', fmt(state.profile.pearls));
  const pearlsBox = h('span.purse__pearls', ico('pearl'), pearlsEl);
  const sepEl = h('span.purse__sep');
  const plate = h('div.purse__plate.plaque', { role: 'status', 'aria-label': 'Coins and pearls' }, ico('coin'), coinsEl, sepEl, pearlsBox);
  const rateEl = h('div.purse__rate');
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
    rateEl.textContent = perMin >= 1
      ? `+${fmt(perMin)} a minute from your harbour`
      : `+${fmt(perMin * 60)} an hour from your harbour`;
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
    if (kind === 'shop') return { icon: 'scale', label: 'Open the shop', go: () => ui.openShop({ tab: state.profile.cooler.length ? 'sell' : 'buy' }) };
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
    actionDock.hidden = !!current;
  }
  events.on('zone:enter', (z = {}) => showAction(z));
  events.on('zone:exit', (z = {}) => {
    if (!actionZone || (z.zoneId && z.zoneId !== actionZone.zoneId)) return;
    actionZone = null;
    actionDock.hidden = true;
    actionDock.replaceChildren();
  });

  hudLayer.append(hudTop, actionDock, toasts);
  if (state.test) hudLayer.append(h('div.test-ribbon', 'Test mode: ×100 coins'));

  // ------------------------------------------------------------ events
  events.on('coins:changed', ({ coins }) => { animateCoins(coins); refreshHud(); current?.refresh?.(); });
  events.on('profile:changed', () => { refreshHud(); current?.refresh?.(); });
  events.on('catch:landed', (info) => open(catchCard(ctx, info), { queued: true }));
  events.on('offline:ready', () => {
    if (current?.id === 'offline') current.refresh?.();
    else open(offlineLetter(ctx), { queued: true });
  });

  refreshHud();
  if (state.profile.pendingOffline) open(offlineLetter(ctx));

  window.__ui = ui;   // debug hook next to window.__game (opens screens from the console or tests)
  return ui;
}

export { money };
