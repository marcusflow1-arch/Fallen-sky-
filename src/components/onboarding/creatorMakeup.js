// Preview-only cosmetic pigments for fused Skin_Head materials.
// Bounds are measured from the material's actual triangles, not a guessed
// whole-body bounding box. No changes to original GLB UVs or topology.
import * as THREE from 'three';

const HEX=/^#[a-f0-9]{6}$/i;
export const MAKEUP_COLORS={
  lip:['#a4495c','#c76f73','#7e394f','#c48c72','#7c5262','#b84c45'],
  blush:['#c47776','#dc9b87','#b65d76','#926c73','#c78b64'],
  eye:['#66516b','#806b59','#455b72','#987687','#6e6e69'],
};
export function normalizedMakeup(value={}){
 const get=(key,f)=>HEX.test(String(value[key]||''))?value[key]:f;
 const strength=Number(value.makeup_strength);
 return {
  enabled:value.makeup_enabled===true,
  strength:Number.isFinite(strength)?THREE.MathUtils.clamp(strength,0,1):.55,
  lip:get('makeup_lip_color','#a4495c'),
  blush:get('makeup_blush_color','#c47776'),
  eye:get('makeup_eye_color','#66516b'),
 };
}

// Restrict the pigment mask to the material index's mesh groups. Joined
// female/male bodies use one mesh containing both Skin_Body and Skin_Head.
export function skinHeadBounds(mesh,materialIndex){
 const geometry=mesh?.geometry,positions=geometry?.attributes?.position;
 if(!positions)return null;
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 const groups=geometry.groups?.length?geometry.groups:
  (materials.length===1?[{start:0,count:geometry.index?.count||positions.count,materialIndex:0}]:[]);
 const active=groups.filter(group=>group.materialIndex===materialIndex);
 if(!active.length)return null;
 const index=geometry.index,bounds=new THREE.Box3().makeEmpty();
 let used=0;
 const point=new THREE.Vector3();
 for(const group of active){
  const end=Math.min((index?.count??positions.count),group.start+group.count);
  for(let k=group.start;k<end;k++){
   const i=index?index.getX(k):k;
   if(i<0||i>=positions.count)continue;
   point.fromBufferAttribute(positions,i);
   if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))continue;
   bounds.expandByPoint(point);used++;
  }
 }
 if(used<6||bounds.isEmpty())return null;
 const size=bounds.getSize(new THREE.Vector3());
 if(size.x<=1e-6||size.y<=1e-6||size.z<=1e-6)return null;
 return {min:bounds.min.clone(),size,vertices:used};
}
const setTint=(uniforms,palette,key)=>{
 uniforms[key].value.set(palette);
};
const fragment=String.raw`
varying vec3 vCreatorFaceRest;
uniform vec3 creatorLipPigment;
uniform vec3 creatorBlushPigment;
uniform vec3 creatorEyePigment;
uniform float creatorMakeupOpacity;
float creatorMakeupEllipse(vec2 p,vec2 center,vec2 radius){
 float r=length((p-center)/radius);
 return 1.0-smoothstep(0.7,1.0,r);
}
`;
const colorBlock=String.raw`
float creatorFaceFront=smoothstep(0.60,0.83,vCreatorFaceRest.z);
float creatorLipMask=creatorMakeupEllipse(vCreatorFaceRest.xy,vec2(0.50,0.31),vec2(0.17,0.055));
float creatorBlushMask=max(
 creatorMakeupEllipse(vCreatorFaceRest.xy,vec2(0.27,0.48),vec2(0.17,0.11)),
 creatorMakeupEllipse(vCreatorFaceRest.xy,vec2(0.73,0.48),vec2(0.17,0.11)));
float creatorEyeMask=max(
 creatorMakeupEllipse(vCreatorFaceRest.xy,vec2(0.33,0.70),vec2(0.16,0.065)),
 creatorMakeupEllipse(vCreatorFaceRest.xy,vec2(0.67,0.70),vec2(0.16,0.065)));
diffuseColor.rgb=mix(diffuseColor.rgb,creatorBlushPigment,
 creatorFaceFront*creatorMakeupOpacity*creatorBlushMask*0.38);
diffuseColor.rgb=mix(diffuseColor.rgb,creatorEyePigment,
 creatorFaceFront*creatorMakeupOpacity*creatorEyeMask*0.55);
diffuseColor.rgb=mix(diffuseColor.rgb,creatorLipPigment,
 creatorFaceFront*creatorMakeupOpacity*creatorLipMask*0.75);
`;

// Attach shader once. Later slider changes only touch uniforms, avoiding a new
// GPU program compilation for every colour-picker drag.
export function bindFusedMakeup(mesh,material,index,appearance={}){
 if(!material||!/^skin_head(?:\\.|$)/i.test(material.name||'')||!material.isMeshStandardMaterial)return false;
 const bounds=skinHeadBounds(mesh,index);
 if(!bounds)return false;
 let state=material.userData.creatorMakeup;
 if(!state){
  const uniforms={
   creatorLipPigment:{value:new THREE.Color()},
   creatorBlushPigment:{value:new THREE.Color()},
   creatorEyePigment:{value:new THREE.Color()},
   creatorMakeupOpacity:{value:0},
  };
  const before=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey?.bind(material);
  const min=bounds.min,size=bounds.size;
  material.onBeforeCompile=function(shader,renderer){
   before?.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nvarying vec3 vCreatorFaceRest;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
vCreatorFaceRest=(position-vec3(${min.x},${min.y},${min.z}))/
vec3(${size.x},${size.y},${size.z});`);
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\n'+fragment)
    .replace('#include <map_fragment>','#include <map_fragment>\n'+colorBlock);
  };
  material.customProgramCacheKey=()=>String(previousKey?.()||'')+'|fused-makeup-v1';
  state={uniforms};
  material.userData.creatorMakeup=state;
  material.needsUpdate=true;
 }
 const values=normalizedMakeup(appearance);
 setTint(state.uniforms,values.lip,'creatorLipPigment');
 setTint(state.uniforms,values.blush,'creatorBlushPigment');
 setTint(state.uniforms,values.eye,'creatorEyePigment');
 state.uniforms.creatorMakeupOpacity.value=values.enabled?values.strength:0;
 return true;
}
