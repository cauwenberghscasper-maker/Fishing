// Adaptive quality. Steps down bloom → shadows → resolution when frames are slow,
// and climbs back carefully when there is headroom. `?quality=high|medium|low|lowest`
// pins a level (screenshots, testing).
export const QUALITY_LEVELS = [
  { name: 'lowest', bloom: false, shadows: false, shadowMap: 1024, scale: 0.75 },
  { name: 'low', bloom: false, shadows: false, shadowMap: 1024, scale: 1 },
  { name: 'medium', bloom: false, shadows: true, shadowMap: 1536, scale: 1 },
  { name: 'high', bloom: true, shadows: true, shadowMap: 2048, scale: 1 },
];

export function createQuality({ pipeline, onChange }) {
  const pinnedName = new URLSearchParams(location.search).get('quality');
  const pinnedIndex = QUALITY_LEVELS.findIndex((q) => q.name === pinnedName);
  let level = pinnedIndex >= 0 ? pinnedIndex : QUALITY_LEVELS.length - 1;
  let pinned = pinnedIndex >= 0;

  let windowTime = 0;
  let windowFrames = 0;
  let goodStreak = 0;
  let warmup = 2.5; // seconds ignored after start/level change (shader compiles, loading)
  let climbs = 0;

  function apply() {
    const q = QUALITY_LEVELS[level];
    pipeline.setBloom(q.bloom);
    pipeline.setShadows(q.shadows, q.shadowMap);
    pipeline.setResolutionScale(q.scale);
    onChange?.(q);
  }

  function setLevel(next) {
    next = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, next));
    if (next === level) return;
    level = next;
    windowTime = windowFrames = goodStreak = 0;
    warmup = 2;
    apply();
  }

  apply();

  return {
    get level() { return QUALITY_LEVELS[level]; },
    pin(name) {
      const i = QUALITY_LEVELS.findIndex((q) => q.name === name);
      if (i < 0) { pinned = false; return; }
      pinned = true;
      setLevel(i);
    },
    update(realDt) {
      if (pinned || document.hidden) return;
      if (warmup > 0) { warmup -= realDt; return; }
      windowTime += realDt;
      windowFrames++;
      if (windowTime < 2) return;
      const avgMs = (windowTime / windowFrames) * 1000;
      windowTime = windowFrames = 0;
      if (avgMs > 22 && level > 0) {
        setLevel(level - 1);
        goodStreak = 0;
      } else if (avgMs < 13) {
        goodStreak++;
        // Climbing back is slower each time so a borderline device does not oscillate.
        if (goodStreak >= 4 + climbs * 4 && level < QUALITY_LEVELS.length - 1) {
          climbs++;
          setLevel(level + 1);
        }
      } else {
        goodStreak = 0;
      }
    },
  };
}
