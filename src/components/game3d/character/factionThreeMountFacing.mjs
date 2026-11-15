// Clone Game 3D: Faction 3 #160 asset facing calibration.
// Three.js locomotion uses +Z as forward. The uploaded GLB can be authored on
// a different horizontal axis; rotating the GAMEPLAY root would make following
// and mounted rider transforms fight each other. Rotate only its visual child.
//
// The original skin, animation clip bindings, player yaw and world navigation
// remain untouched. This module is intentionally a no-op for all other mounts.
import * as THREE from 'three';
import { isFactionThreeMount } from './factionThreeMountRig.mjs';

const boneKey = name => String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function findBone(root, wanted) {
  let result = null;
  root?.traverse?.(node => {
    if (!result && node.isBone && boneKey(node.name) === wanted) result = node;
  });
  return result;
}

/** Returns the one-time visual yaw needed to point the actual nose toward +Z. */
export function factionThreeVisualFacingYaw(model, definition = {}) {
  if (!model || !isFactionThreeMount(definition)) return 0;
  model.updateWorldMatrix(true, true);
  // Faction 3 #160 has independent head/neck and tail animation. Head-to-
  // pelvis is not a stable anatomical forward axis for this imported rig:
  // the head can sit laterally to the pelvis, making a galloping tiger appear
  // to run 90 degrees sideways. The paired shoulder and hip joints instead
  // define the actual longitudinal body axis in the original bind pose.
  const frontLeft = findBone(model, 'front.l.upper');
  const frontRight = findBone(model, 'front.r.upper');
  const hindLeft = findBone(model, 'hind.l.upper');
  const hindRight = findBone(model, 'hind.r.upper');
  const center = (a, b) => a.getWorldPosition(new THREE.Vector3())
    .add(b.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
  const front = frontLeft && frontRight && hindLeft && hindRight
    ? center(frontLeft, frontRight).sub(center(hindLeft, hindRight))
    : new THREE.Vector3();
  front.y = 0;
  // A missing or degenerate leg chain falls back to the previous head/pelvis
  // measurement. Neither path guesses a fixed +/-90-degree asset offset.
  if (front.lengthSq() < 1e-6) {
    const head = findBone(model, 'head'), pelvis = findBone(model, 'pelvis');
    if (!head || !pelvis) return 0;
    front.copy(head.getWorldPosition(new THREE.Vector3())
      .sub(pelvis.getWorldPosition(new THREE.Vector3())));
    front.y = 0;
  }
  if (front.lengthSq() < 1e-6) return 0;
  // yaw=atan2(x,z) matches GameWorld3D/CompanionAISystem movement bearing.
  // Measure once before the mixer starts; never correct every rendered frame.
  return -Math.atan2(front.x, front.z);
}

/**
 * Keep worldRoot facing/yaw in game coordinates; only the inner presentation
 * rotates to compensate for #160's anatomical forward. AnimationMixer should
 * continue targeting visualRoot, not the outer gameplay transform.
 */
export function createFactionThreeFacingFrame(visualRoot, definition = {}) {
  if (!isFactionThreeMount(definition)) {
    return { worldRoot: visualRoot, visualRoot, correctionYaw: 0 };
  }
  const correctionYaw = factionThreeVisualFacingYaw(visualRoot, definition);
  const worldRoot = new THREE.Group();
  worldRoot.name = 'Game3DFactionThreeWorldRoot';
  const visualFrame = new THREE.Group();
  visualFrame.name = 'Game3DFactionThreeForwardCorrection';
  visualFrame.rotation.y = correctionYaw;
  visualFrame.add(visualRoot);
  worldRoot.add(visualFrame);
  worldRoot.userData.mountVisualYawCorrection = correctionYaw;
  return { worldRoot, visualRoot, correctionYaw };
}
