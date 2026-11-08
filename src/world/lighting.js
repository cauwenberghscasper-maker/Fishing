// Sun, sky fill and fog, with a time-of-day blend. Default: golden afternoon like the key art.
import * as THREE from 'three';

// hour, sun azimuth (rad, 0 = north, clockwise), elevation (rad), sun colour, sun intensity,
// hemisphere sky/ground, water light level, fog colour.
// Every hour stays readable on a phone (9b.8): moody at night, never muddy. Night is moonlit
// teal-blue with a strong sky fill; dusk keeps warm sand. `exp` lifts the tone curve.
const KEYS = [
  { h: 0, az: 3.6, el: 0.85, sun: '#a4bcff', si: 1.5, sky: '#6c9ae6', ground: '#4a5a7c', hi: 3.0, light: 0.6, fog: '#173c46', exp: 1.25 },
  { h: 5.5, az: 1.4, el: 0.1, sun: '#ffb08a', si: 1.6, sky: '#b4bcd8', ground: '#7a6660', hi: 2.6, light: 0.78, fog: '#3a5a62', exp: 1.12 },
  { h: 8, az: 1.75, el: 0.5, sun: '#ffdcb0', si: 2.6, sky: '#b0dce2', ground: '#8a6a48', hi: 1.9, light: 0.95, fog: '#2a6a62', exp: 1.0 },
  { h: 12.5, az: 3.3, el: 1.0, sun: '#fff0d6', si: 2.9, sky: '#acdce2', ground: '#8a6a44', hi: 1.85, light: 1.05, fog: '#246a62', exp: 1.0 },
  { h: 16.5, az: 4.05, el: 0.62, sun: '#ffcf8a', si: 3.0, sky: '#a8d6d8', ground: '#8a6038', hi: 1.85, light: 1.0, fog: '#1c5a52', exp: 1.0 },
  { h: 18.8, az: 4.45, el: 0.2, sun: '#ffa060', si: 2.7, sky: '#e2b4a0', ground: '#8a6248', hi: 2.3, light: 0.88, fog: '#3a4c52', exp: 1.05 },
  { h: 20.3, az: 4.7, el: 0.05, sun: '#ff9a84', si: 1.6, sky: '#a898d0', ground: '#6a5a78', hi: 2.8, light: 0.72, fog: '#26404e', exp: 1.15 },
  { h: 24, az: 3.6, el: 0.85, sun: '#a4bcff', si: 1.5, sky: '#6c9ae6', ground: '#4a5a7c', hi: 3.0, light: 0.6, fog: '#173c46', exp: 1.25 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function lerpKey(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const mixC = (ka, kb, out) => out.copy(tmpA.set(ka)).lerp(tmpB.set(kb), t);
  let daz = b.az - a.az;
  if (daz > Math.PI) daz -= Math.PI * 2;
  if (daz < -Math.PI) daz += Math.PI * 2;
  return {
    az: a.az + daz * t,
    el: a.el + (b.el - a.el) * t,
    si: a.si + (b.si - a.si) * t,
    hi: a.hi + (b.hi - a.hi) * t,
    exp: (a.exp ?? 1) + ((b.exp ?? 1) - (a.exp ?? 1)) * t,
    light: a.light + (b.light - a.light) * t,
    mixC,
    a, b,
  };
}

export function createLighting({ scene, palette }) {
  const hemi = new THREE.HemisphereLight(palette.sky, palette.ground, palette.hemiIntensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(palette.sun, palette.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
  scene.add(sun);
  scene.add(sun.target);

  scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity);
  scene.background = new THREE.Color(palette.background);

  const sunDir = new THREE.Vector3();
  const sunColor = new THREE.Color();
  const fogColor = new THREE.Color();
  let light = 1;
  let hour = 16.5;
  let exposure = 1;

  function apply() {
    const k = lerpKey(hour);
    sunDir.set(Math.sin(k.az) * Math.cos(k.el), Math.sin(k.el), -Math.cos(k.az) * Math.cos(k.el)).normalize();
    k.mixC(k.a.sun, k.b.sun, sun.color);
    sun.intensity = k.si;
    k.mixC(k.a.sky, k.b.sky, hemi.color);
    k.mixC(k.a.ground, k.b.ground, hemi.groundColor);
    hemi.intensity = k.hi;
    k.mixC(k.a.fog, k.b.fog, fogColor);
    scene.fog.color.copy(fogColor);
    scene.background.copy(fogColor).multiplyScalar(0.55);
    light = k.light;
    exposure = k.exp;
    sunColor.copy(sun.color).multiplyScalar(Math.max(0.2, k.si / 3));
  }
  apply();

  const snap = new THREE.Vector3();
  return {
    sun,
    hemi,
    sunDir,
    sunColor,
    get light() { return light; },
    get exposure() { return exposure; },
    get hour() { return hour; },
    setHour(h) { hour = ((h % 24) + 24) % 24; apply(); },
    // Night factor 0..1 (fish glow, dusk-only accents).
    get dusk() {
      const h = hour;
      if (h >= 18.5 || h < 5.5) return 1;
      if (h > 17) return (h - 17) / 1.5;
      if (h < 7) return 1 - (h - 5.5) / 1.5;
      return 0;
    },
    // Shadow camera follows the view; snapped to texels so shadows do not shimmer.
    follow(target) {
      const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
      snap.set(Math.round(target.x / texel) * texel, 0, Math.round(target.z / texel) * texel);
      sun.target.position.copy(snap);
      sun.position.copy(snap).addScaledVector(sunDir, 50);
      sun.target.updateMatrixWorld();
    },
  };
}
