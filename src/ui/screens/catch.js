// Agent B. Catch card: a specimen label with a window onto the sea.
// Variants (master prompt 4.4b): the full name ("Ember Driftback"), the variant emblem (art.json variant.<id>),
// and for an elemental catch a big moment: the frame band, rays and glow take the element's colour.
import { h, ico, fmt, fmtKg, money, ledgerRow, artImg, inkOn } from '../dom.js';
import { fishPreview, artPath } from '../../economy/data.js';
import { sizeClassById, fullName } from '../../economy/rules.js';

const MORPH_FILTER = {
  bleached: 'saturate(0.25) brightness(1.3) contrast(0.9)',
  inkdark: 'brightness(0.5) contrast(1.35) saturate(1.3)',
  gilded: 'sepia(0.55) saturate(1.8) brightness(1.08)',
};

export function catchCard(ctx, info) {
  const { state, economy, ui } = ctx;
  const c = info.catch;
  const variant = info.variant ?? economy.variant(c.variant ?? 'basic');
  const kind = variant.kind ?? 'basic';
  const fish = state.data.fish?.[c.fishId] ?? { name: 'Unknown fish', lore: '' };
  const name = fullName(fish.name, variant);
  const size = sizeClassById(state.data, c.sizeClass) ?? { id: 'normal', name: 'Fair' };
  const src = fishPreview(state, c.fishId);
  const accent = variant.accent ?? '#6ff5dc';

  let card;
  let stage = null;
  if (src) {
    const img = h('img.catch__img', { src, alt: name, decoding: 'async' });
    if (MORPH_FILTER[variant.id]) img.style.filter = `${MORPH_FILTER[variant.id]} drop-shadow(0 0 16px rgba(111, 245, 220, 0.38))`;
    img.addEventListener('error', () => { stage?.remove(); card.classList.add('catch--noimg'); });
    stage = h('div.catch__stage.on-sea', img);
  }

  const seal = kind !== 'basic' ? h('div.catch__seal') : null;
  const emblem = seal ? artImg(artPath(state, `variant.${variant.id}`), 'catch__emblem', { alt: `${variant.name} emblem`, slot: seal, eager: true }) : null;
  if (seal) { if (emblem) seal.append(emblem); }

  const vToken = kind !== 'basic'
    ? h('span.pebble.vtoken', { style: { '--pebble': accent, color: inkOn(accent) } }, `${variant.name} ×${fmt(variant.valueMult)}`)
    : null;

  const flags = h('div.catch__flags',
    vToken,
    info.isNew && h('span.pebble.pebble--glow', 'New to your logbook'),
    !info.isNew && info.isNewVariant && kind !== 'basic' && h('span.pebble.pebble--glow', 'New variant'),
    info.isRecord && h('span.pebble.pebble--amber', ico('rosette'), 'Heaviest yet'),
    c.perfect && h('span.pebble', 'Perfect cast'),
    info.pearls > 0 && h('span.pebble.money--pearl', ico('pearl'), `+${fmt(info.pearls)} ${info.pearls === 1 ? 'pearl' : 'pearls'}`),
  );

  const sets = (info.sets ?? []).map((s) => h('p.catch__set', ico('rosette'),
    h('span', `${s.name} complete for the ${fish.name}! `, s.coins ? h('b', `+${fmt(s.coins)} coins`) : null, s.pearls ? [s.coins ? ' and ' : '', h('b', `+${s.pearls} pearls`)] : null)));

  const worth = h('span.worth', money(info.value), info.hot ? h('span.pebble.pebble--amber.hot-mark', ico('flame'), 'In demand') : null);

  const sell = () => {
    const r = economy.sellCatch(c.id);
    if (r.ok) ui.toast(`Sold the ${name} for ${fmt(r.price)}`);
    ui.close();
  };
  const keep = () => {
    economy.keepCatch(c.id);
    ui.close();
  };
  const release = () => {
    economy.releaseHeld();
    ui.toast(`The ${name} swims off`);
    ui.close();
  };

  const left = info.coolerFull
    ? h('button.btn', { on: { click: release } }, 'Let it go')
    : h('button.btn', { on: { click: keep } }, 'Keep');
  const right = h('button.btn.btn--primary', { 'aria-label': `Sell for ${fmt(info.value)} coins`, on: { click: sell } }, h('span', 'Sell for'), h('span.t-num', fmt(info.value)));

  // morphs and elements tell their own story; the species story lives in the logbook
  const lore = kind === 'basic' ? fish.lore : variant.lore;

  card = h(`article.catch.chart.chart--framed.catch--${kind}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': `You caught ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}` },
    seal,
    stage,
    flags,
    h('h2.catch__name', name),
    lore ? h('p.catch__lore', lore) : null,
    h('dl.ledger',
      ledgerRow('Weight', h('span.t-num', fmtKg(c.weight))),
      ledgerRow('Size', h(`span.stamp.stamp--${size.id}`, size.name)),
      ledgerRow('Worth', worth)),
    sets,
    info.coolerFull ? h('p.catch__note', 'Your cooler is full. Sell this one, or let it go and make room at the harbour.') : null,
    h('div.catch__actions', left, right),
  );
  if (!stage) card.classList.add('catch--noimg');
  if (seal && emblem) card.classList.add('has-seal');
  if (kind !== 'basic') {
    card.style.setProperty('--el', accent);
    card.dataset.variant = variant.id;
  }
  if (kind === 'element') card.style.setProperty('--band', accent);

  return {
    id: 'catch',
    el: card,
    layerClass: kind === 'element' ? 'is-element' : kind === 'morph' ? 'is-morph' : '',
    layerStyle: kind !== 'basic' ? { '--el': accent } : null,
    onOpen: () => {
      if (kind === 'element' && state.profile.settings?.sound !== false) navigator.vibrate?.([40, 60, 90]);
    },
    // tapping outside the card keeps the fish (or does nothing when the cooler is full)
    dismiss: () => { if (!info.coolerFull) keep(); },
  };
}
