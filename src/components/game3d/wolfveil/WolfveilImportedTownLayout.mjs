// The user's assembled Blender town, on the canonical Wolfveil heightfield.
// Positions are local Wolfveil coordinates; Game 3D renders them at +70m Z.
// Its original size: 130 x 141m, centred on the old market.
export const WOLFVEIL_IMPORTED_TOWN=Object.freeze({
 id:'wolfveil-assembled-town',name:'Wolfveil Town Plaza',
 x:0,z:-70,width:130,depth:141,blendMeters:38,
 floorSourceY:0.690998,floorLiftMeters:0.025, // rest town houses/pavers close to the actual terrain
 // Size of the GLB in its own units; the model is centred on its origin.
 sourceWidth:10.423466,sourceDepth:11.330666,
});
/** World metres per model unit. */
export const WOLFVEIL_IMPORTED_TOWN_SCALE=Math.min(
 WOLFVEIL_IMPORTED_TOWN.width/WOLFVEIL_IMPORTED_TOWN.sourceWidth,
 WOLFVEIL_IMPORTED_TOWN.depth/WOLFVEIL_IMPORTED_TOWN.sourceDepth);
/** A point in the model's own units, as Game 3D render coordinates. */
export function wolfveilImportedTownPoint(sourceX,sourceZ){
 const p=WOLFVEIL_IMPORTED_TOWN,s=WOLFVEIL_IMPORTED_TOWN_SCALE;
 return {x:p.x+sourceX*s,z:p.z+70+sourceZ*s};
}
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=t=>{const u=clamp01(t);return u*u*(3-2*u);};
export const WOLFVEIL_IMPORTED_TOWN_FLOOR_Y=80*smooth(155/445)+.3;
// The raised round plaza. The model's own blossom tree is removed (blossom
// inside sourceRadius, trunk and branches inside trunkSourceRadius, which
// stops short of the canal-side posts) and the owner's ancient tree stands
// in its place, rooted on the plaza paving (model height .77).
export const WOLFVEIL_IMPORTED_TOWN_TREE=Object.freeze({
 ...wolfveilImportedTownPoint(-.63,-.02),
 y:WOLFVEIL_IMPORTED_TOWN_FLOOR_Y+WOLFVEIL_IMPORTED_TOWN.floorLiftMeters-.2+
   (.77-WOLFVEIL_IMPORTED_TOWN.floorSourceY)*WOLFVEIL_IMPORTED_TOWN_SCALE,
 sourceX:-.63,sourceZ:-.02,sourceRadius:.74,trunkSourceRadius:.47,
 // About the size of the tree it replaces; radius is the trunk and its roots.
 radius:2.4,height:14,maxWidth:14,
});
// Canal water lies 5cm above the lawn (model height .7042) instead of
// standing half a metre proud of it. Any lower and the lawn hides it.
export const WOLFVEIL_IMPORTED_TOWN_WATER_SOURCE_Y=.708;
// Render coordinates, each checked against the baked collision: open,
// reachable ground with at least 4m clear on every side.
export const WOLFVEIL_PLAYER_TOWN_SPAWN=Object.freeze({x:-7,z:8});
// Quest givers by id: the first one greets new players on the plaza, the
// rest stand on the lawns of the four quarters of the town.
export const WOLFVEIL_TOWN_QUEST_NPC_SPOTS=Object.freeze({
 archer_lyra:Object.freeze({x:-4,z:10}),
 archer_vex:Object.freeze({x:-32,z:-52}),
 archer_kira:Object.freeze({x:28,z:-45}),
 archer_noor:Object.freeze({x:-32,z:39}),
 archer_zephyr:Object.freeze({x:27,z:45}),
});
/** Where a quest giver stands and faces: around the town in Wolfveil, its own spot elsewhere. */
export function wolfveilQuestNpcSpot(region,npc){
 const spot=region==='wolfveil'?WOLFVEIL_TOWN_QUEST_NPC_SPOTS[npc.id]:null;
 if(!spot)return {x:npc.pos[0],z:npc.pos[2],facing:Math.atan2(-npc.pos[0],-npc.pos[2])};
 return {x:spot.x,z:spot.z,facing:Math.atan2(WOLFVEIL_PLAYER_TOWN_SPAWN.x-spot.x,WOLFVEIL_PLAYER_TOWN_SPAWN.z-spot.z)};
}
export function insideWolfveilImportedTown(x,z,margin=0){
 const p=WOLFVEIL_IMPORTED_TOWN;
 return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x-p.x)<=p.width/2+margin&&Math.abs(z-p.z)<=p.depth/2+margin;
}
export function gradeWolfveilImportedTown(x,z,previousHeight){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(previousHeight))return previousHeight;
 const p=WOLFVEIL_IMPORTED_TOWN;
 // The level ground runs 4m past the model so the terrain never pokes up
 // through the outermost tiles.
 const dx=Math.max(0,Math.abs(x-p.x)-p.width/2-4);
 const dz=Math.max(0,Math.abs(z-p.z)-p.depth/2-4);
 const distance=Math.hypot(dx,dz);
 if(distance>=p.blendMeters)return previousHeight;
 const naturalWeight=smooth(distance/p.blendMeters);
 return WOLFVEIL_IMPORTED_TOWN_FLOOR_Y*(1-naturalWeight)+previousHeight*naturalWeight;
}