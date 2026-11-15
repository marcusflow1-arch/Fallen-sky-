// Faction 3 owner's #160 GLB — mount-owned secondary motion and anchor repair.
//
// The uploaded 28-bone GLB has an Idle_Relaxed_Tail animation but no authored
// walk/run clip. A separate baby-wolf retarget drives the mount locomotion.
// Never parent appendage helpers to the rider, use player/camera animation
// deltas, or rewrite a SkinnedMesh's bone weights / inverse bind matrices.
//
// This is a reversible visual rig pass, not rigid-body physics. Only the
// faction_tiger / winged_faction_3_160 is affected.
import * as THREE from 'three';
import {createFactionThreeEyeControls} from './factionThreeEyeControls.mjs';

const norm = name => String(name||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const FACTION_THREE_RIG = 'winged_faction_3_160';

export function isFactionThreeMount(definition) {
  return definition?.animationRigProfile===FACTION_THREE_RIG;
}
export function classifyFactionThreeBone(name) {
  const s=norm(name);
  if(/^tail\d+/.test(s))return 'tail';
  if(/^wing[lr](?:base|root|\d+)/.test(s))return 'wing';
  if(/^front[lr]upper$/.test(s))return 'shoulder';
  return null;
}

function getNodes(root) {
  const nodes=new Map();
  root.traverse(node=>{
    nodes.set(norm(node.name),node);
    nodes.set(node.uuid,node);
  });
  return nodes;
}
function trackTarget(root,track,cache) {
  if(!track?.name)return null;
  const dot=track.name.lastIndexOf('.');
  if(dot<0)return null;
  const target=track.name.slice(0,dot);
  return cache.get(target)||cache.get(norm(target))||null;
}
function trackProperty(track) {
  return String(track?.name||'').slice(String(track?.name||'').lastIndexOf('.')+1);
}
function helperName(name) {
  return /(?:^|[._-])(?:ico(?:sphere)?|physics[_-]?helper|spring[_-]?control)(?:[._-]|\d|$)/i
    .test(String(name||''));
}

/**
 * A native clip can legally contain motion tracks for unweighted Icosphere
 * nodes, the root transform and positional animation of a tail helper. Those
 * translations fight the already world-driven mount pose. Keep genuine bone
 * quaternion animation; reject unskinned helper tracks and animated
 * tail/wing/root translations. Do not edit the source AnimationClip in place.
 */
export function sanitizeFactionThreeNativeClips(root, clips=[], definition={}) {
  if(!isFactionThreeMount(definition))return clips;
  const cache=getNodes(root);
  return (clips||[]).map(clip=>{
    const tracks=(clip.tracks||[]).filter(track=>{
      const node=trackTarget(root,track,cache);
      const targetName=String(track.name||'').slice(0,String(track.name||'').lastIndexOf('.'));
      const prop=trackProperty(track);
      // The old baby-wolf body/root yaw does not belong on the uploaded
      // tiger's pelvis bone. It can rotate the skinned torso sideways while
      // its world/navigation root still faces forward. Lock this single
      // mount's pelvis to its imported bind rotation; leg, head, tail and wing
      // tracks continue animating normally.
      if(norm(node?.name||targetName)==='pelvis'&&
          ['position','quaternion','scale'].includes(prop))return false;
      if(helperName(targetName)||helperName(node?.name))return false;
      // Non-bone spatial controls are not allowed to drive the mount rig.
      // Preserve non-transform morph weights on the original visual mesh.
      if(node&&!node.isBone&&['position','quaternion','scale'].includes(prop))
        return false;
      if(prop==='position'||prop==='scale'){
        if(node===root||classifyFactionThreeBone(node?.name))return false;
        if(!node&&/(?:root|armature|scene|tail|wing)/i.test(targetName))
          return false;
      }
      return true;
    }).map(track=>track.clone());
    return new THREE.AnimationClip(clip.name,clip.duration,tracks,clip.blendMode);
  });
}

function sortedBoneChain(root,family) {
  const bones=[];
  root.traverse(node=>{
    if(node.isBone&&classifyFactionThreeBone(node.name)===family)
      bones.push(node);
  });
  if(family==='tail')bones.sort((a,b)=>{
    const n=name=>Number(String(name).match(/(\d+)(?!.*\d)/)?.[1]||0);
    return n(a.name)-n(b.name);
  });
  return bones;
}
function findBone(root,wanted) {
  let found=null;
  const key=norm(wanted);
  root.traverse(node=>{
    if(!found&&node.isBone&&norm(node.name)===key)found=node;
  });
  return found;
}
function world(bone) {
  return bone.getWorldPosition(new THREE.Vector3());
}
function wingSide(name) {
  const n=norm(name);
  return n.startsWith('wingl')?'L':n.startsWith('wingr')?'R':null;
}
function isMiniUnweightedIco(node,span) {
  if(!node?.isMesh||node.isSkinnedMesh||!helperName(node.name))return false;
  const geometry=node.geometry;
  if(!geometry)return false;
  geometry.computeBoundingSphere?.();
  const radius=geometry.boundingSphere?.radius||0;
  const scale=node.getWorldScale(new THREE.Vector3());
  const worldRadius=radius*Math.max(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));
  return worldRadius>0&&worldRadius<Math.max(.075,span*.29);
}

