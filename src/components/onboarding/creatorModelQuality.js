// Runtime finishing for owned fused creator GLBs. Works with the EXISTING
// rig/morphs; it never scales the whole character to fake a heavy abdomen or
// replaces the artist's textures. Original model files remain untouched.
import * as THREE from 'three';
import {bellyTorsoEnvelope,eyeClearanceEnvelope,neckToneFeather} from './creatorBodyQuality.mjs';

const finishedBodies=new WeakSet(),finishedHair=new WeakSet(),finishedNecks=new WeakSet();
const clamp=THREE.MathUtils.clamp;
const skinnedBody=root=>{
 let result=null;
 root?.traverse(n=>{
  if(!result&&n.isSkinnedMesh&&!n.userData?.creatorLayer&&
    n.morphTargetDictionary?.CC_Belly!==undefined)result=n;
 });
 return result;
};
const bone=(mesh,suffix)=>mesh.skeleton?.bones.find(b=>
 b.name==='mixamorig:'+suffix||b.name==='mixamorig'+suffix||
 b.name.endsWith(':'+suffix))||null;
const localPoint=(mesh,b)=>{
 if(!b)return null;
 return mesh.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
};
function torsoFrame(mesh){
 const h=localPoint(mesh,bone(mesh,'Hips'));
 const chest=localPoint(mesh,bone(mesh,'Spine2'));
 if(!h||!chest)return null;
 const axis=chest.clone().sub(h),height=axis.length();
 if(!Number.isFinite(height)||height<.08)return null;
 const up=axis.divideScalar(height);
 const pos=mesh.geometry.attributes.position;
 const morph=mesh.geometry.morphAttributes.position?.[mesh.morphTargetDictionary.CC_Belly];
 if(!pos||!morph||pos.count!==morph.count)return null;
 // Infer forward from the EXISTING artist-authored belly key, not a global
 // axis: GLB node rotations and imported Mixamo rigs can differ.
 const direction=new THREE.Vector3(),tmp=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){
  tmp.fromBufferAttribute(morph,i);
  const v=tmp.dot(up);
  direction.addScaledVector(tmp,.95);
  direction.addScaledVector(up,-v*.95);
 }
 if(direction.length()<1e-5)return null;
 const front=direction.normalize(),right=new THREE.Vector3().crossVectors(front,up).normalize();
 if(right.length()<.5)return null;
 return {hips:h,chest,up,front,right,height};
}
function torsoWeight(mesh,index){
 const skinI=mesh.geometry.attributes.skinIndex,skinW=mesh.geometry.attributes.skinWeight;
 if(!skinI||!skinW)return 0;
 let sum=0;
 for(let j=0;j<Math.min(4,skinI.itemSize);j++){
  const b=mesh.skeleton.bones[skinI.getComponent(index,j)];
  if(b&&/(?:Hips|Spine|Spine1|Spine2)$/.test(b.name))
   sum+=skinW.getComponent(index,j);
 }
 return clamp(sum,0,1);
}
// Rework CC_Belly on the actual imported skinned body: a blended cylindrical
// full-abdomen deformation, including sides and back, from below solar plexus
// toward the pelvis. All CC_* names, UVs, skeleton weights and animation remain.
// A front-only puffy spot would be incorrect for the Heavyset preset.
export function reinforceFusedBelly(root){
 const mesh=skinnedBody(root);
 if(!mesh||finishedBodies.has(mesh))return false;
 mesh.updateMatrixWorld(true);
 if(!mesh.geometry.morphTargetsRelative)return false;
 const frame=torsoFrame(mesh);
 if(!frame)return false;
 const g=mesh.geometry,base=g.attributes.position,morph=g.morphAttributes.position[mesh.morphTargetDictionary.CC_Belly];
 const p=new THREE.Vector3(),offset=new THREE.Vector3(),radial=new THREE.Vector3();
 let changed=0;
 for(let i=0;i<base.count;i++){
  const weight=torsoWeight(mesh,i);
  if(weight<.05)continue;
  p.fromBufferAttribute(base,i);
  offset.copy(p).sub(frame.hips);
  const t=offset.dot(frame.up)/frame.height;
  const falloff=bellyTorsoEnvelope(t,weight);
  if(falloff<.001)continue;
  // Center follows the torso's actual axis, rather than making a ball
  // at the navel or bulging through the hip joints and arms.
  radial.copy(offset).addScaledVector(frame.up,-offset.dot(frame.up));
  const radius=radial.length();
  if(radius<.035*frame.height||radius>.98*frame.height)continue;
  radial.divideScalar(radius);
  const frontBias=radial.dot(frame.front);
  const circumference=frontBias<-.15?.70:1;
  const amplitude=frame.height*.115*falloff*circumference*
    clamp(radius/(frame.height*.30),.35,1);
  const d=new THREE.Vector3().fromBufferAttribute(morph,i);
  d.addScaledVector(radial,amplitude);
  morph.setXYZ(i,d.x,d.y,d.z);
  changed++;
 }
 if(!changed)return false;
 morph.needsUpdate=true;
 finishedBodies.add(mesh);
 mesh.userData.creatorCircumferentialBelly=true;
 mesh.userData.creatorBellyAffectedVertices=changed;
 return true;
}
function hairHeadFrame(baseMesh,hairMesh,baseFrame){
 const head=bone(baseMesh,'Head'),top=bone(baseMesh,'HeadTop_End');
 if(!head||!top)return null;
 const hb=localPoint(hairMesh,head),ht=localPoint(hairMesh,top);
 const axis=ht.clone().sub(hb),height=axis.length();
 if(!Number.isFinite(height)||height<.08)return null;
 const up=axis.divideScalar(height);
 const worldBase=baseMesh.localToWorld(new THREE.Vector3());
 const worldFront=baseMesh.localToWorld(baseFrame.front.clone());
 const localBase=hairMesh.worldToLocal(worldBase.clone());
 const front=hairMesh.worldToLocal(worldFront).sub(localBase).normalize();
 const right=new THREE.Vector3().crossVectors(front,up).normalize();
 if(front.length()<.8||right.length()<.8)return null;
 return {origin:hb,up,front,right,height};
}
// Small clearance pass on meshes already skinned to the HEAD: protects both
// eyes from sharply crossing hair strands while leaving the scalp, braids,
// ponytails, and forehead styles attached to the exact same head/neck bones.
// This intentionally does NOT hide entire hair layers or remove eyebrows.
export function clearFusedHairFromEyes(baseRoot,hairRoot=baseRoot){
 const body=skinnedBody(baseRoot);
 if(!body)return 0;
 const base=torsoFrame(body);
 if(!base)return 0;
 let corrected=0;
 hairRoot.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||finishedHair.has(mesh)||
     !/^Hair_/i.test(mesh.name)||!mesh.geometry?.attributes?.position)return;
  const f=hairHeadFrame(body,mesh,base);
  if(!f)return;
  const attr=mesh.geometry.attributes.position,point=new THREE.Vector3(),offset=new THREE.Vector3();
  let moved=0;
  for(let i=0;i<attr.count;i++){
   point.fromBufferAttribute(attr,i);
   offset.copy(point).sub(f.origin);
   const upFraction=offset.dot(f.up)/f.height;
   // Readable eyes lie above the cheek and below the brow. Leave the hairline
   // and crown alone, and only move the forward-facing individual strands.
   if(upFraction<.36||upFraction>.76)continue;
   const lateral=offset.dot(f.right)/f.height;
   const frontDepth=offset.dot(f.front)/f.height;
   if(frontDepth<.14||Math.abs(lateral)>.47)continue;
   const eye=0.205*Math.sign(lateral||1);
   const horizontal=(lateral-eye)/.21;
   const vertical=(upFraction-.57)/.14;
   const mask=eyeClearanceEnvelope(horizontal,vertical,(frontDepth-.29)/.25);
   if(mask<.02)continue;
   point.addScaledVector(f.right,Math.sign(lateral||1)*f.height*.09*mask);
   point.addScaledVector(f.up,f.height*.05*mask);
   attr.setXYZ(i,point.x,point.y,point.z);moved++;
  }
  if(moved){
   attr.needsUpdate=true;
   mesh.geometry.computeBoundingSphere();
   mesh.userData.creatorEyeClearanceVertices=moved;
   corrected+=moved;
  }
  finishedHair.add(mesh);
 });
 return corrected;
}
// Fuse-generated body retains separate Skin_Head and Skin_Body paint atlases.
// Gently blend the *vertex normals* along UV-split neck edges so their lighting
// responds as a single surface. Albedo/color rebaking is a separate asset pass.
export function softenFusedNeckNormals(root){
 const mesh=skinnedBody(root);
 if(!mesh||finishedNecks.has(mesh))return false;
 mesh.updateMatrixWorld(true);
 const n=bone(mesh,'Neck'),h=bone(mesh,'Head');
 const p=localPoint(mesh,n),q=localPoint(mesh,h);
 if(!p||!q)return false;
 const span=q.clone().sub(p),height=span.length();
 if(height<.025)return false;
 const up=span.divideScalar(height);
 const g=mesh.geometry,pos=g.attributes.position,norm=g.attributes.normal;
 if(!pos||!norm||pos.count!==norm.count)return false;
 const bins=new Map(),point=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){
  point.fromBufferAttribute(pos,i);
  const d=point.clone().sub(p);
  const f=d.dot(up)/height;
  const radius=d.addScaledVector(up,-d.dot(up)).length()/height;
  if(neckToneFeather(f,radius)<.2)continue;
  const key=[Math.round(point.x*2500),Math.round(point.y*2500),Math.round(point.z*2500)].join(':');
  let item=bins.get(key);
  if(!item){item={ids:[],sum:new THREE.Vector3()};bins.set(key,item)}
  item.ids.push(i);normal.fromBufferAttribute(norm,i);item.sum.add(normal);
 }
 let smoothed=0;
 for(const item of bins.values()){
  if(item.ids.length<2||item.sum.lengthSq()<1e-8)continue;
  item.sum.normalize();
  for(const i of item.ids){norm.setXYZ(i,item.sum.x,item.sum.y,item.sum.z);smoothed++}
 }
 if(smoothed)norm.needsUpdate=true;
 finishedNecks.add(mesh);
 mesh.userData.creatorNeckSmoothedNormals=smoothed;
 return smoothed>0;
}
export function prepareFusedCreatorGeometry(root){
 root?.updateMatrixWorld?.(true);
 return {
  roundBelly:reinforceFusedBelly(root),
  hairVertices:clearFusedHairFromEyes(root),
  neckNormals:softenFusedNeckNormals(root),
 };
}
