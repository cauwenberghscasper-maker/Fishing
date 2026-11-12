// Agent B. Title and loading screen. Shown from startUI until game:ready (loading: title.loading art, a tip),
// then the title (title.main art) with "Cast off". Art from Agent F's art.json; every slot hides when missing.
import { h, fill, artImg } from '../dom.js';
import { artPath, artText } from '../../economy/data.js';

// Fallback tip lines (used when the tip art has no caption of its own).
const TIPS = [
  'Hold still while you aim. The reticle steadies the longer you wait.',
  'Any catch can come up as a variant. Elemental ones are worth up to 25 times as much.',
  'Your crew keeps fishing while you are away, for up to 8 hours.',
  'Sell a little of everything. Prices drop when you flood the market with one fish.',
];

export function titleScreen(ctx, { onStart }) {
  const { state } = ctx;
  const tipNo = 1 + Math.floor(Math.random() * 4);
  const root = h('div.title-screen.on-sea', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Fishing' });
  const backdrop = h('div.title-screen__art');
  const tip = h('div.title-tip');
  const foot = h('div.title-screen__foot');
  let started = false;

  const setArt = (key) => {
    const img = artImg(artPath(state, key), '', { alt: '', slot: backdrop });
    if (img) fill(backdrop, img);
  };

  function showLoading() {
    setArt(artPath(state, 'title.loading') ? 'title.loading' : 'title.main');
    const art = artImg(artPath(state, `tip.${tipNo}`), 'title-tip__art', { alt: '' });
    fill(tip, art, h('p', artText(state, `tip.${tipNo}`) ?? TIPS[tipNo - 1]));
    fill(foot, tip, h('div.meter.meter--stamina.title-meter', { role: 'progressbar', 'aria-label': 'Loading the cove' }, h('div.meter__fill')), h('p.title-status', 'Loading the cove'));
  }

  let isReady = false;
  function showReady() {
    if (isReady || started) return;
    isReady = true;
    if (artPath(state, 'title.main')) setArt('title.main');
    const go = h('button.btn.btn--primary.title-go', { on: { click: start } }, 'Cast off');
    root.append(h('div.title-build', `Version ${__BUILD__}`));
    fill(foot, tip, go);
    go.focus({ preventScroll: true });
  }

  function start() {
    if (started) return;
    started = true;
    root.classList.add('is-leaving');
    setTimeout(() => { root.remove(); onStart?.(); }, 380);
  }

  root.append(backdrop,
    h('header.title-screen__top', h('h1.title-logo', 'Fishing'), h('span.rope.title-rope', { 'aria-hidden': 'true' }), h('p.title-sub', 'Driftwood Cove')),
    foot);
  showLoading();
  return { el: root, ready: showReady, start };
}
