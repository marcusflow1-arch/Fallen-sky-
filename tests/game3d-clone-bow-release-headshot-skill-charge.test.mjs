import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOW_FULL_CHARGE_MS, getBowChargeStatus, applyBowImpactDamage, isBowHeadshotPoint,
} from '../src/components/game3d/combat/ArcheryChargeRules.mjs';
import {
  getSkillChargeStatus, isChargeableCombatSkill, qualifyChargedCast, chargedStrikeModifiers,
  CHARGE_PERCENT_STEP,
} from '../src/components/game3d/combat/ChargedSkillRules.mjs';

const read=path=>readFileSync(path,'utf8');
const skill={
  skill_type:'ACTIVE_ATTACK',cast_type:'single_hit',hit_count:1,max_level:30,
};
test('bow: zero charge, 0.7s half charge, 1.2s full, indefinite full hold',()=>{
  assert.equal(BOW_FULL_CHARGE_MS,1200);
  assert.equal(getBowChargeStatus(0).percent,0);
  assert.equal(getBowChargeStatus(350).percent,25);
  assert.equal(getBowChargeStatus(700).percent,50);
  assert.equal(getBowChargeStatus(950).percent,75);
  assert.equal(getBowChargeStatus(1200).percent,100);
  assert.equal(getBowChargeStatus(900000).percent,100);
  assert.equal(getBowChargeStatus(900000).multiplier,2);
  assert.equal(getBowChargeStatus(-100).multiplier,1);
});

test('charge and headshot stack AFTER a real PvE hit, never invent damage from a MISS',()=>{
  assert.equal(applyBowImpactDamage(100,{chargeMultiplier:1}),100);
  assert.equal(applyBowImpactDamage(100,{chargeMultiplier:1.5}),150);
  assert.equal(applyBowImpactDamage(100,{headshot:true}),200);
  assert.equal(applyBowImpactDamage(100,{chargeMultiplier:2,headshot:true}),400);
  assert.equal(applyBowImpactDamage(0,{chargeMultiplier:2,headshot:true}),0);
  assert.equal(applyBowImpactDamage(100,{chargeMultiplier:2,headshot:true,pve:false}),100);
});

test('headshot is based on a genuine body raycast in the top zone, not target lock grace',()=>{
  const bounds={min:{x:-.6,y:0,z:-.6},max:{x:.6,y:2,z:.6}};
  assert.equal(isBowHeadshotPoint({x:0,y:1.9,z:0},bounds,true),true);
  assert.equal(isBowHeadshotPoint({x:0,y:1.4,z:0},bounds,true),false);
  assert.equal(isBowHeadshotPoint({x:0,y:1.9,z:0},bounds,false),false);
  assert.equal(isBowHeadshotPoint({x:0,y:1.9,z:0},null,true),false);
});

test('charged abilities progress in 10% increments and stop at 100%',()=>{
  assert.equal(CHARGE_PERCENT_STEP,10);
  assert.equal(getSkillChargeStatus(skill,0).percent,0);
  assert.equal(getSkillChargeStatus(skill,120).percent,10);
  assert.equal(getSkillChargeStatus(skill,600).percent,50);
  assert.equal(getSkillChargeStatus(skill,1200).percent,100);
  assert.equal(getSkillChargeStatus(skill,9000).percent,100);
  const fiveSeconds={...skill,charge_duration_ms:5000};
  assert.equal(getSkillChargeStatus(fiveSeconds,1000).percent,20);
  assert.equal(getSkillChargeStatus(fiveSeconds,2500).percent,50);
  assert.equal(getSkillChargeStatus(fiveSeconds,5000).percent,100);
  assert.equal(getSkillChargeStatus({...skill,charge_duration_ms:1000},500).percent,50);
});

test('proportional mastery ability bonuses stay capped and last-hit-only for three-hit',()=>{
  const halfway=qualifyChargedCast(skill,30,600);
  assert.equal(halfway.charged,true);
  assert.equal(halfway.chargePercent,50);
  assert.ok(Math.abs(halfway.powerMultiplier-1.1)<1e-9);
  assert.equal(qualifyChargedCast(skill,30,1200).powerMultiplier,1.2);
  assert.equal(qualifyChargedCast(skill,30,999999).powerMultiplier,1.2);
  assert.equal(qualifyChargedCast(skill,29,1200).charged,false);
  assert.equal(qualifyChargedCast(skill,29,1200).powerMultiplier,1);
  const triple={...skill,cast_type:'multi_hit_sequential',hit_count:3};
  const result=qualifyChargedCast(triple,30,1200);
  assert.equal(chargedStrikeModifiers(result,0,3).multiplier,1);
  assert.equal(chargedStrikeModifiers(result,1,3).multiplier,1);
  assert.equal(chargedStrikeModifiers(result,2,3).multiplier,1.2);
});

