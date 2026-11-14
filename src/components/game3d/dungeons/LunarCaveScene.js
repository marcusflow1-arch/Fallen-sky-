// An actual Three.js cave gate and a separate five-hall dungeon scene for
// Game 3D. The approved concept image guides composition; never substitute a
// flat screenshot billboard for world geometry. Game 1 remains unchanged.
import * as THREE from 'three';
import {addVortexDungeonEcho} from './VortexDungeonEcho.mjs';
import {
  LUNAR_CAVE_ENTRANCE,LUNAR_CAVE_CHAMBERS,LUNAR_CAVE_WATER_END,
  LUNAR_CAVE_ROOM_RADIUS,LUNAR_CAVE_PASSAGE_HALF_WIDTH,LUNAR_CAVE_PASSAGES,
  isInsideDungeonWalkway,
} from './LunarCaveLayout.mjs';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rgba=(r,g,b)=>new THREE.Color(r/255,g/255,b/255);
const stoneColors=[0x4b5667,0x596576,0x6c7480,0x485363,0x79838b];
const STONE_SEED=0x684821;
function random(n){const v=Math.sin((n+1)*14.318+STONE_SEED)*43758.5453123;return v-Math.floor(v);}
function stoneTexture(){
  // Seamless, varied stone pigment. Applied to actual rock geometry, not an
  // image of the entrance; allows the same surface to receive world lighting.
  const n=128,data=new Uint8Array(n*n*4);
  function noise(x,y,scale){
    const ax=Math.floor(x/scale),ay=Math.floor(y/scale);
    const hash=(a,b)=>random(((a*73856093)^(b*19349663))>>>0);
    const u=(x/scale-ax),v=(y/scale-ay),sx=u*u*(3-2*u),sy=v*v*(3-2*v);
    const a=hash(ax,ay)*(1-sx)+hash(ax+1,ay)*sx;
    const b=hash(ax,ay+1)*(1-sx)+hash(ax+1,ay+1)*sx;
    return a*(1-sy)+b*sy;
  }
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const fine=noise(x,y,4),mid=noise(x,y,17),large=noise(x,y,53);
    const mineral=(fine-.5)*29+(mid-.5)*48+(large-.5)*24;
    const i=(y*n+x)*4;
    data[i]=clamp(99+mineral,0,255);
    data[i+1]=clamp(106+mineral,0,255);
    data[i+2]=clamp(118+mineral,0,255);
    data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;
  t.minFilter=THREE.LinearMipmapLinearFilter;
  t.generateMipmaps=true;
  t.colorSpace=THREE.SRGBColorSpace;
  t.needsUpdate=true;
  return t;
}
function materialSet(){
  const tex=stoneTexture();
  const stones=stoneColors.map(color=>new THREE.MeshStandardMaterial({
    color,roughness:.94,metalness:.04,map:tex,flatShading:false,
  }));
  return {tex,stones,
    path:new THREE.MeshStandardMaterial({color:0x7c7880,roughness:.91,map:tex}),
    gold:new THREE.MeshStandardMaterial({color:0xd9a961,metalness:.72,roughness:.24}),
    violet:new THREE.MeshStandardMaterial({color:0x312157,roughness:.92,side:THREE.DoubleSide}),
    rune:new THREE.MeshBasicMaterial({color:0x27aeff,transparent:true,opacity:.94,depthWrite:false}),
  };
}
function rock(group,mats,x,y,z,sx,sy,sz,seed=1){
  const geo=new THREE.IcosahedronGeometry(1,2);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i);
    const f=.83+.31*random(seed*91+i*.371);
    pos.setXYZ(i,px*f,py*f,pz*f);
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mats.stones[Math.floor(random(seed)*mats.stones.length)]);
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
  mesh.rotation.set((random(seed+12)-.5)*.37,random(seed+8)*TAU,(random(seed+19)-.5)*.3);
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  return mesh;
}
function slab(group,mats,x,y,z,w,h,d,seed=0){
  return rock(group,mats,x,y,z,w*.65,h*.65,d*.7,seed+172);
}
function light(group,x,y,z,color,intensity,distance){
  const l=new THREE.PointLight(color,intensity,distance,2);
  l.position.set(x,y,z);group.add(l);return l;
}
function addTorch(group,mats,x,y,z){
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.75,1.1,1.2,8),mats.stones[1]);
  base.position.set(x,y+.6,z);base.receiveShadow=true;group.add(base);
  const bowl=new THREE.Mesh(new THREE.SphereGeometry(.66,10,7,0,TAU,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color:0x423b35,metalness:.7,roughness:.5,side:THREE.DoubleSide}));
  bowl.position.set(x,y+1.3,z);group.add(bowl);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.39,1.25,8),
    new THREE.MeshBasicMaterial({color:0xffa23d,transparent:true,opacity:.92,depthWrite:false}));
  flame.position.set(x,y+2.05,z);group.add(flame);
  const glow=light(group,x,y+2.15,z,0xff9449,1.7,13);
  return t=>{flame.scale.y=.84+.12*Math.sin(t*9+x);glow.intensity=1.5+.2*Math.sin(t*7+z);};
}
function addBanner(group,mats,x,y,z,stage=null){
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(2.25,5.1),mats.violet);
  cloth.position.set(x,y+3.9,z);group.add(cloth);
  const rim=new THREE.Mesh(new THREE.BoxGeometry(2.3,.12,.12),mats.gold);
  rim.position.set(x,y+6.45,z);group.add(rim);
  const glyphGroup=new THREE.Group();
  glyphGroup.position.set(x,y+4.25,z+.06);group.add(glyphGroup);
  for(let k=0;k<3;k++){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.1,1.65-k*.27,.05),mats.gold);
    blade.position.set((k-1)*.36,0,0);glyphGroup.add(blade);
  }
  if(stage!==null){
    // Genuine small-stage identification etched onto a fabric label.
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.22,.4*stage,.09),mats.gold);
    bar.position.set(x,y+2.65,z+.08);group.add(bar);
  }
}
function addRuneArch(group,mats,{z=0,radius=5.8,cy=4.7}={}){
  const axis=new THREE.Vector3(0,0,1);
  const lightMat=mats.rune;
  const arc=new THREE.Mesh(new THREE.TorusGeometry(radius,.055,6,90,Math.PI*1.06),lightMat);
  arc.rotation.z=-.03*Math.PI;arc.position.set(0,cy,z);group.add(arc);
  for(let i=0;i<15;i++){
    const a=Math.PI*(.07+.86*i/14);
    const r=radius+.32;
    const rune=new THREE.Mesh(new THREE.BoxGeometry(.15,.35,.08),lightMat);
    rune.position.set(r*Math.cos(a),cy+r*Math.sin(a),z+.1);
    rune.rotation.z=a-Math.PI/2;group.add(rune);
  }
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.85),new THREE.MeshBasicMaterial({color:0x57d6ff}));
  gem.position.set(0,cy+radius+.35,z+.45);group.add(gem);
  return gem;
}
const PORTAL_VERTEX=String.raw`
 varying vec2 vUv;
 void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const PORTAL_FRAGMENT=String.raw`
 uniform float uTime;
 varying vec2 vUv;
 void main(){
   vec2 p=(vUv-.5)*2.0;
   float r=length(p);
   if(r>1.0)discard;
   float a=atan(p.y,p.x);
   float spiral=sin(a*5.0-r*23.0-uTime*2.9);
   float swirl=sin(a*9.0+r*17.0+uTime*3.3);
   float bright=pow(max(0.0,spiral),3.0)*.45+pow(max(0.0,swirl),6.0)*.27;
   float rim=pow(smoothstep(.61,.99,r),4.0);
   float center=pow(1.0-smoothstep(0.0,.57,r),2.0);
   vec3 indigo=vec3(.046,.019,.27),blue=vec3(.06,.31,.92),
        cyan=vec3(.17,.83,1.0),violet=vec3(.52,.18,1.0);
   vec3 color=mix(indigo,blue,.46+.42*sin(spiral+uTime*.4));
   color=mix(color,cyan,clamp(bright+rim*.57,0.0,1.0));
   color+=violet*(.16+.34*pow(max(0.0,swirl),3.0));
   color+=cyan*(center*.53);
   float alpha=.78+.19*rim+.1*bright;
   gl_FragColor=vec4(color,clamp(alpha,0.0,.99));
 }
