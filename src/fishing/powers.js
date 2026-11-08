// Elemental superpowers in the fight (master prompt 4.4b). Tuning in public/data/powers.json.
// Each power: telegraph (warning only) → active → cooldown. Agent E draws every effect from the
// power:* events (payload `detail` carries positions); this module runs the rules and the counter.
const rand = (a, b) => a + Math.random() * (b - a);

const FALLBACK_POWERS = {
  storm: { power: 'lightning_line', telegraph: 1.5, duration: 0.7, cooldown: 10, firstAfter: 4, counter: 'slack', prompt: 'Slack the line!', effect: { slackBelow: 0.32, successStamina: 0.12, slowmo: 0.3 } },
  frost: { power: 'freeze_sea', telegraph: 1.2, duration: 5, cooldown: 11, firstAfter: 4, counter: 'tap', prompt: 'Tap the ice!', effect: { shards: 4, spread: 2.2, tapRadiusPx: 46, thawBoost: 1.8, boostTime: 2.5, failRegen: 0.2 } },
  ember: { power: 'lava_bombs', telegraph: 1.3, duration: 4, cooldown: 11, firstAfter: 4, counter: 'step', prompt: 'Step out of the fire!', effect: { bombs: 3, radius: 1.3, spread: 2.6, heatPerHit: 0.45, heatRate: 0.4, coolRate: 0.55, tensionHot: 0.65, snapAtHeat: 1 } },
  bloom: { power: 'vine_tangle', telegraph: 1, duration: 4.5, cooldown: 10, firstAfter: 4, counter: 'swipe', prompt: 'Swipe to cut the vines!', effect: { vines: 3, dragMult: 1.7, reelMult: 0.35, swipeRadiusPx: 60, endSpike: 0.3 } },
  rune: { power: 'glyph_teleport', telegraph: 1.1, duration: 3.4, cooldown: 9, firstAfter: 4, counter: 'reaim', prompt: 'Pull towards the glyph!', effect: { jumps: 2, angle: 0.9, window: 1.6, bonusStamina: 0.06, failSpike: 0.3 } },
  abyss: { power: 'lights_out', telegraph: 1, duration: 5, cooldown: 12, firstAfter: 4, counter: 'follow', prompt: 'Follow the glow!', effect: { flipEvery: 0.75, goodThreshold: 0.3, successStamina: 0.12, failRegen: 0.15 } },
  tide: { power: 'rogue_wave', telegraph: 1.6, duration: 2.6, cooldown: 11, firstAfter: 4, counter: 'hold', prompt: 'Hold steady! Don\'t reel', effect: { lift: 2.4, reelSpikeRate: 2.2, successStamina: 0.15 } },
  rust: { power: 'anchor_chain', telegraph: 1.2, duration: 4.8, cooldown: 12, firstAfter: 4, counter: 'pump', prompt: 'Pump in rhythm!', effect: { beat: 0.6, window: 0.2, pumpsNeeded: 5, pullMult: 2.4, pumpStamina: 0.035, missSpike: 0.12, failRegen: 0.1 } },
};

export function powerFor(state, variant) {
  const data = state.data?.powers?.[variant];
  const fb = FALLBACK_POWERS[variant];
  if (!data && !fb) return null;
  return { ...fb, ...data, effect: { ...(fb?.effect || {}), ...(data?.effect || {}) } };
}

