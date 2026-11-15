import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {SUIGEN_TOWN_PLOTS,suigenTownTravelPlan} from './SuigenTownPlan.mjs';
import {createSuigenTerrainHeightSampler} from './SuigenTerrainHeight.mjs';

const unit=new THREE.BoxGeometry(1,1,1);
const plane=new THREE.PlaneGeometry(1,1);
plane.rotateX(-Math.PI/2);
const mix=(a,b,t)=>a+(b-a)*t;

function patternMaterial(name,color,roughness=.72,metalness=0){
  const mat=new THREE.MeshStandardMaterial({name:'Suigen_'+name,color,roughness,metalness});
  if(typeof document==='undefined')return mat;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)return mat;
  const colors={
    lacquer:'#774f30',roof:'#405e6b',timber:'#82654c',plaster:'#e6d8bf',
    floor:'#a67c52',stone:'#77746f',tatami:'#b9b39a',red:'#904c45',
  };
  ctx.fillStyle=colors[name]||'#b4aa97';ctx.fillRect(0,0,256,256);
  if(['lacquer','timber','floor'].includes(name)){
    for(let y=0;y<256;y+=32){
      ctx.fillStyle='rgba(24,14,9,.24)';ctx.fillRect(0,y,256,2);
      for(let x=0;x<256;x+=83){
        ctx.fillStyle='rgba(248,213,168,.06)';ctx.fillRect((x+y*3)%256,y,2,30);
      }
    }
    for(let i=0;i<210;i++){
      const y=(i*53)%256,x=(i*91+15)%256;
      ctx.strokeStyle=i%3?'rgba(30,15,8,.08)':'rgba(255,235,191,.08)';
      ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+25,y-4,x+41,y+3,x+65,y);ctx.stroke();
    }
  }else if(name==='roof'){
    for(let y=0;y<256;y+=26){
      ctx.fillStyle='rgba(13,30,44,.28)';ctx.fillRect(0,y,256,3);
      for(let x=0;x<256;x+=32){
        ctx.strokeStyle='rgba(215,229,222,.17)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(x+(y%52===0?0:16),y+4);
        ctx.lineTo(x+(y%52===0?0:16),y+25);ctx.stroke();
      }
    }
  }else if(name==='stone'){
    for(let y=0;y<256;y+=40)for(let x=0;x<256;x+=62){
      ctx.strokeStyle='rgba(15,22,27,.24)';ctx.lineWidth=2;
      ctx.strokeRect(x+(y%80===0?0:31),y,63,41);
    }
    for(let i=0;i<280;i++){
      const x=(i*97)%256,y=(i*79)%256;
      ctx.fillStyle='rgba(250,244,220,.08)';ctx.fillRect(x,y,2,2);
    }
  }else{
    for(let i=0;i<700;i++){
      const x=(i*61)%256,y=(i*101)%256;
      ctx.fillStyle=i%2?'rgba(72,59,43,.027)':'rgba(255,255,255,.024)';
      ctx.fillRect(x,y,2,2);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  mat.map=texture;
  mat.needsUpdate=true;
  return mat;
}
function makeMaterials(){
  const p={
    stone:patternMaterial('stone',0xd6d4cc,.82),
    plaster:patternMaterial('plaster',0xf2eee5,.93),
    timber:patternMaterial('timber',0xc7a88c,.71),
    lacquer:patternMaterial('lacquer',0xd0a77a,.25),
    floor:patternMaterial('floor',0xe6c8a1,.26),
    tatami:patternMaterial('tatami',0xc7bd93,.85),
    roof:patternMaterial('roof',0xa1c6d0,.45),
    under:patternMaterial('timber',0x836650,.74),
    trim: new THREE.MeshStandardMaterial({color:0x3c3d3a,roughness:.49,metalness:.15}),
    glass: new THREE.MeshPhysicalMaterial({color:0xbfdde9,roughness:.14,metalness:.08,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false}),
    copper:new THREE.MeshStandardMaterial({color:0xb77f52,roughness:.31,metalness:.78}),
    fabric:new THREE.MeshStandardMaterial({color:0x456a83,roughness:.92}),
    white:new THREE.MeshStandardMaterial({color:0xe4e0d7,roughness:.87}),
    metal:new THREE.MeshStandardMaterial({color:0x8e9aa1,roughness:.32,metalness:.74}),
    art:new THREE.MeshStandardMaterial({color:0x527c73,roughness:.83,emissive:0x183c32,emissiveIntensity:.14}),
    glow:new THREE.MeshStandardMaterial({color:0xe9bc74,emissive:0xffa65a,emissiveIntensity:1.4}),
    dark:new THREE.MeshStandardMaterial({color:0x2a343b,roughness:.72}),
    green:new THREE.MeshStandardMaterial({color:0x416f4b,roughness:.83}),
  };
  return p;
}
function rotatePoint(plot,x,z){
  return {x:plot.x+x*Math.cos(plot.yaw)+z*Math.sin(plot.y),
    z:plot.z-x*Math.sin(plot.yaw)+z*Math.cos(plot.yaw)};
}
function localPoint(plot,x,z){
  const dx=x-plot.x,dz=z-plot.z,cos=Math.cos(plot.yaw),sin=Math.sin(plot.yaw);
  return {x:dx*cos-dz*sin,z:dx*sin+dz*cos};
}
const groundSampler=createSuigenTerrainHeightSampler;
/**
 * Level each planned building's footprint in the NEW imported terrain copy.
 * Softly grades 10m transition bands back into the original mountains.
 * The existing Acropolis, canal and Classic variant are not touched.
 * A site formerly had up to a 19m gap between its doorstep and ground.
 */
export function gradeSuigenTownTerrain(source){
  const sourceY=groundSampler(source);
  const targets=SUIGEN_TOWN_PLOTS.map(plot=>{
    const facing=rotatePoint(plot,0,plot.depth/2+3.4);
    return {...plot,targetY:sourceY(facing.x,facing.z)};
  }).filter(p=>Number.isFinite(p.targetY));
  const sm=t=>{const x=Math.min(1,Math.max(0,t));return x*x*(3-2*x);};
  let adjusted=0;
  source?.traverse(node=>{
    if(!node.isMesh||node.name!=='Map_Terrain_2400m')return;
    const original=node.geometry,modified=original.clone();
    const pos=modified.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);
      let finalY=y;
      for(const plot of targets){
        if(Math.abs(x-plot.x)>plot.width+15||
           Math.abs(z-plot.z)>plot.depth+15)continue;
        const p=localPoint(plot,x,z),w=plot.width/2,d=plot.depth/2;
        const tx=sm((w+14-Math.abs(p.x))/10);
        const tz=sm((d+14-Math.abs(p.z))/10);
        const blend=tx*tz;
        if(blend>.0001)finalY=mix(finalY,plot.targetY,blend);
      }
      if(Math.abs(finalY-y)>1e-5){pos.setY(i,finalY);adjusted++;}
    }
    pos.needsUpdate=true;
    modified.computeVertexNormals();
    modified.computeBoundingBox();modified.computeBoundingSphere();
    node.geometry=modified;original.dispose();
  });
  return {adjustedVertices:adjusted,gradedPlots:targets.length};
}

