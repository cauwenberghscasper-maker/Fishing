// Driftwood Cove layout. Units are metres; x = east, z = south (towards the camera), water at y = 0.
// The camera looks north into the cove, like the key art: basalt cliffs at the back, a golden
// beach crescent, the long patched pier running south into deep water.
// Tweak placement here; nothing else needs to change.
export const driftwoodCove = {
  id: 'driftwood_cove',
  size: 150,               // terrain mesh extent (square)
  resolution: 220,         // terrain grid segments per side
  seabed: { depth: 13.5, fall: 7.5 }, // max depth and how fast it drops off the shore

  // Land shapes, merged with a smooth max. top = height of the shape's interior,
  // edge = metres over which it falls to the shore, rough = noise amplitude on top.
  shapes: [
    { id: 'cliffs', x: 0, z: -19, rx: 34, rz: 9.5, rot: 0.04, top: 7.4, edge: 2.4, rough: 1.1, cliff: true },
    { id: 'cliffs_west', x: -21, z: -10, rx: 9, rz: 9, rot: 0.5, top: 6.2, edge: 2.2, rough: 1.0, cliff: true },
    { id: 'beach', x: 0, z: -6.5, rx: 16.5, rz: 8, rot: 0.05, top: 0.95, edge: 7.5, rough: 0.12 },
    { id: 'west_headland', x: -15.5, z: -0.5, rx: 5.5, rz: 8, rot: -0.35, top: 2.2, edge: 3.2, rough: 0.55, rocky: true },
    { id: 'east_point', x: 13.5, z: -3.5, rx: 7.5, rz: 5.5, rot: 0.3, top: 1.25, edge: 4.5, rough: 0.15 },
    { id: 'islet', x: -9.5, z: 12.5, rx: 2.1, rz: 1.6, rot: 0.4, top: 0.7, edge: 1.4, rough: 0.35, rocky: true },
  ],

  spawn: { x: 2.2, z: -3.2, facing: Math.PI },

  // Walkable decks (piers). A deck only exists when its model loaded (asset ids, first match wins).
  decks: [
    { id: 'pier_main', asset: ['pier_main', 'pier_long', 'pier'], from: [3.2, -1.5], to: [5.4, 13.5], width: 2.3, height: 0.85 },
  ],

  // Interaction zones (zone:enter / zone:exit). kind: shop | pier | boat | building | plot
  zones: [
    { id: 'shop', kind: 'shop', x: -1.2, z: -8.4, r: 2.6 },
    { id: 'pier_1', kind: 'pier', x: 5.2, z: 11.6, r: 2.8, needsDeck: 'pier_main' },
    { id: 'shore_1', kind: 'pier', x: -4.5, z: 0.6, r: 3.2 },
    { id: 'boat_dock', kind: 'boat', x: 6.6, z: 6.4, r: 1.8, needsDeck: 'pier_main' },
    { id: 'workers_hut', kind: 'building', x: 10.2, z: -6.2, r: 2.4 },
    { id: 'plot_east', kind: 'plot', x: 17.5, z: 2.5, r: 3.0 },
  ],

  // Props from Agent D's world manifest. Missing asset = not placed.
  // collide: radius of the invisible collider (0 = walk through).
  props: [
    { asset: ['shop', 'cove_shop', 'shop_hull'], x: -1.2, z: -11.6, rot: 0, collide: 3.0 },
    { asset: ['beached_boat', 'fisher_hut', 'boat_wreck'], x: -10.5, z: -6.0, rot: 0.55, collide: 2.6 },
    { asset: ['workers_hut', 'worker_hut', 'hut'], x: 10.8, z: -9.0, rot: -0.35, collide: 2.4 },
    { asset: ['pier_main', 'pier_long', 'pier'], x: 4.3, z: 6.0, rot: -0.15, collide: 0 },
    { asset: ['skiff', 'boat', 'rowboat'], x: 7.6, z: 10.0, rot: -0.1, collide: 0, float: true },
    { asset: ['mast_post', 'lantern_post'], x: 2.0, z: -9.4, rot: 0, collide: 0.4 },
    { asset: ['lantern_post', 'rope_post'], x: 12.5, z: -1.0, rot: 0.3, collide: 0.35 },
    { asset: ['rope_post'], x: 1.8, z: -2.4, rot: 0.2, collide: 0.3 },
    { asset: ['rope_post'], x: 6.6, z: -3.6, rot: -0.4, collide: 0.3 },
    { asset: ['net_rack', 'drying_net'], x: 6.5, z: -9.6, rot: -0.2, collide: 1.2 },
    { asset: ['barrels', 'barrel'], x: 2.8, z: -10.4, rot: 0.6, collide: 0.7 },
    { asset: ['crates', 'crate'], x: -5.2, z: -9.8, rot: -0.3, collide: 0.8 },
    { asset: ['driftwood_log', 'driftwood'], x: 11.0, z: -4.2, rot: 1.1, collide: 0.9 },
    { asset: ['driftwood_log', 'driftwood'], x: -6.5, z: -1.4, rot: -0.4, collide: 0.9 },
    { asset: ['rock_large', 'basalt_rock', 'rock'], x: -13.5, z: 2.5, rot: 0.3, collide: 1.6, scale: 1.4 },
    { asset: ['rock_large', 'basalt_rock', 'rock'], x: -9.5, z: 12.4, rot: 1.9, collide: 0, scale: 1.1 },
    { asset: ['rock_medium', 'rock'], x: 15.5, z: 1.2, rot: 0.8, collide: 1.0 },
    { asset: ['rock_small', 'rock'], x: -2.5, z: 4.6, rot: 2.4, collide: 0, scale: 0.8 },
    { asset: ['starfish'], x: -6.0, z: -3.4, rot: 0.3, collide: 0 },
    { asset: ['starfish'], x: 8.2, z: -4.8, rot: 1.4, collide: 0 },
    { asset: ['grass_tuft', 'grass'], x: -3.5, z: -6.8, rot: 0, collide: 0 },
    { asset: ['grass_tuft', 'grass'], x: 8.5, z: -7.5, rot: 1, collide: 0 },
  ],

  // Where each fish habitat lives (fish-behaviour.json `habitat`). Areas are circles.
  habitats: {
    surface: { minDepth: 1.2, areas: [{ x: 4, z: 18, r: 12 }, { x: -4, z: 10, r: 7 }] },
    driftwood: { minDepth: 0.8, areas: [{ x: -5, z: 4.5, r: 4 }, { x: 10, z: 4, r: 4 }] },
    bottom: { minDepth: 1.5, areas: [{ x: 0, z: 7, r: 7 }, { x: 11, z: 9, r: 5 }] },
    rocks: { minDepth: 0.9, areas: [{ x: -12, z: 6, r: 4.5 }, { x: -9.5, z: 12.5, r: 3.5 }] },
    kelp: { minDepth: 2.0, areas: [{ x: -6, z: 15, r: 5 }] },
    mid: { minDepth: 3.0, areas: [{ x: 6, z: 17, r: 8 }, { x: -2, z: 20, r: 8 }] },
    deep: { minDepth: 6.0, areas: [{ x: 6, z: 26, r: 8 }] },
  },

  // Kelp beds drawn as swaying under-water silhouettes (no model needed).
  kelpBeds: [{ x: -6, z: 15, r: 4.5, count: 14 }, { x: 13, z: 15, r: 3, count: 7 }],

  // Lighting matched to art/concepts/world/driftwood_cove_key.webp
  palette: {
    sun: '#ffcf8a',
    sunIntensity: 3.0,
    sky: '#9fd2d6',
    ground: '#5a3d22',
    hemiIntensity: 1.05,
    fog: '#1c5a52',
    fogDensity: 0.0105,
    background: '#0f3a35',
    water: {
      shallow: '#3fe0c4',
      mid: '#0f8f78',
      deep: '#06463d',
      abyss: '#021f1c',
      foam: '#fff4dc',
      skyHorizon: '#f7d79a',
      skyZenith: '#7cc3c8',
    },
    sand: { dry: '#f0b64e', wet: '#a8742f', under: '#c8a05a' },
    grass: { base: '#8a9a2c', tip: '#c9c046', dark: '#3f5a1d' },
    rock: { base: '#3a3631', light: '#6b6155', moss: '#7d8a2c' },
  },
};
