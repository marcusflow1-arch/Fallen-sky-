// Combat Foundation 3.4: signed-ticket, worker-owned Wolfveil static map collision.
// Source geometry is shared with the actual GameWorld3D Wolfveil renderer.
// The current client still adds dynamic GLB interiors, stairs, bridges and props:
// these are NOT represented here. Never enable this for ranked play.
import { WOLFVEIL_ACTIVE_TOWN_BUILDINGS, WOLFVEIL_SITES, WOLFVEIL_BRIDGES, wolfveilHeight, wolfveilNaturalHeight, wolfveilBridgeBankTerrainGrade, WOLFVEIL_RIVER } from '../../src/components/game3d/wolfveil/WolfveilLayout.js';
import { WOLFVEIL_PALACE } from '../../src/components/game3d/wolfveil/WolfveilPalaceLayout.mjs';
import {gradeWolfveilRiverbank,sampleWolfveilRiverbank} from '../../src/components/game3d/wolfveil/WolfveilRiverBanks.mjs';
import { WOLFVEIL_PALACE_GRADE } from '../../src/components/game3d/wolfveil/WolfveilPalaceGround.mjs';
import { DUEL_BODY_RADIUS } from './arenaCollision.mjs';
import { createWolfveilTerrainSurfaceSampler } from '../../src/components/game3d/wolfveil/WolfveilTerrainSurfaceSampler.mjs';
import {
  planWolfveilBridgeDeck,projectWolfveilBridgePoint,
} from '../../src/components/game3d/wolfveil/WolfveilBridgeProfile.mjs';
import { wolfveilForestTrunkColliders } from '../../src/components/game3d/wolfveil/WolfveilForestLayout.js';
import { createHash } from 'node:crypto';

export const WOLFVEIL_MAP_ID='wolfveil-v1';
export const WOLFVEIL_RENDER_OFFSET_Z=70; // GameWorld3D createWolfveilVillage(originAtMarket:true)
const PLAYABLE_HALF_SPAN=530; // 1100m rendered terrain minus an edge safety margin
const STEP_SIZE=.18;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const rect=(x0,x1,z0,z1)=>Object.freeze({x0,x1,z0,z1});
const obstacles=[];
for(const b of WOLFVEIL_ACTIVE_TOWN_BUILDINGS){
  const front=b.z-b.d/2+WOLFVEIL_RENDER_OFFSET_Z;
  const back=b.z+b.d/2+WOLFVEIL_RENDER_OFFSET_Z;
  const left=b.x-b.w/2,right=b.x+b.w/2;
  if(b.kind!=='residence'){
    // The live client currently treats non-residential interiors as solid.
    obstacles.push(rect(left,right,front,back));
  }else{
    // The current procedural residences have rear/side walls and a 2.5m
    // center opening facing -Z. These are the footprint barriers, not mesh.
    const halfDoor=1.25,thickness=.16;
    obstacles.push(rect(left,left+thickness,front,back));
    obstacles.push(rect(right-thickness,right,front,back));
    obstacles.push(rect(left,right,back-thickness,back));
    obstacles.push(rect(left,b.x-halfDoor,front,front+thickness));
    obstacles.push(rect(b.x+halfDoor,right,front,front+thickness));
  }
}
// Former fountain-house concept meshes are retired from Game 3D.
// No invisible rectangle may remain where those buildings were removed.
// The archived village houses no longer exist in this active map.
 // The only new building is the real Luna-palace shell, with a 6.5m
 // SOUTH-facing entrance; walls share the rendered 53m x 33m footprint.
{
  const b=WOLFVEIL_PALACE,thickness=.32;
  const x0=b.x-b.width/2,x1=b.x+b.width/2;
  const z0=b.z-b.depth/2+WOLFVEIL_RENDER_OFFSET_Z;
  const z1=b.z+b.depth/2+WOLFVEIL_RENDER_OFFSET_Z;
  obstacles.push(rect(x0,x0+thickness,z0,z1));
  obstacles.push(rect(x1-thickness,x1,z0,z1));
  obstacles.push(rect(x0,x1,z1-thickness,z1));
  obstacles.push(rect(x0,b.x-b.halfDoor,z0,z0+thickness));
  obstacles.push(rect(b.x+b.halfDoor,x1,z0,z0+thickness));
}
// Removed all eight Game 3D vendor shelters/tables. Do NOT retain hidden
// collision footprints: the live player path must be clear where the visual
// shelter was deleted. Game 1 may still render its separate default stalls.
// The fingerprint below derives from the updated actual obstacle list.
// The old fountain is replaced by the imported town's central tree;
// retain the same radius around the central trunk so movement stays safe.
// Per-building mesh collision remains a separate gameplay QA task.
const circles=[Object.freeze({x:WOLFVEIL_SITES.wolfFountain.x,
  z:WOLFVEIL_SITES.wolfFountain.z+WOLFVEIL_RENDER_OFFSET_Z,radius:4.47}),
  // Static, authored tree trunks only. All terrain + tree placements are
  // deterministic and shared with WolfveilNature's visual renderer.
  ...wolfveilForestTrunkColliders().map(t=>Object.freeze({
    x:t.x,z:t.z+WOLFVEIL_RENDER_OFFSET_Z,radius:t.radius,
  })),
];
// The same source-frame bridge profiles are sampled by the renderer and
// signed worker. This is not full mesh-level PvP, stairs or mount physics.
const bridgeSurface=createWolfveilTerrainSurfaceSampler({span:1100,segments:310});
const bridgeProfiles=WOLFVEIL_BRIDGES.map(b=>
  planWolfveilBridgeDeck(b,bridgeSurface));
