import * as THREE from 'three';

// Original, lightweight visual feedback for the user's bow reference footage.
// The bird is an abstract spirit falcon built from triangles, not an imported
// copyrighted animation. VFX does not create hitboxes or apply any damage.
const WING='#a7f0fc',BODY='#f5d690',EDGE='#56bbd4';
const MAX_BIRDS=6;
const TRACE_HOLD_SECONDS=1.2; // keep the debug path visible after the projectile lands
const clamp01=v=>Math.max(0,Math.min(1,v));
const vec=v=>new THREE.Vector3(v?.x||0,v?.y||0,v?.z||0);
const tmp=new THREE.Vector3();
const axis=new THREE.Vector3(0,0,1);

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
  scene.remove(item.root);
  item.root.traverse(node=>{if(node.geometry)node.geometry.dispose();});
  for(const material of [...item.bird.materials,item.traceMaterial,item.shaftMaterial])material.dispose();
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
  // One small status below the OTS crosshair, never a second targeting dot.
  const result=document.createElement('div');
  result.dataset.game3dBowResult='true';
  result.setAttribute('role','status');
  Object.assign(result.style,{
    position:'absolute',top:'41px',left:'50%',
    transform:'translateX(-50%)',whiteSpace:'nowrap',
    font:'bold 13px/1.2 system-ui, sans-serif',letterSpacing:'.08em',
    color:'#fff',textShadow:'0 1px 5px #000',
    opacity:'0',transition:'opacity 90ms ease-out',
    pointerEvents:'none',
  });
  host.appendChild(result);
  const chargeTrack=document.createElement('div');
  chargeTrack.dataset.game3dBowCharge='true';
  Object.assign(chargeTrack.style,{
    position:'absolute',top:'63px',left:'50%',transform:'translateX(-50%)',
    width:'106px',height:'7px',borderRadius:'9px',
    border:'1px solid #7fbdca',background:'rgba(7,24,41,.77)',
    boxShadow:'0 0 7px #164a6e',overflow:'hidden',opacity:'0',
  });
  const chargeFill=document.createElement('div');
  Object.assign(chargeFill.style,{
    width:'0%',height:'100%',background:'linear-gradient(90deg,#58bce5,#fff0ad)',
    transition:'none',boxShadow:'0 0 7px #a6eaff',
  });
  chargeTrack.appendChild(chargeFill);host.appendChild(chargeTrack);
  const chargeLabel=document.createElement('div');
  chargeLabel.dataset.game3dBowChargeLabel='true';
  Object.assign(chargeLabel.style,{
    position:'absolute',top:'73px',left:'50%',transform:'translateX(-50%)',
    font:'bold 10px/1.2 system-ui,sans-serif',letterSpacing:'.1em',
    color:'#b9efff',whiteSpace:'nowrap',opacity:'0',textShadow:'0 1px 4px #000',
  });
  host.appendChild(chargeLabel);
  container.appendChild(host);
  return {host,marker,result,chargeTrack,chargeFill,chargeLabel};
}

