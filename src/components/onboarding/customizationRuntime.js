import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHAPE_CONTROLS, RIG_IDS } from '@/components/onboarding/avatarCustomization';
import { applyRegionAppearance, bindBodyRegions, regionCapabilities } from './bodyRegions.js';
import { clearFusedHairFromEyes } from './creatorModelQuality';
import { bindFusedMakeup } from './creatorMakeup.js';
import { bindCreatorHairColor } from './creatorHairColor.js';
import { ensureHairSprings, disposeHairSprings } from './hairSprings.js';
import { ensureFemaleBodySprings, disposeFemaleBodySprings } from './bodySprings.js';
// Layer-owned secondary bones (hair spring chains from tools/avatar-fuse) do not
// exist on the body: they keep their own joints and hang from the matching body bone.
const SECONDARY_BONE=/^Hair_[A-Za-z0-9_]+_S\d+_\d+$/;

const morphHooks=new WeakSet();
const surfaceSources=new WeakMap();
// A fused GLB can export Hair_Default_primitive0 or Hair_Default.001, and the
// default may be the parent of several child meshes. Hide all original strands
// when a fitted style is active, not only one exact-name node.
export function isCreatorDefaultHair(node,requestedNames=['Hair_Default']) {
 if(!node?.isMesh||node.userData?.creatorLayer||node.userData?.customizationSurface)return false;
 return requestedNames.some(name=>{
  const prefix=String(name).toLowerCase();
  let current=node;
  while(current){
   const part=String(current.name||'').toLowerCase();
   if(part===prefix || (part.startsWith(prefix)&&['.','_','-',' '].includes(part.charAt(prefix.length))))return true;
   current=current.parent;
  }
  return false;
 });
}

export function materialChannel(mesh,material) {
 const explicit=material?.userData?.avatarCustomization?.channel || mesh?.userData?.avatarCustomization?.channel;
 if(['skin','hair','iris','brows'].includes(explicit))return explicit;
 const name=String(material?.name||'');
 if(/iris/i.test(name))return 'iris';
 if(/(?:^|_)skin(?:_|$)/i.test(name))return 'skin';
 if(/(?:^|_)hair(?:_|$)/i.test(name))return 'hair';
 if(/(?:^|_)brows?(?:_|$)/i.test(name))return 'brows';
 return '';
}
export function inspectCustomization(root) {
 const result={shapes:[],skin:false,hair:false,iris:false,brows:false,meshNames:[],boneNames:[]};
 const morphs=new Set();
 root?.traverse(n=>{
  if(n.isBone)result.boneNames.push(n.name);
  if(!n.isMesh||n.userData?.customizationSurface)return;
  result.meshNames.push(n.name);
  if(!n.visible)return;
  (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{const c=materialChannel(n,m);if(c)result[c]=true;});
  Object.keys(n.morphTargetDictionary||{}).forEach(name=>morphs.add(name));
 });
 result.shapes=SHAPE_CONTROLS.filter(c=>morphs.has(c.morph)).map(c=>c.id);
 // bodies painted as one atlas expose skin, hair and garments through baked region masks (bodyRegions.js)
 const regions=regionCapabilities(root);
 result.skin ||= regions.skin;result.hair ||= regions.hair;result.garments=regions.garments;result.skinMask=regions.skin;
 return result;
}
export function applyCustomizationAppearance(root,appearance={}) {
 root?.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.customizationSurface)return;
  // Only CC_ shape keys are persistent customization. Expression tracks still
  // own blinks, lips, brows and the jaw throughout the authored animation.
  if(mesh.morphTargetDictionary) {
   const indices=SHAPE_CONTROLS.filter(c=>mesh.morphTargetDictionary[c.morph]!==undefined);
   mesh.userData.creatorMorphs=indices.map(c=>[mesh.morphTargetDictionary[c.morph],THREE.MathUtils.clamp(Number(appearance.shape_controls?.[c.id]||0),c.min??0,1)]);
   if(!morphHooks.has(mesh)) {
    const before=mesh.onBeforeRender;
    mesh.onBeforeRender=function(...args){before?.apply(this,args);applyPersistentShapes(this);};
    morphHooks.add(mesh);
   }
   applyPersistentShapes(mesh);
  }
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const next=list.map((material,index)=>{
   // Preview pigments are mapped to actual Skin_Head polygons, not gloss.
   if(/^Skin_Head(?:\\.|$)/i.test(material?.name||''))bindFusedMakeup(mesh,material,index,appearance);
   if(applyRegionAppearance(material,appearance))return material;
   const channel=materialChannel(mesh,material);
   if(!channel)return material;
   if(!material.userData.creatorOriginal)material.userData.creatorOriginal={color:(material.userData.genesisBase?.color||material.color)?.clone(),roughness:material.roughness,metalness:material.metalness};
   const original=material.userData.creatorOriginal;
   const enabled=channel==='skin'?appearance.skin_tint_enabled:channel==='iris'?appearance.eye_tint_enabled:appearance.hair_tint_enabled;
   const tint=channel==='skin'?appearance.skin_tone:channel==='iris'?appearance.eye_color:appearance.hair_color;
   if(material.color&&original.color)material.color.copy(original.color);
   // Hair atlases can be nearly black: ordinary PBR multiplication cannot
   // produce blond/pale colors. Shader tint replaces hue while preserving
   // the source hair's per-pixel contrast and painted strand detail.
   const shaderHair=channel==='hair' &&
     bindCreatorHairColor(material,tint,enabled);
   if(enabled&&/^#[a-f0-9]{6}$/i.test(tint||'')&&!shaderHair) {
    const strength=channel==='skin'?THREE.MathUtils.clamp(Number(appearance.skin_tint_strength??1),0,1):1;
    if(strength>=1||!material.color)material.color?.set(tint);else material.color.lerp(new THREE.Color(tint),strength);
   }
   if(channel==='skin') {
    if(appearance.skin_highlight_enabled&&!material.isMeshPhysicalMaterial) {
     const physical=new THREE.MeshPhysicalMaterial();
     THREE.MeshStandardMaterial.prototype.copy.call(physical,material);
     physical.onBeforeCompile=material.onBeforeCompile;
     physical.customProgramCacheKey=material.customProgramCacheKey;
     physical.userData=material.userData;
     material.dispose();material=physical;
    }
    if(appearance.skin_finish_enabled)material.roughness=THREE.MathUtils.lerp(.9,.23,THREE.MathUtils.clamp(appearance.skin_finish??.35,0,1));
    if(material.specularColor)material.specularColor.set(appearance.skin_highlight_enabled?appearance.skin_highlight_color:'#ffffff');
    material.metalness=0;
   }
   return material;
  });
  mesh.material=Array.isArray(mesh.material)?next:next[0];
 });
}
export function applyPersistentShapes(mesh) {
 // two-sided keys go negative (the opposite shape); values are already clamped per control above
 for(const [index,value] of mesh.userData.creatorMorphs||[])mesh.morphTargetInfluences[index]=THREE.MathUtils.clamp(value,-1,1);
}
const disposeLayer=root=>{
 (root?.userData?.secondaryBones||[]).forEach(b=>b.removeFromParent());
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 root?.traverse(n=>{if(!n.isMesh)return;if(!n.userData?.sharedCreatorGeometry&&n.geometry)geometries.add(n.geometry);if(n.skeleton)skeletons.add(n.skeleton);(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(!m)return;materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});});
 root?.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());
};

