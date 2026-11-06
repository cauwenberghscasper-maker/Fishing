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
import { audio } from '../core/audio.js';

const ISLANDS = { driftwood_cove: driftwoodCove };
const DAY_LENGTH = 30 * 60; // real seconds per in-game day

export async function startWorld({ canvas, state, events }) {
  await loadManifests();
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

  const island = createIsland({ layout, events, state });
  under.add(island.group);
  await island.placeProps();

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

  // Time of day: golden afternoon by default; ?hour=21 to start elsewhere.
  const startHour = Number(new URLSearchParams(location.search).get('hour'));
  lighting.setHour(Number.isFinite(startHour) && startHour > 0 ? startHour : 16.5);
  let dayRunning = true;

  // Resize
  pipeline.onResize(({ width, height, pixelHeight }) => {
    cameraRig.setAspect(width / height);
    splashes.setViewportHeight(pixelHeight, camera.fov);
  });
  pipeline.resize();
  cameraRig.setFocus(player.position.x, 0, player.position.z);
  cameraRig.snap();

  // state.render contract (Agent E draws into this scene).
  const frameCallbacks = new Set();
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
    shake: (a) => cameraRig.shake(a),
    get player() { return player.root; },
    get lure() { return fishing.lure.pos; },
    get rodTip() { return fishing.rod.tipWorld(new THREE.Vector3()); },
  };

  // Frame
  loop.add({
    update(dt, realDt, time) {
      lastDt = dt;
      if (dayRunning) lighting.setHour(lighting.hour + (dt / DAY_LENGTH) * 24);
      player.update(dt, realDt);
      fishSystem.update(dt, time);
      fishing.update(dt, realDt);
      island.updateSway(time);
      island.terrain.uniforms.uTime.value = time;
      splashes.update(dt);
      splashes.setLight(lighting.light);
      for (const fn of frameCallbacks) {
        try { fn(dt, time); } catch (err) { console.error('[render.onFrame]', err); }
      }
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
    reel: (on = true, steer = 0) => fishing.debugReel(on, steer),
    finishFight: (status) => fishing.debugFinishFight(status),
    aimTo: (x, y) => fishing.debugAimFrame(x, y),
    releaseAim: () => fishing.debugReleaseAim(),
    timeScale: (s) => loop.setTimeScale(s, 50),
    get mode() { return state.world.mode; },
  };
  events.on('game:ready', () => {
    queueMicrotask(() => {
      if (window.__game) window.__game.world = debug;
    });
  });
  window.__fishingWorld = debug;
}
