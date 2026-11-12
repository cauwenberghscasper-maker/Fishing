// Village raids (Casper 12 Nov: "after a while you'll have to fight the fish on land with weapons
// you can buy... monsters can also attack the village; rare, and only on high island levels").
// First playable version, with the sea monsters that exist:
//   - Only once the island is big (raids.minPlots plots), at most one per raids.every minutes of
//     play, never in a session's first minutes, more often in Winter Storms.
//   - A bell and a banner; a monster rears out of the shallows by one of your buildings and
//     batters it. A health bar and a harpoon button appear.
//   - You fight it with harpoons (tap the button; your Armoury tier sets the damage, your crew
//     throws too). Each hit staggers it. Drive its health to zero before the timer runs out.
//   - Win: a bounty in coins and pearls. Lose: it smashes stores and takes a share of your coins.
// Cannons you place, hand weapons with their own models and building damage are the next step
// (docs/PLAN_2026-11-12.md); they need models first.
// Tuning: public/data/sea.json "raids".
import * as THREE from 'three';
import { loadModel } from '../core/assets.js';

const DEF = { minPlots: 12, every: [35, 55], firstAfter: 10, time: 75, stormMult: 2, monsters: ['mossneck', 'anchorjaw_leviathan', 'drowned_lighthouse'],
  health: 60, healthPerPlot: 8, damage: 6, cooldown: 0.7, crewDps: 0.6, bountyMinutes: 25, bountyMin: 2500, pearls: 6, lossShare: 0.06, lossMax: 20000, size: 7 };

