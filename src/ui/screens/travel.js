// Agent B. Sea chart at the boat dock: the island chain with Agent F's island cards (art.json island.<id>),
// what each island needs (coins, species, legendary, a boat that reaches it), and setting sail.
import { h, ico, money, fill, artImg } from '../dom.js';
import { artPath } from '../../economy/data.js';
import { sheetHead, keepScroll } from './shop.js';
import { isVisitor, hostName } from '../net.js';

export function travelSheet(ctx) {
  const { state, economy, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sea chart' });

  function reqLine(r) {
    const cls = `span.req${r.met ? '.is-met' : ''}`;
    if (r.kind === 'coins') return h(cls, money(r.need));
    if (r.kind === 'species') return h(cls, `${r.need} species in your logbook (${Math.min(r.have, r.need)})`);
    if (r.kind === 'legendary') return h(cls, `landing the ${state.data.fish?.[r.fishId]?.name ?? r.fishId.replace(/_/g, ' ')}`);
    if (r.kind === 'boat') return r.met ? null : h(cls, 'a boat that sails this far');
    return null;
  }

  function render() {
    const p = state.profile;
    const here = state.world?.islandId ?? p.currentIsland;
    const visitor = isVisitor(state);
    const isles = Object.entries(state.data.islands ?? {}).sort((a, b) => a[1].index - b[1].index);
    const list = h('ol.islands');
    for (const [id, isle] of isles) {
      const unlocked = p.unlockedIslands.includes(id);
      const charted = (isle.fish?.length ?? 0) > 0;
      let go;
      if (id === here) go = h('div.isle__go', h('span.pebble.pebble--glow', 'You are here'));
      else if (visitor) go = h('div.isle__go', h('span.reqs', unlocked ? 'On your chart.' : 'Not on your chart yet.'));
      else if (unlocked && charted) {
        go = h('div.isle__go', h('span', ''), h('button.btn', { on: { click: () => { const r = economy.travel(id); if (r.ok) ui.close(); } } }, ico('boat'), 'Set sail'));
      } else {
        const reqs = economy.islandRequirements(id) ?? [];
        const allMet = reqs.every((r) => r.met);
        const parts = reqs.map(reqLine).filter(Boolean);
        go = h('div.isle__go',
          h('span.reqs', unlocked ? 'Unlocked.' : ['Needs ', parts.flatMap((el, i) => (i ? [h('span', i === parts.length - 1 ? ' and ' : ', '), el] : [el])), '.']),
          allMet && charted && !unlocked ? h('button.btn', { on: { click: () => { const r = economy.unlockIsland(id); if (r.ok) ui.toast(`${isle.name} is on your chart`); } } }, 'Unlock') : null);
      }
      const card = h('div.isle__art');
      const img = artImg(artPath(state, `island.${id}`), '', { alt: isle.name, slot: card });
      if (img) card.append(img);
      list.append(h(`li.isle${id === here ? '.is-here' : ''}${unlocked ? '' : '.is-locked'}`,
        img ? card : null,
        h('div.isle__no', String(isle.index)),
        h('div.isle__name', isle.name),
        h('div.isle__feel', isle.feel),
        go));
    }
    const charted = isles.filter(([, i]) => (i.fish?.length ?? 0) > 0).length;
    const notes = [];
    if (visitor) notes.push(h('p.chart-note', `You are on ${hostName(state)}'s island. Leave the room to sail your own boat.`));
    else if (charted < isles.length) notes.push(h('p.chart-note', 'Only Driftwood Cove is charted so far. The other waters open in a later voyage.'));
    fill(root, sheetHead('Sea chart', `Your boat: the ${economy.boat().name.toLowerCase()}.`, () => ui.close()), h('div.sheet__body', notes, list));
  }
  render();
  return { id: 'travel', el: root, refresh: () => keepScroll(root, render) };
}
