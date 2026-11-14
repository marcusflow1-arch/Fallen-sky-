// Living fire art direction for the EXISTING imported quarry dragon boss.
// Decorative GPU-budgeted shapes never replace character/terrain materials,
// move colliders or grant drops. This runtime owns and disposes its own meshes.
import * as THREE from 'three';
import {DRAGON_FIRE_PATTERNS,dragonFirePhase,isDragonFireHit}
  from './DragonLivingFirePatterns.mjs';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function disposeTree(root){
  const geo=new Set(),mats=new Set();
  root.traverse(o=>{if(o.isMesh||o.isInstancedMesh){
    if(o.geometry)geo.add(o.geometry);
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))
      if(m)mats.add(m);
  }});
  geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
}
const STREAK_COUNT=24;
export function createDragonLivingFireAttacks({
  scene,groundAt=()=>0,getPlayer,applyPlayerDamage,bossId,
}={}){
  if(!scene)throw new Error('Dragon fire requires the existing scene');
  const group=new THREE.Group();group.name='Dragon_LivingUltraSumi_FirePatterns';
  group.visible=false;group.userData.dragonElementalVFX=true;scene.add(group);
  const fire=new THREE.MeshBasicMaterial({
    color:0xff6429,transparent:true,opacity:.72,
    depthWrite:false,side:THREE.DoubleSide,
  });
  const ink=new THREE.MeshBasicMaterial({
    color:0x8d271c,transparent:true,opacity:.77,depthWrite:false,
    side:THREE.DoubleSide,
  });
  const warningMat=new THREE.MeshBasicMaterial({
    color:0xe88e42,transparent:true,opacity:.61,
    depthWrite:false,side:THREE.DoubleSide,
  });
  const impactMat=new THREE.MeshBasicMaterial({
    color:0xffaa59,transparent:true,opacity:.83,
    depthWrite:false,side:THREE.DoubleSide,
  });
  const ring=new THREE.Mesh(new THREE.RingGeometry(5.5,6.3,64),warningMat);
  ring.rotation.x=-Math.PI/2;
  ring.name='DragonFire_TargetWarning';group.add(ring);
  const rainGeometry=new THREE.CylinderGeometry(.12,.25,4.3,6);
  const rain=new THREE.InstancedMesh(rainGeometry,fire,STREAK_COUNT);
  rain.name='DragonFire_RealFallingRain';rain.frustumCulled=false;
  rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(rain);
  const drops=[];
  for(let i=0;i<STREAK_COUNT;i++){
    const radius=Math.sqrt((i+.5)/STREAK_COUNT)*8.5;
    const angle=i*2.399963;
    drops.push({x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,
      delay:(i%8)*.14,phase:(i*.277)%1});
  }
  const dummy=new THREE.Object3D();
  const breath=new THREE.Group();
  breath.name='DragonFire_StreamingBreath';group.add(breath);
  const blast=new THREE.Mesh(new THREE.CylinderGeometry(1.45,2.65,1,15,1,true),fire);
  breath.add(blast);
  for(let i=0;i<9;i++){
    const swirl=new THREE.Mesh(new THREE.TorusGeometry(1.7+i*.09,.055,5,44),i%2?ink:impactMat);
    swirl.rotation.x=Math.PI/2;
    swirl.position.y=(i-4)*.09;
    breath.add(swirl);
  }
  const cyclone=new THREE.Group();
  cyclone.name='DragonFire_DescendingSkyTornado';group.add(cyclone);
  const coils=[];
  for(let i=0;i<13;i++){
    const rad=1.5+i*.37;
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(rad,.12,6,64),
      i%3===0?impactMat:i%2?ink:fire);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.y=i*1.55;
    cyclone.add(mesh);coils.push(mesh);
  }
  const tornadoCore=new THREE.Mesh(
    new THREE.CylinderGeometry(1.0,5.0,20,20,1,true),
    new THREE.MeshBasicMaterial({
      color:0xe65b27,transparent:true,opacity:.18,
      side:THREE.DoubleSide,depthWrite:false,
    }),
  );
  tornadoCore.position.y=10;cyclone.add(tornadoCore);
  const sparks=new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(.15,0),impactMat,100);
  sparks.name='DragonFire_SwirlAsh';sparks.frustumCulled=false;
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(sparks);
  let state=null,clock=0,disposed=false;
  const V=new THREE.Vector3(),U=new THREE.Vector3(0,1,0);
  function start(kind,target,origin){
    if(disposed||state||!DRAGON_FIRE_PATTERNS[kind]||!target||!origin)return false;
    clock=0;
    const y=groundAt(target.x,target.z);
    const aim={x:target.x,z:target.z,y:Number.isFinite(y)?y:0};
    const source={x:origin.x,z:origin.z,y:origin.y};
    state={kind,target:aim,origin:source,hit:false};
    group.visible=true;
    ring.position.set(aim.x,aim.y+.12,aim.z);
    ring.scale.setScalar(DRAGON_FIRE_PATTERNS[kind].radius/6);
    breath.visible=false;cyclone.visible=false;rain.visible=false;sparks.visible=false;
    if(kind==='rain')rain.visible=true;
    if(kind==='breath'){
      breath.visible=true;
      const a=V.set(source.x,source.y+7,source.z);
      const d=new THREE.Vector3(aim.x,aim.y+1.0,aim.z).sub(a);
      const length=d.length();
      breath.position.copy(a).addScaledVector(d,.5);
      breath.quaternion.setFromUnitVectors(U,d.normalize());
      blast.scale.set(1,length,1);
      breath.children.slice(1).forEach((swirl,i)=>{
        swirl.position.y=(i/9-.5)*length;
        swirl.scale.setScalar(1.0+.21*(i%3));
      });
    }
    if(kind==='cyclone'){
      cyclone.visible=true;
      cyclone.position.set(aim.x,aim.y,aim.z);
      sparks.visible=true;
    }
    return true;
  }
  function animateRain(time,phase){
    const params=DRAGON_FIRE_PATTERNS.rain;
    const t=clamp((time-params.warning)/params.active,0,1);
    const target=state.target;
    for(let i=0;i<STREAK_COUNT;i++){
      const d=drops[i];
      const progress=clamp(t*1.7-d.delay*.5,0,1);
      const fallingY=22*(1-progress)+1.3;
      dummy.position.set(target.x+d.x,target.y+fallingY,target.z+d.z);
      dummy.rotation.set(.16,0,.12);
      dummy.scale.setScalar(progress>=.99?.42:1);
      dummy.updateMatrix();rain.setMatrixAt(i,dummy.matrix);
    }
    rain.instanceMatrix.needsUpdate=true;
    rain.material.opacity=phase==='active'?.82:.16;
  }
  function animateBreath(time,phase){
    const t=Math.max(0,time-DRAGON_FIRE_PATTERNS.breath.warning);
    breath.visible=phase==='active';
    blast.rotation.y=t*2.9;
    blast.material.opacity=.61+.13*Math.sin(t*19);
    breath.children.slice(1).forEach((m,i)=>{
      m.rotation.y=t*(i%2?5:-4);
      m.scale.setScalar(.9+.22*Math.sin(t*12+i));
    });
  }
  function animateCyclone(time,phase){
    const p=DRAGON_FIRE_PATTERNS.cyclone;
    const descend=clamp((time-p.warning)/p.active*1.35,0,1);
    // Start in the sky and visibly come down to meet the marked area.
    cyclone.position.y=(1-descend)*28;
    cyclone.rotation.y=-time*2.4;
    const scale=phase==='telegraph'?.25:.86+.20*Math.sin(time*3.3);
    cyclone.scale.setScalar(scale);
    coils.forEach((c,i)=>{
      c.rotation.z=time*(i%2?1.3:-1.6);
      c.scale.setScalar(.82+.21*Math.sin(time*5.5+i));
    });
    for(let i=0;i<100;i++){
      const a=i*2.399963+time*1.8;
      const h=((i*.257+time*.62)%1)*19;
      const rad=(1-h/25)*5.7;
      dummy.position.set(state.target.x+Math.cos(a)*rad,
        state.target.y+Math.max(0,cyclone.position.y)+h,
        state.target.z+Math.sin(a)*rad);
      dummy.scale.setScalar(.60+.70*(i%3)/3);
      dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate=true;
  }
  function update(dt){
    if(!state)return false;
    clock+=clamp(Number(dt)||0,0,.1);
    const kind=state.kind,phase=dragonFirePhase(kind,clock);
    ring.visible=phase==='telegraph';
    ring.material.opacity=.43+.19*Math.sin(clock*13);
    ring.rotation.z=clock*.28;
    if(kind==='rain')animateRain(clock,phase);
    if(kind==='breath')animateBreath(clock,phase);
    if(kind==='cyclone')animateCyclone(clock,phase);
    const p=DRAGON_FIRE_PATTERNS[kind];
    // One deterministic and clearly warned hit check; never one per particle.
    if(phase==='active'&&!state.hit &&
       clock>=p.warning+(kind==='cyclone'?1.3:kind==='rain'?.82:.25)){
      state.hit=true;
      const player=getPlayer?.();
      if(player?.alive!==false &&
         isDragonFireHit(kind,player,state.target,state.origin))
        applyPlayerDamage?.(p.damage,{bossId,attack:'living_fire_'+kind});
    }
    if(phase==='done'){
      state=null;group.visible=false;
      rain.visible=breath.visible=cyclone.visible=sparks.visible=false;
      return true;
    }
    return false;
  }
  function cancel(){
    state=null;group.visible=false;
    rain.visible=breath.visible=cyclone.visible=sparks.visible=false;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;cancel();scene.remove(group);disposeTree(group);
  }
  return {start,update,cancel,dispose,
    get active(){return !!state;},
    get kind(){return state?.kind??null;},
    get phase(){return state?dragonFirePhase(state.kind,clock):'idle';},
  };
}
