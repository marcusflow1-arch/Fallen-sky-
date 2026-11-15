import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FACTION_PET_RIG_PROFILES,combineNativeFactionPetClips,proceduralFactionPetGait}
  from './factionPetAnimationRigs.mjs';
import {sanitizeFactionThreeNativeClips} from './factionThreeMountRig.mjs';

// Inspected the owner's original baby_wolf Take 001 (439 keys, 30fps),
// including rendered frames and repeated-pose comparisons. These are complete
// repeating cycles, excluding the transitions between the three behaviours.
// The montage is mostly idle, not three equally sized animations.
export const DOG_MOUNT_CYCLES = Object.freeze({
  idle: Object.freeze([0, 161 / 30]),
  run: Object.freeze([323 / 30, 349 / 30]),
  walk: Object.freeze([389 / 30, 415 / 30]),
});

const normalize = name => String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const sourceCache = new Map();

/** Extract exact boundaries, including interpolated keys, and rebase to zero. */
export function sliceMountClip(clip, name, start, end) {
  if (!clip || !(start >= 0 && end > start && end <= clip.duration + 1e-5)) {
    throw new Error(`Invalid ${name} mount animation range`);
  }
  const tracks = clip.tracks.map(track => {
    const times = [start, ...Array.from(track.times).filter(t => t > start + 1e-6 && t < end - 1e-6), end];
    const interpolant = track.createInterpolant();
    const values = times.flatMap(time => Array.from(interpolant.evaluate(time)));
    const copy = new track.constructor(track.name, times.map(t => t - start), values, track.getInterpolation());
    return copy;
  });
  return new THREE.AnimationClip(name, end - start, tracks);
}

export function splitDogMountClips(clips = []) {
  const named = ['idle', 'walk', 'run'].map(name => clips.find(clip => normalize(clip.name) === name));
  if (named.every(Boolean)) return named.map(clip => clip.clone());
  const montage = clips.find(clip => /take.?001/i.test(clip.name) && Math.abs(clip.duration - 14.6) < .05);
  if (!montage) throw new Error('Expected the inspected 14.6 second baby-wolf montage');
  return ['idle', 'walk', 'run'].map(name => sliceMountClip(montage, name, ...DOG_MOUNT_CYCLES[name]));
}

