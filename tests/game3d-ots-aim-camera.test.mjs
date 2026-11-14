import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  OTS_AIM, createOTSAimState, computeOTSAimPose, clipAimBoom,
  castAimReticleRay, applyOTSAimFacing, readGamepadAim,
} from '../src/components/game3d/player/otsAim.mjs';

const step = (state, frames = 60, dt = 1 / 60) => {
  for (let i = 0; i < frames; i += 1) state.update(dt);
  return state.blend;
};

test('aim blends in while held and back out on release', () => {
  const aim = createOTSAimState();
  aim.beginHold(0);
  assert.ok(step(aim) > 0.98, 'hold blends to full aim');
  aim.endHold(400);
  assert.equal(aim.aiming, false);
  assert.ok(step(aim) < 0.02, 'release returns to exploration');
});

test('quick right-click is measured so it can still guard', () => {
  const aim = createOTSAimState();
  aim.beginHold(1000);
  assert.equal(aim.aiming, true);
  assert.ok(aim.endHold(1080) < OTS_AIM.tapGuardMs);
  aim.beginHold(2000);
  assert.ok(aim.endHold(2600) > OTS_AIM.tapGuardMs);
});

test('shoulder swap mirrors the horizontal offset', () => {
  const aim = createOTSAimState();
  aim.beginHold(0);
  step(aim, 90);
  const right = computeOTSAimPose({ yaw: 0, side: aim.sideBlend });
  aim.toggleShoulder();
  step(aim, 90);
  const left = computeOTSAimPose({ yaw: 0, side: aim.sideBlend });
  assert.ok(right.eye.x > 0.2, 'right shoulder sits to camera right');
  assert.ok(left.eye.x < -0.2, 'left shoulder mirrors it');
  assert.ok(Math.abs(right.eye.z - left.eye.z) < 0.001, 'only the lateral offset mirrors');
});

test('OTS pose keeps third-person shoulder framing with only mild zoom', () => {
  const pose = computeOTSAimPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0.18, side: 1 });
  assert.ok(pose.eye.z > 0.8, 'camera is behind a character facing -Z');
  assert.ok(pose.eye.x > 0.4, 'camera is over the right shoulder');
  assert.ok(pose.eye.y > pose.anchor.y - 0.1, 'camera stays at shoulder height');
  assert.ok(OTS_AIM.fov >= 44 && OTS_AIM.fov <= 48, 'aiming is only slightly tighter than normal follow view');
  assert.ok(OTS_AIM.boom >= 2.7, 'aiming does not shove the camera into the avatar');
  assert.ok(pose.target.z < -20, 'aim axis looks far ahead');
});

test('strafe alignment turns the body to the camera forward axis', () => {
  const aim = createOTSAimState();
  const model = new THREE.Object3D();
  assert.equal(applyOTSAimFacing(model, 0, aim, 1 / 60), false, 'no rotation while exploring');
  aim.beginHold(0);
  step(aim);
  applyOTSAimFacing(model, 0, aim, 1 / 60);
  for (let i = 0; i < 120; i += 1) applyOTSAimFacing(model, 0, aim, 1 / 60);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion);
  assert.ok(forward.z < -0.99, 'body faces the camera forward axis (-Z at yaw 0)');
});

test('spring arm pulls the camera in front of a wall', () => {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  wall.position.set(0, 1.5, 0.5);
  wall.updateMatrixWorld(true);
  const pose = computeOTSAimPose({ x: 0, y: 0, z: 0, yaw: 0, side: 1 });
  const clipped = clipAimBoom({
    anchor: pose.anchor, eye: pose.eye, meshes: [wall], raycaster: new THREE.Raycaster(),
  });
  assert.ok(clipped.z < 0.5, 'camera never sits behind the wall');
  assert.ok(clipped.z > pose.anchor.z, 'camera is pulled back but not inverted');
});

test('centre-screen ray reports the world point under the reticle', () => {
  const camera = new THREE.PerspectiveCamera(OTS_AIM.fov, 16 / 9, 0.1, 400);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 1.5, -20);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  wall.position.set(0, 1.5, -10);
  wall.updateMatrixWorld(true);
  const ray = castAimReticleRay({ camera, meshes: [wall], raycaster: new THREE.Raycaster() });
  assert.ok(ray?.point, 'ray hits the wall');
  assert.ok(Math.abs(ray.point.z + 10) < 0.001, 'hit point is where the crosshair covers');
  assert.ok(Math.abs(ray.direction.z + 1) < 0.001, 'shot travels down the screen centre');
});

test('gamepad left trigger counts as aim input', () => {
  assert.equal(readGamepadAim([null]), false);
  assert.equal(readGamepadAim([{ buttons: [{ value: 0 }, {}, {}, {}, {}, {}, { value: 0.9, pressed: true }] }]), true);
  assert.equal(readGamepadAim([{ buttons: [{ value: 0 }, {}, {}, {}, {}, {}, { value: 0.1, pressed: false }] }]), false);
});