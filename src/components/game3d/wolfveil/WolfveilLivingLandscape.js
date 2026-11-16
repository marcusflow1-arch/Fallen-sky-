// Renders the living-landscape plan: wildflowers, shrubs, ferns, fallen logs,
// reed beds and wet bank stones. Each kind is one small shared shape, drawn
// in instanced batches the camera can cull by region. Decorative only: never
// a floor, click target or collider.
import * as THREE from 'three';
import {isWolfveilCaveApproachReserved} from './WolfveilCaveAccessPlan.mjs';
import {planWolfveilLivingLandscape} from './WolfveilLivingLandscapePlan.mjs';
import {rockGeometry,byRegion} from './WolfveilTrailLandscaping.js';

const BLOOM_TONES=[0xf2efe2,0xe8c63a,0x6f72c9,0xc8432f,0xb86fa8]; // species order
const BLOOM_HEIGHT=[1,.85,1.7,1.2,.7];
const STEM_TONES=[0x4f6b35,0x5a763b,0x486232];
const SHRUB_TONES=[0x3f5a2c,0x4a6a33,0x56703a,0x39522e];
const DRY_SHRUB_TONES=[0x6f6a3a,0x7a6b3f];
const FERN_TONES=[0x3d6131,0x4a7038,0x35562d];
const REED_TONES=[0x7d8a4a,0x8c8a52,0x6f7f45];
const WET_STONE_TONES=[0x55585a,0x63666a,0x4a4e50,0x6d6c66];
const LOG_TONES=[0x5b4632,0x6a5238,0x4d3d2c];
const MOSS=new THREE.Color(0x5a6b44);
// Three stems per clump: [angle, lean, height].
const STEMS=[[.4,.07,.3],[2.6,.05,.24],[4.8,.09,.36]];
const stemTop=([angle,lean,height])=>[Math.cos(angle)*(.05+lean),height,Math.sin(angle)*(.05+lean)];

function buffer(position,color){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  if(color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
  geometry.computeVertexNormals();
  return geometry;
}

function flowerStemGeometry(){
  const position=[];
  for(const stem of STEMS){
    const [angle]=stem,tx=-Math.sin(angle)*.014,tz=Math.cos(angle)*.014;
    const bx=Math.cos(angle)*.05,bz=Math.sin(angle)*.05,[x,y,z]=stemTop(stem);
    position.push(bx-tx,0,bz-tz, bx+tx,0,bz+tz, x-tx,y,z-tz,
      bx+tx,0,bz+tz, x+tx,y,z+tz, x-tx,y,z-tz);
  }
  return buffer(position);
}

// A small open cup on each stem, darker at the heart.
function flowerBloomGeometry(){
  const position=[],color=[];
  for(const stem of STEMS){
    const [x,y,z]=stemTop(stem);
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2,b=(k+1)*Math.PI/2;
      position.push(x,y,z, x+Math.cos(a)*.06,y+.035,z+Math.sin(a)*.06,
        x+Math.cos(b)*.06,y+.035,z+Math.sin(b)*.06);
      color.push(.62,.62,.62, 1.05,1.05,1.05, 1.05,1.05,1.05);
    }
  }
  return buffer(position,color);
}

// Tapered blades fanned around a centre. arch>0 bows them over (ferns);
// arch=0 keeps them upright (reeds). Three triangles per blade.
function bladeGeometry({blades,height,width,reach,arch=0,tip=[1.08,1.08,1.08]}){
  const position=[],color=[];
  for(let i=0;i<blades;i++){
    const angle=i*2.39996,dx=Math.cos(angle),dz=Math.sin(angle),tx=-dz,tz=dx;
    const h=height*(.75+i%3*.125),out=reach*(.7+i%2*.3);
    const at=(t,side)=>[dx*(.04+out*t)+tx*side*width*(1-t*.6),
      h*(arch?Math.sin(t*Math.PI*arch)/Math.sin(Math.min(.5,arch)*Math.PI):t),
      dz*(.04+out*t)+tz*side*width*(1-t*.6)];
    const a=at(0,-1),b=at(0,1),c=at(.55,-1),d=at(.55,1),end=at(1,0);
    const root=[.5,.5,.5],mid=[.9,.9,.9];
    for(const [v,shade] of [[a,root],[b,root],[c,mid],[b,root],[d,mid],[c,mid],
      [c,mid],[d,mid],[end,tip]]){position.push(...v);color.push(...shade);}
  }
  return buffer(position,color);
}