// ctx: { fish, variant, events, hooks: { project(v3)->{x,y}, playerPos, linePoint(t)->{x,y,z}, shake, slowmo, toast, setWalk(on) } }
export function createPowerRunner(def, ctx) {
  const { fish, variant, events } = ctx;
  const e = def.effect || {};
  const p = {
    phase: 'cooldown',
    t: 0,
    wait: def.firstAfter ?? 4,
    success: false,
    detail: null,
    heat: 0,
    reelBoost: 0,
    goodSum: 0,
    goodN: 0,
    reelTime: 0,
    pumps: 0,
    jumpIdx: 0,
    jumpTargets: [],
    glyphCheck: null,
  };
  // Modifiers the fight reads every frame.
  const mods = { reelGain: 1, tensionRise: 1, pull: 1, noTensionDecay: false, airY: null, snap: false, flipEvery: 0 };

  function base() {
    return { uid: fish.uid, variant, power: def.power };
  }
  function target() {
    const P = ctx.hooks;
    switch (def.counter) {
      case 'step': return { x: P.playerPos.x, z: P.playerPos.z };
      case 'swipe': { const m = P.linePoint(0.55); return { x: m.x, z: m.z }; }
      case 'reaim': return p.jumpTargets[p.jumpIdx] || { x: fish.pos.x, z: fish.pos.z };
      default: return { x: fish.pos.x, z: fish.pos.z };
    }
  }

  function startTelegraph(fight) {
    p.phase = 'telegraph';
    p.t = 0;
    p.success = false;
    const P = ctx.hooks;
    // Build the power's layout now so the warning shows exactly where things will happen.
    if (def.counter === 'tap') {
      p.detail = { shards: Array.from({ length: e.shards }, (_, i) => {
        const a = (i / e.shards) * Math.PI * 2 + rand(-0.3, 0.3);
        const r = rand(0.6, 1) * e.spread;
        return { x: fish.pos.x + Math.cos(a) * r, z: fish.pos.z + Math.sin(a) * r, broken: false };
      }) };
    } else if (def.counter === 'step') {
      const bombs = [];
      for (let i = 0; i < e.bombs; i++) {
        const onPlayer = i === 0;
        const a = rand(0, Math.PI * 2), r = onPlayer ? 0 : rand(0.8, e.spread);
        bombs.push({ x: P.playerPos.x + Math.cos(a) * r, z: P.playerPos.z + Math.sin(a) * r, radius: e.radius, at: def.telegraph + ((i + 1) / (e.bombs + 1)) * def.duration, hit: false, landed: false });
      }
      p.detail = { bombs };
      P.setWalk(true);
    } else if (def.counter === 'swipe') {
      p.detail = { vines: Array.from({ length: e.vines }, (_, i) => ({ t: 0.3 + (i / Math.max(1, e.vines - 1)) * 0.5, cut: false })) };
    } else if (def.counter === 'reaim') {
      p.jumpIdx = 0;
      p.jumpTargets = [];
      let ang = fight.state.angle;
      for (let i = 0; i < e.jumps; i++) {
        ang += (Math.random() < 0.5 ? -1 : 1) * e.angle;
        const d = fight.state.distance;
        p.jumpTargets.push({ x: P.playerPos.x + Math.sin(ang) * d, z: P.playerPos.z + Math.cos(ang) * d, angle: ang, at: def.telegraph + (i / e.jumps) * def.duration });
      }
      p.detail = { glyphs: p.jumpTargets };
    } else if (def.counter === 'pump') {
      p.detail = { beat: e.beat, window: e.window, needed: e.pumpsNeeded };
      p.pumps = 0;
    } else {
      p.detail = {};
    }
    events.emit('power:telegraph', { ...base(), target: target(), duration: def.telegraph, detail: p.detail });
    ctx.hooks.toast(def.prompt, def.telegraph + 0.6);
  }

  function startActive() {
    p.phase = 'active';
    p.t = 0;
    p.goodSum = p.goodN = p.reelTime = 0;
    events.emit('power:start', { ...base(), target: target(), duration: def.duration, detail: p.detail });
  }

  function end(fight, success) {
    if (p.phase === 'cooldown') return;
    p.phase = 'cooldown';
    p.t = 0;
    p.wait = def.cooldown;
    p.success = success;
    resetMods();
    ctx.hooks.setWalk(false);
    fish.airY = 0;
    events.emit('power:end', { ...base(), target: target(), success, detail: p.detail });
    ctx.hooks.toast(success ? 'Countered!' : 'It got the better of you', 1.1);
    void fight;
  }

  function resetMods() {
    mods.reelGain = 1; mods.tensionRise = 1; mods.pull = 1; mods.noTensionDecay = false; mods.airY = null; mods.snap = false; mods.flipEvery = 0;
  }

  // input: { reeling, steer, pressEdge, taps:[{x,y}], swipes:[{x0,y0,x1,y1}] } (screen px)
  function update(dt, fight, input) {
    const s = fight.state;
    resetMods();
    if (s.landing || s.status !== 'fighting') { if (p.phase !== 'cooldown') end(fight, false); return mods; }
    p.t += dt;
    if (p.phase === 'cooldown') {
      if (p.reelBoost > 0) { p.reelBoost -= dt; mods.reelGain = e.thawBoost || 1.8; }
      if (p.t >= p.wait) startTelegraph(fight);
      return mods;
    }
    if (p.phase === 'telegraph') {
      telegraphRules(dt, fight, input);
      if (p.t >= def.telegraph) startActive();
      return mods;
    }
    activeRules(dt, fight, input);
    if (p.phase === 'active' && p.t >= def.duration) finish(fight);
    return mods;
  }

  function telegraphRules(dt, fight, input) {
    if (def.counter === 'step') emberHeat(dt, fight, input, p.t);
    if (def.counter === 'tide') mods.airY = Math.min(1, p.t / def.telegraph) * 0.4;
  }

  function emberHeat(dt, fight, input, tTotal) {
    const s = fight.state;
    p.heat += (s.tension > e.tensionHot ? e.heatRate : -e.coolRate) * dt;
    for (const b of p.detail.bombs) {
      if (!b.landed && tTotal >= b.at) {
        b.landed = true;
        const P = ctx.hooks.playerPos;
        if (Math.hypot(P.x - b.x, P.z - b.z) < b.radius) { b.hit = true; p.heat += e.heatPerHit; ctx.hooks.shake(0.5, 0.4); }
        else ctx.hooks.shake(0.15, 0.25);
      }
    }
    p.heat = Math.max(0, p.heat);
    p.detail.heat = p.heat;
    if (p.heat >= (e.snapAtHeat || 1)) { mods.snap = true; }
  }

  function activeRules(dt, fight, input) {
    const s = fight.state;
    const P = ctx.hooks;
    switch (def.counter) {
      case 'slack':
        // The strike lands at the start of the active phase.
        if (!p.struck) {
          p.struck = true;
          P.slowmo(e.slowmo ?? 0.3, 0.45);
          P.shake(0.9, 0.5);
          if (s.tension <= (e.slackBelow ?? 0.32)) { p.strikeOk = true; s.stamina = Math.max(0, s.stamina - (e.successStamina || 0.1)); }
          else { p.strikeOk = false; mods.snap = true; }
        }
        break;
      case 'tap': {
        mods.reelGain = 0;
        for (const tap of input.taps || []) {
          for (const sh of p.detail.shards) {
            if (sh.broken) continue;
            const sp = P.project(sh);
            if (Math.hypot(sp.x - tap.x, sp.y - tap.y) < (e.tapRadiusPx || 46)) { sh.broken = true; P.shake(0.12, 0.15); break; }
          }
        }
        if (p.detail.shards.every((sh) => sh.broken)) { p.reelBoost = e.boostTime || 2.5; p.t = 0; finishEarly(fight, true); }
        break;
      }
      case 'step':
        emberHeat(dt, fight, input, def.telegraph + p.t);
        break;
      case 'swipe': {
        const uncut = p.detail.vines.filter((v) => !v.cut);
        if (uncut.length) { mods.tensionRise = e.dragMult || 1.7; mods.reelGain = e.reelMult || 0.35; }
        for (const sw of input.swipes || []) {
          for (const v of uncut) {
            const vp = P.project(P.linePoint(v.t));
            if (segDist(vp, sw) < (e.swipeRadiusPx || 60)) v.cut = true;
          }
        }
        if (p.detail.vines.every((v) => v.cut)) finishEarly(fight, true);
        break;
      }
      case 'reaim': {
        const tt = def.telegraph + p.t;
        const next = p.jumpTargets[p.jumpIdx];
        if (next && tt >= next.at && !next.done) {
          next.done = true;
          // The fish blinks to the glyph; its pull flips.
          const prevScreen = P.project(fish.pos);
          s.angle = next.angle;
          s.side *= -1;
          const glyphScreen = P.project(next);
          p.glyphCheck = { dir: Math.sign(glyphScreen.x - prevScreen.x) || 1, t: 0, sum: 0, n: 0 };
          events.emit('power:start', { ...base(), target: { x: next.x, z: next.z }, duration: e.window, detail: { ...p.detail, jump: p.jumpIdx } });
          p.jumpIdx += 1;
        }
        if (p.glyphCheck) {
          const g = p.glyphCheck;
          g.t += dt;
          g.sum += (input.steer || 0) * g.dir;
          g.n += 1;
          if (g.t >= (e.window || 1.6)) {
            const ok = g.sum / Math.max(1, g.n) > 0.25;
            if (ok) s.stamina = Math.max(0, s.stamina - (e.bonusStamina || 0.06));
            else s.tension = Math.min(1, s.tension + (e.failSpike || 0.3));
            p.goodSum += ok ? 1 : 0;
            p.goodN += 1;
            p.glyphCheck = null;
          }
        }
        break;
      }
      case 'follow':
        mods.flipEvery = e.flipEvery || 0.75;
        p.goodSum += Math.max(0, s.good);
        p.goodN += 1;
        break;
      case 'hold':
        mods.airY = (e.lift || 2.4) * Math.sin(Math.min(1, p.t / def.duration) * Math.PI);
        if (input.reeling) { p.reelTime += dt; s.tension = Math.min(1, s.tension + (e.reelSpikeRate || 2.2) * dt); }
        break;
      case 'pump': {
        mods.pull = e.pullMult || 2.4;
        mods.reelGain = 0;
        if (input.reeling) mods.tensionRise = 1.4;
        if (input.pressEdge) {
          const phase = p.t % e.beat;
          const off = Math.min(phase, e.beat - phase);
          if (off <= e.window) { p.pumps += 1; s.stamina = Math.max(0, s.stamina - (e.pumpStamina || 0.035)); s.distance = Math.max(1.8, s.distance - 0.45); P.shake(0.12, 0.12); }
          else s.tension = Math.min(1, s.tension + (e.missSpike || 0.12));
        }
        p.detail.pumps = p.pumps;
        p.detail.phase = (p.t % e.beat) / e.beat;
        break;
      }
      default: break;
    }
  }

  function finishEarly(fight, success) {
    if (success && def.counter === 'tap') { /* boost runs during cooldown */ }
    end(fight, success);
  }

  function finish(fight) {
    const s = fight.state;
    let ok = false;
    switch (def.counter) {
      case 'slack': ok = Boolean(p.strikeOk); p.struck = false; break;
      case 'tap': ok = false; s.stamina = Math.min(1, s.stamina + (e.failRegen || 0.2)); break;
      case 'step': ok = p.detail.bombs.every((b) => !b.hit) && p.heat < 1; break;
      case 'swipe': ok = p.detail.vines.every((v) => v.cut); if (!ok) s.tension = Math.min(1, s.tension + (e.endSpike || 0.3)); break;
      case 'reaim': ok = p.goodN > 0 && p.goodSum / p.goodN >= 0.5; break;
      case 'follow': ok = p.goodSum / Math.max(1, p.goodN) >= (e.goodThreshold || 0.3);
        if (ok) s.stamina = Math.max(0, s.stamina - (e.successStamina || 0.12)); else s.stamina = Math.min(1, s.stamina + (e.failRegen || 0.15)); break;
      case 'hold': ok = p.reelTime < def.duration * 0.2; if (ok) s.stamina = Math.max(0, s.stamina - (e.successStamina || 0.15)); ctx.hooks.splash(fish.pos.x, fish.pos.z, 1.8); break;
      case 'pump': ok = p.pumps >= (e.pumpsNeeded || 5); if (!ok) s.stamina = Math.min(1, s.stamina + (e.failRegen || 0.1)); break;
      default: break;
    }
    end(fight, ok);
  }

  return {
    def,
    update,
    get phase() { return p.phase; },
    get t() { return p.t; },
    get detail() { return p.detail; },
    get heat() { return p.heat; },
    stop(fight) { if (p.phase !== 'cooldown') end(fight, false); },
  };
}

function segDist(pt, sw) {
  const dx = sw.x1 - sw.x0, dy = sw.y1 - sw.y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((pt.x - sw.x0) * dx + (pt.y - sw.y0) * dy) / l2));
  return Math.hypot(sw.x0 + dx * t - pt.x, sw.y0 + dy * t - pt.y);
}
