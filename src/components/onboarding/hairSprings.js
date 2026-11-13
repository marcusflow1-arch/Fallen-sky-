// VRM-style spring bones for the fused characters' hair (tools/avatar-fuse
// builds the chains: bones named Hair_<style>_S<sector>_<joint>, parented to
// mixamorig:Head). Each joint keeps its tail position from the last frame and
// moves it by inertia, a pull back toward its rest direction, and gravity,
// then is pushed out of sphere colliders placed on the head, neck, torso,
// shoulders and arms. Because the chains hang from the Head bone, hair turns
// with the head and swings after it; the colliders stop it passing through
// the chest, shoulders and arms in any pose or animation.
//
// The step runs from scene.onBeforeRender: after the animation mixer and
// updateMatrixWorld, before the skeletons upload their matrices.
import * as THREE from 'three';

const CHAIN_BONE = /^Hair_[A-Za-z0-9_]+_S\d+_\d+$/;
const controllers = new Set();
const hookedScenes = new WeakSet();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export const HAIR_SPRING_SETTINGS = {
  stiffness: 1.8,      // pull toward the rest direction (per second)
  drag: 0.5,           // 0 = no damping, 1 = no inertia
  gravity: 0.35,       // world units per second, downwards
  hitRadius: 0.035,    // of the hips->head distance
};

// Colliders as [bone, radius × U, optional second bone for a midpoint], U = hips→head distance.
const COLLIDERS = [
  ['Head', 0.0, 'HeadTop_End', 'head'], ['Neck', 0.13],
  ['Spine2', 0.27], ['Spine1', 0.26], ['Spine', 0.25],
  ['LeftShoulder', 0.12], ['RightShoulder', 0.12],
  ['LeftArm', 0.13], ['RightArm', 0.13],
  ['LeftArm', 0.1, 'LeftForeArm'], ['RightArm', 0.1, 'RightForeArm'],
  ['LeftForeArm', 0.08], ['RightForeArm', 0.08],
];

function findBone(root, suffix) {
  let hit = null;
  root.traverse((n) => {
    if (!hit && n.isBone && !n.userData?.creatorLayerBone && (n.name === 'mixamorig' + suffix || n.name === 'mixamorig:' + suffix || n.name.endsWith(':' + suffix)))
      hit = n;
  });
  return hit;
}

