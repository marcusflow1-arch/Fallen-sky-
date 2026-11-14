import * as THREE from 'three';

// Game 3D bow shots use the same tiny centre dot that the player sees.
// This resolver runs on an attack, never every frame. It chooses only living
// hostiles in the camera ray or its small edge-grace radius; it does not roll
// damage, grant rewards, alter lock state or accept remote players.
export const BOW_AIM_SETTINGS=Object.freeze({
  maxRange:70,
  edgeNdc:0.055,
  lockedEdgeNdc:0.09,
  blockPadding:0.45,
  markerRadiusPx:3,
});
const box=new THREE.Box3();
const center=new THREE.Vector3();
const projected=new THREE.Vector3();
const ray=new THREE.Raycaster();
const blockerRay=new THREE.Raycaster();
const temp=new THREE.Vector3();

function visibleHostile(t){
  return Boolean(t?.id && t.group?.position &&
    t.group.visible!==false && t.alive!==false &&
    !t.dying && !t.defeated && Number(t.hp??1)>0);
}
function actorPoint(t){
  // Actual mesh center is more faithful for tall bosses than the pivot on
  // their feet; use the pivot if this model has not loaded geometry yet.
  try{
    box.setFromObject(t.group);
    if(!box.isEmpty())return box.getCenter(new THREE.Vector3());
  }catch{/* still loading */}
  return new THREE.Vector3(t.group.position.x,t.group.position.y+1.1,t.group.position.z);
}
function blocked(camera,point,groundMeshes){
  if(!Array.isArray(groundMeshes)||!groundMeshes.length)return false;
  temp.copy(point).sub(camera.position);
  const distance=temp.length();
  if(distance<.6)return false;
  blockerRay.set(camera.position,temp.multiplyScalar(1/distance));
  blockerRay.near=.35;
  blockerRay.far=distance-BOW_AIM_SETTINGS.blockPadding;
  return blockerRay.intersectObjects(groundMeshes,true).some(h=>
    h.object?.visible!==false && Number.isFinite(h.distance) &&
    h.distance<distance-BOW_AIM_SETTINGS.blockPadding);
}

export function selectCameraBowTarget({camera,origin,enemies=[],bosses=[],
  maxRange=BOW_AIM_SETTINGS.maxRange,lockedEnemyId=null,groundMeshes=[]}={}){
  if(!camera?.isCamera||!origin||!(maxRange>0))return null;
  camera.updateMatrixWorld(true);
  ray.setFromCamera({x:0,y:0},camera);
  ray.near=.25;
  ray.far=maxRange+20;
  const candidates=[];
  for(const target of [...enemies,...bosses]){
    if(!visibleHostile(target))continue;
    const distance=Math.hypot(
      target.group.position.x-origin.x,
      target.group.position.y-origin.y,
      target.group.position.z-origin.z);
    if(distance>maxRange||distance<.05)continue;
    target.group.updateMatrixWorld(true);
    const intersection=ray.intersectObject(target.group,true)[0];
    const point=intersection?.point?.clone()||actorPoint(target);
    projected.copy(point).project(camera);
    if(!(projected.z>-1&&projected.z<1))continue;
    const error=Math.hypot(projected.x,projected.y);
    const threshold=String(target.id)===String(lockedEnemyId)
      ?BOW_AIM_SETTINGS.lockedEdgeNdc:BOW_AIM_SETTINGS.edgeNdc;
    if(!intersection&&error>threshold)continue;
    if(blocked(camera,point,groundMeshes))continue;
    candidates.push({target,distance,locked:String(target.id)===String(lockedEnemyId),
      point,error,rayHit:!!intersection,rayDistance:intersection?.distance??Infinity});
  }
  candidates.sort((a,b)=>Number(b.rayHit)-Number(a.rayHit) ||
    (a.rayHit&&b.rayHit?a.rayDistance-b.rayDistance:0) ||
    a.error-b.error || Number(b.locked)-Number(a.locked) || a.distance-b.distance);
  return candidates[0]||null;
}

export function cameraBowImpactPoint(camera,groundMeshes=[],maxDistance=52){
  if(!camera?.isCamera)return null;
  camera.updateMatrixWorld(true);
  const caster=new THREE.Raycaster();
  caster.setFromCamera({x:0,y:0},camera);
  caster.near=.3;caster.far=maxDistance;
  const ground=Array.isArray(groundMeshes)
    ?caster.intersectObjects(groundMeshes,true).find(h=>h.object?.visible!==false)
    :null;
  return ground?.point?.clone()||caster.ray.at(maxDistance,new THREE.Vector3());
}

export function pickCameraBowCombatTargets(args={}){
  const hit=selectCameraBowTarget(args);
  return hit?[{target:hit.target,distance:hit.distance,locked:hit.locked,point:hit.point}]:[];
}
