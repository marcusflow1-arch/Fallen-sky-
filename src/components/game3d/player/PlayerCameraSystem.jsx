import * as THREE from 'three';
import { AXE_WORLD_SCALE } from '../axe/core/axeWorldScaleConfig';
import {
  manorGame2Follow,manorGame2CameraPose,
  manorGame2EaseCameraClip,
} from '../../dashboard/lakesideManor/manorGame2Controls.mjs';
import {GAME3D_GAME2_CAMERA,game3dToGame2Yaw} from './Game3DGame2Camera.mjs';
import {getAbilityState,clearTarget} from '../abilityStore';

const tmpCamera=new THREE.Vector3();
const tmpTarget=new THREE.Vector3();
const tmpToTarget=new THREE.Vector3();
const tmpFromPlayer=new THREE.Vector3();
const tmpBoom=new THREE.Vector3();
const tmpRayStart=new THREE.Vector3();
const tmpRayDirection=new THREE.Vector3();

export class PlayerCameraSystem {
  constructor({camera,orbit,modelRef,lockOnTargetRef,groundMeshes=[]}){
    this.camera=camera;
    this.orbit=orbit;
    this.modelRef=modelRef;
    this.lockOnTargetRef=lockOnTargetRef;
    // Shared actual player-foot/terrain meshes. No cosmetic grass or foliage,
    // custom gameplay colliders, or server authority changes.
    this.groundMeshes=groundMeshes;
    this.groundRaycaster=new THREE.Raycaster();
    this.followTarget=null;
    this.clipDistance=null;

    // Preserve the existing battle-specific target framing and safety caps.
    this.combatDistance=AXE_WORLD_SCALE.camera.combatDistance;
    this.defaultDistance=GAME3D_GAME2_CAMERA.distance;
    this.minPlayerDistance=AXE_WORLD_SCALE.camera.minimumDistance;
    this.targetHeight=AXE_WORLD_SCALE.camera.targetHeight;
  }

  clipAgainstTerrain(pose){
    const meshes=this.groundMeshes;
    if(!pose?.eye||!pose?.target||!Array.isArray(meshes)||meshes.length===0)
      return pose;
    const {eye,target}=pose;
    tmpBoom.set(eye.x-target.x,eye.y-target.y,eye.z-target.z);
    const desired=tmpBoom.length();
    if(!Number.isFinite(desired)||desired<.45)return pose;
    tmpRayDirection.copy(tmpBoom).multiplyScalar(1/desired);
    // Start just beyond the player's chest to avoid the supporting floor's
    // own near-zero contact. Cast only to the requested camera eye.
    tmpRayStart.set(target.x,target.y,target.z)
      .addScaledVector(tmpRayDirection,.2);
    this.groundRaycaster.set(tmpRayStart,tmpRayDirection);
    this.groundRaycaster.near=.02;
    this.groundRaycaster.far=desired-.2;
    const hit=this.groundRaycaster.intersectObjects(meshes,true)
      .find(h=>h?.object?.visible!==false&&Number.isFinite(h.distance));
    if(!hit)return pose;
    // Pull camera in front of real raised terrain, roofs/floors that are
    // registered as walkable, and bridge decks. Never hide visible meshes.
    const safeDistance=Math.min(desired,Math.max(.27,hit.distance-.24+.2));
    return {target,eye:{
      x:target.x+tmpRayDirection.x*safeDistance,
      y:target.y+tmpRayDirection.y*safeDistance,
      z:target.z+tmpRayDirection.z*safeDistance,
    }};
  }

  // Lock-on is entirely player initiated: an explicit left click on a visible
  // actor, or middle click along the character's narrow facing line.
  // No proximity acquisition or automatic camera snap runs in this update.

