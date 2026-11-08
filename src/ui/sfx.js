// Agent B. Small synthesized UI sounds (Web Audio, no files): weight ticks, the stamp thud, coin clinks, a fanfare.
// Respects profile.settings.sound. The context starts on first use (after the player has touched the screen).
let ctx = null;
let master = null;
let enabled = () => true;

export function initSfx(isEnabled) { enabled = isEnabled; }

function ac() {
  if (!enabled()) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, { t = 0, dur = 0.15, type = 'sine', vol = 0.3, slide = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + t;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ t = 0, dur = 0.18, vol = 0.4, freq = 180 } = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + t;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tick: () => tone(1800 + Math.random() * 300, { dur: 0.03, type: 'square', vol: 0.05 }),
  thud: () => { noise({ dur: 0.22, vol: 0.9, freq: 140 }); tone(70, { dur: 0.2, type: 'sine', vol: 0.4, slide: -30 }); },
  coin: (t = 0) => { tone(2350, { t, dur: 0.18, vol: 0.12 }); tone(3520, { t: t + 0.03, dur: 0.22, vol: 0.08 }); },
  splash: () => noise({ dur: 0.35, vol: 0.35, freq: 900 }),
  creak: () => tone(220, { dur: 0.25, type: 'triangle', vol: 0.12, slide: -60 }),
  fanfare: (big = false) => {
    const notes = big ? [523, 659, 784, 1047, 1319] : [587, 740, 880];
    notes.forEach((f, i) => tone(f, { t: i * 0.09, dur: 0.32, type: 'triangle', vol: 0.14 }));
  },
  swell: () => { tone(110, { dur: 1.2, type: 'sawtooth', vol: 0.06, slide: 220 }); noise({ t: 0.05, dur: 0.9, vol: 0.25, freq: 2400 }); },
};
