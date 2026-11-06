// Boot wiring only (lead). Each system lives in its own folder; contracts in docs/INTERFACES.md
import { events } from './core/events.js';
import { state } from './core/state.js';
import { loadData } from './economy/data.js';
import { loadProfile } from './save/profile.js';
import { startEconomy } from './economy/index.js';
import { startUI } from './ui/app.js';
import { startWorld } from './world/game.js';
import { startVfx } from './vfx/index.js';

async function boot() {
  await loadData(state);
  await loadProfile(state, events);
  startEconomy({ state, events });
  await startUI({ root: document.getElementById('ui'), state, events });
  await startWorld({ canvas: document.getElementById('game'), state, events });
  await startVfx({ state, events });
  events.emit('game:ready', {});
  window.__game = { state, events };
}

boot().catch((err) => {
  console.error('[boot]', err);
});