const clamp01=t=>Math.max(0,Math.min(1,t));
const bridgeAt=(x,localZ)=>{
  for(const deck of bridgeProfiles){
    const p=projectWolfveilBridgePoint(deck.bridge,x,localZ);
    if(p.t<0||p.t>1||
       Math.abs(p.lateral)>deck.width/2-DUEL_BODY_RADIUS)return null;
    return {deck,t:p.t,lateral:p.lateral};
  }
  return null;
};
const bridgeRailBlocked=(x,localZ)=>{
  for(const deck of bridgeProfiles){
    const p=projectWolfveilBridgePoint(deck.bridge,x,localZ);
    if(p.t<.03||p.t>.97)continue;
    const side=Math.abs(p.lateral);
    if(side>deck.width/2-DUEL_BODY_RADIUS-1e-8&&
       side<deck.width/2+DUEL_BODY_RADIUS+1e-8)return true;
  }
  return false;
};
export const WOLFVEIL_FOREST_TRUNK_COUNT=circles.length-1;
export const WOLFVEIL_STATIC_OBSTACLE_COUNT=obstacles.length+circles.length;
// Derive the collision revision from the actual checked-in geometry and
// height function, rather than trusting a client-supplied arbitrary version.
export const WOLFVEIL_MAP_FINGERPRINT=createHash('sha256').update(JSON.stringify({
  id:WOLFVEIL_MAP_ID,offset:WOLFVEIL_RENDER_OFFSET_Z,
  radius:DUEL_BODY_RADIUS,span:PLAYABLE_HALF_SPAN,step:STEP_SIZE,
  obstacles,circles,terrainSource:String(wolfveilHeight),
  terrainNaturalSource:String(wolfveilNaturalHeight),
  // Changing bank shape or authored waterway must invalidate existing
  // dedicated duel map checkpoints rather than silently move their terrain.
  riverProfile:WOLFVEIL_RIVER,
  riverbankSource:String(gradeWolfveilRiverbank),
  riverSampleSource:String(sampleWolfveilRiverbank),
  palaceGrade:WOLFVEIL_PALACE_GRADE,
  bridgeLayout:WOLFVEIL_BRIDGES,
  bridgeProfileSource:String(planWolfveilBridgeDeck),
  bridgeRockClearanceRevision:'play_bank_anchored_bridge_v2_graded_terrain',
  bridgeBankTerrainGradeRevision:wolfveilBridgeBankTerrainGrade.revision,
  bridgeBankTerrainGradeSource:String(wolfveilBridgeBankTerrainGrade),
  bridgeBankTerrainLandingData:wolfveilBridgeBankTerrainGrade.bearings,
  removedLegacyFountainHousesRevision:'game3d-only-mansion-v1',
  townPlateauGradeRevision:'imported-owner-town-80-tiles-130x141m-v1',
})).digest('hex');
const insideRect=(x,z,r,b)=>{
  const closeX=Math.max(b.x0,Math.min(x,b.x1));
  const closeZ=Math.max(b.z0,Math.min(z,b.z1));
  return Math.hypot(x-closeX,z-closeZ)<r-1e-8;
};
const originValid=o=>o&&finite(o.x)&&finite(o.z)&&
  Math.abs(o.x)<=100000&&Math.abs(o.z)<=100000;