/**
 * Report wing attachment offsets without changing a skinned bone's bind pose.
 * Moving a skin joint in isolation corrupts mesh deformation because GLB
 * inverseBindMatrices still represent its original rest position. If the
 * uploaded asset has a misplaced wing attachment, it must be repaired in its
 * armature/skin and re-exported, not translated every time Play loads.
 */
export function alignFactionThreeWingBases(root) {
  if(!root) return {corrected:0,span:0,anchors:[],outOfPlace:0,restore(){}};
  root.updateWorldMatrix(true,true);
  const chest=findBone(root,'chest')||findBone(root,'spine');
  const neck=findBone(root,'neck');
  const left=findBone(root,'front.L.upper'),right=findBone(root,'front.R.upper');
  const wings=sortedBoneChain(root,'wing');
  if(!chest||!neck||!left||!right||wings.length<2)
    return {corrected:0,span:0,anchors:[],outOfPlace:0,restore(){}};
  const span=world(left).distanceTo(world(right));
  if(!(span>1e-5)) return {corrected:0,span:0,anchors:[],outOfPlace:0,restore(){}};
  const anchors=[];
  let outOfPlace=0;
  for(const bone of wings) {
    const side=wingSide(bone.name);
    const shoulder=side==='L'?left:side==='R'?right:null;
    if(!shoulder) continue;
    const target=world(shoulder).lerp(world(chest),.28)
      .lerp(world(neck),.16);
    target.y+=clamp(span*.14,.025,.30);
    if(world(bone).distanceTo(target)>Math.max(.05,span*.22)) outOfPlace++;
    anchors.push({bone,side,target}); // diagnostics only; bone stays in authored bind pose
  }
  return {corrected:0,span,anchors,outOfPlace,restore(){}};
}

const isEyeRelated = name => /eye|pupil|iris|eyelid|brow|blink/i.test(String(name||''));
const boneAncestor = node => {
  let parent=node?.parent;
  while(parent){ if(parent.isBone) return parent; parent=parent.parent; }
  return null;
};

/**
 * Icosphere helpers are UNSKINNED. Giving their mesh fake skin weights cannot
 * fix a skinned tail: only a GLB armature re-export can change vertex weights.
 * We can rigidly attach an approved helper to a matching tail/wing bone,
 * keeping its world transform. Unknown and eye-adjacent Icospheres must never
 * get assigned to the nearest wing by accident.
 */
