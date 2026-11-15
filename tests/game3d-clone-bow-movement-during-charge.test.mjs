import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  blocksBowMovement, shouldBlendBowFootwork,
  shouldUseBowAimingLocomotion, BOW_RELEASE_FOOTWORK_BLEND_SECONDS,
} from '../src/components/game3d/player/BowMovementRules.mjs';
import { getBowChargeStatus } from '../src/components/game3d/combat/ArcheryChargeRules.mjs';

const read=p=>readFileSync(p,'utf8');

test('holding a drawn bow does not immobilize an otherwise free player',()=>{
  assert.equal(blocksBowMovement({busy:false,bowAttackActive:false}),false);
  assert.equal(blocksBowMovement({busy:true,bowAttackActive:true}),false);
  assert.equal(shouldUseBowAimingLocomotion({drawn:true,bowEquipped:true,mounted:false}),true);
  assert.equal(shouldUseBowAimingLocomotion({drawn:false,bowEquipped:true,mounted:false}),false);
  assert.equal(shouldUseBowAimingLocomotion({drawn:true,bowEquipped:false}),false);
  assert.equal(shouldUseBowAimingLocomotion({drawn:true,bowEquipped:true,mounted:true}),false);
  assert.equal(shouldUseBowAimingLocomotion({aimHeld:true}),true);
});

test('real mobility locks still apply to non-bow attacks, knockback and death',()=>{
  assert.equal(blocksBowMovement({busy:true,bowAttackActive:false}),true);
  assert.equal(blocksBowMovement({dead:true,busy:true,bowAttackActive:true}),true);
  assert.equal(blocksBowMovement({dead:true}),true);
});

test('bow recoil yields back to directional footwork while moving without cancelling shot',()=>{
  assert.equal(BOW_RELEASE_FOOTWORK_BLEND_SECONDS,0.12);
  assert.equal(shouldBlendBowFootwork({bowAttackActive:true,moving:true,elapsedSeconds:0.05}),false);
  assert.equal(shouldBlendBowFootwork({bowAttackActive:true,moving:true,elapsedSeconds:0.12}),true);
  assert.equal(shouldBlendBowFootwork({bowAttackActive:true,moving:false,elapsedSeconds:0.2}),false);
  assert.equal(shouldBlendBowFootwork({bowAttackActive:false,moving:true,elapsedSeconds:0.2}),false);
});

test('movement does not consume, reset or overcharge the held arrow',()=>{
  assert.equal(getBowChargeStatus(700).percent,50);
  assert.equal(getBowChargeStatus(1200).percent,100);
  assert.equal(getBowChargeStatus(7000).percent,100);
  assert.equal(getBowChargeStatus(7000).multiplier,2);
});

test('the real 3D world retains collision-checked WASD and does not gate it on held draw',()=>{
  const world=read('src/components/game3d/GameWorld3D.jsx');
  assert.match(world,/const bowDrawAiming = shouldUseBowAimingLocomotion\(\{/);
  assert.match(world,/drawn:heldBow\.active, bowEquipped:getActiveWeaponPath\(\)==='ranged'/);
  assert.match(world,/const animationDirection = combatLocked \|\| bowDrawAiming \? moveDirection : 'forward'/);
  assert.match(world,/const canMove = isMoving && !window\.__axeTileInspectionEditing && !dedicatedMode && !movementOverridden/);
  assert.match(world,/moveWorldActor\(model,move\.x\*speed\*delta,move\.z\*speed\*delta,mounted\)/);
  assert.match(world,/!combatAxes && !otsAim\.current\.aiming && !heldBow\.active/);
  assert.match(world,/const status=getBowChargeStatus\(Math\.max\(0,performance\.now\(\)-heldBow\.startedAt\)\)/);
});

test('bow action animation is a movement-exempt busy state only for actual bow attacks',()=>{
  const ctrl=read('src/components/game3d/player/LunaDashboardPlayerController.jsx');
  assert.match(ctrl,/bowAttackAllowsMovement = !melee && equipment\.weaponType === 'bow'/);
  assert.match(ctrl,/blocksBowMovement\(\{busy:isBusy,dead:isDead,bowAttackActive:bowAttackAllowsMovement\}\)/);
  assert.match(ctrl,/shouldBlendBowFootwork\(\{/);
  assert.match(ctrl,/moving, elapsedSeconds: now\(\) - lastAttackAt/);
  assert.match(ctrl,/playState\(footwork, \{ fade:0\.12 \}\)/);
  assert.match(ctrl,/bowAttackAllowsMovement = false;/);
  assert.match(ctrl,/bowAttackAllowsMovement = false;\n    busyResetAt = 0;/);
  assert.match(ctrl,/bowAttackAllowsMovement=false;\n    busyResetAt=0;/);
});

test('opening a menu or losing focus cancels draw without disabling WASD for normal play',()=>{
  const world=read('src/components/game3d/GameWorld3D.jsx');
  assert.match(world,/const cancelBowCharge=\(\)=>\{/);
  assert.match(world,/window\.addEventListener\('blur', onInputBlur\)/);
  assert.match(world,/if \(window\.__axeUiModalOpen \|\| window\.__axeServiceModeOpen \|\| window\.__axePauseMenuOpen/);
});
