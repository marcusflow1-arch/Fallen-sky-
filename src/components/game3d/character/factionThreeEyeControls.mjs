// Faction 3 #160: conservative eye control layer, mounted on the original
// armature. No eye material, mesh topology, skin weight, inverse bind matrix,
// original animation clip or visible geometry is rewritten.
import * as THREE from 'three';
import {isFactionThreeMount} from './factionThreeMountRig.mjs';

const normalized = value => String(value||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const eyeSide = name => {
  const n=normalized(name);
  if(/lid|brow|lash/.test(n))return null;
  if(/^(eyeleft|lefteye|eyel|leyeball|eyeballl|lefteyeball)$/.test(n))return 'L';
  if(/^(eyeright|righteye|eyer|reyeball|eyeballr|righteyeball)$/.test(n))return 'R';
  return null;
};
const blinkKey = name => /blink|eyelidclose|eyeclose|eyeshut|closedeye/i
  .test(normalized(name));

const empty = reason => ({
  active:false, update(){}, dispose(){},
  status:()=>({active:false,reason,controls:0,gazeBones:0,blinkChannels:0}),
});

/**
 * Invisible Icospheres are diagnostic eye CONTROL anchors, NOT new eyeballs.
 * Only discovered eye bones receive gaze; blink uses an EXISTING lid/morph
 * channel if authored. Missing channels never trigger a destructive shortcut
 * (scaling/squashing pupils or forcibly reweighting the skinned head).
 */
export function createFactionThreeEyeControls(root,definition={}) {
  if(!root||!isFactionThreeMount(definition))return empty('other-mount');
  let head=null;
  const eyes=new Map(),morphs=[];
  root.traverse(node=>{
    if(node.isBone) {
      if(normalized(node.name)==='head')head=node;
      const side=eyeSide(node.name);
      if(side&&!eyes.has(side))eyes.set(side,node);
    }
    if(!node.isMesh||!node.morphTargetDictionary||
        !Array.isArray(node.morphTargetInfluences))return;
    for(const [name,index] of Object.entries(node.morphTargetDictionary)) {
      if(!blinkKey(name)||!Number.isInteger(index)||
          index<0||index>=node.morphTargetInfluences.length)continue;
      morphs.push({node,index,baseline:node.morphTargetInfluences[index]||0});
    }
  });
  if(!head && eyes.size===0)return empty('no-head-or-eye-bones');
  const controls=[],rest=[];
  // Keep both hidden controllers on the mount's head/eye armature. These may
  // be used by an artist to locate blink/gaze controls later; rendering is
  // intentionally off so existing eyeballs remain unchanged.
  for(const side of ['L','R']) {
    const bone=eyes.get(side),parent=bone||head;
    if(!parent)continue;
    const marker=new THREE.Mesh(new THREE.IcosahedronGeometry(.006,0),
      new THREE.MeshBasicMaterial({visible:false,depthWrite:false}));
    marker.name='FactionThreeEyeIcosphere_'+side;
    marker.visible=false;
    marker.userData.factionThreeEyeControl=true;
    marker.position.set(0,0,0);
    parent.add(marker);
    controls.push(marker);
    if(bone)rest.push({bone,quaternion:bone.quaternion.clone()});
  }
  let elapsed=0,disposed=false;
  const axisY=new THREE.Vector3(0,1,0),axisX=new THREE.Vector3(1,0,0);
  const offset=new THREE.Quaternion(),pitchQ=new THREE.Quaternion();
  return {
    active:true,
    update(dt){
      if(disposed)return;
      const step=THREE.MathUtils.clamp(Number(dt)||0,0,.08);
      if(!step)return;
      elapsed+=step;
      // Subtle, synchronized gaze: no more than 5 degrees in either
      // direction, 3 degrees vertically. Never rotate the entire head.
      const yaw=Math.sin(elapsed*.57)*.07;
      const pitch=Math.sin(elapsed*.31+.6)*.042;
      offset.setFromAxisAngle(axisY,yaw);
      pitchQ.setFromAxisAngle(axisX,pitch);
      offset.multiply(pitchQ);
      for(const {bone,quaternion} of rest)
        bone.quaternion.copy(quaternion).multiply(offset).normalize();
      // Quick, infrequent blink (approx. once every 4 seconds); only use
      // eyelid/blink morph targets the GLB ALREADY provides.
      const period=4.1+.35*Math.sin(elapsed*.17);
      const at=elapsed%period;
      const blink=at<.09?at/.09:at<.20?(.20-at)/.11:0;
      for(const {node,index,baseline} of morphs)
        node.morphTargetInfluences[index]=Math.max(baseline,blink);
    },
    status:()=>({active:!disposed,controls:controls.length,
      gazeBones:rest.length,blinkChannels:morphs.length,
      // No eyelid morph: eye remains untouched rather than being squashed.
      blinkSupported:morphs.length>0}),
    dispose(){
      if(disposed)return;
      disposed=true;
      for(const {bone,quaternion} of rest)bone.quaternion.copy(quaternion);
      for(const {node,index,baseline} of morphs)
        node.morphTargetInfluences[index]=baseline;
      for(const marker of controls){
        marker.parent?.remove(marker);
        marker.geometry.dispose();marker.material.dispose();
      }
    },
  };
}
