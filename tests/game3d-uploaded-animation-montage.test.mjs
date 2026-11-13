import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { decodeUploadedAnimationMontage, loadUploadedAnimationMontage, usesUploadedPlayerMontage, usesUploadedEveMontage } from '../src/components/game3d/player/uploadedAnimationMontage.mjs';
import { UPLOADED_PLAYER_ACTIONS } from '../src/components/game3d/player/playerAnimationActions.mjs';

const pack = JSON.parse(fs.readFileSync('public/game3d/animations/player-montage-v1.json', 'utf8'));
async function body(name = 'Female') {
  globalThis.self = globalThis;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'NO_IMAGE_DECODE', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const bytes = fs.readFileSync(`public/models/characters/fused/${name}_Fused_v2.glb`);
  const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  asset.scene.userData.rigId = asset.parser.json.extras.rigId;
  return asset.scene;
}

test('the complete owner montage retains all 39 distinct file identities and six lossless parser repairs', () => {
  assert.equal(pack.actions.length, 39);
  assert.deepEqual(pack.actions.map(a => [a.key, a.fileName]), UPLOADED_PLAYER_ACTIONS.map(a => [a.key, a.fileName]));
  assert.equal(new Set(pack.actions.map(a => a.sha256)).size, 39);
  const repaired = pack.actions.filter(a => a.parserCompatibilityRepair);
  assert.equal(repaired.length, 6);
  for (const action of repaired) {
    assert.equal(action.parserCompatibilityRepair.method, 'remove-one-surplus-footer-padding-byte');
    assert.match(action.parserCompatibilityRepair.dataPrefixSha256, /^[0-9a-f]{64}$/);
  }
});

test('every uploaded action animates real Eve bones, binds cleanly and leaves the imported rig untouched', async () => {
  const eve = await body();
  const before = new Map();
  eve.traverse(n => { if (n.isBone) before.set(n, [n.position.clone(), n.quaternion.clone(), n.scale.clone()]); });
  const clips = decodeUploadedAnimationMontage(pack, eve);
  assert.equal(Object.keys(clips).length, 39);
  for (const [node, [position, quaternion, scale]] of before) {
    assert.ok(node.position.equals(position) && node.quaternion.equals(quaternion) && node.scale.equals(scale));
  }
  const mixer = new THREE.AnimationMixer(eve);
  for (const [key, clip] of Object.entries(clips)) {
    assert.equal(clip.userData.sourceFile, UPLOADED_PLAYER_ACTIONS.find(a => a.key === key).fileName);
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    let motion = 0;
    const previous = new Map();
    for (const fraction of [0, .2, .5, .8, .99]) {
      mixer.setTime(clip.duration * fraction);
      for (const node of before.keys()) {
        assert.ok([...node.position.toArray(), ...node.quaternion.toArray()].every(Number.isFinite), key);
        if (previous.has(node)) motion = Math.max(motion, node.quaternion.angleTo(previous.get(node)));
        previous.set(node, node.quaternion.clone());
      }
    }
    assert.ok(motion > .001, `${key} must contain visible authored motion`);
    mixer.stopAllAction();
  }
});

test('owner montage loads automatically for both Eve and Adam, isolated per actor', async () => {
  const eve = await body(), adam = await body('Male');
  assert.equal(usesUploadedPlayerMontage(eve), true);
  assert.equal(usesUploadedPlayerMontage(adam), true);
  assert.equal(usesUploadedEveMontage(adam), true); // legacy export compatibility
  assert.equal(usesUploadedPlayerMontage(new THREE.Group()), false);
  let reads = 0;
  const fetchPack = async () => { reads++; return pack; };
  const first = await loadUploadedAnimationMontage(eve, { fetchPack });
  const second = await loadUploadedAnimationMontage(adam, { fetchPack });
  assert.equal(Object.keys(first).length, 39);
  assert.equal(Object.keys(second).length, 39);
  assert.equal(await loadUploadedAnimationMontage(eve, { fetchPack }), first);
  assert.equal(await loadUploadedAnimationMontage(adam, { fetchPack }), second);
  assert.equal(reads, 2);
  assert.notEqual(second.run, first.run);
  for (const clip of Object.values(second))
    for (const track of clip.tracks)
      assert.ok(adam.getObjectByName(track.name.slice(0,track.name.lastIndexOf('.'))),track.name);
});

test('incomplete packs and unsupported skeleton bindings fail visibly instead of returning foreign clips', async () => {
  const eve = await body();
  assert.throws(() => decodeUploadedAnimationMontage({ ...pack, actions: pack.actions.slice(1) }, eve), /incomplete/);
  assert.throws(() => decodeUploadedAnimationMontage(pack, new THREE.Group()), /Unbound montage track/);
});

test('Eve floor-contact corrections use the matching inverse bind pose and keep death/dive skin above the floor', async () => {
  const eve = await body(), clips = decodeUploadedAnimationMontage(pack, eve);
  assert.equal(clips.deathForward.userData.groundingApplied, true);
  const skins = [];
  eve.traverse(node => {
    if (!node.isSkinnedMesh) return;
    for (let parent = node; parent && parent !== eve; parent = parent.parent) {
      if (parent.name === 'Female_Body') { skins.push(node); break; }
    }
  });
  assert.ok(skins.length);
  const vertex = new THREE.Vector3();
  for (const key of ['deathForward', 'deathBackward', 'diveForward']) {
    const mixer = new THREE.AnimationMixer(eve);
    const clip = clips[key], action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play();
    const count = Math.ceil(clip.duration * 60);
    for (let frame = 0; frame <= count; frame++) {
      mixer.setTime(clip.duration * frame / count); eve.updateMatrixWorld(true);
      let minimum = Infinity;
      for (const mesh of skins) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
          minimum = Math.min(minimum, vertex.y);
        }
      }
      assert.ok(minimum >= -.005, `${key} floor penetration: ${minimum}`);
    }
    mixer.stopAllAction(); mixer.uncacheRoot(eve);
  }
  const adam = await body('Male');
  assert.equal(decodeUploadedAnimationMontage(pack, adam).deathForward.userData.groundingApplied, false);
  const changed = await body();
  changed.traverse(node => node.skeleton?.boneInverses.forEach(inverse => { inverse.elements[13] += .02; }));
  assert.equal(decodeUploadedAnimationMontage(pack, changed).deathForward.userData.groundingApplied, false);
});
