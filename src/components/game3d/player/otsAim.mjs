// Over-the-shoulder (OTS) aiming for Game 3D.
//
// Exploration keeps the existing third-person follow camera in
// PlayerCameraSystem. While the aim input is held, the same system blends to
// this pose: behind and beside one shoulder, narrow FOV, and a spring-arm
// raycast so the camera never clips through terrain, floors or walls.
//
// This module is pure camera math plus one small state object. Combat, damage
// and server authority are untouched: it only decides where the camera is and
// which world point the centre of the screen covers.
import * as THREE from 'three';

export const OTS_AIM = Object.freeze({
  // Aim framing
  fov: 46,              // modest ~4-degree aim zoom from Game 3D's 50-degree follow FOV
  fovLerp: 11,          // per-second smoothing of the FOV change
  anchorHeight: 1.5,    // eye height of the pivot above the character's feet
  boom: 3.0,            // maintain third-person framing, not an extreme close-up
  lateral: 0.62,        // shoulder offset keeps the bow clear of centre reticle
  forwardNudge: 0.2,    // small push toward the aim direction
  eyeRise: 0.06,        // keeps the eye just above the shoulder line
  lookAhead: 40,        // camera-centre convergence: shot ray uses this view
  blendSpeed: 9,        // aim in/out smoothing
  shoulderSpeed: 10,    // shoulder swap smoothing
  // Spring arm
  minBoom: 0.34,        // never closer than this to the pivot
  nearClearance: 0.18,  // start the ray outside the pivot
  collisionMargin: 0.22,
  // Centre-screen ray
  reticleRange: 120,
  // Input
  gamepadTriggerThreshold: 0.45,
  tapGuardMs: 220,      // a quick right-click tap still guards, a hold aims
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/** Camera basis for the Game 3D orbit yaw (yaw 0 faces -Z). */
export function otsAimBasis(yaw = 0) {
  const y = finite(yaw), sin = Math.sin(y), cos = Math.cos(y);
  return {
    forward: { x: -sin, z: -cos },
    right: { x: cos, z: -sin },
  };
}

/**
 * OTS pose for one frame.
 * `side` is the smoothed shoulder side: +1 right shoulder, -1 left shoulder.
 */
export function computeOTSAimPose({ x = 0, y = 0, z = 0, yaw = 0, pitch = 0.18, side = 1 } = {}) {
  const basis = otsAimBasis(yaw);
  const p = clamp(finite(pitch, 0.18), -1.2, 1.2);
  const cosPitch = Math.cos(p), sinPitch = Math.sin(p);
  const look = { x: basis.forward.x * cosPitch, y: -sinPitch, z: basis.forward.z * cosPitch };
  const lateral = OTS_AIM.lateral * finite(side, 1);
  const anchor = { x, y: y + OTS_AIM.anchorHeight, z };
  const eye = {
    x: anchor.x + basis.right.x * lateral + basis.forward.x * OTS_AIM.forwardNudge - look.x * OTS_AIM.boom,
    y: anchor.y - look.y * OTS_AIM.boom + OTS_AIM.eyeRise,
    z: anchor.z + basis.right.z * lateral + basis.forward.z * OTS_AIM.forwardNudge - look.z * OTS_AIM.boom,
  };
  const target = {
    x: anchor.x + look.x * OTS_AIM.lookAhead,
    y: anchor.y + look.y * OTS_AIM.lookAhead,
    z: anchor.z + look.z * OTS_AIM.lookAhead,
  };
  return { anchor, eye, target, look };
}

const _dir = new THREE.Vector3();
const _start = new THREE.Vector3();

/**
 * Spring arm: pull the eye toward the pivot until nothing blocks the view.
 * The eye recovers by itself because it is recomputed from the pivot each frame.
 */
export function clipAimBoom({
  anchor, eye, meshes, raycaster,
  margin = OTS_AIM.collisionMargin, minBoom = OTS_AIM.minBoom,
} = {}) {
  if (!anchor || !eye || !raycaster || !Array.isArray(meshes) || !meshes.length) return eye;
  _dir.set(eye.x - anchor.x, eye.y - anchor.y, eye.z - anchor.z);
  const distance = _dir.length();
  if (!Number.isFinite(distance) || distance < 0.001) return eye;
  _dir.multiplyScalar(1 / distance);
  const clearance = Math.min(OTS_AIM.nearClearance, distance * 0.5);
  _start.set(anchor.x, anchor.y, anchor.z).addScaledVector(_dir, clearance);
  raycaster.set(_start, _dir);
  raycaster.near = 0;
  raycaster.far = Math.max(0, distance - clearance);
  const hit = raycaster.intersectObjects(meshes, true)
    .find((entry) => entry?.object?.visible !== false && Number.isFinite(entry.distance));
  if (!hit) return eye;
  const safe = Math.max(Math.min(minBoom, distance),
    Math.min(distance, clearance + hit.distance - margin));
  return {
    x: _start.x + _dir.x * safe,
    y: _start.y + _dir.y * safe,
    z: _start.z + _dir.z * safe,
  };
}

const _aimFacing = new THREE.Quaternion();
const _aimAxis = new THREE.Vector3(0, 1, 0);

/**
 * Strafe alignment: while aiming, the body turns to the camera's forward axis,
 * so WASD (which is already camera-relative) becomes a strafe, not a turn away
 * from the crosshair.
 */
export function applyOTSAimFacing(model, orbitYaw, aim, delta = 0) {
  if (!model || !aim || (!aim.aiming && !aim.bowEquipped) ||
      (aim.blend <= 0.02 && !aim.bowEquipped)) return false;
  const yaw = finite(orbitYaw, 0) + Math.PI;
  _aimFacing.setFromAxisAngle(_aimAxis, yaw);
  const rate = 1 - Math.exp(-14 * clamp(finite(delta, 0), 0, 0.05));
  model.quaternion.slerp(_aimFacing, rate);
  return true;
}

const _center = new THREE.Vector2(0, 0);

/** Centre-screen ray: where a shot from this camera would land. */
export function castAimReticleRay({ camera, meshes = [], raycaster, maxRange = OTS_AIM.reticleRange } = {}) {
  if (!camera || !raycaster) return null;
  raycaster.setFromCamera(_center, camera);
  raycaster.near = 0;
  raycaster.far = maxRange;
  const hits = Array.isArray(meshes) && meshes.length
    ? raycaster.intersectObjects(meshes, true) : [];
  const hit = hits.find((entry) => entry?.object?.visible !== false) || null;
  const { origin, direction } = raycaster.ray;
  return {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    direction: { x: direction.x, y: direction.y, z: direction.z },
    point: hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null,
    distance: hit ? hit.distance : null,
    object: hit?.object || null,
  };
}

/** Left trigger / L2 on a connected gamepad. */
export function readGamepadAim(gamepads) {
  if (!gamepads) return false;
  for (const pad of gamepads) {
    if (!pad) continue;
    const trigger = pad.buttons?.[6];
    if (trigger && (trigger.value > OTS_AIM.gamepadTriggerThreshold || trigger.pressed)) return true;
  }
  return false;
}

/**
 * One shared aim state: Mouse/trigger input, blend, shoulder side.
 * Create once per game view and pass it to PlayerCameraSystem.
 */
export function createOTSAimState() {
  const state = {
    mouseAim: false,
    padAim: false,
    aiming: false,
    blend: 0,
    side: 1,
    sideBlend: 1,
    heldAt: 0,
    /** Right button pressed. */
    beginHold(now = 0) {
      state.mouseAim = true;
      state.heldAt = finite(now, 0);
      state.aiming = true;
      return state.aiming;
    },
    /** Held duration in ms, then release. */
    endHold(now = 0) {
      const held = Math.max(0, finite(now, 0) - state.heldAt);
      state.mouseAim = false;
      state.aiming = state.padAim;
      return held;
    },
    setPadAim(pressed) {
      state.padAim = !!pressed;
      state.aiming = state.mouseAim || state.padAim;
    },
    /** Mirrors the shoulder offset: right <-> left. */
    toggleShoulder() {
      state.side = state.side >= 0 ? -1 : 1;
      return state.side;
    },
    /** Advances the blend. Called once per frame by PlayerCameraSystem. */
    update(delta = 0) {
      const dt = clamp(finite(delta, 0), 0, 0.05);
      const target = state.aiming ? 1 : 0;
      state.blend += (target - state.blend) * (1 - Math.exp(-OTS_AIM.blendSpeed * dt));
      if (Math.abs(target - state.blend) < 0.001) state.blend = target;
      state.sideBlend += (state.side - state.sideBlend) * (1 - Math.exp(-OTS_AIM.shoulderSpeed * dt));
      if (Math.abs(state.side - state.sideBlend) < 0.005) state.sideBlend = state.side;
      return state.blend;
    },
    /** Polls a connected gamepad's left trigger. */
    pollGamepad() {
      const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
      state.setPadAim(readGamepadAim(pads));
      return state.padAim;
    },
  };
  return state;
}