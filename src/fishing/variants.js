// Variant roll at spawn (master prompt 4.4b). Chances come from Agent B's public/data/variants.json;
// until it exists this fallback mirrors the ids so everything downstream already works.
const FALLBACK = {
  basic: { kind: 'basic', name: '', chance: 0.86, valueMult: 1 },
  bleached: { kind: 'morph', name: 'Bleached', chance: 0.035, valueMult: 1.5 },
  inkdark: { kind: 'morph', name: 'Inkdark', chance: 0.03, valueMult: 1.75 },
  gilded: { kind: 'morph', name: 'Gilded', chance: 0.02, valueMult: 2 },
  storm: { kind: 'element', element: 'storm', name: 'Storm', chance: 0.006, islandBoost: { stormspire_isles: 4 }, weatherBoost: { storm: 3 }, valueMult: 12 },
  frost: { kind: 'element', element: 'frost', name: 'Frost', chance: 0.006, islandBoost: { frostfang_fjord: 4 }, weatherBoost: { snow: 3 }, valueMult: 10 },
  ember: { kind: 'element', element: 'fire', name: 'Ember', chance: 0.006, islandBoost: { ember_caldera: 4 }, valueMult: 10 },
  bloom: { kind: 'element', element: 'bloom', name: 'Bloom', chance: 0.006, islandBoost: { mossback_bayou: 4 }, valueMult: 8 },
  rune: { kind: 'element', element: 'rune', name: 'Rune', chance: 0.005, islandBoost: { sunken_temple: 4 }, valueMult: 15 },
  abyss: { kind: 'element', element: 'deep', name: 'Abyss', chance: 0.004, islandBoost: { the_abyss: 4 }, valueMult: 25 },
  tide: { kind: 'element', element: 'tide', name: 'Tide', chance: 0.008, islandBoost: { driftwood_cove: 3 }, valueMult: 5 },
  rust: { kind: 'element', element: 'rust', name: 'Rust', chance: 0.006, islandBoost: { wreck_reef: 4 }, valueMult: 10 },
};

export function variantTable(state) {
  const v = state.data?.variants;
  return v && typeof v === 'object' && Object.keys(v).length ? v : FALLBACK;
}

export function variantInfo(state, id) {
  return variantTable(state)[id] || FALLBACK[id] || FALLBACK.basic;
}

export function isElemental(state, id) {
  return variantInfo(state, id).kind === 'element';
}

/** elementBoost: extra weight on elemental variants (open sea, glimmer hot spots: sea.js). */
export function rollVariant(state, islandId, weather = 'clear', elementBoost = 1) {
  const table = variantTable(state);
  // Test mode (?test=100) makes elemental variants common so powers can be played.
  const testBoost = state.test ? 30 : 1;
  const entries = Object.entries(table).filter(([, v]) => v && Number.isFinite(v.chance));
  let total = 0;
  const weights = entries.map(([id, v]) => {
    let w = v.chance;
    w *= v.islandBoost?.[islandId] || 1;
    w *= v.weatherBoost?.[weather] || 1;
    if (v.kind === 'element') w *= testBoost * elementBoost;
    total += w;
    return [id, w];
  });
  let r = Math.random() * total;
  for (const [id, w] of weights) { r -= w; if (r <= 0) return id; }
  return 'basic';
}
