// Gentle baked-neck-tone repair for the OWNED fused Adam/Eve GLBs.
// No replacement atlas or generic skin-colored cylinder: sample the actual
// skin paint just above and below the seam and feather only the head-neck
// albedo in the existing PBR shader. If sampling fails, leave art untouched.
import * as THREE from 'three';
import {neckToneFeather} from './creatorBodyQuality.mjs';

const fixed=new WeakSet();
const median=a=>{if(!a.length)return null;const sorted=[...a].sort((x,y)=>x-y);return sorted[Math.floor(sorted.length/2)]};
const rgbMedian=list=>list.length>=8?[0,1,2].map(i=>median(list.map(v=>v[i]))):null;
const smoothClamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function texturePixels(texture){
 const image=texture?.image;
 if(!image||typeof document==='undefined')return null;
 try{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return null;
  ctx.drawImage(image,0,0,256,256);
  return ctx.getImageData(0,0,256,256).data;
 }catch{return null;}
}
function sampleUv(pixels,u,v,flipY=false){
 if(!pixels||!Number.isFinite(u)||!Number.isFinite(v))return null;
 const x=Math.floor(smoothClamp(((u%1)+1)%1,0,.99999)*256);
 const y=Math.floor(smoothClamp(((v%1)+1)%1,0,.99999)*256);
 const i=((flipY?255-y:y)*256+x)*4;
 return [pixels[i],pixels[i+1],pixels[i+2]];
}
function bone(mesh,suffix){
 return mesh.skeleton?.bones.find(b=>b.name==='mixamorig:'+suffix||
  b.name==='mixamorig'+suffix||b.name.endsWith(':'+suffix));
}
function frame(mesh){
 const neck=bone(mesh,'Neck'),head=bone(mesh,'Head');
 if(!neck||!head)return null;
 const a=mesh.worldToLocal(neck.getWorldPosition(new THREE.Vector3()));
 const b=mesh.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
 const axis=b.clone().sub(a),len=axis.length();
 return len>.025?{base:a,axis:axis.divideScalar(len),len,radius:len*.84}:null;
}
function sampleSkinBands(mesh,f){
 const g=mesh.geometry,positions=g.attributes.position,uv=g.attributes.uv;
 const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 const headIndex=list.findIndex(m=>/^Skin_Head(?:\.|$)/i.test(m?.name||''));
 const bodyIndex=list.findIndex(m=>/^Skin_Body(?:\.|$)/i.test(m?.name||''));
 if(headIndex<0||bodyIndex<0||!uv||!positions)return null;
 const headPixels=texturePixels(list[headIndex]?.map);
 const bodyPixels=texturePixels(list[bodyIndex]?.map);
 if(!headPixels||!bodyPixels)return null;
 const groups=g.groups?.length?g.groups:[{start:0,count:g.index?.count||positions.count,materialIndex:0}];
 const categories={collar:[],chin:[],body:[]},p=new THREE.Vector3();
 const index=g.index;
 for(const group of groups){
  if(group.materialIndex!==headIndex&&group.materialIndex!==bodyIndex)continue;
  const px=group.materialIndex===headIndex?headPixels:bodyPixels;
  const flip=Boolean(list[group.materialIndex]?.map?.flipY);
  // Sample a bounded spread of real mapped vertices; no paint of eyelashes,
  // eyebrows, eyes, lips or unrelated materials.
  const stride=Math.max(1,Math.floor(group.count/6000));
  for(let k=group.start;k<group.start+group.count;k+=stride){
   const i=index?index.getX(k):k;
   if(i<0||i>=positions.count)continue;
   p.fromBufferAttribute(positions,i).sub(f.base);
   const along=p.dot(f.axis);
   const t=along/f.len;
   const radial=p.addScaledVector(f.axis,-along).length()/f.radius;
   if(radial>1.4)continue;
   const set=group.materialIndex===headIndex
     ?(t>.16&&t<.74?'collar':t>1.07&&t<1.55?'chin':null)
     :(t>-.58&&t<-.05?'body':null);
   if(!set)continue;
   const rgb=sampleUv(px,uv.getX(i),uv.getY(i),flip);
   if(rgb)categories[set].push(rgb);
  }
 }
 const collar=rgbMedian(categories.collar),chin=rgbMedian(categories.chin),
  body=rgbMedian(categories.body);
 if(!collar||(!chin&&!body))return null;
 const target=collar.map((_,i)=>chin&&body?chin[i]*.52+body[i]*.48:(chin||body)[i]);
 const ratio=collar.map((v,i)=>{
  // The color-graded images are sRGB; the map sampler in Three outputs
  // linear values. Ratio must be calculated in linear space too.
  const actual=Math.pow(Math.max(.04,v/255),2.2);
  const desired=Math.pow(Math.max(.04,target[i]/255),2.2);
  return smoothClamp(desired/actual,.75,1.38);
 });
 return {material:list[headIndex],ratio,counts:Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v.length]))};
}
export function featherFusedNeckTone(root){
 if(typeof document==='undefined')return false;
 let done=false;
 root?.updateMatrixWorld?.(true);
 root?.traverse(mesh=>{
  if(done||!mesh.isSkinnedMesh||!mesh.morphTargetDictionary?.CC_Belly||
     fixed.has(mesh))return;
  const f=frame(mesh);
  if(!f)return;
  const scan=sampleSkinBands(mesh,f);
  if(!scan)return;
  const {material,ratio}=scan;
  // No perceptible discontinuity: don't alter the original art.
  if(ratio.every(v=>Math.abs(v-1)<.025)){fixed.add(mesh);return;}
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey?.bind(material);
  const uniforms={
   creatorNeckBase:{value:f.base.clone()},creatorNeckDir:{value:f.axis.clone()},
   creatorNeckHeight:{value:f.len},creatorNeckRadius:{value:f.radius},
   creatorNeckRatio:{value:new THREE.Vector3(...ratio)},
  };
  material.onBeforeCompile=function(shader,renderer){
   previous?.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>',`#include <common>
varying float vCreatorNeckFeather;
uniform vec3 creatorNeckBase;
uniform vec3 creatorNeckDir;
uniform float creatorNeckHeight;
uniform float creatorNeckRadius;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 nOffset=position-creatorNeckBase;
float nAlong=dot(nOffset,creatorNeckDir);
float nHeight=nAlong/max(creatorNeckHeight,0.001);
float nRadial=length(nOffset-creatorNeckDir*nAlong)/max(creatorNeckRadius,0.001);
vCreatorNeckFeather=smoothstep(-0.10,0.27,nHeight)
*(1.0-smoothstep(0.64,1.07,nHeight))
*(1.0-smoothstep(0.75,1.40,nRadial));`);
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>',`#include <common>
varying float vCreatorNeckFeather;
uniform vec3 creatorNeckRatio;`)
    .replace('#include <map_fragment>',`#include <map_fragment>
diffuseColor.rgb*=mix(vec3(1.0),creatorNeckRatio,vCreatorNeckFeather*0.72);`);
  };
  material.customProgramCacheKey=()=>String(previousKey?.()||'')+'|creator-fused-neck-feather-v1';
  material.needsUpdate=true;
  mesh.userData.creatorNeckToneRepair={samples:scan.counts,ratio:ratio.map(v=>+v.toFixed(3)),softMask:neckToneFeather(.4,.5)};
  fixed.add(mesh);done=true;
 });
 return done;
}