// Three faceted leaf masses merged into one bush, shaded darker underneath.
function shrubGeometry(){
  const position=[],color=[];
  for(const [ox,oy,oz,radius] of [[0,.42,0,.55],[.42,.3,.1,.4],[-.3,.3,-.32,.42]]){
    const p=new THREE.IcosahedronGeometry(1,0).attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      // Same bump for every copy of a shared corner keeps the faces closed.
      const bump=.82+.36*Math.abs(Math.sin(x*12.9898+y*78.233+z*37.719+radius*9)*43758.5453%1);
      const py=oy+y*radius*.8*bump,shade=.55+.55*Math.min(1,py/.8);
      position.push(ox+x*radius*bump,py,oz+z*radius*bump);
      color.push(shade,shade,shade);
    }
  }
  return buffer(position,color);
}

const dummy=new THREE.Object3D(),tint=new THREE.Color();
const pick=(tones,tone)=>tones[Math.floor(tone*tones.length)%tones.length];

function batch(world,geometry,material,items,name,place){
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  items.forEach((item,i)=>{
    place(item);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint);
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();
  mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false;
  mesh.raycast=()=>{};
  mesh.userData={decorativeOnly:true,source:'wolfveil_living_landscape'};
  return world.mesh(mesh);
}

export function buildWolfveilLivingLandscape(world,{heightAt}){
  const plan=planWolfveilLivingLandscape({heightAt});
  const leaf=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,
    vertexColors:true,side:THREE.DoubleSide});
  const stem=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,side:THREE.DoubleSide});
  const petal=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,
    vertexColors:true,side:THREE.DoubleSide});
  const bush=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,
    vertexColors:true,flatShading:true});
  const stone=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55,flatShading:true});
  const bark=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.98,flatShading:true});

  const upright=(item,height=1)=>{
    dummy.position.set(item.x,item.y-.02,item.z);
    dummy.rotation.set(0,item.yaw,0);
    dummy.scale.set(item.size,item.size*height,item.size);
  };
  const layers=[
    [plan.flowers,flowerStemGeometry(),stem,'SWV_Living_FlowerStems',f=>{
      upright(f,BLOOM_HEIGHT[f.species]);tint.set(pick(STEM_TONES,f.tone));}],
    [plan.flowers,flowerBloomGeometry(),petal,'SWV_Living_FlowerBlooms',f=>{
      upright(f,BLOOM_HEIGHT[f.species]);
      tint.set(BLOOM_TONES[f.species]).offsetHSL((f.tone-.5)*.03,0,(f.tone-.5)*.1);}],
    [plan.shrubs,shrubGeometry(),bush,'SWV_Living_Shrubs',s=>{
      upright(s,.85+s.tone*.3);dummy.position.y-=.04*s.size;
      tint.set(pick(s.dry?DRY_SHRUB_TONES:SHRUB_TONES,s.tone));}],
    [plan.ferns,bladeGeometry({blades:6,height:.34,width:.1,reach:.6,arch:.78}),leaf,
      'SWV_Living_Ferns',f=>{upright(f);tint.set(pick(FERN_TONES,f.tone));}],
    [plan.reeds,bladeGeometry({blades:5,height:1.35,width:.035,reach:.16,tip:[.5,.36,.24]}),leaf,
      'SWV_Living_Reeds',r=>{upright(r);tint.set(pick(REED_TONES,r.tone));}],
    [plan.bankStones,rockGeometry(),stone,'SWV_Living_BankStones',r=>{
      dummy.position.set(r.x,r.y-r.size*r.squash*.25,r.z);
      dummy.rotation.set(r.tilt,r.yaw,r.tilt*.6);
      dummy.scale.set(r.size*r.stretch,r.size*r.squash,r.size);
      tint.set(pick(WET_STONE_TONES,r.tone)).lerp(MOSS,r.moss*.5);}],
    [plan.logs,new THREE.CylinderGeometry(1,1,1,7,1).rotateZ(Math.PI/2),bark,'SWV_Living_Logs',l=>{
      dummy.position.set(l.x,l.y+l.radius*.55,l.z);
      dummy.rotation.set(0,l.yaw,l.pitch);
      dummy.scale.set(l.length,l.radius,l.radius);
      tint.set(pick(LOG_TONES,l.tone)).lerp(MOSS,l.moss*.4);}],
  ];
  for(const [items,geometry,material,name,place] of layers)
    for(const region of byRegion(items.filter(p=>!isWolfveilCaveApproachReserved(p.x,p.z,.65))))
      batch(world,geometry,material,region,name,place);
  return {flowers:plan.flowers.length,shrubs:plan.shrubs.length,ferns:plan.ferns.length,
    reeds:plan.reeds.length,bankStones:plan.bankStones.length,logs:plan.logs.length,
    triangles:plan.triangles};
}