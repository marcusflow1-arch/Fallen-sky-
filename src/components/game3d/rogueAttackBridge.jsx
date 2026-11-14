// ─── Rogue Attack Bridge ─────────────────────────────────────────────
// Bridges player attacks from GameWorld3D into hostile rogue AIs AND the
// real world-boss entities exposed by GameWorld3D.
//
// This module is imported by GameWorld3D, so the combat bridge is installed as
// part of the actual /gameview runtime without requiring another page mount.
// Boss damage is applied to the same live objects that drive the HUD.

import * as THREE from 'three';
import { getPlayerHUD } from './playerHUDStore';
import { getActiveWeaponPath } from './weaponClassBuffStore';
import { computeAXESwing, getAXEEnemyStats } from './axe/balance/AXEPowerBudget';
import { AXE_TEMPORARY_BONUS_CAP, resolveAXEHeroStrike } from './axe/combat/AXEStrikeRuntime';
import { getAbilityState, updateTargetHP } from './abilityStore';
import { updateBoss } from './bossStore';
import { selectCameraBowTarget } from './combat/BowCameraAim.mjs';
import { RANGED_ATTACK_RANGE } from './gameWorldConfig';

const BRIDGE_VERSION = 'world-boss-bow-reticle-v5';
const bossShotRaycaster = new THREE.Raycaster();
const bossAimBox = new THREE.Box3();
const bossAimCenter = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const toBossDirection = new THREE.Vector3();

// Hits on world bosses and rogues go through the same resolution as every other hit
// (AXEStrikeRuntime): the target's own defense, level, block and avoidance. They used to be
// computed against defense 0, before the target was even known.
const heroOf = (playerDerivedRef) => getPlayerHUD().derived || playerDerivedRef?.current || {};
const statsOf = (foe, hero, tier) => foe?.derived || getAXEEnemyStats(hero.level || 1, tier === 'boss' ? 'worldBoss' : 'champion');

function heroStrike(playerDerivedRef, foe, skillMultiplier, tier) {
  const hero = heroOf(playerDerivedRef);
  return resolveAXEHeroStrike(hero, statsOf(foe, hero, tier), {
    skillMultiplier, targetHp: foe?.hp, targetMaxHp: foe?.maxHp, tier,
  });
}

// an ordinary landed swing, for the bow's charge bonus (no roll, nothing consumed)
function estimateSwing(playerDerivedRef, foe, skillMultiplier, tier) {
  const hero = heroOf(playerDerivedRef);
  return computeAXESwing(hero, statsOf(foe, hero, tier), { skillMultiplier });
}

function getLiveBosses() {
  const bosses = typeof window !== 'undefined' ? window.__gw3dBosses : null;
  if (!Array.isArray(bosses)) return [];
  return bosses.filter((boss) => boss?.group && boss.alive !== false && !boss.dying && boss.group.visible !== false);
}

function findLiveBoss(targetId) {
  return getLiveBosses().find((boss) => boss?.id === targetId) || null;
}

function findLiveRogue(targetId) {
  const rogues = typeof window !== 'undefined' ? window.__gw3dRogues : null;
  if (!Array.isArray(rogues)) return null;
  return rogues.find((rogue) => rogue?.id === targetId && rogue.alive !== false && !rogue.dying) || null;
}