export function bindCustomizationLayer(baseRoot,layer,asset) {
 const bones=new Map(),baseInverses=new Map();
 baseRoot.traverse(n=>{if(n.isBone&&!n.userData?.creatorLayerBone)bones.set(n.name,n);if(n.isSkinnedMesh&&!n.userData?.creatorLayer) n.skeleton.bones.forEach((b,i)=>{if(!baseInverses.has(b.name))baseInverses.set(b.name,n.skeleton.boneInverses[i]);});});
 if(asset.binding==='socket') {
  const bone=bones.get(asset.attach_bone);
  if(!bone)throw Error('The attachment bone is missing from this body.');
  let skinned=false;layer.traverse(n=>{skinned ||= !!n.isSkinnedMesh;});
  if(skinned)throw Error('Use skinned binding for a rigged attachment.');
  bone.add(layer);
 }else {
  let count=0;const secondary=new Set();
  layer.traverse(mesh=>{
   if(mesh.isMesh&&!mesh.isSkinnedMesh)throw Error('Every mesh in a skinned layer must use the selected body rig. Use a bone attachment for rigid accessories.');
   if(!mesh.isSkinnedMesh)return;
   count++;
   const source=mesh.skeleton;
   const target=source.bones.map((bone,i)=>{
    const matched=bones.get(bone.name),inverse=baseInverses.get(bone.name);
    if(!matched&&SECONDARY_BONE.test(bone.name)){secondary.add(bone);return bone;}
    if(!matched||!inverse)throw Error('This layer has bones that do not match the selected body.');
    if(source.boneInverses[i].elements.some((v,k)=>Math.abs(v-inverse.elements[k])>.001))throw Error('This layer was exported in a different bind pose. Re-export it on the selected body rig.');
    return matched;
   });
   mesh.bind(new THREE.Skeleton(target,source.boneInverses.map(m=>m.clone())),mesh.bindMatrix.clone());
   source.dispose();mesh.frustumCulled=false;mesh.userData.creatorLayer=true;
  });
  if(!count)throw Error('No skin rig found. Use a bone attachment for a rigid accessory.');
  // Drop the unused source bones. Skinned meshes now share the base skeleton,
  // so every idle, walk and attack moves the layer with the body.
  // Spring chains move onto the body: each chain's first joint hangs from the
  // body bone its parent was matched to, with the same (bind-pose) local offset.
  const chainRoots=[...secondary].filter(b=>!secondary.has(b.parent));
  for(const b of chainRoots){const anchor=bones.get(b.parent?.name);if(!anchor)throw Error('A hair chain hangs from a bone this body does not have.');anchor.add(b);}
  layer.userData.secondaryBones=chainRoots;
  const sourceBones=[];layer.traverse(n=>{if(n.isBone){n.userData.creatorLayerBone=true;if(!n.parent?.isBone)sourceBones.push(n);}});
  secondary.forEach(b=>{b.userData.creatorLayerBone=true;});
  sourceBones.forEach(n=>n.removeFromParent());
  baseRoot.add(layer);
 }
 layer.userData.creatorLayerRoot=true;
 return layer;
}

