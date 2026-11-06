// Sun, sky fill and fog, with a time-of-day blend. Default: golden afternoon like the key art.
import * as THREE from 'three';

// hour, sun azimuth (rad, 0 = north, clockwise), elevation (rad), sun colour, sun intensity,
// hemisphere sky/ground, water light level, fog colour.
const KEYS = [
  { h: 0, az: 3.6, el: 0.75, sun: '#6f8fd8', si: 0.55, sky: '#28465e', ground: '#10161c', hi: 0.55, light: 0.32, fog: '#0a2427' },
  { h: 5.5, az: 1.4, el: 0.08, sun: '#ff9a6a', si: 1.1, sky: '#6d7fa6', ground: '#3a2a2a', hi: 0.75, light: 0.55, fog: '#2a4a52' },
  { h: 8, az: 1.75, el: 0.5, sun: '#ffd9a8', si: 2.4, sky: '#a8d8e0', ground: '#5a4430', hi: 1.0, light: 0.9, fog: '#2a6a62' },
  { h: 12.5, az: 3.3, el: 1.0, sun: '#fff0d6', si: 2.9, sky: '#a8dae0', ground: '#6a5034', hi: 1.05, light: 1.05, fog: '#246a62' },
  { h: 16.5, az: 4.05, el: 0.62, sun: '#ffcf8a', si: 3.0, sky: '#9fd2d6', ground: '#5a3d22', hi: 1.05, light: 1.0, fog: '#1c5a52' },
  { h: 19, az: 4.5, el: 0.16, sun: '#ff8f4a', si: 2.0, sky: '#c88c78', ground: '#3a2418', hi: 0.8, light: 0.68, fog: '#2a3c44' },
  { h: 20.5, az: 4.7, el: 0.02, sun: '#d0607a', si: 0.8, sky: '#5a5a86', ground: '#1e1620', hi: 0.6, light: 0.42, fog: '#14282e' },
  { h: 24, az: 3.6, el: 0.75, sun: '#6f8fd8', si: 0.55, sky: '#28465e', ground: '#10161c', hi: 0.55, light: 0.32, fog: '#0a2427' },
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