export function isolateFactionThreeIcoHelpers(root,{tail=[],wings=[],span=1}={}) {
  if(!root) return {attached:0,hidden:0,protected:0,restore(){}};
  root.updateWorldMatrix(true,true);
  const head=findBone(root,'head');
  const restores=[];
  const candidates=[];
  root.traverse(node=>{if(isMiniUnweightedIco(node,span))candidates.push(node);});
  let attached=0,hidden=0,protectedCount=0;
  const headExclusion=Math.max(.17,span*.42);
  for(const node of candidates){
    if(!node.parent || node.userData?.factionThreeEyeControl)continue;
    const named=String(node.name||'').toLowerCase();
    const parentBone=boneAncestor(node);
    // The original eyes and their controls are never replaced, hidden,
    // skinned, reparented to wings, or assigned appendage motion.
    if(isEyeRelated(named)||isEyeRelated(parentBone?.name)||
        (head && world(node).distanceTo(world(head))<headExclusion)){
      protectedCount++;
      continue;
    }
    // No blind nearest-bone attachment. Unnamed tiny Icospheres are only
    // eligible if they already sit directly beside a genuine appendage bone.
    const family=/tail/i.test(named)?tail:/wing/i.test(named)?wings:[...tail,...wings];
    let closest=null,dist=Infinity;
    for(const bone of family){
      const d=world(node).distanceTo(world(bone));
      if(d<dist){dist=d;closest=bone;}
    }
    const threshold=Math.max(.075,span*(/tail|wing/i.test(named)?.45:.17));
    if(!closest||dist>threshold){protectedCount++;continue;}
    if(parentBone===closest || node.parent===closest)continue; // already armature-owned
    const initial={parent:node.parent,position:node.position.clone(),
      quaternion:node.quaternion.clone(),scale:node.scale.clone(),
      visible:node.visible,raycast:node.raycast};
    closest.attach(node); // rigid joint link, world transform preserved
    node.userData.factionThreeSecondaryHelper=true;
    node.raycast=()=>{};
    attached++;
    restores.push(()=>{
      initial.parent.attach(node);
      node.position.copy(initial.position);
      node.quaternion.copy(initial.quaternion);
      node.scale.copy(initial.scale);
      node.visible=initial.visible;node.raycast=initial.raycast;
      delete node.userData.factionThreeSecondaryHelper;
    });
  }
  return {attached,hidden,protected:protectedCount,restore:()=>{
    for(const restore of restores.reverse())restore();
    root.updateWorldMatrix(true,true);
  }};
}

/**
 * Advance after AnimationMixer.update() AND after the mount root has moved.
 * This prevents 1-frame lag and never samples the rider/camera transform.
 * Bind quaternions are the owner's own authored mount pose; each animated
 * tail joint is softly limited so no segment can fold forward into the head.
 */
