// Clone: deterministic input-to-shot charge. Hold indefinitely; full strength
// is reached at 1.2s and NEVER grows further. A partial shot remains valid.
export const BOW_FULL_CHARGE_MS = 1200;
export const BOW_HALF_CHARGE_MS = 700;
export const BOW_CHARGE_MAX_MULTIPLIER = 2;
export const BOW_HEADSHOT_MULTIPLIER = 2;

// The owner explicitly specified 0.7s ~= 50%, 1.2s = 100%.
// Two linear segments honor those anchors without charge jumping on release.
export function getBowChargeStatus(heldMs=0) {
  const ms=Math.max(0,Number.isFinite(Number(heldMs))?Number(heldMs):0);
  const progress=ms<=BOW_HALF_CHARGE_MS
    ? .5*ms/BOW_HALF_CHARGE_MS
    : .5+.5*Math.min(1,(ms-BOW_HALF_CHARGE_MS)/(BOW_FULL_CHARGE_MS-BOW_HALF_CHARGE_MS));
  const percent=Math.min(100,Math.max(0,Math.round(progress*100)));
  return {
    heldMs: ms, progress, percent, full: ms>=BOW_FULL_CHARGE_MS,
    multiplier:1+progress*(BOW_CHARGE_MAX_MULTIPLIER-1),
  };
}
// Damage scales only AFTER the canonical hit/crit/dodge/defense result.
// A missed arrow never invokes this method to create phantom damage.
// PvP remains authoritative; client inputs cannot declare verified headshots.
export function applyBowImpactDamage(resolvedDamage, {
  chargeMultiplier=1, headshot=false, pve=true,
}={}) {
  const damage=Math.max(0,Math.round(Number(resolvedDamage)||0));
  if(damage===0)return 0;
  if(!pve)return damage;
  const charge=Math.min(BOW_CHARGE_MAX_MULTIPLIER,Math.max(1,Number(chargeMultiplier)||1));
  return Math.max(1,Math.round(damage*charge*(headshot?BOW_HEADSHOT_MULTIPLIER:1)));
}

// A ray must PHYSICALLY intersect the hostile's body volume for a headshot:
// a near-centre lock-on grace cannot upgrade a non-head body hit.
// Head zone is the upper ~22% of the visible actor hitbox.
export function isBowHeadshotPoint(point, bounds, rayHit=false) {
  if(!rayHit||!point||!bounds?.min||!bounds?.max)return false;
  const min=Number(bounds.min.y),max=Number(bounds.max.y),y=Number(point.y);
  if(![min,max,y].every(Number.isFinite)||max-min<.2)return false;
  return y>=min+(max-min)*.78 && y<=max+.12;
}
