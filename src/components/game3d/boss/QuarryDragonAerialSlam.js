// Wolfveil quarry dragon — owner-hosted GLB and one scripted aerial ground slam.
// Uses the existing Game 3D boss/HP registry; no fire breath, summons or extra abilities.
// Client-side preview encounter only: no XP, loot, server damage or quest grants.
import * as THREE from 'three';
import { getAXEEnemyStats } from '../axe/balance/AXEPowerBudget';
import {createDragonLivingFireAttacks} from './DragonLivingFireAttacks.mjs';

export const DRAGON_BOSS_ID = 'wolfveil_quarry_dragon';
export const DRAGON_BOSS_MODEL_URL =
  'https://base44.app/api/apps/6876751a602125f45f1861b9/files/mp/public/6876751a602125f45f1861b9/852c0eeaa_dragon_character_3d_by_oscar_creativo.glb';

export const DRAGON_SLAM = Object.freeze({
  loadDistance: 100,
  engageDistance: 27,
  maxTargetOffset: 23,
  impactRadius: 5.5,
  damage: 30,
  jumpHeight: 11,
  warningSeconds: 1.1,
  ascendSeconds: 1.2,
  descendSeconds: 0.75,
  recoverSeconds: 1.4,
  cooldownSeconds: 7.5,
});

// All measurements are on the horizontal world plane. The boss remains inside
// its quarry encounter area even when the player runs away or jumps off terrain.
export function planarDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.z) - Number(b.z));
}

export function clampDragonSlamTarget(anchor, position, radius = DRAGON_SLAM.maxTargetOffset) {
  if (!anchor || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  const dx = position.x - anchor.x;
  const dz = position.z - anchor.z;
  const dist = Math.hypot(dx, dz);
  const fraction = dist > radius ? radius / dist : 1;
  return { x: anchor.x + dx * fraction, z: anchor.z + dz * fraction };
}

function prepareDragonScene(gltfScene) {
  const bounds = new THREE.Box3().setFromObject(gltfScene);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0.00001) throw new Error('Dragon GLB has no usable geometry');
  const center = bounds.getCenter(new THREE.Vector3());
  // Cap wingspan as well as height so an enormous authored mesh remains usable.
  const scale = Math.min(10 / size.y, 17 / Math.max(size.x, size.z, 0.001));
  gltfScene.scale.setScalar(scale);
  gltfScene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  const materials = [];
  gltfScene.traverse((part) => {
    if (!part.isMesh) return;
    part.castShadow = !part.isSkinnedMesh;
    part.receiveShadow = true;
    for (const material of (Array.isArray(part.material) ? part.material : [part.material])) {
      if (material) materials.push(material);
    }
  });
  return materials;
}

