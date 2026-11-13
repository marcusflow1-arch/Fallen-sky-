// Wolfveil Village connected town, housing, and hero landmarks. The shapes
// have actual architectural thickness, rear walls and independent tile rows.
// The building kit is deliberately reusable; its instances are batched.
import * as THREE from 'three';
import {WOLFVEIL_SITES as SITE,WOLFVEIL_ACTIVE_TOWN_BUILDINGS as BUILDINGS,
  WOLFVEIL_HOUSING_PLOTS as PLOTS,WOLFVEIL_MARKET_STALLS as STALLS,
  WOLFVEIL_BRIDGES as BRIDGES,
  wolfveilHeight} from './WolfveilLayout.js';
import {WolfveilTriangles,WolfveilBuilder,mulberry32,material} from './WolfveilGeometry.js';
import {buildHeroResidenceExterior} from './WolfveilHeroExterior.js';
import {createWolfveilTerrainSurfaceSampler} from './WolfveilTerrainSurfaceSampler.mjs';
import {planWolfveilBridgeDeck} from './WolfveilBridgeProfile.mjs';
const twopi=Math.PI*2;
const color=(hex)=>new THREE.Color(hex);
const heightAt=(p)=>wolfveilHeight(p.x,p.z);

function profile(world,name,points,size=.35,materialName='cedar'){
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const len=Math.hypot(dx,dy,dz),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,mz=(a[2]+b[2])/2;
    // Beam follows the XZ direction; vertical risers are routed separately.
    if(Math.abs(dy)>len*.35 && Math.hypot(dx,dz)<.03){
      world.box(materialName,mx,my,mz,size,len,size);
    }else world.box(materialName,mx,my,mz,size,size,len,Math.atan2(dx,dz));
  }
}
function roofTiles(world,x,z,w,d,y,pitch=2.3,variant=0){
  const roofWriter=world.roofWriter??=new WolfveilTriangles();
  const eave=w*.5+.7,depth=d*.5+.8;
  const rafters=9;
  const rows=Math.max(6,Math.ceil(eave/.78));
  const colCount=Math.max(6,Math.ceil(d/1.0));
  const center=[.67,.75,.92];
  for(const sign of [-1,1]){
    for(let i=0;i<rows;i++){
      const a=i/rows,b=(i+1)/rows;
      const xa=sign*(a*eave),xb=sign*(b*eave);
      const ya=y+pitch*(1-a)+.12*Math.sin(a*Math.PI);
      const yb=y+pitch*(1-b)+.12*Math.sin(b*Math.PI);
      for(let k=0;k<colCount;k++){
        const za=-depth+k/colCount*2*depth;
        const zb=-depth+(k+1)/colCount*2*depth;
        const seam=(i+k+variant)%5===0?.15:0;
        const tint=(.53+.08*((i*13+k*7+variant)%5))*(1-seam);
        const shade=[.37*tint,.54*tint,.86*tint];
        // Each tile has an actual lip and a slight up-curved center.
        const ripple=.045*Math.sin((k+.5)*twopi/colCount);
        roofWriter.quad([x+xa,ya,z+za],[x+xa,ya,z+zb],
          [x+xb,yb+ripple,z+zb],[x+xb,yb+ripple,z+za],shade);
      }
    }
  }
  world.box('roofEdge',x,y+pitch+.15,z,.40,.39,d+2.0); // real ridge cap
  for(const sign of [-1,1]){
    const ey=x+sign*eave;
    world.box('roofEdge',ey,y,z,.38,.25,d+2);
    for(let zi=0;zi<3;zi++){
      const rz=z+(zi-1)*depth*.7;
      world.box('cedar',ey*.997,y-.45,rz,.22,.28,.25);
    }
  }
  for(let i=0;i<rafters;i++){
    const zz=z+(i/(rafters-1)-.5)*(d+.9);
    // ridge to eave wooden support represented by structural rafters
    const beamY=y+.12;
    world.box('darkCedar',x-w*.26,beamY,zz,w*.5,.22,.22);
    world.box('darkCedar',x+w*.26,beamY,zz,w*.5,.22,.22);
  }
}
function addWallOpenings(world,b,story,Y){
  const {x,z,w,d}=b;
  const front=z-d*.5,rear=z+d*.5;
  const doorWidth=b.kind==='hall'||b.kind==='sanctuary'?3.6:2.5;
  // Front elevation is segmented either side of a functional walking door.
  const sideW=(w-doorWidth)*.5;
  world.box('plaster',x-(w+doorWidth)*.25,Y+1.55,front,sideW,3.1,.22);
  world.box('plaster',x+(w+doorWidth)*.25,Y+1.55,front,sideW,3.1,.22);
  world.box('plaster',x,Y+2.78,front,doorWidth,.65,.22);
  world.box('darkCedar',x-doorWidth*.5,Y+1.35,front-.1,.23,2.7,.28);
  world.box('darkCedar',x+doorWidth*.5,Y+1.35,front-.1,.23,2.7,.28);
  world.box('darkCedar',x,Y+2.73,front-.1,doorWidth+.34,.20,.28);
  // Rear façade and both side walls are complete, avoiding one-camera facades.
  world.box('plaster',x,Y+1.55,rear,w,3.1,.23);
  world.box('plaster',x-w*.5,Y+1.55,z,.24,3.1,d);
  world.box('plaster',x+w*.5,Y+1.55,z,.24,3.1,d);
  // Multiple recessed windows and deep cedar framing.
  for(const sx of [-1,1]){
    for(const az of [front+.18,rear-.18]){
      const windowX=x+sx*w*.29;
      world.box('darkCedar',windowX,Y+1.85,az,.95,1.20,.17);
      world.box('ink',windowX,Y+1.85,az+ (az<z?-.105:.105),.75,1.0,.035);
      world.box('cedarLight',windowX,Y+1.85,az+.16,.07,1.06,.12);
      world.box('cedarLight',windowX,Y+1.85,az+.16,.79,.065,.11);
    }
  }
  for(const xx of [-w*.5,w*.5])for(const zz of [-d*.5,d*.5])
    world.box('cedar',x+xx,Y+1.64,z+zz,.32,3.45,.32);
  for(const zz of [-d*.5,d*.5])
    world.box('cedar',x,Y+3.14,z+zz,w+.3,.31,.3);
  for(const xx of [-w*.5,w*.5])
    world.box('cedar',x+xx,Y+3.14,z,.3,.31,d+.3);
}
function furnishing(world,b,Y){
  const {x,z,w,d}=b;
  world.box('cedarLight',x,Y+.12,z,w-.8,.24,d-.8);
  if(b.kind==='forge'){
    world.box('basalt',x+w*.22,Y+.68,z+d*.20,3.3,1.35,2);
    world.box('darkCedar',x-w*.18,Y+1.05,z+.8,4.7,.24,1.4);
    world.box('lantern',x+w*.22,Y+1.47,z+d*.20,.68,.40,.56);
  }else if(b.kind==='inn'||b.kind==='shop'){
    world.box('cedarLight',x,Y+.76,z,4.3,.22,1.25);
    for(let k=0;k<3;k++)
      world.box('cedar',x+(k-1)*1.3,Y+.42,z-.1,.19,.72,.19);
  }else if(b.kind==='archive'){
    for(const side of [-1,1])for(let k=0;k<3;k++){
      world.box('darkCedar',x+side*(w*.5-1),Y+.55+k*.83,z,1.1,.16,d*.65);
    }
    world.box('cedarLight',x,Y+.55,z,4,.16,2.8);
  }else if(b.kind==='residence'){
    world.box('cedar',x+1,Y+.60,z+1,2.7,.20,2.4);
    world.box('cedarLight',x-2,Y+.42,z+2,2.1,.18,.8);
  }else if(b.kind==='sanctuary'){
    world.box('basalt',x,Y+.90,z,4.2,1.8,3.1);
    world.box('spirit',x,Y+2.10,z,1.2,.65,.6);
  }
}
// A residence-only art pass: details share the world instancing batches and
// deliberately keep the 2.5 m front door unobstructed.
function detailResidence(world,b,Y,top,pitch){
  const {x,z,w,d}=b;
  const front=z-d*.5;
  const eaveY=top;
  // Warm shoji panes, raised cedar muntins, external sill and hinged shutters.
  for(const side of [-1,1]){
    const wx=x+side*w*.29;
    const face=front-.18;
    world.box('plaster',wx,Y+1.85,face,.72,.91,.045);
    world.box('cedarLight',wx,Y+1.85,face-.043,.065,1.08,.05);
    for(const h of [Y+1.56,Y+1.85,Y+2.14])
      world.box('cedarLight',wx,h,face-.049,.85,.045,.06);
    world.box('cedar',wx,Y+1.22,face-.10,1.32,.16,.35);
    const shutterX=wx+side*.79;
    world.box('darkCedar',shutterX,Y+1.85,face-.03,.51,1.23,.08);
    for(let i=0;i<5;i++)
      world.box('cedar',shutterX,Y+1.36+i*.24,face-.09,.42,.055,.06);
    // One planter beneath each front window, well outside the door width.
    world.box('darkCedar',wx,Y+.91,front-.41,1.48,.31,.46);
    world.box('moss',wx,Y+1.12,front-.41,1.28,.12,.33);
  }
  // Raised stone-and-timber stoop; porch supports are outside the door gap.
  world.box('granite',x,Y-.03,front-.89,5.9,.19,2.05);
  world.box('cedarLight',x,Y+.11,front-.90,5.65,.14,1.82);
  for(const side of [-1,1]){
    const px=x+side*2.38,pz=front-1.57;
    world.box('granite',px,Y+.21,pz,.64,.38,.64);
    world.box('cedar',px,Y+1.46,pz,.24,2.34,.24);
    world.box('darkCedar',px,Y+2.70,pz,.50,.18,.50);
    world.box('cedar',px,Y+.93,pz,.16,.12,.66);
  }
  world.box('darkCedar',x,Y+2.83,front-1.56,5.54,.21,.34);
  world.box('roofEdge',x,Y+3.01,front-1.10,6.16,.20,1.67);
  world.box('cedar',x,Y+2.78,front-2.01,6.20,.20,.25);
  // Baseboard, exposed corner joinery and cross ties give readable scale.
  for(const sx of [-1,1]){
    world.box('darkCedar',x+sx*(w*.5-.17),Y+.27,z,.26,.52,d);
    for(const zz of [z-d*.27,z+d*.27])
      world.box('cedar',x+sx*w*.5,Y+1.76,zz,.30,2.9,.15);
  }
  world.box('darkCedar',x,eaveY-.10,front,w+.32,.20,.32);
  world.box('darkCedar',x,eaveY-.10,z+d*.5,w+.32,.20,.32);
  // The previous blockout left the front/rear roof triangles open.
  // Fill those gables below the roof silhouette without sealing the door.
  const triangles=world.roofWriter??=new WolfveilTriangles();
  const cream=[.74,.69,.60];
  for(const gz of [front,z+d*.5]){
    triangles.tri([x-w*.5,top-.025,gz],[x+w*.5,top-.025,gz],
      [x,top+pitch-.07,gz],cream);
    world.box('cedar',x,top+.22,gz+(gz===front?-.12:.12),w*.80,.17,.22);
    world.box('darkCedar',x,top+pitch*.45,gz+(gz===front?-.13:.13),w*.55,.12,.19);
    world.box('cedar',x,top+pitch*.66,gz+(gz===front?-.15:.15),.20,pitch*.56,.20);
  }
}
function foundation(world,b){
  const h=wolfveilHeight(b.x,b.z);
  const cornerHeights=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz])=>
    wolfveilHeight(b.x+sx*(b.w/2),b.z+sz*(b.d/2)));
  const Y=Math.max(h,...cornerHeights)+.56;
  const low=Math.min(h,...cornerHeights);
  world.box('basalt',b.x,(Y+low-1.1)/2,b.z,b.w+1,Y-low+1.1,b.d+1.0);
  world.box('granite',b.x,Y+.15,b.z,b.w+1.35,.28,b.d+1.35);
  // A genuine stone entry stair reaches the terrain instead of floating.
  const front=b.z-b.d*.5-.6;
  const surface=wolfveilHeight(b.x,front-2.4);
  const drop=Math.max(.1,Y+.24-surface);
  const count=Math.max(1,Math.min(9,Math.ceil(drop/.22)));
  if(b.id!=='existing_residence_1')for(let i=0;i<count;i++){
    const stepY=surface+(i+1)/count*drop;
    world.box('granite',b.x,stepY-.08,front-2.2+i/count*2.2,3.5,.18,.38);
  }
  return Y+.29;
}
function building(world,b,approachWorld=world){
  const Y=foundation(world,b);
  const stories=b.stories||1;
  for(let floor=0;floor<stories;floor++){
    addWallOpenings(world,b,floor,Y+floor*3.4);
    if(floor>0)
      world.box('cedarLight',b.x,Y+floor*3.4,b.z,b.w+.2,.29,b.d+.2);
  }
  const top=Y+stories*3.4;
  const pitch=2.2+(b.variant%3)*.30;
  roofTiles(world,b.x,b.z,b.w,b.d,top,pitch,b.variant);
  if(b.kind==='residence') detailResidence(world,b,Y,top,pitch);
  const heroExterior=buildHeroResidenceExterior(world,b,Y,approachWorld);
  if(stories>1){
    const front=b.z-b.d*.5-1.05;
    world.box('cedarLight',b.x,Y+3.3,front,b.w*.74,.24,2.1);
    for(let ix=-2;ix<=2;ix++)
      world.box('cedar',b.x+ix*b.w*.15,Y+3.85,front-1.0,.15,1.0,.17);
    world.box('cedar',b.x,Y+4.37,front-1.0,b.w*.75,.17,.16);
  }
  if(b.hasInterior)furnishing(world,b,Y);
  // Warm lanterns define doorways. Use a single bounded emissive batch rather
  // than creating a point light per home.
  world.box('lantern',b.x-2,Y+2.2,b.z-b.d/2-.35,.45,.65,.43);
  return {id:b.id,kind:b.kind,x:b.x,z:b.z,w:b.w,d:b.d,entrance:[b.x,b.z-b.d*.5-1.3],Y,
    ...(heroExterior?{exterior:heroExterior}:{}),
  };
}
function market(world,{hideStalls=false}={}){
  const Y=heightAt(SITE.market);
  // A real 35m walking plaza with individual textured paving slabs.
  const rad=17;
  for(let zi=-rad;zi<rad;zi+=2.1)for(let xi=-rad;xi<rad;xi+=2.1){
    if(Math.hypot(xi,zi)>rad-1.6)continue;
    const bx=SITE.market.x+xi,bz=SITE.market.z+zi;
    const h=wolfveilHeight(bx,bz);
    world.box((Math.round(xi+zi)%6===0)?'basalt':'granite',bx,h+.05,bz,2.0,.12,2.0);
  }
  // Game 3D player-requested cleanup: disable all eight shelter/table roofs,
  // legs, platforms and hanging lanterns together. Game 1 default remains.
  for(const stall of (hideStalls?[]:STALLS)){
    const y=wolfveilHeight(stall.x,stall.z);
    for(const px of [-1.95,1.95])for(const pz of [-1.55,1.55])
      world.box('cedar',stall.x+px,y+1.24,stall.z+pz,.17,2.5,.17);
    world.box('cedarLight',stall.x,y+.95,stall.z,3.9,.18,2.8);
    world.box('indigo',stall.x,y+2.44,stall.z,4.6,.21,3.8);
    world.box('roofEdge',stall.x,y+2.41,stall.z-1.9,4.6,.18,.35);
    world.box('lantern',stall.x,y+1.60,stall.z-1.5,.34,.43,.31);
  }
  // Fountain's concentric carved layers are genuine 3D geometry.
  const basin=new THREE.Mesh(new THREE.TorusGeometry(4.0,.47,10,36),world.materials.granite);
  basin.name='SWV_Wolf_Spirit_Central_Fountain_Rim';
  basin.rotation.x=Math.PI/2;
  basin.position.set(0,Y+.65,-69);world.mesh(basin);
  world.box('basalt',0,Y+.33,-69,6.4,.45,6.4);
  world.box('spirit',0,Y+1.45,-69,1.2,2.1,.85);
  for(const xx of [-1.7,1.7])
    world.box('spirit',xx,Y+2.45,-69,.25,2.7,.31);
  return {plazaRadius:rad,stallCount:hideStalls?0:STALLS.length};
}
function gates(world){
  for(const place of [SITE.southGate,SITE.sanctuary]){
    const {x,z}=place,y=heightAt(place);
    const sacred=place===SITE.sanctuary;
    for(const side of [-1,1]){
      world.box('basalt',x+side*(sacred?5.0:6.8),y+2,z,1.6,4,1.6);
      world.box('cedar',x+side*(sacred?5.0:6.8),y+5,z,.95,6.4,1);
      world.box('spirit',x+side*(sacred?5.0:6.8),y+7,z,.35,.9,.38);
    }
    world.box('darkCedar',x,y+7.4,z,sacred?14:18,.68,1.6);
    roofTiles(world,x,z,sacred?16:20,3,y+7.6,2.4,2);
    world.box('granite',x,y+.05,z,17,.17,6);
  }
  // Twin carved standing wolf-stones frame the sacred north approach.
  const y=heightAt(SITE.sanctuary);
  for(const side of [-1,1]){
    world.box('basalt',side*10,y+2.8,189,2.5,5.6,2.2);
    world.box('spirit',side*10,y+5.1,189,.22,1.4,.24);
  }
}
function bridges(world,{terrainSpan=1100,terrainSegments=310}={}){
  const receipts=[];
  // Sample the exact 310x310 triangle terrain that is used by the live
  // Game 3D ground raycast. The old high-bank constant deck Y left the
  // opposite shoreline floating by as much as a dozen metres.
  const surface=createWolfveilTerrainSurfaceSampler({
    span:terrainSpan,segments:terrainSegments,
  });
  const plankMat=material(0xffffff,.87,{vertexColors:true,side:THREE.DoubleSide});
  const floorProbeMat=new THREE.MeshBasicMaterial({
    side:THREE.DoubleSide,colorWrite:false,depthWrite:false,
  });
  world.ownedMaterials.push(plankMat,floorProbeMat);
  world.walkableSurfaces??=[];
  for(const b of BRIDGES){
    const deck=planWolfveilBridgeDeck(b,surface);
    const visual=new WolfveilTriangles(),footing=new WolfveilTriangles();
    const planks=Math.ceil(deck.len/1.12);
    const side=deck.width/2;
    // Individual planks preserve a visible wood grain/board rhythm. The
    // collision probe forms ONE continuous surface across the 2cm seams.
    const edgeOffsets=deck.offsets;
    for(let i=0;i<planks;i++){
      const t0=i/planks,t1=(i+1)/planks;
      const inset=Math.min(.009,1/planks*.15);
      const shade=.70+(i%6)*.028,shadeColor=[shade,shade*.98,shade*.88];
      for(let j=0;j<edgeOffsets.length-1;j++){
        const left=edgeOffsets[j],right=edgeOffsets[j+1];
        const p00=deck.pointAt(t0+inset,left),
          p01=deck.pointAt(t0+inset,right),
          p11=deck.pointAt(t1-inset,right),
          p10=deck.pointAt(t1-inset,left);
        for(const p of [p00,p01,p11,p10])p[1]+=.005;
        visual.quad(p00,p01,p11,p10,shadeColor);
      }
    }
    for(let i=0;i<deck.steps;i++){
      const a=i/deck.steps,c=(i+1)/deck.steps;
      for(let j=0;j<edgeOffsets.length-1;j++){
        const p00=deck.pointAt(a,edgeOffsets[j]),
          p01=deck.pointAt(a,edgeOffsets[j+1]),
          p11=deck.pointAt(c,edgeOffsets[j+1]),
          p10=deck.pointAt(c,edgeOffsets[j]);
        for(const p of [p00,p01,p11,p10])p[1]+=.012;
        footing.quad(p00,p01,p11,p10);
      }
    }
    // Full-thickness cedar fascias follow the contoured plank edges, while
    // two shallow stone abutments physically seat the end planks into BOTH
    // natural shore profiles. They are visual supports, not extra foot floors.
    const fascia=new WolfveilTriangles(),abutments=new WolfveilTriangles();
    for(let i=0;i<deck.steps;i++){
      const t0=i/deck.steps,t1=(i+1)/deck.steps;
      for(const lateral of [-side,side]){
        const a=deck.pointAt(t0,lateral),d=deck.pointAt(t1,lateral);
        const aa=[a[0],a[1]-.21,a[2]],dd=[d[0],d[1]-.21,d[2]];
        fascia.quad(a,d,dd,aa,[.40,.33,.26]);
      }
    }
    for(const t of [0,1])for(let j=0;j<edgeOffsets.length-1;j++){
      const l=deck.pointAt(t,edgeOffsets[j]),
        r=deck.pointAt(t,edgeOffsets[j+1]);
      const lowerL=[l[0],surface(l[0],l[2])-.10,l[2]],
        lowerR=[r[0],surface(r[0],r[2])-.10,r[2]];
      abutments.quad(l,r,lowerR,lowerL,[.48,.49,.43]);
    }
    const fasciaMat=material(0xffffff,.93,{
      vertexColors:true,side:THREE.DoubleSide,
    });
    world.ownedMaterials.push(fasciaMat);
    const edgeObj=world.mesh(new THREE.Mesh(fascia.geometry(),fasciaMat));
    edgeObj.name='SWV_Bridge_SolidWoodEdgeFascia_'+b.id;
    const shoreObj=world.mesh(new THREE.Mesh(abutments.geometry(),fasciaMat));
    shoreObj.name='SWV_Bridge_EmbeddedStoneShoreAbutments_'+b.id;
    edgeObj.receiveShadow=true;shoreObj.receiveShadow=true;
    const deckObj=world.mesh(new THREE.Mesh(visual.geometry(),plankMat));
    deckObj.name='SWV_Bridge_SeatedWoodPlanks_'+b.id;
    deckObj.receiveShadow=true;
    const walkable=world.mesh(new THREE.Mesh(footing.geometry(),floorProbeMat));
    walkable.name='SWV_Bridge_ContinuousWalkableDeck_'+b.id;
    walkable.userData={
      walkable:true,bridgeDeck:true,bridgeId:b.id,
      clientGroundRaycast:true,notServerAuthority:true,
    };
    // The EXISTING GameWorld3D foot/click groundMeshes list reads this same
    // walkableSurfaces array. It must not raycast decorative rocks as a floor.
    world.walkableSurfaces.push(walkable);
    const dx=b.to[0]-b.from[0],dz=b.to[1]-b.from[1];
    const every=Math.max(1,Math.round(2.3/(deck.len/deck.steps)));
    for(let i=0;i<=deck.steps;i+=every){
      const t=i/deck.steps;
      for(const lateral of [-side-.16,side+.16]){
        const p=deck.pointAt(t,lateral<0?-side:side);
        const x=p[0],z=p[2],y=p[1];
        const delta=lateral<0?-1:1;
        const nx=-dz/deck.len,nz=dx/deck.len;
        world.box('cedar',x+nx*delta*.16,y+.58,z+nz*delta*.16,.21,1.15,.21);
      }
    }
    // A single joined rail mesh follows every grade change continuously;
    // ordinary yaw-only timber boxes leave visible breaks on a steep bridge.
    const railGeometry=new WolfveilTriangles();
    for(let i=0;i<deck.steps;i++){
      const t0=i/deck.steps,t1=(i+1)/deck.steps;
      for(const sideSign of [-1,1]){
        // pointAt() already includes half the bridge width; only add a
        // 14cm outward offset to the visible rail ribbon.
        const lateral=sideSign*.14;
        const nx=-dz/deck.len,nz=dx/deck.len;
        const a=deck.pointAt(t0,sideSign*side),
          c=deck.pointAt(t1,sideSign*side);
        for(const p of [a,c]){
          p[0]+=nx*lateral;p[2]+=nz*lateral;
        }
        const aBottom=[a[0],a[1]+.97,a[2]],
          cBottom=[c[0],c[1]+.97,c[2]],
          cTop=[c[0],c[1]+1.14,c[2]],
          aTop=[a[0],a[1]+1.14,a[2]];
        railGeometry.quad(aBottom,cBottom,cTop,aTop,[.68,.58,.44]);
      }
    }
    const railMat=material(0xffffff,.88,{
      vertexColors:true,side:THREE.DoubleSide,
    });
    world.ownedMaterials.push(railMat);
    const railObject=world.mesh(new THREE.Mesh(railGeometry.geometry(),railMat));
    railObject.name='SWV_Bridge_ContinuousGradeMatchedRails_'+b.id;
    railObject.receiveShadow=true;
    for(const t of [.16,.40,.65,.87]){
      const p=deck.pointAt(t,0);
      const ground=surface(p[0],p[2]);
      const h=Math.max(.2,p[1]-ground-.20);
      if(h>.3)world.box(b.kind==='stone'?'basalt':'darkCedar',
        p[0],ground+h*.5,p[2],1.05,h,1.05);
    }
    receipts.push({
      id:b.id,kind:b.kind,deckLength:deck.len,
      fromSurfaceY:deck.heightAt(0,0),toSurfaceY:deck.heightAt(1,0),
      maxLengthwiseGrade:deck.worstGrade,
      registeredFootRaycast:true,serverCollisionVerified:false,
    });
  }
  return receipts;
}
function housingPlots(world){
  const stamps=[];
  for(const p of PLOTS){
    const y=wolfveilHeight(p.x,p.z);
    // Housing is reserved client scenery ONLY: no fake plots or ownership.
    world.box('basalt',p.x,y+.2,p.z,p.w+.8,.44,p.d+.8);
    for(const side of [-1,1])for(const end of [-1,1])
      world.box('granite',p.x+side*p.w*.5,y+.65,p.z+end*p.d*.5,.45,.9,.45);
    for(const side of [-1,1])world.box('cedar',p.x+side*p.w*.5,y+.68,p.z,.13,.66,p.d*.74);
    stamps.push(p.id);
  }
  return stamps;
}
function training(world){
  const {x,z}=SITE.training,y=heightAt(SITE.training);
  world.box('granite',x,y+.15,z,42,.24,35);
  for(let k=0;k<9;k++){
    world.box('cedar',x-16+k*4,y+.75,z+8,.35,1.40,.35);
  }
  for(const off of [-15,15]){
    world.box('cedar',x+off,y+1.6,z-15,.52,3.2,.52);
    world.box('lantern',x+off,y+2.65,z-15,.5,.7,.5);
  }
  return {x,z,w:42,d:35,mode:'safe_training_visual'};
}
function quarry(world){
  const {x,z}=SITE.quarry,y=heightAt(SITE.quarry);
  for(let i=0;i<25;i++){
    const rand=mulberry32(103+i),xx=x+(rand()-.5)*80,zz=z+(rand()-.5)*70;
    const h=wolfveilHeight(xx,zz),s=1+rand()*4;
    world.box('granite',xx,h+s*.32,zz,s*1.9,s*.65,s*1.6,rand()*twopi);
  }
  // Physical timber hoist crane and ruined watch posts for the concept angle.
  const X=x-17,Z=z-11,H=wolfveilHeight(X,Z);
  world.box('darkCedar',X,H+7.1,Z,.8,14.2,.75);
  world.box('cedar',X+5,H+14,Z,10,.65,.6);
  world.box('darkCedar',X+9,H+11,Z,.20,6,.20);
  return {id:'wolfveil_quarry_visual',hostileAiConnected:false};
}
function cavePortals(world){
  const portals=[
    {name:'waterfall',x:163,z:155,w:9,h:7},
    {name:'western_root',x:-324,z:140,w:8,h:6},
    {name:'discovery',x:-224,z:74,w:6,h:5},
  ];
  for(const site of portals){
    const y=wolfveilHeight(site.x,site.z);
    world.box('basalt',site.x-site.w*.5,y+site.h*.5,site.z,1.8,site.h,3);
    world.box('basalt',site.x+site.w*.5,y+site.h*.5,site.z,1.8,site.h,3);
    world.box('basalt',site.x,y+site.h-.35,site.z,site.w+2,1.4,3.7);
    world.box('ink',site.x,y+site.h*.48,site.z+.04,site.w-1.9,site.h-.5,.14);
    world.box('spirit',site.x,y+2.8,site.z+.18,.8,.7,.18);
  }
  return {count:portals.length,traversable:false,reason:'cave interiors and terrain cutouts not yet authored'};
}
export function buildWolfveilTown(world,terrainOptions={}){
  // All materials share the one connected world-coordinate system.
  // Home geometry lives in a separately disposable blockout. Only after the
  // GLB loads successfully does Game 3D remove this fallback group. Public
  // buildings, terrain and the hero's earth approach never get removed.
  // All old town architecture is intentionally REMOVED, including procedural
  // residence meshes and the alternative imported house GLB. Only the Luna
  // manor palace is re-added through WolfveilScene after this empty town.
  const residenceWorld=null;
  const buildings=BUILDINGS.map(b=>building(world,b));
  const plazas=terrainOptions.importedTownAtMarket
    ?{plazaRadius:0,stallCount:0}
    :market(world,{hideStalls:Boolean(terrainOptions.hideMarketStalls)});
  gates(world);
  const bridgesBuilt=bridges(world,terrainOptions);
  const housing=[]; // remove every unused house-plot foundation and fence
  const trainingInfo=training(world);
  const quarryInfo=quarry(world);
  const caveInfo=cavePortals(world);
  const roof=world.mesh(new THREE.Mesh(world.roofWriter.geometry(),material(0xffffff,.55,{
    vertexColors:true,side:THREE.DoubleSide})));
  roof.name='SWV_IndividualCurvedIndigoRoofTileGeometry';
  roof.receiveShadow=true;
  return {
    buildings,residenceWorld,plazas,bridges:bridgesBuilt,housingPlots:housing,
    training:trainingInfo,quarry:quarryInfo,caves:caveInfo,
    roofTriangles:world.roofWriter.tris,
  };
}
