// Agent B. The logbook (Fishdex): every fish of every island, a dark silhouette (from its preview) until caught,
// records, every variant caught per species, and the set goals (morph set, every variant).
// Art: fishdex.<islandId> island page headers (Agent F), variant.<id> emblems (Agent F), fish previews (Agent C).
import { h, ico, fmt, fmtKg, fishWindow, fill, artImg } from '../dom.js';
import { fishPreview, artPath } from '../../economy/data.js';
import { sizeClassById, variantIds, variantOf, variantSets } from '../../economy/rules.js';
import { sheetHead, keepScroll } from './shop.js';

const titleCase = (id) => id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** Fish ids per island: fish.json, the island's roster and legendary, and Agent C's manifest entries that name an island. */
function rosterOf(state, islandId, isle) {
  const ids = new Set();
  for (const [id, f] of Object.entries(state.data.fish ?? {})) if (f.island === islandId) ids.add(id);
  for (const id of isle.fish ?? []) ids.add(id);
  for (const [id, e] of Object.entries(state.data.fishAssets ?? {})) if (e?.island === islandId) ids.add(id);
  if (isle.legendary) ids.add(isle.legendary);
  return [...ids];
}

function variantMarks(state, rec) {
  const row = h('div.vmarks', { role: 'list' });
  for (const id of variantIds(state.data)) {
    const v = variantOf(state.data, id);
    const have = (rec.variants?.[id] ?? 0) > 0;
    const label = `${id === 'basic' ? 'Plain' : v.name}${have ? `, caught ${fmt(rec.variants[id])}` : ', not caught yet'}`;
    const mark = h(`span.vmark${have ? '.is-have' : ''}`, { role: 'listitem', 'aria-label': label, title: label, style: { '--el': v.accent } });
    const img = id === 'basic' ? null : artImg(artPath(state, `variant.${id}`), '', { alt: '', onShow: () => mark.classList.add('has-art') });
    if (img) mark.append(img);
    else if (id === 'basic') mark.append(ico('fish'));
    row.append(mark);
  }
  return row;
}

function setLines(state, fish, rec) {
  const lines = [];
  const caught = Object.keys(rec.variants ?? {}).filter((v) => rec.variants[v] > 0);
  const names = caught.map((id) => (id === 'basic' ? 'plain' : variantOf(state.data, id).name));
  lines.push(h('span', `Seen as ${names.join(', ')}.`));
  for (const s of variantSets(state.data, rec)) {
    if (s.done) { lines.push(h('span.set-done', ico('rosette'), `${s.name} complete.`)); continue; }
    const coins = Math.round((fish.baseValue ?? 0) * (s.coinsPerBase ?? 0));
    lines.push(h('span', `${s.name}: ${s.have} of ${s.total}, pays ${fmt(coins)} coins and ${s.pearls} pearls.`));
  }
  return h('p.log__sets', lines);
}

export function logbookSheet(ctx) {
  const { state, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Logbook' });

  function render() {
    const p = state.profile;
    const islands = Object.entries(state.data.islands ?? {}).sort((a, b) => a[1].index - b[1].index);
    const body = h('div.sheet__body');
    let total = 0, known = 0, no = 0;
    for (const [islandId, isle] of islands) {
      const ids = rosterOf(state, islandId, isle);
      if (!ids.length) continue;
      const list = h('ol.log');
      for (const id of ids) {
        no += 1;
        total += 1;
        const f = state.data.fish?.[id] ?? { name: state.data.fishAssets?.[id]?.name ?? titleCase(id) };
        const rec = p.fishdex[id];
        if (rec) known += 1;
        const hint = f.hint ?? `Lives around ${isle.name}.`;
        list.append(h(`li.log__entry${rec ? '' : '.is-unknown'}`,
          fishWindow('log__win', fishPreview(state, id), { unknown: !rec }),
          h('div.log__name', h('span.log__no', `No. ${no}`), rec ? f.name : 'Not yet caught'),
          h('p.log__lore', rec ? f.lore ?? '' : hint),
          rec
            ? h('div.log__facts',
              h('span', 'Caught ', h('b', fmt(rec.count))),
              h('span', 'Heaviest ', h('b', fmtKg(rec.heaviest)), rec.heaviestSize === 'trophy' ? ` (${sizeClassById(state.data, 'trophy')?.name ?? 'Trophy'})` : ''))
            : null,
          rec ? variantMarks(state, rec) : null,
          rec ? setLines(state, f, rec) : null));
      }
      // island page header: Agent F's painting when it exists, the island name always
      const banner = h('div.log__banner');
      const img = artImg(artPath(state, `fishdex.${islandId}`), '', { alt: '', slot: banner });
      if (img) { banner.append(img); body.append(banner); }
      body.append(h('h3.section-title', isle.name), list);
    }
    fill(root, sheetHead('Logbook', `${known} of ${total} species recorded.`, () => ui.close()), body);
  }
  render();
  return { id: 'logbook', el: root, refresh: () => keepScroll(root, render) };
}