  update(delta,movementIntent={}){
    const model=this.modelRef.current;
    if(!model)return;
    const dt=Number.isFinite(delta)?Math.max(0,Math.min(delta,.12)):0;
    // Recover from an old hot-reloaded automatic lock, if one was left in
    // memory by a previous build. Never clear a manually chosen target.
    const inherited = this.lockOnTargetRef?.current;
    if (inherited?.autoAcquired) {
      this.lockOnTargetRef.current = null;
      const selected = getAbilityState()?.target;
      if (selected?.kind !== 'player' &&
          String(selected?.id) === String(inherited.id)) clearTarget();
    }
    const o=this.orbit.current;
    const lockedTarget=this.lockOnTargetRef.current;
    if(lockedTarget?.group&&(!lockedTarget.aliveRef||lockedTarget.aliveRef())){
      const targetPos=lockedTarget.group.position;
      tmpToTarget.set(targetPos.x-model.position.x,0,
        targetPos.z-model.position.z);
      const pairDistance=tmpToTarget.length();
      if(pairDistance>.001){
        tmpToTarget.normalize();
        const lockYaw=Math.atan2(-tmpToTarget.x,-tmpToTarget.z);
        const yawDelta=Math.atan2(Math.sin(lockYaw-o.yaw),
          Math.cos(lockYaw-o.yaw));
        o.yaw+=yawDelta*Math.min(1,6*dt);
      }
      const dynamicDistance=THREE.MathUtils.clamp(
        pairDistance*.45+this.combatDistance,this.combatDistance-.2,12);
      tmpTarget.addVectors(model.position,targetPos).multiplyScalar(.5);
      tmpTarget.y+=this.targetHeight*.87;
      tmpCamera.set(
        model.position.x-tmpToTarget.x*dynamicDistance,
        model.position.y+this.targetHeight+1.05,
        model.position.z-tmpToTarget.z*dynamicDistance);
      // Preserve lock-on's boss framing, but never put the camera underneath
      // a real hillside or registered architectural walkable surface.
      const safe=this.clipAgainstTerrain({
        target:{x:tmpTarget.x,y:tmpTarget.y,z:tmpTarget.z},
        eye:{x:tmpCamera.x,y:tmpCamera.y,z:tmpCamera.z}});
      tmpCamera.set(safe.eye.x,safe.eye.y,safe.eye.z);
      this.camera.position.lerp(tmpCamera,1-Math.exp(-10*dt));
      tmpFromPlayer.subVectors(this.camera.position,model.position);
      if(tmpFromPlayer.lengthSq()<
          this.minPlayerDistance*this.minPlayerDistance||
          tmpFromPlayer.dot(tmpToTarget)>-.35){
        this.camera.position.copy(tmpCamera);
      }
      this.camera.lookAt(tmpTarget);
      this.followTarget=null;
      this.clipDistance=null;
      return;
    }

    if (lockedTarget) {
      this.lockOnTargetRef.current = null;
      const selected = getAbilityState()?.target;
      if (selected && String(selected.id) === String(lockedTarget.id) &&
          selected.kind === lockedTarget.kind) clearTarget();
    }
    if(!Number.isFinite(o.yaw))o.yaw=0;
    if(!Number.isFinite(o.pitch))o.pitch=GAME3D_GAME2_CAMERA.pitch;
    const pos=model.position;
    if(!this.followTarget||Math.hypot(
      this.followTarget.x-pos.x,
      this.followTarget.y-pos.y,
      this.followTarget.z-pos.z)>18){
      // Respawns, portal transfers and teleports need a fresh follow target.
      this.followTarget={x:pos.x,y:pos.y,z:pos.z};
      this.clipDistance=null;
    }else{
      this.followTarget=manorGame2Follow(this.followTarget,pos,dt);
    }
    const requested=Number.isFinite(o.distance)?o.distance:this.defaultDistance;
    // Keep sprint responsiveness while retaining a close, shoulder-level shot.
    const pullback=movementIntent?.sprintHeld?.42:0;
    const distance=Math.min(GAME3D_GAME2_CAMERA.maxDistance,
      Math.max(GAME3D_GAME2_CAMERA.minDistance,requested+pullback));
    const pose=manorGame2CameraPose({
      ...this.followTarget,yaw:game3dToGame2Yaw(o.yaw),
      pitch:o.pitch,distance});
    // World 3D retains terrain/bridge/indoor *actual geometry* ray tests;
    // Luna's smooth recovery comes after immediate obstruction contraction.
    const clipped=this.clipAgainstTerrain(pose);
    const eased=manorGame2EaseCameraClip(clipped,this.clipDistance,dt,12);
    this.clipDistance=eased.distance;
    this.camera.position.set(
      eased.pose.eye.x,eased.pose.eye.y,eased.pose.eye.z);
    this.camera.lookAt(
      eased.pose.target.x,eased.pose.target.y,eased.pose.target.z);
  }
}