test('authored attack skills can opt into charging before max mastery, but passive and AoE cannot',()=>{
  const fiveSeconds={...skill,charge_duration_ms:5000};
  assert.equal(isChargeableCombatSkill(fiveSeconds,1),true);
  assert.equal(qualifyChargedCast(fiveSeconds,1,2500).chargePercent,50);
  assert.ok(Math.abs(qualifyChargedCast(fiveSeconds,1,2500).powerMultiplier-1.1)<1e-9);
  assert.equal(isChargeableCombatSkill({...skill,skill_type:'PASSIVE',chargeable:true},30),false);
  assert.equal(isChargeableCombatSkill({...skill,axe_pattern:'aoe',chargeable:true},30),false);
  assert.equal(isChargeableCombatSkill(skill,1),false);
});

test('world uses button DOWN only to draw, button UP to shoot once',()=>{
  const code=read('src/components/game3d/GameWorld3D.jsx');
  const down=code.slice(code.indexOf('const onMouseDown = (e) =>'),code.indexOf('const onMouseUp = (e) =>'));
  const up=code.slice(code.indexOf('const onMouseUp = (e) =>'),code.indexOf('const onMouseMove = (e) =>'));
  assert.match(down,/heldBow\.active=true;heldBow\.startedAt=performance\.now\(\)/);
  assert.match(down,/if\(getActiveWeaponPath\(\)==='ranged'\)/);
  assert.match(up,/if\(e\.button===0&&heldBow\.active\)/);
  assert.match(up,/getBowChargeStatus\(Math\.max\(0,performance\.now\(\)-heldBow\.startedAt\)\)/);
  assert.match(up,/pendingBowShotCharge=status/);
  assert.match(up,/attackPressed\.current=true/);
  assert.match(code,/cancelBowCharge\(\)/);
  assert.match(code,/addEventListener\('blur', onInputBlur\)/);
});

test('all PvE enemy types use the same selected headshot hit and no release-time second strike',()=>{
  const scene=read('src/components/game3d/GameWorld3D.jsx');
  const bridge=read('src/components/game3d/rogueAttackBridge.jsx');
  const aim=read('src/components/game3d/combat/BowCameraAim.mjs');
  assert.match(scene,/applyBowImpactDamage\(strike\.damage/);
  assert.match(scene,/headshot:!!bowAimTarget\?\.headshot/);
  assert.match(scene,/chargeMultiplier:bowShot\?\.multiplier\|\|1/);
  assert.match(bridge,/const arrowDamage=applyBowImpactDamage\(strike\.damage/);
  assert.match(bridge,/const arrowDamage=ranged\?applyBowImpactDamage/);
  assert.doesNotMatch(bridge,/charged_bow_bonus/);
  assert.doesNotMatch(bridge,/rangedChargeStartedAt/);
  assert.match(aim,/headshot: isBowHeadshotPoint\(point, box, !!intersection\)/);
  assert.match(aim,/clearMuzzlePath\(origin, candidate\.point, groundMeshes\)/);
});

test('existing bow visual shows charge level and only verified headshot feedback',()=>{
  const vfx=read('src/components/game3d/vfx/Game3DBowSpiritBird.mjs');
  const scene=read('src/components/game3d/GameWorld3D.jsx');
  assert.match(vfx,/game3dBowCharge/);
  assert.match(vfx,/FULL DRAW · 100%/);
  assert.match(vfx,/HEADSHOT ×2/);
  assert.match(scene,/bowVisuals\.setCharge\?\.\(getBowChargeStatus/);
  assert.match(scene,/if\(appliedDamage>0&&bowAimTarget\?\.headshot\)bowVisuals\.showHeadshot/);
  assert.match(scene,/skillChargeHud\.setAttribute\('aria-valuenow'/);
  assert.match(scene,/getSkillChargeStatus\(getSkillById\(heldSkill\.skillId\)/);
});
