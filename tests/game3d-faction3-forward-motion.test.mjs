import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createFactionThreeFacingFrame,factionThreeVisualFacingYaw}
  from '../src/components/game3d/character/factionThreeMountFacing.mjs';

const rig={animationRigProfile:'winged_faction_3_160'};
const other={animationRigProfile:'winged_faction_2_158'};
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function makeRig(forward,rootYaw=0) {
  const root=new THREE.Group();
  root.rotation.y=rootYaw;
  const pelvis=new THREE.Bone();pelvis.name='pelvis';root.add(pelvis);
  const head=new THREE.Bone();head.name='head';
  head.position.set(forward[0],0,forward[1]);
  root.add(head);
  return {root,head,pelvis};
}
function actualHeading(head,pelvis) {
  const direction=head.getWorldPosition(new THREE.Vector3())
    .sub(pelvis.getWorldPosition(new THREE.Vector3()));
  return new THREE.Vector3(direction.x,0,direction.z).normalize();
}

test('Faction 3 nose points toward world +Z regardless of its authored horizontal heading',()=>{
  for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]) {
    const {root,head,pelvis}=makeRig([x,z]);
    const {worldRoot,visualRoot,correctionYaw}=createFactionThreeFacingFrame(root,rig);
    assert.equal(visualRoot,root);
    assert.notEqual(worldRoot,root);
    assert(Number.isFinite(correctionYaw));
    worldRoot.updateMatrixWorld(true);
    const direction=actualHeading(head,pelvis);
    assert(Math.abs(direction.x)<1e-5 && direction.z>.9999,`forward ${x},${z}: ${direction.toArray()}`);
  }
});

test('calibration includes authored glTF root rotation, not just raw bone offsets',()=>{
  const {root,head,pelvis}=makeRig([0,1],Math.PI/2);
  const yaw=factionThreeVisualFacingYaw(root,rig);
  assert(Math.abs(yaw+Math.PI/2)<1e-6);
  const {worldRoot}=createFactionThreeFacingFrame(root,rig);
  worldRoot.rotation.y=.5;
  worldRoot.updateMatrixWorld(true);
  const heading=actualHeading(head,pelvis);
  assert(Math.abs(heading.x-Math.sin(.5))<1e-6);
  assert(Math.abs(heading.z-Math.cos(.5))<1e-6);
});

test('unrelated factions and fallback skeletons are not reoriented',()=>{
  const {root}=makeRig([1,0]);
  assert.equal(factionThreeVisualFacingYaw(root,other),0);
  const unchanged=createFactionThreeFacingFrame(root,other);
  assert.equal(unchanged.worldRoot,root);
  const missing=new THREE.Group();
  assert.equal(factionThreeVisualFacingYaw(missing,rig),0);
});

test('local world uses game-space movement root, but mixer keeps native visual skeleton',()=>{
  const world=file('src/components/game3d/GameWorld3D.jsx');
  assert.match(world,/createFactionThreeFacingFrame\(companionModel, companionDef\)/);
  assert.match(world,/companionGroupRef\.current = companionWorldRoot/);
  assert.match(world,/new THREE\.AnimationMixer\(companionModel\)/);
  assert.match(world,/companionSecondaryRig=createFactionThreeMountRig\(companionModel,companionDef\)/);
  assert.match(world,/isFactionThreeMount\(companionDefRef\.current\)/);
  assert.match(world,/factionThreeLastRunAt/);
  assert.doesNotMatch(world,/compGroup\.rotation\.y\s*\+=\s*Math\.PI/);
});

test('remote mounts share corrected heading and frame-rate stable interpolation',()=>{
  const remote=file('src/components/game3d/RemoteCompanionManager.jsx');
  assert.match(remote,/createFactionThreeFacingFrame\(visual,renderDefinition\)/);
  assert.match(remote,/new THREE\.AnimationMixer\(visual\)/);
  assert.match(remote,/secondaryRig=createFactionThreeMountRig\(visual,renderDefinition\)/);
  assert.match(remote,/definition: renderDefinition/);
  assert.match(remote,/1-Math\.exp\(-12\*step\)/);
  assert.match(remote,/1-Math\.exp\(-14\*step\)/);
  assert.match(remote,/now-inst\.lastMovingAt<240/);
  assert.match(remote,/if \(hasPosition && !inst\.hasNetworkPosition &&/);
  assert.match(remote,/isFactionThreeMount\(inst\.definition\)/);
});
