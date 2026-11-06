// Agent B. Settings: sound, graphics, test mode (with test helpers), erase save.
import { h, ico, fill } from '../dom.js';
import { sheetHead } from './shop.js';
import { eraseSave, PROFILE_VERSION } from '../../save/profile.js';

function choice(options, value, onPick, label) {
  return h('div.choice', { role: 'group', 'aria-label': label }, options.map(([v, text]) =>
    h('button', { 'aria-pressed': String(v === value), on: { click: () => onPick(v) } }, text)));
}

function row(label, hint, control) {
  return h('div.setting', h('div.setting__label', label, hint ? h('span.setting__hint', hint) : null), control);
}

function withParam(key, value) {
  const url = new URL(location.href);
  if (value == null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  return url.toString();
}

export function settingsSheet(ctx) {
  const { state, economy, ui } = ctx;
  const root = h('section.sheet.chart.chart--framed', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' });
  let confirmErase = false;

  function render() {
    const s = state.profile.settings;
    const body = h('div.sheet__body',
      row('Sound', null, choice([[true, 'On'], [false, 'Off']], s.sound, (v) => { economy.setSetting('sound', v); render(); }, 'Sound')),
      row('Graphics', 'Lower it if the game stutters on your phone.',
        choice([['low', 'Low'], ['auto', 'Auto'], ['high', 'High']], s.quality, (v) => { economy.setSetting('quality', v); render(); }, 'Graphics')),
    );

    if (state.test) {
      body.append(
        row('Test coins', 'Adds 10,000 coins.', h('button.btn', { on: { click: () => { economy.testGrantCoins(); ui.toast('10,000 coins added'); } } }, 'Add')),
        row('Islands', 'Unlock every island on the chart.', h('button.btn', { on: { click: () => { economy.testUnlockIslands(); ui.toast('Every island unlocked'); } } }, 'Unlock')),
        row('Time away', 'Pretend you were gone for 3 hours.', h('button.btn', { on: { click: () => { ui.close(); economy.simulateAway(3 * 3600); } } }, ico('hourglass'), '3 h')),
      );
    }

    body.append(row(
      state.test ? 'Leave test mode' : 'Test mode',
      state.test ? 'Back to your real save.' : 'A separate save with 100 times the coins, for trying things out.',
      h('a.btn', { href: withParam('test', state.test ? null : '100') }, state.test ? 'Leave' : 'Start')));

    body.append(row(
      'Erase this save',
      confirmErase ? 'This cannot be undone. Tap again to erase everything.' : state.test ? 'Wipes the test save only.' : 'Coins, gear, catches and your harbour.',
      h('button.btn.btn--danger', {
        on: {
          click: () => {
            if (!confirmErase) { confirmErase = true; render(); return; }
            eraseSave(state);
            location.reload();
          },
        },
      }, confirmErase ? 'Erase' : 'Erase…')));

    body.append(h('p.settings-foot', `Progress is saved on this device (save version ${PROFILE_VERSION}). Coins and pearls are earned in the game only; nothing is ever sold for real money.`));
    fill(root, sheetHead('Settings', null, () => ui.close()), body);
  }
  render();
  return { id: 'settings', el: root, onClose: () => { confirmErase = false; } };
}
