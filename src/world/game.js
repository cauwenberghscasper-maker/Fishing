// Agent A: world entry point. Renderer, camera, water, island, player, fish and fishing.
// Sets state.render (docs/INTERFACES.md) so Agent E can draw into the same scene.
import * as THREE from 'three';
import { loadManifests, getManifests } from '../core/assets.js';
import { createLoop } from '../core/loop.js';
import { createInput } from '../core/input.js';
import { createQuality } from '../core/quality.js';
import { createRenderPipeline } from './renderer.js';
import { createCameraRig } from './camera.js';
import { createLighting } from './lighting.js';
import { createWater } from './water.js';
import { createIsland } from './island.js';
import { createPlayer } from './player.js';
import { createSplashes } from './fx.js';
import { driftwoodCove } from './islands/driftwood_cove.js';
import { createFishShadows } from '../fishing/fishShadows.js';
import { createFishSystem } from '../fishing/fishAgents.js';
import { createFishing } from '../fishing/index.js';
import { createAnglerRig } from '../fishing/anglerRig.js';
import { createWorkers } from './workers.js';
import { createPlacement } from './placement.js';
import { audio } from '../core/audio.js';
import { createWadingDanger } from '../fishing/wading.js';
import { createGrounds } from '../fishing/grounds.js';
import { applySeason } from './seasons.js';
import { createRaids } from './raids.js';
import { createSea } from '../fishing/sea.js';

const ISLANDS = { driftwood_cove: driftwoodCove };
const DAY_LENGTH = 30 * 60; // real seconds per in-game day

