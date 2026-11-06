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

  return {
    main,
    root,
    buttonCentre,
    setMainLabel(text, { hidden = false, ariaLabel } = {}) {
      if (main.textContent !== text) main.textContent = text;
      main.style.display = hidden ? 'none' : '';
      main.setAttribute('aria-label', ariaLabel || text);
    },
    setMainPressed(on) { main.setAttribute('aria-pressed', on ? 'true' : 'false'); },
    showMeters(on) { meters.style.display = on ? 'flex' : 'none'; },
    setMeters(tension, stamina, { danger = false } = {}) {
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

      // Slingshot band from the cast button to the thumb.
      const a = frame.aim;
      if (a) {
        const c = buttonCentre();
        const px = c.x + a.drag.x, py = c.y + a.drag.y;
        const inDead = a.dragLength <= a.deadZone;
        const col = inDead ? theme.danger : theme.paper;
        const nx = -a.drag.y / (a.dragLength || 1), ny = a.drag.x / (a.dragLength || 1);
        g.strokeStyle = col;
        g.lineWidth = 3;
        g.globalAlpha = 0.9;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(c.x + nx * c.r * 0.55 * s, c.y + ny * c.r * 0.55 * s);
          g.lineTo(px, py);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = col;
        g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
        // Power ring around the button.
        const p = Math.min(1, Math.max(0, (a.dragLength - a.deadZone) / (a.maxDrag - a.deadZone)));
        g.strokeStyle = theme.gold;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(c.x, c.y, c.r + 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        g.stroke();
        if (inDead) {
          ring(c.x, c.y, a.deadZone, theme.danger, 1.5, 0.6);
          label(a.hasAim ? 'Release to cancel' : 'Pull back to aim', c.x - c.r - 6, c.y - c.r - 24, { size: 14, align: 'right', font: theme.fontBody });
        }
        if (a.reticle && a.hasAim) {
          const txt = a.valid ? `${a.band}  ${a.depth.toFixed(1)} m${a.fish ? `  ·  ${a.fish} fish` : ''}` : 'No water there';
          label(txt, a.reticle.x, a.reticle.y + 44, { size: 15, color: a.valid ? theme.paper : theme.danger, font: theme.fontNum });
          if (a.perfect) label('Perfect', a.reticle.x, a.reticle.y - 46, { size: 16, color: theme.gold });
        }
      }

      // Bite: a pulsing ring over the lure that shrinks with the hook window.
      const b = frame.bite;
      if (b) {
        const k = Math.max(0, b.remaining / b.window);
        ring(b.x, b.y, 18 + 26 * k, theme.gold, 4, 0.95);
        label('!', b.x, b.y - 2, { size: 28, color: theme.gold });
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
        if (f.bowWindow && f.fish) {
          ring(f.fish.x, f.fish.y, 34, theme.gold, 4, 0.95);
          label('Bow!', f.fish.x, f.fish.y - 52, { size: 20, color: theme.gold });
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