export function createGame3DBowAimVisuals({scene,container,showDot=true}={}){
  if(!scene||!container)return {fire:()=>false,confirmHit:()=>{},confirmMiss:()=>{},showNotice:()=>{},showHeadshot:()=>{},setCharge:()=>{},noteAimTime:()=>{},stats:()=>({fired:0,hits:0,misses:0,pending:0,lastResolutionMs:null}),update:()=>{},dispose:()=>{}};
  const overlay=typeof document!=='undefined'?buildReticle(container):null;
  if(overlay&&!showDot){overlay.host.firstChild.style.display='none';overlay.host.style.zIndex='61';}
  const birds=[];
  const spare=[]; // Up to six reusable render objects; no new GPU assets per repeat shot.
  let hitSeconds=0,resultSeconds=0,disposed=false;
  // Local-only diagnostic counters: no uploads, console spam or new per-shot
  // timers. A shot resolves on the same combat frame or remains pending.
  const shotStats={fired:0,hits:0,misses:0,lastResolutionMs:null,lastAimMs:null,maxAimMs:0};
  let shotStartedAt=null,shotSerial=0,resolvedSerial=0;
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const noteAimTime=ms=>{
    if(!Number.isFinite(ms)||ms<0)return;
    shotStats.lastAimMs=ms;
    shotStats.maxAimMs=Math.max(shotStats.maxAimMs,ms);
  };
  const fire=({origin,target}={})=>{
    if(disposed||!pointLike(origin)||!pointLike(target))return false;
    const p0=vec(origin),p3=vec(target);
    p0.y+=1.45;
    // An illuminated trajectory exposes the direct hit test, even on a miss.
    const distance=p0.distanceTo(p3);
    if(distance<.3)return false;
    // The physical arrow and visual spirit now follow EXACTLY one straight
    // segment from shoulder-height muzzle to the combat resolver's hit point.
    // The tracing line is not a separate weapon and cannot grant damage.
    const direction=tmp.copy(p3).sub(p0).normalize();
    const duration=Math.max(.36,Math.min(.75,distance/75+.28));
    let item=birds.length>=MAX_BIRDS?birds.shift():spare.pop();
    if(item){
      scene.remove(item.root);
    }else{
      const bird=makeBird();
      const root=new THREE.Group();
      root.add(bird.root);
      const traceMaterial=new THREE.LineBasicMaterial({
        color:0xffd375,transparent:true,opacity:.93,depthWrite:false,
        blending:THREE.AdditiveBlending,
      });
      // The same two-vertex GPU line buffer is edited in-place each shot.
      const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),new THREE.Vector3(),
      ]),traceMaterial);
      trace.frustumCulled=false;
      root.add(trace);
      const shaftMaterial=new THREE.MeshBasicMaterial({
        color:0xffd375,transparent:true,opacity:.38,depthWrite:false,
        blending:THREE.AdditiveBlending,
      });
      // Unit cylinder scales along its length: do not allocate a new geometry
      // or shader material for each fired arrow.
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,1,5,1),shaftMaterial);
      root.add(shaft);
      item={bird,root,trace,shaft,traceMaterial,shaftMaterial};
    }
    const {bird,root,trace,shaft,traceMaterial,shaftMaterial}=item;
    bird.root.visible=true;
    bird.root.position.copy(p0);
    bird.root.quaternion.setFromUnitVectors(axis,direction);
    bird.root.scale.setScalar(.63);
    const position=trace.geometry.getAttribute('position');
    position.setXYZ(0,p0.x,p0.y,p0.z);
    position.setXYZ(1,p3.x,p3.y,p3.z);
    position.needsUpdate=true;
    traceMaterial.color.setHex(0xffd375);
    traceMaterial.opacity=.93;
    shaftMaterial.color.setHex(0xffd375);
    shaftMaterial.opacity=.38;
    shaft.scale.y=distance;
    shaft.position.copy(p0).add(p3).multiplyScalar(.5);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    item.p0=p0;
    item.p3=p3;
    item.duration=duration;
    item.elapsed=0;
    scene.add(root);
    birds.push(item);
    shotStartedAt=now();
    shotSerial+=1;
    shotStats.fired+=1;
    return true;
  };
  const setResult=(label,color)=>{
    if(disposed)return;
    resultSeconds=.9;
    if(shotSerial>resolvedSerial){
      resolvedSerial=shotSerial;
      if(color===0x81f6b1)shotStats.hits+=1;
      else shotStats.misses+=1;
      shotStats.lastResolutionMs=shotStartedAt===null?null:Math.max(0,now()-shotStartedAt);
    }
    const current=birds[birds.length-1];
    if(current){
      current.traceMaterial.color.setHex(color);
      current.shaftMaterial.color.setHex(color);
    }
    if(overlay){
      overlay.result.textContent=label;
      overlay.result.style.color=color===0x81f6b1?'#8cffa8':'#ff9c96';
    }
  };
  const confirmHit=(damage)=>{
    hitSeconds=.23;
    const amount=Number(damage);
    setResult(Number.isFinite(amount)&&amount>0?'HIT '+Math.round(amount):'HIT',0x81f6b1);
  };
  const confirmMiss=(reason='MISS')=>{
    hitSeconds=0;
    const label=['DODGED','BLOCKED','OUT OF RANGE','NO TARGET'].includes(reason)?reason:'MISS';
    setResult(label,0xff5d65);
  };
  const showHeadshot=(damage)=>{
    if(disposed||!overlay)return;
    overlay.result.textContent='HEADSHOT ×2 · '+Math.round(Number(damage)||0);
    overlay.result.style.color='#ffe8a2';
    resultSeconds=.95;
  };
  let lastChargePercent=null;
  const setCharge=(status)=>{
    if(disposed||!overlay)return;
    const active=!!status;
    const percent=Math.max(0,Math.min(100,Number(status?.percent)||0));
    if(!active){
      if(lastChargePercent!==null){
        overlay.chargeTrack.style.opacity='0';
        overlay.chargeLabel.style.opacity='0';
        lastChargePercent=null;
      }
      return;
    }
    if(lastChargePercent===percent)return; // avoid per-frame DOM writes
    lastChargePercent=percent;
    overlay.chargeTrack.style.opacity='1';
    overlay.chargeLabel.style.opacity='1';
    overlay.chargeFill.style.width=percent+'%';
    overlay.chargeLabel.textContent=status.full?'FULL DRAW · 100%':'CHARGE · '+percent+'%';
    overlay.chargeLabel.style.color=status.full?'#ffe7a4':'#b9efff';
  };
  const showNotice=(message)=>{
    if(disposed||!overlay)return;
    // No arrow was fired; do not recolor the previous shot or add a MISS.
    const label=['COOLDOWN','NO STAMINA'].includes(message)?message:'WAIT';
    resultSeconds=.65;
    overlay.result.textContent=label;
    overlay.result.style.color='#ffdda0';
  };
  const update=(dt,{active=false,blocked=false}={})=>{
    if(disposed)return;
    const delta=Math.max(0,Math.min(Number(dt)||0,.08));
    hitSeconds=Math.max(0,hitSeconds-delta);
    resultSeconds=Math.max(0,resultSeconds-delta);
    if(overlay){
      overlay.host.style.opacity=active&&!blocked?'1':'0';
      const t=hitSeconds/.23;
      overlay.marker.style.opacity=active&&!blocked?String(clamp01(t)):'0';
      overlay.marker.style.transform='scale('+(1+.5*(1-t)).toFixed(3)+')';
      overlay.result.style.opacity=active&&!blocked?String(clamp01(resultSeconds/.28)):'0';
    }
    for(let i=birds.length-1;i>=0;i--){
      const b=birds[i];
      b.elapsed+=delta;
      const t=clamp01(b.elapsed/b.duration);
      b.bird.root.position.lerpVectors(b.p0,b.p3,t);
      // The whole visible flight remains linear: no Bezier arc, sideways
      // steer, gravity drop, or curved dive that disagrees with the reticle.
      // Leave the straight trace onscreen long enough to inspect the shot.
      const traceFade=clamp01((TRACE_HOLD_SECONDS-b.elapsed)/.35);
      b.traceMaterial.opacity=.93*traceFade;
      b.shaftMaterial.opacity=.38*traceFade;
      b.bird.wings[0].rotation.z=Math.sin(b.elapsed*27)*.38;
      b.bird.wings[1].rotation.z=-Math.sin(b.elapsed*27)*.38;
      b.bird.root.scale.setScalar((.65+.18*Math.sin(Math.PI*t))*Math.min(1,(1-t)*8));
      if(t>=1)b.bird.root.visible=false;
      if(b.elapsed>=TRACE_HOLD_SECONDS){scene.remove(b.root);birds.splice(i,1);spare.push(b);}
    }
  };
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    birds.splice(0).forEach(item=>releaseBird(item,scene));
    spare.splice(0).forEach(item=>releaseBird(item,scene));
    overlay?.host.remove();
  };
  return {fire,confirmHit,confirmMiss,showHeadshot,setCharge,showNotice,noteAimTime,update,dispose,
    stats:()=>({
      ...shotStats,
      pending:Math.max(0,shotStats.fired-shotStats.hits-shotStats.misses),
    }),
  };
}