export async function startWorld({ canvas, state, events }) {
  await loadManifests();
  if (!state.data.powers) {
    // Agent A's superpower tuning (B's loader does not read it).
    try { const r = await fetch('data/powers.json', { cache: 'no-cache' }); if (r.ok) state.data.powers = await r.json(); } catch { /* fallback table in powers.js */ }
  }
  if (!state.data.variantsLook) {
    // Element colours, so elemental fish can glow through the water (sea.js / fishAgents).
    try { const r = await fetch('data/variants-look.json', { cache: 'no-cache' }); if (r.ok) state.data.variantsLook = await r.json(); } catch { /* no glow */ }
  }
  if (!state.data.sea) {
    // Agent A's open-sea hot spot tuning (sea.js).
    try { const r = await fetch('data/sea.json', { cache: 'no-cache' }); if (r.ok) state.data.sea = await r.json(); } catch { /* defaults */ }
  }
  if (!state.data.mastery) {
    // Agent A's perfect-fight gauge tuning.
    try { const r = await fetch('data/mastery.json', { cache: 'no-cache' }); if (r.ok) state.data.mastery = await r.json(); } catch { /* defaults in mastery.js */ }
  }
  if (!state.data.predation) {
    // Agent A's predator tuning (double/triple catches).
    try { const r = await fetch('data/predation.json', { cache: 'no-cache' }); if (r.ok) state.data.predation = await r.json(); } catch { /* defaults in predation.js */ }
  }
  state.world.islandId = state.world.islandId || 'driftwood_cove';
  state.world.weather = state.world.weather || 'clear';
  const layout = ISLANDS[state.world.islandId] || driftwoodCove;

  const scene = new THREE.Scene();
  const under = new THREE.Group();   // world below/around the water (refracted by it)
  under.name = 'under';
  const surface = new THREE.Group(); // water surface and everything drawn over it
  surface.name = 'surface';
  scene.add(under, surface);

  const cameraRig = createCameraRig({ fov: 45 });
  const camera = cameraRig.camera;
  const pipeline = createRenderPipeline({ canvas, scene, camera, under, surface });
  const lighting = createLighting({ scene, palette: layout.palette });
  const water = createWater({ palette: layout.palette, sceneTarget: pipeline.sceneTarget, camera });
  surface.add(water.mesh);
  const splashes = createSplashes();
  surface.add(splashes.points);
  // Warm sand dust for construction and land rising (low gravity, slow puffs).
  const dust = createSplashes({ color: '#e8c58a', gravity: 2.5, name: 'build-dust' });
  surface.add(dust.points);

  const island = createIsland({ layout, events, state, splashes, dust, audio, water });
  under.add(island.group);
  await island.build();

  const loop = createLoop();
  const input = createInput({ canvas, events });
  const player = createPlayer({ island, input, cameraRig, water, events, state });
  under.add(player.root, player.shadowRoot);
  await player.load();

  const shadows = createFishShadows();
  surface.add(shadows.mesh);
  const fishSystem = createFishSystem({ state, island, water, splashes, events, under, shadows, lighting, audio });

  const hudRoot = document.getElementById('hud-fishing') || (() => {
    const el = document.createElement('div');
    el.id = 'hud-fishing';
    document.getElementById('ui')?.prepend(el);
    return el;
  })();
  const fishing = createFishing({ state, events, loop, input, cameraRig, player, island, water, splashes, fishSystem, under, surface, hudRoot });
  await fishing.loadGear(state.profile?.gear?.rod);
  events.on('gear:changed', () => { fishing.loadGear(state.profile?.gear?.rod); });

  const quality = createQuality({ pipeline });
  const wading = createWadingDanger({
    state, events, island, player, fishSystem, economy: { loseCatch: () => state.economy?.loseCatch?.() ?? null },
    hooks: {
      toast: (text, sec) => fishing.hud.toast(text, sec),
      warn: () => { audio.lurk(); navigator.vibrate?.([20, 60, 20, 60, 20]); cameraRig.shakeFor(0.12, 0.6); },
      chomp: () => { audio.chomp(); navigator.vibrate?.([80, 30, 120]); },
      splash: (x, z, st) => { splashes.splash(x, z, st); water.addRipple(x, z, st); },
      ripple: (x, z, st) => water.addRipple(x, z, st),
      shake: (a) => cameraRig.shakeFor(a, 0.4),
    },
  });
  // The open sea's hot spots (frenzies, glimmers, giants) all round the island.
  const sea = createSea({
    state, events, fishSystem, island, water, splashes, lighting,
    hooks: {
      announce: (s) => {
        const dx = s.x - player.position.x, dz = s.z - player.position.z;
        const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north');
        fishing.hud.toast(`${s.label} to the ${dir}!`, 2.2);
        if (s.kind !== 'frenzy') audio.tick();
      },
    },
  });
  fishing.setSea(sea);
  const season = applySeason(state, new URLSearchParams(location.search).get('season'));
  // Named fishing grounds round the island: their colours, landmarks and residents by time of day.
  const grounds = createGrounds({
    state, island, water, fishSystem, lighting,
    hooks: {
      enter: (g, slot, names, first) => {
        const when = slot === 'night' ? 'Tonight' : slot === 'dusk' ? 'At dusk' : 'By day';
        fishing.hud.toast(first && names.length ? `${g.name} · ${when}: ${names.join(', ')}` : g.name, first ? 3.2 : 1.8);
      },
    },
  });
  // Say which season it is once the player is in the world.
  if (season) setTimeout(() => fishing.hud.toast(`${season.name}: ${season.about}`, 5), 4000);
  // Monsters raid the harbour once the island is big (rare).
  const raids = createRaids({ state, events, island, player, cameraRig, splashes, water, surface, hud: fishing.hud, hudRoot });
  let groundsLure = null;
  events.on('cast:land', ({ x, z }) => { groundsLure = { x, z }; });
  const placement = createPlacement({ state, events, island, player, cameraRig, input, hud: fishing.hud, surface, under, fishing });
  events.on('build:start', (job) => {
    // Only from explore: never yank the player out of a cast or a fight.
    if (state.world.mode === 'explore' || state.world.mode === 'menu') placement.start(job);
    else events.emit('build:placing', { id: job?.id });
  });

  // Time of day: golden afternoon by default; ?hour=21 to start elsewhere.
  const startHour = Number(new URLSearchParams(location.search).get('hour'));
  lighting.setHour(Number.isFinite(startHour) && startHour > 0 ? startHour : 16.5);
  let dayRunning = true;

  // Resize
  pipeline.onResize(({ width, height, pixelHeight }) => {
    cameraRig.setAspect(width / height);
    splashes.setViewportHeight(pixelHeight, camera.fov);
    dust.setViewportHeight(pixelHeight, camera.fov);
  });
  pipeline.resize();
  cameraRig.setFocus(player.position.x, 0, player.position.z);
  cameraRig.snap();

  // state.render contract (Agent E draws into this scene).
  const frameCallbacks = new Set();
  let overviewAt = null;
  const clock = {
    get elapsedTime() { return loop.time; },
    getElapsedTime() { return loop.time; },
    get delta() { return lastDt; },
    getDelta() { return lastDt; },
    get timeScale() { return loop.timeScale; },
  };
  let lastDt = 0;
  state.render = {
    THREE,
    scene,
    camera,
    renderer: pipeline.renderer,
    clock,
    under,
    surface,
    onFrame(fn) { frameCallbacks.add(fn); return () => frameCallbacks.delete(fn); },
    // Helpers for effects that need the world
    heightAt: (x, z) => island.groundAt(x, z),
    waterDepthAt: (x, z) => island.waterDepthAt(x, z),
    addRipple: (x, z, s, delay) => water.addRipple(x, z, s, delay),
    splash: (x, z, s) => splashes.splash(x, z, s),
    // Additive camera shake (amp ~0.1 subtle .. 1 huge) decaying over `seconds`.
    shake: (amp, seconds = 0.4) => cameraRig.shakeFor(amp, seconds),
    // Scale sim/animation time (fish, fight, particles) for `seconds`, then ease back to 1.
    // UI, input and the camera stay real-time.
    slowmo: (scale, seconds = 0.5) => loop.slowmo(scale, seconds),
    get player() { return player.root; },
    get lure() { return fishing.lure.pos; },
    get rodTip() { return fishing.rod.tipWorld(new THREE.Vector3()); },
    camera,
    // Rod + line + bobber for remote anglers (Agent H) or NPCs.
    createAnglerRig: (opts = {}) => createAnglerRig({ under, surface, surfaceY: (x, z) => water.surfaceY(x, z), ...opts }),
  };

  const workers = createWorkers({ island, state, events, under, render: state.render });
  workers.sync();

  // Co-op hooks (Agent H). Solo play never calls these; defaults keep the host behaviour.
  state.world.fish = {
    setAuthority: (on) => fishSystem.setAuthority(on),
    snapshot: () => fishSystem.snapshot(),
    apply: (list) => fishSystem.applySnapshot(list),
    forceBite: (uid, playerId) => fishSystem.netBite(uid, playerId, state.world.selfId ?? null),
    // Host side: position of a fish another player is fighting (from their `self`).
    applyRemote: (entry) => fishSystem.setRemoteTarget(entry),
    release: (uid) => fishSystem.releaseRemote(uid),
  };
  const self = { x: 0, z: 0, heading: 0, anim: 'idle', mode: 'explore', lure: null, tension: 0, fishUid: null };
  state.world.self = self;
  events.on('net:help', ({ toId } = {}) => {
    if (toId != null && state.world.selfId != null && toId !== state.world.selfId) return;
    fishing.helpFromFriend?.();
  });

  // Frame
  loop.add({
    update(dt, realDt, time) {
      lastDt = dt;
      if (dayRunning) lighting.setHour(lighting.hour + (dt / DAY_LENGTH) * 24);
      pipeline.renderer.toneMappingExposure = lighting.exposure;
      player.update(dt, realDt);
      fishSystem.setViewer(cameraRig.target.x, cameraRig.target.z);
      fishSystem.update(dt, time);
      sea.update(dt);
      grounds.update(dt, cameraRig.target, groundsLure); groundsLure = null;
      raids.update(dt, performance.now() / 1000);
      fishing.update(dt, realDt);
      wading.update(dt, state.world.mode === 'explore' && fishing.mode === 'explore' && fishSystem.authority !== false);
      workers.update(dt);
      if (!placement.update(realDt) && overviewAt) { cameraRig.setMode('build'); cameraRig.setFocus(overviewAt.x, 0, overviewAt.z); }
      island.update(dt, time);
      dust.update(dt);
      island.terrain.uniforms.uTime.value = time;
      splashes.update(dt);
      splashes.setLight(lighting.light);
      for (const fn of frameCallbacks) {
        try { fn(dt, time); } catch (err) { console.error('[render.onFrame]', err); }
      }
      self.x = player.position.x;
      self.z = player.position.z;
      self.heading = player.facing;
      self.anim = player.animName;
      self.mode = state.world.mode;
      self.lure = fishing.line.active ? { x: fishing.lure.pos.x, z: fishing.lure.pos.z } : null;
      self.tension = fishing.fight ? fishing.fight.state.tension : 0;
      self.fishUid = fishing.fightFishUid ?? null;
      cameraRig.update(realDt);
      lighting.follow(cameraRig.target);
      water.update(time, {
        sunDir: lighting.sunDir,
        sunColor: lighting.sunColor,
        light: lighting.light,
        pixelWidth: pipeline.size.pixelWidth,
        pixelHeight: pipeline.size.pixelHeight,
      });
      shadows.uniforms.fogColor.value.copy(scene.fog.color);
      shadows.uniforms.fogDensity.value = scene.fog.density;
      pipeline.render(realDt);
      quality.update(realDt);
    },
  });
  loop.start();
  document.addEventListener('visibilitychange', () => { if (document.hidden) loop.stop(); else loop.start(); });

  // Debug hooks (window.__game.world after game:ready). ?test=100 speeds fish up.
  if (state.test) loop.setTimeScale(1);
  const debug = {
    THREE,
    scene,
    camera,
    player,
    island,
    fishSystem,
    fishing,
    quality,
    lighting,
    water,
    pipeline,
    manifests: getManifests,
    fish: () => fishSystem.list.map((f) => ({ uid: f.uid, id: f.id, variant: f.variant, state: f.state, x: +f.pos.x.toFixed(2), z: +f.pos.z.toFixed(2), depth: +f.depth.toFixed(2) })),
    spawnFish: (id, x, z, variant) => {
      const f = fishSystem.spawn(id, x, z, variant);
      return f ? f.uid : null;
    },
    teleport: (xOrZone, z) => {
      if (typeof xOrZone === 'string') {
        const zone = island.zone(xOrZone);
        if (!zone) return false;
        player.teleport(zone.x, zone.z);
      } else player.teleport(xOrZone, z);
      cameraRig.setFocus(player.position.x, 0, player.position.z);
      cameraRig.snap();
      return true;
    },
    setTime: (hour, running = false) => { lighting.setHour(hour); dayRunning = running; return lighting.hour; },
    setQuality: (name) => quality.pin(name),
    cast: (x, z, perfect = false) => fishing.debugCast(x, z, perfect),
    forceBite: (id, variant) => Boolean(fishSystem.forceBite(id, variant)),
    hook: () => fishing.debugHook(),
    predator: () => fishing.debugPredator(),
    wadeHunter: () => wading.force(),
    hotspot: (kind) => { const s = sea.force(kind); return s ? { kind: s.kind, x: s.x, z: s.z, fish: s.fish.length } : null; },
    chest: (tier) => fishing.debugChest(tier),
    raid: (id) => raids.force(id),
    depthAt: (x, z) => island.waterDepthAt(x, z),
    get hotspots() { return sea.spots.map((s) => ({ kind: s.kind, x: s.x, z: s.z, fish: s.fish.length })); },
    surge: () => fishing.debugSurge(),
    snag: () => fishing.debugSnag(),
    get minigameView() { return fishing.minigameView; },
    get surgeView() { return fishing.surgeView; },
    get tauntView() { return fishing.tauntView; },
    get fightVariant() { return fishing.fightVariant; },
    mastery: (v) => fishing.debugMastery(v),
    get onLine() { return fishing.onLine; },
    reel: (on = true, steer = 0) => fishing.debugReel(on, steer),
    finishFight: (status) => fishing.debugFinishFight(status),
    aimTo: (x, y) => fishing.debugAimFrame(x, y),
    releaseAim: () => fishing.debugReleaseAim(),
    timeScale: (s) => loop.setTimeScale(s, 50),
    get mode() { return state.world.mode; },
    placement,
    workers,
    // Wide view over the whole island (screenshots).
    overview(on = true, x = 0, z = -2) { overviewAt = on ? { x, z } : null; },
  };
  events.on('game:ready', () => {
    queueMicrotask(() => {
      if (window.__game) window.__game.world = debug;
    });
  });
  window.__fishingWorld = debug;
}
