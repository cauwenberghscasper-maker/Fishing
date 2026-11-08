// Agent B. Loads public/data/*.json into state.data (relative paths: the site runs under /Fishing/).
// Also reads Agent C's fish manifest so the UI only asks for preview images that exist.
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

async function getJSON(path) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // file not created yet (e.g. another agent's data)
  }
}

export async function loadData(state) {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, path]) => [key, await getJSON(path)]));
  for (const [key, value] of entries) {
    if (value) state.data[key] = value;
  }
  for (const key of ['fish', 'islands', 'items', 'economy', 'variants']) {
    if (!state.data[key]) {
      console.error(`[data] missing ${FILES[key]}`);
      state.data[key] = {};
    }
  }
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
  const entry = state.data.art?.[key];
  const path = typeof entry === 'string' ? entry : (large && entry?.icon) || entry?.path;
  return typeof path === 'string' && path ? path.replace(/^\//, '') : null;
}

/** Extra text an art entry may carry (e.g. tip.1..4 captions). */
export function artText(state, key) {
  const entry = state.data.art?.[key];
  return typeof entry === 'object' ? entry?.text ?? entry?.caption ?? null : null;
}

/** Preview image path for a fish, or null when Agent C has not delivered one yet. */
export function fishPreview(state, fishId) {
  const entry = state.data.fishAssets?.[fishId];
  return entry?.preview ?? null;
}

/** A painted pose of a fish (hero | rest | portrait, 9b.2), falling back to the preview. Only manifest paths: no guessing, no 404s. */
export function fishPose(state, fishId, pose) {
  const entry = state.data.fishAssets?.[fishId];
  return entry?.[pose] ?? entry?.poses?.[pose] ?? entry?.preview ?? null;
}

/** Path of an Agent E vfx asset (e.g. backdrop.<variantId>), or null. */
export function vfxPath(state, key) {
  const entry = state.data.vfxAssets?.[key];
  const path = typeof entry === 'string' ? entry : entry?.path ?? entry?.image;
  return typeof path === 'string' && path ? path.replace(/^\//, '') : null;
}
