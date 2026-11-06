// Frame loop with a world time scale (aim mode slows the world to ~25%).
// Systems register update(dt, realDt, time) and run in registration order.
export function createLoop({ maxDt = 1 / 20 } = {}) {
  const systems = [];
  let timeScale = 1;
  let targetScale = 1;
  let scaleEase = 8;
  let worldTime = 0;
  let realTime = 0;
  let last = 0;
  let running = false;
  let rafId = 0;
  const frameHooks = [];
  // Effect slow-mo (powers, big moments) multiplies on top of the aim-mode scale.
  let slowScale = 1;
  let slowHold = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const realDt = Math.min(maxDt, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    // Ease the time scale so slow-motion fades in and out instead of snapping.
    timeScale += (targetScale - timeScale) * (1 - Math.exp(-scaleEase * realDt));
    if (Math.abs(targetScale - timeScale) < 0.002) timeScale = targetScale;
    if (slowHold > 0) slowHold -= realDt;
    else slowScale += (1 - slowScale) * (1 - Math.exp(-6 * realDt));
    if (Math.abs(1 - slowScale) < 0.002) slowScale = 1;
    const dt = realDt * timeScale * slowScale;
    worldTime += dt;
    realTime += realDt;
    for (const s of systems) s.update(dt, realDt, worldTime);
    for (const fn of frameHooks) fn(realDt, now);
  }

  return {
    add(system) { systems.push(system); return system; },
    onFrame(fn) { frameHooks.push(fn); },
    setTimeScale(scale, ease = 8) { targetScale = scale; scaleEase = ease; },
    get timeScale() { return timeScale * slowScale; },
    slowmo(scale, seconds) {
      slowScale = Math.max(0.02, Math.min(1, Number(scale) || 1));
      slowHold = Math.max(0, Number(seconds) || 0);
    },
    get time() { return worldTime; },
    get realTime() { return realTime; },
    start() {
      if (running) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(rafId); },
  };
}