function applyBossDamage(targetId, amount, source = 'player') {
  const boss = findLiveBoss(targetId);
  if (!boss) return 0;

  const rounded = Math.round(Number(amount));
  const damage = Number.isFinite(rounded) ? Math.max(1, rounded) : 1;
  const previousHp = Number.isFinite(Number(boss.hp)) ? Number(boss.hp) : Number(boss.maxHp) || 1;
  boss.hp = Math.max(0, previousHp - damage);
  boss.alive = boss.hp > 0;
  boss.hitCooldown = 0.25;
  boss.lastDamage = damage;
  boss.lastDamageSource = source;
  boss.lastDamageAt = performance.now();

  // Small hit flash so an arrow impact is visually obvious even when the boss
  // has a very large segmented HP pool.
  if (Array.isArray(boss.tintMaterials)) {
    boss.tintMaterials.forEach((material) => {
      if (!material?.emissive) return;
      material.userData = material.userData || {};
      if (!material.userData.__bossBaseEmissive) {
        material.userData.__bossBaseEmissive = material.emissive.clone();
      }
      material.emissive.setHex(0xffffff);
    });
    setTimeout(() => {
      boss.tintMaterials?.forEach((material) => {
        const base = material?.userData?.__bossBaseEmissive;
        if (material?.emissive && base) material.emissive.copy(base);
      });
    }, 110);
  }

  // Keep every existing HUD/target subscriber on the same source of truth.
  updateBoss(boss.id, {
    hp: boss.hp,
    alive: boss.alive,
    dying: boss.dying,
    lastDamage: damage,
    lastDamageAt: boss.lastDamageAt,
    lastDamageSource: source,
  });
  updateTargetHP(boss.id, boss.hp);

  window.dispatchEvent(new CustomEvent('bossDamageTaken', {
    detail: {
      bossId: boss.id,
      bossName: boss.name,
      damage,
      hp: boss.hp,
      maxHp: boss.maxHp,
      source,
    },
  }));

  if (!boss.alive) {
    window.dispatchEvent(new CustomEvent('bossDefeated', {
      detail: { bossId: boss.id, bossName: boss.name, maxHp: boss.maxHp },
    }));
  }

  return damage;
}

function applyLockedRogueDamage(targetId, amount, source = 'charged_bow') {
  const rogue = findLiveRogue(targetId);
  if (!rogue) return 0;

  const rounded = Math.round(Number(amount));
  const damage = Number.isFinite(rounded) ? Math.max(1, rounded) : 1;
  rogue.hp = Math.max(0, (Number(rogue.hp) || 0) - damage);
  rogue.lastDamageSource = source;
  rogue.lastDamageAt = performance.now();

  rogue.tintMats?.forEach((m) => { if (m?.emissive) m.emissive.setHex(0xffffff); });
  setTimeout(() => {
    if (rogue.tintMats) rogue.tintMats.forEach((m) => { if (m?.emissive) m.emissive.setHex(rogue.color); });
  }, 100);

  updateTargetHP(rogue.id, rogue.hp);
  window.dispatchEvent(new CustomEvent('rogueBossDamageTaken', {
    detail: {
      bossId: rogue.id,
      bossName: rogue.name,
      damage,
      hp: rogue.hp,
      maxHp: rogue.maxHp,
      source,
    },
  }));

  if (rogue.hp <= 0) {
    rogue.hp = 0;
    rogue.alive = false;
    rogue.dying = true;
    rogue.deathTimer = 0;
    rogue.respawnAt = performance.now() + 25_000;
    rogue.currentAnim = 'death';
    rogue.idleAction?.fadeOut?.(0.1);
    rogue.runAction?.fadeOut?.(0.1);
    rogue.deathAction?.reset?.().fadeIn?.(0.1).play?.();
    window.dispatchEvent(new CustomEvent('rogueBossDefeated', {
      detail: { bossId: rogue.id, bossName: rogue.name, maxHp: rogue.maxHp },
    }));
  }

  return damage;
}

function findCanvasRectForPointer(event) {
  const direct = event?.target;
  const directRect = direct?.getBoundingClientRect?.();
  if (directRect?.width > 0 && directRect?.height > 0 && direct?.tagName === 'CANVAS') {
    return directRect;
  }

  if (typeof document === 'undefined') return null;
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  const hasPointer = Number.isFinite(clientX) && Number.isFinite(clientY);
  const canvases = Array.from(document.querySelectorAll('canvas'));

  if (hasPointer) {
    for (const canvas of canvases) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return rect;
    }
  }

  return canvases.find((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  })?.getBoundingClientRect?.() || null;
}

