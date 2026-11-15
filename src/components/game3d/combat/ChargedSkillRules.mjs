// Combat Foundation 2.5 — deliberately small combat vocabulary.
// Max mastery unlocks an OPTIONAL one-second hold for singles and 3-hit skills.
// The bonus is a real damage multiplier (not a guaranteed critical/lethal hit).
export const CHARGE_HOLD_MS = 1200; // default; individual skills can override
export const CHARGE_PERCENT_STEP = 10;
export const CHARGE_DAMAGE_MULTIPLIER = 1.20;
export const FINISHER_CHAIN_LEAD_MS = 340;
export const FINISHER_CHAIN_GRACE_MS = 180;
export const CHAIN_SINGLE_DELAY_MS = 80;

// Archetypes require an EXPLICIT configured specialization; the current
// numbered factions do not encode geography or assassin/samurai classes.
export const CHARGE_SPECIALIZATIONS = Object.freeze({
  standard: Object.freeze({ powerMultiplier: 1.20, critBonusPct: 0, fatalBonusPct: 0 }),
  desert: Object.freeze({ powerMultiplier: 1.20, critBonusPct: 0, fatalBonusPct: 0 }),
  assassin: Object.freeze({ powerMultiplier: 1.00, critBonusPct: 10, fatalBonusPct: 0 }),
  samurai: Object.freeze({ powerMultiplier: 1.00, critBonusPct: 0, fatalBonusPct: 10 }),
});
export function getChargeSpecialization(id) {
  return CHARGE_SPECIALIZATIONS[id] || CHARGE_SPECIALIZATIONS.standard;
}
export function skillCombatFamily(skill) {
  if (!skill || skill.skill_type !== 'ACTIVE_ATTACK') return null;
  if (Number(skill.aoe_radius || 0) > 0 ||
      ['aoe', 'strong_aoe'].includes(skill.axe_pattern)) return 'aoe';
  if (Number(skill.hit_count) === 1 && skill.cast_type === 'single_hit') return 'single';
  if (Number(skill.hit_count) === 3 &&
      ['multi_hit_sequential', 'multi_hit_burst'].includes(skill.cast_type)) return 'three_hit';
  return 'other_multi';
}
export function isMaxMasteryChargeUnlocked(skill, level) {
  return ['single', 'three_hit'].includes(skillCombatFamily(skill)) &&
    Number.isFinite(Number(level)) &&
    Number(level) >= Math.max(1, Number(skill.max_level) || 30);
}
// Charge progress advances in explicit 10% stages; holding longer than
// the configured duration maintains 100% with no overcharge stacking.
// Authored charged abilities may opt in below max mastery by setting
// chargeable=true or a charge-duration field. Existing passive/utility/AoE
// channels do NOT suddenly become hold-to-cast or lose instant activation.
export function isChargeableCombatSkill(skill, masteryLevel) {
  if(isMaxMasteryChargeUnlocked(skill,masteryLevel))return true;
  const family=skillCombatFamily(skill);
  if(!family||family==='aoe')return false;
  const ms=Number(skill?.charge_duration_ms ?? skill?.charge_time_ms ?? skill?.chargeTimeMs);
  return skill?.chargeable === true ||
    (Number.isFinite(ms) && ms >= 200 && ms <= 10000);
}

export function getSkillChargeStatus(skill, heldMs=0) {
  const explicit=Number(skill?.charge_duration_ms ?? skill?.chargeTimeMs ??
    skill?.charge_time_ms);
  const requiredMs=Number.isFinite(explicit)&&explicit>=200&&explicit<=10000
    ?explicit:CHARGE_HOLD_MS;
  const ms=Math.max(0,Number.isFinite(Number(heldMs))?Number(heldMs):0);
  const raw=Math.min(1,ms/requiredMs);
  const percent=Math.min(100,Math.floor((raw+1e-9)*100/CHARGE_PERCENT_STEP)*CHARGE_PERCENT_STEP);
  return {requiredMs,heldMs:ms,percent,progress:percent/100,full:percent===100};
}

export function qualifyChargedCast(skill, masteryLevel, heldMs, specializationId = 'standard') {
  const unlocked=isChargeableCombatSkill(skill,masteryLevel);
  const charge=getSkillChargeStatus(skill,heldMs);
  const charged=unlocked&&charge.percent>=CHARGE_PERCENT_STEP;
  const family=skillCombatFamily(skill);
  const spec=getChargeSpecialization(specializationId);
  const scale=charged?charge.progress:0;
  return {
    charged, family, chargePercent:charged?charge.percent:0,
    chargeDurationMs:charge.requiredMs,
    powerMultiplier: 1+(spec.powerMultiplier-1)*scale,
    critBonusPct: spec.critBonusPct*scale,
    fatalBonusPct: spec.fatalBonusPct*scale,
    specializationId: CHARGE_SPECIALIZATIONS[specializationId] ? specializationId : 'standard',
  };
}
export function chargedStrikeModifiers(qualification, hitIndex = 0, totalHits = 1, soulEcho = false) {
  // Kill Flow's earned instant counter empowers all three successive strikes;
  // normal held charges still only empower the final hit.
  const finalHit = qualification?.counterInstant ||
    qualification?.family !== 'three_hit' ||
    hitIndex === Math.max(0, totalHits - 1);
  const apply = !!qualification?.charged && finalHit && !soulEcho;
  return {
    multiplier: apply ? Math.max(1, qualification.powerMultiplier || 1) : 1,
    critBonusPct: apply ? Math.max(0, qualification.critBonusPct || 0) : 0,
    fatalBonusPct: apply ? Math.max(0, qualification.fatalBonusPct || 0) : 0,
    chargedFinisher: apply && qualification.family === 'three_hit' &&
      hitIndex === Math.max(0, totalHits - 1),
  };
}
export function canAcceptFinisherChain(window, nowMs, nextSkill, activeTargetId) {
  if (!window || !window.charged || skillCombatFamily(nextSkill) !== 'single') return false;
  if (!Number.isFinite(nowMs) || nowMs < window.opensAt || nowMs > window.expiresAt) return false;
  if (window.targetId && window.targetId !== activeTargetId) return false;
  return true;
}
export function chainedSingleDelay(nowMs, finalHitAtMs) {
  return Math.max(120, Math.min(1500, (Number(finalHitAtMs) || 0) - nowMs + CHAIN_SINGLE_DELAY_MS));
}
