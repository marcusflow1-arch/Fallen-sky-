// The user's assembled Blender town, on the canonical Wolfveil heightfield.
// Positions are local Wolfveil coordinates; Game 3D renders them at +70m Z.
export const WOLFVEIL_IMPORTED_TOWN=Object.freeze({
 id:'wolfveil-assembled-town',name:'Wolfveil Town Plaza',
 x:0,z:-70,width:130,depth:141,blendMeters:38,
 floorSourceY:0.690998,floorLiftMeters:0.07,
});
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=t=>{const u=clamp01(t);return u*u*(3-2*u);};
export const WOLFVEIL_IMPORTED_TOWN_FLOOR_Y=80*smooth(155/445)+.3;
export const WOLFVEIL_PLAYER_TOWN_SPAWN=Object.freeze({x:-12,z:12});
export function insideWolfveilImportedTown(x,z,margin=0){
 const p=WOLFVEIL_IMPORTED_TOWN;
 return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x-p.x)<=p.width/2+margin&&Math.abs(z-p.z)<=p.depth/2+margin;
}
export function gradeWolfveilImportedTown(x,z,previousHeight){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(previousHeight))return previousHeight;
 const p=WOLFVEIL_IMPORTED_TOWN;
 const dx=Math.max(0,Math.abs(x-p.x)-p.width/2);
 const dz=Math.max(0,Math.abs(z-p.z)-p.depth/2);
 const distance=Math.hypot(dx,dz);
 if(distance>=p.blendMeters)return previousHeight;
 const naturalWeight=smooth(distance/p.blendMeters);
 return WOLFVEIL_IMPORTED_TOWN_FLOOR_Y*(1-naturalWeight)+previousHeight*naturalWeight;
}
