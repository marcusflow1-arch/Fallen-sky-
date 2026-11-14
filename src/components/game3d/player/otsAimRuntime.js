// Per-frame OTS housekeeping: gamepad trigger polling, HUD state, and the
// centre-screen ray that says where a shot from this camera lands.
import * as THREE from 'three';
import { OTS_AIM, castAimReticleRay } from './otsAim.mjs';
import { publishOTSAim, setOTSAimRay } from './otsAimStore';

const raycaster = new THREE.Raycaster();

export function updateOTSAimFrame({ camera, aim, colliders, extraMeshes = [], bowEquipped = false, blocked = false }) {
  if (!aim) return null;
  aim.pollGamepad();
  publishOTSAim({ aiming: aim.aiming, side: aim.side, bowEquipped, blocked });
  if (aim.blend <= 0.02 || !camera) {
    setOTSAimRay(null);
    return null;
  }
  const ray = castAimReticleRay({
    camera,
    meshes: [...(colliders || []), ...extraMeshes.filter(Boolean)],
    raycaster,
    maxRange: OTS_AIM.reticleRange,
  });
  setOTSAimRay(ray);
  return ray;
}