export function createQuarryDragonBoss({
  loader, scene, bossEntities, setBosses, sampleGroundY,
  getPlayerPosition, applyPlayerDamage, onEngage,
  spawnPosition, onError = console.warn,
  instanceId=DRAGON_BOSS_ID,encounterName='Quarry Dragon',site='quarry',
} = {}) {
  if (!loader || !scene || !Array.isArray(bossEntities) || !spawnPosition) {
    throw new Error('Quarry dragon requires a GLTF loader, scene, boss registry and spawn position');
  }

  const anchor = { x: spawnPosition.x, z: spawnPosition.z };
  let disposed = false;
  let loading = false;
  let boss = null;
  let phase = 'idle';
  let timer = 0;
  let cooldown = 2.5;
  let takeoff = null;
  let target = null;
  let targetY = 0;
  let telegraph = null;
  let attackSequence=0;
  const groundAt = (x, z) => {
    const y = sampleGroundY?.(x, z);
    return Number.isFinite(y) ? y : null;
  };
  const eased = (t) => t * t * (3 - 2 * t);
  const validPlayer = () => {
    const p = getPlayerPosition?.();
    return p && p.alive !== false && Number.isFinite(p.x) && Number.isFinite(p.z) ? p : null;
  };
  const livingFire=createDragonLivingFireAttacks({
    scene,groundAt,getPlayer:validPlayer,applyPlayerDamage,
    bossId:instanceId,
  });

  function spawnModel(gltf) {
    if (disposed) return;
    try {
      const group = new THREE.Group();
      group.name = 'Wolfveil '+encounterName;
      const materials = prepareDragonScene(gltf.scene);
      group.add(gltf.scene);
      group.position.set(anchor.x, groundAt(anchor.x, anchor.z) ?? spawnPosition.y ?? 0, anchor.z);
      scene.add(group);

      const derived = getAXEEnemyStats(25, 'worldBoss');
      const maxHp = Math.max(1, Math.round(Number(derived.maxHP) || 1000));
      const mixer = gltf.animations?.length ? new THREE.AnimationMixer(gltf.scene) : null;
      if (mixer) {
        const idle = mixer.clipAction(gltf.animations[0]);
        idle.setLoop(THREE.LoopRepeat, Infinity);
        idle.play(); // The hosted GLB has one MOTION track, not separate attack clips.
      }
      boss = {
        id: instanceId, bossDefinitionId: DRAGON_BOSS_ID,
        name: encounterName, title: 'Living Elemental Storm', color: 0xc55f37,
        isBoss: true, customMovement: true, group, mixer,
        alive: true, dying: false, defeated: false,
        deathAction: null, deathDuration: 2.4, deathTimer: 0, deathStarted: false,
        hp: maxHp, maxHp, hpTanks: 10, hpTankSize: Math.ceil(maxHp / 10),
        derived, level: 25, xpReward: 0, speed: 0,
        tintMaterials: materials, fadeMaterials: materials,
        metadata: { region: 'wolfveil', site, attacks:['fire_rain','breath_stream','sky_cyclone','aerial_slam'], previewOnly: true },
      };
      bossEntities.push(boss);
      setBosses?.(bossEntities);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(DRAGON_SLAM.impactRadius - 0.45, DRAGON_SLAM.impactRadius, 64),
        new THREE.MeshBasicMaterial({
          color: 0xff6947, transparent: true, opacity: 0.8,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 6;
      ring.visible = false;
      scene.add(ring);
      telegraph = ring;
    } catch (error) {
      onError?.('Quarry dragon model could not be prepared', error);
    }
  }

  function beginSlam(player) {
    target = clampDragonSlamTarget(anchor, player);
    if (!target) return;
    targetY = groundAt(target.x, target.z) ?? boss.group.position.y;
    takeoff = boss.group.position.clone();
    phase = 'telegraph';
    timer = 0;
    if (telegraph) {
      telegraph.position.set(target.x, targetY + 0.13, target.z);
      telegraph.visible = true;
    }
    onEngage?.(boss);
  }

  function hitOnLanding() {
    const player = validPlayer();
    if (player && target && planarDistance(player, target) <= DRAGON_SLAM.impactRadius) {
      applyPlayerDamage?.(DRAGON_SLAM.damage, { bossId: instanceId, attack: 'aerial_slam' });
    }
    if (telegraph) telegraph.visible = false;
    phase = 'recover';
    timer = 0;
  }

  function update(delta) {
    if (disposed) return;
    const player = validPlayer();
    // Lazy load: the source model is large; don't download it in the hometown.
    if (!loading && !boss && player && planarDistance(player, anchor) <= DRAGON_SLAM.loadDistance) {
      loading = true;
      loader.load(DRAGON_BOSS_MODEL_URL, spawnModel, undefined, (error) => {
        if (!disposed) onError?.('Quarry dragon GLB could not be loaded', error);
      });
    }
    if (!boss || !boss.alive || boss.dying || boss.defeated || !boss.group.visible) {
      if (telegraph) telegraph.visible = false;
      livingFire.cancel();
      return;
    }

    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    if (phase === 'idle') {
      cooldown -= dt;
      if (cooldown <= 0 && player && planarDistance(player, anchor) <= DRAGON_SLAM.engageDistance) {
        // Cycle through real rain, sustained breath, descending tornado
        // and the original aerial slam. All VFX warn before dealing damage.
        const kind=['rain','breath','cyclone','slam'][attackSequence%4];
        attackSequence++;
        if(kind==='slam')beginSlam(player);
        else{
          const aimed=clampDragonSlamTarget(anchor,player);
          if(aimed&&livingFire.start(kind,aimed,boss.group.position)){
            phase='elemental';timer=0;onEngage?.(boss);
          }
        }
      }
      return;
    }

    timer += dt;
    if(phase==='elemental'){
      if(livingFire.update(dt)){phase='recover';timer=0;}
      return;
    }
    if (phase === 'telegraph' && timer >= DRAGON_SLAM.warningSeconds) {
      phase = 'ascend';
      timer = 0;
    } else if (phase === 'ascend') {
      const t = Math.min(1, timer / DRAGON_SLAM.ascendSeconds);
      boss.group.position.y = takeoff.y + DRAGON_SLAM.jumpHeight * eased(t);
      if (t >= 1) { phase = 'descend'; timer = 0; }
    } else if (phase === 'descend') {
      const t = Math.min(1, timer / DRAGON_SLAM.descendSeconds);
      boss.group.position.x = THREE.MathUtils.lerp(takeoff.x, target.x, eased(t));
      boss.group.position.z = THREE.MathUtils.lerp(takeoff.z, target.z, eased(t));
      boss.group.position.y = THREE.MathUtils.lerp(takeoff.y + DRAGON_SLAM.jumpHeight, targetY, t * t);
      if (t >= 1) hitOnLanding(); // exactly one hit test per slam
    } else if (phase === 'recover' && timer >= DRAGON_SLAM.recoverSeconds) {
      phase = 'idle';
      timer = 0;
      cooldown = DRAGON_SLAM.cooldownSeconds;
    }
  }

  function dispose() {
    disposed = true;
    livingFire.dispose();
    if (telegraph) {
      scene.remove(telegraph);
      telegraph.geometry.dispose();
      telegraph.material.dispose();
      telegraph = null;
    }
    if (boss?.group) {
      scene.remove(boss.group);
      boss.mixer?.stopAllAction();
      boss.group.traverse((part) => {
        if (!part.isMesh) return;
        part.geometry?.dispose();
        for (const mat of (Array.isArray(part.material) ? part.material : [part.material])) {
          if (!mat) continue;
          for (const key of Object.keys(mat)) {
            if (mat[key]?.isTexture) mat[key].dispose();
          }
          mat.dispose();
        }
      });
      const index = bossEntities.indexOf(boss);
      if (index !== -1) bossEntities.splice(index, 1);
      setBosses?.(bossEntities);
      boss = null;
    }
  }

  return { update, dispose, getBoss: () => boss };
}