export function createFactionThreeMountRig(root,definition={}) {
  if(!root||!isFactionThreeMount(definition))
    return {active:false,update(){},dispose(){},status(){return {active:false}}};
  const tail=sortedBoneChain(root,'tail');
  const wings=sortedBoneChain(root,'wing');
  const wingPlacement=alignFactionThreeWingBases(root);
  const helpers=isolateFactionThreeIcoHelpers(root,{tail,wings,span:wingPlacement.span||1});
  // Keep eye Icospheres invisible and on the original head/eye armature;
  // these are not eligible for tail/wing helper rebinding.
  const eyes=createFactionThreeEyeControls(root,definition);
  const tailRest=tail.map(node=>node.quaternion.clone());
  const wingRest=wings.map(node=>node.quaternion.clone());
  // The head/neck may retain a subtle native idle, but do not let a bad
  // tail/helper track yank the real head backwards into the tail.
  const headGuards=[['neck',.20],['head',.28]]
    .map(([name,limit])=>{const bone=findBone(root,name);
      return bone?{bone,limit,rest:bone.quaternion.clone()}:null;})
    .filter(Boolean);
  const axis=new THREE.Vector3(0,0,1),wingAxis=new THREE.Vector3(1,0,0);
  const oldPos=root.getWorldPosition(new THREE.Vector3());
  const oldYaw=root.getWorldQuaternion(new THREE.Quaternion());
  let speed=0,sway=0,velocity=0,elapsed=0,disposed=false;
  return {
    active:true,
    update(dt){
      if(disposed)return;
      const step=clamp(Number(dt)||0,0,.08);
      if(step<=0)return;
      elapsed+=step;
      const current=root.getWorldPosition(new THREE.Vector3());
      const rotation=root.getWorldQuaternion(new THREE.Quaternion());
      const worldDelta=current.clone().sub(oldPos);
      const teleported=worldDelta.length()>4;
      const localDelta=worldDelta.clone().applyQuaternion(rotation.clone().invert());
      const distance=teleported?0:worldDelta.length();
      speed=THREE.MathUtils.damp(speed,clamp(distance/step,0,8),8,step);
      const yawAngle=teleported?0:oldYaw.angleTo(rotation);
      // A spring driven only by *mount* local movement/yaw; camera orbit or
      // rider animation never enters this computation.
      const desired=teleported?0:clamp(
        -localDelta.x/step*.028+
        Math.sign(localDelta.x||1)*yawAngle*.055,-.12,.12);
      const accel=(desired-sway)*23-velocity*9;
      velocity+=accel*step;
      sway=clamp(sway+velocity*step,-.14,.14);
      if(teleported){velocity=0;sway=0;speed=0;}
      oldPos.copy(current);oldYaw.copy(rotation);
      headGuards.forEach(({bone,limit,rest})=>{
        const deviation=rest.angleTo(bone.quaternion);
        if(deviation>limit)
          bone.quaternion.slerpQuaternions(
            rest,bone.quaternion,limit/deviation);
      });
      tail.forEach((bone,index)=>{
        const rest=tailRest[index];
        const angle=rest.angleTo(bone.quaternion);
        const maxBend=index===0?.26:Math.min(.52,.31+index*.042);
        if(angle>maxBend)
          bone.quaternion.slerpQuaternions(rest,bone.quaternion,maxBend/angle);
        // A small elastic reaction, not a tail translation or head collider.
        bone.quaternion.multiply(new THREE.Quaternion()
          .setFromAxisAngle(axis,sway*(1+index*.13))).normalize();
      });
      wings.forEach((bone,index)=>{
        const rest=wingRest[index];
        const angle=rest.angleTo(bone.quaternion);
        if(angle>.28)bone.quaternion.slerpQuaternions(
          rest,bone.quaternion,.28/angle);
        // Mirror the left/right shoulder flutter, based on mount travel only.
        const sign=wingSide(bone.name)==='R'?-1:1;
        const flutter=sign*Math.sin(elapsed*3.1)*Math.min(.045,speed*.008);
        bone.quaternion.multiply(new THREE.Quaternion()
          .setFromAxisAngle(wingAxis,flutter)).normalize();
      });
      eyes.update(step);
    },
    status(){return {active:!disposed,tailBones:tail.length,
      wingBones:wings.length,wingCorrections:wingPlacement.corrected,
      helpersAttached:helpers.attached,helpersHidden:helpers.hidden,
      helpersProtected:helpers.protected,
      wingOffsetsNeedAssetRepair:wingPlacement.outOfPlace,
      eyes:eyes.status(),speed,sway};},
    dispose(){
      if(disposed)return;
      disposed=true;
      eyes.dispose();
      helpers.restore();
      wingPlacement.restore?.();
      tail.forEach((node,i)=>node.quaternion.copy(tailRest[i]));
      wings.forEach((node,i)=>node.quaternion.copy(wingRest[i]));
      headGuards.forEach(({bone,rest})=>bone.quaternion.copy(rest));
    },
  };
}