// These mappings are anatomical, verified against each uploaded skin's world
// joint positions. Tripo labels alone are unreliable: the wolf's Head_* chain
// is its tail, and the tiger's Left/Right labels are reversed. Never rename an
// FBX track and apply its local rotation directly to a different bind pose.
export const DOG_MOUNT_RIG_MAPS = {
  faction_bear: {
    'tripo::Spine_0': 'RigPelvis_01', 'tripo::Spine_1': 'RigSpine2_08',
    'tripo::Spine_2': 'RigChest_010', 'tripo::Head_0': 'RigNeck2_018', 'bone_5': 'RigHead_021',
    'tripo::0_Left_Limb_0': 'RigLFLeg1_012', 'tripo::0_Left_Limb_1': 'RigLFLeg2_013',
    'tripo::0_Left_Limb_2': 'RigLFLeg3_014', 'tripo::0_Left_Limb_3': 'RigLFLegAnkle_015',
    'tripo::0_Left_Limb_4': 'RigLFLegDigit11_016',
    'tripo::0_Right_Limb_0': 'RigRFLeg1_034', 'tripo::0_Right_Limb_1': 'RigRFLeg2_035',
    'tripo::0_Right_Limb_2': 'RigRFLeg3_036', 'tripo::0_Right_Limb_3': 'RigRFLegAnkle_037',
    'tripo::0_Right_Limb_4': 'RigRFLegDigit11_038',
    'tripo::1_Left_Limb_0': 'RigLBLeg1_02', 'tripo::1_Left_Limb_1': 'RigLBLeg2_03',
    'tripo::1_Left_Limb_2': 'RigLBLeg3_04', 'tripo::1_Left_Limb_3': 'RigLBLegAnkle_05',
    'tripo::1_Left_Limb_4': 'RigLBLegDigit11_06',
    'tripo::1_Right_Limb_0': 'RigRBLeg1_041', 'tripo::1_Right_Limb_1': 'RigRBLeg2_042',
    'tripo::1_Right_Limb_2': 'RigRBLeg3_043', 'tripo::1_Right_Limb_3': 'RigRBLegAnkle_044',
    'tripo::1_Right_Limb_4': 'RigRBLegDigit11_045',
  },
  faction_armored_wolf: {
    'tripo::0_Left_Limb_0': 'RigPelvis_01', 'tripo::Spine_0': 'RigSpine1_07',
    'tripo::Spine_1': 'RigSpine2_08', 'tripo::Spine_2': 'RigChest_010',
    'bone_9': 'RigNeck2_018', 'bone_10': 'RigHead_021',
    'tripo::Spine_3': 'RigLFLegCollarbone_011', 'bone_13': 'RigLFLeg1_012',
    'bone_14': 'RigLFLeg2_013', 'bone_15': 'RigLFLegAnkle_015',
    'bone_16': 'RigRFLegCollarbone_033', 'bone_17': 'RigRFLeg1_034',
    'bone_18': 'RigRFLeg2_035', 'bone_19': 'RigRFLegAnkle_037',
    'tripo::0_Left_Limb_1': 'RigLBLeg1_02', 'tripo::0_Left_Limb_2': 'RigLBLeg2_03',
    'tripo::0_Left_Limb_3': 'RigLBLeg3_04', 'tripo::0_Left_Limb_4': 'RigLBLegAnkle_05',
    'bone_26': 'RigRBLeg1_041', 'bone_27': 'RigRBLeg2_042', 'bone_28': 'RigRBLeg3_043',
    'tripo::Head_0': 'RigTail1_046', 'tripo::Head_1': 'RigTail2_047',
    'tripo::Head_2': 'RigTail3_048', 'tripo::0_Right_Limb_0': 'RigTail4_049',
  },
  faction_tiger: {
    'tripo::Spine_0': 'RigPelvis_01', 'tripo::Spine_1': 'RigChest_010', 'tripo::Head_0': 'RigHead_021',
    'tripo::0_Right_Limb_0': 'RigLFLegCollarbone_011', 'tripo::0_Right_Limb_1': 'RigLFLeg1_012',
    'tripo::0_Right_Limb_2': 'RigLFLeg2_013',
    'tripo::0_Left_Limb_0': 'RigRFLegCollarbone_033', 'tripo::0_Left_Limb_1': 'RigRFLeg1_034',
    'tripo::0_Left_Limb_2': 'RigRFLeg2_035', 'tripo::0_Left_Limb_3': 'RigRFLegAnkle_037',
    'tripo::1_Right_Limb_0': 'RigLBLeg1_02', 'tripo::1_Right_Limb_1': 'RigLBLeg2_03',
    'tripo::1_Left_Limb_0': 'RigRBLeg1_041', 'tripo::1_Left_Limb_1': 'RigRBLeg2_042',
    'tripo::1_Left_Limb_2': 'RigRBLeg3_043',
  },
};

const nodesByName = root => {
  const nodes = new Map();
  root.traverse(node => nodes.set(normalize(node.name), node));
  return nodes;
};
const saveTransforms = root => {
  const saved = [];
  root.traverse(node => saved.push([node, node.position.clone(), node.quaternion.clone(), node.scale.clone()]));
  return () => {
    for (const [node, position, quaternion, scale] of saved) {
      node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale);
    }
    root.updateMatrixWorld(true);
  };
};

/** Bake source world-space rest deltas into each target's own local bind axes. */
export function retargetDogMountClips(sourceRoot, sourceClips, targetRoot, companionId, mappingOverride = null) {
  const mapping = mappingOverride || DOG_MOUNT_RIG_MAPS[companionId];
  if (!mapping) throw new Error(`No inspected mount rig map for ${companionId}`);
  const clips = splitDogMountClips(sourceClips);
  sourceRoot.updateMatrixWorld(true); targetRoot.updateMatrixWorld(true);
  const sourceNodes = nodesByName(sourceRoot), targetNodes = nodesByName(targetRoot);
  const restoreSource = saveTransforms(sourceRoot), restoreTarget = saveTransforms(targetRoot);
  const sourceInverse = sourceRoot.getWorldQuaternion(new THREE.Quaternion()).invert();
  const targetRootRotation = targetRoot.getWorldQuaternion(new THREE.Quaternion());
  const targetInverse = targetRootRotation.clone().invert();
  const pairs = new Map();
  for (const [targetName, sourceName] of Object.entries(mapping)) {
    const target = targetNodes.get(normalize(targetName)), source = sourceNodes.get(normalize(sourceName));
    if (!target || !source || !target.isBone || !source.isBone) {
      throw new Error(`Mount rig mismatch: ${companionId} ${targetName} <- ${sourceName}`);
    }
    pairs.set(target, {
      source,
      inverseRest: sourceInverse.clone().multiply(source.getWorldQuaternion(new THREE.Quaternion())).invert(),
      targetRest: targetInverse.clone().multiply(target.getWorldQuaternion(new THREE.Quaternion())),
    });
  }
  // Parent-first order matters when a target omits joints from the source rig.
  const order = [];
  targetRoot.traverse(node => { if (pairs.has(node)) order.push(node); });
  const result = [];
  const mixer = new THREE.AnimationMixer(sourceRoot);
  try {
    for (const clip of clips) {
      const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const frameCount = Math.max(2, Math.round(clip.duration * 30));
      const times = Array.from({ length: frameCount + 1 }, (_, i) => clip.duration * i / frameCount);
      const rotations = new Map(order.map(node => [node, []]));
      for (const time of times) {
        restoreTarget();
        mixer.setTime(time); sourceRoot.updateMatrixWorld(true);
        for (const node of order) {
          const pair = pairs.get(node);
          const desiredWorld = sourceInverse.clone().multiply(pair.source.getWorldQuaternion(new THREE.Quaternion()))
            .multiply(pair.inverseRest).multiply(pair.targetRest).premultiply(targetRootRotation);
          const parentInverse = node.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
          node.quaternion.copy(parentInverse.multiply(desiredWorld)).normalize();
          node.updateMatrixWorld(true);
          rotations.get(node).push(...node.quaternion.toArray());
        }
      }
      const tracks = order.map(node => new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, rotations.get(node)));
      result.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
      mixer.stopAllAction();
      restoreSource();
    }
    return result;
  } finally {
    mixer.stopAllAction(); mixer.uncacheRoot(sourceRoot);
    restoreSource(); restoreTarget();
  }
}

