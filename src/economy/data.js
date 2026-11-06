// Agent B. Loads public/data/*.json into state.data (relative paths: the site runs under /Fishing/).
// Also reads Agent C's fish manifest so the UI only asks for preview images that exist.
const FILES = {
  fish: 'data/fish.json',
  islands: 'data/islands.json',
  items: 'data/items.json',
  economy: 'data/economy.json',
  fishBehaviour: 'data/fish-behaviour.json',
  fishAssets: 'assets/fish/manifest.json',
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
  for (const key of ['fish', 'islands', 'items', 'economy']) {
    if (!state.data[key]) {
      console.error(`[data] missing ${FILES[key]}`);
      state.data[key] = {};
    }
  }
  if (!state.data.fishAssets) state.data.fishAssets = {};
  return state.data;
}

/** Preview image path for a fish, or null when Agent C has not delivered one yet. */
export function fishPreview(state, fishId) {
  const entry = state.data.fishAssets?.[fishId];
  return entry?.preview ?? null;
}
