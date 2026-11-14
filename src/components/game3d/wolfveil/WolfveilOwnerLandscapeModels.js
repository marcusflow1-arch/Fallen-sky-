// Optional user-uploaded Wolfveil models. Loads each asset once and batches
// a small number of curated route-side instances. No new gameplay colliders,
// duplicate walkable floors, engine lights or server movement permissions.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {classifyTreeMaterialPart} from '../render/LivingTreeWindPhysics.mjs';
import {
 WOLFVEIL_UPLOADED_LANDSCAPE_ASSETS as ASSETS,
 chooseWolfveilOwnerAssetAnchors,
} from './WolfveilOwnerLandscapeAssets.mjs';
import {decimateGeometry} from '../render/decimateGeometry.js';

function acceptableSource(mesh){
 return mesh?.isMesh===true && mesh.geometry?.isBufferGeometry===true &&
   mesh.geometry.attributes?.position?.count>0;
}
function normalizedGeometry(source,bounds,asset){
 const geometry=source.geometry.clone();
 // This includes Sketchfab/FBX Y-up corrections and parent transform.
 geometry.applyMatrix4(source.matrixWorld);
 const size=bounds.getSize(new THREE.Vector3());
 const width=Math.max(size.x,size.z,1e-5);
 const height=Math.max(size.y,1e-5);
 const scale=Math.min(asset.maxWidth/width,asset.maxHeight/height);
 geometry.translate(-bounds.getCenter(new THREE.Vector3()).x,
   -bounds.min.y,-bounds.getCenter(new THREE.Vector3()).z);
 geometry.scale(scale,scale,scale);
 // Hold every copy to its triangle budget; shape and fullness are kept.
 const light=decimateGeometry(geometry,asset.maxTriangles);
 if(light!==geometry)geometry.dispose();
 light.computeBoundingSphere();
 light.computeVertexNormals();
 return light;
}
function sourceMaterial(mesh,wind,kind,sourceHeight){
 const safeHeight=Math.max(.1,sourceHeight);
 const make=(original)=>{
  const base=original?.isMeshStandardMaterial||original?.isMeshPhysicalMaterial
    ?original.clone()
    :new THREE.MeshStandardMaterial({
      color:0xffffff,map:original?.map??null,roughness:.91,
    });
  base.side=THREE.DoubleSide;
  if(kind==='tree'){
    // Preserve the original bark/foliage UVs and PBR detail. Remove the
    // previous cyan emissive fantasy tint: trees now shade as ordinary living
    // green foliage and brown natural wood under the world lights.
    base.emissive.set(0x000000);
    base.emissiveIntensity=0;
    if(base.color)base.color.set(0xffffff);
  }
  base.transparent=original?.transparent===true;
  base.depthWrite=original?.depthWrite!==false;
  const before=base.onBeforeCompile.bind(base);
  base.onBeforeCompile=(shader,renderer)=>{
   before(shader,renderer);
   if(!shader.vertexShader.includes('#include <common>')||
      !shader.vertexShader.includes('#include <begin_vertex>'))return;
   if(kind==='tree'){
     // Correct overly blue foliage texels *after* the imported albedo and
     // vertex colors, leaving natural brown bark and fine texture intact.
     shader.fragmentShader=shader.fragmentShader.replace(
       '#include <color_fragment>',`#include <color_fragment>
vec3 treeSample=diffuseColor.rgb;
float treeBlue=clamp((treeSample.b-max(treeSample.r,treeSample.g)*.92)*2.2,0.0,1.0);
float treeValue=dot(treeSample,vec3(.2126,.7152,.0722));
vec3 treeNatural=vec3(treeValue*.67,treeValue*.98,treeValue*.48);
diffuseColor.rgb=mix(treeSample,treeNatural,treeBlue*.85);`);
   }
   shader.uniforms.uOwnerTime=wind.time;
   shader.uniforms.uOwnerGust=wind.gust;
   shader.uniforms.uOwnerWind=wind.dir;
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>',`#include <common>
uniform float uOwnerTime,uOwnerGust;
uniform vec2 uOwnerWind;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 ownerRoot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
#else
vec3 ownerRoot=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
#endif
float ownerFlex=smoothstep(.18,.91,position.y/${safeHeight.toFixed(4)});
float ownerWave=sin(uOwnerTime*(.9+ownerRoot.x*.001)+
 ownerRoot.x*.14+ownerRoot.z*.11);
transformed.xz+=normalize(uOwnerWind+vec2(.001))*
 ownerWave*(.014+.095*uOwnerGust)*ownerFlex;`);
  };
  base.customProgramCacheKey=()=> 'wolfveil-owner-uploaded-natural-wood-foliage-'+kind+
    '-'+safeHeight.toFixed(4)+'-'+(original?.name||'material')+'-v2';
  base.name='SWV_Uploaded_'+kind+'_'+(original?.name||'Plant');
  return base;
 };
 // FBX may contain separate bark and foliage material groups. Preserve those
 // group indices rather than applying one canopy map to the entire tree.
 return Array.isArray(mesh.material)
   ?mesh.material.map(make)
   :make(mesh.material);
}
function traverseTextures(root,target){
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material])){
   if(!mat)continue;
   for(const key of ['map','normalMap','roughnessMap','metalnessMap',
     'aoMap','alphaMap','emissiveMap'])if(mat[key]?.isTexture)target.add(mat[key]);
  }
 });
}
// User FBX texture atlas is for the ancient tree only. The asset's UV mapping
// remains responsible for the appearance; no destructive material remapping.
function applyTreeAtlas(root,texture){
 if(!texture)return;
 root.traverse(mesh=>{
  if(!acceptableSource(mesh))return;
  for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
   if(!material)return;
   if(material.map)continue; // retain any authored textured material
   material.map=texture;
   if(material.color)material.color.set(0xffffff);
   material.needsUpdate=true;
  }
 });
}

export function installWolfveilOwnerLandscapeModels(world,{
 flowPlan,forestTrees=[],trail,onStatus=()=>{},
}={}){
 if(!world?.group||!flowPlan)return null;
 const anchorSets=chooseWolfveilOwnerAssetAnchors({
  grass:flowPlan.grass,shrubs:flowPlan.shrubs,forestTrees,trail,
 });
 const group=new THREE.Group();
 group.name='SWV_OwnerUploaded_RouteSide_Models';
 // Same local coordinates and +70m market offset as the live terrain.
 world.group.add(group);
 const wind={time:{value:0},gust:{value:.25},
  dir:{value:new THREE.Vector2(.6,.8)}};
 const records=[],textures=new Set(),failed=new Set(),loadedKinds=new Set();
 let disposed=false,loaded=0;
 const status=()=>({loaded,loadedKinds:[...loadedKinds],failed:[...failed],total:4,
  grassCopies:anchorSets.grass.length,
  plantCopies:anchorSets.plants.length,
  gardenCopies:anchorSets.garden.length,
  existingColliderTrees:anchorSets.tree.length});
 const announce=()=>{if(!disposed)onStatus(status());};

 function installRoot(kind,root){
  if(disposed)return;
  root.updateMatrixWorld(true);
  const asset=ASSETS[kind],anchors=anchorSets[kind];
  let meshes=[];
  root.traverse(mesh=>{if(acceptableSource(mesh))meshes.push(mesh);});
  if(!meshes.length)throw Error(kind+' has no usable mesh');
  traverseTextures(root,textures);
  // A packed six-plant GLB must not render all six high-poly meshes at each
  // location. Select the lighter authored variants. Garden GLB was pruned
  // offline from 101.7 MB to 5.7 MB, preserving four real leaf meshes.
  if(kind==='plants')meshes=meshes.filter((_,i)=>[1,2,5].includes(i));
  if(kind==='garden')meshes=meshes.filter((_,i)=>i<4);
  if(kind==='grass')meshes=meshes.slice(0,1);
  if(!meshes.length)throw Error(kind+' has no selected lightweight mesh');
  const whole=new THREE.Box3().setFromObject(root);
  for(const [i,src] of meshes.entries()){
   const spots=kind==='tree'?anchors:anchors.filter((_,j)=>j%meshes.length===i);
   if(!spots.length)continue;
   const bounds=kind==='tree'?whole:
      new THREE.Box3().setFromObject(src);
   if(bounds.isEmpty())continue;
   const geometry=normalizedGeometry(src,bounds,asset);
   const boundsHeight=geometry.boundingBox?.max.y??asset.maxHeight;
   const material=sourceMaterial(src,wind,kind,boundsHeight);
   const instanced=new THREE.InstancedMesh(geometry,material,spots.length);
   const dummy=new THREE.Object3D();
   spots.forEach((p,j)=>{
    dummy.position.set(p.x,p.y-.015,p.z);
    dummy.rotation.set(0,Number.isFinite(p.yaw)?p.yaw:
      Number.isFinite(p.rot)?p.rot:0,0);
    const size=.88+((j*7+i*5)%9)*.028;
    dummy.scale.setScalar(size);
    dummy.updateMatrix();instanced.setMatrixAt(j,dummy.matrix);
   });
   instanced.instanceMatrix.needsUpdate=true;
   instanced.computeBoundingSphere();
   instanced.name='SWV_Owner_'+kind+'_'+i;
   instanced.receiveShadow=true;
   instanced.castShadow=kind==='tree'; // existing authoritative trunk colliders
   instanced.raycast=()=>{}; // never a duplicate floor/interaction target
   instanced.userData={decorativeOnly:true,
     existingTrunkCollider:kind==='tree',source:'owner_uploaded_model',
     blazeTreeFamily:kind==='tree'?classifyTreeMaterialPart(
       src.name+' '+(Array.isArray(src.material)
         ?src.material.map(m=>m?.name||'').join(' ')
         :(src.material?.name||'')),'foliage'):undefined,
     blazeTreeUpAxis:kind==='tree'?'y':undefined,
     blazeImportedOwnerTree:kind==='tree'};
   group.add(instanced);
   records.push({mesh:instanced,material,geometry});
  }
  loadedKinds.add(kind);
  loaded++;
  announce();
  if(kind==='tree'&&typeof window!=='undefined')
    window.dispatchEvent(new Event('axe:owner-tree-ready'));
 }
 const gltfLoader=new GLTFLoader(),fbxLoader=new FBXLoader();
 for(const kind of ['grass','plants','garden','tree']){
  const asset=ASSETS[kind];
  const success=(loadedAsset)=>{
   const root=loadedAsset?.scene??loadedAsset;
   if(disposed)return;
   try{installRoot(kind,root);}
   catch(error){failed.add(kind+':'+String(error?.message??error));announce();}
  };
  const failure=(error)=>{
   if(!disposed){failed.add(kind+':'+String(error?.message??error));announce();}
  };
  if(kind==='tree'){
   const texture=new THREE.TextureLoader();
   texture.load(asset.basecolor,tex=>{
    if(disposed){tex.dispose();return;}
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.needsUpdate=true;textures.add(tex);
    fbxLoader.load(asset.url,root=>{applyTreeAtlas(root,tex);success(root);},
     undefined,failure);
   },undefined,()=>{
    // An unavailable color image cannot remove the user's existing trees.
    fbxLoader.load(asset.url,success,undefined,failure);
   });
  }else gltfLoader.load(asset.url,success,undefined,failure);
 }
 announce();
 return {group,status,update(frame={}){
   if(disposed)return;
   if(Number.isFinite(frame.time))wind.time.value=frame.time;
   if(Number.isFinite(frame.gust))
    wind.gust.value=Math.max(0,Math.min(1,frame.gust));
   if(Array.isArray(frame.wind)&&frame.wind.length===2&&
      frame.wind.every(Number.isFinite))
    wind.dir.value.set(frame.wind[0],frame.wind[1]);
  },dispose(){
   if(disposed)return;
   disposed=true;
   group.parent?.remove(group);
   for(const r of records){
    r.mesh.parent?.remove(r.mesh);
    r.mesh.dispose?.();
    r.geometry.dispose();
    for(const mat of (Array.isArray(r.material)?r.material:[r.material]))
      mat.dispose();
   }
   for(const tex of textures)tex.dispose();
   records.length=0;textures.clear();
  }};
}