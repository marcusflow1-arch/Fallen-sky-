// Clone-only Living Perspectives landmark — authoritative Wolfveil-local metres.
// World Game 3D translates +70m on Z. This is the same terrain height consumed
// by the terrain BVH and ground-tracing gameplay; do not add a false floor.
export const VORTEX_LAKE=Object.freeze({
  id:'wolfveil_living_perspectives_vortex',
  name:'The World Beneath the World',
  centerX:205, centerZ:320, worldOffsetZ:70,
  waterY:82.6, radiusX:43, radiusZ:37,
  mouthX:215, mouthZ:358, mouthWidth:32, mouthHeight:26,
  insideZ:388, insideX:217,
  portalRadius:5.9,
  safeReturn:Object.freeze({x:205,z:320+70-34,y:84.5}),
  dungeon:'lunar-cave',
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
export function vortexLakeNormalizedRadius(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return Infinity;
  return Math.hypot((x-VORTEX_LAKE.centerX)/VORTEX_LAKE.radiusX,
    (z-VORTEX_LAKE.centerZ)/VORTEX_LAKE.radiusZ);
}
// Basin is connected to the original highland river control point [205,320,83].
// Grading starts below the water and returns smoothly to the authored slope;
// outside the narrow mountain mouth the whole original terrain is unchanged.
export function gradeVortexLakeBasin(x,z,originalHeight){
  if(![x,z,originalHeight].every(Number.isFinite))return originalHeight;
  const lake=vortexLakeNormalizedRadius(x,z);
  let result=originalHeight;
  if(lake<1.31){
    const depth=4.1+1.0*Math.cos(Math.min(1,lake)*Math.PI*.5);
    const lakeBed=VORTEX_LAKE.waterY-depth;
    const bankMix=smooth((lake-.78)/(.53));
    result=lakeBed*(1-bankMix)+result*bankMix;
  }
  // The mountain foot has a broad daylight-height arch, and water continues
  // underneath it to a short open cave bay. Carve a 30m-wide physical mouth,
  // feathering the grade into the original mountains on both sides.
  const zIn=smooth((z-344)/13),zOut=1-smooth((z-396)/15);
  const lateral=(x-(VORTEX_LAKE.mouthX+(z-358)*.10));
  const side=1-smooth((Math.abs(lateral)-11)/12);
  const cut=zIn*zOut*side;
  if(cut>0){
    const floor=VORTEX_LAKE.waterY-3.2;
    result=result*(1-cut)+Math.min(result,floor)*cut;
  }
  return result;
}
// Central lake and open under-mountain water cannot host terrestrial trees
// or the game's existing GPU meadow. Separate from the wider shore grade so
// grass/roots can still grow close to the waterline.
export function isVortexLakeWetSurface(x,z,margin=0){
  const wet=vortexLakeNormalizedRadius(x,z);
  if(wet<=1+Math.max(0,margin)/Math.min(
      VORTEX_LAKE.radiusX,VORTEX_LAKE.radiusZ))return true;
  if(z>=344&&z<=397){
    const mouthX=VORTEX_LAKE.mouthX+(z-358)*.10;
    if(Math.abs(x-mouthX)<13+margin)return true;
  }
  return false;
}
export function vortexLakePortalCrossing(previous,position){
  if(!position||![position.x,position.z].every(Number.isFinite))return false;
  const x=position.x-VORTEX_LAKE.centerX,z=position.z-(VORTEX_LAKE.centerZ+70);
  const inside=Math.hypot(x,z)<VORTEX_LAKE.portalRadius;
  if(!inside)return false;
  if(!previous)return false;
  const before=Math.hypot(previous.x-VORTEX_LAKE.centerX,
    previous.z-(VORTEX_LAKE.centerZ+70));
  return before>=VORTEX_LAKE.portalRadius;
}
export function vortexLakeBridgeContains(x,z){
  // A collision-registered 4.2m walkable bridge approaches the portal from S.
  return Math.abs(x-VORTEX_LAKE.centerX)<=2.1&&
    z>=VORTEX_LAKE.centerZ+70-36.5&&
    z<=VORTEX_LAKE.centerZ+70-3.5;
}
