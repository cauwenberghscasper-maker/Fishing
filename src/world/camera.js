// Angled top-down follow camera. Looks north into the cove (like the key art).
// Framing is defined by how many metres must stay visible, so portrait and landscape both work.
import * as THREE from 'three';

const MODES = {
  explore: { pitch: 55, width: 10.5, height: 13, lead: 2.2, ease: 4.5 },
  aim: { pitch: 62, width: 12.5, height: 14.5, lead: 0, ease: 2.2 },
  wait: { pitch: 58, width: 12, height: 14, lead: 0, ease: 2.0 },
  fight: { pitch: 57, width: 14, height: 16, lead: 0, ease: 2.6 },
  catch: { pitch: 50, width: 8.5, height: 10.5, lead: 0.5, ease: 3.0 },
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
      const s = shake * shake * 0.25;
      shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      camera.position.set(target.x, target.y + Math.sin(pr) * dist, target.z + Math.cos(pr) * dist).add(shakeOffset);
      camera.lookAt(target.x + shakeOffset.x * 0.5, target.y, target.z + shakeOffset.z * 0.5);
      camera.updateMatrixWorld();
    },
  };
}
