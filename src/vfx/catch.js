// Agent E: the catch moment in the world (master prompt 9b.3), for every catch.
// 1. the fish leaves the water: big splash crown, spray fan, splash flipbook, foam ring, droplets, slow-mo
// 2. while it is in the air / held up: water drips off it, light pillar, ground ring, sparkle burst
// 3. variants on top: morph = sweeping shine + glints; elemental = its impact burst, its aura x3,
//    its signature mini-effect (bolts, shards, embers, petals, glyph circle, eyes, foam helix, sparks), flash.
import * as THREE from 'three';
import { frameIndex } from './assets.js';
import { decal, ribbon, boltPath, rnd } from './fx.js';

const WHITE = new THREE.Color(1, 1, 1);

export function createCatchFx(ctx) {
  const { surface, camera, surfaceFx, impactFx, lights, R, looks, data, screenFx } = ctx;
  const live = [];  // { t, dur, update(t, dt), done() }
  const tmp = new THREE.Vector3();

  function add(e) { live.push(e); return e; }

  // A splash where something breaks the surface. strength ~1 normal, 2 huge.
  function splash(x, z, strength = 1, color = WHITE) {
    const s = strength;
    R.splash?.(x, z, 1.2 * s);
    R.addRipple?.(x, z, 1.5 * s, 0);
    R.addRipple?.(x, z, 1.1 * s, 0.25);
    impactFx.emit({ x, y: 0.55 * s, z, life: 0.7, frame: frameIndex('splash_crown', 'impacts'), size: 1.3 * s, aspect: 1.15, grow: 0.5, add: 0.15, color, alpha: 1, rot: 0, fadeIn: 0.02 });
    for (let i = 0; i < 4; i++) impactFx.emit({ x, y: 0.6 * s, z, life: 0.9, frame: frameIndex(`splash_seq_${i}`, 'impacts'), size: 1.0 * s, grow: 0.3, add: 0.2, color, alpha: 0, fadeIn: 0.01, rot: 0 }).seq = i;
    for (let i = 0; i < surfaceFx.n(3); i++) impactFx.emit({ x: x + rnd(-0.3, 0.3), y: 0.4 * s, z: z + rnd(-0.3, 0.3), vy: 0.6, life: 0.8, frame: frameIndex('spray_fan', 'impacts'), size: 0.9 * s, grow: 0.6, add: 0.2, color, alpha: 0.9, rot: rnd(-0.6, 0.6) });
    const ring = decal('impacts', { size: 0.5, color: '#ffffff', alpha: 1, add: 0.1, soft: 0, order: 9 });
    ring.visible = false; // the foam ring uses the atlas cell below instead (decal of a full atlas would show all cells)
    impactFx.emit({ x, y: 0.05, z, life: 1.2, frame: frameIndex('foam_ring', 'impacts'), size: 1.4 * s, grow: 1.8, add: 0.1, color, alpha: 0.9, rot: 0 });
    for (let i = 0; i < surfaceFx.n(26 * s); i++) {
      const a = rnd(0, 6.28), v = rnd(0.8, 2.6) * s;
      surfaceFx.emit({ x, y: 0.1, z, vx: Math.cos(a) * v * 0.6, vy: rnd(2.5, 5.5) * s, vz: Math.sin(a) * v * 0.6, gravity: 9.5, life: rnd(0.6, 1.1), frame: i % 3 ? 16 : frameIndex('foam'), size: rnd(0.06, 0.16) * s, stretch: 0.05, add: 0.3, color, alpha: 1.1 });
    }
  }

  // The flipbook frames of splash_seq play in order: show only the active one.
  function stepSeq() {
    // impactFx particles tagged with .seq get alpha by time window; handled in update below
  }

  function pillar(x, y, z, color, height = 10, width = 1.8, dur = 2.2) {
    const r = ribbon('tx_beam', { width, color, add: 1, segments: 2, order: 905, edge: 0.15 });
    surface.add(r);
    const pts = [new THREE.Vector3(x, y - 0.3, z), new THREE.Vector3(x, y + height, z)];
    return add({ t: 0, dur, update(t) {
      const k = t / dur;
      const a = Math.min(1, t / 0.15) * (1 - k * k);
      r.userData.set(pts, camera, (s) => width * (0.55 + 0.45 * Math.sin(Math.min(1, t * 3) * Math.PI / 2)) * (1 - s * 0.35));
      r.userData.u.uAlpha.value = a * 1.6;
      lights.want(50, x, y + 1.2, z, color, 14 * a, 6);
    }, done() { r.removeFromParent(); } });
  }

  function groundRing(x, y, z, color, size = 3, dur = 1.4) {
    const d = decal('dc_ring', { size: 0.5, color, alpha: 1.2, add: 1, soft: 0, order: 10 });
    d.position.set(x, y + 0.04, z);
    surface.add(d);
    return add({ t: 0, dur, update(t) { const k = t / dur; d.scale.setScalar(0.5 + size * (1 - Math.pow(1 - k, 3))); d.userData.u.uAlpha.value = 1.4 * (1 - k); }, done() { d.removeFromParent(); } });
  }

  function sparkleBurst(p, color, n = 24, size = 0.35) {
    for (let i = 0; i < surfaceFx.n(n); i++) {
      const a = rnd(0, 6.28), e = rnd(-0.4, 1), v = rnd(1.2, 3.5);
      surfaceFx.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: e * v + 1, vz: Math.sin(a) * v, drag: 2.2, gravity: 0.6, life: rnd(0.7, 1.4), frame: frameIndex('flare'), size: rnd(0.4, 1) * size, add: 1, color, alpha: 1.6, spin: rnd(-3, 3), flicker: 0.3 });
    }
    surfaceFx.emit({ x: p.x, y: p.y, z: p.z, life: 0.5, frame: frameIndex('flare'), size: 2.6 * size * 4, grow: 0.6, add: 1, color, alpha: 1.6, fadeIn: 0.01, rot: 0 });
  }

  // Element signature at the reveal: a compact, loud version of its power.
  function elementBurst(variant, look, p, scale = 1) {
    const col = new THREE.Color(look.color);
    const acc = new THREE.Color(look.accent || look.color);
    impactFx.emit({ x: p.x, y: p.y, z: p.z, life: 0.9, frame: frameIndex(`impact_${variant}`, 'impacts'), size: 3.2 * scale, grow: 0.7, add: 0.6, color: WHITE, alpha: 1.3, fadeIn: 0.02 });
    const f = (n) => frameIndex(n);
    const N = (n) => surfaceFx.n(n * scale);
    const E = (o) => surfaceFx.emit(o);
    for (let i = 0; i < N(30); i++) {
      const a = rnd(0, 6.28), v = rnd(1.5, 4.5);
      const base = { x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: rnd(0.5, 4), vz: Math.sin(a) * v, drag: 1.4, life: rnd(0.8, 1.6), add: 1, color: col, alpha: 1.5 };
      if (variant === 'storm') E({ ...base, frame: f('spark'), size: rnd(0.2, 0.4), flicker: 0.6 });
      else if (variant === 'frost') E({ ...base, frame: i % 3 ? f('snow') : f('shard'), size: rnd(0.15, 0.4), gravity: 3, spin: rnd(-4, 4), add: i % 3 ? 1 : 0.3, color: WHITE });
      else if (variant === 'ember') E({ ...base, vy: rnd(2, 6), gravity: 2, frame: i % 4 ? f('ember') : f('lava'), size: rnd(0.12, 0.35), flicker: 0.3, add: i % 4 ? 1 : 0 , color: i % 4 ? col : WHITE });
      else if (variant === 'bloom') E({ ...base, frame: i % 2 ? f('petal') : f('leaf'), size: rnd(0.15, 0.3), gravity: 0.8, spin: rnd(-3, 3), add: 0, color: WHITE });
      else if (variant === 'rune') E({ ...base, frame: f(`glyph_${'abcd'[i % 4]}`), size: rnd(0.2, 0.4), drag: 2.5, spin: rnd(-2, 2) });
      else if (variant === 'abyss') E({ ...base, vx: base.vx * 0.4, vz: base.vz * 0.4, vy: rnd(0, 1), frame: f('eye'), size: rnd(0.25, 0.45), aspect: 0.55, open: 1, color: acc, rot: 0, life: rnd(1.2, 2) });
      else if (variant === 'tide') E({ ...base, frame: f('foam'), size: rnd(0.2, 0.45), gravity: 7, vy: rnd(3, 6), add: 0.2, color: WHITE });
      else if (variant === 'rust') E({ ...base, frame: f('metal_spark'), size: rnd(0.08, 0.15), stretch: 0.12, gravity: 8, vy: rnd(1, 5), color: col });
    }
    if (variant === 'storm') for (let k = 0; k < 4; k++) bolt(p, look, k * 0.12);
    if (variant === 'rune') { const d = decal('dc_rune_circle', { size: 3.6 * scale, color: look.color, alpha: 1.4, spin: 0.6, soft: 0.05, order: 9 }); d.position.set(p.x, Math.max(0.03, R.heightAt?.(p.x, p.z) ?? 0) + 0.06, p.z); surface.add(d); add({ t: 0, dur: 2.4, update(t) { d.userData.u.uTime.value = t; d.userData.u.uAlpha.value = 1.4 * Math.min(1, t * 4) * (1 - t / 2.4); }, done() { d.removeFromParent(); } }); }
  }

  function bolt(p, look, delay = 0) {
    const r = ribbon(look.power?.bolt || 'rb_lightning', { width: 0.7, color: look.power?.boltColor || '#fff6c8', add: 1, segments: 12, order: 912 });
    surface.add(r); r.visible = false;
    const path = [];
    const top = new THREE.Vector3(p.x + rnd(-2, 2), p.y + 9, p.z + rnd(-2, 2));
    return add({ t: -delay, dur: 0.35, update(t) {
      if (t < 0) return;
      r.visible = true;
      if (Math.random() < 0.5 || !path.length) { boltPath(top, new THREE.Vector3(p.x + rnd(-0.3, 0.3), p.y, p.z + rnd(-0.3, 0.3)), 1.2, 12, path); r.userData.set(path, camera, (s) => 0.25 + 0.6 * (1 - s)); }
      r.userData.u.uAlpha.value = (1 - t / 0.35) * 2;
      lights.want(80, p.x, p.y + 1, p.z, '#cfe8ff', 25 * (1 - t / 0.35), 9);
    }, done() { r.removeFromParent(); } });
  }

  // fish:landed-show
  function reveal({ object, variant, lastPos, tier }) {
    const look = looks(variant) || { kind: 'basic' };
    const cfg = data().catch || {};
    const scale = cfg.tierScale?.[tier] ?? 1;
    const exit = lastPos || object.getWorldPosition(new THREE.Vector3());
    splash(exit.x, exit.z, (cfg.splash ?? 1) * Math.max(1, scale) * (look.kind === 'element' ? 1.4 : 1));
    R.slowmo?.(look.kind === 'element' ? 0.2 : 0.35, look.kind === 'element' ? 0.9 : 0.55);
    R.shake?.(look.kind === 'element' ? 0.5 : 0.22, 0.4);
    ctx.cue(cfg.sound?.leap, variant, exit);
    // drips off the fish while it flies / is held
    add({ t: 0, dur: 1.4, update(t, dt) {
      object.getWorldPosition(tmp);
      if (Math.random() < dt * 30) surfaceFx.emit({ x: tmp.x + rnd(-0.2, 0.2), y: tmp.y, z: tmp.z + rnd(-0.2, 0.2), vy: rnd(-0.5, 0.3), gravity: 9, life: 0.6, frame: 16, size: rnd(0.04, 0.09), stretch: 0.04, add: 0.4, color: WHITE, alpha: 1 });
    } });
    // the hold-up moment
    add({ t: -0.45, dur: 0.01, update(t) {
      if (t < 0) return;
      object.getWorldPosition(tmp);
      const ground = Math.max(0, R.heightAt?.(tmp.x, tmp.z) ?? 0);
      const elemental = look.kind === 'element';
      const color = elemental ? look.color : look.kind === 'morph' ? (look.glint || '#fff2c8') : (cfg.pillarColor || '#ffe9b0');
      pillar(tmp.x, ground, tmp.z, color, elemental ? 14 : 9, (elemental ? 2.4 : 1.6) * Math.max(0.9, scale), elemental ? 2.8 : 2);
      groundRing(tmp.x, ground, tmp.z, color, elemental ? 5 : 3);
      sparkleBurst(tmp, new THREE.Color(color), elemental ? 36 : 22, 0.4 * Math.max(0.9, scale));
      ctx.cue(cfg.sound?.hold, variant, tmp);
      if (look.kind === 'morph') ctx.lookOf(object)?.shine();
      if (elemental) {
        screenFx.flash(look.color, 0.55, 0.35);
        R.shake?.(0.6, 0.5);
        R.slowmo?.(0.25, 0.8);
        elementBurst(variant, look, tmp.clone().setY(tmp.y + 0.2), 1);
        const L = ctx.lookOf(object);
        if (L) { L.setBoost(3); L.shine(); add({ t: 0, dur: 2.5, update(tt) { L.setBoost(3 - 2 * (tt / 2.5)); }, done() { L.setBoost(1); } }); }
        ctx.cue(look.sound?.reveal, variant, tmp);
      }
    } });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      if (e.t >= 0 || e.update.length) e.update(e.t, dt);
      if (e.t >= e.dur) { e.done?.(); live.splice(i, 1); }
    }
  }
  stepSeq();

  return { splash, pillar, groundRing, sparkleBurst, elementBurst, bolt, reveal, update, add };
}
