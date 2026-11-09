// Agent B. A letter from the harbour: what the crew, nets and aquarium earned while you were away.
import { h, fmt, money, ledgerRow, fmtDuration, plural, fill } from '../dom.js';

export function offlineLetter(ctx) {
  const { state, economy, ui } = ctx;
  const root = h('article.letter.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'While you were away' });

  function collect() {
    const r = economy.collectOffline();
    ui.close();
    if (r.ok) ui.toast(`Collected ${fmt(r.total)} coins`);
  }

  function render() {
    const po = state.profile.pendingOffline;
    if (!po) { fill(root); return; }
    const cap = economy.offlineCapHours();
    const sources = [po.crew, po.nets, po.aquarium, po.machines].filter((v) => v > 0).length;
    const text = po.crewFish > 0
      ? `Your crew fished for ${fmtDuration(po.seconds)} and landed ${plural(po.crewFish, 'fish', 'fish')}.`
      : `Your harbour kept earning for ${fmtDuration(po.seconds)}.`;
    fill(root, 
      h('h2.letter__title', 'While you were away'),
      h('p.letter__text', text),
      h('dl.ledger',
        sources > 1 && po.crew ? ledgerRow('Crew catch', money(po.crew)) : null,
        sources > 1 && po.nets ? ledgerRow('Nets and pots', money(po.nets)) : null,
        sources > 1 && po.aquarium ? ledgerRow('Aquarium visitors', money(po.aquarium)) : null,
        sources > 1 && po.machines ? ledgerRow('Machines and cannery', money(po.machines)) : null,
        ledgerRow(sources > 1 ? 'Total' : 'Earned', money(po.total), 'ledger__row--total')),
      h('p.letter__note', po.capped
        ? `The harbour stops after ${cap} hours. A night watch keeps it going longer.`
        : `The harbour keeps earning for up to ${cap} hours while you are away.`),
      h('button.btn.btn--primary', { 'aria-label': `Collect ${fmt(po.total)} coins`, on: { click: collect } }, h('span', 'Collect'), h('span.t-num', fmt(po.total))),
    );
  }
  render();
  return { id: 'offline', el: root, refresh: render, dismiss: collect };
}
