// Angled top-down follow camera. Looks north into the cove (like the key art).
// Framing is defined by how many metres must stay visible, so portrait and landscape both work.
import * as THREE from 'three';

// Pitch 45–50° (Casper 9b.5: the player must read as a person, not a hat) and close framing.
const MODES = {
  explore: { pitch: 48, width: 12.5, height: 14, lead: 1.8, ease: 4.5 },
  aim: { pitch: 55, width: 15.5, height: 17, lead: 0, ease: 2.2 },
  wait: { pitch: 51, width: 14.5, height: 16, lead: 0, ease: 2.0 },
  fight: { pitch: 50, width: 16.5, height: 18, lead: 0, ease: 2.6 },
  catch: { pitch: 40, width: 7.5, height: 8.5, lead: 0.3, ease: 5.5 },
  build: { pitch: 64, width: 22, height: 24, lead: 0, ease: 2.5 },
};

export function createCameraRig({ fov = 45 } = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 320);
  const target = new THREE.Vector3();
  const focus = new THREE.Vector3();     // where the camera wants to look (set by game systems)
  const shakeOffset = new THREE.Vector3();
  let pitch = MODES.explore.pitch;
  let width = MODES.explore.width;
  let height = MODES.explore.height;
  let mode = 'explore';
  let shake = 0;
  const timedShakes = []; // { amp, dur, t }
  let aspect = 1;
  let snapNext = true;

  function distanceFor(w, h) {
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ht = vt * aspect;
    return Math.max(w / (2 * ht), h / (2 * vt));
  }

  return {
    camera,
    target,
    get mode() { return mode; },
    setMode(next) { if (MODES[next]) mode = next; },
    setAspect(a) { aspect = a; camera.aspect = a; camera.updateProjectionMatrix(); },
    // Point of interest on the ground: player, or player↔lure, or player↔fish.
    setFocus(x, y, z) { focus.set(x, y, z); },
    snap() { snapNext = true; },
    shake(amount) { shake = Math.min(1.2, shake + amount); },
    // Additive shake that decays over `seconds` (state.render.shake for effects).
    shakeFor(amp, seconds = 0.4) { timedShakes.push({ amp: Math.max(0, Number(amp) || 0), dur: Math.max(0.05, Number(seconds) || 0.4), t: 0 }); },
    update(realDt) {
      const m = MODES[mode];
      const k = snapNext ? 1 : 1 - Math.exp(-m.ease * realDt);
      const desired = new THREE.Vector3(focus.x, focus.y, focus.z + m.lead);
      target.lerp(desired, k);
      const ka = snapNext ? 1 : 1 - Math.exp(-2.2 * realDt);
      pitch += (m.pitch - pitch) * ka;
      width += (m.width - width) * ka;
      height += (m.height - height) * ka;
      snapNext = false;

      const dist = distanceFor(width, height);
      const pr = THREE.MathUtils.degToRad(pitch);
      shake = Math.max(0, shake - realDt * 2.5);
      let timed = 0;
      for (let i = timedShakes.length - 1; i >= 0; i--) {
        const ts = timedShakes[i];
        ts.t += realDt;
        if (ts.t >= ts.dur) { timedShakes.splice(i, 1); continue; }
        timed += ts.amp * (1 - ts.t / ts.dur);
      }
      const s = shake * shake * 0.25 + Math.min(1.5, timed) * 0.35;
      shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      camera.position.set(target.x, target.y + Math.sin(pr) * dist, target.z + Math.cos(pr) * dist).add(shakeOffset);
      camera.lookAt(target.x + shakeOffset.x * 0.5, target.y, target.z + shakeOffset.z * 0.5);
      camera.updateMatrixWorld();
    },
  };
}
