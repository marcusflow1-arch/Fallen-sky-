// Game 1 / Game 3D: visible native tree assets owned by the player.
// The three elm shapes are a LOD-optimized subset of the real high-detail
// elm tree collection already uploaded to this Base44 app. Their PBR bark and
// alpha-cut foliage maps are kept, and their original geometries are reused by
// shared instanced draw calls. Game 2 intentionally never imports this code.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {classifyTreeMaterialPart} from './LivingTreeWindPhysics.mjs';

// Only foreground deciduous trees get the heavyweight original model.
// Unmodified procedural pine/trees provide a safe fallback when the asset is
// unavailable, and lower-cost silhouettes beyond the playable area.
export function selectOwnerElmTrees(trees){
  return trees.filter(t=>t.near&&t.species!=='pine'&&
      Math.hypot(t.x,t.z)>9&&Math.hypot(t.x,t.z)<57&&
      (t.seed%17)<9).slice(0,30);
}
const VARIANTS=['elm-broad','elm-slim','elm-wild'];
function applyPbrWind(material,uniform){
  material.side=THREE.DoubleSide;
  material.transparent=false;
  material.alphaTest=Math.max(.12,material.alphaTest||0);
  material.userData.nativeForestUniform=uniform;
  material.customProgramCacheKey=()=> 'game1-owner-original-elm-wind-v2';
  material.onBeforeCompile=shader=>{
    shader.uniforms.uNativeTime=uniform.uNativeTime;
    shader.uniforms.uNativeWind=uniform.uNativeWind;
    shader.uniforms.uNativeGust=uniform.uNativeGust;
    shader.uniforms.uNativeRain=uniform.uNativeRain;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float uNativeTime,uNativeGust,uNativeRain;
uniform vec2 uNativeWind;`).replace('#include <begin_vertex>',`#include <begin_vertex>
// Original trees are authored in Z-up coordinates and the source's final
// 0.1 scale is applied by the imported parent transform. Wind acts only on
// leaves, tapering from the branch center to the outer rim.
float tip=clamp((abs(position.x)+abs(position.y))*0.006,0.0,1.0);
float sway=sin(uNativeTime*1.63+position.x*.08+position.y*.03)*.57
  +sin(uNativeTime*2.4+position.y*.09)*.21;
transformed.xy +=normalize(uNativeWind+vec2(.0001))*tip*
  (sway*uNativeGust*1.7);
transformed.z -=tip*uNativeRain*.9;`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
uniform float uNativeRain;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb*=mix(1.0,.76,uNativeRain);`);
  };
}
export function installGame1OwnerElms(scene,trees,onReady,selection=selectOwnerElmTrees){
  const selected=selection(trees);
  const uniform={
    uNativeTime:{value:0},uNativeWind:{value:new THREE.Vector2(.7,.7)},
    uNativeGust:{value:.3},uNativeRain:{value:0},
  };
  const state={
    status:'loading',installed:0,expected:selected.length,instances:[],
    selected:new Set(),error:null,
    update(frame){
      uniform.uNativeTime.value=frame.time;
      uniform.uNativeWind.value.set(...frame.wind);
      uniform.uNativeGust.value=frame.gust;
      uniform.uNativeRain.value=frame.rain;
    },
    dispose(){
      disposed=true;
      for(const obj of state.instances)scene.remove(obj);
      for(const obj of state.instances)obj.dispose();
      state.instances.length=0;
      if(asset){
        asset.traverse(o=>{if(o.isMesh)o.geometry?.dispose();});
        const mats=new Set();
        asset.traverse(o=>{if(o.isMesh)mats.add(o.material);});
        const textures=new Set();
        for(const m of mats)if(m){
          for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])
            if(m[key])textures.add(m[key]);
          m.dispose();
        }
        for(const tex of textures)tex.dispose();
      }
      state.status='disposed';
    },
  };
  let disposed=false,asset=null;
  if(!selected.length || typeof window==='undefined'){
    state.status=selected.length?'disabled':'empty';
    return state;
  }
  const loader=new GLTFLoader();
  loader.load('/game3d/elm-owner-optimized.glb',gltf=>{
    asset=gltf.scene;
    if(disposed){state.dispose();return;}
    asset.updateMatrixWorld(true);
    const added=[];
    const selectedMap=new Map();
    for(let i=0;i<selected.length;i++){
      const t=selected[i],key=VARIANTS[i%VARIANTS.length];
      if(!selectedMap.has(key))selectedMap.set(key,[]);
      selectedMap.get(key).push(t);
    }
    try{
      for(const name of VARIANTS){
        const group=asset.getObjectByName(name);
        const placements=selectedMap.get(name)||[];
        if(!group||!placements.length)continue;
        group.traverse(object=>{
          if(!object.isMesh) return;
          const importedMat=object.material;
          if(/leaf|foliage|canopy/i.test(object.name)){
            // Keep the GLB's original UVs, alpha leaf maps and wind hook.
            for(const material of Array.isArray(importedMat)?importedMat:[importedMat])
              if(material)applyPbrWind(material,uniform);
          }
          const inst=new THREE.InstancedMesh(object.geometry,importedMat,placements.length);
          inst.name='Game 1 ORIGINAL uploaded elm / '+name+' / '+object.name;
          inst.userData.blazeTreeFamily=classifyTreeMaterialPart(
            object.name+' '+(Array.isArray(importedMat)
              ?importedMat.map(m=>m?.name||'').join(' ')
              :(importedMat?.name||'')),'foliage');
          inst.userData.blazeTreeUpAxis='z'; // original elm GLB is Z-up
          inst.userData.blazeImportedOwnerTree=true;
          inst.frustumCulled=false; // tight culling requires an instance BVH
          inst.castShadow=/bark/i.test(object.name);inst.receiveShadow=true;
          const authored=object.matrixWorld.clone();
          const dummy=new THREE.Object3D();
          for(let i=0;i<placements.length;i++){
            const t=placements[i];
            // Original GLTF tree is ~17 metres tall after authoring transform.
            const ratio=t.height/(name==='elm-slim'?17.50:name==='elm-wild'?16.67:16.87);
            dummy.position.set(t.x,t.y,t.z);
            dummy.rotation.y=(t.seed%6283)/1000;
            dummy.scale.setScalar(ratio*(.92+(t.seed%11)*.014));
            dummy.updateMatrix();
            inst.setMatrixAt(i,dummy.matrix.clone().multiply(authored));
          }
          inst.instanceMatrix.needsUpdate=true;
          scene.add(inst);added.push(inst);
        });
      }
      if(!added.length)throw Error('GLB contains no compatible elm meshes');
      state.instances=added;
      state.installed=selected.length;
      state.selected=new Set(selected);
      state.status='ready';
      onReady?.(state.selected);
      if(typeof window!=='undefined')
        window.dispatchEvent(new Event('axe:owner-tree-ready'));
    }catch(err){
      for(const obj of added){scene.remove(obj);obj.dispose();}
      state.error=String(err?.message||err);
      state.status='error';
      console.error('Game1 owner elm integration failed, procedural foliage preserved',err);
    }
  },undefined,err=>{
    state.error=String(err?.message||err);
    state.status='error';
    console.warn('Game1 owner elm GLB unavailable; procedural forest retained',err);
  });
  return state;
}
