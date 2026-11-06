// Agent B. Catch card: a specimen label with a window onto the sea.
import { h, ico, fmt, fmtKg, money, ledgerRow } from '../dom.js';
import { fishPreview } from '../../economy/data.js';
import { sizeClassById } from '../../economy/rules.js';

export function catchCard(ctx, info) {
  const { state, economy, ui } = ctx;
  const c = info.catch;
  const fish = state.data.fish?.[c.fishId] ?? { name: 'Unknown fish', lore: '' };
  const size = sizeClassById(state.data, c.sizeClass) ?? { id: 'normal', name: 'Fair' };
  const src = fishPreview(state, c.fishId);

  let stage = null;
  if (src) {
    const img = h('img.catch__img', { src, alt: fish.name, decoding: 'async' });
    img.addEventListener('error', () => { stage?.remove(); card.classList.add('catch--noimg'); });
    stage = h('div.catch__stage.on-sea', img);
  }

  const flags = h('div.catch__flags',
    info.isNew && h('span.pebble.pebble--glow', 'New to your logbook'),
    info.isRecord && h('span.pebble.pebble--amber', ico('rosette'), 'Heaviest yet'),
    c.perfect && h('span.pebble', 'Perfect cast'),
    info.pearls > 0 && h('span.pebble.money--pearl', ico('pearl'), `+${fmt(info.pearls)} ${info.pearls === 1 ? 'pearl' : 'pearls'}`),
  );

  const worth = h('span.worth', money(info.value), info.hot ? h('span.pebble.pebble--amber.hot-mark', ico('flame'), 'In demand') : null);

  const sell = () => {
    const r = economy.sellCatch(c.id);
    if (r.ok) ui.toast(`Sold the ${fish.name} for ${fmt(r.price)}`);
    ui.close();
  };
  const keep = () => {
    economy.keepCatch(c.id);
    ui.close();
  };
  const release = () => {
    economy.releaseHeld();
    ui.toast(`The ${fish.name} swims off`);
    ui.close();
  };

  const left = info.coolerFull
    ? h('button.btn', { on: { click: release } }, 'Let it go')
    : h('button.btn', { on: { click: keep } }, 'Keep');
  const right = h('button.btn.btn--primary', { 'aria-label': `Sell for ${fmt(info.value)} coins`, on: { click: sell } }, h('span', 'Sell for'), h('span.t-num', fmt(info.value)));

  const card = h('article.catch.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `You caught a ${fish.name}` },
    stage,
    flags,
    h('h2.catch__name', fish.name),
    fish.lore ? h('p.catch__lore', fish.lore) : null,
    h('dl.ledger',
      ledgerRow('Weight', h('span.t-num', fmtKg(c.weight))),
      ledgerRow('Size', h(`span.stamp.stamp--${size.id}`, size.name)),
      ledgerRow('Worth', worth)),
    info.coolerFull ? h('p.catch__note', 'Your cooler is full. Sell this one, or let it go and make room at the harbour.') : null,
    h('div.catch__actions', left, right),
  );
  if (!stage) card.classList.add('catch--noimg');

  return {
    id: 'catch',
    el: card,
    // tapping outside the card keeps the fish (or does nothing when the cooler is full)
    dismiss: () => { if (!info.coolerFull) keep(); },
  };
}
