import * as THREE from 'three';
import { setTarget, clearTarget } from './abilityStore';
import { chooseManualFacingTarget } from './player/manualFacingTargetLine.mjs';

const cursorRay = new THREE.Raycaster();
const sightRay = new THREE.Raycaster();
const eye = new THREE.Vector3();
const aimPoint = new THREE.Vector3();
const look = new THREE.Vector3();
const projected = new THREE.Vector3();

// The two deliberate selection gestures share the same target contract.
// Left click raycasts the actual visible actor beneath the cursor; middle
// click ignores the cursor and picks one actor on a narrow facing line.
// Neither path scans autonomously or opens/closes the social context panel.
export function handleMiddleClick({
  event, renderer, camera, enemies = [], remoteManager,
  rogues = [], bosses = [], npcs = [], groundMeshes = [],
  mode = 'cursor', origin = null, yaw = 0, currentTarget = null,
  clearOnMiss = true, toggleOnSame = true,
}) {
  const candidates = [];
  const add = (actor, kind) => {
    if (!actor?.group || actor.id == null || actor.group.visible === false ||
      actor.alive === false || actor.dying || actor.defeated) return;
    const name = actor.name || actor.bossName || (kind === 'npc' ? 'Quest NPC' : 'Enemy');
    candidates.push({
      id: actor.id, group: actor.group, name, kind,
      hp: actor.hp, maxHp: actor.maxHp, level: actor.level,
      bossName: actor.bossName || null,
      tier: actor.tier || kind,
      aliveRef: () => actor.alive !== false && !actor.dying &&
        !actor.defeated && actor.group?.visible !== false,
    });
  };
  enemies.forEach(actor => add(actor, 'enemy'));
  rogues.forEach(actor => add(actor, 'rogue'));
  bosses.forEach(actor => add(actor, 'boss'));
  npcs.forEach(actor => add(actor, 'npc'));

  const remotes = remoteManager?.getRemotes?.();
  if (remotes && typeof remotes.forEach === 'function') {
    remotes.forEach((remote, id) => {
      if (!remote?.group || remote.group.visible === false || id == null) return;
      candidates.push({
        id, group: remote.group, name: remote.name || 'Player', kind: 'player',
        aliveRef: () => !!remoteManager?.getRemotes?.()?.has(id) &&
          remote.group.visible !== false,
      });
    });
  }

  let chosen = null;
  if (mode === 'facing') {
    camera.updateMatrixWorld?.();
    const canSee = candidate => {
      const p = candidate.group.getWorldPosition?.(aimPoint) || aimPoint.copy(candidate.group.position);
      // Check that the character is actually on screen in front of the camera.
      projected.copy(p).add(new THREE.Vector3(0, 1, 0)).project(camera);
      if (projected.z < -1 || projected.z > 1 ||
        Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return false;
      if (!Array.isArray(groundMeshes) || !groundMeshes.length) return true;
      camera.getWorldPosition(eye);
      look.copy(p).add(new THREE.Vector3(0, 1, 0)).sub(eye);
      const distance = look.length();
      if (distance <= 0.8) return true;
      sightRay.set(eye, look.multiplyScalar(1 / distance));
      sightRay.near = 0.12;
      sightRay.far = distance - 0.35;
      return !sightRay.intersectObjects(groundMeshes, true)
        .some(hit => hit?.object?.visible !== false && Number.isFinite(hit.distance));
    };
    chosen = chooseManualFacingTarget({ origin, yaw, candidates, canSee });
  } else {
    const bounds = renderer?.domElement?.getBoundingClientRect?.();
    if (bounds?.width > 0 && bounds?.height > 0) {
      const captured = typeof document !== 'undefined' &&
        document.pointerLockElement === renderer.domElement;
      const x = captured ? 0 : ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = captured ? 0 : -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      cursorRay.setFromCamera({ x, y }, camera);
      const meshOwners = new Map();
      for (const candidate of candidates) {
        candidate.group.traverse?.(node => {
          if (node.isMesh && node.visible !== false) meshOwners.set(node, candidate);
        });
      }
      const hits = cursorRay.intersectObjects([...meshOwners.keys()], false);
      chosen = hits.map(hit => meshOwners.get(hit.object)).find(Boolean) || null;
    }
  }

  if (!chosen) {
    if (clearOnMiss) clearTarget();
    return null;
  }
  if (toggleOnSame && currentTarget &&
      String(currentTarget.id) === String(chosen.id) &&
      currentTarget.kind === chosen.kind) {
    clearTarget();
    return null;
  }
  setTarget({
    id: chosen.id, name: chosen.name, kind: chosen.kind,
    hp: chosen.hp, maxHp: chosen.maxHp, level: chosen.level,
    tier: chosen.tier, bossName: chosen.bossName,
  });
  return {
    id: chosen.id, group: chosen.group, name: chosen.name, kind: chosen.kind,
    aliveRef: chosen.aliveRef,
  };
}
