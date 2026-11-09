// Agent B. The cooler (9b.1, UI_BIBLE §2): looking down into the basket (Agent F's screen.cooler.l<level>),
// the catch lying in it as Agent C's rest-pose cut-outs, 4-up, empty places as bare weave.
// Selling works right here, anywhere on the island (Casper): tap a fish → drawer with Sell / Let go,
// and "Sell all" on a brass tally plate on the rim. Coins fly to the purse like at the shop.
import { h, fmt, fmtKg, money } from '../dom.js';
import { fishPose, artPath } from '../../economy/data.js';
import { fullName } from '../../economy/rules.js';
import { Place, TileGrid, Tile, Drawer, Plate, changeGate } from '../kit.js';
import { fishDrawer } from './shop.js';

export function coolerSheet(ctx) {
  const { state, economy, ui } = ctx;
  const level = economy.building('cooler')?.index ?? 0;
  const place = Place({
    id: 'cooler',
    art: artPath(state, `screen.cooler.l${level}`) ?? artPath(state, 'screen.cooler.l0'),
    sign: '',
    label: 'Cooler',
    onClose: () => ui.close(),
  });
  const drawer = Drawer(place.drawerHost);
  let openFor = null;

  function render() {
    const p = state.profile;
    const cap = economy.coolerCapacity();
    const name = economy.building('cooler')?.name ?? 'Basket';
    place.setSign(`${name} ${p.cooler.length}/${cap}`);
    const hotId = economy.hotFish();
    const tiles = p.cooler.map((c) => {
      const f = state.data.fish?.[c.fishId] ?? { name: c.fishId };
      const v = economy.variant(c.variant);
      const fname = fullName(f.name, v);
      const price = economy.price(c);
      return Tile({
        fish: true,
        art: fishPose(state, c.fishId, 'rest'),
        name: fmtKg(c.weight),
        value: money(price),
        badge: c.fishId === hotId ? 'Hot' : v.kind !== 'basic' ? v.name : null,
        label: `${fname}, ${fmtKg(c.weight)}, worth ${fmt(price)}`,
        onTap: () => { openFor = c.id; drawer.open(...fishDrawer(ctx, c, drawer, { keepLabel: 'Let go', onKeep: () => { economy.releaseCatch(c.id); ui.toast(`The ${fname} swims off`); } })); },
      });
    });
    const grid = TileGrid(tiles, { label: 'Fish in the cooler', slots: cap, cols: 4, empty: 'Empty. Fish you keep land in here.' });
    grid.classList.add('tilegrid--fish', 'tilegrid--rest');
    const { total } = economy.sellAllPreview();
    const plate = p.cooler.length
      ? Plate([h('span', 'Sell all'), money(total)], (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const r = economy.sellAll();
        drawer.close();
        if (r.ok) ui.flyCoins?.(rect, r.total);
      }, { label: `Sell all ${p.cooler.length} fish for ${fmt(total)} coins` })
      : h('div.plate-spacer', { 'aria-hidden': 'true' });
    place.body.replaceChildren(h('div.basket', grid), h('div.basket__rim', plate));
    if (openFor && !p.cooler.some((c) => c.id === openFor)) drawer.close();
  }
  const gate = changeGate();
  const sig = () => JSON.stringify([state.profile.cooler.map((c) => c.id), economy.coolerCapacity(), economy.hotFish()]);
  gate(sig(), 0);
  render();
  return {
    id: 'cooler',
    el: place.root,
    layerClass: 'is-place',
    refresh: () => { if (gate(sig(), 0)) render(); },
    dismiss: () => { if (drawer.isOpen) drawer.close(); else ui.close(); },
  };
}
