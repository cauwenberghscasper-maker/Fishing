// Asset loader: reads the three manifests (fish: Agent C, world + character: Agent D)
// and loads glTF models on demand. Entries without a model path (status "concept")
// or with a failed load simply do not exist for the game: nothing is shown in their place.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MANIFESTS = {
  fish: 'assets/fish/manifest.json',          // Agent C
  world: 'assets/world/manifest.json',        // Agent D
  character: 'assets/character/manifest.json',// Agent D
  gear: 'assets/gear/manifest.json',          // Agent G (keys like "rod.greenheart")
  boats: 'assets/boats/manifest.json',        // Agent G
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const manifests = Object.fromEntries(Object.keys(MANIFESTS).map((k) => [k, {}]));
const gltfCache = new Map(); // "kind/id" -> Promise<gltf|null>

export async function loadManifests() {
  await Promise.all(Object.entries(MANIFESTS).map(async ([kind, url]) => {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return;
      const json = await res.json();
      const usable = {};
      for (const [id, entry] of Object.entries(json || {})) {
        if (entry && typeof entry.path === 'string' && entry.path) usable[id] = entry;
      }
      manifests[kind] = usable;
    } catch (err) {
      console.warn(`[assets] manifest ${url} unreadable`, err);
    }
  }));
  return manifests;
}

export function hasAsset(kind, id) {
  return Boolean(manifests[kind]?.[id]);
}

export function assetEntry(kind, id) {
  return manifests[kind]?.[id] || null;
}

export function assetIds(kind) {
  return Object.keys(manifests[kind] || {});
}

// First id in `candidates` that the manifest has (layout files list fallbacks).
export function pickAsset(kind, candidates) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  return list.find((id) => hasAsset(kind, id)) || null;
}

function loadGltf(kind, id) {
  const key = `${kind}/${id}`;
  if (!gltfCache.has(key)) {
    const entry = assetEntry(kind, id);
    const promise = !entry ? Promise.resolve(null) : loader.loadAsync(entry.path).catch((err) => {
      console.warn(`[assets] ${key} failed to load (${entry.path})`, err);
      return null;
    });
    gltfCache.set(key, promise);
  }
  return gltfCache.get(key);
}

// World GLBs share one painted atlas through a few named materials (cove_atlas, cove_atlas_ds,
// cove_glow, cove_net). Keep one instance per name so the GPU holds one texture and draws batch.
const sharedMaterials = new Map();

function dedupeMaterial(mat) {
  if (!mat?.name) return mat;
  const key = `${mat.name}|${mat.vertexColors ? 'vc' : ''}|${mat.side}`;
  const known = sharedMaterials.get(key);
  if (known) return known;
  if (mat.name === 'cove_net' || mat.alphaTest > 0) mat.alphaTest = mat.alphaTest || 0.5;
  sharedMaterials.set(key, mat);
  return mat;
}

// Returns { scene, animations, entry } with a fresh clone, or null when the asset is missing.
export async function loadModel(kind, id) {
  const gltf = await loadGltf(kind, id);
  if (!gltf) return null;
  const entry = assetEntry(kind, id);
  const scene = cloneSkinned(gltf.scene);
  const scale = Number(entry.scale) || 1;
  if (scale !== 1) scene.scale.multiplyScalar(scale);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = entry.castShadow !== false;
    o.receiveShadow = entry.receiveShadow !== false;
    if (kind === 'world' || kind === 'boats') {
      o.material = Array.isArray(o.material) ? o.material.map(dedupeMaterial) : dedupeMaterial(o.material);
    }
  });
  return { scene, animations: gltf.animations || [], entry };
}

export function getManifests() {
  return manifests;
}