function raycastBossAtNDC(ndcX, ndcY) {
  const camera = typeof window !== 'undefined' ? window.__gw3dCamera : null;
  if (!camera || !Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

  camera.updateMatrixWorld?.();
  bossShotRaycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  let best = null;
  let bestDistance = Infinity;
  for (const boss of getLiveBosses()) {
    boss.group.updateMatrixWorld?.(true);
    const hit = bossShotRaycaster.intersectObject(boss.group, true)?.[0];
    if (hit && hit.distance < bestDistance) {
      best = boss;
      bestDistance = hit.distance;
    }
  }
  return best;
}

function findBossInCameraAimCone() {
  const camera = typeof window !== 'undefined' ? window.__gw3dCamera : null;
  if (!camera) return null;

  camera.updateMatrixWorld?.();
  camera.getWorldDirection(cameraDirection).normalize();

  let best = null;
  let bestDot = 0.985; // only a narrow camera-aligned edge grace, not a 33° auto-hit cone
  let bestDistance = Infinity;

  for (const boss of getLiveBosses()) {
    boss.group.updateMatrixWorld?.(true);
    try {
      bossAimBox.setFromObject(boss.group);
      bossAimBox.getCenter(bossAimCenter);
    } catch {
      bossAimCenter.copy(boss.group.position);
    }

    toBossDirection.copy(bossAimCenter).sub(camera.position);
    const distance = toBossDirection.length();
    if (!Number.isFinite(distance) || distance <= 0 || distance > 90) continue;
    toBossDirection.normalize();
    const dot = cameraDirection.dot(toBossDirection);
    if (dot > bestDot || (Math.abs(dot - bestDot) < 0.01 && distance < bestDistance)) {
      best = boss;
      bestDot = dot;
      bestDistance = distance;
    }
  }

  return best;
}

function findBossUnderArrowAim(event) {
  // First use the actual mouse position when this attack came from a pointer.
  // Every read is null-safe because some animation/controller attacks do not
  // supply a DOM pointer event at all.
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const rect = findCanvasRectForPointer(event);
    if (rect?.width > 0 && rect?.height > 0) {
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const pointedBoss = raycastBossAtNDC(ndcX, ndcY);
      if (pointedBoss) return pointedBoss;
    }
  }

  // Third-person aiming uses a centered reticle. If the exact center ray misses
  // the huge boss mesh because of camera offset, use a narrow forward aim cone.
  const centerBoss = raycastBossAtNDC(0, 0);
  if (centerBoss) return centerBoss;
  return findBossInCameraAimCone();
}

function resolveBowPriorityTarget() {
  // One exact crosshair decision for normal enemies, rogues and world bosses.
  // Otherwise the old priority code could damage a distant boss through an
  // enemy directly in front of the bow, or auto-hit a rogue behind the dot.
  const global=typeof window!=='undefined'?window:null;
  const camera=global?.__gw3dCamera;
  const origin=global?.__localPlayerPos||camera?.position;
  const bosses=getLiveBosses();
  const rogues=Array.isArray(global?.__gw3dRogues)
    ?global.__gw3dRogues.filter(r=>r?.alive!==false&&!r.dying):[];
  const enemies=Array.isArray(global?.__gw3dEnemies)?global.__gw3dEnemies:[];
  const occluders=typeof global?.__gw3dBowOccluders==='function'
    ?global.__gw3dBowOccluders():global?.__gw3dBowOccluders||[];
  const result=selectCameraBowTarget({
    camera,origin,enemies:[...enemies,...rogues],bosses,
    maxRange:RANGED_ATTACK_RANGE,groundMeshes:occluders,
    lockedEnemyId:getAbilityState().target?.id,
  });
  if(!result)return null;
  if(bosses.includes(result.target))return {kind:'boss',target:result.target};
  if(rogues.includes(result.target))return {kind:'rogue',target:result.target};
  return null;
}