export function createWolfveilMapCollision(){
  const world=(local,origin)=>({
    x:origin.x+local.x,z:origin.z+local.z,
  });
  const blockedWorld=(x,z)=>{
    if(!finite(x)||!finite(z)||Math.abs(x)>PLAYABLE_HALF_SPAN-DUEL_BODY_RADIUS||
       Math.abs(z-WOLFVEIL_RENDER_OFFSET_Z)>PLAYABLE_HALF_SPAN-DUEL_BODY_RADIUS) return true;
    return bridgeRailBlocked(x,z-WOLFVEIL_RENDER_OFFSET_Z) ||
      obstacles.some(b=>insideRect(x,z,DUEL_BODY_RADIUS,b)) ||
      circles.some(c=>Math.hypot(x-c.x,z-c.z)<c.radius+DUEL_BODY_RADIUS-1e-8);
  };
  const height=(local,origin)=>{
    if(!originValid(origin)||!finite(local?.x)||!finite(local?.z))return null;
    const p=world(local,origin);
    if(blockedWorld(p.x,p.z))return null;
    const localZ=p.z-WOLFVEIL_RENDER_OFFSET_Z;
    const terrain=wolfveilHeight(p.x,localZ);
    if(!finite(terrain))return null;
    const passage=bridgeAt(p.x,localZ);
    if(!passage)return terrain;
    // Ease the first and last 0.65m from the terrain shore onto the deck
    // so the dedicated worker never sees an instantaneous 16cm step.
    const {deck,t,lateral}=passage;
    const approach=clamp01(Math.min(t,1-t)*deck.len/.65);
    return terrain*(1-approach)+deck.heightAt(t,lateral)*approach;
  };
  const valid=(local,origin)=>height(local,origin)!==null;
  const move=(from,to,origin)=>{
    if(!valid(from,origin))return {...from};
    const dx=to.x-from.x,dz=to.z-from.z;
    if(!finite(dx)||!finite(dz))return {...from};
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/STEP_SIZE));
    let at={...from};
    const attempt=(candidate)=>{
      const y0=height(at,origin),y1=height(candidate,origin);
      if(y1===null||y0===null)return false;
      const horizontal=Math.hypot(candidate.x-at.x,candidate.z-at.z);
      // Height is server-sampled from the shared terrain formula, not from
      // any client model Y. This stops foot-scale cliff/slope jumps.
      return Math.abs(y1-y0)<=Math.max(.10,horizontal*.95);
    };
    for(let i=1;i<=steps;i++){
      const goal={x:at.x+dx/steps,z:at.z+dz/steps};
      if(attempt(goal)){at=goal;continue;}
      // Slide on unobstructed axes; preserves contact instead of snapping
      // the character through walls or replacing their position with input.
      const xOnly={x:goal.x,z:at.z};
      if(attempt(xOnly))at=xOnly;
      // Recompute against the updated X so a successful Z slide does not
      // undo the other axis or jump to an earlier, unswept position.
      const zOnly={x:at.x,z:at.z+dz/steps};
      if(attempt(zOnly))at=zOnly;
    }
    return at;
  };
  const canStrike=(a,b,origin)=>{
    if(!valid(a,origin)||!valid(b,origin))return false;
    const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
    const steps=Math.max(1,Math.ceil(dist/STEP_SIZE));
    const ya=height(a,origin),yb=height(b,origin);
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const p={x:a.x+dx*t,z:a.z+dz*t};
      const w=world(p,origin);
      if(blockedWorld(w.x,w.z))return false;
      // A ridge taller than both standing actors occludes the strike.
      const terrain=wolfveilHeight(w.x,w.z-WOLFVEIL_RENDER_OFFSET_Z);
      if(terrain>Math.max(ya,yb)+1.6)return false;
    }
    return true;
  };
  return Object.freeze({id:WOLFVEIL_MAP_ID,fingerprint:WOLFVEIL_MAP_FINGERPRINT,valid,height,move,canStrike});
}

export function configuredGame3DMapCollision(mapId){
  if(!mapId)return null; // existing 3.3 flat-arena behavior by default
  if(mapId!==WOLFVEIL_MAP_ID)throw Error('Unsupported GAME3D_COMBAT_MAP_ID');
  return createWolfveilMapCollision();
}
