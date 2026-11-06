// Driftwood Cove layout. Units are metres; x = east, z = south (towards the camera), water at y = 0.
// The camera looks north into the cove, like the key art: basalt cliffs at the back, a golden
// beach crescent, the long patched pier running south into deep water.
// Tweak placement here; nothing else needs to change.
export const driftwoodCove = {
  id: 'driftwood_cove',
  size: 150,               // terrain mesh extent (square)
  resolution: 220,         // terrain grid segments per side
  seabed: { depth: 14, fall: 11 }, // max depth and how fast it drops off the shore

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

  // Piers are chains of Agent D's 3 m modules (deck top 0.75 m, origin at water level).
  // The deck is walkable only when its modules loaded.
  piers: [
    {
      id: 'pier_main',
      from: [3.0, -1.6],
      to: [4.6, 13.6],
      width: 2.0,
      modules: ['pier_straight', 'pier_patched', 'pier_straight_b', 'pier_straight', 'pier_end'],
    },
  ],

  // Interaction zones (zone:enter / zone:exit). kind: shop | pier | boat | building | plot
  zones: [
    { id: 'shop', kind: 'shop', x: -1.2, z: -8.2, r: 2.6 },
    { id: 'pier_1', kind: 'pier', x: 4.45, z: 11.8, r: 2.6, needsDeck: 'pier_main' },
    { id: 'shore_1', kind: 'pier', x: -4.5, z: 0.6, r: 3.2 },
    { id: 'boat_dock', kind: 'boat', x: 4.1, z: 7.2, r: 1.6, needsDeck: 'pier_main' },
    { id: 'workers_hut', kind: 'building', x: 10.2, z: -6.2, r: 2.4 },
    { id: 'plot_east', kind: 'plot', x: 17.5, z: 2.5, r: 3.0 },
  ],

  // Props from Agent D's world manifest (ids are stable). Missing asset = not placed.
  // Y comes from the manifest placement: water/shore assets sit at sea level, others on the ground.
  // collide: radius of the invisible collider (0 = walk through).
  props: [
    // Signature buildings (D, coming)
    { asset: ['shop'], x: -1.2, z: -11.6, rot: 0, collide: 3.0 },
    { asset: ['fisher_hut'], x: -10.5, z: -6.0, rot: 0.55, collide: 2.6 },
    { asset: ['workers_hut'], x: 10.8, z: -9.0, rot: -0.35, collide: 2.4 },
    { asset: ['boat_dock'], x: 6.2, z: 7.4, rot: 0.1, collide: 0 },
    { asset: ['skiff'], x: 6.6, z: 10.4, rot: -0.15, collide: 0, float: true },

    // Basalt columns at the foot of the cliffs
    { asset: ['cliff_columns_a'], x: -6.6, z: -12.4, rot: 0.05, collide: 1.7 },
    { asset: ['cliff_columns_b'], x: 6.4, z: -12.6, rot: -0.1, collide: 1.5 },
    { asset: ['cliff_columns_a'], x: 13.8, z: -10.6, rot: -0.45, collide: 1.7, scale: 0.9 },
    { asset: ['columns_steps'], x: -4.0, z: -10.8, rot: 0.2, collide: 1.1 },
    { asset: ['cliff_columns_b'], x: -15.2, z: -6.4, rot: 0.6, collide: 1.5 },

    // Shore rocks, tide pool, islet
    { asset: ['tide_pool_a'], x: -10.7, z: 4.4, rot: 0.4, collide: 1.6 },
    { asset: ['rock_shore'], x: -8.4, z: 2.0, rot: 2.6, collide: 0.8 },
    { asset: ['rock_shore'], x: 12.4, z: 1.2, rot: -0.6, collide: 0.8 },
    { asset: ['rock_shore'], x: 7.8, z: 1.6, rot: 0.9, collide: 0.7, scale: 0.8 },
    { asset: ['rock_l'], x: -9.6, z: 12.4, rot: 1.9, collide: 0, scale: 1.25 },
    { asset: ['rock_cluster'], x: 15.6, z: 0.4, rot: 0.8, collide: 1.2 },
    { asset: ['rock_l'], x: -14.2, z: 1.4, rot: 0.3, collide: 1.3 },
    { asset: ['rock_m'], x: -12.4, z: -3.0, rot: 1.2, collide: 0.6 },
    { asset: ['rock_m'], x: 9.4, z: -2.2, rot: 2.2, collide: 0.6 },
    { asset: ['rock_s'], x: -2.6, z: 3.4, rot: 2.4, collide: 0 },
    { asset: ['rock_s'], x: 1.0, z: -6.2, rot: 0.4, collide: 0.3 },

    // Trees and greenery (sparingly: the key art is cliffs, sand and grass)
    { asset: ['palm_bent'], x: 15.0, z: -2.2, rot: 2.6, collide: 0.45 },
    { asset: ['palm_young'], x: -5.6, z: -9.8, rot: 0.8, collide: 0.35 },
    { asset: ['palm_twin'], x: 12.8, z: -6.6, rot: 4.0, collide: 0.5 },
    { asset: ['palm_tall'], x: -16.0, z: -2.6, rot: 1.0, collide: 0.45 },
    { asset: ['bush_seagrape'], x: -8.0, z: -9.4, rot: 0.3, collide: 0.6 },
    { asset: ['bush_seagrape'], x: 8.6, z: -10.6, rot: 2.1, collide: 0.6 },
    { asset: ['bush_seagrape_s'], x: 3.8, z: -11.2, rot: 1.0, collide: 0.35 },
    { asset: ['bush_spiky'], x: -13.4, z: -1.0, rot: 0.6, collide: 0.5 },
    { asset: ['bush_spiky'], x: 16.4, z: -5.4, rot: 2.0, collide: 0.5 },
    { asset: ['beach_grass_a'], x: -3.2, z: -7.6, rot: 0.2, collide: 0 },
    { asset: ['beach_grass_b'], x: 1.6, z: -9.0, rot: 1.4, collide: 0 },
    { asset: ['beach_grass_a'], x: 6.8, z: -7.4, rot: 2.8, collide: 0 },
    { asset: ['beach_grass_b'], x: -9.2, z: -2.6, rot: 0.9, collide: 0 },
    { asset: ['beach_grass_a'], x: 11.8, z: -3.6, rot: 1.9, collide: 0 },
    { asset: ['beach_grass_b'], x: -12.0, z: 0.2, rot: 2.4, collide: 0 },

    // Beach clutter washed up by the tide
    { asset: ['driftwood_log'], x: 10.8, z: -4.4, rot: 1.1, collide: 0.9 },
    { asset: ['driftwood_branch'], x: -6.6, z: -1.6, rot: -0.4, collide: 0 },
    { asset: ['driftwood_branch'], x: -5.6, z: 2.6, rot: 0.7, collide: 0 },
    { asset: ['seaweed_pile_a'], x: -2.4, z: 0.4, rot: 0.3, collide: 0 },
    { asset: ['seaweed_pile_a'], x: 9.0, z: -0.2, rot: 1.7, collide: 0 },
    { asset: ['shells_a'], x: -4.2, z: -2.8, rot: 0.5, collide: 0 },
    { asset: ['starfish_a'], x: -6.0, z: -3.6, rot: 0.3, collide: 0 },
    { asset: ['starfish_a'], x: 8.2, z: -4.8, rot: 1.4, collide: 0 },
    { asset: ['starfish_a'], x: 0.6, z: 0.6, rot: 2.6, collide: 0 },
  ],

  // Scattered beds (seeded so the cove looks the same every time).
  scatter: [
    { asset: ['kelp_a'], x: -6, z: 15, r: 4.2, count: 11, scale: [1.2, 1.9], seed: 3, minDepth: 1.8 },
    { asset: ['kelp_a'], x: 13, z: 14.5, r: 2.8, count: 6, scale: [1.1, 1.7], seed: 8, minDepth: 1.8 },
    { asset: ['kelp_a'], x: -13, z: 9, r: 2.2, count: 4, scale: [0.9, 1.3], seed: 5, minDepth: 1.2 },
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

  // Kelp drawn as swaying silhouettes only when the kelp model is missing.
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
    sand: { dry: '#e9b45a', wet: '#9c7438', under: '#b89a5c' },
    grass: { base: '#8a9a2c', tip: '#c9c046', dark: '#3f5a1d' },
    rock: { base: '#3a3631', light: '#6b6155', moss: '#7d8a2c' },
  },
};