let rangedChargeStartedAt = 0;
let rangedChargeActive = false;
let lastRangedBaseDamage = 0;
let lastRangedSkillMultiplier = 1;
let lastPointerEvent = null;
let bossDamagedThisPressId = null;
let rogueDamagedThisPressId = null;

function isRangedWeapon() {
  try {
    return getActiveWeaponPath() === 'ranged';
  } catch {
    return false;
  }
}

function installBossAndBowBridge() {
  if (typeof window === 'undefined') return;
  if (window.__atomXeBossCombatBridgeVersion === BRIDGE_VERSION) return;

  // Base44 preview uses hot-module replacement. Remove listeners from the last
  // version when possible so stale handlers cannot keep running old hit logic.
  try { window.__atomXeBossCombatBridgeCleanup?.(); } catch { /* non-fatal */ }

  const onMouseDown = (event) => {
    const worldCanvas=window.__gw3dRenderer?.domElement;
    if(event?.button!==0||!isRangedWeapon()||
       !worldCanvas||event?.target!==worldCanvas||
       window.__activeDuel||window.__axeUiModalOpen||
       window.__axeServiceModeOpen||window.__axeWorldMapOpen||
       window.__axePauseMenuOpen||window.__axeDialogueOpen)return;
    lastPointerEvent = {
      clientX: Number.isFinite(Number(event?.clientX)) ? Number(event.clientX) : null,
      clientY: Number.isFinite(Number(event?.clientY)) ? Number(event.clientY) : null,
      target: event?.target || null,
    };
    rangedChargeStartedAt = performance.now();
    rangedChargeActive = true;
    lastRangedBaseDamage = 0;
    bossDamagedThisPressId = null;
    rogueDamagedThisPressId = null;
  };

  const onMouseUp = (event) => {
    if(event?.button!==0||!rangedChargeActive)return;
    const heldSeconds=Math.max(0,(performance.now()-rangedChargeStartedAt)/1000);
    rangedChargeActive=false;
    if(!isRangedWeapon()||window.__activeDuel||lastRangedBaseDamage<=0)return;
    const fullCharge=Math.min(1,heldSeconds/1.3);
    const overcharge=Math.max(0,heldSeconds-1.3)*.25;
    const chargeMultiplier=Math.min(AXE_TEMPORARY_BONUS_CAP,1+fullCharge+overcharge);
    const bonusDamage=Math.max(0,lastRangedBaseDamage*(chargeMultiplier-1));
    // A release never invents a new hit. It only tops up an attack already
    // verified by the normal combat resolver during this press.
    if(bonusDamage>=1&&bossDamagedThisPressId)
      applyBossDamage(bossDamagedThisPressId,bonusDamage,'charged_bow_bonus');
    else if(bonusDamage>=1&&rogueDamagedThisPressId)
      applyLockedRogueDamage(rogueDamagedThisPressId,bonusDamage,'charged_bow_bonus');
    bossDamagedThisPressId=null;
    rogueDamagedThisPressId=null;
    lastRangedBaseDamage=0;
  };

  const onRogueDamage = (event) => {
    const target = getAbilityState().target;
    if (!target) return;

    if (isRangedWeapon()) {
      if (target.kind !== 'boss' && target.kind !== 'rogue') return;
      if (rangedChargeActive) {
        lastRangedBaseDamage = Math.max(1, Number(event?.detail?.damage) || 1);
        event?.stopImmediatePropagation?.();
      }
      return;
    }

    if (target.kind === 'boss') {
      applyBossDamage(target.id, Number(event?.detail?.damage) || 1, 'player_attack');
    }
  };

  // Losing focus must never leave a phantom charged attack armed.
  const onBlur=()=>{
    rangedChargeActive=false;
    bossDamagedThisPressId=null;rogueDamagedThisPressId=null;
    lastRangedBaseDamage=0;
  };
  window.addEventListener('blur',onBlur);
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  window.addEventListener('rogueAITakeDamage', onRogueDamage);

  window.__atomXeBossCombatBridgeCleanup = () => {
    window.removeEventListener('blur',onBlur);
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('rogueAITakeDamage', onRogueDamage);
  };
  window.__atomXeBossCombatBridgeInstalled = true;
  window.__atomXeBossCombatBridgeVersion = BRIDGE_VERSION;
  window.__atomXeBossCombat = {
    isInstalled: () => true,
    version: BRIDGE_VERSION,
    getBosses: () => getLiveBosses(),
    getRogueBosses: () => (Array.isArray(window.__gw3dRogues) ? window.__gw3dRogues : []),
    damageBoss: (bossId, amount = 1) => applyBossDamage(bossId, amount, 'diagnostic'),
    damageRogueBoss: (bossId, amount = 1) => applyLockedRogueDamage(bossId, amount, 'diagnostic'),
    bossUnderAim: () => raycastBossAtNDC(0, 0) || findBossInCameraAimCone(),
  };
}