export class AvatarCustomizationRuntime {
 constructor(root,{gender='male',rigId='',onChange=()=>{},onState=()=>{}}={}) {
  // rigId: the creator's fused bodies use their own rig id; every other body keeps RIG_IDS
  this.root=root;this.gender=gender;this.rigId=rigId||RIG_IDS[gender];this.onChange=onChange;this.onState=onState;this.layers=new Map();this.hidden=new Map();this.revision=0;this.key='';this.disposed=false;this.appearance={};
  // Like the existing hair spring chains, enable cosmetic motion only for the
  // owner's fused female Game 3D body. Missing sculpt keys fail closed.
  this.bodySprings=gender==='female'&&/^fused-female/.test(this.rigId)
    ? ensureFemaleBodySprings(root) : null;
  this.regions=bindBodyRegions(root).then(bound=>{if(bound&&!this.disposed){this.apply();this.onChange(inspectCustomization(this.root));}return bound;});
 }
 async update(appearance={}) {
  this.appearance=appearance;
  // Built-in creator layers (fused hair and tattoos) only fit their own body: on any
  // other body (Game 3D still renders the v5 bodies) they are skipped, not an error.
  const assets=(appearance.customization_assets||[]).filter(a=>appearance.selected_assets?.[a.slot]===a.id&&!(a.builtin&&a.rig_id!==this.rigId)).sort((a,b)=>(a.binding==='surface'?2:a.slot==='body'?0:1)-(b.binding==='surface'?2:b.slot==='body'?0:1));
  const key=JSON.stringify(assets.map(a=>[a.id,a.file_url,a.binding,a.hide_meshes,a.target_meshes,a.target_materials,a.attach_bone,a.tint_materials]));
  if(key===this.key){this.apply();return;}
  this.key=key;const revision=++this.revision;this.onState({loading:true,error:''});
  const created=[];
  const retiringNodes=new Set();this.layers.forEach(item=>item.root.traverse(n=>retiringNodes.add(n)));
  try {
   for(const asset of assets) {
    if(asset.gender!==this.gender||asset.rig_id!==this.rigId)throw Error('This layer is not compatible with the selected body.');
    if(asset.binding==='surface') {
     const texture=await new THREE.TextureLoader().loadAsync(asset.file_url);
     texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
     const group=new THREE.Group();created.push({asset,root:group});
     // target_materials (built-in layers): the body mesh whose material has that exact name
     const byMaterial=n=>(asset.target_materials||[]).some(name=>(Array.isArray(n.material)?n.material:[n.material]).some(m=>m?.name===name));
     const candidates=[];this.root.traverse(n=>{if(n.isMesh&&!n.userData?.customizationSurface&&!n.userData?.creatorLayer&&!retiringNodes.has(n)&&((asset.target_meshes||[]).includes(n.name)||byMaterial(n)))candidates.push(n);});
     if(!candidates.length){texture.dispose();throw Error('The surface layer targets a mesh that is missing from this body.');}
     candidates.forEach(base=>{
      const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:.8,side:THREE.DoubleSide});
      const overlay=base.isSkinnedMesh?new THREE.SkinnedMesh(base.geometry,material):new THREE.Mesh(base.geometry,material);
      surfaceSources.set(overlay,base);
      overlay.userData.customizationSurface=true;overlay.userData.sharedCreatorGeometry=true;overlay.name='CreatorSurface_'+asset.slot;overlay.frustumCulled=false;overlay.renderOrder=2;
      if(base.isSkinnedMesh)overlay.bind(new THREE.Skeleton(base.skeleton.bones,base.skeleton.boneInverses.map(m=>m.clone())),base.bindMatrix.clone());
      overlay.morphTargetDictionary=base.morphTargetDictionary;overlay.morphTargetInfluences=base.morphTargetInfluences;
      overlay.onBeforeRender=()=>{applyPersistentShapes(base);overlay.morphTargetInfluences=base.morphTargetInfluences;};
      // Local transform matches the target mesh, while both skeletons use the
      // same animated base bones.
      overlay.position.copy(base.position);overlay.quaternion.copy(base.quaternion);overlay.scale.copy(base.scale);
      // Commit overlays only after the whole replacement transaction succeeds.
      group.userData.surfacePlacements ||= [];group.userData.surfacePlacements.push({base,overlay});
      group.userData.surfaceMeshes ||= [];group.userData.surfaceMeshes.push(overlay);
     });
    }else {
     const gltf=await new GLTFLoader().loadAsync(asset.file_url);created.push({asset,root:gltf.scene});
     // Bind after every replacement finishes loading: do not overlap old and
     // new hair on the same frame while a network request is pending.
    }
    if(this.disposed||revision!==this.revision){created.forEach(x=>this.disposeItem(x));return;}
   }
   for(const {asset,root} of created) {
    if(asset.binding!=='surface') {
      bindCustomizationLayer(this.root,root,asset);
      // Keep main's eye-clearance pass, but only after successful loading so
      // default and replacement hair never coexist while awaiting GLTF.
      if(asset.slot==='hair'&&asset.builtin)
        clearFusedHairFromEyes(this.root,root);
    }
   }
   // All swaps happen synchronously after load. A failed load leaves the old
   // hair visible; a successful swap never renders the original and the
   // selected hairstyle on top of each other.
   this.restoreHidden();this.layers.forEach(x=>this.disposeItem(x));
   this.layers=new Map(created.map(x=>[x.asset.slot,x]));
   for(const {root} of created)
    for(const {base,overlay} of root.userData.surfacePlacements||[])
     base.parent?.add(overlay);
   for(const {asset} of created)for(const name of asset.hide_meshes||[]) {
    this.root.traverse(n=>{
     if(isCreatorDefaultHair(n,[name]) ||
        (n.isMesh&&!n.userData.creatorLayer&&!n.userData.customizationSurface&&n.name===name)){
      if(!this.hidden.has(n))this.hidden.set(n,n.visible);
      n.visible=false;
     }
    });
   }
   this.apply();this.onChange(inspectCustomization(this.root));this.onState({loading:false,error:''});
  }catch(error) {
   created.forEach(x=>this.disposeItem(x));
   if(!this.disposed&&revision===this.revision){this.key='';this.onState({loading:false,error:error.message||'The selected layer could not load.'});}
  }
 }
 apply() {
  applyCustomizationAppearance(this.root,this.appearance);
  ensureHairSprings(this.root);
  this.layers.forEach(({asset,root})=>{
   const color=this.appearance.layer_colors?.[asset.slot] || (['hair','eyebrows','facial_hair'].includes(asset.slot)&&this.appearance.hair_tint_enabled?this.appearance.hair_color:null);
   const nodes=root.userData.surfaceMeshes||[root];
   nodes.forEach(n=>n.traverse(mesh=>{if(!mesh.isMesh)return;if(surfaceSources.has(mesh))mesh.visible=surfaceSources.get(mesh).visible;(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>{
    m.userData.creatorLayerColor ||= m.color?.clone();
    if(m.color&&m.userData.creatorLayerColor)m.color.copy(m.userData.creatorLayerColor);
    const recolored=asset.slot==='hair' &&
      bindCreatorHairColor(m,color,Boolean(color));
    if(!recolored&&color&&(asset.binding==='surface'||asset.tint_materials?.includes(m.name)||
       (asset.slot==='hair'&&materialChannel(mesh,m)==='hair')))
     m.color?.set(color);
    if(asset.binding==='surface'){
     m.opacity=THREE.MathUtils.clamp(Number(this.appearance.layer_opacity?.[asset.slot]??1),0,1);
     m.transparent=true;
    }
   });}));
  });
 }
 restoreHidden(){this.hidden.forEach((value,node)=>{node.visible=value;});this.hidden.clear();}
 disposeItem(item){(item.root.userData.surfaceMeshes||[]).forEach(disposeLayer);disposeLayer(item.root);}
 dispose(){disposeHairSprings(this.root);disposeFemaleBodySprings(this.root);this.disposed=true;this.revision++;this.restoreHidden();this.layers.forEach(x=>this.disposeItem(x));this.layers.clear();}
}