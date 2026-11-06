// Touch/mouse/keyboard input for walking. One pointer id per control:
// the first canvas pointer that drags becomes the floating joystick (left thumb),
// a short press without drag is a tap (tap-to-move). HUD buttons own their own pointers.
const JOY_RADIUS = 56;     // CSS px of full deflection
const DRAG_START = 9;      // px before a press turns into a joystick
const TAP_MAX_MS = 280;

export function createInput({ canvas, events }) {
  const joystick = { active: false, pointerId: null, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0 };
  const pending = new Map(); // pointerId -> { x, y, t }
  const keys = new Set();
  const tapHandlers = new Set();
  const keyHandlers = new Set();
  let enabled = true;
  let modalOpen = false;
  let lockedReasons = new Set();

  function updateEnabled() {
    const next = !modalOpen && lockedReasons.size === 0;
    if (next === enabled) return;
    enabled = next;
    if (!enabled) releaseAll();
  }

  function releaseAll() {
    joystick.active = false;
    joystick.pointerId = null;
    joystick.vx = joystick.vy = 0;
    pending.clear();
    keys.clear();
  }

  function onDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pending.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  }

  function onMove(e) {
    if (!enabled) return;
    if (joystick.active && e.pointerId === joystick.pointerId) {
      setStick(e.clientX, e.clientY);
      return;
    }
    const p = pending.get(e.pointerId);
    if (!p || joystick.active) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_START) {
      pending.delete(e.pointerId);
      joystick.active = true;
      joystick.pointerId = e.pointerId;
      joystick.ox = p.x;
      joystick.oy = p.y;
      setStick(e.clientX, e.clientY);
    }
  }

  function onUp(e) {
    if (joystick.active && e.pointerId === joystick.pointerId) {
      joystick.active = false;
      joystick.pointerId = null;
      joystick.vx = joystick.vy = 0;
      return;
    }
    const p = pending.get(e.pointerId);
    pending.delete(e.pointerId);
    if (!p || !enabled || e.type === 'pointercancel') return;
    if (performance.now() - p.t <= TAP_MAX_MS) {
      for (const fn of tapHandlers) fn({ x: e.clientX, y: e.clientY });
    }
  }

  function setStick(x, y) {
    let dx = x - joystick.ox;
    let dy = y - joystick.oy;
    const len = Math.hypot(dx, dy);
    // The origin follows the thumb when it overshoots, so direction changes stay responsive.
    if (len > JOY_RADIUS * 1.4) {
      const k = (len - JOY_RADIUS * 1.4) / len;
      joystick.ox += dx * k;
      joystick.oy += dy * k;
      dx = x - joystick.ox;
      dy = y - joystick.oy;
    }
    joystick.x = x;
    joystick.y = y;
    const m = Math.min(1, Math.hypot(dx, dy) / JOY_RADIUS);
    const a = Math.atan2(dy, dx);
    const dead = 0.12;
    const mag = m < dead ? 0 : (m - dead) / (1 - dead);
    joystick.vx = Math.cos(a) * mag;
    joystick.vy = Math.sin(a) * mag;
  }

  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  function onKeyDown(e) {
    if (modalOpen || e.repeat) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (enabled && KEYMAP[e.code]) keys.add(KEYMAP[e.code]);
    for (const fn of keyHandlers) fn(e.code, true, e);
  }
  function onKeyUp(e) {
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
    for (const fn of keyHandlers) fn(e.code, false, e);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.clear(); });

  events.on('ui:modal', ({ open } = {}) => { modalOpen = Boolean(open); updateEnabled(); });

  return {
    joystick,
    JOY_RADIUS,
    get enabled() { return enabled; },
    get modalOpen() { return modalOpen; },
    // Screen-space move vector (x right, y down), magnitude 0..1.
    moveVector() {
      if (!enabled) return { x: 0, y: 0 };
      if (joystick.active) return { x: joystick.vx, y: joystick.vy };
      let x = 0, y = 0;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (keys.has('up')) y -= 1;
      if (keys.has('down')) y += 1;
      const l = Math.hypot(x, y);
      return l ? { x: x / l, y: y / l } : { x: 0, y: 0 };
    },
    onTap(fn) { tapHandlers.add(fn); return () => tapHandlers.delete(fn); },
    onKey(fn) { keyHandlers.add(fn); return () => keyHandlers.delete(fn); },
    // Other systems (aim mode, fights) lock walking without touching the modal flag.
    lock(reason) { lockedReasons.add(reason); updateEnabled(); },
    unlock(reason) { lockedReasons.delete(reason); updateEnabled(); },
    isLocked(reason) { return lockedReasons.has(reason); },
  };
}
