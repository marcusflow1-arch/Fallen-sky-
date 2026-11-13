import {AvatarCustomizationRuntime} from './customizationRuntime';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {companionModel,applyCompanionAppearance} from './genesisAssets';
import {creatorBody} from './avatarCustomization';
import {characterBodyBounds,FUSED_FEMALE_CHARACTER_MODEL_URL,FUSED_MALE_CHARACTER_MODEL_URL} from '@/lib/characterModelOverrides';
import {originalGame3DModelUrl} from './legacyModelMirror.mjs';
const customizations=new WeakMap();

/**
 * The GitHub-to-Base44 migration initially copied Game 3D code without the
 * large private GLB files in public/models/characters. The existing hosted
 * platform bodies can keep a character visible while the exact files are
 * transferred. Never replace a successfully loaded authored local body.
 */
const MALE_HOSTED_BODY = 'https://base44.app/api/apps/6876751a602125f45f1861b9/files/mp/public/6876751a602125f45f1861b9/d646be928_Getsuga_Tensho_Character.glb';
const FEMALE_HOSTED_BODY = 'https://base44.app/api/apps/6876751a602125f45f1861b9/files/mp/public/6876751a602125f45f1861b9/96bb872db_Artemis_Character.glb';
const missingBodyWarnings = new Set();