function loadDogSource(definition) {
  const url = definition.animationModelUrl;
  if (!url) return Promise.reject(new Error('Missing baby-wolf animation source URL'));
  if (!sourceCache.has(url)) {
    const manager = new THREE.LoadingManager();
    const manifest = definition.animationBundleManifest || {};
    manager.setURLModifier(resource => manifest[resource] || manifest[resource.split('/').pop()] || resource);
    // Only the source skeleton and animation buffers are required. Loading its
    // 17MB diffuse image for every mount session serves no visible purpose.
    const pending = new THREE.FileLoader(manager).setResponseType('json').loadAsync(url).then(json => {
      const skeleton = structuredClone(json);
      delete skeleton.images; delete skeleton.textures; delete skeleton.materials; delete skeleton.meshes;
      for (const node of skeleton.nodes || []) { delete node.mesh; delete node.skin; }
      return new GLTFLoader(manager).parseAsync(JSON.stringify(skeleton), new URL('.', url).href);
    }).catch(error => { sourceCache.delete(url); throw error; });
    sourceCache.set(url, pending);
  }
  return sourceCache.get(url);
}

/** Shared by local Play and remote-player companions; unknown models retain native clips. */
export async function prepareMountAnimationClips(root, embeddedClips = [], definition = {}) {
  if (definition.animationSource === 'baby-wolf-bundled') return splitDogMountClips(embeddedClips);
  if (definition.animationSource !== 'baby-wolf-retarget')
    return sanitizeFactionThreeNativeClips(root,embeddedClips,definition);
  // The newly uploaded faction 2/3 models contain their own genuine idle
  // animation (tail + wings). Preserve it, retarget the existing baby wolf
  // WALK/RUN tracks onto their inspected joint maps, and include the native
  // wing/tail motion in both movement cycles. Faction 1 and legacy models
  // retain their original, previously verified animation paths.
  if (definition.animationRigProfile) {
    const profile=FACTION_PET_RIG_PROFILES[definition.animationRigProfile];
    if(!profile)throw new Error('Unknown faction pet animation rig: '+definition.animationRigProfile);
    try {
      const source=await loadDogSource(definition);
      const gait=retargetDogMountClips(source.scene,source.animations||[],root,definition.id,profile.map);
      // #160's retargeted wolf root-pelvis rotation was still steering the
      // animal visually sideways, fighting the corrected world facing. Apply
      // the same Faction-3-only pelvis/unsafe-track filter to the gait as
      // the native clip, while leaving all four animated legs intact.
      const steadyGait=sanitizeFactionThreeNativeClips(root,gait,definition);
      return combineNativeFactionPetClips(sanitizeFactionThreeNativeClips(root,embeddedClips,definition),steadyGait,definition.animationRigProfile);
    } catch(error) {
      console.warn('Faction pet baby-wolf gait unavailable; using native idle and local gait',error);
      return proceduralFactionPetGait(root,sanitizeFactionThreeNativeClips(root,embeddedClips,definition),definition.animationRigProfile);
    }
  }
  const source = await loadDogSource(definition);
  return retargetDogMountClips(source.scene, source.animations || [], root, definition.id);
}
