// Combat Foundation 3.7 — deterministic Wolfveil forest placements shared by
// the live renderer and the dedicated duel worker. Pure JavaScript, no THREE.
// All generated coordinates are in the unshifted Wolfveil layout frame.
import {WOLFVEIL_ACTIVE_TOWN_BUILDINGS,WOLFVEIL_HOUSING_PLOTS,WOLFVEIL_ROUTES,
  wolfveilHeight,wolfveilDistanceToRiver} from './WolfveilLayout.js';
import {WOLFVEIL_PALACE,isInsideVillageBuildLimit} from './WolfveilPalaceLayout.mjs';
import {isVortexLakeWetSurface} from './VortexLakeLayout.mjs';
import {insideWolfveilImportedTown} from './WolfveilImportedTownLayout.mjs';
import {isInsideWolfveilFountainHomeClearance} from './WolfveilFountainHomesLayout.mjs';
import {isWolfveilWestHillsideForest,WOLFVEIL_WEST_HILLSIDE} from './WolfveilWestHillside.mjs';
const mulberry32=(seed)=>()=>{let t=seed+=0x6D2B79F5;
  t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296;};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const distanceSegment=(x,z,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};
export const clearOf=({x,z},r=8)=>{
  if(isVortexLakeWetSurface(x,z,r))return false;
  // Shared player/client and worker clearance: no trunks inside the actual
  // Luna palace facade, stair entry or near its perimeter.
  const palace=WOLFVEIL_PALACE;
  if(Math.abs(x-palace.x)<palace.width/2+r+5 &&
     Math.abs(z-palace.z)<palace.depth/2+r+8)return false;
  if(WOLFVEIL_ACTIVE_TOWN_BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*.5+r&&Math.abs(z-b.z)<b.d*.5+r))return false;
  // No invisible exclusions around retired 4-home pads or editor-only lots.
  if(wolfveilDistanceToRiver(x,z)<16+r)return false;
  if(insideWolfveilImportedTown(x,z,r))return false; // no trunks inside the assembled town
  for(const route of WOLFVEIL_ROUTES)for(let i=0;i<route.points.length-1;i++)
    if(distanceSegment(x,z,route.points[i],route.points[i+1])<route.width*.5+r) return false;
  return true;
};
// Authored procedural trees have been removed from Game 3D rendering.
// Preserve their original *exclusion positions only* when deriving the 24
// user-uploaded FBX anchors: removing old cedars must not unexpectedly move
// the owner's remaining imported trees across existing workstream squares.
// Legacy housing exclusions affect these preserved anchor seeds ONLY; they
// are not walk blockers, vegetation exclusions or physical game objects.
const legacyTreeClearOf=({x,z},r)=>{
  if(!clearOf({x,z},r))return false;
  if(isInsideWolfveilFountainHomeClearance(x,z,r))return false;
  return !WOLFVEIL_HOUSING_PLOTS.some(p=>
    Math.abs(x-p.x)<p.w*.5+r&&Math.abs(z-p.z)<p.d*.5+r);
};
export function wolfveilTreePlacements(){
  const rand=mulberry32(81019),legacyTrees=[],trees=[];
  const oldRanges=[
    {x0:-515,x1:-182,z0:-240,z1:340,count:240,type:'cedar'},
    {x0:190,x1:495,z0:-280,z1:305,count:130,type:'pine'},
    {x0:-360,x1:360,z0:-265,z1:300,count:70,type:'maple'},
    {x0:-415,x1:-280,z0:-260,z1:120,count:40,type:'bamboo'},
  ];
  for(const range of oldRanges){
    for(let tries=0,produced=0;tries<range.count*15&&produced<range.count;tries++){
      const x=range.x0+rand()*(range.x1-range.x0);
      const z=range.z0+rand()*(range.z1-range.z0);
      if(isInsideVillageBuildLimit(x,z)||isWolfveilWestHillsideForest(x,z))continue;
      if(!legacyTreeClearOf({x,z},range.type==='bamboo'?2.5:5))continue;
      if(legacyTrees.some(t=>Math.hypot(t.x-x,t.z-z)<
         (range.type==='bamboo'?2.4:5.9)))continue;
      // Only X/Z are held; NO old procedural trees enter visible placements.
      legacyTrees.push({x,z,kind:range.type});
      // Keep random-stream draw counts identical to the original planner.
      rand(); // height variation
      rand(); // rotation
      rand(); // seed
      produced++;
    }
  }
  // Sparse intentional replacement grove; every anchor is shared with
  // the server's trunk collider map, and the FBX uses these SAME anchors.
  const grove=WOLFVEIL_WEST_HILLSIDE,ancientRand=mulberry32(82077);
  const ancientTrees=[];
  for(let tries=0;tries<4200&&ancientTrees.length<24;tries++){
    const x=grove.forestAnchorMinX+ancientRand()*(grove.forestAnchorMaxX-grove.forestAnchorMinX);
    const z=grove.forestAnchorMinZ+ancientRand()*(grove.forestAnchorMaxZ-grove.forestAnchorMinZ);
    if(!isWolfveilWestHillsideForest(x,z)||!legacyTreeClearOf({x,z},6))continue;
    if(ancientTrees.some(t=>Math.hypot(t.x-x,t.z-z)<19))continue;
    if(legacyTrees.some(t=>Math.hypot(t.x-x,t.z-z)<11))continue;
    const t={x,z,y:wolfveilHeight(x,z),kind:'ancient',
      height:14+ancientRand()*5,rot:ancientRand()*Math.PI*2,
      seed:Math.floor(ancientRand()*100000)};
    ancientTrees.push(t);trees.push(t);
  }
  return trees;
}

// Shared deterministic placements for the user's imported elm GLB.
// This exact list is consumed by the renderer and server, so a visible elm
// never has a different (or missing) trunk collider in Game 3D.
export function wolfveilNativeElmPlacements(){
  const result=[];
  for(let i=0;i<28;i++){
    const a=(i/28)*Math.PI*2,r=118+(i%4)*9;
    const x=Math.cos(a)*r,z=-70+Math.sin(a)*r;
    if(!legacyTreeClearOf({x,z},4.2)||isWolfveilWestHillsideForest(x,z))continue;
    result.push({x,z,y:wolfveilHeight(x,z),near:true,
      species:i%2?'oak':'birch',seed:1000+i,kind:'native_elm',
      height:15+(i%4)*1.9});
  }
  return result;
}

/** A user-owned FBX tree or GLB elm is a solid trunk for local and worker travel.
 * Approximate trunk cylinders (not leaf-canopy collisions) keep navigation usable.
 */
export function wolfveilForestTrunkColliders(){
  return [
    ...wolfveilTreePlacements().map(t=>({x:t.x,z:t.z,
      radius:.90,kind:'owner_fbx_ancient'})),
    ...wolfveilNativeElmPlacements().map(t=>({x:t.x,z:t.z,
      radius:Math.min(1.05,.68+t.height*.014),kind:'owner_glb_elm'})),
  ];
}