function signTexture(label){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle='#23353b';ctx.fillRect(0,0,512,128);
  ctx.strokeStyle='#d7af75';ctx.lineWidth=9;ctx.strokeRect(7,7,498,114);
  ctx.fillStyle='#f4dfb5';ctx.font='bold 34px Georgia';
  ctx.textAlign='center';ctx.textBaseline='middle';
  const title=label.length>24?label.slice(0,23)+'…':label;
  ctx.fillText(title,256,64);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

/**
 * A material-batched town with 60 unique 1–2 storey enterable interiors.
 * The historical Acropolis, canals and source mesh are NOT rebuilt/cleared.
 * Render batches are instanced; only real floor and tread tops are raycast
 * collision. Doors are separately animated for live interaction.
 */
export function createSuigenTownDistrict({worldRoot,terrainRoot}={}){
  if(!worldRoot?.isObject3D)throw Error('Suigen town requires loaded map root');
  const root=new THREE.Group();root.name='Suigen_Living_Town_60_Enterable_Interiors';
  worldRoot.add(root);
  const terrainGrade=gradeSuigenTownTerrain(terrainRoot||worldRoot);
  const materials=makeMaterials(),batches=new Map(),colliderGeos=[];
  const locations=[],signs=[];
  const tmpP=new THREE.Vector3(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3();
  const tmpM=new THREE.Matrix4();
  const terrainY=groundSampler(terrainRoot||worldRoot);
  const add=(plot,mat,x,y,z,w,h,d,rot=[0,0,0])=>{
    if(!(w>0&&h>0&&d>0))return;
    const wp=plot?rotatePoint(plot,x,z):{x,z};
    const ay=(plot?.baseY||0)+y;
    tmpP.set(wp.x,ay,wp.z);
    tmpQ.setFromEuler(new THREE.Euler(rot[0],(plot?.yaw||0)+rot[1],rot[2]));
    tmpS.set(w,h,d);tmpM.compose(tmpP,tmpQ,tmpS);
    if(!batches.has(mat))batches.set(mat,[]);
    batches.get(mat).push(tmpM.clone());
  };
  const collide=(plot,x,y,z,w,d)=>{
    const p=rotatePoint(plot,x,z);
    tmpP.set(p.x,plot.baseY+y,p.z);
    tmpQ.setFromAxisAngle(new THREE.Vector3(0,1,0),plot.yaw);
    tmpS.set(w,1,d);tmpM.compose(tmpP,tmpQ,tmpS);
    const g=plane.clone();g.applyMatrix4(tmpM);colliderGeos.push(g);
  };
  // Place stepped ground-level stones, retaining the GLB terrain as physics.
  const roads=suigenTownTravelPlan().roads;
  for(const road of roads){
    const [x0,z0]=road.from,[x1,z1]=road.to;
    const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/4);
    for(let i=0;i<=n;i++){
      const t=i/n,x=mix(x0,x1,t),z=mix(z0,z1,t);
      const y=terrainY(x,z);if(y===null)continue;
      const horizontal=Math.abs(x1-x0)>Math.abs(z1-z0);
      const width=road.width,step=3.6;
      add(null,'stone',x,y+.075,z,horizontal?step:width,.12,horizontal?width:step);
      if(i%4===0)for(const side of [-1,1]){
        const lx=x+(horizontal?0:side*(width*.58));
        const lz=z+(horizontal?side*(width*.58):0);
        const edgeY=terrainY(lx,lz);
        if(edgeY!==null)add(null,'copper',lx,edgeY+.10,lz,
          horizontal?.18:.55,.14,horizontal?.55:.18);
      }
    }
  }
  for(const original of SUIGEN_TOWN_PLOTS){
    const plot={...original};
    const halfW=plot.width/2,halfD=plot.depth/2;
    const probes=[[0,0],[-halfW,-halfD],[halfW,halfD],[-halfW,halfD],[halfW,-halfD]];
    const elevations=probes.map(([x,z])=>{
      const p=rotatePoint(plot,x,z);return terrainY(p.x,p.z);
    }).filter(Number.isFinite);
    if(!elevations.length)continue;
    const natural=Math.max(...elevations);
    plot.baseY=natural+.24;plot.groundRange=Math.max(...elevations)-Math.min(...elevations);
    plot.doorOpen=false;plot.doorTarget=false;
    plot.levels=plot.stories;
    locations.push(plot);
    const H=3.7*plot.stories,R=1.8+(plot.seed%5)*.14;
    // Stone foundation & aligned support piers on uneven land.
    add(plot,'stone',0,-.18,0,plot.width+.65,.35,plot.depth+.65);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const corner=rotatePoint(plot,sx*(halfW-.9),sz*(halfD-.9));
      const terrain=terrainY(corner.x,corner.z)??(plot.baseY-.3);
      const height=Math.max(.25,plot.baseY-terrain);
      add(plot,'stone',sx*(halfW-.9),-height/2,sz*(halfD-.9),.92,height,.92);
    }
    // Solid interior floor with actual collider — materials have visible grain.
    add(plot,'floor',0,.025,0,plot.width,.13,plot.depth);
    collide(plot,0,.11,0,plot.width,plot.depth);
    add(plot,'timber',0,.12,0,plot.width,.11,plot.depth);
    // Outer facade: openings for real windows, full-depth front door.
    for(let level=0;level<plot.stories;level++){
      const y=level*3.7,windowY=y+1.5;
      const frameY=y+1.9;
      // Front and back, left and right sections, plus proper lintel above door.
      for(const back of [-1,1]){
        const z=back*halfD;
        const doorOpening=back===1&&level===0;
        const gap=doorOpening?1.58:2.1;
        add(plot,'plaster',-(halfW+gap)/2,frameY,z,halfW-gap,3.65,.24);
        add(plot,'plaster',(halfW+gap)/2,frameY,z,halfW-gap,3.65,.24);
        add(plot,'plaster',0,y+3.13,z,gap*2,.95,.24);
        if(!doorOpening){
          add(plot,'glass',0,windowY,z,gap*2-.12,1.45,.045);
          add(plot,'timber',0,windowY+0.77,z,gap*2+.2,.085,.23);
          add(plot,'timber',0,windowY-.77,z,gap*2+.2,.085,.23);
          add(plot,'timber',0,windowY,z,.09,1.7,.23);
        }else{
          for(const side of [-1,1])
            add(plot,'lacquer',side*1.6,windowY,z,.13,2.63,.28);
        }
      }
      for(const side of [-1,1]){
        const x=side*halfW;
        const panel=plot.depth/3.3;
        for(const dz of [-1,1])
          add(plot,'plaster',x,frameY,dz*(panel*1.05),.24,3.65,panel*1.28);
        add(plot,'plaster',x,y+3.15,0,.24,.96,panel);
        add(plot,'glass',x,windowY,0,.045,1.4,panel*.88);
        for(const z of [-panel*.5,panel*.5])
          add(plot,'timber',x,windowY,z,.25,1.58,.095);
        for(const sy of [-1,1])
          add(plot,'timber',x,windowY+sy*.75,0,.26,.095,panel);
      }
      for(const sx of [-1,1])for(const sz of [-1,1])
        add(plot,'lacquer',sx*halfW,y+1.85,sz*halfD,.38,3.72,.38);
      for(const z of [-halfD,halfD])
        add(plot,'lacquer',0,y+.14,z,plot.width,.24,.3);
      for(const x of [-halfW,halfW])
        add(plot,'lacquer',x,y+.14,0,.3,.24,plot.depth);
      add(plot,'timber',0,y+3.68,0,plot.width+.4,.22,plot.depth+.4);
    }
    // Second storey is a real floor with a stairwell opening.
    if(plot.stories>1){
      const sx=halfW-2.5,lowZ=-halfD+2;
      const openZ=lowZ+2.65,openD=6.1,openW=3.15;
      // Split upper level into three stable platforms around the stairwell.
      const cutX=sx-openW/2,cutRight=sx+openW/2;
      const leftWidth=cutX+halfW;
      const rightWidth=halfW-cutRight;
      for(const [x,w] of [[-halfW+leftWidth/2,leftWidth],[cutRight+rightWidth/2,rightWidth]]){
        add(plot,'floor',x,3.65,0,w,.15,plot.depth);
        collide(plot,x,3.735,0,w,plot.depth);
      }
      const backD=openZ-openD/2+halfD;
      const frontD=halfD-(openZ+openD/2);
      for(const [z,d] of [[-halfD+backD/2,backD],[halfD-frontD/2,frontD]]){
        if(d<=0)continue;
        add(plot,'floor',sx,3.65,z,openW,.15,d);
        collide(plot,sx,3.735,z,openW,d);
      }
      // Real rise and run. Each of 18 treads is separately textured and
      // included in a merged foot collider, not a visual-only stair decal.
      const steps=18,rise=3.7/steps,tread=.30;
      for(let i=0;i<steps;i++){
        const z=lowZ+i*tread,y=rise*(i+1);
        add(plot,'lacquer',sx,y-.075,z,1.74,.16,tread+.04);
        collide(plot,sx,y+.005,z,1.74,tread+.04);
        add(plot,'timber',sx,y/2-.08,z-.12,1.66,y,.07);
      }
      for(const side of [-1,1]){
        add(plot,'glass',sx+side*.95,1.85,lowZ+2.7,.047,2.5,5.6,
          [0,0,Math.atan2(3.7,5.4)*side*.02]);
        add(plot,'lacquer',sx+side*1.02,2.35,lowZ+2.7,.11,.14,5.8,
          [Math.atan2(3.7,5.4),0,0]);
      }
      // Upstairs walkable glass/wood railing around the stairwell.
      for(const side of [-1,1])
        add(plot,'glass',sx+side*openW/2,4.38,openZ,.07,1.15,openD);
      add(plot,'timber',sx,4.40,openZ+openD/2,openW,.11,.09);
    }
    // The underside of the ROOF is textured, not left as bare triangles.
    const roofY=H+.30,ang=Math.atan2(R,halfW),slope=Math.hypot(R,halfW);
    for(const side of [-1,1]){
      const x=side*halfW/2;
      add(plot,'under',x,roofY+R/2-.16,0,slope+.7,.15,plot.depth+2.1,
        [0,0,-side*ang]);
      add(plot,'roof',x,roofY+R/2,0,slope+.85,.21,plot.depth+2.3,
        [0,0,-side*ang]);
      // Individually molded ceramic roof ridge/tile battens.
      for(let s=-4;s<=4;s++){
        const z=s*(plot.depth+1)/9;
        add(plot,'copper',x,roofY+R/2+.09,z,slope+.8,.075,.075,
          [0,0,-side*ang]);
      }
      add(plot,'timber',side*(halfW+.25),roofY-.18,0,.2,.22,plot.depth+2.2);
    }
    add(plot,'copper',0,roofY+R+.16,0,.36,.32,plot.depth+2.4);
    // Eaves, fascia and ornamental beam joinery.
    for(const z of [-halfD-.6,halfD+.6])
      add(plot,'lacquer',0,roofY+.03,z,plot.width+1.2,.17,.25);
    for(const x of [-halfW,halfW])
      add(plot,'lacquer',x,H-.14,0,.22,.26,plot.depth+.7);
    // Walk-up porch aligned to the front door, with genuine horizontal top.
    add(plot,'stone',0,-.04,halfD+1.5,4.8,.2,3);
    collide(plot,0,.075,halfD+1.5,4.8,3);
    add(plot,'stone',0,-.10,halfD+3.4,3.9,.15,.65);
    // INTERIORS: matching exterior and ground floor. Full-scale kitchen
    // with centre island,  cabinets, refrigerator, sink, hob and crockery.
    const kitchenZ=-halfD+3.45;
    add(plot,'lacquer',-halfW+3.7,.9,kitchenZ,5.0,.85,1.25);
    for(let k=0;k<4;k++)add(plot,'timber',-halfW+1.95+k*1.17,1.05,kitchenZ-.60,1.08,1.52,.12);
    add(plot,'metal',-halfW+1.6,1.27,kitchenZ+.64,1.1,.04,.84);
    add(plot,'metal',-halfW+1.64,1.64,kitchenZ+.68,.07,.73,.08);
    add(plot,'white',-halfW+1.8,1.0,kitchenZ-1.45,1.12,1.95,.98); // refrigerator
    add(plot,'metal',-halfW+1.25,1.03,kitchenZ-.94,.065,1.37,.065); // fridge handle
    add(plot,'metal',-halfW+5.55,1.15,kitchenZ+.62,.83,.12,.7); // stovetop
    for(const k of [-1,1])add(plot,'trim',-halfW+5.55+k*.24,1.22,kitchenZ+.61,.17,.025,.18);
    add(plot,'lacquer',-halfW+6.1,.95,-.2,3.3,.88,1.8); // centre island
    add(plot,'floor',-halfW+6.1,1.44,-.2,3.55,.12,2.04);
    for(let s of [-1,1])add(plot,'lacquer',-halfW+6.1+s*.75,.47,.75,.38,.83,.38);
    // Dinner, seats and a fully furnished reading/sitting corner.
    add(plot,'lacquer',2.8,.96,-.35,3.5,.17,2.05);
    for(const x of [.75,4.75])for(const z of [-1.2,.55]){
      add(plot,'timber',x,.45,z,.77,.12,.75);
      add(plot,'timber',x,.9,z-.32,.77,.92,.13);
      for(const sx of [-1,1])add(plot,'lacquer',x+sx*.29,.25,z,.09,.48,.55);
    }
    add(plot,'fabric',-halfW+3.2,.58,halfD-4.15,3.8,.64,1.32);
    add(plot,'timber',-halfW+3.2,1.02,halfD-4.7,3.82,.92,.31);
    add(plot,'lacquer',-halfW+3.2,.43,halfD-2.1,2.1,.17,1.05);
    // Real decorative molding, Japanese-inspired original art and wall frames.
    for(const y of [.34,H-.42]){
      for(const z of [-halfD+.13,halfD-.13])
        add(plot,'lacquer',0,y,z,plot.width,.11,.1);
      for(const x of [-halfW+.13,halfW-.13])
        add(plot,'lacquer',x,y,0,.1,.11,plot.depth);
    }
    for(const n of [-1,1]){
      add(plot,'lacquer',n*(halfW-2.2),2.24,-halfD+.13,2.15,1.53,.10);
      add(plot,'art',n*(halfW-2.2),2.25,-halfD+.23,1.88,1.25,.033);
      add(plot,'white',n*(halfW-2.2),2.12,-halfD+.26,.82,.095,.04);
    }
    // Upper floor: two comfortable furnished bedrooms, storage, art,
    // upstairs lounge and lamps. The stairwell stays unobstructed.
    if(plot.stories===2){
      const by=3.7;
      for(const side of [-1,1]){
        const x=side*(halfW-4.3);
        add(plot,'timber',x,by+.35,halfD-4.65,3.4,.55,2.35);
        add(plot,'white',x,by+.72,halfD-5.2,2.9,.25,1.1);
        add(plot,'fabric',x,by+.56,halfD-4.1,2.95,.13,1.2);
        add(plot,'lacquer',x+side*2.6,by+.95,halfD-4.65,1.5,1.85,.85); // wardrobe
        add(plot,'lacquer',x,by+.63,halfD-8.4,1.8,.85,1.05); // desk
        add(plot,'art',x,by+2.25,halfD-.14,2.25,1.35,.06);
      }
      add(plot,'fabric',-2.8,by+.42,-.9,3.2,.6,1.4);
      add(plot,'lacquer',-2.8,by+.35,.55,1.65,.2,1.04);
      add(plot,'timber',0,by+2.08,-halfD+.20,3.5,2.3,.35); // upstairs display shelving
    }
    for(const level of [0,...(plot.stories===2?[1]:[])])
      for(const z of [-halfD+2,halfD-2]){
        add(plot,'copper',0,level*3.7+3.26,z,.18,.18,.18);
        add(plot,'glow',0,level*3.7+3.05,z,.35,.47,.35);
      }
    // Prefab-specific exterior/inside: keep a distinct shopfront and
    // point to real existing Blacksmith/Character/Spirituality services.
    if(plot.merchantId){
      add(plot,'stone',0,.95,-halfD+2.7,4.4,1.15,.92); // merchant counter
      add(plot,'floor',0,1.59,-halfD+2.7,4.65,.14,1.10);
      const signTex=signTexture(plot.name);
      if(signTex){
        const mat=new THREE.MeshBasicMaterial({map:signTex,transparent:false,side:THREE.DoubleSide});
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.32),mat);
        const pos=rotatePoint(plot,0,halfD+.19);
        sign.position.set(pos.x,plot.baseY+3.05,pos.z);
        sign.rotation.y=plot.yaw;
        root.add(sign);signs.push(sign);
      }
      if(plot.category==='apothecary'){
        for(let i=0;i<12;i++){
          const x=-1.9+(i%6)*.72,z=-halfD+2.7+(Math.floor(i/6)*.2-.10);
          add(plot,i%3?'glass':'green',x,1.75,z,.26,.38,.26);
          add(plot,'copper',x,1.99,z,.15,.09,.15);
        }
      }else if(plot.category==='blacksmith'||plot.category==='weapons'){
        for(let i=0;i<6;i++){
          const x=-2+(i%3)*1.3,z=-halfD+2.25;
          add(plot,'metal',x,2.0+Math.floor(i/3)*.45,z,.08,1.4,.13);
          add(plot,'copper',x,1.36+Math.floor(i/3)*.45,z,.38,.1,.11);
        }
      }
    }
    // Sliding double doors: E toggles real opening, not a fake portal.
    const door=new THREE.Group();const front=rotatePoint(plot,0,halfD+.14);
    door.position.set(front.x,plot.baseY+1.31,front.z);
    door.rotation.y=plot.yaw;
    for(const sign of [-1,1]){
      const panel=new THREE.Mesh(new THREE.BoxGeometry(1.18,2.42,.09),materials.lacquer);
      panel.position.x=sign*.62;panel.castShadow=true;
      panel.userData.slideSign=sign;door.add(panel);
      const pane=new THREE.Mesh(new THREE.BoxGeometry(.82,1.30,.052),materials.glass);
      pane.position.set(sign*.62,.23,.06);pane.userData.slideSign=sign;door.add(pane);
    }
    root.add(door);plot.door=door;
    // Door lintel, vertical side molding, and weather-sheltered lanterns.
    add(plot,'lacquer',0,2.6,halfD+.14,3.7,.18,.30);
    for(const sign of [-1,1]){
      add(plot,'lacquer',sign*1.42,1.3,halfD+.1,.17,2.7,.28);
      add(plot,'glow',sign*2.03,2.46,halfD+.5,.31,.45,.31);
    }
    // Individual small garden borders, flower pots and different facade profiles.
    for(const sign of [-1,1]){
      add(plot,'stone',sign*(halfW-1.4),.27,halfD+1.5,2.4,.52,.85);
      add(plot,'green',sign*(halfW-1.4),.68,halfD+1.5,2.0,.45,.62);
    }
    plot.center={x:plot.x,y:plot.baseY,z:plot.z};
    plot.front=rotatePoint(plot,0,halfD+1.1);
    plot.counter=rotatePoint(plot,0,-halfD+3);
  }

  // Pooled instanced detail keeps dozens of interiors under a few draw calls.
  for(const [key,matrices] of batches){
    if(!matrices.length)continue;
    const instanced=new THREE.InstancedMesh(unit,materials[key],matrices.length);
    instanced.name='Suigen_'+key+'_Instanced_Architectural_Details';
    instanced.castShadow=key!=='glass'&&key!=='glow';
    instanced.receiveShadow=true;
    matrices.forEach((matrix,i)=>instanced.setMatrixAt(i,matrix));
    instanced.instanceMatrix.needsUpdate=true;
    instanced.computeBoundingSphere();
    instanced.frustumCulled=true; // don't render the entire town from far mountain regions
    root.add(instanced);
  }
  const colliders=colliderGeos.length?mergeGeometries(colliderGeos,false):null;
  colliderGeos.forEach(g=>g.dispose());
  const walkables=[];
  if(colliders){
    const surface=new THREE.Mesh(colliders,new THREE.MeshBasicMaterial({
      visible:false,side:THREE.DoubleSide,
    }));
    surface.name='Suigen_Buildings_Walkable_Floors_Stairs';
    surface.userData.collisionOnly=true;
    root.add(surface);walkables.push(surface);
  }

  // Deliberately simple local collision: no arbitrary "every building is solid"
  // blocker. The front doorway opens, and interior walkthrough is allowed.
  function resolveCollision(position,previous,radius=.6){
    for(const plot of locations){
      if(Math.abs(position.x-plot.x)>plot.width+2||
         Math.abs(position.z-plot.z)>plot.depth+2)continue;
      if(position.y>plot.baseY+plot.stories*3.7+.8||
         position.y<plot.baseY-3)continue;
      const q=localPoint(plot,position.x,position.z);
      const w=plot.width/2,d=plot.depth/2;
      const atSide=Math.abs(q.x)>w-.24-radius&&Math.abs(q.x)<w+.24+radius
        &&Math.abs(q.z)<d+.14;
      const atBack=q.z< -d+.24+radius&&q.z> -d-.25-radius
        &&Math.abs(q.x)<w+.14;
      const front=q.z>d-.24-radius&&q.z<d+.25+radius&&Math.abs(q.x)<w+.14;
      const doorway=Math.abs(q.x)<1.18-radius*.2&&plot.doorOpen;
      // The kitchen island, refrigerator, dining table, merchant counter,
      // upstairs beds and lounge furniture are real obstructions. Only
      // walls/fixtures block: the doorway, staircase and corridors stay free.
      const localHeight=position.y-plot.baseY;
      const inside=Math.abs(q.x)<w-.25&&Math.abs(q.z)<d-.25;
      const furniture=localHeight<3.35
        ? [
            [-w+3.7,-d+3.45,2.5,.7], // full fitted kitchen counter
            [-w+1.8,-d+1.99,.61,.58], // refrigerator
            [-w+6.1,-.2,1.78,1.03], // centre island
            [2.8,-.35,1.75,1.03], // dining
            [-w+3.2,d-4.15,1.95,.81], // lounge sofa
            ...(plot.merchantId?[[0,-d+2.7,2.2,.66]]:[]), // trader's counter
          ]
        : plot.stories>1?[
            [-w+4.3,d-4.65,1.85,1.25],
            [w-4.3,d-4.65,1.85,1.25],
            [0,-d+.20,1.95,.45], // upstairs display shelving
          ]:[];
      const hittingFurniture=inside&&furniture.some(([x,z,hx,hz])=>
        Math.abs(q.x-x)<hx+radius*.55&&Math.abs(q.z-z)<hz+radius*.55);
      if(atSide||atBack||(front&&!doorway)||hittingFurniture){
        position.x=previous.x;position.z=previous.z;return true;
      }
    }
    return false;
  }
  function nearestInteraction(pos,maxDistance=2.55){
    if(!pos)return null;
    let nearest=null,closest=maxDistance;
    for(const plot of locations){
      if(Math.abs(pos.x-plot.x)>plot.width+8||
         Math.abs(pos.z-plot.z)>plot.depth+8)continue;
      const frontDistance=Math.hypot(pos.x-plot.front.x,pos.z-plot.front.z);
      if(frontDistance<closest&&Math.abs(pos.y-plot.baseY)<3.4){
        closest=frontDistance;
        nearest={kind:'door',plot,label:(plot.doorOpen?'Close ':'Open ')+plot.name};
      }
      if(!plot.merchantId||!plot.doorOpen)continue;
      const counterDist=Math.hypot(pos.x-plot.counter.x,pos.z-plot.counter.z);
      if(counterDist<closest&&Math.abs(pos.y-plot.baseY)<2.8){
        closest=counterDist;
        nearest={kind:'merchant',plot,label:'Trade with '+plot.name};
      }
    }
    return nearest;
  }
  function interact(pos){
    const near=nearestInteraction(pos);
    if(!near)return null;
    if(near.kind==='door'){
      near.plot.doorOpen=!near.plot.doorOpen;
      near.plot.doorTarget=near.plot.doorOpen;
      return {kind:'door',name:near.plot.name,open:near.plot.doorOpen};
    }
    return {kind:'merchant',name:near.plot.name,
      merchantId:near.plot.merchantId,category:near.plot.category,
      service:near.plot.service};
  }
  let disposed=false,elapsed=0;
  const report=Object.freeze({
    totalPlots:SUIGEN_TOWN_PLOTS.length,placedBuildings:locations.length,
    enterableBuildings:locations.length,
    merchants:locations.filter(p=>p.merchantId).length,
    walkableSurfaces:walkables.length,
    floorLevels:locations.reduce((n,p)=>n+p.stories,0),
    gradedTerrainVertices:terrainGrade.adjustedVertices,
    floorAndStairTriangles:colliders?.index?colliders.index.count/3:
      (colliders?.attributes?.position?.count||0)/3,
  });
  root.userData.suigenTownReport=report;
  return {
    root,walkables,report,locations,
    nearestInteraction,interact,resolveCollision,
    update(delta){
      if(disposed)return;
      elapsed+=Math.max(0,Math.min(.1,Number(delta)||0));
      const t=1-Math.exp(-12*Math.max(0,Math.min(.1,Number(delta)||0)));
      for(const plot of locations){
        for(const panel of plot.door.children){
          const sign=panel.userData.slideSign;
          const x=sign*(plot.doorTarget?1.76:.62);
          panel.position.x=mix(panel.position.x,x,t);
        }
      }
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      root.parent?.remove(root);
      for(const sign of signs){
        sign.geometry.dispose();sign.material.map?.dispose();sign.material.dispose();
      }
      for(const plot of locations){
        plot.door.traverse(node=>{if(node.isMesh)node.geometry.dispose();});
      }
      for(const mat of Object.values(materials)){
        mat.map?.dispose?.();mat.dispose();
      }
      colliders?.dispose();
      root.clear();
    },
  };
}
