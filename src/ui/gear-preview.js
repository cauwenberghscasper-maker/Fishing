// Agent B. Turning 3D previews of Agent G's gear models in the shop's gear cards.
// One small, separate three.js renderer is shared by every card: each visible card's 2D canvas gets
// the model rendered into it in turn (copied with drawImage), so there is only ever one WebGL context
// besides the game's. Models load through Agent A's asset loader (src/core/assets.js, manifest
// assets/gear/manifest.json, keys like "rod.greenheart"). A missing model = no preview (the card shows
// Agent F's painting or nothing). Lines have no model.
import * as THREE from 'three';
import { loadManifests, hasAsset, loadModel } from '../core/assets.js';

let manifestsReady = null;
let renderer = null;
let scene = null;
let camera = null;
let raf = 0;
let lastT = 0;
const slots = new Set();
const observer = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((list) => { for (const e of list) { const s = [...slots].find((x) => x.canvas === e.target); if (s) s.visible = e.isIntersecting; } })
  : null;

/** Resolves once the gear manifest is known. */
export function gearManifestReady() {
  manifestsReady ??= loadManifests().catch(() => null);
  return manifestsReady;
}

/** True when Agent G has shipped a model for this key (call after gearManifestReady()). */
export const hasGearModel = (modelId) => !!modelId && hasAsset('gear', modelId);

function setup() {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('[gear-preview] no WebGL for previews', err);
    return false;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x0b3d43, 1.6));
  const key = new THREE.DirectionalLight(0xffe2a8, 2.4);   // warm golden key, like the world light
  key.position.set(2, 3, 2.5);
  const rim = new THREE.DirectionalLight(0x6ff5dc, 1.6);   // bioluminescent rim
  rim.position.set(-2.5, 1, -2);
  scene.add(key, rim);
  return true;
}

/** Scale and centre a model so it fills a unit box, long axis horizontal. */
function frame(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  object.position.sub(centre);
  pivot.add(object);
  const longest = Math.max(size.x, size.y, size.z) || 1;
  pivot.scale.setScalar(1.6 / longest);
  // rods are long and thin: lay them across the card at a slant
  if (size.y > size.x && size.y > size.z) pivot.rotation.z = Math.PI * 0.32;
  return pivot;
}

/**
 * Show `modelId` turning inside `canvas`. Returns a function that stops it.
 * The canvas keeps its CSS size; its pixel size follows devicePixelRatio (max 2).
 */
export function attachGearPreview(canvas, modelId, { onReady, onMissing } = {}) {
  const slot = { canvas, modelId, object: null, visible: true, angle: Math.random() * Math.PI * 2, alive: true };
  slots.add(slot);
  observer?.observe(canvas);
  gearManifestReady().then(async () => {
    if (!slot.alive) return;
    if (!hasGearModel(modelId) || !setup()) { onMissing?.(); return; }
    const model = await loadModel('gear', modelId);
    if (!slot.alive) return;
    if (!model) { onMissing?.(); return; }
    slot.object = frame(model.scene);
    onReady?.();
    start();
  });
  return () => {
    slot.alive = false;
    slots.delete(slot);
    observer?.unobserve(canvas);
    if (!slots.size) stop();
  };
}

/** Stop every preview (when the shop closes). */
export function detachAllGearPreviews() {
  for (const s of slots) { s.alive = false; observer?.unobserve(s.canvas); }
  slots.clear();
  stop();
}

function start() {
  if (raf) return;
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}
function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const s of slots) {
    if (!s.object || !s.visible || !s.canvas.isConnected) continue;
    const w = Math.max(1, Math.round(s.canvas.clientWidth * dpr));
    const hgt = Math.max(1, Math.round(s.canvas.clientHeight * dpr));
    if (s.canvas.width !== w || s.canvas.height !== hgt) { s.canvas.width = w; s.canvas.height = hgt; }
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== hgt) renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.position.set(0, 0.35, 3.4);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    s.angle += dt * 0.7;
    s.object.rotation.y = s.angle;
    scene.add(s.object);
    renderer.render(scene, camera);
    scene.remove(s.object);
    const ctx = s.canvas.getContext('2d');
    ctx.clearRect(0, 0, w, hgt);
    ctx.drawImage(renderer.domElement, 0, 0, w, hgt);
  }
}
