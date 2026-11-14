// GPU-instanced wind/footstep grass on a seamlessly streamed, physically
// grounded four-mile-radius Wolfveil meadow. The existing town and BVH terrain
// remain untouched; server movement authority is NOT enlarged by this module.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { clearOf } from './WolfveilForestLayout.js';
import {isVortexLakeWetSurface} from './VortexLakeLayout.mjs';
import { buildWolfveilGrassClumpGeometry } from './WolfveilGroundCover.js';
import {wolfveilGrassCurrent} from './WolfveilFlowPlanting.mjs';
import { VOLCANO_TEXTURES } from '../volcanoMapAssets';
import {WOLFVEIL_WEST_LANDSCAPE_TEXTURES} from './WolfveilWestHillsideGround.js';
import {wolfveilRockSideBlend,wolfveilWestRockGrassAllowed} from './WolfveilWestRockGrassPockets.mjs';
import {
  WOLFVEIL_MEADOW_FIELD as FIELD, clampMeadow, isInsideMeadowCircle,
  insideOriginalWolfveilGround, meadowGroundHeight,
  shouldStreamMeadowTerrainTile, meadowGrassTileDensity,
  meadowTileSeed, meadowRandom,
} from './WolfveilMeadowField.mjs';

const MAX_CONTACTS = 8;
const TILE_KEY = (ix, iz) => ix + ':' + iz;
const WIND_DIRECTIONS = {N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
const GRASS_COLORS = [0x476a36,0x597945,0x718d48,0x476d4c,0x929754,0x3e663f]
  .map(hex => new THREE.Color(hex));
const COLOR_GROUND = [
  new THREE.Color(0x809c65),new THREE.Color(0x718f52),
  new THREE.Color(0x64865a),new THREE.Color(0x7d8352),
];

function createTerrainTile(ix, iz, near, material) {
  const tile = FIELD.terrainTileMeters;
  const segments = near ? FIELD.terrainSegments : FIELD.farTerrainSegments;
  const centerX = (ix + .5) * tile;
  const centerZ = (iz + .5) * tile;
  const geometry = new THREE.PlaneGeometry(tile, tile, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = new Float32Array(positions.count * 3);
  const tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    let x = centerX + positions.getX(i);
    let z = centerZ + positions.getZ(i);
    // Two metre underlap hides edge mismatches from the old 310-segment BVH
    // ground (old/extension boundary vertex spacing is not identical).
    const borderX = Math.abs(Math.abs(x) - FIELD.coreHalfSpan) < 0.002;
    const borderZ = Math.abs(Math.abs(z) - FIELD.coreHalfSpan) < 0.002;
    const adjacentCoreX = ix === 2 || ix === -3;
    const adjacentCoreZ = iz === 2 || iz === -3;
    const underlap = (borderX && adjacentCoreX) || (borderZ && adjacentCoreZ);
    if (borderX && adjacentCoreX) x -= Math.sign(x) * 1.8;
    if (borderZ && adjacentCoreZ) z -= Math.sign(z) * 1.8;
    const y = meadowGroundHeight(x,z) - (underlap ? .45 : 0);
    positions.setXYZ(i, x - centerX, y, z - centerZ);
    uv.setXY(i, x / 6.5, z / 6.5);
    const variance = .5 + .5 * Math.sin(x * .041 + Math.cos(z * .032));
    const wet = .5 + .5 * Math.cos(x * .007 - z * .013);
    tint.copy(COLOR_GROUND[Math.min(3,Math.floor((variance*.73+wet*.27)*3.99))])
      .multiplyScalar(.88 + .24 * variance);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  positions.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  if (near) {
    // Only player-local ground is raycastable. Farfield LOD is drawn but never
    // treated as a navigable physics floor until it enters the near ring.
    geometry.boundsTree = new MeshBVH(geometry,{maxLeafTris:16});
  }
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = 'WV_Meadow_SolidGround_' + (near?'near_':'horizon_') + TILE_KEY(ix,iz);
  mesh.position.set(centerX,0,centerZ);
  mesh.userData = {isTerrain:near,solidGround:near,meadow:true,visualOnly:!near};
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  if (near) mesh.raycast = acceleratedRaycast;
  else mesh.raycast = () => {};
  mesh.updateMatrix();
  return mesh;
}

function createGrassMaterial(windTime, wind, gust, contacts) {
  const material = new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:.94,side:THREE.DoubleSide,
    metalness:0,transparent:false,depthWrite:true,
  });
  material.name = 'WV_ExistingSevenBladeGrass_WindAndFootstepContact';
  material.customProgramCacheKey = () => 'wolfveil-meadow-root-anchored-grass-v3-relaxation';
  material.onBeforeCompile = shader => {
    shader.uniforms.uMeadowTime = windTime;
    shader.uniforms.uMeadowWind = wind;
    shader.uniforms.uMeadowGust = gust;
    shader.uniforms.uMeadowContacts = contacts;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',`#include <common>
uniform float uMeadowTime, uMeadowGust;
uniform vec2 uMeadowWind;
uniform vec4 uMeadowContacts[8];`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
// Bend the existing curved blade tips, never uproot their bases.
#ifdef USE_INSTANCING
vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
#else
vec3 grassRoot = (modelMatrix * vec4(0.,0.,0.,1.)).xyz;
#endif
float flex = smoothstep(0.04,0.78,position.y);
float sway = .5*sin(uMeadowTime*2.2 + grassRoot.x*.18 + grassRoot.z*.12)
           + .5*sin(uMeadowTime*1.43 + grassRoot.z*.31 - grassRoot.x*.07);
transformed.xz += normalize(uMeadowWind+vec2(.0001)) *
  (sway * (.07 + .21*uMeadowGust) * flex);
for (int j=0;j<8;j++){
  vec4 contact = uMeadowContacts[j];
  vec2 away = grassRoot.xz-contact.xy;
  float radius = max(.001,contact.z);
  float press = (1.0-smoothstep(.0,radius,length(away))) * contact.w;
  transformed.xz += normalize(away+vec2(.001)) * press * flex * .42;
  transformed.y -= press * flex * .26;
}`);
  };
  return material;
}