export function createRaids({ state, events, island, player, cameraRig, splashes, water, surface, hud, hudRoot }) {
  const cfg = { ...DEF, ...(state.data?.sea?.raids || {}) };
  const rand = (a, b) => a + Math.random() * (b - a);
  let timer = cfg.firstAfter * 60 + rand(0, 300);
  let raid = null;   // { phase, t, hp, max, obj, at:{x,z}, target, cool, spears:[] }
  const spearGeo = new THREE.CylinderGeometry(0.03, 0.05, 1.6, 6).rotateX(Math.PI / 2);
  const spearMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 });
  const ballGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, metalness: 0.6, roughness: 0.5 });

  // --- HUD (own small layer)
  const el = document.createElement('div');
  el.className = 'raid-hud';
  el.hidden = true;
  el.innerHTML = '<div class="raid-hud__name"></div><div class="raid-hud__bar"><i></i></div><div class="raid-hud__time"></div><button type="button" class="raid-hud__fire">Harpoon!</button>';
  (hudRoot || document.body).append(el);
  const $ = (c) => el.querySelector(c);
  $('.raid-hud__fire').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fire(); });

  const eligible = () => (state.profile?.island?.plots?.length ?? 0) >= cfg.minPlots && state.net?.role !== 'visitor';
  const armoury = () => 1 + (state.profile?.armoury ?? 0) * (state.data?.economy?.crewTraining?.armoury?.bonusPerTier ?? 0.5);

  function pickTarget() {
    const list = Object.values(island.buildings).filter((b) => b.obj && Number.isFinite(b.x));
    if (!list.length) return null;
    const b = list[Math.floor(Math.random() * list.length)];
    // The nearest water to it, walking outward on a ring.
    for (let r = 3; r < 40; r += 1.5) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
        if (island.waterDepthAt(x, z) > 0.9) return { b, x, z };
      }
    }
    return null;
  }

  async function start(force = null) {
    if (raid) return false;
    const t = pickTarget();
    if (!t) return false;
    const plots = state.profile?.island?.plots?.length ?? 0;
    const id = force || cfg.monsters[Math.min(cfg.monsters.length - 1, Math.floor(Math.random() * Math.min(cfg.monsters.length, 1 + (plots - cfg.minPlots) / 2)))];
    const info = state.data?.fish?.[id];
    const max = Math.round((cfg.health + plots * cfg.healthPerPlot) * (1 + cfg.monsters.indexOf(id) * 0.6));
    raid = { phase: 'warn', t: 0, hp: max, max, id, name: info?.name || 'A sea monster', at: { x: t.x, z: t.z }, target: t.b, cool: 0, spears: [], obj: null, stagger: 0, left: cfg.time };
    hud.toast(`The bell! ${raid.name} is coming for your harbour`, 4);
    navigator.vibrate?.([80, 60, 80, 60, 160]);
    const m = await loadModel('fish', id);
    if (!raid) return false;
    if (m) {
      const obj = new THREE.Group();
      const body = m.scene;
      body.scale.multiplyScalar(cfg.size);
      obj.add(body);
      obj.position.set(t.x, -cfg.size * 0.5, t.z);
      obj.rotation.y = Math.atan2(t.b.x - t.x, t.b.z - t.z);
      surface.add(obj);
      raid.obj = obj; raid.body = body;
    }
    $('.raid-hud__name').textContent = raid.name;
    el.hidden = false;
    cameraRig.setFocus?.(t.x, 0, t.z);
    return true;
  }

  function fire() {
    if (!raid || raid.phase !== 'fight' || raid.cool > 0) return;
    raid.cool = cfg.cooldown;
    const from = new THREE.Vector3(player.position.x, player.position.y + 1.4, player.position.z);
    const mesh = new THREE.Mesh(spearGeo, spearMat);
    surface.add(mesh);
    raid.spears.push({ mesh, from, t: 0, dur: THREE.MathUtils.clamp(from.distanceTo(new THREE.Vector3(raid.at.x, 1, raid.at.z)) / 26, 0.25, 1.1) });
    player.pose?.('cast'); setTimeout(() => player.pose?.(null), 300);
  }

  function hit(dmg) {
    if (!raid) return;
    raid.hp = Math.max(0, raid.hp - dmg);
    raid.stagger = 0.35;
    splashes.splash(raid.at.x + rand(-1, 1), raid.at.z + rand(-1, 1), 0.8);
    cameraRig.shake?.(0.05);
    navigator.vibrate?.(15);
    if (raid.hp <= 0) end(true);
  }

  function end(won) {
    const r = raid;
    if (!r) return;
    const eco = state.economy;
    if (won) {
      const perMin = (eco?.incomeRates?.().total ?? 0) * 60;
      const coins = Math.round(Math.max(cfg.bountyMin, perMin * cfg.bountyMinutes) * (1 + cfg.monsters.indexOf(r.id) * 0.5));
      eco?.grantTreasure?.({ coins, pearls: cfg.pearls });
      hud.toast(`${r.name} driven off! Bounty: ${coins.toLocaleString()} coins and ${cfg.pearls} pearls`, 5);
      navigator.vibrate?.([40, 50, 90, 50, 140]);
      events.emit('raid:won', { id: r.id, coins });
    } else {
      const have = state.profile?.coins ?? 0;
      const lost = Math.min(cfg.lossMax, Math.round(have * cfg.lossShare));
      if (lost > 0 && eco?.spendForced) eco.spendForced(lost);
      hud.toast(lost > 0 ? `${r.name} smashed your stores: ${lost.toLocaleString()} coins lost` : `${r.name} smashed your stores and slid back into the sea`, 5);
      events.emit('raid:lost', { id: r.id, lost });
    }
    r.phase = 'leave'; r.t = 0;
    el.hidden = true;
    timer = rand(cfg.every[0], cfg.every[1]) * 60;
  }

  function update(dt, time) {
    if (!raid) {
      if (!eligible() || state.world.mode !== 'explore') return;
      timer -= dt * (state.world.season?.effects?.monster ? cfg.stormMult : 1);
      if (timer <= 0) { timer = 60; start(); }
      return;
    }
    const r = raid;
    r.t += dt;
    r.cool = Math.max(0, r.cool - dt);
    r.stagger = Math.max(0, r.stagger - dt);
    const o = r.obj;
    if (r.phase === 'warn') {
      if (Math.random() < dt * 8) water.addRipple(r.at.x + rand(-2, 2), r.at.z + rand(-2, 2), 0.7);
      if (r.t > 3 && o) { r.phase = 'rise'; r.t = 0; splashes.splash(r.at.x, r.at.z, 2); cameraRig.shake?.(0.2); }
      else if (r.t > 8) { raid = null; el.hidden = true; }   // its model never came: call it off
    } else if (r.phase === 'rise') {
      o.position.y = THREE.MathUtils.lerp(-cfg.size * 0.5, cfg.size * 0.12, Math.min(1, r.t / 1.2));
      if (r.t > 1.2) { r.phase = 'fight'; r.t = 0; }
    } else if (r.phase === 'fight') {
      r.left -= dt;
      // It rears and slams toward the building every few seconds.
      const beat = (r.t % 3.2) / 3.2;
      const lunge = r.stagger > 0 ? -0.25 : Math.max(0, Math.sin(beat * Math.PI * 2)) * (beat > 0.5 ? 0 : 1);
      o.rotation.x = -0.25 - lunge * 0.5 + (r.stagger > 0 ? 0.3 : 0);
      o.position.y = cfg.size * 0.12 + Math.sin(time * 2) * 0.15 + lunge * 0.6;
      const tx = r.target.x - r.at.x, tz = r.target.z - r.at.z, tl = Math.hypot(tx, tz) || 1;
      o.position.x = r.at.x + (tx / tl) * lunge * 2.2; o.position.z = r.at.z + (tz / tl) * lunge * 2.2;
      if (lunge > 0.95 && !r.slammed) { r.slammed = true; cameraRig.shake?.(0.25); splashes.splash(r.at.x, r.at.z, 1.5); navigator.vibrate?.(40); }
      if (lunge < 0.2) r.slammed = false;
      // Harbour cannons (the harbour_cannon building, levels 1-3): they turn to the monster and
      // fire on their own. cannonDamage / cannonEvery per level in sea.json "raids".
      const cb = island.buildings.harbour_cannon;
      if (cb?.obj && (cb.level ?? 0) > 0) {
        const lvl = Math.min(3, cb.level);
        const turret = cb.obj.getObjectByName('turret');
        if (turret) {
          cb.obj.updateMatrixWorld();
          const local = cb.obj.worldToLocal(new THREE.Vector3(o.position.x, 0, o.position.z));
          const want = Math.atan2(local.x - turret.position.x, local.z - turret.position.z);
          let d = want - turret.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
          turret.rotation.y += d * Math.min(1, dt * 4);
        }
        r.cannonT = (r.cannonT ?? 1) - dt;
        if (r.cannonT <= 0) {
          r.cannonT = (cfg.cannonEvery ?? [3.2, 2.4, 1.6])[lvl - 1];
          const muzzle = cb.obj.getObjectByName('muzzle');
          const from = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(cb.x, 1.6, cb.z);
          const mesh = new THREE.Mesh(ballGeo, ballMat);
          surface.add(mesh);
          r.spears.push({ mesh, from, t: 0, dur: THREE.MathUtils.clamp(from.distanceTo(o.position) / 40, 0.2, 0.9), dmg: (cfg.cannonDamage ?? [10, 18, 30])[lvl - 1], ball: true });
          splashes.splash(from.x, from.z, 0.2);
          cameraRig.shake?.(0.06);
        }
      }
      // The crew pitches in.
      const crew = (state.profile?.workers?.length ?? 0) * cfg.crewDps * dt;
      if (crew > 0) { r.hp = Math.max(0, r.hp - crew); if (r.hp <= 0) { end(true); return; } }
      if (r.left <= 0) { end(false); return; }
      $('.raid-hud__bar i').style.width = `${(r.hp / r.max) * 100}%`;
      $('.raid-hud__time').textContent = `${Math.ceil(r.left)} s`;
      $('.raid-hud__fire').classList.toggle('is-cool', r.cool > 0);
    } else if (r.phase === 'leave') {
      if (o) { o.position.y -= dt * 3; o.rotation.x += dt * 0.4; }
      if (r.t > 2.5) { o?.removeFromParent(); for (const s of r.spears) s.mesh.removeFromParent(); raid = null; cameraRig.setFocus?.(player.position.x, 0, player.position.z); }
    }
    // Harpoons in flight.
    for (let i = r.spears.length - 1; i >= 0; i--) {
      const s = r.spears[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const to = new THREE.Vector3(o?.position.x ?? r.at.x, (o?.position.y ?? 0) + 1.2, o?.position.z ?? r.at.z);
      s.mesh.position.lerpVectors(s.from, to, k);
      s.mesh.position.y += Math.sin(k * Math.PI) * (s.ball ? 1.0 : 2.2);
      s.mesh.lookAt(to.x, to.y - (k - 0.5) * 3, to.z);
      if (k >= 1) { s.mesh.removeFromParent(); r.spears.splice(i, 1); if (r.phase === 'fight') hit(s.dmg ?? cfg.damage * armoury()); }
    }
  }

  return { update, get active() { return Boolean(raid); }, force: (id) => start(id) };
}
