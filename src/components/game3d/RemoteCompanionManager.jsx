// RemoteCompanionManager — spawns and animates each remote player's
// companion (mount) in the shared 3D scene.
//
// One companion instance is created PER remote player_id, keyed by player id +
// companion id, so two players using the same companion type each get their
// own distinct instance with its own mixer/state.
//
// Driven by `remoteCompanionUpdate` events that MultiplayerSystem dispatches
// from the WebRTC movement payload. Each update carries:
//   { player_id, companion_id, mounted, x, y, z, yaw, anim, level }
//
// Mounted peers keep their real rider visible. A per-rider pose is applied
// after the remote-player mixer and position smoothing have updated.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getCompanionById, createCompanionLoadingManager } from './companionData';
import { loadCompanionFolderClips } from './companionAnimationLoader';
import { prepareMountAnimationClips } from './character/mountAnimations.mjs';
import {createFactionThreeMountRig,isFactionThreeMount} from './character/factionThreeMountRig.mjs';
import {createFactionThreeFacingFrame} from './character/factionThreeMountFacing.mjs';
import { createMountedRiderPose } from './player/mountedRiderPose.mjs';

// Cache the loaded companion model + clips per-definition so we don't re-fetch
// from the network for every remote player. The GLTF scene is cloned (via
// SkeletonUtils) for each instance so each player gets a unique posable mesh.
const companionCache = new Map(); // companionId -> { root, clips }

const fbxLoader = new FBXLoader();

const loadCompanionAssets = async (companionDef) => {
  if (companionCache.has(companionDef.id)) return companionCache.get(companionDef.id);

  const pending = (async () => {
    const manager = createCompanionLoadingManager(THREE, companionDef);
    const gltfLoader = manager ? new GLTFLoader(manager) : new GLTFLoader();
    const loadGLB = url => new Promise((resolve,reject)=>{
      gltfLoader.load(url,gltf=>resolve({
        root:gltf.scene||gltf.scenes?.[0],
        embeddedClips:gltf.animations||[],
      }),undefined,reject);
    });
    let effectiveDefinition=companionDef,asset;
    try {
      asset=await loadGLB(companionDef.modelUrl);
      if(!asset.root)throw new Error('Companion has no scene');
    } catch(error) {
      if(!companionDef.previousModelUrl)throw error;
      console.warn('Remote faction pet GLB unavailable; using its previous rig',error);
      effectiveDefinition={
        ...companionDef,modelUrl:companionDef.previousModelUrl,
        previousModelUrl:null,animationRigProfile:null,
      };
      asset=await loadGLB(effectiveDefinition.modelUrl);
    }
    const {root,embeddedClips}=asset;
    if(!root)throw new Error('Companion has no scene');
    let clips=await prepareMountAnimationClips(root,embeddedClips,effectiveDefinition);
    // Preserve only the legacy unconfigured animation-library path. Explicit
    // source/retarget failures never inject an unrelated FBX onto a new rig.
    if (!clips.length && !companionDef.animationSource) {
      try { clips = await loadCompanionFolderClips(fbxLoader); } catch { clips = []; }
    }
    return { root, clips, definition: effectiveDefinition };
  })();
  companionCache.set(companionDef.id, pending);
  try { return await pending; }
  catch (error) {
    if (companionCache.get(companionDef.id) === pending) companionCache.delete(companionDef.id);
    throw error;
  }
};

