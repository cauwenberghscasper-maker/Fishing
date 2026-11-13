// "What's new" (Casper 12 Nov: "I can't see any changes"): most new things live in the shop, so
// after an update the game says once what was added and where to find it. One entry per update;
// bump NEWS.id when adding one.
import { h } from '../dom.js';

export const NEWS = {
  id: '2026-11-13',
  title: "What's new",
  items: [
    ['New land to buy', 'Seven big stretches of land join your plots into one island. Shop › Build › Land.', { tab: 'harbour', focus: 'land' }],
    ['Decorate your island', 'Palms, fences, lanterns, huts and more, set down anywhere. Shop › Build › Decor.', { tab: 'harbour', focus: 'decor' }],
    ['Move any building', 'Open a building in Shop › Build › Houses and press Move. It is free.', { tab: 'harbour' }],
    ['Monster gear', 'Rods rated up to 220 kg that cast 84 m, plus stronger reels, lines and hooks. Shop › Gear.', { tab: 'buy' }],
    ['Train your crew', 'Crew training, net quality and an armoury: 12 tiers of idle income. Buildings now go to level 5. Shop › Build › Crew.', { tab: 'harbour', focus: 'crew' }],
    ['Seasons', 'The sea changes every day: Spring Bloom, Summer Calm, Autumn Run, Winter Storms. Each favours something different.', null],
    ['Harbour cannons', 'A cannon you build and place that fires on raiding monsters by itself. Three levels. Shop › Build › Houses.', { tab: 'harbour' }],
    ['Monster raids', 'On a big island (12 plots) a sea monster will sometimes attack your harbour. Drive it off with harpoons for a bounty.', null],
    ['New fight moves', 'Corkscrews, death rolls, tail-walks, long runs: rare fish fight their own way and sell for more.', null],
    ['Treasure chests', 'Rare bubbling chests out at sea: cast onto one and pull its reels.', null],
    ['Easier money, fewer repairs', 'Fish sell for 40% more; rods and lines last far longer.', null],
  ],
};
const KEY = 'fishing.news.seen';

export function newsDue() {
  try { return localStorage.getItem(KEY) !== NEWS.id; } catch { return false; }
}

export function newsSheet(ctx) {
  const { ui } = ctx;
  const seen = () => { try { localStorage.setItem(KEY, NEWS.id); } catch { /* private mode */ } };
  const root = h('div.news', { role: 'dialog', 'aria-label': NEWS.title },
    h('h2.news__title', NEWS.title),
    h('ul.news__list', ...NEWS.items.map(([name, text, go]) => h('li.news__item',
      h('div.news__text', h('b', name), h('span', text)),
      go ? h('button.btn.news__go', { type: 'button', on: { click: () => { seen(); ui.close(view); ui.openShop(go); } } }, 'Show me') : null))),
    h('button.btn.btn--primary.news__ok', { type: 'button', on: { click: () => { seen(); ui.close(view); } } }, 'Got it'),
    h('p.news__build', `Version ${__BUILD__}`));
  const view = { id: 'news', el: root, layerClass: 'is-news', dismiss: () => { seen(); ui.close(view); } };
  return view;
}
