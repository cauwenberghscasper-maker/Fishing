// Merges Agent B's fish.json (tier, depth band, weights, bait, time) with fish-behaviour.json.
// Fallbacks are used only while fish.json lacks an id, so the cove is never empty.
const FALLBACK = {
  glasswing_sardine: { name: 'Glasswing Sardine', tier: 'common', weight: [0.08, 0.3], depth: [0.3, 2.5], time: 'any' },
  driftback: { name: 'Driftback', tier: 'common', weight: [0.4, 1.6], depth: [0.6, 3], time: 'any' },
  compass_flounder: { name: 'Compass Flounder', tier: 'common', weight: [0.5, 2.2], depth: [1.5, 5], time: 'any' },
  shellback_blenny: { name: 'Shellback Blenny', tier: 'uncommon', weight: [0.1, 0.45], depth: [0.6, 3], time: 'any' },
  kelp_wraith: { name: 'Kelp Wraith', tier: 'uncommon', weight: [0.8, 3.2], depth: [1.5, 5], time: 'any' },
  seaglass_puffer: { name: 'Seaglass Puffer', tier: 'rare', weight: [0.6, 2.4], depth: [2, 7], time: 'any' },
  old_mooring: { name: 'The Old Mooring', tier: 'big', weight: [18, 46], depth: [4, 12], time: 'any' },
};

export const TIER_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, big: 3, boss: 5, monster: 6 };

// How many of each tier swim around at once (schools count as one).
export const TIER_POPULATION = { common: 4, uncommon: 3, rare: 2, epic: 1, legendary: 1, big: 1, boss: 0, monster: 1 };

export function fishInfo(state, id) {
  const data = state.data?.fish?.[id] || {};
  const fb = FALLBACK[id] || {};
  const behaviour = state.data?.fishBehaviour?.[id] || null;
  return {
    id,
    name: data.name || fb.name || id,
    tier: data.tier || fb.tier || 'common',
    weight: data.weight || fb.weight || [0.5, 1.5],
    depth: data.depth || fb.depth || [0.5, 4],
    time: data.time || fb.time || 'any',
    bait: data.bait || [],
    island: data.island || 'driftwood_cove',
    model: data.model || id,
    behaviour,
  };
}

export function rosterFor(state, islandId) {
  const behaviours = state.data?.fishBehaviour || {};
  const fish = state.data?.fish;
  const ids = fish
    ? Object.keys(fish).filter((id) => (fish[id].island || islandId) === islandId && behaviours[id])
    : [];
  // fish.json not there yet (or not for this island): use every fish we have behaviour for.
  return ids.length ? ids : Object.keys(behaviours);
}

export function timeAllows(time, hour) {
  if (!time || time === 'any') return true;
  const day = hour >= 6 && hour < 19;
  if (time === 'day') return day;
  if (time === 'night') return !day;
  if (time === 'dusk') return hour >= 17 || hour < 6;
  return true;
}
