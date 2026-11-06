// Rod + line + bobber for any angler (the player, co-op friends drawn by Agent H, hired workers).
// rig.update({ hand, yaw, pitch, bend, lure, tension }, dt, camera)
//   hand: Vector3 (world) where the rod is held; lure: Vector3 or null (line hidden).
import * as THREE from 'three';
import { createRod } from './rod.js';
import { createLine } from './line.js';
import { loadModel, pickAsset } from '../core/assets.js';

export function createAnglerRig({ under, surface, rodItemId = null, surfaceY = () => 0 }) {
  const rod = createRod();
  const line = createLine();
  under.add(rod.root);
  surface.add(line.mesh);
  rod.load(rodItemId);
  let bobber = null;
  const id = pickAsset('world', ['bobber', 'float']);
  if (id) {
    loadModel('world', id).then((m) => {
      if (!m) return;
      bobber = m.scene;
      bobber.visible = false;
      surface.add(bobber);
    });
  }
  const tip = new THREE.Vector3();
  let lineOn = false;

  return {
    rod,
    line,
    setRod(itemId) { return rod.load(itemId); },
    update({ hand, yaw = 0, pitch = 0.75, bend = 0.05, lure = null, tension = 0 }, dt, camera) {
      rod.pose(hand, yaw, pitch, bend, dt);
      rod.tipWorld(tip);
      if (lure && !lineOn) { line.show(tip, lure); lineOn = true; }
      if (!lure && lineOn) { line.hide(); lineOn = false; }
      if (lure) {
        line.setTension(tension);
        line.setLength(tip.distanceTo(lure) * (1.02 + (1 - tension) * 0.05));
        line.update(dt, tip, lure, camera, surfaceY);
      }
      if (bobber) {
        bobber.visible = Boolean(lure);
        if (lure) bobber.position.copy(lure);
      }
    },
    dispose() {
      rod.root.removeFromParent();
      line.mesh.removeFromParent();
      bobber?.removeFromParent();
    },
  };
}
