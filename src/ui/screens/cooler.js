// Agent B. The cooler, opened from the top bar: what you are carrying and what it is worth today.
// Selling happens at the shop (walking there is part of the loop); at the shop the button opens it.
import { h, fmt, fmtKg, money, fishWindow, fill } from '../dom.js';
import { fishPreview } from '../../economy/data.js';
import { sizeClassById, fullName } from '../../economy/rules.js';
import { sheetHead, keepScroll, variantToken } from './shop.js';

export function coolerSheet(ctx) {
  const { state, economy, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cooler' });

  function render() {
    const p = state.profile;
    const cooler = economy.building('cooler');
    const cap = economy.coolerCapacity();
    const hotId = economy.hotFish();
    const body = h('div.sheet__body');
    if (!p.cooler.length) {
      body.append(h('div.empty', h('strong', 'Empty'), 'Fish you keep go in here until you sell them at the shop.'));
    } else {
      const list = h('ul.lots');
      for (const c of p.cooler) {
        const f = state.data.fish?.[c.fishId] ?? { name: c.fishId };
        const size = sizeClassById(state.data, c.sizeClass);
        list.append(h('li.lot',
          fishWindow('lot__mark', fishPreview(state, c.fishId)),
          h('div.lot__main', h('div.lot__name', fullName(f.name, economy.variant(c.variant))),
            h('div.lot__meta', h('span.t-num', fmtKg(c.weight)), size ? h(`span.stamp.stamp--${size.id}`, size.name) : null,
              variantToken(economy, c.variant),
              c.fishId === hotId ? h('span.pebble.pebble--amber', 'In demand') : null)),
          h('div.lot__sell.lot__worth', money(economy.price(c)))));
      }
      body.append(list);
    }
    const { total } = economy.sellAllPreview();
    const atShop = ui.atShop();
    const foot = h('footer.sheet__foot',
      h('p.foot-note', h('b.t-num', `${p.cooler.length} of ${cap}`), ' fish ', h('br'),
        p.cooler.length ? ['worth ', h('b.t-num', fmt(total)), atShop ? ' here' : ' at the shop'] : 'Sell at the shop on the pier'),
      atShop && p.cooler.length
        ? h('button.btn.btn--primary', { on: { click: () => ui.openShop({ tab: 'sell' }) } }, 'Open the shop')
        : null);
    fill(root, sheetHead(cooler?.name ?? 'Cooler', `Keeps up to ${cap} fish fresh.`, () => ui.close()), body, foot);
  }
  render();
  return { id: 'cooler', el: root, refresh: () => keepScroll(root, render) };
}