function createGrassTile(ix, iz, count, geometry, material, ownerTile=false) {
  const size = FIELD.grassTileMeters;
  const rng = meadowRandom(meadowTileSeed(ix, iz));
  const specs = [],ownerTileCells=new Set();
  const minX = ix * size, minZ = iz * size;
  // Bounded attempts: reject roads, houses, river, town center and outside
  // circle, rather than hiding traversal under thousands of grass meshes.
  for (let attempt = 0; attempt < count * 2.5 && specs.length < count; attempt++) {
    const x = minX + rng() * size, z = minZ + rng() * size;
    if (!isInsideMeadowCircle(x,z) || !wolfveilWestRockGrassAllowed(x,z)) continue;
    if(isVortexLakeWetSurface(x,z,.75))continue; // no clumps through new water
    if (Math.abs(x - FIELD.centerX) < 105 && Math.abs(z - FIELD.centerZ) < 105) continue;
    if (insideOriginalWolfveilGround(x,z) && !clearOf({x,z},.28)) continue;
    if(ownerTile && !clearOf({x,z},1.18))continue; // tile footprint, not just a tiny blade
    const y = meadowGroundHeight(x,z);
    if (!Number.isFinite(y)) continue;
    if(ownerTile){
      // 2m blades must not intersect each other or float across a cliff.
      const key=Math.floor(x/2.35)+':'+Math.floor(z/2.35);
      if(ownerTileCells.has(key))continue;
      const heights=[meadowGroundHeight(x+1,z),meadowGroundHeight(x-1,z),
        meadowGroundHeight(x,z+1),meadowGroundHeight(x,z-1)];
      if(heights.some(h=>!Number.isFinite(h))||
        Math.max(y,...heights)-Math.min(y,...heights)>.85)continue;
      ownerTileCells.add(key);
    }
    const westRock=wolfveilRockSideBlend(x,z);
    specs.push({x,z,y,rotation:wolfveilGrassCurrent(x,z)+(rng()-.5)*.42,
      scale:ownerTile?(.76+rng()*.18)*(1-westRock*.2):(.55+rng()*1.05)*(1-westRock*.34),
      height:ownerTile?(.83+rng()*.20)*(1-westRock*.2):(.7+rng()*.8)*.5*(1-westRock*.6),
      color:GRASS_COLORS[Math.floor(rng()*GRASS_COLORS.length)]});
  }
  if (!specs.length) return null;
  const mesh = new THREE.InstancedMesh(geometry,material,specs.length);
  mesh.name = 'WV_LivingMeadow_Grass_'+TILE_KEY(ix,iz);
  mesh.userData = {meadow:true,softCollision:true,physicalBlocker:false,clumps:specs.length};
  const dummy = new THREE.Object3D();
  specs.forEach((p,i)=>{
    dummy.position.set(p.x,p.y-.035,p.z);
    dummy.rotation.set(0,p.rotation,0);
    dummy.scale.set(p.scale,p.height,p.scale);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    // The owner's GLB already stores individual green shades in COLOR_0;
    // do not multiply them by the much darker procedural tint palette.
    mesh.setColorAt(i,ownerTile?new THREE.Color(0xffffff):p.color);
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  // Grass reacts to the player but is never a rigid wall/character collider.
  mesh.raycast=()=>{};
  return mesh;
}

/**
 * A tiled meadow over a 6.44km radius. Only the nearby terrain is registered
 * for real player-foot raycasts; the distant horizon is a coarse visual LOD.
 * Existing hometown terrain is not replaced or put into a duplicate floor.
 *
 * Interactions are soft blade displacement for the local avatar and up to
 * three visible remote avatars; hard multiplayer collision remains server-owned.
 */
export function createWolfveilLivingMeadow({
  scene, offsetZ=70, addGroundMesh=()=>{}, removeGroundMesh=()=>{},
  grassTileReplacement=null,
  onTextureStatus=()=>{},
}={}){
  if (!scene) throw Error('Wolfveil living meadow requires a scene');
  const root=new THREE.Group();
  root.position.z=offsetZ;
  root.name='WV_4MileRadius_StreamingSolidMeadow';
  scene.add(root);

  const fallbackTexture=(r,g,b)=>{
    const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1,THREE.RGBAFormat);
    t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
  };
  // The western streamed 4-mile extension must match the full west dirt/rock
  // half of the 1,100m core, not revert to all-green beyond a streaming seam.
  const white=fallbackTexture(255,255,255);
  const westDirt={value:fallbackTexture(116,92,70)};
  const westStone={value:fallbackTexture(124,127,127)};
  const ownedWestTextures=new Set([white,westDirt.value,westStone.value]);
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color:0xffffff,map:white,vertexColors:true,side:THREE.DoubleSide,
    roughness:.97,metalness:0,
  });
  terrainMaterial.name='WV_OwnerGrassTexture_WestDirtStone_SolidMeadowGround';
  terrainMaterial.customProgramCacheKey=()=> 'wolfveil-streamed-west-owner-dirt-stone-v1';
  terrainMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uWestDirt=westDirt;
    shader.uniforms.uWestStone=westStone;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
