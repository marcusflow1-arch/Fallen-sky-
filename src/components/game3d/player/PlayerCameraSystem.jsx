import * as THREE from 'three';
import { AXE_WORLD_SCALE } from '../axe/core/axeWorldScaleConfig';
import {
  manorGame2Follow,manorGame2CameraPose,
  manorGame2EaseCameraClip,
} from '../../dashboard/lakesideManor/manorGame2Controls.mjs';
import {GAME3D_GAME2_CAMERA,game3dToGame2Yaw} from './Game3DGame2Camera.mjs';
import {getActiveCharacter} from '../characterStore';
import {isAXEAutoTargetNearbyEnabled} from '../axe/player/AXEControlSettingsStore';
import {getAbilityState,setTarget,clearTarget} from '../abilityStore';
import {
  GAME3D_EVE_ADAM_AUTO_LOCK,isEveAdamGame3DHero,
  isAutoLockEnemyValid,chooseEveAdamAutoTarget,makeEveAdamAutoLockTarget,
} from './Game3DAutoTargetLock.mjs';

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
    this.autoLockModel=null;
    this.autoLockAge=0;
    this.autoLockScanAge=0;
    this.autoLockManagedId=null;
    this.autoLockLastRef=null;
    this.autoLockSuppressId=null;
    this.autoLockPause=0;

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

  // Auto-lock is explicitly opt-in through Controls, and defaults OFF.
  // Mere proximity / enemy spawning must never take camera control.
  // Existing middle-click locks always take priority; no auto PvP targeting.
  // A manual middle-click that clears our own lock temporarily suspends auto
  // acquisition and excludes that same foe until it leaves retention range.
  updateEveAdamAutoLock(delta,model){
    if(!model?.position||!this.lockOnTargetRef)return;
    const dt=Number.isFinite(delta)?Math.max(0,Math.min(delta,.12)):0;
    if(model!==this.autoLockModel){
      // Character selection can replace Eve with Adam in the same world.
      // An old automatically acquired foe must not follow the new avatar.
      const previous=this.lockOnTargetRef.current;
      if(previous?.autoAcquired){
        this.lockOnTargetRef.current=null;
        if(getAbilityState()?.target?.kind!=='player' &&
           String(getAbilityState()?.target?.id)===String(previous.id))
          clearTarget();
      }
      this.autoLockModel=model;
      this.autoLockAge=0;
      this.autoLockScanAge=0;
      this.autoLockManagedId=null;
      this.autoLockLastRef=null;
      this.autoLockSuppressId=null;
      this.autoLockPause=0;
    }
    this.autoLockAge+=dt;
    this.autoLockPause=Math.max(0,this.autoLockPause-dt);
    const current=this.lockOnTargetRef.current;
    if(this.autoLockManagedId!==null && current!==this.autoLockLastRef){
      // Only a user/manual handler can replace or clear our live managed ref.
      if(!current){
        this.autoLockSuppressId=this.autoLockManagedId;
        this.autoLockPause=2;
        // Manual middle-click on the already auto-locked foe clears the
        // camera ref. Clear its stale HP bar too; keep PvP selections intact.
        const selected=getAbilityState()?.target;
        if(selected&&selected.kind!=='player'&&
           String(selected.id)===this.autoLockManagedId)clearTarget();
      }
      this.autoLockManagedId=null;
      this.autoLockLastRef=null;
    }
    const global=typeof window!=='undefined'?window:null;
    const disabled=!global||!isAXEAutoTargetNearbyEnabled()||
      !isEveAdamGame3DHero(model,getActiveCharacter())||
      global.__axeUiModalOpen||global.__axeServiceModeOpen||
      global.__axeWorldMapOpen||global.__axePauseMenuOpen||
      global.__axeTileInspectionEditing||global.__game3dDedicatedMode||
      global.__activeDuel||typeof document!=='undefined'&&document.hidden;
    const release=(target)=>{
      if(this.lockOnTargetRef.current!==target)return;
      this.lockOnTargetRef.current=null;
      this.autoLockManagedId=null;
      this.autoLockLastRef=null;
      // Do not erase a manually selected player or a changed ability target.
      const selected=getAbilityState()?.target;
      if(selected&&selected.kind!=='player'&&
          String(selected.id)===String(target.id))clearTarget();
    };
    if(disabled){
      if(current?.autoAcquired)release(current);
      return;
    }
    if(this.autoLockSuppressId!==null){
      const candidates=[
        ...(Array.isArray(global.__gw3dEnemies)?global.__gw3dEnemies:[]),
        ...(Array.isArray(global.__gw3dBosses)?global.__gw3dBosses:[]),
        ...(Array.isArray(global.__gw3dRogues)?global.__gw3dRogues:[]),
      ];
      const ex=candidates.find(e=>String(e?.id)===this.autoLockSuppressId);
      if(!isAutoLockEnemyValid(ex,model.position))
        this.autoLockSuppressId=null;
    }
    if(current?.autoAcquired){
      if(isAutoLockEnemyValid(current.sourceEnemy,model.position))return;
      release(current); // dead, hidden, out of reach: camera returns to follow.
    }else if(current){
      return; // user-selected enemy or player must never be overwritten
    }
    if(this.autoLockAge<GAME3D_EVE_ADAM_AUTO_LOCK.enterDelaySeconds||
        this.autoLockPause>0)return;
    this.autoLockScanAge+=dt;
    if(this.autoLockScanAge<GAME3D_EVE_ADAM_AUTO_LOCK.scanIntervalSeconds)
      return;
    this.autoLockScanAge=0;
    const target=chooseEveAdamAutoTarget({
      origin:model.position,yaw:this.orbit.current.yaw,
      enemies:global.__gw3dEnemies,bosses:global.__gw3dBosses,
      rogues:global.__gw3dRogues,
      excludeIds:this.autoLockSuppressId===null?[]:[this.autoLockSuppressId],
    });
    if(!target)return;
    const category=(global.__gw3dBosses||[]).includes(target)?'boss':
      (global.__gw3dRogues||[]).includes(target)?'rogue':'enemy';
    const lock=makeEveAdamAutoLockTarget(target,category);
    if(!lock)return;
    this.lockOnTargetRef.current=lock;
    this.autoLockLastRef=lock;
    this.autoLockManagedId=String(lock.id);
    // Use the existing compact upper-right HP rail, without making attacks,
    // moving the player, awarding damage or altering worker PvP authority.
    setTarget({
      id:lock.id,name:lock.name,kind:lock.kind,
      hp:target.hp,maxHp:target.maxHp,level:target.level,
      bossName:target.bossName||null,tier:target.tier||lock.kind,
    });
  }

  update(delta,movementIntent={}){
    const model=this.modelRef.current;
    if(!model)return;
    const dt=Number.isFinite(delta)?Math.max(0,Math.min(delta,.12)):0;
    this.updateEveAdamAutoLock(dt,model);
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

    if(lockedTarget)this.lockOnTargetRef.current=null;
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
