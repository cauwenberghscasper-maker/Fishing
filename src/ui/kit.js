// Agent B. The one UI kit every menu is built from (docs/UI_BIBLE.md §3):
// Place (a painted screen edge to edge), Sign (small carved title), Tabs (≤ 6, icon + one word, never scroll),
// Tile + TileGrid (3-up at 390, 4-up wider, no scroll for ≤ 9), Drawer (bottom sheet for details), Plate (primary action).
import { h, ico, fill, artImg } from './dom.js';

/** A full-screen painted place. `art` = painting path (or null → procedural backdrop `.place--<id>`). */
export function Place({ id, art = null, sign, onClose, label }) {
  const bg = h('div.place__bg');
  const img = artImg(art, '', { alt: '' });
  if (img) {
    bg.append(img);
    bg.classList.add('has-art');
    img.addEventListener('error', () => bg.classList.remove('has-art'));
  }
  const body = h('div.place__body');
  const drawerHost = h('div.place__drawer-host');
  const root = h(`section.place.place--${id}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': label ?? sign },
    bg,
    h('header.place__top', Sign(sign), h('button.place__close', { 'aria-label': 'Close', on: { click: onClose } }, ico('close'))),
    body,
    drawerHost);
  return { root, body, drawerHost, setSign: (text) => { root.querySelector('.sign span').textContent = text; } };
}

/** Small carved sign with gilt letters, one line. */
export function Sign(text) {
  return h('div.sign', h('span', text));
}

/**
 * Tabs that never scroll: equal width, icon + one word. items: [{ id, icon, label, badge? }].
 * level 1 = section blocks, level 2 = sub-tabs.
 */
export function Tabs(items, current, onPick, { level = 1, label = 'Sections' } = {}) {
  return h(`nav.ktabs.ktabs--l${level}`, { role: 'tablist', 'aria-label': label, style: { '--n': items.length } },
    items.map((t) => h('button.ktab', {
      role: 'tab',
      'aria-selected': String(t.id === current),
      'aria-label': t.label,
      on: { click: () => onPick(t.id) },
    }, t.icon ? ico(t.icon) : null, h('span.ktab__word', t.label), t.badge ? h('span.ktab__badge.t-num', t.badge) : null)));
}

/**
 * A tile: a paper tag hanging from a brass hook. art = painting path; icon = fallback drawing.
 * state: 'equipped' | 'owned' | 'locked' | 'broken' | 'next' | null. value = node (price, weight...).
 */
export function Tile({ art = null, icon = 'fish', name, value = null, state = null, badge = null, onTap, label, fish = false, tint = null }) {
  const win = h('span.tile__art');
  if (tint) win.style.setProperty('--tint', tint);
  const fallback = ico(icon);
  win.append(fallback);
  const img = artImg(art, '', { alt: '', onShow: () => { fallback.remove(); win.classList.add('has-art'); } });
  if (img) win.append(img);
  const mark = state === 'equipped' ? h('span.tile__mark.is-equipped', ico('check'))
    : state === 'owned' ? h('span.tile__mark.is-owned', ico('check'))
    : state === 'locked' ? h('span.tile__mark.is-locked', ico('lock'))
    : state === 'broken' ? h('span.tile__mark.is-broken', ico('crack'))
    : null;
  return h(`button.tile${fish ? '.tile--fish' : ''}${state ? '.tile--' + state : ''}`, { 'aria-label': label ?? name, on: { click: onTap } },
    h('span.tile__hook', { 'aria-hidden': 'true' }),
    win,
    mark,
    badge ? h('span.tile__badge.t-num', badge) : null,
    h('span.tile__name', name),
    value ? h('span.tile__value', value) : null);
}

export function TileGrid(tiles, { label = '' } = {}) {
  return h('div.tilegrid', { role: 'list', 'aria-label': label, style: { '--n': tiles.length } }, tiles.map((t) => { t.setAttribute('role', 'listitem'); return t; }));
}

/** A brass plate for the primary action of a screen. */
export function Plate(content, onTap, { disabled = false, label, kind = 'brass' } = {}) {
  return h(`button.plate.plate--${kind}`, { 'aria-disabled': disabled ? 'true' : null, 'aria-label': label, on: { click: onTap } }, h('span.plate__face', content));
}

/**
 * A bottom drawer over ~45% of the place: the grid stays visible above it. Tap outside or swipe down closes.
 * Returns { open(contentNodes), close() }.
 */
export function Drawer(host) {
  let el = null;
  function close() {
    if (!el) return;
    const d = el;
    el = null;
    d.classList.add('is-leaving');
    setTimeout(() => d.remove(), 220);
  }
  function open(...content) {
    if (el) el.remove();
    const tray = h('div.drawer__tray', { role: 'dialog', 'aria-modal': 'false' }, h('span.drawer__handle', { 'aria-hidden': 'true' }), h('div.drawer__content', content));
    el = h('div.drawer', { on: { click: (e) => { if (e.target === el) close(); } } }, tray);
    let y0 = null;
    tray.addEventListener('pointerdown', (e) => { if (e.target.closest('button, canvas, input')) return; y0 = e.clientY; tray.setPointerCapture(e.pointerId); });
    tray.addEventListener('pointermove', (e) => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); tray.style.transform = `translateY(${dy}px)`; });
    tray.addEventListener('pointerup', (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; tray.style.transform = ''; if (dy > 70) close(); });
    host.append(el);
    return el;
  }
  return { open, close, get isOpen() { return !!el; }, refill: (...content) => { if (el) fill(el.querySelector('.drawer__content'), ...content); } };
}

/** Before → after stat line for the drawer. */
export function StatRow(label, before, after, better = null) {
  const changed = before !== after && after != null;
  return h('div.statrow',
    h('span.statrow__label', label),
    h('span.statrow__val.t-num', before ?? '–'),
    changed ? h(`span.statrow__arrow${better === true ? '.is-up' : better === false ? '.is-down' : ''}`, '→') : null,
    changed ? h(`span.statrow__val.t-num${better === true ? '.is-up' : better === false ? '.is-down' : ''}`, after) : null);
}
