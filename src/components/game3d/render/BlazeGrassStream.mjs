import * as THREE from 'three';
import {BLAZE_GRASS_VERTEX,BLAZE_GRASS_FRAGMENT,
  BLAZE_EMBER_VERTEX,BLAZE_EMBER_FRAGMENT} from './BlazeGrassShaders.mjs';
import {BLAZE_TILE_METERS,blazeTileCoords,blazeTileKey,blazeTileSeed,
  blazeRandom,blazeStreamQuality,blazeBiomePalette,classifyBlazeBiome,
} from './BlazeBiomeLandscaping.mjs';

// Stream the original Sanctuary look everywhere the player walks on plantable
// terrain. No new floor, trees, colliders, rigid hitboxes or per-frame CPU
// reallocation. All tile geometry remains visual-only.
function bladeGeometry(){
  const vertices=[],uv=[],normals=[],ids=[],segments=16;
  for(let i=0;i<=segments;i++){
    const h=i/segments;
    const y=1.41*h; // Clone-only 3x knee-height: 1.16–1.61m energy-grass body
    const z=h*h*.057;
    vertices.push(-.094,y,z,.094,y,z);
    uv.push(0,h,1,h);
    normals.push(0,.24,.97,0,.24,.97);
    if(i<segments){const o=i*2;ids.push(o,o+1,o+2,o+1,o+3,o+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setIndex(ids);g.computeBoundingSphere();
  return g;
}
function emberGeometry(){
  return new THREE.PlaneGeometry(.060,.12,1,4);
}
const MAX_SLOPE=.85;
const LATTICE=9;
export function createBlazeGrassStreamer({
  scene,shared,sampleGroundY,canPlantAt,biomeAt,worldRegion='wolfveil',
}={}){
  if(!scene||!shared)throw Error('Blaze ground cover requires the live scene and uniforms');
  const root=new THREE.Group();
  root.name='BlazeStreamedBiomeLandscaping';
  root.userData.blazeProcedural=true;
  const grassGeometry=bladeGeometry(),sparkGeometry=emberGeometry();
  const grassMaterial=new THREE.ShaderMaterial({
    name:'CloneWorldThreefoldLivingEnergyGrass',uniforms:shared,
    vertexShader:BLAZE_GRASS_VERTEX,fragmentShader:BLAZE_GRASS_FRAGMENT,
    side:THREE.DoubleSide,depthWrite:true,transparent:false,
  });
  const sparkMaterial=new THREE.ShaderMaterial({
    name:'BlazeWorldRisingInkDroplets',uniforms:shared,
    vertexShader:BLAZE_EMBER_VERTEX,fragmentShader:BLAZE_EMBER_FRAGMENT,
    side:THREE.DoubleSide,depthWrite:true,transparent:false,
  });
  const tiles=new Map();
  const outdoor=worldRegion==='wolfveil'||
    /desert|dune|arid|forest|meadow|savanna|plain|grassland/i.test(worldRegion);
  let quality='high',active=false,focusKey='',built=0,removed=0;
  const heightAt=typeof sampleGroundY==='function'?sampleGroundY:()=>null;
  const allowedAt=typeof canPlantAt==='function'?canPlantAt:()=>true;
  const biomeAtPoint=typeof biomeAt==='function'?biomeAt:(point)=>classifyBlazeBiome({
    region:point?.region||worldRegion,
  });
  function sampleCells(ix,iz){
    const tile=BLAZE_TILE_METERS,ys=new Float32Array(LATTICE*LATTICE);
    const can=new Uint8Array(LATTICE*LATTICE);
    const minX=ix*tile,minZ=iz*tile;
    for(let z=0;z<LATTICE;z++)for(let x=0;x<LATTICE;x++){
      const wx=minX+tile*x/(LATTICE-1),wz=minZ+tile*z/(LATTICE-1);
      const i=z*LATTICE+x;
      const y=heightAt(wx,wz);
      ys[i]=Number.isFinite(y)?y:0;
      can[i]=Number.isFinite(y)&&allowedAt({x:wx,z:wz,y})!==false?1:0;
    }
    return (lx,lz)=>{
      const gx=THREE.MathUtils.clamp(lx/tile*(LATTICE-1),0,LATTICE-1-1e-5);
      const gz=THREE.MathUtils.clamp(lz/tile*(LATTICE-1),0,LATTICE-1-1e-5);
      const x=Math.floor(gx),z=Math.floor(gz),fx=gx-x,fz=gz-z;
      const i=z*LATTICE+x;
      const c=[i,i+1,i+LATTICE,i+LATTICE+1];
      if(c.some(k=>!can[k]))return null;
      const heights=c.map(k=>ys[k]);
      if(Math.max(...heights)-Math.min(...heights)>MAX_SLOPE)return null;
      const y=THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(ys[i],ys[i+1],fx),
        THREE.MathUtils.lerp(ys[i+LATTICE],ys[i+LATTICE+1],fx),fz);
      return y;
    };
  }
  function release(key){
    const tile=tiles.get(key);if(!tile)return;
    root.remove(tile.group);
    tile.grass?.geometry.dispose();
    tile.embers?.geometry.dispose();
    tiles.delete(key);removed++;
  }
  function makeTile(ix,iz,focus){
    const key=blazeTileKey(ix,iz),tileSize=BLAZE_TILE_METERS;
    const x=(ix+.5)*tileSize,z=(iz+.5)*tileSize;
    const biome=biomeAtPoint({x,z,region:worldRegion})||'meadow';
    const {index,density}=blazeBiomePalette(biome);
    if(!density){tiles.set(key,{empty:true,biome,planted:0,emitted:0});return;}
    const cfg=blazeStreamQuality(quality);
    const near=Math.max(Math.abs(ix-focus.ix),Math.abs(iz-focus.iz))<=1;
    const capacity=Math.max(0,Math.round((near?cfg.near:cfg.far)*density));
    if(capacity===0){tiles.set(key,{empty:true,biome,planted:0,emitted:0});return;}
    const ground=sampleCells(ix,iz),rng=blazeRandom(blazeTileSeed(ix,iz));
    const geom=grassGeometry.clone();
    const phases=new Float32Array(capacity),scales=new Float32Array(capacity);
    const biomes=new Float32Array(capacity);
    const mesh=new THREE.InstancedMesh(geom,grassMaterial,capacity);
    mesh.name='BlazeSanctuaryGrass_'+key;
    mesh.userData.blazeProcedural=true;
    mesh.castShadow=false;mesh.receiveShadow=false;
    mesh.frustumCulled=true;mesh.raycast=()=>{};
    const dummy=new THREE.Object3D();
    // Jittered close-packed lattice ensures uniform cover, avoiding random
    // bare spots and 52k consecutive rejection attempts on town boundaries.
    const n=Math.ceil(Math.sqrt(capacity)),step=tileSize/n;
    let planted=0;
    for(let j=0;j<n&&planted<capacity;j++)for(let i=0;i<n&&planted<capacity;i++){
      const lx=(i+.15+rng()*.70)*step;
      const lz=(j+.15+rng()*.70)*step;
      const y=ground(lx,lz);
      if(y===null)continue; // paths, buildings, rivers, steep/sloped ground
      const macro=(rng()<.012);
      dummy.position.set(ix*tileSize+lx,y,iz*tileSize+lz);
      dummy.rotation.set(0,rng()*Math.PI*2,0);
      // Clone-only threefold flame-grass length: 1.41m body, ~1.16–1.61m actual.
      const sy=macro?1.08+rng()*.06:.82+rng()*.30;
      const sx=.68+rng()*.52;
      dummy.scale.set(sx,sy,sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(planted,dummy.matrix);
      phases[planted]=rng();scales[planted]=sy;biomes[planted]=index;
      planted++;
    }
    mesh.count=planted;
    geom.setAttribute('aPhase',new THREE.InstancedBufferAttribute(phases,1));
    geom.setAttribute('aScale',new THREE.InstancedBufferAttribute(scales,1));
    geom.setAttribute('aBiomeIndex',new THREE.InstancedBufferAttribute(biomes,1));
    mesh.instanceMatrix.needsUpdate=true;
    if(planted>0)mesh.computeBoundingSphere?.();
    const group=new THREE.Group();group.userData.blazeProcedural=true;group.add(mesh);
    const emberCount=Math.min(cfg.embers,Math.floor(planted/12));
    let embers=null,emitted=0;
    if(emberCount>0){
      const eg=sparkGeometry.clone();
      const seeds=new Float32Array(emberCount*3),life=new Float32Array(emberCount),
        emberBiomes=new Float32Array(emberCount);
      embers=new THREE.InstancedMesh(eg,sparkMaterial,emberCount);
      embers.name='BlazeSumiRisingEmbers_'+key;
      embers.userData.blazeProcedural=true;
      embers.frustumCulled=false;embers.castShadow=false;
      embers.raycast=()=>{};
      const ident=new THREE.Object3D();ident.updateMatrix();
      let tries=0;
      while(emitted<emberCount&&tries++<emberCount*7){
        const lx=rng()*tileSize,lz=rng()*tileSize;
        const y=ground(lx,lz);if(y===null)continue;
        const k=emitted*3;
        seeds[k]=ix*tileSize+lx;seeds[k+1]=y;seeds[k+2]=iz*tileSize+lz;
        life[emitted]=rng();emberBiomes[emitted]=index;
        embers.setMatrixAt(emitted,ident.matrix);
        emitted++;
      }
      eg.setAttribute('aSpawn',new THREE.InstancedBufferAttribute(seeds,3));
      eg.setAttribute('aPhase',new THREE.InstancedBufferAttribute(life,1));
      eg.setAttribute('aBiomeIndex',new THREE.InstancedBufferAttribute(emberBiomes,1));
      embers.count=emitted;embers.instanceMatrix.needsUpdate=true;
      group.add(embers);
    }
    root.add(group);
    tiles.set(key,{group,grass:mesh,embers,biome,planted,emitted});
    built++;
  }
  function resetTiles(){
    for(const key of [...tiles.keys()])release(key);
    focusKey='';
  }
  function setEnabled(next){
    if(!!next===active)return;
    active=!!next;
    if(active)scene.add(root);
    else{resetTiles();scene.remove(root);}
  }
  function setQuality(value){
    const q=['low','medium','high','ultra'].includes(value)?value:'high';
    if(q===quality)return;
    quality=q;
    if(active)resetTiles();
  }
  function update(position){
    if(!active||!outdoor||!position||
       ![position.x,position.z].every(Number.isFinite))return;
    const focus=blazeTileCoords(position.x,position.z);
    const cfg=blazeStreamQuality(quality);
    const key=blazeTileKey(focus.ix,focus.iz)+'/'+quality;
    if(key!==focusKey){
      focusKey=key;
      for(const name of [...tiles.keys()]){
        const [ix,iz]=name.split(':').map(Number);
        if(Math.max(Math.abs(ix-focus.ix),Math.abs(iz-focus.iz))>cfg.radius)
          release(name);
      }
    }
    const missing=[];
    for(let dz=-cfg.radius;dz<=cfg.radius;dz++)
      for(let dx=-cfg.radius;dx<=cfg.radius;dx++){
        const ix=focus.ix+dx,iz=focus.iz+dz,key=blazeTileKey(ix,iz);
        if(!tiles.has(key))missing.push({ix,iz,d2:dx*dx+dz*dz});
      }
    // One deterministic 16m tile allocation per game frame. This prevents
    // both stutter from creating 52k blades and a sudden all-white bloom.
    missing.sort((a,b)=>a.d2-b.d2||a.iz-b.iz||a.ix-b.ix);
    if(missing.length)makeTile(missing[0].ix,missing[0].iz,focus);
  }
  return {
    setEnabled,setQuality,update,
    stats:()=>{
      let blades=0,embers=0,biomes={};
      for(const entry of tiles.values()){
        blades+=entry.planted||0;embers+=entry.emitted||0;
        if(entry.biome)biomes[entry.biome]=(biomes[entry.biome]||0)+(entry.planted||0);
      }
      return {tiles:tiles.size,blades,embers,biomes,built,removed,
        tileMeters:BLAZE_TILE_METERS,quality};
    },
    dispose(){
      setEnabled(false);
      grassGeometry.dispose();sparkGeometry.dispose();
      grassMaterial.dispose();sparkMaterial.dispose();
    },
  };
}