varying vec2 vWestSoilUV;
varying float vWestRockBlend;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
vWestSoilUV=uv*1.04;
vec3 westWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;
vWestRockBlend=1.0-smoothstep(-140.0,-38.0,westWorldPosition.x);`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
uniform sampler2D uWestDirt,uWestStone;
varying vec2 vWestSoilUV;
varying float vWestRockBlend;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
float westTone=sin(vWestSoilUV.x*2.37+cos(vWestSoilUV.y*1.8))*
  sin(vWestSoilUV.y*2.81-vWestSoilUV.x*.63);
float westGrit=smoothstep(.1,.82,.48+.39*westTone);
vec3 westSoil=texture2D(uWestDirt,vWestSoilUV).rgb;
vec3 westRock=texture2D(uWestStone,vWestSoilUV*1.13).rgb;
vec3 westMineral=mix(westSoil,westRock,westGrit*.80);
westMineral=mix(westMineral,westMineral*vec3(.82,.92,.94),.13);
diffuseColor.rgb=mix(diffuseColor.rgb,westMineral,vWestRockBlend*.98);`);
  };
  const texture=new THREE.TextureLoader();
  let grassAlbedo=null,disposed=false,loadedTexture=false;
  const loadWestTexture=(url,holder)=>{
    texture.load(url,t=>{
      if(disposed){t.dispose();return;}
      t.wrapS=t.wrapT=THREE.RepeatWrapping;
      t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;
      ownedWestTextures.add(t);holder.value=t;
    },undefined,()=>{/* Original PBR fallback texels remain usable. */});
  };
  if(typeof document!=='undefined'){
    loadWestTexture(WOLFVEIL_WEST_LANDSCAPE_TEXTURES.dirt,westDirt);
    loadWestTexture(WOLFVEIL_WEST_LANDSCAPE_TEXTURES.rock,westStone);
  }
  texture.load(VOLCANO_TEXTURES.volcano_grass, t=>{
    if(disposed){t.dispose();return;}
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;
    t.needsUpdate=true;
    terrainMaterial.map=t;
    terrainMaterial.needsUpdate=true;
    grassAlbedo=t;loadedTexture=true;
    onTextureStatus('loaded');
  },undefined,()=>{
    if(!disposed)onTextureStatus('using vertex-color fallback');
  });

  const windTime={value:0};
  const wind={value:new THREE.Vector2(.65,.35)};
  const gust={value:.2};
  const contacts={value:Array.from({length:MAX_CONTACTS},
    ()=>new THREE.Vector4(99999,99999,1,0))};
  // Previous footprints remain pressed for roughly two seconds and relax
  // exponentially instead of disappearing as soon as the avatar moves away.
  const bendingTraces=[];
  let previousGrassFoot=null;
  const grassMaterial=createGrassMaterial(windTime,wind,gust,contacts);
  const grassGeometry=buildWolfveilGrassClumpGeometry();
  const terrainTiles=new Map(),grassTiles=new Map();
  let lastGroundTile='',lastGrassTile='',tileCount=0,clumpCount=0;
  let ownerTileActive=false;
  // On successful GLB decode, discard only the *visual* procedural batches.
  // Streaming terrain, collision BVHs, roots and other scene objects persist.
  const unsubscribeTile=grassTileReplacement?.onReady?.(()=>{
    if(disposed)return;
    for(const {mesh} of grassTiles.values()){root.remove(mesh);mesh.dispose?.();}
    grassTiles.clear();
    ownerTileActive=true;
    grassMaterial.vertexColors=true;
    grassMaterial.needsUpdate=true;
    lastGrassTile='';
  })||(()=>{});
  let previousFocus=null;

  function releaseTerrain(key){
    const record=terrainTiles.get(key);
    if(!record)return;
    if(record.near)removeGroundMesh(record.mesh);
    root.remove(record.mesh);
    record.mesh.geometry.boundsTree?.dispose?.();
    record.mesh.geometry.dispose();
    terrainTiles.delete(key);
  }
  function updateTerrain(focusX,focusZ){
    const unit=FIELD.terrainTileMeters;
    const fx=Math.floor(focusX/unit),fz=Math.floor(focusZ/unit);
    const focusKey=TILE_KEY(fx,fz);
    if(lastGroundTile===focusKey)return;
    lastGroundTile=focusKey;
    const wanted=new Map();
    for(let dz=-FIELD.terrainTileRadius;dz<=FIELD.terrainTileRadius;dz++){
      for(let dx=-FIELD.terrainTileRadius;dx<=FIELD.terrainTileRadius;dx++){
        const ix=fx+dx,iz=fz+dz;
        if(!shouldStreamMeadowTerrainTile(ix,iz))continue;
        wanted.set(TILE_KEY(ix,iz),{
          ix,iz,near:Math.max(Math.abs(dx),Math.abs(dz))<=FIELD.terrainNearTileRadius,
        });
      }
    }
    for(const [key,entry] of [...terrainTiles]){
      if(!wanted.has(key)||entry.near!==wanted.get(key).near)releaseTerrain(key);
    }
    for(const [key,tile] of wanted){
      if(terrainTiles.has(key))continue;
      const mesh=createTerrainTile(tile.ix,tile.iz,tile.near,terrainMaterial);
      root.add(mesh);
      // Register before next player movement. Update only this tile's world
      // transform instead of traversing every streamed tile on each insert.
      mesh.updateWorldMatrix(true, false);
      if(tile.near)addGroundMesh(mesh);
      terrainTiles.set(key,{mesh,near:tile.near});
    }
    tileCount=terrainTiles.size;
  }
  function updateGrass(focusX,focusZ){
    const unit=FIELD.grassTileMeters;
    const fx=Math.floor(focusX/unit),fz=Math.floor(focusZ/unit);
    const focusKey=TILE_KEY(fx,fz);
    const ownerGeometry=grassTileReplacement?.getMeadowGeometry?.();
    const useOwnerTile=ownerTileActive&&Boolean(ownerGeometry);
    if(lastGrassTile===focusKey)return;
    lastGrassTile=focusKey;
    const wanted=new Map();
    for(let dz=-FIELD.grassTileRadius;dz<=FIELD.grassTileRadius;dz++){
      for(let dx=-FIELD.grassTileRadius;dx<=FIELD.grassTileRadius;dx++){
        const ix=fx+dx,iz=fz+dz;
        const planned=meadowGrassTileDensity(ix,iz,focusX,focusZ);
        // 2m grass tile uses 720 triangles rather than 7 tiny blades. Reduce
        // clump count per streamed 48m square to remain GPU-feasible.
        const count=useOwnerTile
          ?(planned>1600?180:planned>500?96:Math.min(planned,32))
          :planned;
        if(count>0)wanted.set(TILE_KEY(ix,iz),{ix,iz,count});
      }
    }
    for(const [key,entry] of [...grassTiles]){
      if(!wanted.has(key)||entry.count!==wanted.get(key).count){
        root.remove(entry.mesh);
        entry.mesh.dispose?.();
        grassTiles.delete(key);
      }
    }
    for(const [key,entry] of wanted){
      if(grassTiles.has(key))continue;
      const mesh=createGrassTile(entry.ix,entry.iz,entry.count,
        useOwnerTile?ownerGeometry:grassGeometry,grassMaterial,useOwnerTile);
      if(!mesh)continue;
      root.add(mesh);
      grassTiles.set(key,{mesh,count:entry.count});
    }
    clumpCount=Array.from(grassTiles.values()).reduce((sum,t)=>sum+t.mesh.count,0);
  }

  function update(dt,weather={},localAvatar=null,remoteAvatars=[]){
    if(disposed)return;
    const focus=localAvatar && Number.isFinite(localAvatar.x) && Number.isFinite(localAvatar.z)
      ? {x:localAvatar.x,z:localAvatar.z-offsetZ}
      : {x:0,z:FIELD.centerZ};
    updateTerrain(focus.x,focus.z);
    updateGrass(focus.x,focus.z);
    windTime.value+=clampMeadow(Number(dt)||0,0,.1);
    const mph=Number(weather.windMph);
    gust.value=clampMeadow(Number.isFinite(mph)?mph/32:.35,.15,1);
    const dir=WIND_DIRECTIONS[weather.windDir]??225;
    const rad=dir*Math.PI/180;
    wind.value.set(-Math.sin(rad),-Math.cos(rad));
    const seconds=clampMeadow(Number(dt)||0,0,.1);
    const recovery=Math.exp(-seconds/1.45);
    for(const trace of bendingTraces)trace.pressure*=recovery;
    for(let i=bendingTraces.length-1;i>=0;i--){
      if(bendingTraces[i].pressure<.055)bendingTraces.splice(i,1);
    }
    const actors=[localAvatar,...(Array.isArray(remoteAvatars)?remoteAvatars:[])]
      .filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)).slice(0,3);
    const foot=actors[0];
    if(foot&&previousGrassFoot){
      const distance=Math.hypot(foot.x-previousGrassFoot.x,foot.z-previousGrassFoot.z);
      // Sample actual displacement, not each frame, so decay is consistent
      // across different frame rates and resting grass does not jitter.
      if(distance>=.60&&distance<12){
        bendingTraces.unshift({x:previousGrassFoot.x,z:previousGrassFoot.z,pressure:1});
        previousGrassFoot={x:foot.x,z:foot.z};
      }else if(distance>=12){
        bendingTraces.length=0; // teleport/reconnect cannot leave false trails
        previousGrassFoot={x:foot.x,z:foot.z};
      }
    }else if(foot)previousGrassFoot={x:foot.x,z:foot.z};
    else previousGrassFoot=null;
    bendingTraces.length=Math.min(bendingTraces.length,MAX_CONTACTS-actors.length);
    const contactsNow=[...actors.map(p=>({x:p.x,z:p.z,radius:1.6,pressure:1})),
      ...bendingTraces.map(p=>({...p,radius:1.9}))].slice(0,MAX_CONTACTS);
    contacts.value.forEach((slot,i)=>{
      const p=contactsNow[i];
      if(p)slot.set(p.x,p.z,p.radius,p.pressure);
      else slot.set(99999,99999,1,0);
    });
    previousFocus=focus;
  }

  function dispose(){
    if(disposed)return;
    disposed=true;
    for(const key of [...terrainTiles.keys()])releaseTerrain(key);
    for(const {mesh} of grassTiles.values()){root.remove(mesh);mesh.dispose?.();}
    grassTiles.clear();
    unsubscribeTile();
    // Owner GLB geometry is shared with the village and freed there after
    // meadow teardown, never here (would break every other tile instance).
    grassGeometry.dispose();
    grassMaterial.dispose();
    if(grassAlbedo)grassAlbedo.dispose();
    for(const t of ownedWestTextures)t.dispose();
    terrainMaterial.dispose();
    scene.remove(root);
  }
  return {
    update,dispose,root,
    getStats:()=>({radiusMeters:FIELD.radiusMeters,terrainTiles:tileCount,
      grassTiles:grassTiles.size,grassClumps:clumpCount,
      owner2mGrassTile:ownerTileActive,
      textured:loadedTexture,localAvatar:previousFocus}),
  };
}
