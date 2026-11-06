// Agent B. The logbook (Fishdex): every species, records, and an ink silhouette plus a hint for the ones you have not met.
import { h, fmt, fmtKg, fishWindow, fill } from '../dom.js';
import { fishPreview } from '../../economy/data.js';
import { sizeClassById } from '../../economy/rules.js';
import { sheetHead, keepScroll } from './shop.js';

export function logbookSheet(ctx) {
  const { state, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Logbook' });

  function render() {
    const p = state.profile;
    const islands = state.data.islands ?? {};
    const body = h('div.sheet__body');
    let total = 0, known = 0;
    const order = Object.entries(islands).sort((a, b) => a[1].index - b[1].index);
    let no = 0;
    for (const [islandId, isle] of order) {
      const ids = (isle.fish ?? []).filter((id) => state.data.fish?.[id]);
      if (!ids.length) continue;
      const list = h('ol.log');
      for (const id of ids) {
        no += 1;
        total += 1;
        const f = state.data.fish[id];
        const rec = p.fishdex[id];
        if (rec) known += 1;
        const win = fishWindow('log__win', fishPreview(state, id));
        const entry = h(`li.log__entry${rec ? '' : '.is-unknown'}`,
          win,
          h('div.log__name', h('span.log__no', `No. ${no}`), rec ? f.name : 'Not yet caught'),
          h('p.log__lore', rec ? f.lore : f.hint ?? 'Nobody has seen it up close.'),
          rec
            ? h('div.log__facts',
              h('span', 'Caught ', h('b', fmt(rec.count))),
              h('span', 'Heaviest ', h('b', fmtKg(rec.heaviest)), rec.heaviestSize === 'trophy' ? ` (${sizeClassById(state.data, 'trophy')?.name ?? 'Trophy'})` : ''))
            : null);
        list.append(entry);
      }
      body.append(h('h3.section-title', isle.name), list);
    }
    const sub = `${known} of ${total} species recorded.`;
    fill(root, sheetHead('Logbook', sub, () => ui.close()), body);
  }
  render();
  return { id: 'logbook', el: root, refresh: () => keepScroll(root, render) };
}
