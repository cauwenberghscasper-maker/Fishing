// Agent B. Sea chart at the boat dock: the island chain, what each one needs, and setting sail.
import { h, ico, fmt, money, fill } from '../dom.js';
import { sheetHead, keepScroll } from './shop.js';

export function travelSheet(ctx) {
  const { state, economy, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sea chart' });

  function reqLine(r) {
    const cls = `span.req${r.met ? '.is-met' : ''}`;
    if (r.kind === 'coins') return h(cls, money(r.need));
    if (r.kind === 'species') return h(cls, `${r.need} species in your logbook (${Math.min(r.have, r.need)})`);
    if (r.kind === 'legendary') return h(cls, `Land the ${state.data.fish?.[r.fishId]?.name ?? r.fishId.replace(/_/g, ' ')}`);
    if (r.kind === 'dock') return r.met ? null : h(cls, 'A bigger boat dock');
    return null;
  }

  function render() {
    const p = state.profile;
    const here = state.world?.islandId ?? p.currentIsland;
    const isles = Object.entries(state.data.islands ?? {}).sort((a, b) => a[1].index - b[1].index);
    const list = h('ol.islands');
    for (const [id, isle] of isles) {
      const unlocked = p.unlockedIslands.includes(id);
      const charted = (isle.fish?.length ?? 0) > 0;
      let go;
      if (id === here) go = h('div.isle__go', h('span.pebble.pebble--glow', 'You are here'));
      else if (unlocked && charted) {
        go = h('div.isle__go', h('span', ''), h('button.btn', { on: { click: () => { economy.travel(id); ui.close(); } } }, ico('boat'), 'Set sail'));
      } else {
        const reqs = economy.islandRequirements(id) ?? [];
        const allMet = reqs.every((r) => r.met);
        go = h('div.isle__go',
          h('span.reqs', unlocked ? 'Unlocked. ' : 'Needs ', reqs.map(reqLine).filter(Boolean).flatMap((el, i) => (i ? [h('span', ' and '), el] : [el]))),
          allMet && charted ? h('button.btn', { on: { click: () => { const r = economy.unlockIsland(id); if (r.ok) ui.toast(`${isle.name} is on your chart`); } } }, 'Unlock') : null);
      }
      list.append(h(`li.isle${id === here ? '.is-here' : ''}${unlocked ? '' : '.is-locked'}`,
        h('div.isle__no', String(isle.index)),
        h('div.isle__name', isle.name),
        h('div.isle__feel', isle.feel),
        go));
    }
    const charted = isles.filter(([, i]) => (i.fish?.length ?? 0) > 0).length;
    const note = charted < isles.length ? h('p.chart-note', 'Only Driftwood Cove is charted so far. The other waters open in a later voyage.') : null;
    fill(root, sheetHead('Sea chart', 'The island chain. Sail from the home pier.', () => ui.close()), h('div.sheet__body', note, list));
  }
  render();
  return { id: 'travel', el: root, refresh: () => keepScroll(root, render) };
}

export { fmt };
