// #hud-fishing (Agent A owns its contents). Only Agent B's theme names are used for styling:
// .btn .btn--primary .btn--round .meter .meter__fill .meter--tension .meter--stamina .toast and
// the --font-* / --c-* variables. Inline styles are layout only (position, size, safe areas).
// Joystick, slingshot band, aim readout and fight prompts are drawn on an overlay canvas using
// the same CSS variables.

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function createHud({ root }) {
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  root.innerHTML = `
    <canvas data-role="fx" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>
    <div data-role="meters" style="position:absolute;left:calc(16px + env(safe-area-inset-left));right:calc(128px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom));display:none;flex-direction:column;gap:10px;pointer-events:none;">
      <div class="meter meter--tension" role="meter" aria-label="Line tension" aria-valuemin="0" aria-valuemax="100"><div class="meter__fill" style="width:0%"></div></div>
      <div class="meter meter--stamina" role="meter" aria-label="Fish stamina" aria-valuemin="0" aria-valuemax="100"><div class="meter__fill" style="width:100%"></div></div>
      <div class="meter meter--mastery" role="meter" aria-label="Mastery: keep the line in the sweet band" aria-valuemin="0" aria-valuemax="100"><div class="meter__fill" style="width:0%"></div><span class="meter__grade" aria-live="polite"></span></div>
    </div>
    <button type="button" class="btn btn--primary btn--round" data-role="main"
      style="position:absolute;right:calc(18px + env(safe-area-inset-right));bottom:calc(22px + env(safe-area-inset-bottom));width:92px;height:92px;min-width:44px;min-height:44px;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;">Cast</button>
    <div class="toast" data-role="toast" role="status" aria-live="polite"
      style="position:absolute;left:50%;top:calc(17% + env(safe-area-inset-top));transform:translateX(-50%);display:none;pointer-events:none;white-space:nowrap;"></div>
  `;
  const canvas = root.querySelector('[data-role="fx"]');
  const g = canvas.getContext('2d');
  const main = root.querySelector('[data-role="main"]');
  const meters = root.querySelector('[data-role="meters"]');
  const tensionFill = meters.querySelector('.meter--tension .meter__fill');
  const staminaFill = meters.querySelector('.meter--stamina .meter__fill');
  const tensionMeter = meters.querySelector('.meter--tension');
  const staminaMeter = meters.querySelector('.meter--stamina');
  const masteryMeter = meters.querySelector('.meter--mastery');
  const masteryFill = masteryMeter.querySelector('.meter__fill');
  const masteryGrade = masteryMeter.querySelector('.meter__grade');
  const toastEl = root.querySelector('[data-role="toast"]');
  let toastTimer = 0;
  let dpr = 1;
  let theme = {};

  function readTheme() {
    theme = {
      paper: cssVar('--c-paper', '#f4e6c6'),
      ink: cssVar('--c-ink', '#13262a'),
      glow: cssVar('--c-glow', '#7ff5df'),
      gold: cssVar('--c-gold', '#f2c46a'),
      danger: cssVar('--c-danger', '#e0614a'),
      sea: cssVar('--c-sea', '#0e5a54'),
      fontDisplay: cssVar('--font-display', 'serif'),
      fontNum: cssVar('--font-num', 'serif'),
      fontBody: cssVar('--font-body', 'serif'),
    };
  }
  readTheme();
  // B's theme may land after us: re-read once fonts/styles settle.
  document.fonts?.ready?.then(readTheme);
  setTimeout(readTheme, 1500);

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(root.clientWidth * dpr);
    canvas.height = Math.round(root.clientHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function buttonCentre() {
    const r = main.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rr.left, y: r.top + r.height / 2 - rr.top, r: r.width / 2 };
  }

  // --- drawing helpers -------------------------------------------------------------------
  const THREE_clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function ring(x, y, r, color, width = 2, alpha = 1) {
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  function ticks(x, y, r, n, len, color, width = 2) {
    g.strokeStyle = color;
    g.lineWidth = width;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = i % (n / 4) === 0 ? len * 1.7 : len;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.lineTo(x + Math.cos(a) * (r + l), y + Math.sin(a) * (r + l));
      g.stroke();
    }
  }

  function label(text, x, y, { size = 15, color = theme.paper, font = theme.fontDisplay, align = 'center', alpha = 1 } = {}) {
    g.globalAlpha = alpha;
    g.font = `${size}px ${font}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(6, 22, 24, 0.75)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.globalAlpha = 1;
  }

  // Painted cast/reel button (Casper 9b.8: the cast button gets custom art). Falls back to the
  // theme button if the art can't load. Label sits on a small painted tag under the object.
  const ART = {
    cast: 'art/hud/cast_idle.webp', castPressed: 'art/hud/cast_pressed.webp', aim: 'art/hud/cast_aim.webp',
    reel: 'art/hud/reel_idle.webp', reelPressed: 'art/hud/reel_pressed.webp', tag: 'art/hud/tag.webp',
  };
  let artOk = false;
  let artKind = 'cast';
  let pressed = false;
  const probe = new Image();
  probe.onload = () => { artOk = true; labelEl.textContent = main.textContent.trim(); for (const src of Object.values(ART)) { const i = new Image(); i.src = src; } paintMain(); };
  probe.src = ART.cast;
  const labelEl = document.createElement('span');
  labelEl.style.cssText = `position:absolute;left:50%;bottom:-14px;transform:translateX(-50%);min-width:64px;padding:3px 12px 4px 18px;
    background:url(${ART.tag}) center/100% 100% no-repeat;color:#13262a;font:600 13px/1 var(--font-display, serif);
    letter-spacing:0.02em;white-space:nowrap;pointer-events:none;`;
  function paintMain() {
    if (!artOk) return;
    const src = artKind === 'reel' ? (pressed ? ART.reelPressed : ART.reel)
      : artKind === 'aim' ? ART.aim : (pressed ? ART.castPressed : ART.cast);
    main.classList.remove('btn', 'btn--primary', 'btn--round');
    main.style.background = `url(${src}) center/contain no-repeat`;
    main.style.border = 'none';
    main.style.boxShadow = 'none';
    main.style.color = 'transparent';
    main.style.width = main.style.height = '104px';
    main.style.filter = 'drop-shadow(0 6px 8px rgba(0,0,0,0.45))';
    if (labelEl.parentNode !== main) main.append(labelEl);
  }

  // Painted fight gauges (F's hud set): brass tension dial + needle (+ crack near the snap point)
  // and a spirit-level stamina gauge. B's .meter elements stay as the accessible fallback.
  const HUD = {
    dial: 'art/hud/gauge_tension.webp', needle: 'art/hud/gauge_tension_needle.webp', level: 'art/hud/gauge_stamina.webp',
    ring: 'art/hud/ring_perfect.webp', strike: 'art/hud/prompt_strike.webp', band: 'art/hud/line_band.webp', crack: 'art/hud/crack.webp',
  };
  const img = {};
  for (const [k, src] of Object.entries(HUD)) { const i = new Image(); i.onload = () => { img[k] = i; if (k === 'dial' || k === 'level') buildGauges(); }; i.src = src; }
  const gauges = document.createElement('div');
  gauges.style.cssText = 'position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));width:min(62vw, 300px);height:132px;display:none;pointer-events:none;';
  root.appendChild(gauges);
  let dialEl = null, needleEl = null, crackEl = null, levelCover = null, levelEl = null;
  function buildGauges() {
    if (!img.dial || !img.level || dialEl) return;
    gauges.innerHTML = `
      <div data-g="dial" style="position:absolute;left:0;bottom:0;width:124px;height:124px;background:url(${HUD.dial}) center/contain no-repeat;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45));">
        <div data-g="needle" style="position:absolute;left:50%;top:50%;width:18px;height:92px;margin:-46px 0 0 -9px;background:url(${HUD.needle}) center/contain no-repeat;transform-origin:50% 50%;"></div>
        <div data-g="crack" style="position:absolute;inset:14px;background:url(${HUD.crack}) center/contain no-repeat;opacity:0;mix-blend-mode:screen;"></div>
      </div>
      <div data-g="level" style="position:absolute;left:118px;right:0;bottom:30px;aspect-ratio:4/1;background:url(${HUD.level}) center/100% 100% no-repeat;filter:drop-shadow(0 3px 5px rgba(0,0,0,.4));">
        <div data-g="cover" style="position:absolute;top:31%;bottom:31%;right:17%;width:0%;background:rgba(10,24,28,.78);border-radius:3px;"></div>
      </div>`;
    dialEl = gauges.querySelector('[data-g="dial"]');
    needleEl = gauges.querySelector('[data-g="needle"]');
    crackEl = gauges.querySelector('[data-g="crack"]');
    levelEl = gauges.querySelector('[data-g="level"]');
    levelCover = gauges.querySelector('[data-g="cover"]');
  }
  let gaugesOn = false;

  return {
    main,
    root,
    buttonCentre,
    setMainLabel(text, { hidden = false, ariaLabel } = {}) {
      artKind = text === 'Aim' ? 'aim' : (text === 'Reel' || text === 'Hook!') ? 'reel' : 'cast';
      if (artOk) {
        if (labelEl.textContent !== text) labelEl.textContent = text;
        labelEl.style.display = text ? '' : 'none';
        paintMain();
      } else if (main.textContent !== text) main.textContent = text;
      main.style.display = hidden ? 'none' : '';
      main.setAttribute('aria-label', ariaLabel || text);
    },
    setMainPressed(on) { pressed = !!on; main.setAttribute('aria-pressed', on ? 'true' : 'false'); paintMain(); },
    showMeters(on) { meters.style.display = on ? 'flex' : 'none'; },
    setMasteryGrade(id, name = '') {
      if (id) masteryMeter.dataset.grade = id; else delete masteryMeter.dataset.grade;
      masteryGrade.textContent = id ? name : '';
    },
    setMeters(tension, stamina, { danger = false, mastery = 0 } = {}) {
      masteryFill.style.width = `${Math.round(mastery * 100)}%`;
      masteryMeter.setAttribute('aria-valuenow', String(Math.round(mastery * 100)));
      tensionFill.style.width = `${Math.round(tension * 100)}%`;
      staminaFill.style.width = `${Math.round(stamina * 100)}%`;
      tensionMeter.setAttribute('aria-valuenow', String(Math.round(tension * 100)));
      staminaMeter.setAttribute('aria-valuenow', String(Math.round(stamina * 100)));
      tensionMeter.dataset.state = danger ? 'danger' : tension > 0.85 ? 'high' : tension < 0.15 ? 'slack' : 'ok';
    },
    toast(text, seconds = 1.6) {
      toastEl.textContent = text;
      toastEl.style.display = '';
      toastTimer = seconds;
    },
    snapFlash() {
      if (!crackEl) return;
      crackEl.style.opacity = '1';
      gauges.style.display = 'block';
      setTimeout(() => { gauges.style.display = gaugesOn ? 'block' : 'none'; }, 900);
    },
    clearToast() { toastTimer = 0; toastEl.style.display = 'none'; },
    // draw(frame): called every frame with what to show on the overlay canvas.
    draw(frame, realDt) {
      if (toastTimer > 0) {
        toastTimer -= realDt;
        if (toastTimer <= 0) toastEl.style.display = 'none';
      }
      if (canvas.width !== Math.round(root.clientWidth * dpr)) resize();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);

      // Fight minigames (minigames.js), drawn at the fish.
      const mg = frame.minigame;
      if (mg && mg.fish) {
        const { x, y } = mg.fish;
        if (mg.snag) {
          // A row of arrows to swipe, the current one big and gold with its time running out.
          const n = mg.snag.arrows.length, gap = 46;
          const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
          for (let i = 0; i < n; i++) {
            const ax = x + (i - (n - 1) / 2) * gap, ay = y - 70;
            const done = i < mg.snag.i, cur = i === mg.snag.i;
            g.save();
            g.translate(ax, ay);
            g.globalAlpha = done ? 0.35 : 1;
            g.fillStyle = 'rgba(6, 22, 24, 0.72)';
            g.beginPath(); g.arc(0, 0, cur ? 20 : 15, 0, Math.PI * 2); g.fill();
            if (cur) { g.strokeStyle = theme.gold; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, mg.snag.k)); g.stroke(); }
            g.rotate(ang[mg.snag.arrows[i]]);
            g.fillStyle = done ? theme.glow : cur ? theme.gold : theme.paper;
            const s = cur ? 1.25 : 0.9;
            g.beginPath(); g.moveTo(11 * s, 0); g.lineTo(-5 * s, -9 * s); g.lineTo(-1 * s, 0); g.lineTo(-5 * s, 9 * s); g.closePath(); g.fill();
            g.restore();
          }
          g.globalAlpha = 1;
          label('Swipe!', x, y - 104, { size: 16, color: theme.gold });
        }
        if (mg.pump) {
          // A ring closing on the fish each beat; dots for hits.
          const r = 18 + 50 * Math.max(0, 1 - mg.pump.k);
          ring(x, y, 18, theme.gold, 4, 0.9);
          if (mg.pump.k <= 1.15) ring(x, y, r, theme.paper, 3, 0.85);
          for (let i = 0; i < mg.pump.beats; i++) ring(x + (i - (mg.pump.beats - 1) / 2) * 20, y + 44, 6, i < mg.pump.hits ? theme.gold : theme.paper, i < mg.pump.beat ? 6 : 2, 0.9);
          label('Pump!', x, y - 80, { size: 16, color: theme.gold });
        }
        if (mg.hold) {
          // A brass bar: keep the marker in the gold middle; the fill shows how long you've held it.
          const W = 180, bx = x - W / 2, by = y - 74;
          g.fillStyle = 'rgba(6, 22, 24, 0.75)'; g.fillRect(bx - 4, by - 10, W + 8, 20);
          g.fillStyle = theme.gold; g.globalAlpha = 0.55;
          g.fillRect(x - (mg.hold.zone * W) / 2, by - 8, mg.hold.zone * W, 16);
          g.globalAlpha = 1;
          g.fillStyle = theme.glow; g.fillRect(bx, by + 12, W * Math.min(1, mg.hold.fill), 4);
          const mx = x + Math.max(-1, Math.min(1, mg.hold.m)) * (W / 2);
          g.fillStyle = theme.paper; g.beginPath(); g.moveTo(mx, by - 12); g.lineTo(mx - 7, by - 22); g.lineTo(mx + 7, by - 22); g.closePath(); g.fill();
          g.fillRect(mx - 1.5, by - 10, 3, 20);
          label('Steer!', x, by - 34, { size: 16, color: theme.gold });
        }
        if (mg.landing) {
          // A brass half-dial: gold zone in the middle, the needle sweeping across.
          const R = 46, cx = x, cy = y - 30;
          g.lineWidth = 9;
          g.globalAlpha = 0.85;
          g.strokeStyle = 'rgba(6, 22, 24, 0.75)';
          g.beginPath(); g.arc(cx, cy, R, Math.PI, Math.PI * 2); g.stroke();
          g.strokeStyle = theme.gold;
          const gz = mg.landing.gold * Math.PI;
          g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.5 - gz / 2, Math.PI * 1.5 + gz / 2); g.stroke();
          g.globalAlpha = 1;
          const a = Math.PI + mg.landing.needle * Math.PI;
          g.strokeStyle = theme.paper; g.lineWidth = 3;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); g.stroke();
          label('Land it!', cx, cy - R - 18, { size: 16, color: theme.gold });
        }
        if (mg.flash) label(mg.flash.text, x, y - 120 - mg.flash.t * 24, { size: 20, color: mg.flash.ok ? theme.gold : theme.danger, alpha: 1 - mg.flash.t / 0.8 });
      }

      // Hot spots (sea.js): on screen a pulsing ring and its name; off screen a brass arrow at the
      // edge pointing the way, so you can go and find the fish.
      if (frame.hotspots) {
        const W = root.clientWidth, H = root.clientHeight, pad = 34;
        const t = performance.now() / 1000;
        for (const s of frame.hotspots) {
          const a = s.fade;
          if (a <= 0.01) continue;
          const on = s.visible && s.x > pad && s.x < W - pad && s.y > pad + 70 && s.y < H - pad - 110;
          if (on) {
            const r = 26 + 8 * Math.sin(t * 3);
            ring(s.x, s.y, r, s.color, 2.5, 0.75 * a);
            ring(s.x, s.y, r * 0.55, s.color, 1.5, 0.45 * a);
            label(s.label, s.x, s.y - r - 12, { size: 14, color: s.color, alpha: a });
          } else {
            // Clamp the direction from the screen centre to the edge (behind the camera: flip).
            let dx = s.x - W / 2, dy = s.y - H / 2;
            if (!s.visible) { dx = -dx; dy = -dy; }
            const k = Math.min((W / 2 - pad) / Math.max(1e-3, Math.abs(dx)), (H / 2 - pad - 90) / Math.max(1e-3, Math.abs(dy)));
            const ex = W / 2 + dx * k, ey = H / 2 + dy * k;
            const ang = Math.atan2(dy, dx);
            g.save();
            g.translate(ex, ey);
            g.rotate(ang);
            g.globalAlpha = 0.92 * a;
            g.fillStyle = 'rgba(6, 22, 24, 0.7)';
            g.beginPath(); g.arc(-6, 0, 17, 0, Math.PI * 2); g.fill();
            g.fillStyle = s.color;
            g.beginPath(); g.moveTo(14, 0); g.lineTo(-2, -9); g.lineTo(2, 0); g.lineTo(-2, 9); g.closePath(); g.fill();
            g.strokeStyle = theme.gold; g.lineWidth = 1.5;
            g.beginPath(); g.arc(-6, 0, 17, 0, Math.PI * 2); g.stroke();
            g.restore();
            g.globalAlpha = 1;
            const lx = THREE_clamp(ex - Math.cos(ang) * 40, 50, W - 50), ly = THREE_clamp(ey - Math.sin(ang) * 34, 90, H - 120);
            label(s.label, lx, ly, { size: 12, color: s.color, alpha: 0.9 * a });
          }
        }
      }

      // Floating joystick: a brass compass bezel with a paper knob.
      const j = frame.joystick;
      if (j && j.active) {
        const R = j.radius;
        g.fillStyle = 'rgba(6, 22, 24, 0.28)';
        g.beginPath(); g.arc(j.ox, j.oy, R + 8, 0, Math.PI * 2); g.fill();
        ring(j.ox, j.oy, R + 8, theme.gold, 2.5, 0.85);
        ticks(j.ox, j.oy, R + 8, 16, 5, theme.gold, 1.5);
        const kx = j.ox + j.vx * R, ky = j.oy + j.vy * R;
        g.fillStyle = theme.paper;
        g.globalAlpha = 0.92;
        g.beginPath(); g.arc(kx, ky, 22, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        ring(kx, ky, 22, theme.gold, 2);
      }

      // Slingshot band from the fisher to the thumb (it pulls from the fisher: room all round).
      const a = frame.aim;
      if (a) {
        const c = buttonCentre();
        const o = a.centre ? { x: a.centre.x, y: a.centre.y, r: 26 } : c;
        const px = o.x + a.drag.x, py = o.y + a.drag.y;
        const inDead = !a.hasAim;
        const col = inDead ? theme.danger : theme.paper;
        const nx = -a.drag.y / (a.dragLength || 1), ny = a.drag.x / (a.dragLength || 1);
        g.strokeStyle = col;
        // The band thins and brightens as it stretches: it should feel loaded.
        g.lineWidth = 3.5 - (a.power || 0) * 1.6;
        g.globalAlpha = 0.75 + (a.power || 0) * 0.25;
        for (const s of [-1, 1]) {
          const sx = o.x + nx * o.r * 0.55 * s, sy = o.y + ny * o.r * 0.55 * s;
          if (img.band && !inDead) {
            // Painted rope band stretched from the button to the thumb.
            const len = Math.hypot(px - sx, py - sy);
            g.save();
            g.translate(sx, sy);
            g.rotate(Math.atan2(py - sy, px - sx));
            g.drawImage(img.band, 0, -5 + (a.power || 0) * 1.5, len, 10 - (a.power || 0) * 3);
            g.restore();
          } else {
            g.beginPath();
            g.moveTo(sx, sy);
            g.lineTo(px, py);
            g.stroke();
          }
        }
        g.globalAlpha = 1;
        g.fillStyle = col;
        g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
        // Power ring around the button.
        const p = Math.min(1, Math.max(0, a.power || 0));
        g.strokeStyle = theme.gold;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(c.x, c.y, c.r + 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        g.stroke();
        if (inDead) {
          ring(o.x, o.y, 26, theme.danger, 1.5, 0.6);
          label((a.moved || 0) > a.deadZone ? 'Release to cancel' : 'Pull away from your fisher to aim', c.x - c.r - 6, c.y - c.r - 24, { size: 14, align: 'right', font: theme.fontBody });
        }
        if (a.reticle && a.hasAim) {
          const txt = a.valid ? `${a.band}  ${a.depth.toFixed(1)} m${a.fish ? `  ·  ${a.fish} fish` : ''}` : 'No water there';
          label(txt, a.reticle.x, a.reticle.y + 44, { size: 15, color: a.valid ? theme.paper : theme.danger, font: theme.fontNum });
          if (a.perfect) {
            if (img.ring) {
              const r = 46;
              g.globalAlpha = 0.95;
              g.drawImage(img.ring, a.reticle.x - r, a.reticle.y - r * 0.62, r * 2, r * 1.24);
              g.globalAlpha = 1;
            }
            label('Perfect', a.reticle.x, a.reticle.y - 46, { size: 16, color: theme.gold });
          }
        }
      }

      // Bite: a pulsing ring over the lure that shrinks with the hook window.
      const b = frame.bite;
      if (b) {
        const k = Math.max(0, b.remaining / b.window);
        ring(b.x, b.y, 18 + 26 * k, theme.gold, 4, 0.95);
        if (img.strike) {
          // Painted "Strike!" splash, punching in as the window opens.
          const w = 120 * (0.9 + 0.25 * Math.min(1, (1 - k) * 4)), h = w * (320 / 768);
          g.drawImage(img.strike, b.x - w / 2, b.y - h - 26, w, h);
        } else label('!', b.x, b.y - 2, { size: 28, color: theme.gold });
      }

      // Taunt (taunt.js): a ring closes on the lure each beat; the gold arc is how taunted it is.
      const tn = frame.taunt;
      if (tn) {
        const r = 14 + 46 * (1 - tn.beat);
        ring(tn.x, tn.y, r, theme.paper, 2, 0.25 + 0.5 * tn.beat);
        ring(tn.x, tn.y, 14, theme.glow, 2, 0.5);
        if (tn.level > 0.01) {
          g.strokeStyle = theme.gold;
          g.lineWidth = 4;
          g.globalAlpha = 0.95;
          g.beginPath();
          g.arc(tn.x, tn.y, 22, -Math.PI / 2, -Math.PI / 2 + tn.level * Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
        if (tn.flash) label(tn.flash.text, tn.x, tn.y - 34 - tn.flash.t * 24, { size: 16, color: tn.flash.ok ? theme.gold : theme.danger, alpha: 1 - tn.flash.t / 0.6 });
      }
      // Fight: which way the fish pulls, and a bow prompt during leaps.
      const f = frame.fight;
      if (f) {
        if (f.fish && Math.abs(f.lateral) > 0.15) {
          const dir = Math.sign(f.lateral);
          const x = f.fish.x + dir * 34, y = f.fish.y;
          g.fillStyle = theme.danger;
          g.globalAlpha = 0.9;
          g.beginPath();
          g.moveTo(x + dir * 14, y);
          g.lineTo(x - dir * 4, y - 11);
          g.lineTo(x - dir * 4, y + 11);
          g.closePath();
          g.fill();
          g.globalAlpha = 1;
        }
        // Surge (surge.js): a glow ring closes in on the fish; tap as it meets the target ring.
        const sg = frame.surge;
        if (sg && sg.fish) {
          const { x, y } = sg.fish;
          if (sg.running) {
            const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
            ring(x, y, 30, theme.glow, 5, 0.55 + 0.4 * pulse);
            const r = 30 + 110 * Math.max(0, 1 - sg.k);
            if (sg.k <= 1.12) ring(x, y, r, theme.gold, 3 + 3 * sg.k, 0.95);
            for (let i = 0; i < sg.beats; i++) {
              const done = i < sg.beat || (i === sg.beat && sg.flash);
              const cx = x + (i - (sg.beats - 1) / 2) * 22, cy = y + 50;
              ring(cx, cy, 6, i < sg.hits ? theme.glow : theme.paper, done ? 6 : 2, done ? 1 : 0.6);
            }
            label('Surge!', x, y - 58, { size: 18, color: theme.glow });
          }
          if (sg.flash) label(sg.flash.text, x, y - 80 - sg.flash.t * 30, { size: 22, color: sg.flash.ok ? theme.gold : theme.danger, alpha: 1 - sg.flash.t / 0.7 });
        }
        if (f.bowWindow && f.fish) {
          ring(f.fish.x, f.fish.y, 34, theme.gold, 4, 0.95);
          label('Bow!', f.fish.x, f.fish.y - 52, { size: 20, color: theme.gold });
        }
        // Superpower counters (Agent E draws the spectacle; these keep it playable and fair).
        const pw = frame.power;
        if (pw) {
          const c0 = buttonCentre();
          if (pw.phase === 'telegraph') {
            const k = Math.min(1, pw.t / pw.telegraph);
            g.strokeStyle = theme.danger;
            g.lineWidth = 5;
            g.beginPath();
            g.arc(c0.x, c0.y, c0.r + 16, -Math.PI / 2, -Math.PI / 2 + (1 - k) * Math.PI * 2);
            g.stroke();
          }
          for (const sh of pw.shards || []) {
            ring(sh.x, sh.y, 22, sh.broken ? theme.paper : theme.glow, sh.broken ? 1 : 4, sh.broken ? 0.35 : 0.95);
            if (!sh.broken) ticks(sh.x, sh.y, 10, 6, 6, theme.glow, 2);
          }
          for (const b of pw.bombs || []) {
            if (b.landed) continue;
            g.fillStyle = theme.danger;
            g.globalAlpha = 0.18;
            g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
            g.globalAlpha = 1;
            ring(b.x, b.y, b.r, theme.danger, 3, 0.9);
          }
          for (const v of pw.vines || []) {
            if (v.cut) continue;
            g.strokeStyle = theme.glow;
            g.lineWidth = 4;
            g.beginPath(); g.moveTo(v.x - 14, v.y - 14); g.lineTo(v.x + 14, v.y + 14); g.moveTo(v.x + 14, v.y - 14); g.lineTo(v.x - 14, v.y + 14); g.stroke();
          }
          for (const gl of pw.glyphs || []) {
            ring(gl.x, gl.y, 26, theme.gold, gl.done ? 2 : 4, gl.done ? 0.4 : 0.95);
            ticks(gl.x, gl.y, 26, 8, 6, theme.gold, 2);
          }
          if (pw.beat && pw.phase === 'active') {
            const ph = pw.beat.phase;
            const near = Math.min(ph, 1 - ph) <= pw.beat.window;
            ring(c0.x, c0.y, c0.r + 10 + (1 - ph) * 30, near ? theme.gold : theme.paper, near ? 5 : 2, 0.9);
            label(`${pw.beat.pumps}/${pw.beat.needed}`, c0.x, c0.y - c0.r - 50, { size: 16, color: theme.gold, font: theme.fontNum });
          }
          if (pw.counter === 'step' && pw.heat > 0.02) {
            g.strokeStyle = theme.danger;
            g.lineWidth = 6;
            g.beginPath();
            g.arc(c0.x, c0.y, c0.r + 24, Math.PI * 0.75, Math.PI * 0.75 + Math.min(1, pw.heat) * Math.PI * 1.5);
            g.stroke();
          }
        }

        // Steering gauge above the reel button.
        const c = buttonCentre();
        const w = 70;
        g.globalAlpha = 0.8;
        g.strokeStyle = theme.paper;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(c.x - w, c.y - c.r - 22); g.lineTo(c.x + w, c.y - c.r - 22); g.stroke();
        const good = f.good > 0;
        g.fillStyle = good ? theme.glow : (f.good < 0 ? theme.danger : theme.paper);
        g.beginPath(); g.arc(c.x + f.steer * w, c.y - c.r - 22, 7, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
    },
  };
}
