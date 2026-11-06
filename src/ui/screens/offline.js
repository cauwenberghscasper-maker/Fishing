// Agent B. A letter from the harbour: what the crew, nets and aquarium earned while you were away.
import { h, fmt, money, ledgerRow, fmtDuration, plural } from '../dom.js';

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
    if (!po) { root.replaceChildren(); return; }
    const cap = economy.offlineCapHours();
    const text = po.crewFish > 0
      ? `Your crew fished for ${fmtDuration(po.seconds)} and landed ${plural(po.crewFish, 'fish', 'fish')}.`
      : `Your harbour kept earning for ${fmtDuration(po.seconds)}.`;
    root.replaceChildren(
      h('h2.letter__title', 'While you were away'),
      h('p.letter__text', text),
      h('dl.ledger',
        po.crew ? ledgerRow('Crew catch', money(po.crew)) : null,
        po.nets ? ledgerRow('Nets and pots', money(po.nets)) : null,
        po.aquarium ? ledgerRow('Aquarium visitors', money(po.aquarium)) : null,
        ledgerRow('Total', money(po.total), 'ledger__row--total')),
      po.capped ? h('p.letter__note', `The crew stops after ${cap} hours. A night watch at the harbour keeps them going longer.`) : null,
      h('button.btn.btn--primary', { 'data-autofocus': true, on: { click: collect } }, h('span', 'Collect'), h('span.t-num', fmt(po.total))),
    );
  }
  render();
  return { id: 'offline', el: root, refresh: render, dismiss: collect };
}
