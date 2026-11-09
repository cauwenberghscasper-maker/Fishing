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
  // `plot`: the shape only exists once that plot is owned (master prompt 4.6). No plot = backdrop.
  shapes: [
    { id: 'cliffs', x: 0, z: -21, rx: 34, rz: 9.5, rot: 0.04, top: 7.4, edge: 2.4, rough: 1.1, cliff: true },
    { id: 'cliffs_west', x: -23, z: -12, rx: 9, rz: 9, rot: 0.5, top: 6.2, edge: 2.2, rough: 1.0, cliff: true },
    { id: 'islet', x: -9.5, z: 12.5, rx: 2.1, rz: 1.6, rot: 0.4, top: 0.7, edge: 1.4, rough: 0.35, rocky: true },
    { id: 'sandbar', plot: 'sandbar', x: 1.5, z: -2.0, rx: 5.0, rz: 4.3, rot: 0.1, top: 0.75, edge: 3.2, rough: 0.06 },
    { id: 'palm_spit', plot: 'palm_spit', x: 11.5, z: -3.0, rx: 8.5, rz: 4.0, rot: 0.25, top: 1.0, edge: 3.5, rough: 0.1 },
    { id: 'wreck_beach', plot: 'wreck_beach', x: -8.5, z: -6.0, rx: 7.8, rz: 5.0, rot: -0.15, top: 0.95, edge: 4.0, rough: 0.12 },
    { id: 'tidepool_shelf', plot: 'tidepool_shelf', x: -15.0, z: 0.5, rx: 6.5, rz: 5.2, rot: -0.35, top: 1.2, edge: 2.8, rough: 0.45, rocky: true },
    { id: 'basalt_cliff', plot: 'basalt_cliff', x: 6.0, z: -10.5, rx: 7.2, rz: 4.4, rot: 0.05, top: 1.7, edge: 2.2, rough: 0.35, rocky: true },
    { id: 'kelp_shallows', plot: 'kelp_shallows', x: -6.5, z: 10.0, rx: 6.0, rz: 4.4, rot: 0.1, top: -0.55, edge: 3.0, rough: 0.1 },
    { id: 'mooring_deep', plot: 'mooring_deep', x: 12.0, z: 11.0, rx: 3.4, rz: 3.6, rot: 0.5, top: 0.9, edge: 1.8, rough: 0.3, rocky: true },
    // The outer ring (Casper: "upgrade 360, lots of room per upgrade for machines and fishers").
    // East: Sunset Dunes, a long golden beach with a palm-topped dune crest.
    { id: 'sunset_dunes', plot: 'sunset_dunes', x: 31.0, z: -1.0, rx: 11.0, rz: 7.5, rot: 0.15, top: 1.05, edge: 3.6, rough: 0.16 },
    { id: 'sunset_dunes_crest', plot: 'sunset_dunes', x: 35.0, z: -5.5, rx: 5.0, rz: 3.0, rot: 0.3, top: 2.3, edge: 3.0, rough: 0.25 },
    // West: Gull Headland, a high grassy rock shoulder past the west cliffs.
    { id: 'gull_headland', plot: 'gull_headland', x: -35.0, z: 5.0, rx: 9.5, rz: 8.0, rot: -0.3, top: 1.7, edge: 2.6, rough: 0.3, rocky: true },
    { id: 'gull_headland_knoll', plot: 'gull_headland', x: -39.5, z: 0.5, rx: 4.0, rz: 3.4, rot: 0.2, top: 3.0, edge: 2.4, rough: 0.4, rocky: true },
    // South: Lantern Atoll, a palm ring far out past the Old Mooring, lit at night.
    { id: 'lantern_atoll', plot: 'lantern_atoll', x: 27.0, z: 22.0, rx: 8.5, rz: 6.5, rot: 0.4, top: 0.9, edge: 3.8, rough: 0.1 },
  ],

  // Plots: where the dressing model (D's plot_<id>, origin at the plot centre on the ground, +Z
  // seaward) goes. NB: a terrain shape's `rot` turns the opposite way to a model's rotation.y, so a
  // plot's dressing rot is about minus its shape's rot (checked per plot: nothing stands in the water), and the build spots each plot adds. Day one owns only the sandbar.
  plots: {
    sandbar: { model: 'sandbar', x: 1.5, z: -2.0, rot: 0, spots: [{ x: 4.1, z: -3.6, rot: -0.35 }, { x: -1.2, z: 0.2, rot: 0.3 }] },
    palm_spit: { model: 'plot_palm_spit', x: 11.5, z: -3.0, rot: -0.25, spots: [{ x: 9.5, z: -3.5, rot: -0.2 }, { x: 15.0, z: -2.0, rot: -0.5 }, { x: 12.3, z: -0.9, rot: 0.1 }] },
    wreck_beach: { model: 'plot_wreck_beach', x: -8.5, z: -6.0, rot: -0.15, spots: [{ x: -6.0, z: -6.5, rot: 0.2 }, { x: -11.5, z: -5.5, rot: 0.4 }, { x: -8.8, z: -3.6, rot: 0.1 }] },
    tidepool_shelf: { model: 'plot_tidepool_shelf', x: -15.0, z: 0.5, rot: 0.5, spots: [{ x: -14.0, z: -2.5, rot: 0.6 }, { x: -16.5, z: 1.8, rot: 0.9 }] },
    basalt_cliff: { model: 'plot_basalt_cliff', x: 6.0, z: -10.5, rot: 0, spots: [{ x: 3.5, z: -10.5, rot: 0 }, { x: 8.5, z: -10.8, rot: -0.1 }] },
    kelp_shallows: { model: 'plot_kelp_shallows', x: -6.5, z: 10.0, rot: 0.1, spots: [] },
    mooring_deep: { model: 'plot_mooring_deep', x: 12.0, z: 11.0, rot: 0.5, spots: [{ x: 12.0, z: 10.0, rot: -0.4 }] },
    // Outer ring: big plots dressed with props (no plot_* model), lots of build spots each.
    sunset_dunes: { x: 31.0, z: -1.0, rot: 0, spots: [
      { x: 24.5, z: -1.5, rot: -0.3 }, { x: 28.5, z: 2.8, rot: 0.2 }, { x: 33.5, z: 3.0, rot: 0 },
      { x: 38.0, z: 0.5, rot: -0.4 }, { x: 27.5, z: -5.0, rot: 0.1 }, { x: 31.0, z: -1.5, rot: 0 },
    ] },
    gull_headland: { x: -35.0, z: 5.0, rot: 0, spots: [
      { x: -29.5, z: 3.0, rot: 0.3 }, { x: -32.0, z: 7.5, rot: 0.1 }, { x: -36.5, z: 9.5, rot: -0.2 },
      { x: -41.0, z: 6.5, rot: 0.6 }, { x: -34.5, z: 4.5, rot: 0 },
    ] },
    lantern_atoll: { x: 27.0, z: 22.0, rot: 0, spots: [
      { x: 22.5, z: 20.0, rot: 0.4 }, { x: 27.0, z: 18.5, rot: 0 }, { x: 31.5, z: 22.5, rot: -0.3 },
      { x: 27.5, z: 25.5, rot: 3.1 }, { x: 23.0, z: 24.5, rot: 2.6 },
    ] },
  },

  // Day one: the tarp lean-to and a driftwood fire, always there.
  camp: { model: 'camp_l0', x: -0.4, z: -3.8, rot: 0.25 },

  // Default places for buildings that B completes without placement (no build:placing ack).
  defaultBuildingSpots: {
    shop: { x: 4.1, z: -3.6, rot: -0.35 },
    cooler: { x: -1.2, z: 0.2, rot: 0.3 },
    workers_hut: { x: -6.0, z: -6.5, rot: 0.2 },
    smokehouse: { x: 9.5, z: -3.5, rot: -0.2 },
    aquarium: { x: 3.5, z: -10.5, rot: 0 },
    boat_dock: { x: -2.6, z: 3.4, rot: 0.2, water: true },
    reel_mill: { x: 12.3, z: -0.9, rot: 0.1 },
    net_rig: { x: -16.5, z: 1.8, rot: 0.9 },
    cannery: { x: -8.8, z: -3.6, rot: 0.1 },
  },

  spawn: { x: 1.4, z: -1.2, facing: Math.PI },

  // The pier grows south from the sandbar: a crooked stub on day one, one 3 m module per pier
  // bought (pier_1..pier_6). D's modules: deck top 0.75 m, origin at water level.
  pierLine: {
    from: [3.3, 0.6], dir: [0.12, 1], width: 2.0,
    stub: 'pier_patched',
    modules: ['pier_straight', 'pier_straight_b', 'pier_patched', 'pier_straight', 'pier_straight_b', 'pier_straight'],
    end: 'pier_end',
  },
  // Boat moored beside the pier stub; worker fishing spots (pier side first, then shores).
  boatSpot: { x: 5.4, z: 2.6, rot: 0.15 },
  workerSpots: [
    { x: -1.6, z: 1.5, face: [-3, 5] },
    { x: 5.8, z: -0.4, face: [9, 5] },
    { pier: 1, side: -1 }, { pier: 2, side: 1 }, { pier: 3, side: -1 }, { pier: 4, side: 1 },
    { x: 13.5, z: 0.4, face: [16, 6], plot: 'palm_spit' },
    { x: -10.5, z: -1.6, face: [-12, 6], plot: 'wreck_beach' },
    { x: 29.0, z: 6.0, face: [29, 12], plot: 'sunset_dunes' },
    { x: 41.5, z: 3.0, face: [46, 6], plot: 'sunset_dunes' },
    { x: -34.0, z: 12.5, face: [-34, 18], plot: 'gull_headland' },
    { x: -43.5, z: 6.5, face: [-49, 8], plot: 'gull_headland' },
    { x: 34.0, z: 25.5, face: [39, 28], plot: 'lantern_atoll' },
    { x: 21.6, z: 26.4, face: [17, 31], plot: 'lantern_atoll' },
  ],

  // Interaction zones that are not buildings (buildings get zones from their placement).
  zones: [],

  // Backdrop props (always there). Plot dressings come from D's plot_* models.
  props: [
    { asset: ['cliff_columns_a'], x: -6.6, z: -14.0, rot: 0.05 },
    { asset: ['cliff_columns_b'], x: 6.4, z: -14.4, rot: -0.1 },
    { asset: ['cliff_columns_a'], x: 14.5, z: -12.0, rot: -0.45, scale: 0.9 },
    { asset: ['cliff_columns_b'], x: -16.5, z: -8.0, rot: 0.6 },
    { asset: ['rock_l'], x: -9.6, z: 12.4, rot: 1.9, scale: 1.25 },
    { asset: ['rock_shore'], x: -2.4, z: 1.6, rot: 2.6, plot: 'sandbar' },
    { asset: ['rock_shore'], x: 6.2, z: -4.6, rot: 0.9, scale: 0.8, plot: 'sandbar' },
    { asset: ['rock_m'], x: 8.5, z: 3.5, rot: 2.2 },
    { asset: ['rock_m'], x: -5.5, z: -2.0, rot: 1.2 },
    { asset: ['starfish_a'], x: 0.6, z: 0.9, rot: 2.6, plot: 'sandbar' },
    // Sunset Dunes: palms on the crest, grass in the hollows, driftwood washed up on the waterline.
    { asset: ['palm_twin'], x: 35.5, z: -6.0, rot: 0.4, plot: 'sunset_dunes' },
    { asset: ['palm_tall'], x: 33.0, z: -7.5, rot: 2.1, scale: 0.9, plot: 'sunset_dunes' },
    { asset: ['palm_bent'], x: 41.0, z: -3.5, rot: -0.9, plot: 'sunset_dunes' },
    { asset: ['palm_young'], x: 22.5, z: 2.5, rot: 1.3, plot: 'sunset_dunes' },
    { asset: ['palm_bent'], x: 36.0, z: 5.5, rot: 2.8, scale: 0.85, plot: 'sunset_dunes' },
    { asset: ['bush_seagrape'], x: 38.5, z: -6.5, rot: 0.7, plot: 'sunset_dunes' },
    { asset: ['bush_seagrape_s'], x: 30.0, z: -6.8, rot: 2.2, plot: 'sunset_dunes' },
    { asset: ['beach_grass_a'], x: 26.0, z: -6.5, rot: 0.3, plot: 'sunset_dunes' },
    { asset: ['beach_grass_b'], x: 31.5, z: -8.0, rot: 1.7, plot: 'sunset_dunes' },
    { asset: ['beach_grass_a'], x: 40.0, z: -5.5, rot: 2.5, plot: 'sunset_dunes' },
    { asset: ['beach_grass_b'], x: 24.0, z: 4.0, rot: 0.9, plot: 'sunset_dunes' },
    { asset: ['beach_grass_a'], x: 39.5, z: 3.5, rot: 1.1, plot: 'sunset_dunes' },
    { asset: ['driftwood_log'], x: 31.0, z: 6.0, rot: 0.2, plot: 'sunset_dunes' },
    { asset: ['driftwood_branch'], x: 25.5, z: 5.2, rot: 2.4, plot: 'sunset_dunes' },
    { asset: ['shells_a'], x: 33.5, z: 6.2, rot: 0.5, plot: 'sunset_dunes' },
    { asset: ['coconut_pile'], x: 34.5, z: -4.0, rot: 0, plot: 'sunset_dunes' },
    { asset: ['rock_cluster'], x: 42.5, z: 0.0, rot: 1.4, plot: 'sunset_dunes' },
    { asset: ['signpost'], x: 22.8, z: -3.8, rot: -0.6, plot: 'sunset_dunes' },
    { asset: ['lantern_post'], x: 26.5, z: 0.8, rot: 0, plot: 'sunset_dunes' },
    // Gull Headland: wind-bent scrub on grey rock, a cairn path up the knoll, nets drying.
    { asset: ['rock_l'], x: -40.5, z: -1.0, rot: 0.6, plot: 'gull_headland' },
    { asset: ['rock_cluster'], x: -43.0, z: 2.5, rot: 2.2, plot: 'gull_headland' },
    { asset: ['columns_steps'], x: -37.0, z: 2.0, rot: -0.4, plot: 'gull_headland' },
    { asset: ['cairn_lantern'], x: -38.5, z: -0.5, rot: 0, plot: 'gull_headland' },
    { asset: ['cairn_lantern'], x: -33.0, z: 1.0, rot: 0, plot: 'gull_headland' },
    { asset: ['cairn_lantern'], x: -28.5, z: 6.5, rot: 0, plot: 'gull_headland' },
    { asset: ['bush_spiky'], x: -42.0, z: -2.0, rot: 1.0, plot: 'gull_headland' },
    { asset: ['bush_spiky'], x: -30.0, z: -0.5, rot: 2.6, plot: 'gull_headland' },
    { asset: ['bush_seagrape'], x: -38.0, z: 11.5, rot: 0.4, plot: 'gull_headland' },
    { asset: ['bush_seagrape_s'], x: -27.5, z: 9.5, rot: 1.9, plot: 'gull_headland' },
    { asset: ['palm_young'], x: -40.0, z: 10.5, rot: 2.9, plot: 'gull_headland' },
    { asset: ['net_rack'], x: -32.5, z: 12.0, rot: 0.1, plot: 'gull_headland' },
    { asset: ['rock_shore'], x: -44.0, z: 9.5, rot: 0.8, plot: 'gull_headland' },
    // Lantern Atoll: a ring of palms and lanterns around a sandy middle, a mooring post offshore.
    { asset: ['palm_tall'], x: 20.5, z: 22.5, rot: 0.5, plot: 'lantern_atoll' },
    { asset: ['palm_bent'], x: 33.5, z: 19.0, rot: -1.2, plot: 'lantern_atoll' },
    { asset: ['palm_twin'], x: 25.0, z: 15.8, rot: 1.6, scale: 0.85, plot: 'lantern_atoll' },
    { asset: ['palm_young'], x: 31.5, z: 26.5, rot: 2.4, plot: 'lantern_atoll' },
    { asset: ['lantern_post'], x: 24.5, z: 18.0, rot: 0, plot: 'lantern_atoll' },
    { asset: ['lantern_post'], x: 30.0, z: 19.5, rot: 0, plot: 'lantern_atoll' },
    { asset: ['lantern_post'], x: 29.5, z: 25.0, rot: 0, plot: 'lantern_atoll' },
    { asset: ['lantern_post'], x: 24.5, z: 26.5, rot: 0, plot: 'lantern_atoll' },
    { asset: ['tide_pool_a'], x: 27.0, z: 22.0, rot: 0.3, plot: 'lantern_atoll' },
    { asset: ['anchor'], x: 33.5, z: 23.5, rot: 1.1, plot: 'lantern_atoll' },
    { asset: ['rope_coil'], x: 21.5, z: 25.5, rot: 0.4, plot: 'lantern_atoll' },
    { asset: ['beach_grass_b'], x: 22.0, z: 18.0, rot: 2.0, plot: 'lantern_atoll' },
    { asset: ['shells_a'], x: 28.5, z: 27.5, rot: 0.2, plot: 'lantern_atoll' },
    { asset: ['mooring_dolphin'], x: 36.5, z: 21.0, rot: 0.3, plot: 'lantern_atoll' },
  ],

  // Scattered beds (seeded so the cove looks the same every time).
  scatter: [
    { asset: ['kelp_a'], x: -6, z: 15, r: 4.2, count: 11, scale: [1.2, 1.9], seed: 3, minDepth: 1.8 },
    { asset: ['kelp_a'], x: 13, z: 14.5, r: 2.8, count: 6, scale: [1.1, 1.7], seed: 8, minDepth: 1.8 },
    { asset: ['kelp_a'], x: -13, z: 9, r: 2.2, count: 4, scale: [0.9, 1.3], seed: 5, minDepth: 1.2 },
  ],

  // Where each fish habitat lives (fish-behaviour.json `habitat`). Areas are circles.
  habitats: {
    surface: { minDepth: 1.2, areas: [{ x: 4, z: 18, r: 12 }, { x: -4, z: 10, r: 7 }, { x: 31, z: 11, r: 6 }, { x: 38, z: 22, r: 5 }] },
    driftwood: { minDepth: 0.8, areas: [{ x: -5, z: 4.5, r: 4 }, { x: 10, z: 4, r: 4 }] },
    bottom: { minDepth: 1.5, areas: [{ x: 0, z: 7, r: 7 }, { x: 11, z: 9, r: 5 }] },
    rocks: { minDepth: 0.9, areas: [{ x: -12, z: 6, r: 4.5 }, { x: -9.5, z: 12.5, r: 3.5 }, { x: -36, z: 15, r: 5 }, { x: 45, z: -4, r: 4 }] },
    kelp: { minDepth: 2.0, areas: [{ x: -6, z: 15, r: 5 }] },
    mid: { minDepth: 3.0, areas: [{ x: 6, z: 17, r: 8 }, { x: -2, z: 20, r: 8 }] },
    deep: { minDepth: 6.0, areas: [{ x: 6, z: 26, r: 8 }, { x: 30, z: 34, r: 8 }] },
  },

  // Kelp drawn as swaying silhouettes only when the kelp model is missing.
  kelpBeds: [{ x: -6, z: 15, r: 4.5, count: 14 }, { x: 13, z: 15, r: 3, count: 7 }],

  // Lighting matched to art/concepts/world/driftwood_cove_key.webp
  palette: {
    sun: '#ffcf8a',
    sunIntensity: 3.0,
    sky: '#9fd2d6',
    ground: '#5a3d22',
    hemiIntensity: 1.85,
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
    rock: { base: '#4c463e', light: '#857865', moss: '#8a9632' },
  },
};
