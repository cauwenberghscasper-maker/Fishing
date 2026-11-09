// Agent B. The catch reveal (master prompt 9b.3): a full-screen moment, not a card.
// The backdrop is a painting with light rays: Agent E's backdrop.<variantId> for elemental catches, then Agent F's
// screen.catch.<islandId>, then a procedural sea. Then the hero pose big in the centre (Agent C's `hero`, falling back
// to `preview`), the weight counting up on a tied paper tag, the size stamp slammed on, painted ribbons for
// NEW SPECIES / RECORD, and two physical choices: drop it in the basket (keep) or put it on the scale (sell).
// The fish can also be dragged onto either.
import { h, ico, fmt, fmtKg, artImg, inkOn } from '../dom.js';
import { fishPose, artPath, vfxPath } from '../../economy/data.js';
import { sizeClassById, fullName } from '../../economy/rules.js';
import { sfx } from '../sfx.js';

const MORPH_FILTER = {
  bleached: 'saturate(0.25) brightness(1.3) contrast(0.9)',
  inkdark: 'brightness(0.55) contrast(1.35) saturate(1.3)',
  gilded: 'sepia(0.55) saturate(1.8) brightness(1.08)',
};

/** My own drawings of the two choices (no icon set): a woven basket and a brass hanging scale. */
const BASKET_SVG = `<svg viewBox="0 0 120 92" aria-hidden="true">
  <defs>
    <pattern id="rv-weave" width="10" height="8" patternUnits="userSpaceOnUse">
      <rect width="10" height="8" fill="#9a7444"/>
      <path d="M0 2h5M5 6h5" stroke="#c9a46a" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M0 6h1M9 2h1" stroke="#c9a46a" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M0 4h10" stroke="#5e4220" stroke-width="0.8" opacity=".6"/>
    </pattern>
  </defs>
  <path d="M10 30h100l-11 56H21z" fill="url(#rv-weave)" stroke="#4a3216" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M21 86h78" stroke="#3a2610" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="60" cy="30" rx="52" ry="9" fill="#1d3a2e" stroke="#4a3216" stroke-width="2.5"/>
  <path d="M14 30c10-5 22 3 30-2s20 4 30-1 22 4 32 0" fill="none" stroke="#3f6b3c" stroke-width="3" stroke-linecap="round"/>
  <path d="M8 30c0-5 104-5 104 0" fill="none" stroke="#cfae74" stroke-width="5" stroke-linecap="round"/>
  <path d="M8 30c0-5 104-5 104 0" fill="none" stroke="#8a6a3a" stroke-width="5" stroke-dasharray="2 4" stroke-linecap="round"/>
</svg>`;
const SCALE_SVG = `<svg viewBox="0 0 120 92" aria-hidden="true">
  <path d="M60 4v14" stroke="#5e3f12" stroke-width="3" stroke-linecap="round"/>
  <circle cx="60" cy="4" r="3.5" fill="none" stroke="#5e3f12" stroke-width="2"/>
  <rect x="44" y="16" width="32" height="34" rx="5" fill="#d9a441" stroke="#5e3f12" stroke-width="2.5"/>
  <circle cx="60" cy="33" r="11" fill="#f4e7c4" stroke="#5e3f12" stroke-width="2"/>
  <path d="M60 33l6-6" stroke="#9c3f1f" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M51 33h2M67 33h2M60 24v2M60 40v2" stroke="#5e3f12" stroke-width="1.4"/>
  <path d="M60 50v8M38 58h44" stroke="#5e3f12" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M38 58l-16 18M38 58l16 18M82 58l-16 18M82 58l16 18" stroke="#8a6a3a" stroke-width="1.6"/>
  <path d="M18 76h40c-2 8-36 8-40 0zM62 76h40c-2 8-36 8-40 0z" fill="#b8862e" stroke="#5e3f12" stroke-width="2"/>
</svg>`;