class HairSpringController {
  constructor(root) {
    this.root = root;
    this.joints = [];
    this.colliders = [];
    this.last = 0;
    this.lastRootPos = new THREE.Vector3();
    root.updateMatrixWorld(true);
    this.hips = findBone(root, 'Hips'); this.head = findBone(root, 'Head');
    // The face: an ellipsoid-ish pair of spheres in front of the eyes and
    // cheeks, so front locks rest beside the face and fall to the shoulders
    // instead of across the eyes. Facing is measured once in the head's frame.
    this.headTop = findBone(root, 'HeadTop_End');
    if (this.head && this.headTop) {
      const fwdWorld = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld);
      this.faceFwd = fwdWorld.applyQuaternion(this.head.getWorldQuaternion(new THREE.Quaternion()).invert());
      for (const [up, ahead, rad] of [[0.4, 0.2, 0.52], [0.12, 0.22, 0.5]])
        this.colliders.push({ face: true, up, ahead, radius: rad, pos: new THREE.Vector3(), r: 0 });
    }
    for (const spec of COLLIDERS) {
      const a = findBone(root, spec[0]), b = spec[2] ? findBone(root, spec[2]) : null;
      if (!a || (spec[2] && !b)) continue;
      this.colliders.push({ a, b, radius: spec[1], head: spec[3] === 'head', pos: new THREE.Vector3(), r: 0 });
    }
    const bones = [];
    root.traverse((n) => { if (n.isBone && CHAIN_BONE.test(n.name)) bones.push(n); });
    for (const bone of bones) {
      const child = bone.children.find((c) => c.isBone && CHAIN_BONE.test(c.name));
      if (!child) continue; // chain tip
      const tail = child.getWorldPosition(new THREE.Vector3());
      this.joints.push({
        bone, child,
        rest: bone.quaternion.clone(),
        axis: child.position.clone().normalize(),
        localLength: child.position.length(),
        tail, prev: tail.clone(),
      });
    }
    // parents before children, so each joint reads its parent's new pose
    const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
    this.joints.sort((x, y) => depth(x.bone) - depth(y.bone));
    this.signature = bones.map((b) => b.uuid).sort().join();
  }

  reset() {
    this.root.updateMatrixWorld(true);
    for (const j of this.joints) {
      j.bone.quaternion.copy(j.rest);
      j.bone.updateMatrixWorld(true);
      j.child.getWorldPosition(j.tail);
      j.prev.copy(j.tail);
    }
  }

  updateColliders() {
    // hips->head distance in world units (follows creator height and model scale)
    const U = this.hips && this.head ? this.hips.getWorldPosition(_v).distanceTo(this.head.getWorldPosition(_w)) : 0.6;
    this.unit = U;
    for (const c of this.colliders) {
      if (c.face) {
        const base = this.head.getWorldPosition(c.pos), top = this.headTop.getWorldPosition(_w);
        const len = base.distanceTo(top);
        const fwd = _q2.copy(this.head.getWorldQuaternion(_q));
        const f = new THREE.Vector3().copy(this.faceFwd).applyQuaternion(fwd);
        c.pos.lerp(top, c.up).addScaledVector(f, len * c.ahead);
        c.r = len * c.radius;
        continue;
      }
      c.a.getWorldPosition(c.pos);
      if (c.b) {
        c.b.getWorldPosition(_w);
        if (c.head) { c.r = c.pos.distanceTo(_w) * 0.55; c.pos.lerp(_w, 0.5); continue; }
        c.pos.lerp(_w, 0.5);
      }
      c.r = c.radius * U;
    }
    return U;
  }

  step(now) {
    if (!this.joints.length) return;
    const rootPos = this.root.getWorldPosition(_v);
    const gap = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    // first frame, a long pause or a teleport: start from the rest pose
    if (!gap || gap > 0.25 || rootPos.distanceTo(this.lastRootPos) > (this.unit || 0.6) * 2) {
      this.lastRootPos.copy(rootPos);
      this.reset();
      return;
    }
    this.lastRootPos.copy(rootPos);
    const dt = Math.min(gap, 1 / 30);
    const U = this.updateColliders();
    const S = HAIR_SPRING_SETTINGS;
    const hit = S.hitRadius * U;
    const pos = new THREE.Vector3(), next = new THREE.Vector3(), restDir = new THREE.Vector3();
    for (const j of this.joints) {
      const { bone } = j;
      bone.parent.updateMatrixWorld(false);
      bone.getWorldPosition(pos);
      const parentRot = bone.parent.getWorldQuaternion(_q);
      const worldRest = _q2.copy(parentRot).multiply(j.rest);
      const length = j.localLength * bone.getWorldScale(_w).y;
      restDir.copy(j.axis).applyQuaternion(worldRest);
      next.copy(j.tail).addScaledVector(_w.copy(j.tail).sub(j.prev), 1 - S.drag)
        .addScaledVector(restDir, S.stiffness * dt * length * 10)
        .add(_w.set(0, -S.gravity * dt * length * 10, 0));
      next.sub(pos).normalize().multiplyScalar(length).add(pos);
      for (const c of this.colliders) {
        const r = c.r + hit;
        _w.copy(next).sub(c.pos);
        const d = _w.length();
        if (d < r && d > 1e-6) {
          next.copy(c.pos).addScaledVector(_w, r / d);
          next.sub(pos).normalize().multiplyScalar(length).add(pos);
        }
      }
      j.prev.copy(j.tail);
      j.tail.copy(next);
      // rotate the joint so its child points at the simulated tail
      const local = _w.copy(next).sub(pos).applyQuaternion(_q.copy(worldRest).invert()).normalize();
      bone.quaternion.copy(j.rest).multiply(_q.setFromUnitVectors(j.axis, local));
      bone.updateMatrixWorld(true);
    }
  }
}

function sceneOf(o) { let s = o; while (s?.parent) s = s.parent; return s?.isScene ? s : null; }

function hookScene(scene) {
  if (hookedScenes.has(scene)) return;
  hookedScenes.add(scene);
  const previous = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    previous?.apply(this, args);
    const now = performance.now();
    for (const c of controllers) {
      if (sceneOf(c.root) !== scene) continue;
      c.step(now);
    }
  };
}

/** Build (or rebuild after a hair swap) the spring controller for a character root. */
export function ensureHairSprings(root) {
  if (!root) return null;
  const bones = [];
  root.traverse((n) => { if (n.isBone && CHAIN_BONE.test(n.name)) bones.push(n.uuid); });
  const signature = bones.sort().join();
  let ctrl = root.userData.hairSprings;
  if (ctrl && ctrl.signature === signature) return ctrl;
  if (ctrl) controllers.delete(ctrl);
  if (!bones.length) { delete root.userData.hairSprings; return null; }
  ctrl = new HairSpringController(root);
  root.userData.hairSprings = ctrl;
  controllers.add(ctrl);
  // hook the scene the first time any of this character's meshes renders
  root.traverse((n) => {
    if (!n.isMesh || n.userData.hairSpringHook) return;
    n.userData.hairSpringHook = true;
    const before = n.onBeforeRender;
    n.onBeforeRender = function (renderer, scene, ...rest) {
      before?.call(this, renderer, scene, ...rest);
      if (scene?.isScene) hookScene(scene);
    };
  });
  return ctrl;
}

export function disposeHairSprings(root) {
  const ctrl = root?.userData?.hairSprings;
  if (ctrl) controllers.delete(ctrl);
  if (root?.userData) delete root.userData.hairSprings;
}
