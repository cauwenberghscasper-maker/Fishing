// Tiny synthesized sound set (no files): splash, plop, nibble tick, bite thunk, reel clicks,
// line snap, catch chime. Starts after the first user gesture (browser autoplay rules).
let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

function noise(duration, { freq = 1200, q = 0.8, gain = 0.4, type = 'bandpass', sweepTo = null, attack = 0.005 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duration + 0.05);
}

function tone(freq, duration, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + duration + 0.05);
}

export const audio = {
  setMuted(m) { muted = m; },
  plop() { noise(0.25, { freq: 900, sweepTo: 300, gain: 0.35 }); tone(420, 0.12, { slideTo: 180, gain: 0.12 }); },
  splash(strength = 1) { noise(0.35 + strength * 0.25, { freq: 2200, sweepTo: 500, q: 0.5, gain: 0.25 + strength * 0.15, attack: 0.01 }); },
  nibble() { tone(260, 0.07, { type: 'triangle', slideTo: 200, gain: 0.08 }); },
  bite() {
    tone(150, 0.25, { type: 'triangle', slideTo: 70, gain: 0.35 });
    noise(0.5, { freq: 1800, sweepTo: 400, q: 0.6, gain: 0.5 });
  },
  hook() { tone(520, 0.08, { type: 'square', gain: 0.06 }); tone(780, 0.14, { type: 'triangle', gain: 0.1, delay: 0.05 }); },
  reelTick(tension) { tone(1800 + tension * 900, 0.018, { type: 'square', gain: 0.025 }); },
  snap() { noise(0.16, { freq: 4000, type: 'highpass', gain: 0.5 }); tone(900, 0.2, { type: 'sawtooth', slideTo: 120, gain: 0.08 }); },
  // Rope creak as the cast is drawn back (step 1..4).
  creak(step) { tone(180 + step * 45, 0.07, { type: 'triangle', slideTo: 150 + step * 40, gain: 0.03 + step * 0.008 }); noise(0.06, { freq: 700 + step * 150, q: 4, gain: 0.04 }); },
  hammer() { tone(220 + Math.random() * 60, 0.06, { type: 'square', slideTo: 120, gain: 0.05 }); noise(0.05, { freq: 2500, q: 2, gain: 0.08 }); },
  tick() { tone(1400, 0.03, { type: 'sine', gain: 0.04 }); },
  perfect() { tone(1046, 0.25, { gain: 0.08 }); tone(1568, 0.35, { gain: 0.06, delay: 0.06 }); },
  catchChime() {
    // Sea-glass chime: a rising fifth and octave.
    [523.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.09, delay: i * 0.09 }));
  },
  lost() { tone(330, 0.3, { type: 'triangle', slideTo: 196, gain: 0.08 }); },
};