export function catchReveal(ctx, info) {
  const { state, economy, ui } = ctx;
  const c = info.catch;
  const variant = info.variant ?? economy.variant(c.variant ?? 'basic');
  const kind = variant.kind ?? 'basic';
  const fish = state.data.fish?.[c.fishId] ?? { name: 'Unknown fish', lore: '' };
  const name = fullName(fish.name, variant);
  const size = sizeClassById(state.data, c.sizeClass) ?? { id: 'normal', name: 'Fair' };
  const accent = kind === 'basic' ? '#ffd27a' : variant.accent ?? '#6ff5dc';
  const islandId = c.islandId ?? 'driftwood_cove';

  // ---- backdrop: E's elemental painting, F's island painting, or the procedural sea
  const bg = h('div.reveal__bg');
  const paint = (kind === 'element' && vfxPath(state, `backdrop.${variant.id}`)) || artPath(state, `screen.catch.${islandId}`);
  const bgImg = artImg(paint, '', { alt: '' });
  if (bgImg) { bg.append(bgImg); bg.classList.add('has-art'); bgImg.addEventListener('error', () => bg.classList.remove('has-art')); }

  // ---- hero
  const heroSrc = fishPose(state, c.fishId, 'hero');
  const hero = h('div.reveal__hero', { role: 'img', 'aria-label': name });
  if (heroSrc) {
    const img = h('img', { src: heroSrc, alt: '', draggable: 'false', decoding: 'async' });
    if (MORPH_FILTER[variant.id]) img.style.filter = MORPH_FILTER[variant.id];
    img.addEventListener('error', () => { img.remove(); hero.classList.add('is-name-only'); });
    hero.append(img);
  } else {
    hero.classList.add('is-name-only');
    hero.append(ico('fish'));   // an ink silhouette in the variant's glow until Agent C's painting exists
  }

  // ---- ribbons (Agent F's ribbon.new / ribbon.record paintings when they exist, cloth ribbons otherwise)
  const ribbon = (cls, text, key) => {
    const r = h(`div.ribbon.${cls}`, h('span', text));
    const art = key ? artPath(state, key) : null;
    if (art) { r.style.setProperty('--ribbon-art', `url("${art}")`); r.classList.add('has-art'); }
    return r;
  };
  const multiName = { 2: 'Double catch', 3: 'Triple catch' }[info.multi?.count] ?? (info.multi ? `${info.multi.count}× catch` : '');
  const gradeName = { good: 'Good fight', great: 'Great fight', perfect: 'Perfect fight' }[info.mastery?.grade];
  const ribbons = h('div.reveal__ribbons',
    info.multi ? ribbon(`ribbon--multi.ribbon--multi-${info.multi.count}`, `${multiName} ${info.multi.index}/${info.multi.count}`, null) : null,
    gradeName && info.mastery.grade !== 'good' ? ribbon(`ribbon--grade.ribbon--${info.mastery.grade}`, `${gradeName} ×${Number(info.mastery.valueMult).toLocaleString(undefined, { maximumFractionDigits: 1 })}`, null) : null,
    info.isNew ? ribbon('ribbon--new', 'New species', 'ribbon.new') : null,
    info.isRecord ? ribbon('ribbon--record', 'Record', 'ribbon.record') : null,
    !info.isNew && info.isNewVariant && kind !== 'basic' ? ribbon('ribbon--variant', 'New variant', null) : null,
    ...(info.sets ?? []).map((s) => ribbon('ribbon--set', `${s.name} complete`, null)),
  );

  // ---- the tag: weight counting up, the stamp slams on
  const weightEl = h('span.reveal__kg.t-num', fmtKg(0));
  const stamp = h(`span.stamp.reveal__stamp.stamp--${size.id}`, size.name);
  const extras = [
    info.pearls > 0 ? h('span.reveal__pearls', ico('pearl'), `+${fmt(info.pearls)}`) : null,
    ...(info.sets ?? []).filter((s) => s.coins).map((s) => h('span.reveal__bonus', ico('coin'), `+${fmt(s.coins)}`)),
  ];
  const tag = h('div.reveal__tag', h('span.reveal__twine', { 'aria-hidden': 'true' }), weightEl, stamp, extras.some(Boolean) ? h('div.reveal__extras', extras) : null);

  // ---- the choices: physical objects, also drop targets for the fish
  const keepLabel = info.coolerFull ? 'Let it go' : 'Keep';
  const basket = h('button.reveal__choice.reveal__basket', {
    'aria-label': info.coolerFull ? `Let the ${name} go, your cooler is full` : `Keep the ${name} in your cooler`,
    on: { click: () => choose(info.coolerFull ? 'release' : 'keep') },
  }, h('span.reveal__obj', { html: BASKET_SVG }), h('span.reveal__label', keepLabel), info.coolerFull ? h('span.reveal__sub', 'Your basket is full') : null);
  const scale = h('button.reveal__choice.reveal__scale', {
    'aria-label': `Sell the ${name} for ${fmt(info.value)} coins`,
    on: { click: () => choose('sell') },
  }, h('span.reveal__obj', { html: SCALE_SVG }), h('span.reveal__label', 'Sell'), h('span.reveal__price', ico('coin'), h('span.t-num', fmt(info.value))));

  const lore = kind === 'basic' ? fish.lore : variant.lore;
  const top = h('header.reveal__top',
    kind === 'element' ? h('div.reveal__element', variant.name) : null,
    h('h2.reveal__name', name),
    kind === 'morph' ? h('span.pebble.vtoken', { style: { '--pebble': accent, color: inkOn(accent) } }, `${variant.name} ×${fmt(variant.valueMult)}`) : null,
    kind === 'element' ? h('span.reveal__mult', `×${fmt(variant.valueMult)} value`) : null,
    lore ? h('p.reveal__lore', lore) : null,
    ribbons);

  const root = h(`section.reveal.reveal--${kind}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': `You caught ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}` },
    bg,
    h('div.reveal__rays', { 'aria-hidden': 'true' }),
    h('div.reveal__shade', { 'aria-hidden': 'true' }),
    top,
    h('div.reveal__stage', hero, tag),
    h('footer.reveal__choices', basket, scale),
  );
  root.style.setProperty('--el', accent);
  if (kind !== 'basic') root.dataset.variant = variant.id;

  // ---- timeline
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let done = false;
  let counting = 0;
  function countWeight(ms = 850) {
    const t0 = performance.now();
    let lastTick = 0;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      weightEl.textContent = fmtKg(c.weight * eased);
      if (t - lastTick > 55 && k < 1) { sfx.tick(); lastTick = t; }
      if (k < 1) counting = requestAnimationFrame(step);
    };
    counting = requestAnimationFrame(step);
  }
  function finishIntro() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(counting);
    weightEl.textContent = fmtKg(c.weight);
    root.classList.add('is-skipped', 'is-stamped', 'is-ready');
  }
  function play() {
    if (kind === 'element') { sfx.swell(); navigator.vibrate?.([40, 60, 90]); } else sfx.splash();
    at(380, () => countWeight());
    at(1300, () => { root.classList.add('is-stamped'); sfx.thud(); navigator.vibrate?.(25); });
    at(1550, () => { if (ribbons.children.length || kind !== 'basic') sfx.fanfare(info.isNew || kind === 'element'); });
    at(1750, () => { root.classList.add('is-ready'); done = true; });
  }
  // a tap during the intro skips to the end, but never chooses for the player
  root.addEventListener('pointerdown', (e) => { if (!done && !e.target.closest('.reveal__choice')) finishIntro(); });

  // ---- choosing
  let chosen = false;
  function choose(what) {
    if (chosen) return;
    chosen = true;
    finishIntro();
    const target = what === 'sell' ? scale : basket;
    const from = hero.getBoundingClientRect();
    const to = target.querySelector('.reveal__obj').getBoundingClientRect();
    hero.style.setProperty('--dx', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
    hero.style.setProperty('--dy', `${to.top + to.height / 3 - (from.top + from.height / 2)}px`);
    root.classList.add(what === 'sell' ? 'is-selling' : 'is-keeping');
    target.classList.add('is-hit');
    if (what === 'sell') sfx.creak(); else sfx.splash();
    const fromRect = to;
    setTimeout(() => {
      if (what === 'sell') {
        const r = economy.sellCatch(c.id);
        ui.close();
        if (r.ok) ui.flyCoins?.(fromRect, r.price);
      } else if (what === 'release') {
        economy.releaseHeld();
        ui.close();
        ui.toast(`The ${name} swims off`);
      } else {
        economy.keepCatch(c.id);
        ui.close();
      }
    }, 520);
  }

  // ---- drag the fish onto the basket or the scale
  let drag = null;
  hero.addEventListener('pointerdown', (e) => {
    if (chosen) return;
    finishIntro();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    hero.setPointerCapture(e.pointerId);
    hero.classList.add('is-dragging');
  });
  hero.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    hero.style.setProperty('--dx', `${e.clientX - drag.x}px`);
    hero.style.setProperty('--dy', `${e.clientY - drag.y}px`);
    for (const t of [basket, scale]) t.classList.toggle('is-over', hit(t, e));
  });
  const hit = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top - 30 && e.clientY < r.bottom; };
  hero.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    hero.classList.remove('is-dragging');
    [basket, scale].forEach((t) => t.classList.remove('is-over'));
    if (hit(scale, e)) choose('sell');
    else if (hit(basket, e)) choose(info.coolerFull ? 'release' : 'keep');
    else { hero.style.setProperty('--dx', '0px'); hero.style.setProperty('--dy', '0px'); }
  });

  return {
    id: 'catch',
    el: root,
    layerClass: 'is-reveal',
    onOpen: play,
    onClose: () => { timers.forEach(clearTimeout); cancelAnimationFrame(counting); },
    // Escape or a tap outside never decides silently: keep it if there is room
    dismiss: () => { if (!info.coolerFull) choose('keep'); },
  };
}
