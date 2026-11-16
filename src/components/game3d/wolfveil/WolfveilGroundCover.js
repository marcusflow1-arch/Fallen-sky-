// Wolfveil reference-driven close-range 3D grass and weathered path edge stones.
// Pure decoration: the original terrain remains the only walkable/collision mesh.
import * as THREE from 'three';
import {insideWolfveilImportedTown} from './WolfveilImportedTownLayout.mjs';
import {WOLFVEIL_ROUTES,WOLFVEIL_SITES,wolfveilDistanceToRiver,wolfveilRouteClearance} from './WolfveilLayout.js';
import {clearOf,wolfveilTreePlacements} from './WolfveilForestLayout.js';
import {isWolfveilCaveApproachReserved} from './WolfveilCaveAccessPlan.mjs';
import {mulberry32} from './WolfveilGeometry.js';
import {isInsideWolfveilSpawnTile} from './WolfveilSpawnTile.js';
import {createWolfveilTerrainSurfaceSampler} from './WolfveilTerrainSurfaceSampler.mjs';
import {planWolfveilFlowPlanting,wolfveilGrassCurrent} from './WolfveilFlowPlanting.mjs';
import {refineWolfveilForestTrailPlanting,planWolfveilForestTrailAccents} from './WolfveilForestTrailLandscape.mjs';
import {wolfveilIsProtectedSWTile,wolfveilSWDecorFootprintRadius,wolfveilThinSWDecorations,wolfveilPlanSWGrassDrawBatch,WOLFVEIL_SW_QUALITY} from './WolfveilSWQuarterQuality.mjs';
import {auditWolfveilSWDecorMeshes,wolfveilNoDecorRaycast} from './WolfveilSWDecorAudit.mjs';
import {planWolfveilPrecisionForestTile,WOLFVEIL_FOREST_DETAIL_STYLE} from './WolfveilPrecisionForestTile.mjs';
import {planWolfveilSquareR06C02,WOLFVEIL_R06C02_ART} from './WolfveilSquareR06C02.mjs';
import {
  wolfveilRockSideBlend,wolfveilWestRockGrassAllowed,planWolfveilWestRockGrassPockets,
} from './WolfveilWestRockGrassPockets.mjs';
// Owner-owned WS05 square #1282. Decorative-only, same terrain/physics world.
import {planWolfveilSquareR08C10} from '../axe/world/landscaping/WolfveilSquareR08C10.mjs';
import {mountWolfveilSquareR08C10Visuals} from '../axe/world/landscaping/WolfveilSquareR08C10Visuals.mjs';
// X46-Z116, dedicated single 5m Play square (#1293); no global material/collider edits.
import {planWolfveilSquareX46Z116} from './square-passes/WolfveilSquareX46Z116.mjs';
import {mountWolfveilSquareX46Z116Visuals} from './square-passes/WolfveilSquareX46Z116Mount.mjs';
// LAND-WS04 X40-Z123 only. Game 3D +70m opt-in, never Game 1 or shared colliders.
import {planWolfveilSquareX40Z123Canonical} from './square-passes/WolfveilSquareX40Z123Canonical.mjs';
import {mountWolfveilSquareX40Z123Visual} from './square-passes/WolfveilSquareX40Z123Visual.mjs';

const TAU=Math.PI*2;
const range=(n,lo,hi,fallback)=>Number.isFinite(n)&&n>=lo&&n<=hi?n:fallback;
const grassPalette=[0x465d32,0x57783d,0x70854a,0x425e38,0x7e8249];
const rockPalette=[0x666761,0x77796d,0x8a897d,0x595e5a,0x777268];

