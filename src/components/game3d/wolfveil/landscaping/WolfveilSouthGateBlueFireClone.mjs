// Clone-only integration harness for the shared blue-fire path recipe.
// No GameWorld3D caller enables this by default; only explicitly supplied
// preview/certified exact squares are considered. Never add a second floor.
import {WOLFVEIL_SOUTH_GATE_FIRE_DESIGN,planWolfveilSouthGateBlueFire,
  stageWolfveilSouthGateBlueFire} from './WolfveilSouthGateBlueFire.mjs';
import {selectCloneBlueFireSquares} from './WolfveilCloneBlueFireSquareGate.mjs';
import {createWolfveilTerrainSurfaceSampler} from '../WolfveilTerrainSurfaceSampler.mjs';
import {clearOf,wolfveilTreePlacements} from '../WolfveilForestLayout.js';
import {WOLFVEIL_SW_QUALITY,wolfveilIsProtectedSWTile} from '../WolfveilSWQuarterQuality.mjs';
import {isWolfveilCaveMouthCutout} from '../WolfveilCaveLayout.mjs';

const inactive=(reason,eligible=0,requested=0)=>({
  mounted:false,reason,
  status:()=>({mounted:false,reason,eligibleSquares:eligible,requestedSquares:requested,
    fireInstances:0,grassInstances:0,reveal:0}),
  update(){},dispose(){},
});
const safe=v=>Number.isFinite(v)?v:null;

/** Opt-in: attach only to the existing, once-translated Wolfveil world.group.
 * config.mode 'review-preview' is for QA of candidate squares only; default
 * 'certified' requires ownerAccepted + independentQA100 for EVERY square.
 * Both modes always exclude the hard protected LAND-WS rectangles.
 */
export function mountCloneSouthGateBlueFire(THREE,world,config={},{
  offsetZ=70,terrainSpan=1100,terrainSegments=310,
}={}){
  const squares=config?.squares,requested=Array.isArray(squares)?squares.length:0;
  if(!THREE||!world?.group?.add||!Array.isArray(squares)||!squares.length)
    return inactive('no explicitly selected blue-fire squares',0,requested);
  if(world.group.position.z!==offsetZ)
    throw Error('Clone blue fire must use the existing once-translated world.group');
  const eligible=selectCloneBlueFireSquares({
    squares,protectedTiles:WOLFVEIL_SW_QUALITY.protectedTiles,
    mode:config.mode??'certified',
  });
  if(!eligible.length)return inactive('no verified unreserved 5m cells',0,requested);
  const surface=createWolfveilTerrainSurfaceSampler({
    span:terrainSpan,segments:terrainSegments,
  });
  const trees=wolfveilTreePlacements();
  const heightAt=(x,z)=>safe(surface(x,z));
  const clearAt=(x,z,kind)=>{
    if(Math.abs(x)>terrainSpan/2-2||Math.abs(z)>terrainSpan/2-2)return false;
    if(wolfveilIsProtectedSWTile(x,z,1.5)||isWolfveilCaveMouthCutout(x,z))return false;
    if(!clearOf({x,z},kind==='flame'?1.2:.3))return false;
    for(const t of trees){
      const radius=Math.max(1.7,Number(t.radius)||2)+1.25;
      if(Math.hypot(t.x-x,t.z-z)<radius)return false;
    }
    // Prevent flame and grass tips floating through a steep hillside.
    const h=heightAt(x,z),a=heightAt(x+1,z),b=heightAt(x-1,z),
      c=heightAt(x,z+1),d=heightAt(x,z-1);
    if([h,a,b,c,d].some(y=>y===null))return false;
    return Math.hypot((a-b)*.5,(c-d)*.5)<.28;
  };
  const plan=planWolfveilSouthGateBlueFire({
    approvedSquares:eligible,heightAt,clearAt,
  });
  if(!plan.flames.length&&!plan.grass.length)
    return inactive('all approved positions failed terrain/clearance',eligible.length,requested);
  const visual=stageWolfveilSouthGateBlueFire(THREE,plan,{game3D:true});
  visual.group.name='Game3DClone_BlueFireSouthGate_VisualOnly';
  visual.group.userData={decorativeOnly:true,nonCollider:true};
  world.group.add(visual.group);
  let triggerAt=null,reveal=0;
  return {
    mounted:true,encounterAnchor:plan.encounterAnchor,
    status:()=>({mounted:true,eligibleSquares:eligible.length,requestedSquares:requested,
      fireInstances:visual.counts.flames,grassInstances:visual.counts.grass,
      drawCalls:visual.counts.draws,started:triggerAt!==null,reveal}),
    update({elapsed=0,wind=.35,playerPosition=null}={}){
      // Player crosses the southern gate, world Z=-155 with original +70.
      const localZ=safe(playerPosition?.z-offsetZ),x=safe(playerPosition?.x);
      if(triggerAt===null&&x!==null&&localZ!==null&&
        Math.abs(x)<=12&&localZ<=WOLFVEIL_SOUTH_GATE_FIRE_DESIGN.gate.z-2)
        triggerAt=Math.max(0,elapsed);
      reveal=triggerAt===null?0:Math.min(1,Math.max(0,elapsed-triggerAt)/
        WOLFVEIL_SOUTH_GATE_FIRE_DESIGN.revealSeconds);
      visual.update({elapsed,wind,reveal});
    },
    dispose(){visual.dispose();},
  };
}
