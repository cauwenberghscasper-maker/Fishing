// Agent B. Tiny DOM helpers for the UI (no framework).
import { icon } from './icons.js';

/** h('div.class.other', { attrs, on: {click}, html }, ...children) */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

/** Replace an element's children, skipping null/false (unlike native replaceChildren). */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** An inline icon as a DOM node. */
export function ico(name) {
  const t = document.createElement('template');
  t.innerHTML = icon(name).trim();
  return t.content.firstChild;
}

const intFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const fmt = (n) => intFmt.format(Math.round(n));

export function fmtKg(w) {
  if (!Number.isFinite(w)) return '–';
  return `${w < 100 ? w.toFixed(2) : w.toFixed(1)} kg`;
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  if (hrs && min) return `${hrs} h ${min} min`;
  if (hrs) return `${hrs} h`;
  if (min) return `${min} min`;
  return `${s} s`;
}

/** Coin amount: doubloon + tabular number. */
export function money(n, cls = '') {
  return h(`span.money${cls ? '.' + cls : ''}`, ico('coin'), h('span.t-num', fmt(n)));
}

/**
 * A painted artwork from Agent F's registry (art.json), or null when the key is not registered yet,
 * so the caller can leave the slot out. If the file fails to load, the image (or `slot`) removes itself.
 */
export function artImg(path, cls = '', { alt = '', slot = null, eager = false } = {}) {
  if (!path) return null;
  const img = h(`img${cls ? '.' + cls : ''}`, { src: path, alt, loading: eager ? 'eager' : 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { (slot ?? img).remove(); });
  return img;
}

/** Ink for text on a coloured token: dark on light accents, paper on dark ones. */
export function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'var(--c-ink)';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.5 ? 'var(--c-ink)' : 'var(--c-paper)';
}

/** A fish window: Agent C's preview if it exists, else an ink silhouette. `unknown` blacks the preview out. */
export function fishWindow(cls, src, { unknown = false } = {}) {
  const box = h(`div.${cls}`);
  if (src) {
    const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => { img.replaceWith(ico('fish')); });
    box.append(img);
  } else {
    box.append(ico('fish'));
  }
  if (unknown) box.classList.add('is-unknown');
  return box;
}

export function ledgerRow(label, value, cls = '') {
  return h(`div.ledger__row${cls ? '.' + cls : ''}`, h('dt', label), h('span.leader'), h('dd', value));
}

export function plural(n, one, many = `${one}s`) {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}
