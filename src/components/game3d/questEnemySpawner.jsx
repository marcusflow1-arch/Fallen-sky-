// Quest-target enemies share one parsed FBX and spawn over multiple frames.
// This avoids one FBX decode / geometry measurement for EACH quest enemy.
import * as THREE from 'three';
import { clone as cloneSkinnedEnemy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getAXEEnemyStats } from './axe/balance/AXEPowerBudget';
import { getPlayerHUD } from './playerHUDStore';
import { CREATURE_MODEL_URL } from './creatureAssets';
import { createGame3DQuestSpawnWave } from './performance/QuestSpawnWave.mjs';

const QUEST_TIER_MAP = {
  normal:   { name: 'normal',   scale: 1.0,  ringColor: 0xff3030, tintColor: null     },
  elite:    { name: 'elite',    scale: 1.35, ringColor: 0xff6600, tintColor: 0xff4400 },
  champion: { name: 'champion', scale: 1.6,  ringColor: 0xcc00ff, tintColor: 0xaa00ee },
};

const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * One model fetch/parse, shared GPU geometry, unique skeletons and materials,
 * and one cloned actor per frame. Quest rewards, spawn positions, stats and
 * original GameWorld3D combat/AI ownership stay unchanged.
 */
export function createQuestEnemySpawner({
  scene, enemies, loader, snapToGround, walkClipPromise, idleClipPromise, setEnemyCount,
}) {
  let disposed = false;
  let templatePromise = null;
  let template = null;
  let idleHandle = null;
  let idleType = null;
  const waves = new Set();
  const sharedQuestGeometries = new Set();

  function loadTemplate() {
    if (disposed) return Promise.resolve(null);
    if (templatePromise) return templatePromise;
    templatePromise = new Promise((resolve) => {
      const success = (fbx) => {
        if (disposed) { resolve(null); return; }
        try {
          // Geometry bounds are expensive for skinned models. Compute ONCE.
          const bounds = new THREE.Box3().setFromObject(fbx);
          const size = bounds.getSize(new THREE.Vector3());
          const scale = 1.7 / Math.max(size.x, size.y, size.z, 0.001);
          fbx.traverse((child) => {
            if (child.geometry) sharedQuestGeometries.add(child.geometry);
          });
          template = { model: fbx, scale };
          resolve(template);
        } catch (error) {
          console.warn('Game 3D quest enemy template could not be prepared', error);
          templatePromise = null;
          resolve(null);
        }
      };
      const failure = (error) => {
        console.warn('Game 3D quest creature unavailable', error);
        templatePromise = null;
        resolve(null);
      };
      try { loader.load(CREATURE_MODEL_URL, success, undefined, failure); }
      catch (error) { failure(error); }
    });
    return templatePromise;
  }

  function spawnQuestEnemies({ count, tierName, playerPos, metadata = null }) {
    const target = Math.max(0, Math.floor(Number(count) || 0));
    if (!target || disposed) return;
    const tierDef = QUEST_TIER_MAP[tierName] || QUEST_TIER_MAP.normal;
    const derived = getAXEEnemyStats(getPlayerHUD().level || 1, tierDef.name);
    // Freeze the quest's original spawn center even if the hero moves while
    // the model is downloading. This retains the authored ring formation.
    const x = Number(playerPos?.x) || 0;
    const z = Number(playerPos?.z) || 0;
    const startedAt = now();

    loadTemplate().then((asset) => {
      if (!asset || disposed) return;
      let wave;
      wave = createGame3DQuestSpawnWave({
        count: target,
        spawnOne: (i) => {
          if (disposed) return;
          // SkeletonUtils correctly rebinds bones. Body mesh geometries are
          // shared to avoid 5x GPU uploads; materials MUST be private because
          // tier tint/death fades mutate color, opacity and transparency.
          const fbx = cloneSkinnedEnemy(asset.model);
          fbx.scale.setScalar(asset.scale * tierDef.scale);
          const angle = (i / target) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 8 + Math.random() * 6;
          const sx = x + Math.cos(angle) * dist;
          const sz = z + Math.sin(angle) * dist;
          fbx.position.set(sx, 0, sz);
          snapToGround(fbx, 0);

          const tintMaterials = [];
          fbx.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = !node.isSkinnedMesh;
            node.receiveShadow = true;
            if (node.material) {
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              const privateMats = mats.map((m) => m?.clone?.() || m);
              node.material = Array.isArray(node.material) ? privateMats : privateMats[0];
              for (const material of privateMats) {
                if (tierDef.tintColor) material.color?.setHex(tierDef.tintColor);
                tintMaterials.push(material);
              }
            }
          });

          const scale = asset.scale * tierDef.scale;
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.7 / scale, 0.9 / scale, 24),
            new THREE.MeshBasicMaterial({
              color: tierDef.ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.02 / scale;
          fbx.add(ring);
          scene.add(fbx);

          const mixer = new THREE.AnimationMixer(fbx);
          const entry = {
            id: `qe_${Date.now()}_${i}_${Math.floor(Math.random() * 9999)}`,
            group: fbx, mixer,
            walkAction: null, idleAction: null,
            state: 'idle', stateTimer: Math.random() * 2,
            target: null, alive: true, hitCooldown: 0,
            tintMaterials, zoneCenter: [sx, 0, sz], zoneRadius: 6,
            home: [sx, fbx.position.y, sz], respawnAt: null,
            tier: tierDef.name,
            level: tierDef.name === 'champion' ? 8 : tierDef.name === 'elite' ? 5 : 3,
            hp: derived.maxHP, maxHp: derived.maxHP, derived,
            xpReward: tierDef.name === 'champion' ? 70 : tierDef.name === 'elite' ? 30 : 15,
            attackCooldown: Math.random() * 1.5, attacking: false, attackWindupTimer: 0,
            thinkInterval: 0.2 + Math.random() * 1.2, thinkTimer: Math.random() * 0.9,
            speedJitter: 0.85 + Math.random() * 0.3,
            idleVariance: 0.7 + Math.random() * 0.8,
            walkVariance: 0.7 + Math.random() * 0.8,
            isQuestSpawn: true,
            // GameWorld3D death cleanup MUST NOT dispose shared template geometry.
            // The unique ring geometry and per-enemy materials are disposed normally.
            sharedQuestGeometries,
            metadata: metadata ? { ...metadata } : null,
          };
          enemies.push(entry);
          if (typeof window !== 'undefined' && metadata) {
            window.dispatchEvent(new CustomEvent('axeRuntimeEnemySpawned', {
              detail: { enemyId: entry.id, metadata: entry.metadata },
            }));
          }
          Promise.all([walkClipPromise, idleClipPromise]).then(([walkClip, idleClip]) => {
            if (disposed || !entry.alive || !entry.group.parent) return;
            if (walkClip) {
              const action = mixer.clipAction(walkClip);
              action.setEffectiveTimeScale(0.55);
              entry.walkAction = action;
            }
            if (idleClip) {
              entry.idleAction = mixer.clipAction(idleClip);
              entry.idleAction.reset().fadeIn(0.2).play();
            }
          });
        },
        onError: (error, i) => console.warn('Game 3D quest enemy spawn failed', i, error),
        onComplete: ({ attempted, successful, failed }) => {
          waves.delete(wave);
          if (!disposed) {
            setEnemyCount(enemies.filter((enemy) => enemy.alive && !enemy.dying).length);
            if (typeof window !== 'undefined') {
              // Debug-only: timing, counts, no player identity or coordinates.
              window.__gw3dQuestSpawnMetrics = {
                attempted, successful, failed,
                elapsedMs: Math.round(now() - startedAt),
                reusedTemplate: true,
              };
            }
          }
        },
      });
      waves.add(wave);
    });
  }

  // Start a single lazy load after entry has settled. If a quest starts first,
  // that same in-flight promise is reused, never five parallel FBX parses.
  spawnQuestEnemies.prefetch = () => loadTemplate();
  if (typeof window !== 'undefined') {
    if (typeof window.requestIdleCallback === 'function') {
      idleType = 'idle';
      idleHandle = window.requestIdleCallback(() => { idleHandle = null; void loadTemplate(); }, { timeout: 4500 });
    } else {
      idleType = 'timer';
      idleHandle = window.setTimeout(() => { idleHandle = null; void loadTemplate(); }, 2500);
    }
  }

  spawnQuestEnemies.dispose = () => {
    disposed = true;
    if (idleHandle !== null && typeof window !== 'undefined') {
      if (idleType === 'idle') window.cancelIdleCallback?.(idleHandle);
      else window.clearTimeout(idleHandle);
    }
    for (const wave of waves) wave.cancel();
    waves.clear();
    // All world actors and the WebGLRenderer are torn down by GameWorld3D.
    // Drop our references; do not release geometry while any clone can render.
    template = null;
    templatePromise = null;
  };
  return spawnQuestEnemies;
}
