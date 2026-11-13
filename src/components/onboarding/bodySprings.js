// Spring-driven secondary motion for the existing fused female creator body.
// Reuses the authored CC_ChestSize / CC_GluteSize sculpt envelopes and their
// current skinned vertices. Adds four tiny *runtime-only* per-side shape deltas
// rather than guessing bones or scaling the torso. The original GLBs, clothing,
// material maps, skeleton and persistent creator sliders are untouched.
//
// The cosmetic controller is hooked beside hairSprings at scene render time,
// after the animation pose and world transform have been updated. This also
// allows the exact same bounded effect in creator orbit and Game 3D Play.
import * as THREE from 'three';
import {
  createBodySpringState, bodySpringVertexWeight,
  clearBodySpringState, stepBodySpring,
} from './bodySpringMotion.mjs';

const controllers = new Set();
const hookedScenes = new WeakSet();
const scratchPosition = new THREE.Vector3();
const scratchQuat = new THREE.Quaternion();
const scratchYaw = new THREE.Euler(0, 0, 0, 'YXZ');
const scratchCameraQuat = new THREE.Quaternion();
const scratchCameraRight = new THREE.Vector3();
const BODY_SPRING_PREFIX = 'AXE_BodySpring_';
export const BODY_SPRING_AMPLITUDES = Object.freeze({ chest: .045, glutes: .038 });

const findBone = (root, suffix) => {
  let found = null;
  root.traverse(node => {
    if (found || !node.isBone || node.userData?.creatorLayerBone) return;
    if (node.name === 'mixamorig:' + suffix ||
        node.name === 'mixamorig' + suffix ||
        node.name.endsWith(':' + suffix)) found = node;
  });
  return found;
};

function bodyFrame(root, mesh) {
  const hips = findBone(root, 'Hips');
  const head = findBone(root, 'Head');
  const shoulderA = findBone(root, 'LeftArm');
  const shoulderB = findBone(root, 'RightArm');
  if (!hips || !head || !shoulderA || !shoulderB) return null;
  root.updateMatrixWorld(true);
  const toLocal = bone => mesh.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const origin = toLocal(hips), crown = toLocal(head);
  const up = crown.sub(origin).normalize();
  const right = toLocal(shoulderB).sub(toLocal(shoulderA)).normalize();
  const unit = origin.distanceTo(toLocal(head));
  if (!(unit > .25) || up.lengthSq() < .95 || right.lengthSq() < .95) return null;
  // Orthogonalize: GLB rest shoulders can slope down in the standing A-pose.
  right.addScaledVector(up, -right.dot(up)).normalize();
  return { origin, up, right, unit };
}

function addRuntimeShapes(mesh, frame) {
  const g = mesh.geometry, positions = g?.attributes?.position;
  const morphs = g?.morphAttributes?.position, dict = mesh.morphTargetDictionary;
  if (!mesh.isSkinnedMesh || mesh.userData?.creatorLayer ||
      !positions || !Array.isArray(morphs) || !g.morphTargetsRelative ||
      !dict || !Array.isArray(mesh.morphTargetInfluences)) return [];
  const sourceDefs = [
    { region: 'chest', source: 'CC_ChestSize', sides: [-1, 1] },
    { region: 'glutes', source: 'CC_GluteSize', sides: [-1, 1] },
  ];
  const result = [];
  // The GLB loader creates unique meshes per character. If this same geometry
  // is referenced by another mesh, the geometry's own morph list can already
  // contain our named targets; reuse, do not append duplicate GPU attributes.
  for (const {region, source, sides} of sourceDefs) {
    const index = dict[source];
    const sculpt = Number.isInteger(index) ? morphs[index] : null;
    if (!sculpt || sculpt.count !== positions.count) continue;
    let peak = 0;
    for (let i = 0; i < sculpt.count; i++) {
      const d = Math.hypot(sculpt.getX(i), sculpt.getY(i), sculpt.getZ(i));
      if (Number.isFinite(d) && d > peak) peak = d;
    }
    if (peak < 1e-6) continue;
    for (const side of sides) {
      const baseName = BODY_SPRING_PREFIX + region +
        (side < 0 ? 'Left' : 'Right');
      // A lateral + vertical pair traces a bounded 360-degree ellipse when
      // the two spring components are driven in quadrature. No torso/hip
      // rotations, extra rig bones, or saved slider values are introduced.
      for (const axis of ['lateral', 'vertical']) {
        const name = baseName + '_' + axis;
        let targetIndex = dict[name];
        if (!Number.isInteger(targetIndex))
          targetIndex = morphs.findIndex(attribute => attribute.name === name);
        if (!Number.isInteger(targetIndex) || targetIndex < 0) {
          const output = new Float32Array(positions.count * 3);
          let weightedVertices = 0;
          const pos = new THREE.Vector3(), relative = new THREE.Vector3();
          const direction = axis === 'lateral' ? frame.right : frame.up;
          const amplitude = frame.unit * BODY_SPRING_AMPLITUDES[region] *
            (axis === 'vertical' ? .72 : 1);
          for (let i = 0; i < positions.count; i++) {
            const mag = Math.hypot(sculpt.getX(i), sculpt.getY(i), sculpt.getZ(i));
            if (!Number.isFinite(mag) || mag < peak * .015) continue;
            pos.fromBufferAttribute(positions, i);
            relative.copy(pos).sub(frame.origin);
            const lateral = relative.dot(frame.right) / frame.unit;
            const height = relative.dot(frame.up) / frame.unit;
            const weight = bodySpringVertexWeight({
              region, side, lateral, height, sculptFraction: mag / peak,
            });
            if (weight < .001) continue;
            output[i * 3] = direction.x * amplitude * weight;
            output[i * 3 + 1] = direction.y * amplitude * weight;
            output[i * 3 + 2] = direction.z * amplitude * weight;
            weightedVertices++;
          }
          if (weightedVertices < 8) continue;
          const attribute = new THREE.Float32BufferAttribute(output, 3);
          attribute.name = name;
          targetIndex = morphs.length;
          morphs.push(attribute);
        }
        dict[name] = targetIndex;
        mesh.morphTargetInfluences[targetIndex] = 0;
        result.push({ mesh, index: targetIndex, axis,
          channel: region === 'chest' ? side < 0 ? 0 : 1 : side < 0 ? 2 : 3 });
      }
    }
  }
  return result;
}