export function planWolfveilGroundCover({seed=0x51c0f22,radius=125,cellSize=25,attemptsPerCell=140,squareHalfExtent=null,terrainSpan=1100,terrainSegments=310}={}){
  radius=range(radius,20,180,125);
  cellSize=range(cellSize,10,50,25);
  attemptsPerCell=range(attemptsPerCell,1,960,140);
  squareHalfExtent=squareHalfExtent==null?null:range(squareHalfExtent,16,100,48);
  const rand=mulberry32(seed>>>0),patches=[];
  const sampleVisibleGround=createWolfveilTerrainSurfaceSampler({span:terrainSpan,segments:terrainSegments});
  // Wolfveil's actual market is 70 metres south in layout coordinates; the
  // Game 3D scene shifts that point to world spawn (0,0).
  const cx=WOLFVEIL_SITES.market.x,cz=WOLFVEIL_SITES.market.z;
  const half=Math.ceil(radius/cellSize);
  for(let iz=-half;iz<half;iz++)for(let ix=-half;ix<half;ix++){
    const minX=cx+(ix*cellSize),minZ=cz+(iz*cellSize);
    const patchDistance=Math.hypot(minX+cellSize*.5-cx,minZ+cellSize*.5-cz);
    if(patchDistance>radius+cellSize)continue;
    // Lush individual grass close to the player; sparse farther out so that
    // a single material/draw budget isn't spent on distant unseen blades.
    const near=Math.exp(-Math.pow(patchDistance/53,2));
    const samples=Math.round(attemptsPerCell*(1+3.1*near));
    const plants=[];
    for(let j=0;j<samples;j++){
      const x=minX+rand()*cellSize,z=minZ+rand()*cellSize;
      if(Math.hypot(x-cx,z-cz)>radius||!clearOf({x,z},.12)||
        (squareHalfExtent!=null&&!isInsideWolfveilSpawnTile(x,z,squareHalfExtent)))continue;
      plants.push({x,y:sampleVisibleGround(x,z),z,
        yaw:wolfveilGrassCurrent(x,z)+(rand()-.5)*.48,
        height:(.18+rand()*.29)*.5,width:.56+rand()*.68,
        shade:Math.floor(rand()*grassPalette.length)});
    }
    if(plants.length)patches.push({id:String(ix)+':'+String(iz),plants});
  }
  return patches;
}
export function planWolfveilPathStones({seed=0x7ea125,spacing=3.6,squareHalfExtent=null,terrainSpan=1100,terrainSegments=310}={}){
  spacing=range(spacing,1.8,8,3.6);
  squareHalfExtent=squareHalfExtent==null?null:range(squareHalfExtent,16,100,48);
  const rand=mulberry32(seed>>>0),stones=[];
  const sampleVisibleGround=createWolfveilTerrainSurfaceSampler({span:terrainSpan,segments:terrainSegments});
  for(const route of WOLFVEIL_ROUTES){
    if(!['primary','residential','explore','ridge'].includes(route.kind))continue;
    for(let i=0;i<route.points.length-1;i++){
      const a=route.points[i],b=route.points[i+1];
      const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<1)continue;
      const nx=-dz/len,nz=dx/len;
      for(let step=spacing*.5;step<len;step+=spacing){
        for(const sign of [-1,1]){
          if(rand()<.23)continue;
          const t=step/len,r=route.width*.5+.40+rand()*.70;
          const x=a[0]+dx*t+nx*r*sign,z=a[1]+dz*t+nz*r*sign;
          if(!clearOf({x,z},0)||wolfveilDistanceToRiver(x,z)<18||
            (squareHalfExtent!=null&&!isInsideWolfveilSpawnTile(x,z,squareHalfExtent)))continue;
          const size=.20+rand()*.38;
          stones.push({x,y:sampleVisibleGround(x,z)+size*.13,z,
            yaw:rand()*TAU,size,shade:Math.floor(rand()*rockPalette.length)});
        }
      }
    }
  }
  return stones;
}
export function buildWolfveilGrassClumpGeometry(){
  // Seven 3D tapered, gently curved blades; no flat square billboard cards.
  const vertices=[],indices=[];
  for(let blade=0;blade<7;blade++){
    const angle=blade*2.3999632297;
    const spread=.10+blade%3*.05,lean=.09+(blade%4)*.035;
    const height=.64+(blade%3)*.14;
    const dx=Math.cos(angle),dz=Math.sin(angle),tx=-dz,tz=dx;
    const width=.060+(blade%3)*.009,base=vertices.length/3;
    for(const [t,halfWidth] of [[0,width],[.55,width*.57],[1,0]]){
      const cx=dx*(spread+t*lean),cz=dz*(spread+t*lean),y=height*t;
      vertices.push(cx+tx*halfWidth,y,cz+tz*halfWidth,
        cx-tx*halfWidth,y,cz-tz*halfWidth);
    }
    indices.push(base,base+2,base+1,base+1,base+2,base+3,
      base+2,base+4,base+3,base+3,base+4,base+5);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
// The claimed T07-05 square uses seven individual upright three-sided
// tapered blades, rather than intersecting billboard crosses. Only this
// square uses this geometry; adjacent World / Game 1 materials are untouched.
export function buildWolfveilUprightInkBladeGeometry(){
  const vertices=[],indices=[];
  for(let blade=0;blade<7;blade++){
    const rootX=(blade-3)*.066,rootZ=((blade*3)%5-2)*.022;
    const tipX=rootX+(blade%3-1)*.017;
    const tipZ=rootZ+.075+(blade%2)*.016;
    const height=.72+(blade%3)*.07;
    const width=.021+(blade%2)*.003;
    const base=vertices.length/3;
    // Three genuinely volumetric blade faces with a narrow pointed end:
    // no intersecting flat cards and no plus-shaped footprint.
    vertices.push(
      rootX-width,0,rootZ,
      rootX+width,0,rootZ,
      rootX,0,rootZ+width*.36,
      rootX+(tipX-rootX)*.45-width*.57,height*.54,rootZ+(tipZ-rootZ)*.54,
      rootX+(tipX-rootX)*.45+width*.57,height*.54,rootZ+(tipZ-rootZ)*.54,
      rootX+(tipX-rootX)*.45,height*.54,rootZ+(tipZ-rootZ)*.54+width*.18,
      tipX,height,tipZ,
    );
    for(let face=0;face<3;face++){
      const next=(face+1)%3;
      indices.push(base+face,base+next,base+3+face,
        base+next,base+3+next,base+3+face,
        base+3+face,base+3+next,base+6);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function buildWolfveilGroundCover(world,options={}){
  if(!world?.mesh||!Array.isArray(world.ownedMaterials))
    throw Error('Wolfveil ground cover needs the existing world builder');
  // The real Game 3D spawn opts into squareHalfExtent. Extend that existing
  // opt-in into route-aligned ribbons across the *whole* physical Wolfveil
  // core without changing the shared Game 1 scene or the server collision.
  const sampleVisibleGround=createWolfveilTerrainSurfaceSampler({
    span:options.terrainSpan??1100,segments:options.terrainSegments??310,
  });
  const forestTrees=options.squareHalfExtent!=null?wolfveilTreePlacements():null;
  const flow=options.squareHalfExtent!=null
    ?planWolfveilFlowPlanting({
       routes:WOLFVEIL_ROUTES,clearOf,heightAt:sampleVisibleGround,
       distanceToRiver:wolfveilDistanceToRiver,trees:forestTrees,
     })
    :null;
  // Reference-driven western forest verges: original route anchors only.
  // Game 1 never opts in; all changes are decorative and tile-owner guarded.
  const geoForestEnabled=options.precisionTileWorldOffsetZ===70&&
    options.squareHalfExtent!=null;
  const geoForestReserved=(x,z,r)=>wolfveilIsProtectedSWTile(x,z,r);
  const geoForestGrass=geoForestEnabled&&flow
    ?refineWolfveilForestTrailPlanting(flow,{reservedAt:geoForestReserved})
    :null;
  // Independent R06-C02 forest-floor style pass, never a new collision writer.
  const forestSquare=forestTrees
    ?planWolfveilSquareR06C02({trees:forestTrees,heightAt:sampleVisibleGround,
       clearOf,distanceToRiver:wolfveilDistanceToRiver})
    :null;
  const patches=planWolfveilGroundCover(options);
  if(forestSquare?.grass.length)patches.push({
    id:forestSquare.id+'-ForestFloor',plants:forestSquare.grass,
  });
  // One 10x10m authoring square only; the scene opts in from Game 3D's
  // +70m Wolfveil frame, never Game 1 or the editor's unsampled grid.
  const precisionTile=options.precisionTileWorldOffsetZ===70
    ?planWolfveilPrecisionForestTile({
       heightAt:sampleVisibleGround,clearOf,
       distanceToRiver:wolfveilDistanceToRiver,
       trees:forestTrees??wolfveilTreePlacements(),grassHeading:wolfveilGrassCurrent,
     })
    :null;
  if(precisionTile?.grass.length)
    patches.push({id:precisionTile.id,plants:precisionTile.grass});
  // Game 3D's existing +70m opt-in ONLY. Never place this tile in Game 1,
  // previews or a scene without its authoritative registered trunk inputs.
  // All authored X/Z remain Wolfveil-local; group translation happens once.
  const qualitySquareR08C10=options.precisionTileWorldOffsetZ===70&&forestTrees
    ?planWolfveilSquareR08C10({
       surfaceHeightAt:sampleVisibleGround,clearOf,
       distanceToRiver:wolfveilDistanceToRiver,
       routeClearance:wolfveilRouteClearance,
       existingTrees:forestTrees,
     })
    :null;
  // WS15 integration: X46-Z116 uses the same authoritative sampled visible
  // terrain and existing route/river/trunk records. The +70m transform is
  // inherited ONCE from WolfveilScene's Game 3D-only parent group.
  const squareX46Plan=options.precisionTileWorldOffsetZ===70&&forestTrees
    ?planWolfveilSquareX46Z116({
       heightAt:sampleVisibleGround,clearOf,
       distanceToRiver:wolfveilDistanceToRiver,trees:forestTrees,
     })
    :null;
  // Apply the new art direction only to playable Game 3D. The western
  // owner-textured dirt/rock hillside is ~80% grass-free by *area*, while
  // surviving foliage gathers into coherent islands instead of even thinning.
  // Source square planners, Game 1, BVH, server movement and mountains stay intact.
  const sparseRockInGame3D=options.precisionTileWorldOffsetZ===70 &&
    options.squareHalfExtent!=null;
  let westRockPocketClumps=0;
  let protectedRockPocketClumpsSkipped=0;
  if(sparseRockInGame3D){
    // Do not override the planting patterns authored in claimed terrain
    // squares. Protect both their named patches and a 1.25m halo around
    // their exact roots so wide seven-blade clumps never cross tile seams.
    const reservedRoot=(p,kind='grass')=>wolfveilIsProtectedSWTile(
      p.x,p.z,wolfveilSWDecorFootprintRadius(p,kind));
    for(let i=patches.length-1;i>=0;i--){
      if(patches[i].id===precisionTile?.id||
         patches[i].id===forestSquare?.id+'-ForestFloor')continue;
      patches[i].plants=patches[i].plants.filter(p=>
        reservedRoot(p)||wolfveilWestRockGrassAllowed(p.x,p.z));
      if(!patches[i].plants.length)patches.splice(i,1);
    }
    if(flow){
      flow.grass=flow.grass.filter(p=>
        reservedRoot(p)||wolfveilWestRockGrassAllowed(p.x,p.z));
      flow.shrubs=flow.shrubs.filter(p=>
        reservedRoot(p,'shrub')||wolfveilWestRockGrassAllowed(p.x,p.z));
    }
    const plannedRockPockets=planWolfveilWestRockGrassPockets({
      heightAt:sampleVisibleGround,clearOf,
      distanceToRiver:wolfveilDistanceToRiver,
      routeClearance:wolfveilRouteClearance,
      trees:forestTrees??[],
    });
    // Ordinary western grass islands are not allowed to plant NEW instances
    // inside another team's 5m or 100m quality square.
    const westRockPockets=plannedRockPockets.filter(p=>!reservedRoot(p));
    westRockPocketClumps=westRockPockets.length;
    protectedRockPocketClumpsSkipped=plannedRockPockets.length-westRockPocketClumps;
    if(westRockPocketClumps)
      patches.push({id:'WestRock_ScatteredGrassIslands',plants:westRockPockets});
  }
  const geoForestStones=geoForestEnabled
    ?planWolfveilForestTrailAccents({
       heightAt:sampleVisibleGround,clearOf,
       riverDistance:wolfveilDistanceToRiver,
       trees:forestTrees??[],reservedAt:geoForestReserved,
     })
    :[];
  const stoneSpecs=[
    ...planWolfveilPathStones(options),
    ...geoForestStones,
    ...(forestSquare?.stones??[]).map(p=>({...p,forestSquareArt:true})),
    ...(precisionTile?.stones??[]).map(p=>({...p,precisionTileId:precisionTile.id})),
    ...(flow?.stones??[]).map(p=>({x:p.x,y:p.y,z:p.z,yaw:p.yaw,
      size:p.scale,shade:Math.floor(Math.abs(p.x*13+p.z*5))%rockPalette.length})),
  ];
  // The imported assembled town already has its own paved streets, parks and
  // foliage. Remove *only* the old Game 3D spawn square's small grass and
  // loose path stones from this precise footprint, so they cannot poke
  // through the owner's tile roads. Do not change world terrain or owners'
  // independent landscaping squares outside the town.
  if(options.importedTownAtMarket){
    const clearTown=p=>!insideWolfveilImportedTown(p.x,p.z,1.5);
    for(let i=patches.length-1;i>=0;i--){
      patches[i].plants=patches[i].plants.filter(clearTown);
      if(!patches[i].plants.length)patches.splice(i,1);
    }
    for(let i=stoneSpecs.length-1;i>=0;i--)
      if(!clearTown(stoneSpecs[i]))stoneSpecs.splice(i,1);
    if(flow){
      flow.grass=flow.grass.filter(clearTown);
      flow.shrubs=flow.shrubs.filter(clearTown);
    }
  }
  // Only remove grass growing through the new cave access lanes. Original
  // authored LAND tile vegetation and approved landscaping outside these
  // narrow paths are never moved or re-graded.
  const clearCavePath=p=>!options.importedTownAtMarket ||
    !isWolfveilCaveApproachReserved(p.x,p.z,.95);
  for(let i=patches.length-1;i>=0;i--){
    patches[i].plants=patches[i].plants.filter(clearCavePath);
    if(!patches[i].plants.length)patches.splice(i,1);
  }
  if(flow){
    flow.grass=flow.grass.filter(clearCavePath);
    flow.shrubs=flow.shrubs.filter(clearCavePath);
  }
  // Keep small path-edge pebbles but never place loose rocks in the tread.
  for(let i=stoneSpecs.length-1;i>=0;i--)
    if(!clearCavePath(stoneSpecs[i]))stoneSpecs.splice(i,1);
  // 25% southwest-quarter quality pass: keep the strong shapes, halve the
  // anonymous grass/shrub/path-stone instances. No tree or collision changes.
  // Independent tile-owner patches are excluded; the other teams can continue.
  const swQuarterQuality={id:WOLFVEIL_SW_QUALITY.id,
    areaFraction:WOLFVEIL_SW_QUALITY.originalCoreAreaFraction,
    targetReduction:WOLFVEIL_SW_QUALITY.targetDecorReduction,
    originalInstances:0,retainedInstances:0,removedInstances:0,groups:{}};
  if(sparseRockInGame3D){
    const record=(id,result)=>{
      swQuarterQuality.groups[id]={
        original:result.before,retained:result.after,removed:result.removed,
      };
      swQuarterQuality.originalInstances+=result.before;
      swQuarterQuality.retainedInstances+=result.after;
      swQuarterQuality.removedInstances+=result.removed;
    };
    for(let i=patches.length-1;i>=0;i--){
      const patch=patches[i];
      if(patch.id===precisionTile?.id||
         patch.id===forestSquare?.id+'-ForestFloor')continue;
      const quality=wolfveilThinSWDecorations(patch.plants,'grass');
      patch.plants=quality.items;
      record('grass:'+patch.id,quality);
      if(!patch.plants.length)patches.splice(i,1);
    }
    if(flow){
      const grassQuality=wolfveilThinSWDecorations(flow.grass,'grass');
      flow.grass=grassQuality.items;record('flowGrass',grassQuality);
      const shrubQuality=wolfveilThinSWDecorations(flow.shrubs,'shrub');
      flow.shrubs=shrubQuality.items;record('flowShrubs',shrubQuality);
    }
    // Leave stones belonging to independent single-square owners untouched.
    const genericStones=stoneSpecs.filter(p=>
      !p.forestSquareArt&&!p.precisionTileId);
    const ownedStones=stoneSpecs.filter(p=>p.forestSquareArt||p.precisionTileId);
    const stoneQuality=wolfveilThinSWDecorations(genericStones,'stone');
    stoneSpecs.splice(0,stoneSpecs.length,...stoneQuality.items,...ownedStones);
    record('pathStones',stoneQuality);
    swQuarterQuality.actualReduction=swQuarterQuality.originalInstances
      ?swQuarterQuality.removedInstances/swQuarterQuality.originalInstances:0;
    westRockPocketClumps=patches.find(p=>
      p.id==='WestRock_ScatteredGrassIslands')?.plants.length??0;
  }
  // Merge the remaining generic SW grass *instances* into one draw batch.
  // Owner tile planners, river/forest patches and every non-SW plant stay
  // separate and unchanged. Preserve PBR shading and the shared wind shader.
  const swGrassBatch=sparseRockInGame3D
    ?wolfveilPlanSWGrassDrawBatch(patches):null;
  if(swGrassBatch?.savedDrawCalls>0)
    patches.splice(0,patches.length,...swGrassBatch.patches);
  if(sparseRockInGame3D){
    swQuarterQuality.grassBatch={
      originalDrawCalls:swGrassBatch.originalDrawCalls,
      resultingDrawCalls:swGrassBatch.resultingDrawCalls,
      savedDrawCalls:swGrassBatch.savedDrawCalls,
      batchedGrassClumps:swGrassBatch.instancedGrassBatched,
      originalPatchContributors:swGrassBatch.originalContributors,
      meshCollidersAdded:0,
    };
  }
  const grassGeometry=buildWolfveilGrassClumpGeometry();
  // The Game 3D world retains a single immutable seven-blade geometry for
  // all generic grass InstancedMeshes. Per-mesh instance transforms and colors
  // remain independent; Game 1 keeps its original per-patch ownership model.
  const reuseGenericGrassGeometry=sparseRockInGame3D;
  const tileGrassGeometry=(precisionTile||qualitySquareR08C10)?buildWolfveilUprightInkBladeGeometry():null;
  const stoneGeometry=new THREE.IcosahedronGeometry(1,1);
  const positions=stoneGeometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const f=.81+.14*Math.sin(x*13.3+y*7.7+z*11.1);
    positions.setXYZ(i,x*f,y*f,z*f);
  }
  stoneGeometry.computeVertexNormals();
  const grassMat=new THREE.MeshStandardMaterial({color:0xffffff,
    side:THREE.DoubleSide,roughness:.91,metalness:0});
  const rockMat=new THREE.MeshStandardMaterial({color:0xffffff,
    roughness:.96,metalness:0});
  grassMat.name='Wolfveil_IndividualCurvedGrassBladeClusters';
  // Wind-painted Sumi-e / lush fantasy grass: sway the *existing* seven-blade
  // 3D clumps, never their anchored roots or the actual terrain collider.
  // This material is decorative and has its own shader, so a VFX failure
  // cannot make the player's ground vanish.
  const inkTime={value:0};
  const inkGust={value:.25};
  const inkWind={value:new THREE.Vector2(.6,.8)};
  const inkContacts={value:Array.from({length:6},
    ()=>new THREE.Vector4(99999,99999,1,0))};
  const bendingTraces=[];
  let previousFoot=null;
  grassMat.customProgramCacheKey=()=> 'wolfveil-sumie-tip-sway-contact-recovery-v2';
  grassMat.onBeforeCompile=shader=>{
    if(!shader.vertexShader.includes('#include <common>')||
       !shader.vertexShader.includes('#include <begin_vertex>'))return;
    shader.uniforms.uInkGrassTime=inkTime;
    shader.uniforms.uInkGrassGust=inkGust;
    shader.uniforms.uInkGrassWind=inkWind;
    shader.uniforms.uInkGrassContacts=inkContacts;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
uniform float uInkGrassTime, uInkGrassGust;
uniform vec2 uInkGrassWind;
uniform vec4 uInkGrassContacts[6];`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
// World-position phases make different clumps dance independently in the wind.
#ifdef USE_INSTANCING
vec3 inkRoot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
#else
vec3 inkRoot=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
#endif
float inkTip=smoothstep(.08,.76,position.y);
float inkDance=.62*sin(uInkGrassTime*1.6+inkRoot.x*.17+inkRoot.z*.12)
             +.38*sin(uInkGrassTime*.94+inkRoot.z*.27-inkRoot.x*.08);
transformed.xz+=normalize(uInkGrassWind+vec2(.001))*
  inkDance*(.035+.16*uInkGrassGust)*inkTip;
for(int j=0;j<6;j++){
  vec4 touch=uInkGrassContacts[j];
  vec2 away=inkRoot.xz-touch.xy;
  float press=(1.0-smoothstep(0.0,max(.001,touch.z),length(away)))*touch.w;
  transformed.xz+=normalize(away+vec2(.001))*press*inkTip*.36;
  transformed.y-=press*inkTip*.22;
}`);
  };
  rockMat.name='Wolfveil_WeatheredPathEdgeStone';
  world.ownedMaterials.push(grassMat,rockMat);
  const grassTints=grassPalette.map(hex=>new THREE.Color(hex)),
    stoneTints=rockPalette.map(hex=>new THREE.Color(hex)),
    tileGrassTints=WOLFVEIL_FOREST_DETAIL_STYLE.grassColors.map(hex=>new THREE.Color(hex)),
    tileStoneTints=WOLFVEIL_FOREST_DETAIL_STYLE.stoneColors.map(hex=>new THREE.Color(hex));
  const squareGrassTints=WOLFVEIL_R06C02_ART.grassColors.map(hex=>new THREE.Color(hex));
  const squareStoneTints=WOLFVEIL_R06C02_ART.stoneColors.map(hex=>new THREE.Color(hex));
  const dummy=new THREE.Object3D(),grassMeshes=[];
  let clumps=0;
  for(const patch of patches){
    const isPrecisionPatch=patch.id===precisionTile?.id;
    const forestFloorPatch=patch.id===forestSquare?.id+'-ForestFloor';
    const mesh=new THREE.InstancedMesh(
      isPrecisionPatch?tileGrassGeometry.clone()
        :(reuseGenericGrassGeometry?grassGeometry:grassGeometry.clone()),
      grassMat,patch.plants.length);
    patch.plants.forEach((p,i)=>{
      dummy.position.set(p.x,p.y-.035,p.z);
      dummy.rotation.set(0,p.yaw,0);
      dummy.scale.set(p.width,p.height,p.width);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,(isPrecisionPatch?tileGrassTints:grassTints)[p.shade]);
      if(forestFloorPatch)mesh.setColorAt(i,squareGrassTints[p.shade]);
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.name='SWV_Natural_3D_Grass_'+patch.id;
    mesh.castShadow=false;mesh.receiveShadow=true;
    if(patch.id==='WestRock_ScatteredGrassIslands'){
      mesh.raycast=wolfveilNoDecorRaycast;
      mesh.userData={decorativeOnly:true,nonCollider:true,rockGrassPockets:true};
    }
    if(patch.id===precisionTile?.id){
      mesh.raycast=wolfveilNoDecorRaycast;
      mesh.userData={decorativeOnly:true,nonCollider:true,precisionTileId:patch.id};
    }else if(forestFloorPatch){
      mesh.raycast=wolfveilNoDecorRaycast;
      mesh.userData={decorativeOnly:true,nonCollider:true,forestSquareId:forestSquare.id};
    }
    if(sparseRockInGame3D){
      // Standard patches were accidentally still raycastable, despite being
      // cosmetic. Never let seven-blade clumps intercept terrain/foot picks.
      // Preserve the existing owner-square userData and never add colliders.
      mesh.raycast=wolfveilNoDecorRaycast;
      mesh.userData={...mesh.userData,decorativeOnly:true,nonCollider:true};
    }
    world.mesh(mesh);grassMeshes.push(mesh);
    clumps+=patch.plants.length;
  }
  if(swGrassBatch?.mergedPlants.length){
    const batchedPlants=swGrassBatch.mergedPlants;
    const batch=new THREE.InstancedMesh(grassGeometry,grassMat,batchedPlants.length);
    batchedPlants.forEach((p,i)=>{
      dummy.position.set(p.x,p.y-.035,p.z);
      dummy.rotation.set(0,p.yaw,0);
      dummy.scale.set(p.width,p.height,p.width);
      dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
      batch.setColorAt(i,grassTints[p.shade]);
    });
    batch.instanceMatrix.needsUpdate=true;
    if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
    batch.computeBoundingSphere();
    batch.name='SWV_SWQuarter_Consolidated_Grass_Batch';
    batch.castShadow=false;batch.receiveShadow=true;
    batch.raycast=wolfveilNoDecorRaycast;
    batch.userData={decorativeOnly:true,nonCollider:true,
      swQuarterQuality:true,originalPatchCount:swGrassBatch.originalContributors};
    world.mesh(batch);grassMeshes.push(batch);
    clumps+=batchedPlants.length;
  }
  // The same lit, weather-driven shader serves one additional batched mesh
  // rather than creating thousands of individual grass materials or draw calls.
  if(flow?.grass.length){
    const flowing=new THREE.InstancedMesh(reuseGenericGrassGeometry?grassGeometry:grassGeometry.clone(),grassMat,flow.grass.length);
    for(let i=0;i<flow.grass.length;i++){
      const p=flow.grass[i];
      dummy.position.set(p.x,p.y-.035,p.z);
      dummy.rotation.set(0,p.yaw,0);
      dummy.scale.set(p.width,p.height*.5,p.width);
      dummy.updateMatrix();flowing.setMatrixAt(i,dummy.matrix);
      flowing.setColorAt(i,grassTints[p.shade]);
    }
    flowing.instanceMatrix.needsUpdate=true;
    if(flowing.instanceColor)flowing.instanceColor.needsUpdate=true;
    flowing.computeBoundingSphere();
    flowing.name='SWV_RiverFlow_RouteGrass';
    flowing.castShadow=false;flowing.receiveShadow=true;
    flowing.raycast=wolfveilNoDecorRaycast; // soft visual cover, never a second collision floor
    flowing.userData={decorativeOnly:true,nonCollider:true};
    world.mesh(flowing);grassMeshes.push(flowing);
    clumps+=flow.grass.length;
  }
  let flowShrubs=null;
  // The big bright-blue ellipses in the screenshot were not rocks at all:
  // they are animated, non-colliding icosahedral shrub placeholders using
  // the grass wind shader. Remove ALL of those visual instances in Game 3D.
  // Natural slate stones and the owner's actual GLB plant anchors survive.
  // Game 1 retains its original optional river-flow understory treatment.
  if(flow?.shrubs.length&&!options.removeBlueCyanOvals){
    const shrubMaterial=new THREE.MeshStandardMaterial({color:0xffffff,
      roughness:.94,metalness:0,side:THREE.DoubleSide});
    shrubMaterial.name='Wolfveil_RiverFlow_BlueCyanUnderstory';
    // The existing rooted tip shader also bends the upper portions of shrubs.
    shrubMaterial.onBeforeCompile=grassMat.onBeforeCompile;
    shrubMaterial.customProgramCacheKey=grassMat.customProgramCacheKey;
    world.ownedMaterials.push(shrubMaterial);
    const colors=[0x294e65,0x376e8d,0x4384a5,0x64a6c8].map(c=>new THREE.Color(c));
    const westColors=[0x496b45,0x637654,0x789064,0x536a4a].map(c=>new THREE.Color(c));
    flowShrubs=new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1,1),shrubMaterial,flow.shrubs.length);
    flow.shrubs.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z);
      dummy.rotation.set(0,p.yaw,0);
      dummy.scale.set(p.scale*1.15,p.scale*.73,p.scale);
      dummy.updateMatrix();flowShrubs.setMatrixAt(i,dummy.matrix);
      flowShrubs.setColorAt(i,(sparseRockInGame3D&&wolfveilRockSideBlend(p.x,p.z)>.5
        ?westColors:colors)[p.shade]);
    });
    flowShrubs.instanceMatrix.needsUpdate=true;
    if(flowShrubs.instanceColor)flowShrubs.instanceColor.needsUpdate=true;
    flowShrubs.computeBoundingSphere();
    flowShrubs.name='SWV_RiverFlow_BlueCyan_Understory';
    flowShrubs.castShadow=false;flowShrubs.receiveShadow=true;
    flowShrubs.raycast=wolfveilNoDecorRaycast;
    flowShrubs.userData={decorativeOnly:true,nonCollider:true};
    world.mesh(flowShrubs);
  }
  // WS05 quality square: at most three original-looking instanced batches.
  // Reuse this exact live sampler, world wind shader and material registry.
  // Visuals are not a terrain floor and do not register client/server collision.
  const qualitySquareVisualsR08C10=qualitySquareR08C10
    ?mountWolfveilSquareR08C10Visuals({
       plan:qualitySquareR08C10,THREE,world,
       grassGeometry:tileGrassGeometry,understoryGeometry:tileGrassGeometry,
       stoneGeometry,grassMaterial:grassMat,stoneMaterial:rockMat,
     })
    :null;
  if(qualitySquareVisualsR08C10)
    grassMeshes.push(...qualitySquareVisualsR08C10.meshes.filter(
      mesh=>mesh.userData.kind!=='stones'));
  // Two optional real instanced batches, both non-colliding and non-raycast.
  // Reuse existing Grass wind shader + Living Sumi-e material and slate stone
  // material. This never creates a second tree anchor or physics ground.
  const squareX46Visuals=squareX46Plan
    ?mountWolfveilSquareX46Z116Visuals({
       plan:squareX46Plan,THREE,world,
       grassMaterial:grassMat,stoneMaterial:rockMat,stoneGeometry,
     })
    :null;
  if(squareX46Visuals)
    grassMeshes.push(...squareX46Visuals.meshes.filter(
      mesh=>mesh.userData.kind==='grass'));
  // The X40-Z123 5m square is owned separately (#1270). Never plant in
  // Game 1, at a mismatched parent offset, or without the authored Play
  // ground-cover pass. The canonical adapter reads original visible terrain
  // triangles, registered trunk colliders, protected routes and river banks.
  const x40Z123Preview=options.precisionTileWorldOffsetZ===70&&forestTrees&&
    options.squareHalfExtent!=null&&world.group?.position?.z===70
    ?planWolfveilSquareX40Z123Canonical({
       sceneOffsetZ:70,
       terrainSpan:options.terrainSpan??1100,
       terrainSegments:options.terrainSegments??310,
     })
    :null;
  const x40Z123Visuals=x40Z123Preview
    ?mountWolfveilSquareX40Z123Visual({
       THREE,world,preview:x40Z123Preview,enable:true,
     })
    :null;
  let stones=null;
  if(stoneSpecs.length){
    stones=new THREE.InstancedMesh(stoneGeometry,rockMat,stoneSpecs.length);
    stoneSpecs.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z);
      dummy.rotation.set(0,p.yaw,0);
      dummy.scale.set(p.size*1.18,p.size*.42,p.size*.91);
      dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
      // Without a quality tile, undefined === undefined would accidentally
      // recolor every Game 1 stone. Guard the opt-in explicitly.
      const isPrecisionStone=precisionTile!=null&&p.precisionTileId===precisionTile.id;
      stones.setColorAt(i,(isPrecisionStone?tileStoneTints:stoneTints)[p.shade]);
      if(p.forestSquareArt)stones.setColorAt(i,squareStoneTints[p.shade]);
    });
    stones.instanceMatrix.needsUpdate=true;
    if(stones.instanceColor)stones.instanceColor.needsUpdate=true;
    stones.name='SWV_Natural_Path_Edge_Weathered_Stones';
    if(sparseRockInGame3D){
      stones.raycast=wolfveilNoDecorRaycast; // small weathered stones are pass-through
      stones.userData={decorativeOnly:true,nonCollider:true,walkOnTerrain:true};
    }
    stones.castShadow=false;stones.receiveShadow=true;stones.frustumCulled=false;
    world.mesh(stones);
  }else stoneGeometry.dispose();
  // In Game 3D, the builder now owns and disposes the shared grass geometry
  // exactly once. When no mesh uses the source (or in Game 1), release it now.
  const sharedGrassMeshCount=grassMeshes.filter(m=>m.geometry===grassGeometry).length;
  if(!reuseGenericGrassGeometry||sharedGrassMeshCount===0)grassGeometry.dispose();
  tileGrassGeometry?.dispose();
  const qualityCounts=qualitySquareVisualsR08C10?.counts;
  const x46Counts=squareX46Visuals?.counts;
  const x40Counts=x40Z123Visuals;
  // Actual matrices after pruning, merging and world-mesh creation. Run once
  // per build, never per frame; do not count named square-owner authored meshes.
  const swDecorAudit=sparseRockInGame3D
    ?auditWolfveilSWDecorMeshes({grassMeshes,flowShrubs,stones},THREE):null;
  const totalGrassClumps=clumps+(qualityCounts?.grass??0)+
    (qualityCounts?.understory??0)+(x46Counts?.grass??0)+
    (x40Counts?.grass??0)+(x40Counts?.understory??0);
  return {grassPatches:patches.length+(swGrassBatch?.mergedPlants.length?1:0)+(x46Counts?.grass?1:0)+
      (x40Counts?.grass?1:0),
    grassClumps:totalGrassClumps,
    individualBlades:(totalGrassClumps-(x46Counts?.grass??0)-
      (x40Counts?.understory??0))*7+(x46Counts?.blades??0)+
      (x40Counts?.understory??0)*6,
    pathStones:stoneSpecs.length+(qualityCounts?.stones??0)+
      (x46Counts?.stones??0)+(x40Counts?.stones??0),
    flowGrass:flow?.grass.length??0,flowShrubs:flowShrubs?(flow?.shrubs.length??0):0,
    removedBlueCyanOvals:options.removeBlueCyanOvals?(flow?.shrubs.length??0):0,
    westRockPocketClumps,protectedRockPocketClumpsSkipped,
    westRockBiomeGrassFraction:.20,
    swQuarterQuality:sparseRockInGame3D?swQuarterQuality:null,
    swDecorAudit,
    grassGeometryReuse:reuseGenericGrassGeometry?{
      sharedMeshes:sharedGrassMeshCount,
      duplicateGeometryAllocationsAvoided:Math.max(0,sharedGrassMeshCount-1),
      independentInstanceColors:true,
      ownedSquaresKeepDistinctGeometries:true,
      collidersAdded:0,
    }:null,
    forestSquare:forestSquare?{id:forestSquare.id,
      existingTreeAnchors:forestSquare.existingTreeAnchors,
      grassClumps:patches.find(p=>p.id===forestSquare.id+'-ForestFloor')?.plants.length??0,
      stones:forestSquare.stones.length,
      visualOnly:true,collidersAdded:0}:null,
    precisionTile:precisionTile?{
      id:precisionTile.id,grass:patches.find(p=>p.id===precisionTile.id)?.plants.length??0,
      stones:precisionTile.stones.length,decorativeOnly:true,
    }:null,
    qualitySquareR08C10:qualitySquareVisualsR08C10?{
      id:qualitySquareVisualsR08C10.tileId,
      ...qualitySquareVisualsR08C10.counts,
      decorativeOnly:true,collidersAdded:0,worldOffsetZAppliedOnce:true,
    }:null,
    squareX46Z116:squareX46Visuals?{
      id:squareX46Visuals.tileId,...squareX46Visuals.counts,
      decorativeOnly:true,collidersAdded:0,worldZOffsetHandledByParent:true,
    }:null,
    squareX40Z123:x40Counts?{
      id:'X40-Z123',
      grass:x40Counts.grass,stones:x40Counts.stones,
      understory:x40Counts.understory,
      decorativeOnly:true,collidersAdded:0,worldZOffsetHandledByParent:true,
      canonicalTriangleSampler:true,
    }:null,
    forestTrailStudy:geoForestEnabled?{
      styledGrass:flow?.grass.filter(p=>p.forestReferenceStyle).length??0,
      plannedStyledGrass:geoForestGrass?.styled??0,
      pathEdgeStones:stoneSpecs.filter(p=>p.forestReferenceStyle).length,
      target:'western woodland and training forest routes',
      decorativeOnly:true,collidersAdded:0,terrainHeightsChanged:false,
    }:null,
    flowPlan:flow, // reuse coordinates for optional uploaded model instancing
    grassMeshes,flowShrubs,stones,decorativeOnly:true,
    update(dt,frame={},player=null){
      if(Number.isFinite(frame.time))inkTime.value=frame.time;
      else if(Number.isFinite(dt))inkTime.value+=Math.max(0,Math.min(dt,.08));
      const gust=Number(frame.gust);
      if(Number.isFinite(gust))inkGust.value=Math.max(0,Math.min(1,gust));
      if(Array.isArray(frame.wind)&&frame.wind.length===2 &&
         frame.wind.every(Number.isFinite)){
        inkWind.value.set(frame.wind[0],frame.wind[1]);
      }
      // Match the original forest weather and shader clock, without altering
      // the shared material, tree motion, physics or other reserved squares.
      x40Z123Visuals?.updateWind({
        time:inkTime.value,gust:inkGust.value,
        wind:[inkWind.value.x,inkWind.value.y],
      });
      // Retain compressed blades after the player has passed. Each previous
      // contact relaxes over ~2 seconds while wind keeps moving the tips.
      const seconds=Math.max(0,Math.min(Number(dt)||0,.1));
      for(const trace of bendingTraces)trace.pressure*=Math.exp(-seconds/1.45);
      for(let i=bendingTraces.length-1;i>=0;i--)
        if(bendingTraces[i].pressure<.055)bendingTraces.splice(i,1);
      const valid=player&&Number.isFinite(player.x)&&Number.isFinite(player.z);
      if(valid){
        if(previousFoot){
          const distance=Math.hypot(player.x-previousFoot.x,player.z-previousFoot.z);
          if(distance>=.6&&distance<12){
            bendingTraces.unshift({x:previousFoot.x,z:previousFoot.z,pressure:1});
            previousFoot={x:player.x,z:player.z};
          }else if(distance>=12){
            bendingTraces.length=0;
            previousFoot={x:player.x,z:player.z};
          }
        }else previousFoot={x:player.x,z:player.z};
      }else previousFoot=null;
      bendingTraces.length=Math.min(bendingTraces.length,5);
      const active=valid?[{x:player.x,z:player.z,pressure:1},...bendingTraces]
        :bendingTraces;
      inkContacts.value.forEach((slot,i)=>{
        const p=active[i];
        if(p)slot.set(p.x,p.z,1.8,p.pressure);
        else slot.set(99999,99999,1,0);
      });
    },
  };
}
