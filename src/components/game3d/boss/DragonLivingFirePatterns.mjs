// Three deterministic, readable dragon preview patterns. Damage uses the
// existing Quarry Dragon applyPlayerDamage callback (not a new server reward).
// A telegraph always precedes an active hit window.
export const DRAGON_FIRE_PATTERNS=Object.freeze({
  rain:Object.freeze({warning:1.25,active:2.1,recovery:.85,radius:9,damage:16}),
  breath:Object.freeze({warning:1.05,active:1.8,recovery:1.05,radius:3.2,damage:21}),
  cyclone:Object.freeze({warning:1.5,active:2.0,recovery:1.3,radius:6.2,damage:27}),
});
export function pointSegmentDistance(px,pz,ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/len));
  return Math.hypot(px-ax-t*dx,pz-az-t*dz);
}
export function isDragonFireHit(kind,player,target,origin){
  if(!player||!target||!DRAGON_FIRE_PATTERNS[kind])return false;
  if(kind==='breath')return !!origin&&pointSegmentDistance(
    player.x,player.z,origin.x,origin.z,target.x,target.z)
      <=DRAGON_FIRE_PATTERNS.breath.radius;
  return Math.hypot(player.x-target.x,player.z-target.z)
    <=DRAGON_FIRE_PATTERNS[kind].radius;
}
export function dragonFirePhase(kind,elapsed){
  const p=DRAGON_FIRE_PATTERNS[kind];
  if(!p)return 'invalid';
  if(elapsed<p.warning)return 'telegraph';
  if(elapsed<p.warning+p.active)return 'active';
  if(elapsed<p.warning+p.active+p.recovery)return 'recover';
  return 'done';
}
