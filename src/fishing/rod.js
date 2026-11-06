// Fishing rod that bends with line tension (vertex bend). Uses Agent D's rod from the character
// manifest when present (modelled along +Y from the grip); until then a temporary painted cane rod
// built here: cork grip, brass seat, bamboo nodes and red thread wraps.
import * as THREE from 'three';
import { loadModel, pickAsset } from '../core/assets.js';

const ROD_LENGTH = 2.3;

const BEND_GLSL = /* glsl */`
  uniform vec3 uBend;      // x: amount, y: rod length, z: unused
  vec3 rodBend(vec3 p) {
    float t = clamp(p.y / uBend.y, 0.0, 1.0);
    float b = uBend.x * t * t;
    // Bend towards local -Z (the side facing the line), shortening slightly so length is kept.
    return vec3(p.x, p.y - abs(b) * 0.28 * uBend.y * t, p.z - b * uBend.y * 0.42);
  }
`;

function caneGeometry() {
  const radial = 8;
  const rows = 30;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = t * ROD_LENGTH;
    let r = THREE.MathUtils.lerp(0.024, 0.0045, Math.pow(t, 0.8));
    if (t < 0.17) r = 0.03 + Math.sin((t / 0.17) * Math.PI) * 0.004; // cork grip
    else if (t < 0.21) r = 0.022; // reel seat
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(i / radial, t);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i, b = a + radial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function caneMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = uniforms.uBend;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND_GLSL}\nvarying float vRodT;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvRodT = clamp(position.y / uBend.y, 0.0, 1.0);\ntransformed = rodBend(transformed);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRodT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float t = vRodT;
          vec3 cork = vec3(0.62, 0.42, 0.22) * (0.85 + 0.3 * fract(sin(t * 913.0) * 4375.5));
          vec3 seat = vec3(0.16, 0.1, 0.06);
          vec3 brass = vec3(0.95, 0.68, 0.28);
          vec3 cane = vec3(0.78, 0.6, 0.33);
          float node = smoothstep(0.012, 0.0, abs(fract(t * 7.0) - 0.5) - 0.48);
          cane = mix(cane, cane * 0.55, node);
          float wrap = step(0.985, fract(t * 6.0 + 0.3)) * step(0.22, t);
          cane = mix(cane, vec3(0.45, 0.08, 0.06), wrap);
          vec3 c = t < 0.17 ? cork : (t < 0.21 ? mix(seat, brass, step(0.195, t)) : cane);
          c = mix(c, brass, step(0.985, t));
          diffuseColor.rgb = c;
        }`);
  };
  mat.customProgramCacheKey = () => 'rod-cane-v1';
  return mat;
}

function applyBendToModel(object, uniforms) {
  object.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone();
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uBend = uniforms.uBend;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${BEND_GLSL}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = rodBend(transformed);');
    };
    m.customProgramCacheKey = () => 'rod-model-bend-v1';
    o.material = m;
  });
}

export function createRod() {
  const uniforms = { uBend: { value: new THREE.Vector3(0, ROD_LENGTH, 0) } };
  const root = new THREE.Group();
  root.name = 'rod';
  const pivot = new THREE.Group(); // rotated to point the rod; bend happens in its local frame
  root.add(pivot);
  let length = ROD_LENGTH;
  let mesh = new THREE.Mesh(caneGeometry(), caneMaterial(uniforms));
  mesh.castShadow = true;
  mesh.position.y = -0.35; // hold the cork, not the butt
  pivot.add(mesh);
  let fromAsset = false;

  // Bake a model into "rod space": grip at the origin, tip along +Y, so the bend shader works
  // whatever axis the model was authored on. Returns the grip→tip length.
  function bakeRodSpace(scene) {
    scene.updateMatrixWorld(true);
    const grip = scene.getObjectByName('grip');
    const tipNode = scene.getObjectByName('tip');
    const box = new THREE.Box3().setFromObject(scene);
    const g = grip ? grip.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    let t;
    if (tipNode) t = tipNode.getWorldPosition(new THREE.Vector3());
    else {
      // No tip node: the far end of the longest axis.
      const size = box.getSize(new THREE.Vector3());
      const axis = size.x > size.y && size.x > size.z ? 'x' : size.z > size.y ? 'z' : 'y';
      t = g.clone();
      t[axis] = Math.abs(box.max[axis] - g[axis]) > Math.abs(box.min[axis] - g[axis]) ? box.max[axis] : box.min[axis];
    }
    const dir = t.clone().sub(g);
    const len = Math.max(0.3, dir.length());
    const q = new THREE.Quaternion().setFromUnitVectors(dir.normalize(), new THREE.Vector3(0, 1, 0));
    const toRod = new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(new THREE.Matrix4().makeTranslation(-g.x, -g.y, -g.z));
    const out = new THREE.Group();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRod, o.matrixWorld));
      const m = new THREE.Mesh(geo, o.material);
      m.castShadow = true;
      out.add(m);
    });
    return { group: out, length: len };
  }

  let loadedId = null;
  // Equipped rod from Agent G's gear manifest (`rod.<itemId>`), else Agent D's fishing_rod,
  // else the temporary cane above.
  async function load(itemId) {
    const candidates = [];
    if (itemId) candidates.push(['gear', `rod.${itemId}`]);
    candidates.push(['gear', 'rod.splitcane'], ['world', 'fishing_rod'], ['character', 'rod']);
    for (const [kind, id] of candidates) {
      if (!pickAsset(kind, [id])) continue;
      if (loadedId === `${kind}/${id}`) return true;
      const m = await loadModel(kind, id);
      if (!m) continue;
      const baked = bakeRodSpace(m.scene);
      length = baked.length;
      uniforms.uBend.value.y = length;
      applyBendToModel(baked.group, uniforms);
      pivot.remove(mesh);
      mesh = baked.group;
      mesh.position.y = 0;
      pivot.add(mesh);
      fromAsset = true;
      loadedId = `${kind}/${id}`;
      return true;
    }
    return false;
  }

  const tip = new THREE.Vector3();
  let bend = 0;
  let pitch = 0.6;
  let yaw = 0;

  return {
    root,
    load,
    get fromAsset() { return fromAsset; },
    get length() { return length; },
    // Place the rod at the hand, pointing along `yaw` (world, 0 = +z), raised by `pitch` (rad from horizontal).
    pose(handWorld, nextYaw, nextPitch, nextBend, dt) {
      const k = 1 - Math.exp(-14 * dt);
      yaw += Math.atan2(Math.sin(nextYaw - yaw), Math.cos(nextYaw - yaw)) * k;
      pitch += (nextPitch - pitch) * k;
      bend += (nextBend - bend) * (1 - Math.exp(-9 * dt));
      root.position.copy(handWorld);
      // Local +Y is the rod axis; tilt it from vertical towards the facing direction.
      pivot.rotation.set(0, 0, 0);
      root.rotation.set(0, yaw, 0);
      pivot.rotation.x = Math.PI / 2 - pitch; // forward (+z) tilt
      uniforms.uBend.value.x = -bend; // negative: tip dips forward/down towards the line
      root.updateMatrixWorld(true);
    },
    // World position of the rod tip, matching the vertex bend.
    tipWorld(out = tip) {
      const L = length;
      const b = -bend;
      const local = new THREE.Vector3(0, L - Math.abs(b) * 0.28 * L, -b * L * 0.42);
      local.y += mesh.position.y;
      return out.copy(local).applyMatrix4(pivot.matrixWorld);
    },
    setVisible(v) { root.visible = v; },
  };
}
