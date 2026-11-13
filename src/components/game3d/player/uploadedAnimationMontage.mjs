import { AnimationClip, ObjectLoader, VectorKeyframeTrack } from 'three';
import { retargetAvatarClip } from '../../onboarding/retargetAvatarClip.js';
import { UPLOADED_PLAYER_ACTIONS } from './playerAnimationActions.mjs';

export const UPLOADED_MONTAGE_URL = '/game3d/animations/player-montage-v1.json';
let packPromise;
const actorClips = new WeakMap();

// The owner-supplied 39-action Mixamo montage is retargeted onto BOTH fused
// character skeletons. Previously it was enabled only for Eve, so Adam stayed
// on fallbacks despite having compatible, validated bone bindings.
export function usesUploadedPlayerMontage(target) {
  return /^fused-(?:female|male)(?:-|$)/i.test(target?.userData?.rigId || '');
}
// Retain the old export so already-importing modules remain compatible.
export const usesUploadedEveMontage = usesUploadedPlayerMontage;

function groundingFor(pack, target) {
  const correction = pack.grounding;
  if (!correction || target.userData.rigId !== correction.rigId) return null;
  const bones = new Map();
  target.traverse(node => node.skeleton?.bones.forEach((bone, index) => {
    if (!bones.has(bone.name)) bones.set(bone.name, { bone, inverse: node.skeleton.boneInverses[index] });
  }));
  if (!correction.bindPose?.length || correction.bindPose.some(row => {
    const actual = bones.get(row.name);
    const parentName = actual?.bone.parent?.isBone ? actual.bone.parent.name : null;
    return !actual || parentName !== row.parent ||
      row.inverseBind.some((value, index) => Math.abs(value - actual.inverse.elements[index]) > 0.000002);
  })) return null;
  return correction.actions;
}

function prepareDecode(pack, target) {
  if (pack?.version !== 1 || !Array.isArray(pack.rigs) || !Array.isArray(pack.actions)) {
    throw new Error('Invalid uploaded player animation montage');
  }
  const rigs = pack.rigs.map(json => new ObjectLoader().parse(json));
  const expected = new Map(UPLOADED_PLAYER_ACTIONS.map(action => [action.key, action]));
  return { rigs, expected, clips: {}, grounding: groundingFor(pack, target) };
}

function decodeAction(entry, target, { rigs, expected, clips, grounding }) {
    const descriptor = expected.get(entry.key);
    if (!descriptor || descriptor.fileName !== entry.fileName || clips[entry.key] || !rigs[entry.rig]) {
      throw new Error(`Invalid uploaded montage action: ${entry.key}`);
    }
    const source = AnimationClip.parse(entry.clip);
    const clip = retargetAvatarClip(rigs[entry.rig], target, source);
    const floor = grounding?.[entry.key];
    if (floor) {
      const hips = clip.tracks.find(track => /(?:hips|pelvis)\.position$/i.test(track.name));
      if (hips) {
        const base = hips.createInterpolant();
        const values = floor.times.flatMap((time, index) => {
          const position = Array.from(base.evaluate(time));
          position[1] += floor.offsets[index];
          return position;
        });
        clip.tracks = clip.tracks.map(track => track === hips
          ? new VectorKeyframeTrack(hips.name, floor.times, values) : track);
      }
    }
    if (!clip.tracks.length || !(clip.duration > 0)) throw new Error(`Empty montage action: ${entry.key}`);
    // Every emitted track must bind to this actor; a foreign skeleton cannot
    // silently pass through as an apparently successful animation load.
    for (const track of clip.tracks) {
      const nodeName = track.name.slice(0, track.name.lastIndexOf('.'));
      if (!target.getObjectByName(nodeName)) throw new Error(`Unbound montage track: ${track.name}`);
      if (!Array.from(track.values).every(Number.isFinite)) throw new Error(`Invalid montage track: ${track.name}`);
    }
    clip.name = `uploaded_${entry.key}`;
    clip.userData = { montage: 'owner-upload-20261112', sourceFile: entry.fileName,
      sourceSha256: entry.sha256, groundingApplied: !!floor };
    clips[entry.key] = clip;
}

function finishDecode(state) {
  if (Object.keys(state.clips).length !== state.expected.size) throw new Error('Uploaded montage is incomplete');
  return state.clips;
}

export function decodeUploadedAnimationMontage(pack, target) {
  const state = prepareDecode(pack, target);
  for (const entry of pack.actions) decodeAction(entry, target, state);
  return finishDecode(state);
}

export async function loadUploadedAnimationMontage(target, { enabled = usesUploadedPlayerMontage(target), fetchPack } = {}) {
  if (!enabled || !target) return {};
  if (actorClips.has(target)) return actorClips.get(target);
  const pending = (async () => {
    const read = fetchPack || (() => {
      if (!packPromise) packPromise = fetch(UPLOADED_MONTAGE_URL).then(response => {
        if (!response.ok) throw new Error(`Player montage request failed (${response.status})`);
        return response.json();
      }).catch(error => { packPromise = null; throw error; });
      return packPromise;
    });
    const pack = await read();
    const state = prepareDecode(pack, target);
    for (const entry of pack.actions) {
      // Retarget one clip per event-loop slice while the native animation
      // keeps rendering, rather than freezing the page for the whole pack.
      await new Promise(resolve => setTimeout(resolve, 0));
      decodeAction(entry, target, state);
    }
    return finishDecode(state);
  })();
  actorClips.set(target, pending);
  try { return await pending; }
  catch (error) { actorClips.delete(target); throw error; }
}