installBossAndBowBridge();

/**
 * Called by the real GameWorld3D left-click attack loop.
 *
 * If the shot is aimed at a live world boss (mouse-over, center reticle,
 * camera aim cone, or explicit lock), apply damage to that boss immediately.
 * Otherwise preserve the existing rogue-AI event path and normal enemy combat.
 */
export function dispatchRogueAttack(playerDerivedRef, skillStrikeMult = 1.0) {
  lastRangedSkillMultiplier = skillStrikeMult;

  const ranged=isRangedWeapon();
  const bowPriority=ranged?resolveBowPriorityTarget():null;
  const boss=bowPriority?.kind==='boss'?bowPriority.target:null;
  if (boss) {
    const strike = heroStrike(playerDerivedRef, boss, skillStrikeMult, 'boss');
    lastRangedBaseDamage=strike.kind==='hit'?strike.damage:0;
    if(strike.kind==='hit'){
      const applied=applyBossDamage(boss.id,strike.damage,'arrow');
      if(applied>0){
        bossDamagedThisPressId=boss.id;
        window.dispatchEvent(new CustomEvent('game3dVerifiedBowHit',{detail:{targetId:boss.id}}));
      }
    }
    return true;
  }

  const target=getAbilityState().target;
  const rogue=ranged?(bowPriority?.kind==='rogue'?bowPriority.target:null):
    target?.kind==='rogue'?findLiveRogue(target.id):null;
  if (rogue) {
    const strike = heroStrike(playerDerivedRef, rogue, skillStrikeMult, 'rogue');
    lastRangedBaseDamage=strike.kind==='hit'&&ranged?strike.damage:0;
    if(strike.kind==='hit'){
      const applied=applyLockedRogueDamage(rogue.id,strike.damage,'player_attack');
      if(applied>0&&ranged){
        rogueDamagedThisPressId=rogue.id;
        window.dispatchEvent(new CustomEvent('game3dVerifiedBowHit',{detail:{targetId:rogue.id}}));
      }
    }
    return true;
  }

  // A ranged miss at the small crosshair cannot trigger legacy area/nearby
  // rogue damage. The forward melee fallback below remains unchanged.
  if(ranged){lastRangedBaseDamage=0;return false;}
  // A nearby rogue (EnemyPlayerSpawner) resolves melee against its own stats.
  const estimate = estimateSwing(playerDerivedRef, null, skillStrikeMult, 'rogue');
  lastRangedBaseDamage = estimate;
  window.dispatchEvent(new CustomEvent('rogueAITakeDamage', {
    detail: { damage: estimate, skillMultiplier: skillStrikeMult, hero: heroOf(playerDerivedRef) },
  }));
  return false;
}
