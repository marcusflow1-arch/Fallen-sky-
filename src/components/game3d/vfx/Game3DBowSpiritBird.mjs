import * as THREE from 'three';

// Original, lightweight visual feedback for the user's bow reference footage.
// The bird is an abstract spirit falcon built from triangles, not an imported
// copyrighted animation. VFX does not create hitboxes or apply any damage.
const WING='#a7f0fc',BODY='#f5d690',EDGE='#56bbd4';
const MAX_BIRDS=6;
const clamp01=v=>Math.max(0,Math.min(1,v));
const vec=v=>new THREE.Vector3(v?.x||0,v?.y||0,v?.z||0);
const tmp=new THREE.Vector3();
const axis=new THREE.Vector3(0,0,1);
const next=new THREE.Vector3();
const prev=new THREE.Vector3();

function featherShape(right){
  const side=right?1:-1;
  const shape=new THREE.Shape();
  shape.moveTo(0,0);
  shape.lineTo(side*.34,.12);
  shape.lineTo(side*.9,.28);
  shape.lineTo(side*1.42,.11);
  shape.lineTo(side*1.04,-.05);
  shape.lineTo(side*.7,-.24);
  shape.lineTo(side*.37,-.16);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}
function makeBird(){
  const root=new THREE.Group();
  const bodyMaterial=new THREE.MeshBasicMaterial({color:BODY,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const wingMaterial=new THREE.MeshBasicMaterial({color:WING,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const edgeMaterial=new THREE.MeshBasicMaterial({color:EDGE,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const torso=new THREE.Mesh(new THREE.ConeGeometry(.15,.74,4),bodyMaterial);
  torso.rotation.x=Math.PI/2;
  root.add(torso);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.17,.38,3),edgeMaterial);
  tail.rotation.x=-Math.PI/2;tail.position.z=-.44;root.add(tail);
  const face=new THREE.Mesh(new THREE.ConeGeometry(.105,.31,4),bodyMaterial);
  face.rotation.x=Math.PI/2;face.position.z=.41;root.add(face);
  const wings=[];
  for(const right of [false,true]){
    const joint=new THREE.Group();
    joint.position.z=.03;
    const mesh=new THREE.Mesh(featherShape(right),wingMaterial);
    mesh.rotation.x=.34;
    joint.add(mesh);root.add(joint);wings.push(joint);
  }
  const glowMaterial=new THREE.MeshBasicMaterial({
    color:0x86def4,opacity:.13,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,
  });
  // A soft translucent oval, never an untextured screen-facing square.
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.46,8,6),glowMaterial);
  glow.scale.set(1.75,.30,.65);root.add(glow);
  return {root,wings,materials:[bodyMaterial,wingMaterial,edgeMaterial,glowMaterial]};
}
function releaseBird(item,scene){
  scene.remove(item.bird.root);
  item.bird.root.traverse(node=>{if(node.geometry)node.geometry.dispose();});
  for(const material of item.bird.materials)material.dispose();
}
function bezier(p0,p1,p2,p3,t,out){
  const k=1-t;
  return out.copy(p0).multiplyScalar(k*k*k)
    .addScaledVector(p1,3*k*k*t)
    .addScaledVector(p2,3*k*t*t)
    .addScaledVector(p3,t*t*t);
}
function pointLike(position){
  return position&&[position.x,position.y,position.z].every(Number.isFinite);
}
function buildReticle(container){
  const host=document.createElement('div');
  host.dataset.game3dBowReticle='true';
  Object.assign(host.style,{
    position:'absolute',left:'50%',top:'50%',width:'34px',height:'34px',
    transform:'translate(-50%,-50%)',pointerEvents:'none',zIndex:'13',
    opacity:'0',transition:'opacity 110ms ease-out',
  });
  const center=document.createElement('div');
  Object.assign(center.style,{
    position:'absolute',left:'15px',top:'15px',width:'4px',height:'4px',
    borderRadius:'50%',background:'#ffecad',boxShadow:'0 0 5px #ffd96b, 0 0 2px #040608',
    border:'1px solid #10161d',
  });
  host.appendChild(center);
  const marker=document.createElement('div');
  Object.assign(marker.style,{position:'absolute',inset:0,opacity:'0',transform:'scale(1.45)'});
  const positions=[
    {left:'5px',top:'5px',transform:'rotate(-45deg)'},
    {right:'5px',top:'5px',transform:'rotate(45deg)'},
    {left:'5px',bottom:'5px',transform:'rotate(45deg)'},
    {right:'5px',bottom:'5px',transform:'rotate(-45deg)'},
  ];
  for(const props of positions){
    const dash=document.createElement('div');
    Object.assign(dash.style,{
      position:'absolute',width:'8px',height:'2px',borderRadius:'2px',
      background:'#f5f2cd',boxShadow:'0 0 8px #fbd46e',...props,
    });
    marker.appendChild(dash);
  }
  host.appendChild(marker);
  container.appendChild(host);
  return {host,marker};
}

export function createGame3DBowAimVisuals({scene,container,showDot=true}={}){
  if(!scene||!container)return {fire:()=>false,confirmHit:()=>{},update:()=>{},dispose:()=>{}};
  const overlay=typeof document!=='undefined'?buildReticle(container):null;
  if(overlay&&!showDot){overlay.host.firstChild.style.display='none';overlay.host.style.zIndex='61';}
  const birds=[];
  let hitSeconds=0,disposed=false,serial=0;
  const fire=({origin,target}={})=>{
    if(disposed||!pointLike(origin)||!pointLike(target))return false;
    if(birds.length>=MAX_BIRDS)releaseBird(birds.shift(),scene);
    const p0=vec(origin),p3=vec(target);
    p0.y+=1.45;
    // The spirit rises into a short swoop, then dives over the final third.
    const distance=p0.distanceTo(p3);
    if(distance<.3)return false;
    const direction=tmp.copy(p3).sub(p0).normalize();
    const side=(++serial%2?1:-1)*Math.min(1.1,distance*.045);
    const p1=p0.clone().lerp(p3,.22).add(new THREE.Vector3(side,Math.min(3,1.1+distance*.075),0));
    const p2=p0.clone().lerp(p3,.70).add(new THREE.Vector3(-side*.46,Math.min(4,1.7+distance*.035),0));
    // Favor a quick movement cue rather than a slow enemy-hunting projectile.
    const duration=Math.max(.36,Math.min(.75,distance/75+.28));
    const bird=makeBird();
    bird.root.position.copy(p0);bird.root.scale.setScalar(.63);
    scene.add(bird.root);
    birds.push({bird,p0,p1,p2,p3,duration,elapsed:0});
    return true;
  };
  const confirmHit=()=>{
    if(disposed)return;
    hitSeconds=.23;
  };
  const update=(dt,{active=false,blocked=false}={})=>{
    if(disposed)return;
    const delta=Math.max(0,Math.min(Number(dt)||0,.08));
    hitSeconds=Math.max(0,hitSeconds-delta);
    if(overlay){
      overlay.host.style.opacity=active&&!blocked?'1':'0';
      const t=hitSeconds/.23;
      overlay.marker.style.opacity=active&&!blocked?String(clamp01(t)):'0';
      overlay.marker.style.transform='scale('+(1+.5*(1-t)).toFixed(3)+')';
    }
    for(let i=birds.length-1;i>=0;i--){
      const b=birds[i];
      b.elapsed+=delta;
      const t=clamp01(b.elapsed/b.duration);
      bezier(b.p0,b.p1,b.p2,b.p3,t,b.bird.root.position);
      bezier(b.p0,b.p1,b.p2,b.p3,Math.min(1,t+.015),next);
      bezier(b.p0,b.p1,b.p2,b.p3,Math.max(0,t-.015),prev);
      const tangent=next.sub(prev);
      if(tangent.lengthSq()>1e-8)b.bird.root.quaternion.setFromUnitVectors(axis,tangent.normalize());
      b.bird.wings[0].rotation.z=Math.sin(b.elapsed*27)*.38;
      b.bird.wings[1].rotation.z=-Math.sin(b.elapsed*27)*.38;
      b.bird.root.scale.setScalar((.65+.18*Math.sin(Math.PI*t))*Math.min(1,(1-t)*8));
      if(t>=1){releaseBird(b,scene);birds.splice(i,1);}
    }
  };
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    birds.splice(0).forEach(item=>releaseBird(item,scene));
    overlay?.host.remove();
  };
  return {fire,confirmHit,update,dispose};
}
