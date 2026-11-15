import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {alignFactionThreeWingBases,isolateFactionThreeIcoHelpers,createFactionThreeMountRig}
  from '../src/components/game3d/character/factionThreeMountRig.mjs';
import {createFactionThreeEyeControls}
  from '../src/components/game3d/character/factionThreeEyeControls.mjs';

const profile={animationRigProfile:'winged_faction_3_160'};
function bone(root,name,pos=[0,0,0],parent=root){
  const result=new THREE.Bone();
  result.name=name;result.position.set(...pos);parent.add(result);return result;
}
function mesh(parent,name,pos=[0,0,0]){
  const result=new THREE.Mesh(new THREE.IcosahedronGeometry(.025,1),new THREE.MeshBasicMaterial());
  result.name=name;result.position.set(...pos);parent.add(result);return result;
}
function wingRig(){
  const root=new THREE.Group();
  bone(root,'chest',[0,.3,0]);
  bone(root,'neck',[0,.6,.3]);
  bone(root,'head',[0,.8,.5]);
  bone(root,'front.L.upper',[-.5,.2,.4]);
  bone(root,'front.R.upper',[.5,.2,.4]);
  const left=bone(root,'wing.L.base',[-2,1,-1]);
  const right=bone(root,'wing.R.base',[2,1,-1]);
  return {root,left,right};
}

test('wing inspection never moves real skinned bones or changes their bind rest',()=>{
  const {root,left,right}=wingRig();
  const before=[left.position.clone(),right.position.clone()];
  const state=alignFactionThreeWingBases(root);
  assert.equal(state.corrected,0);
  assert(state.outOfPlace>=2);
  assert(left.position.equals(before[0]));
  assert(right.position.equals(before[1]));
  state.restore();
  assert(left.position.equals(before[0]));
  assert(right.position.equals(before[1]));
});

test('tail Icosphere gets its own bone; eye helpers are NEVER reassigned to a wing',()=>{
  const {root,left,right}=wingRig();
  const head=root.getObjectByName('head');
  const tail=bone(root,'tail.01',[0,0,-3]);
  const unbound=mesh(root,'Icosphere_tail',[0,.02,-2.97]);
  const eye=mesh(root,'Icosphere_Eye.L',[0,.8,.51]);
  const unnamed=mesh(root,'Icosphere.001',[.04,.8,.48]);
  const original=eye.parent,unboundParent=unbound.parent;
  const state=isolateFactionThreeIcoHelpers(root,{tail:[tail],wings:[left,right],span:1});
  assert.equal(state.attached,1);
  assert.equal(unbound.parent,tail);
  assert.equal(eye.parent,original);
  assert.equal(unnamed.parent,original);
  assert(eye.visible&&unnamed.visible);
  assert(state.protected>=2);
  state.restore();
  assert.equal(unbound.parent,unboundParent);
  assert.equal(eye.parent,original);
  [unbound,eye,unnamed].forEach(m=>{m.geometry.dispose();m.material.dispose();});
});

test('invisible armature eye Icospheres drive bounded gaze and existing blink morphs only',()=>{
  const root=new THREE.Group();
  const head=bone(root,'head');
  const left=bone(root,'eye.L',[-.1,.04,.15],head);
  const right=bone(root,'eye.R',[.1,.04,.15],head);
  const face=mesh(root,'Face');
  face.morphTargetDictionary={Blink_L:0,Blink_R:1};
  face.morphTargetInfluences=[0,0];
  const beforeMaterial=face.material,beforeGeometry=face.geometry;
  const result=createFactionThreeEyeControls(root,profile);
  assert.equal(result.active,true);
  assert.equal(result.status().controls,2);
  assert.equal(result.status().gazeBones,2);
  assert.equal(result.status().blinkChannels,2);
  const markers=[];
  head.traverse(node=>{if(node.userData?.factionThreeEyeControl)markers.push(node);});
  assert.equal(markers.length,2);
  assert(markers.every(m=>!m.visible));
  result.update(.08);
  assert(face.morphTargetInfluences[0]>.5);
  assert(face.morphTargetInfluences[1]>.5);
  assert(left.quaternion.angleTo(new THREE.Quaternion())<.12);
  assert(right.quaternion.angleTo(new THREE.Quaternion())<.12);
  assert.equal(face.geometry,beforeGeometry);
  assert.equal(face.material,beforeMaterial);
  result.dispose();
  assert.equal(face.morphTargetInfluences[0],0);
  assert.equal(face.morphTargetInfluences[1],0);
  assert(left.quaternion.equals(new THREE.Quaternion()));
  assert.equal(markers.filter(m=>m.parent).length,0);
  face.geometry.dispose();face.material.dispose();
});

test('if the owner GLB has no eyelid morph, eye control never squeezes eyeballs',()=>{
  const root=new THREE.Group();const head=bone(root,'head');
  const eye=mesh(head,'Eye.L');
  const rot=eye.quaternion.clone(),scale=eye.scale.clone();
  const controller=createFactionThreeEyeControls(root,profile);
  assert.equal(controller.status().blinkSupported,false);
  assert.equal(controller.status().gazeBones,0);
  controller.update(.07);controller.update(.05);controller.dispose();
  assert(eye.quaternion.equals(rot));
  assert(eye.scale.equals(scale));
  eye.geometry.dispose();eye.material.dispose();
});

test('other mounts never get Icosphere eye controls or extra pose overrides',()=>{
  const root=new THREE.Group();bone(root,'head');
  const controller=createFactionThreeEyeControls(root,{animationRigProfile:'winged_faction_2_158'});
  assert.equal(controller.active,false);
  assert.equal(root.children.length,1);
});

test('both local and remote mounts already run the shared secondary rig after the mixer',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const world=read('src/components/game3d/GameWorld3D.jsx');
  const remote=read('src/components/game3d/RemoteCompanionManager.jsx');
  const rig=read('src/components/game3d/character/factionThreeMountRig.mjs');
  assert.match(world,/companionSecondaryRig\?\.update\(delta\)/);
  assert.match(remote,/inst\.secondaryRig\?\.update\(delta\)/);
  assert.match(rig,/const eyes=createFactionThreeEyeControls\(root,definition\)/);
  assert.match(rig,/eyes\.update\(step\)/);
  assert.match(rig,/eyes\.dispose\(\)/);
  assert.doesNotMatch(rig,/wing\.position\.copy\(wing\.parent\.worldToLocal/);
});
