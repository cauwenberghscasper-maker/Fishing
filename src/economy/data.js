// Agent B. Loads public/data/*.json into state.data (relative paths: the site runs under /Fishing/).
// Also reads Agent C's fish manifest so the UI only asks for preview images that exist.
import { fishPlaceholder } from '../fishing/silhouettes.js';
const FILES = {
  fish: 'data/fish.json',
  islands: 'data/islands.json',
  items: 'data/items.json',
  economy: 'data/economy.json',
  fishBehaviour: 'data/fish-behaviour.json',
  variants: 'data/variants.json',            // Agent B
  art: 'data/art.json',                      // Agent F's 2D art registry (B wires it into the UI)
  fishAssets: 'assets/fish/manifest.json',   // Agent C
  vfxAssets: 'assets/vfx/manifest.json',     // Agent E (catch-reveal backdrops: backdrop.<variantId>)
};

// Bad wifi must never cost progress (Casper 9 Nov): network errors are retried a few times; a 404
// (file not made yet) is not.
async function getJSON(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
    } catch { /* network: retry */ }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

export async function loadData(state) {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, path]) => [key, await getJSON(path)]));
  for (const [key, value] of entries) {
    if (value) state.data[key] = value;
  }
  const missing = [];
  for (const key of ['fish', 'islands', 'items', 'economy', 'variants']) {
    if (!state.data[key]) {
      console.error(`[data] missing ${FILES[key]}`);
      missing.push(key);
      state.data[key] = {};
    }
  }
  // Without these the save can't be checked properly: the save loader keeps the player's save
  // untouched and doesn't write until a reload with all data (src/save/profile.js).
  state.dataIncomplete = missing.length ? missing : null;
  if (!state.data.fishAssets) state.data.fishAssets = {};
  if (!state.data.art) state.data.art = {};
  if (!state.data.vfxAssets) state.data.vfxAssets = {};
  return state.data;
}

/**
 * Path of a 2D artwork in Agent F's registry (public/data/art.json), or null when it is not there yet.
 * Keys: gear.<slot>.<itemId>, island.<islandId>, building.<buildingId>.<level> (l1..l3), variant.<variantId>,
 * title.main, title.loading. The UI hides the slot when this returns null.
 */
export function artPath(state, key, { large = false } = {}) {
  const entry = live(state.data.art?.[key]);
  const path = typeof entry === 'string' ? entry : (large && entry?.icon) || entry?.path;
  return typeof path === 'string' && path ? path.replace(/^\//, '') : null;
}

/** Extra text an art entry may carry (e.g. tip.1..4 captions). */
export function artText(state, key) {
  const entry = state.data.art?.[key];   // captions are text, usable even while the painting is planned
  return typeof entry === 'object' ? entry?.text ?? entry?.caption ?? null : null;
}

/** Preview image path for a fish, or null when Agent C has not delivered one yet. */
export function fishPreview(state, fishId) {
  const entry = live(state.data.fishAssets?.[fishId]);
  return entry?.preview ?? null;
}

/** Registry rule: entries with `planned: true` have no file yet. The UI skips them so the live game never asks for a missing file. */
function live(entry) {
  return entry && typeof entry === 'object' && entry.planned === true ? null : entry;
}

/** A painted pose of a fish (hero | rest | portrait, 9b.2), falling back to the preview. Only manifest paths: no guessing, no 404s. */
export function fishPose(state, fishId, pose) {
  const entry = live(state.data.fishAssets?.[fishId]);
  const pick = (v) => (typeof v === 'object' && v ? (v.planned ? null : v.path) : v);
  return pick(entry?.[pose]) ?? pick(entry?.poses?.[pose]) ?? entry?.preview
    // No painting yet: its inked body silhouette, so no screen shows an empty frame.
    ?? (typeof document !== 'undefined' ? fishPlaceholder(state.data.fishBehaviour?.[fishId]?.silhouette || bodySilhouette(state.data.fishBehaviour?.[fishId]?.body)) : null);
}

// Silhouette cell for a body plan when a fish has no silhouette of its own.
function bodySilhouette(body) {
  return { eel: 'kelpwraith', flat: 'compass', bulky: 'puffer', shelled: 'shellback' }[body] || 'generic';
}

/** Path of an Agent E vfx asset (e.g. backdrop.<variantId>), or null. */
export function vfxPath(state, key) {
  const entry = live(state.data.vfxAssets?.[key]);
  const path = typeof entry === 'string' ? entry : entry?.path ?? entry?.image;
  return typeof path === 'string' && path ? path.replace(/^\//, '') : null;
}