`;
function portal(group,mats,x,y,z,scale=1){
  const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);group.add(g);
  const mat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},vertexShader:PORTAL_VERTEX,fragmentShader:PORTAL_FRAGMENT,
    transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:true,
  });
  const disc=new THREE.Mesh(new THREE.PlaneGeometry(6.9,6.9),mat);
  disc.renderOrder=7;g.add(disc);
  const outer=new THREE.Mesh(new THREE.TorusGeometry(3.52,.12,8,80),
    new THREE.MeshBasicMaterial({color:0x28bfff,transparent:true,opacity:.88,depthWrite:false}));
  outer.position.z=.06;outer.renderOrder=8;g.add(outer);
  const violet=new THREE.Mesh(new THREE.TorusGeometry(3.12,.035,5,64),
    new THREE.MeshBasicMaterial({color:0x774aff,transparent:true,opacity:.8,depthWrite:false}));
  violet.position.z=.1;g.add(violet);
  const sparks=[];
  for(let i=0;i<19;i++){
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.025+(i%3)*.018,5,5),
      new THREE.MeshBasicMaterial({color:i%3===0?0xb4e8ff:0x7966ff}));
    dot.position.z=.15;g.add(dot);sparks.push(dot);
  }
  light(g,0,0,1,0x308cff,3.1,18);
  return t=>{
    mat.uniforms.uTime.value=t;outer.rotation.z=t*.12;violet.rotation.z=-t*.18;
    sparks.forEach((p,i)=>{
      const a=i*2.4+t*(.33+i%4*.11),r=.8+(i%5)*.59;
      p.position.set(Math.cos(a)*r,Math.sin(a)*r,.24);
    });
  };
}
function disposeRoot(root,tex){
  root.parent?.remove(root);
  const geos=new Set(),materials=new Set();
  root.traverse(o=>{if(o.isMesh){if(o.geometry)geos.add(o.geometry);
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)materials.add(m);
  }});
  geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  tex?.dispose();
}
// Faceted rock and original blue crystals form a small cave mouth, not
// a freestanding U-frame. All stone shoulders have gameplay footprints.
function entranceRockwork(root,mats){
  const colliders=[];
  const crystalMat=new THREE.MeshPhysicalMaterial({color:0x63b6d6,
    emissive:0x0e4d81,emissiveIntensity:.22,metalness:.14,roughness:.28,
    transparent:true,opacity:.91,flatShading:true});
  for(const side of [-1,1]){
    rock(root,mats,side*6.5,4.9,3.1,3.25,5.7,4.4,side+511);
    // Keep the right side visually part of the surrounding cave rock:
    // remove the tall protruding outer pillar and bell-like crystal cluster.
    if(side<0)rock(root,mats,side*9.8,5.9,6.2,4.4,7,6.1,side+541);
    else rock(root,mats,9.1,3.0,8.2,2.7,3.5,4.5,542);
    rock(root,mats,side*6.2,10.1,5.8,3.5,3.1,4.5,side+561);
    colliders.push({x:side*6.5,z:3.1,hx:2.65,hz:4.3});
    colliders.push(side<0
      ? {x:side*9.8,z:6.2,hx:4.1,hz:5.6}
      : {x:9.1,z:8.2,hx:2.4,hz:4});
    if(side<0)for(let i=0;i<4;i++){
      const crystal=new THREE.Mesh(new THREE.CylinderGeometry(
        .07,.52,2.2+(i%2)*1.05,6),crystalMat);
      crystal.position.set(side*(4.55+i*.43),3+i*1.54,1+i*.58);
      crystal.rotation.z=-side*(.28+i*.11);
      crystal.castShadow=true;crystal.receiveShadow=true;root.add(crystal);
    }
  }
  rock(root,mats,0,10.6,5.2,6.3,3.25,5,617);
  rock(root,mats,-3.8,10.3,2,3.3,2.4,3.5,619);
  rock(root,mats,4.2,10.5,3.1,3.2,2.6,3.4,621);
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(.08,.88,3.3,6),crystalMat);
  crown.position.set(0,10.2,1.25);crown.rotation.z=.12;root.add(crown);
  return colliders;
}
export function createLunarMountainEntrance(scene,{sampleGroundY}={}){
  const {x,z,portalZ,yaw=0}=LUNAR_CAVE_ENTRANCE;
  const baseY=Number.isFinite(sampleGroundY?.(x,z))?sampleGroundY(x,z):0;
  const cosYaw=Math.cos(yaw),sinYaw=Math.sin(yaw);
  const localToWorld=(lx,lz)=>({x:x+lx*cosYaw+lz*sinYaw,z:z-lx*sinYaw+lz*cosYaw});
  const worldToLocal=position=>{
    const dx=position.x-x,dz=position.z-z;
    return {x:dx*cosYaw-dz*sinYaw,z:dx*sinYaw+dz*cosYaw};
  };
  const mats=materialSet(),root=new THREE.Group();
  root.name='AXE_LunarMountainGate_3D';
  root.position.set(x,baseY,z);root.rotation.y=yaw;scene.add(root);
  const colliders=entranceRockwork(root,mats);
  for(let i=0;i<6;i++){
    slab(root,mats,-4.5,.15,i*3.2,3.3,.3,2,i+201);
    slab(root,mats,4.5,.15,i*3.2,3.3,.3,2,i+221);
  }
  const torches=[
    addTorch(root,mats,-7.2,.25,-1.5),
    addTorch(root,mats,7.2,.25,-1.5),
  ];
  const portalLocalZ=portalZ-z;
  const animatePortal=portal(root,mats,0,4.4,portalLocalZ,1.05);
  for(let i=0;i<17;i++){
    const zz=-20+i*1.65,px=(i%3-1)*.78,world=localToWorld(px,zz);
    const gy=sampleGroundY?.(world.x,world.z);
    slab(root,mats,px,Number.isFinite(gy)?gy-baseY+.12:.12,zz,1.52,.16,1.55,i+401);
  }
  const portalWorldXZ=localToWorld(0,portalLocalZ);
  let time=0,last=null,triggered=false;
  return {
    root,portalWorld:{...portalWorldXZ,y:baseY+4.4},
    resolveCollision(position,previous,radius=.62){
      if(!position||!previous)return false;
      const local=worldToLocal(position);
      for(const c of colliders){
        const px=clamp(local.x,c.x-c.hx,c.x+c.hx);
        const pz=clamp(local.z,c.z-c.hz,c.z+c.hz);
        if(Math.hypot(local.x-px,local.z-pz)<radius){
          position.x=previous.x;position.z=previous.z;
          return true;
        }
      }
      return false;
    },
    update(dt,position){
      time+=Math.min(.09,Math.max(0,dt||0));
      animatePortal(time);torches.forEach(fn=>fn(time));
      if(!position){last=null;return false;}
      const now=worldToLocal(position);
      const crossed=last&&last.z<portalLocalZ&&now.z>=portalLocalZ;
      const inMouth=Math.abs(now.x)<3.25&&Math.abs(now.z-portalLocalZ)<2.7;
      last=now;
      if(!triggered&&crossed&&inMouth){triggered=true;return true;}
      return false;
    },
    dispose(){disposeRoot(root,mats.tex);},
  };
}
// One closed rock envelope around the union of chambers, corridors and grotto.
// Instancing keeps the complete walls/ceiling affordable and prevents seeing
// out of the cave through gaps between decorative boulders.
function insideCaveShell(x,z,extra=2.5){
  if(LUNAR_CAVE_CHAMBERS.some(c=>Math.hypot(x-c.x,z-c.z)<=LUNAR_CAVE_ROOM_RADIUS+extra))return true;
  if(Math.hypot(x-LUNAR_CAVE_WATER_END.x,z-LUNAR_CAVE_WATER_END.z)<=LUNAR_CAVE_ROOM_RADIUS+extra)return true;
  return LUNAR_CAVE_PASSAGES.some(({ax,az,bx,bz})=>{
    const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz;
    const t=clamp(((x-ax)*dx+(z-az)*dz)/len,0,1);
    return Math.hypot(x-(ax+t*dx),z-(az+t*dz))<=LUNAR_CAVE_PASSAGE_HALF_WIDTH+extra;
  });
}
function addClosedCavernShell(root,mats){
  const cell=4,minX=-88,maxX=88,minZ=-36,maxZ=676;
  const occupied=new Set(),locations=[];
  const key=(ix,iz)=>ix+','+iz;
  const countX=Math.ceil((maxX-minX)/cell),countZ=Math.ceil((maxZ-minZ)/cell);
  for(let ix=0;ix<countX;ix++)for(let iz=0;iz<countZ;iz++){
    const x=minX+(ix+.5)*cell,z=minZ+(iz+.5)*cell;
    if(insideCaveShell(x,z)){occupied.add(key(ix,iz));locations.push({ix,iz,x,z});}
  }
  const edges=[];
  for(const p of locations)for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
    if(!occupied.has(key(p.ix+dx,p.iz+dz)))edges.push({...p,dx,dz});
  }
  const roof=new THREE.InstancedMesh(
    new THREE.BoxGeometry(cell+.24,3.2,cell+.24),mats.stones[1],locations.length);
  const walls=new THREE.InstancedMesh(
    new THREE.BoxGeometry(cell+.2,17.6,3.4),mats.stones[0],edges.length);
  roof.name='AXE_LunarCave_SealedStoneCeiling';
  walls.name='AXE_LunarCave_SealedPerimeterWalls';
  roof.castShadow=roof.receiveShadow=true;
  walls.castShadow=walls.receiveShadow=true;
  const dummy=new THREE.Object3D();
  locations.forEach((p,i)=>{
    dummy.position.set(p.x,16.2,p.z);dummy.rotation.set(0,0,0);
    dummy.updateMatrix();roof.setMatrixAt(i,dummy.matrix);
  });
  edges.forEach((e,i)=>{
    dummy.position.set(e.x+e.dx*cell/2,7.2,e.z+e.dz*cell/2);
    dummy.rotation.set(0,e.dx!==0?Math.PI/2:0,0);
    dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);
  });
  roof.instanceMatrix.needsUpdate=walls.instanceMatrix.needsUpdate=true;
  root.add(roof,walls);
}
// Visible lamps physically fastened to the dungeon stone. Their emissive
// lenses stay legible at distance; a subset carries local real illumination.
// Placement uses wall-facing normals from the SAME route as cave collision.
function createDungeonFixtureKit(){
  return {
    plate:new THREE.BoxGeometry(1.45,2.05,.28),
    hood:new THREE.BoxGeometry(1.3,.24,.72),
    lens:new THREE.BoxGeometry(.68,1.28,.22),
    ceiling:new THREE.CylinderGeometry(.95,.95,.22,12),
    ceilingLens:new THREE.SphereGeometry(.67,10,8),
    mount:new THREE.MeshStandardMaterial({color:0x333947,roughness:.72,metalness:.5}),
    glass:new THREE.MeshStandardMaterial({color:0xffd39a,emissive:0xffb45f,
      emissiveIntensity:4.2,roughness:.28,metalness:.12}),
    moonGlass:new THREE.MeshStandardMaterial({color:0xb5ddf2,emissive:0x7bb9ed,
      emissiveIntensity:3.6,roughness:.3}),
  };
}
function addDungeonWallSconce(root,kit,x,z,nx,nz,{illuminated=true}={}){
  const g=new THREE.Group();
  g.name='AXE_LunarCave_WallSconce';
  g.position.set(x,7.1,z);
  // Fixture +Z faces *into* the hall, away from the enclosing rock wall.
  g.rotation.y=Math.atan2(-nx,-nz);
  const plate=new THREE.Mesh(kit.plate,kit.mount);
  const hood=new THREE.Mesh(kit.hood,kit.mount);
  hood.position.set(0,.82,.45);
  const lens=new THREE.Mesh(kit.lens,kit.glass);
  lens.position.z=.52;
  g.add(plate,hood,lens);
  if(illuminated){
    const bulb=new THREE.PointLight(0xffc58b,90,58,1.4);
    bulb.position.set(0,.1,1.6);
    g.add(bulb);
  }
  root.add(g);
}
function addDungeonCeilingLamp(root,kit,x,z,{illuminated=true}={}){
  const g=new THREE.Group();
  g.name='AXE_LunarCave_CeilingLamp';
  g.position.set(x,14.13,z);
  const casing=new THREE.Mesh(kit.ceiling,kit.mount);g.add(casing);
  const lens=new THREE.Mesh(kit.ceilingLens,kit.moonGlass);
  lens.scale.y=.35;lens.position.y=-.35;g.add(lens);
  if(illuminated){
    const bulb=new THREE.PointLight(0xb6dfff,75,58,1.4);
    bulb.position.y=-1.3;g.add(bulb);
  }
  root.add(g);
}
export function createLunarCaveDungeon(scene){
  const mats=materialSet(),root=new THREE.Group();
  root.name='AXE_LunarCaveSeparateDungeonScene';scene.add(root);
  const vortexMemory=addVortexDungeonEcho(root);
  // Dungeon-only albedo lift: illuminated stone retains colour and readable
  // detail. Entrance/world stone materials are created separately unchanged.
  mats.stones.forEach(stone=>stone.color.multiplyScalar(1.34));
  const floorMat=new THREE.MeshStandardMaterial({
    color:0xadb3c0,map:mats.tex,roughness:.91,side:THREE.DoubleSide,
  });
  // Full stone foundation: no missing floor beneath any chamber, hallway or
  // bend; movement is still restricted to the separately defined walkway.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,760,12,38),floorMat);
  ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,320);
  ground.receiveShadow=true;ground.userData.isTerrain=true;
  ground.name='AXE_LunarCave_CollidableFloor';root.add(ground);
  addClosedCavernShell(root,mats);
  // Strong, soft dungeon-only fill exposes monster silhouettes, equipment and
  // painted stone across dark corners. Wall and ceiling fixtures remain the
  // dominant directional accents, not the outdoor sky or sun.
  root.add(new THREE.HemisphereLight(0xd9e5f2,0x88929e,2.6));
  root.add(new THREE.AmbientLight(0xd2e0ed,1.1));
  const flames=[],chamberLights=[];
  const fixtureKit=createDungeonFixtureKit();
  let id=430;
  // Sconces run along BOTH sides of every corridor, including bends and
  // elbows. Each fixture remains visible; periodic bulbs bound dynamic GPU lights while all sconces glow.
  for(const p of LUNAR_CAVE_PASSAGES){
    const dx=p.bx-p.ax,dz=p.bz-p.az;
    const length=Math.hypot(dx,dz);
    if(length<8)continue;
    const nx=dz/length,nz=-dx/length;
    const count=Math.max(1,Math.ceil(length/20));
    for(let i=0;i<count;i++){
      const t=(i+.5)/count;
      const x=p.ax+dx*t,z=p.az+dz*t;
      for(const side of [-1,1]){
        addDungeonWallSconce(root,fixtureKit,
          x+side*nx*(LUNAR_CAVE_PASSAGE_HALF_WIDTH+2),
          z+side*nz*(LUNAR_CAVE_PASSAGE_HALF_WIDTH+2),
          side*nx,side*nz,{illuminated:i%3===0 && side===(i%2===0?-1:1)});
      }
      // Ceiling markers are attached to the stone roof, not floating over
      // the path. Use cooler moonlight between warm wall sconces.
      if(i%3===1)addDungeonCeilingLamp(root,fixtureKit,x,z);
    }
  }
  for(const c of LUNAR_CAVE_CHAMBERS){
    for(let j=0;j<20;j++){
      const a=TAU*j/20;
      if(Math.abs(Math.cos(a))<.26)continue; // preserve north/south access
      const radius=43.5+random(c.index*53+j)*1.4;
      rock(root,mats,c.x+Math.cos(a)*radius,
        5+random(j+c.index)*2,c.z+Math.sin(a)*radius,
        3,5.7,3.4,c.index*300+j);
    }
    // Eight fixtures spaced around each round arena's stone perimeter;
    // brighter centre/rim lamps reveal monsters at all approach angles.
    for(let j=0;j<8;j++){
      const a=TAU*(j+.5)/8;
      const nx=Math.cos(a),nz=Math.sin(a);
      addDungeonWallSconce(root,fixtureKit,
        c.x+nx*(LUNAR_CAVE_ROOM_RADIUS+2),
        c.z+nz*(LUNAR_CAVE_ROOM_RADIUS+2),nx,nz,{illuminated:j%4===0});
    }
    addDungeonCeilingLamp(root,fixtureKit,c.x-15,c.z);
    addDungeonCeilingLamp(root,fixtureKit,c.x+15,c.z,{illuminated:false});
    for(const side of [-1,1]){
      flames.push(addTorch(root,mats,c.x+side*30,0,c.z));
      addBanner(root,mats,c.x+side*33,3,c.z+3,c.index);
      chamberLights.push(light(root,c.x+side*18,9,c.z+8,0xc9dbec,35,56));
    }
    const accent=c.index===5?0xb09ad3:0x9aaecb;
    chamberLights.push(light(root,c.x,11,c.z,accent,55,73));
    const luminous=new THREE.Mesh(new THREE.TorusGeometry(6.2,.14,8,48),
      new THREE.MeshBasicMaterial({color:c.index===5?0x9574ff:0x4e9ae8,
        transparent:true,opacity:.20,depthWrite:false}));
    luminous.rotation.x=-Math.PI/2;luminous.position.set(c.x,.015,c.z);root.add(luminous);
  }
  // Quiet lake grotto after the fifth combat hall.
  const water=new THREE.Mesh(new THREE.PlaneGeometry(67,55,16,16),
    new THREE.MeshPhysicalMaterial({color:0x164d8c,metalness:.3,roughness:.17,
      transparent:true,opacity:.8,clearcoat:1,clearcoatRoughness:.09,side:THREE.DoubleSide}));
  water.rotation.x=-Math.PI/2;
  water.position.set(LUNAR_CAVE_WATER_END.x,.06,LUNAR_CAVE_WATER_END.z+3);
  root.add(water);
  for(let z=590;z<=652;z+=6)
    slab(root,mats,LUNAR_CAVE_WATER_END.x,.16,z,3,.22,3,id++);
  flames.push(
    addTorch(root,mats,LUNAR_CAVE_WATER_END.x-7,.1,641),
    addTorch(root,mats,LUNAR_CAVE_WATER_END.x+7,.1,641));
  chamberLights.push(light(root,LUNAR_CAVE_WATER_END.x,10,625,0xacccec,45,68));
  // Grotto and both return gates share the same readable wall/ceiling system.
  for(const z of [587,610,634,654]){
    for(const side of [-1,1])addDungeonWallSconce(root,fixtureKit,
      LUNAR_CAVE_WATER_END.x+side*(LUNAR_CAVE_ROOM_RADIUS+1.8),z,side,0,
      {illuminated:z===610||z===654});
  }
  addDungeonCeilingLamp(root,fixtureKit,LUNAR_CAVE_WATER_END.x,630);
  // Both travel triggers and their existing animated portal visuals remain.
  const startPortal=portal(root,mats,0,4,-21,.85);
  const finalPortal=portal(root,mats,LUNAR_CAVE_WATER_END.x,4,LUNAR_CAVE_WATER_END.returnPortalZ,.9);
  let time=0,last=null,triggered=false;
  return {
    root,ground,entry:{x:0,y:0,z:0},chambers:LUNAR_CAVE_CHAMBERS,
    isWalkable:isInsideDungeonWalkway,
    resolveCollision(position,previous,radius=.62){
      if(isInsideDungeonWalkway(position.x,position.z,radius))return false;
      if(previous){position.x=previous.x;position.z=previous.z;return true;}
      return false;
    },
    update(dt,position){
      time+=Math.min(.09,Math.max(0,dt||0));
      flames.forEach(fn=>fn(time));startPortal(time);finalPortal(time);
      vortexMemory.update(dt);
      water.material.opacity=.75+.05*Math.sin(time*1.7);
      if(!position){last=null;return false;}
      const now={x:position.x,z:position.z};
      const nearStart=Math.abs(now.x)<2.6&&Math.abs(now.z+21)<2.2;
      const nearEnd=Math.abs(now.x-LUNAR_CAVE_WATER_END.x)<2.6&&
        Math.abs(now.z-LUNAR_CAVE_WATER_END.returnPortalZ)<2.2;
      const nearExit=nearStart||nearEnd;
      const wasNear=last&&(
        (Math.abs(last.x)<2.6&&Math.abs(last.z+21)<2.2)||
        (Math.abs(last.x-LUNAR_CAVE_WATER_END.x)<2.6&&
         Math.abs(last.z-LUNAR_CAVE_WATER_END.returnPortalZ)<2.2));
      last=now;
      if(!triggered&&nearExit&&!wasNear){triggered=true;return true;}
      return false;
    },
    dispose(){disposeRoot(root,mats.tex);},
  };
}