class BodySpringController {
  constructor(root) {
    this.root = root;
    this.state = createBodySpringState();
    this.last = 0;
    this.bindings = [];
    root.traverse(node => {
      if (!node.isSkinnedMesh || node.userData?.creatorLayer) return;
      const frame = bodyFrame(root, node);
      if (frame) this.bindings.push(...addRuntimeShapes(node, frame));
    });
  }
  step(now, camera = null) {
    if (!this.bindings.length) return;
    const dt = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    this.root.getWorldPosition(scratchPosition);
    this.root.getWorldQuaternion(scratchQuat);
    scratchYaw.setFromQuaternion(scratchQuat, 'YXZ');
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    // The active camera supplies on-screen left/right, independently of
    // whether the character's animation turns to face its travel direction.
    // Camera +X in world space is horizontal screen-right. Do not write back
    // to camera, player movement, glute spring channels or network state.
    let cameraRight = null;
    if (camera?.isCamera && typeof camera.getWorldQuaternion === 'function') {
      camera.getWorldQuaternion(scratchCameraQuat);
      scratchCameraRight.set(1, 0, 0).applyQuaternion(scratchCameraQuat);
      scratchCameraRight.y = 0;
      if (scratchCameraRight.lengthSq() > 1e-6) {
        scratchCameraRight.normalize();
        cameraRight = scratchCameraRight;
      }
    }
    const values = stepBodySpring(this.state, {
      x: scratchPosition.x, z: scratchPosition.z,
      yaw: scratchYaw.y, dt, reducedMotion, cameraRight,
    });
    for (const binding of this.bindings) {
      const motion = binding.axis === 'vertical' ?
        this.state.verticalValues : values;
      binding.mesh.morphTargetInfluences[binding.index] = motion[binding.channel];
    }
  }
  dispose() {
    clearBodySpringState(this.state);
    for (const binding of this.bindings)
      binding.mesh.morphTargetInfluences[binding.index] = 0;
    this.bindings.length = 0;
  }
}
const sceneOf = node => {
  while (node?.parent) node = node.parent;
  return node?.isScene ? node : null;
};
function hookScene(scene) {
  if (hookedScenes.has(scene)) return;
  hookedScenes.add(scene);
  const previous = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    previous?.apply(this, args);
    const now = performance.now();
    // Scene.onBeforeRender receives (renderer, scene, camera, renderTarget).
    // Forward the actual Game 3D/Luna preview camera to the cosmetic springs.
    for (const ctrl of controllers) {
      if (sceneOf(ctrl.root) === scene) ctrl.step(now, args[2]);
    }
  };
}
export function ensureFemaleBodySprings(root) {
  if (!root) return null;
  const existing = root.userData?.axeFemaleBodySprings;
  if (existing) return existing;
  const ctrl = new BodySpringController(root);
  if (!ctrl.bindings.length) return null; // Missing sculpt/bones: fail closed.
  root.userData.axeFemaleBodySprings = ctrl;
  controllers.add(ctrl);
  root.traverse(node => {
    if (!node.isMesh || node.userData?.axeBodySpringHook) return;
    node.userData.axeBodySpringHook = true;
    const previous = node.onBeforeRender;
    node.onBeforeRender = function(renderer, scene, ...rest) {
      previous?.call(this, renderer, scene, ...rest);
      if (scene?.isScene) hookScene(scene);
    };
  });
  return ctrl;
}
export function disposeFemaleBodySprings(root) {
  const ctrl = root?.userData?.axeFemaleBodySprings;
  if (!ctrl) return;
  controllers.delete(ctrl);
  ctrl.dispose();
  delete root.userData.axeFemaleBodySprings;
}