export function createRemoteCompanionManager(scene, {
  loadAssets = loadCompanionAssets,
  resolveDefinition = getCompanionById,
  createRiderPose = createMountedRiderPose,
} = {}) {
  // playerId -> { group, mixer, idleAction, walkAction, runAction, current,
  //               targetPos, targetYaw, mounted, companionId, level }
  const instances = new Map();
  const riders = new Map();
  let disposed = false;

  const buildInstance = async (playerId, companionId) => {
    const def = resolveDefinition(companionId);
    if (!def) return null;
    let assets;
    try { assets = await loadAssets(def); }
    catch (e) { console.error('[RemoteCompanion] load error', e); return null; }
    if (!assets?.root) return null;

    // Per-player clone — SkeletonUtils handles SkinnedMesh skeleton cloning.
    // Faction 3's visual is rotated independently of its navigation frame,
    // so all remote packets use the same +Z gameplay heading as local Play.
    const visual = SkeletonUtils.clone(assets.root);
    const renderDefinition = assets.definition || def; // safe on legacy GLB fallback
    const {worldRoot:group} = createFactionThreeFacingFrame(visual,renderDefinition);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const compScale = (1.7 / maxDim) * (def.scale || 1.0);
    group.scale.setScalar(compScale);
    // Each remote rider gets an INDEPENDENT cloned skeleton and secondary
    // spring. Never mutate the cached GLB or attach to the remote player.
    const secondaryRig=createFactionThreeMountRig(visual,renderDefinition);

    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = !node.isSkinnedMesh;
        node.receiveShadow = true;
      }
    });

    // Soft amber ring under remote companions
    const ringGeo = new THREE.RingGeometry(0.8 / compScale, 1.05 / compScale, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.45,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02 / compScale;
    group.add(ring);

    scene.add(group);

    // Bind clips
    const mixer = new THREE.AnimationMixer(visual);
    const findClip = (substr) => {
      if (!substr) return null;
      const lc = substr.toLowerCase();
      return assets.clips.find((c) => (c.name || '').toLowerCase().includes(lc)) || null;
    };
    const idleClip = findClip(def.idleClipName) || assets.clips[0];
    const walkClip = findClip(def.walkClipName) || assets.clips[1] || assets.clips[0];
    const runClip  = findClip(def.runClipName)  || assets.clips[2] || null;
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const walkAction = (walkClip && walkClip !== idleClip) ? mixer.clipAction(walkClip) : null;
    const runAction  = (runClip && runClip !== idleClip && runClip !== walkClip) ? mixer.clipAction(runClip) : null;
    if (idleAction) idleAction.reset().fadeIn(0.2).play();

    return {
      group, mixer, idleAction, walkAction, runAction, secondaryRig, definition: renderDefinition, ring,
      current: 'idle',
      hasNetworkPosition: false,
      lastMovingAt: -Infinity,
      targetPos: new THREE.Vector3(),
      targetYaw: 0,
      mounted: false,
      companionId,
      level: 1,
    };
  };

  const restoreRider = (playerId) => {
    const rider = riders.get(playerId);
    if (!rider) return;
    rider.remote.mixer?.stopAllAction();
    rider.pose.restore();
    rider.remote.group.visible = rider.previousVisible;
    const action = rider.remote.current === 'run' ? rider.remote.runAction : rider.remote.idleAction;
    action?.reset().fadeIn(0.12).play();
    riders.delete(playerId);
  };

  const disposeInstance = (inst) => {
    if (!inst?.group) return;
    scene.remove(inst.group);
    inst.mixer.stopAllAction();
    inst.secondaryRig?.dispose();
    // Geometry/materials in the cached skinned asset are shared by clones.
    // Only the ring is owned by this particular remote instance.
    inst.ring?.geometry.dispose();
    inst.ring?.material.dispose();
  };

  const removeInstance = (playerId) => {
    restoreRider(playerId);
    const inst = instances.get(playerId);
    instances.delete(playerId); // invalidate pending loads before disposing
    disposeInstance(inst);
  };

  const ensureInstance = (playerId, companionId) => {
    if (disposed) return Promise.resolve(null);
    const existing = instances.get(playerId);
    if (existing?.companionId === companionId) {
      return existing.loading ? existing.promise : Promise.resolve(existing);
    }
    if (existing) removeInstance(playerId);
    // Identity, rather than just companionId, prevents an old load from
    // replacing a newer A -> B -> A switch or resurrecting a removed player.
    const slot = { loading: true, companionId, latestUpdate: null };
    instances.set(playerId, slot);
    slot.promise = buildInstance(playerId, companionId).then((inst) => {
      if (disposed || instances.get(playerId) !== slot) {
        disposeInstance(inst);
        return null;
      }
      if (!inst) { instances.delete(playerId); return null; }
      inst.latestUpdate = slot.latestUpdate;
      instances.set(playerId, inst);
      return inst;
    });
    return slot.promise;
  };

  const setAnim = (inst, target) => {
    if (inst.current === target) return;
    const next = target === 'run' ? inst.runAction : target === 'walk' ? inst.walkAction : inst.idleAction;
    if (!next) return;
    const prev = inst.current === 'run' ? inst.runAction : inst.current === 'walk' ? inst.walkAction : inst.idleAction;
    next.reset().fadeIn(0.2).play();
    if (prev && prev !== next) prev.fadeOut(0.2);
    inst.current = target;
  };

  // Apply an update from the network
  const onUpdate = (e) => {
    const d = e.detail; if (disposed || !d || !d.player_id || !d.companion_id) return;
    const pending = ensureInstance(d.player_id, d.companion_id);
    const slot = instances.get(d.player_id);
    if (!slot) return;
    slot.latestUpdate = d;
    pending.then((inst) => {
      if (!inst || instances.get(d.player_id) !== inst || inst.latestUpdate !== d) return;
      const hasPosition = Number.isFinite(d.x) && Number.isFinite(d.z);
      const companionMoved = hasPosition && inst.hasNetworkPosition &&
        Math.hypot(d.x-inst.targetPos.x,d.z-inst.targetPos.z) > .015;
      if (Number.isFinite(d.x)) inst.targetPos.x = d.x;
      if (Number.isFinite(d.y)) inst.targetPos.y = d.y;
      if (Number.isFinite(d.z)) inst.targetPos.z = d.z;
      if (Number.isFinite(d.yaw)) inst.targetYaw = d.yaw;
      inst.mounted = !!d.mounted;
      if (Number.isFinite(d.level)) inst.level = d.level;
      const now=performance.now();
      inst.lastMotionAt=now;
      // On the first packet place the mount at its actual network location.
      // Never visibly slide a newly spawned Faction 3 animal from world 0,0.
      if (hasPosition && !inst.hasNetworkPosition &&
          isFactionThreeMount(inst.definition)) {
        inst.group.position.copy(inst.targetPos);
        inst.group.rotation.y=inst.targetYaw;
      }
      // Older owner packets reuse player animation while the unmounted animal
      // follows independently. A stationary or duplicated network packet
      // must not restart the run/idle crossfade on every update.
      const hasAnimation=['idle','walk','run'].includes(d.anim);
      const moving=inst.mounted && hasAnimation ? d.anim==='run'||d.anim==='walk' : companionMoved;
      if (moving) inst.lastMovingAt=now;
      if (hasPosition) inst.hasNetworkPosition=true;
      const holdFollowMotion=isFactionThreeMount(inst.definition) &&
        !inst.mounted && now-inst.lastMovingAt<240;
      setAnim(inst,moving || holdFollowMotion ? 'run' : 'idle');
    });
  };

  // When a remote player disappears, despawn their companion too.
  // We piggyback on the same multiplayerPlayersUpdate event for cleanup.
  const onPlayersUpdate = (e) => {
    const players = e.detail?.players || [];
    const alive = new Set(players.map((p) => p.player_id));
    instances.forEach((_, pid) => { if (!alive.has(pid)) removeInstance(pid); });
  };

  window.addEventListener('remoteCompanionUpdate', onUpdate);
  window.addEventListener('multiplayerPlayersUpdate', onPlayersUpdate);

  // Called every frame from GameWorld3D's animate loop
  const update = (delta) => {
    instances.forEach((inst) => {
      if (!inst || inst.loading || !inst.group) return;
      inst.mixer.update(delta);
      // A mount receiving no more movement updates eventually settles idle;
      // one dropped WebRTC packet must not leave a permanent running loop.
      if(inst.lastMotionAt&&performance.now()-inst.lastMotionAt>850)
        setAnim(inst,'idle');
      // Faction 3 gets frame-rate-independent interpolation plus a bounded
      // reconnect snap. Preserve other factions' existing interpolation.
      const factionThree=isFactionThreeMount(inst.definition);
      const step=Math.min(.10,Math.max(0,Number(delta)||0));
      if (factionThree && inst.hasNetworkPosition &&
          inst.group.position.distanceToSquared(inst.targetPos)>18*18)
        inst.group.position.copy(inst.targetPos);
      else inst.group.position.lerp(inst.targetPos,
        factionThree ? 1-Math.exp(-12*step) : .5);
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),inst.targetYaw);
      inst.group.quaternion.slerp(q,factionThree ? 1-Math.exp(-14*step) : .4);
      inst.secondaryRig?.update(delta); // post-network, post-mixer mount-space only
    });
  };

  // Must run after RemotePlayersManager.update and this manager's update.
  // The player root remains at its network-smoothed ground position; the
  // rider's skeleton is seated on the independently animated mount socket.
  const updateRiders = (remotes) => {
    for (const [playerId, rider] of riders) {
      const inst = instances.get(playerId);
      const remote = remotes?.get(playerId);
      if (!inst?.mounted || inst.loading || rider.mount !== inst.group || rider.remote !== remote) {
        restoreRider(playerId);
      }
    }
    instances.forEach((inst, playerId) => {
      const remote = remotes?.get(playerId);
      if (!inst?.mounted || inst.loading || !remote?.group) return;
      let rider = riders.get(playerId);
      if (!rider) {
        const pose = createRiderPose({ player: remote.group, mount: inst.group, definition: inst.definition });
        if (!pose?.supported) return;
        rider = { remote, mount: inst.group, pose, previousVisible: remote.group.visible };
        riders.set(playerId, rider);
      }
      // A new movement packet can start another idle/run action while riding.
      // Stop it before the pose pass so it cannot fight over the same bones.
      remote.mixer?.stopAllAction();
      remote.group.visible = true;
      rider.pose.update();
    });
  };

  // Retained for callers that need mounted IDs for HUD/network presentation.
  const getMountedPlayerIds = () => {
    const out = new Set();
    instances.forEach((inst, pid) => { if (inst && inst.mounted) out.add(pid); });
    return out;
  };

  const dispose = () => {
    disposed = true;
    window.removeEventListener('remoteCompanionUpdate', onUpdate);
    window.removeEventListener('multiplayerPlayersUpdate', onPlayersUpdate);
    instances.forEach((_, pid) => removeInstance(pid));
  };

  return { update, updateRiders, dispose, getMountedPlayerIds };
}