function legacyBodyFallback(url) {
 const path = String(url || '').split(/[?#]/)[0];
 if (!path.startsWith('/models/characters/') &&
     !path.startsWith('https://base44.app/api/apps/6876751a602125f45f1861b9/files/')) return null;
 const name = path.split('/').pop();
 const male = new Set([
  'Male_Fused_v1.glb', 'Male_Fused_v2.glb',
  'Getsuga_Tensho_Character_v2.glb', 'Getsuga_Tensho_Character_v3.glb',
  'Getsuga_Tensho_Character_v5.glb', 'd646be928_Getsuga_Tensho_Character.glb',
 ]);
 const female = new Set([
  'Female_Fused_v1.glb', 'Female_Fused_v2.glb',
  'Artemis_Character_v2.glb', 'Artemis_Character_v3.glb',
  'Artemis_Character_v5.glb', '96bb872db_Artemis_Character.glb',
 ]);
 if (male.has(name)) return MALE_HOSTED_BODY;
 if (female.has(name)) return FEMALE_HOSTED_BODY;
 return null;
}

async function loadWithHostedFallback(url) {
 try {
  const asset = String(url).split(/[?#]/)[0].toLowerCase().endsWith('.fbx')
    ? await new FBXLoader().loadAsync(url)
    : await new GLTFLoader().loadAsync(url);
  return {asset, usedFallback:false};
 } catch (primaryError) {
  // The migration currently lacks the actual author-created GLBs in public/.
  // Before degrading to the old platform avatar, try the *exact same file* on
  // the owner's published original site. An isolated manager ensures the
  // global legacy URL modifier cannot rewrite this URL to a missing local one.
  const mirror = originalGame3DModelUrl(url);
  if (mirror) {
   try {
    const asset = await new GLTFLoader(new THREE.LoadingManager()).loadAsync(mirror);
    if (!missingBodyWarnings.has(mirror)) {
     missingBodyWarnings.add(mirror);
     console.warn('[Game 3D] Original authored model served from published Atom X Eve OS while the destination binary is missing:', url);
    }
    return {asset,usedFallback:false};
   } catch (mirrorError) {
    console.warn('[Game 3D] Original published model mirror was unavailable; trying hosted legacy avatar.', mirrorError);
   }
  }
  const hosted = legacyBodyFallback(url);
  if (!hosted) throw primaryError;
  try {
   // The default Three.js LoadingManager rewrites the hosted URL back to the
   // missing local v5 body. A fresh manager bypasses that global redirect.
   const asset = await new GLTFLoader(new THREE.LoadingManager()).loadAsync(hosted);
   if (!missingBodyWarnings.has(url)) {
    missingBodyWarnings.add(url);
    console.warn('[Game 3D] Local character GLB is unavailable; using the older hosted body until the original asset is imported.', url, primaryError);
   }
   return {asset, usedFallback:true};
  } catch (fallbackError) {
   throw new Error('Character model missing: the local 3D file and its hosted fallback could not load. Restore public/models/characters assets.', {cause:fallbackError});
  }
 }
}

// Fused Eve/Adam creator bodies are painted and recoloured by the creator
// runtime. Do NOT run them through applyCompanionAppearance: that older
// platform-avatar pass adds a second colour/style shader (including saturation,
// posterisation and global material tints) which the creator preview does not
// apply. It can make the same saved complexion bright orange/red in Game 3D.
//
// Keep the world-only scale controls without rewriting those skin materials.
export function applyFusedWorldProportions(model, appearance={}) {
 if(!model?.scale || !model?.userData)return;
 const base=model.userData.game3dFusedBaseScale ||
   (model.userData.game3dFusedBaseScale=model.scale.clone());
 const clamp=THREE.MathUtils.clamp;
 const number=(value,fallback)=>value == null || value === '' || !Number.isFinite(Number(value)) ? fallback : Number(value);
 const width=number(appearance.body_proportions?.width,1);
 const depth=number(appearance.body_proportions?.depth,1);
 const height=number(appearance.height_scale,1);
 model.scale.set(
   base.x*clamp(width,.88,1.12),
   base.y*clamp(height,.84,1.18),
   base.z*clamp(depth,.90,1.10),
 );
}

export async function loadAvatarModel(config={},height=1.8,game3dModelUrl=null){
 // The shared platform model stays canonical. Game 3D can explicitly request
 // only the allowlisted fused body matching this character's saved selection.
 const localBody=typeof config==='string'?null:creatorBody(config);
 const allowedWorldUrl=localBody?.gender==='female'?FUSED_FEMALE_CHARACTER_MODEL_URL:localBody?.gender==='male'?FUSED_MALE_CHARACTER_MODEL_URL:null;
 const fusedWorldBody=Boolean(allowedWorldUrl && game3dModelUrl===allowedWorldUrl && typeof config!=='string');
 const url=typeof config==='string'?config:fusedWorldBody?game3dModelUrl:companionModel(config);
 const {asset, usedFallback}=await loadWithHostedFallback(url);
 const model=asset.scene||asset;model.animations=asset.animations||[];
 // glTF animation extras (clip speed, events) and the file's rig id; GLTFLoader keeps neither on its own.
 const json=asset.parser?.json;if(json){model.animations.forEach((clip,i)=>{const extras=json.animations?.[i]?.extras;if(extras&&typeof extras==='object')clip.userData={...clip.userData,...extras};});const rigId=json.extras?.rigId;if(typeof rigId==='string'){model.userData.rigId=rigId;model.userData.fusedCharacter=/^fused-/.test(rigId);}}
 let box=characterBodyBounds(model);
 model.scale.multiplyScalar(height/(box.max.y-box.min.y||1));box=characterBodyBounds(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);
 model.traverse(n=>{if(n.isSkinnedMesh)n.frustumCulled=false;});
 // The in-world fused body must match the creator-stage pigment pipeline.
 // Shared platform avatars still use their original styling path.
 const previewFused=typeof config==='string' && /^\/models\/characters\/fused\/(Female|Male)_Fused_v[12]\.glb$/.test(config);
 const appearance=typeof config==='string'?{}:config;
 model.userData.game3dFusedCreatorBody=(fusedWorldBody||previewFused) && !usedFallback;
 if(usedFallback) model.userData.game3dLegacyCharacterFallback = true;
 if(model.userData.game3dFusedCreatorBody)applyFusedWorldProportions(model,appearance);
 else applyCompanionAppearance(model,appearance);
 const customization=new AvatarCustomizationRuntime(model,{gender:appearance.gender,rigId:localBody?.rig_id||model.userData.rigId});
 customizations.set(model,customization);await customization.update(appearance);
 return model;
}
export function disposeAvatarModel(model){customizations.get(model)?.dispose();customizations.delete(model);const textures=new Set(),materials=new Set(),geometries=new Set();model?.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>materials.add(m));n.skeleton?.dispose();});for(const m of materials){Object.values(m).forEach(t=>{if(t?.isTexture)textures.add(t);});m.dispose();}textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());}
export function applyPlayerAppearance(model,appearance){
 if(model?.userData?.game3dFusedCreatorBody)applyFusedWorldProportions(model,appearance);
 else applyCompanionAppearance(model,appearance);
 return customizations.get(model)?.update(appearance);
 }