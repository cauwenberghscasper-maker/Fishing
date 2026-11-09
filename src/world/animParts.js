// Moving parts of world models (Casper 9 Nov: "own models and animation, nothing cheap"). A model's
// nodes say how they move by name (the Blender builds name them; see docs/handoff/agent-blender-machines.md):
//   anim_spin_<axis>_<degPerSec>                  wheels, gears, drums, shafts (m = minus: anim_spin_x_m90)
//   anim_swing_<axis>_<ampDeg>_<periodTenths>     bells, levers, lanterns, gates
//   anim_bob_<ampCm>_<periodTenths>               floats, rafts
//   anim_smoke                                    chimney / stovepipe mouth: painted smoke puffs
// glTF loaders may append a suffix (anim_spin_x_90_1); the pattern only reads the leading fields.
import * as THREE from 'three';

const num = (s) => (s?.startsWith('m') ? -Number(s.slice(1)) : Number(s));
const DEG = Math.PI / 180;

export function parseAnimName(name) {
  const p = String(name || '').split('_');
  if (p[0] !== 'anim') return null;
  if (p[1] === 'spin' && 'xyz'.includes(p[2]) && Number.isFinite(num(p[3]))) return { kind: 'spin', axis: p[2], speed: num(p[3]) * DEG };
  if (p[1] === 'swing' && 'xyz'.includes(p[2]) && Number.isFinite(num(p[3])) && Number(p[4]) > 0) return { kind: 'swing', axis: p[2], amp: num(p[3]) * DEG, period: Number(p[4]) / 10 };
  if (p[1] === 'bob' && Number.isFinite(num(p[2])) && Number(p[3]) > 0) return { kind: 'bob', amp: num(p[2]) / 100, period: Number(p[3]) / 10 };
  if (p[1] === 'smoke') return { kind: 'smoke' };
  return null;
}

export function createAnimParts({ scene, smokeTexture = 'assets/vfx/sprites.webp', smokeFrame = 3, grid = 4 }) {
  const parts = [];      // { node, root, spec, base, phase }
  const smokers = [];    // { node, root, t }
  const puffs = [];
  const tmp = new THREE.Vector3();

  // Painted smoke from Agent E's sprite atlas (frame "smoke").
  const tex = new THREE.TextureLoader().load(smokeTexture);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / grid, 1 / grid);
  tex.offset.set((smokeFrame % grid) / grid, 1 - (Math.floor(smokeFrame / grid) + 1) / grid);
  const pool = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0xd9d2c4 });
    const s = new THREE.Sprite(m);
    s.visible = false;
    scene.add(s);
    pool.push(s);
  }

  /** Find a model's animated nodes (call once when the model is added to the world). */
  function register(root) {
    root.traverse((node) => {
      const spec = parseAnimName(node.name);
      if (!spec) return;
      if (spec.kind === 'smoke') { smokers.push({ node, root, t: Math.random() }); return; }
      parts.push({ node, root, spec, base: { rot: node.rotation.clone(), y: node.position.y }, phase: Math.random() * Math.PI * 2 });
    });
  }

  function attached(root) {
    let o = root;
    while (o.parent) o = o.parent;
    return o === scene || o.isScene;
  }

  function puff(x, y, z) {
    const s = pool.find((p) => !p.visible);
    if (!s) return;
    s.visible = true;
    s.position.set(x, y, z);
    s.userData = { t: 0, life: 3.2 + Math.random() * 1.2, vx: 0.25 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.2, size: 0.5 + Math.random() * 0.3, spin: (Math.random() - 0.5) * 0.6 };
    s.material.rotation = Math.random() * Math.PI * 2;
    puffs.push(s);
  }

  function update(dt, time) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!attached(p.root)) { parts.splice(i, 1); continue; }
      if (!p.root.visible) continue;
      const { spec, node, base } = p;
      if (spec.kind === 'spin') node.rotation[spec.axis] += spec.speed * dt;
      else if (spec.kind === 'swing') node.rotation[spec.axis] = base.rot[spec.axis] + Math.sin(time * (Math.PI * 2 / spec.period) + p.phase) * spec.amp;
      else if (spec.kind === 'bob') node.position.y = base.y + Math.sin(time * (Math.PI * 2 / spec.period) + p.phase) * spec.amp;
    }
    for (let i = smokers.length - 1; i >= 0; i--) {
      const s = smokers[i];
      if (!attached(s.root)) { smokers.splice(i, 1); continue; }
      if (!s.root.visible) continue;
      s.t -= dt;
      if (s.t <= 0) {
        s.t = 0.45 + Math.random() * 0.35;
        s.node.getWorldPosition(tmp);
        puff(tmp.x, tmp.y, tmp.z);
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const s = puffs[i];
      const u = s.userData;
      u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) { s.visible = false; s.material.opacity = 0; puffs.splice(i, 1); continue; }
      s.position.x += u.vx * dt;     // drifts downwind (east)
      s.position.z += u.vz * dt;
      s.position.y += (0.55 - 0.25 * k) * dt;
      const size = u.size * (1 + k * 2.2);
      s.scale.set(size, size, 1);
      s.material.rotation += u.spin * dt;
      s.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.55;
    }
  }

  return { register, update };
}
