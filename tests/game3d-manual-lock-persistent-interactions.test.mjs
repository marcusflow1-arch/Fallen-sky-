import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chooseManualFacingTarget, GAME3D_FACING_TARGET_LINE,
} from '../src/components/game3d/player/manualFacingTargetLine.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const here = { x: 0, z: 0 };
const actor = (id, x, z, kind = 'enemy', options = {}) => ({
  id, kind, group: { visible: true, position: { x, y: 0, z } },
  aliveRef: () => true, ...options,
});
const pick = (candidates, opts = {}) =>
  chooseManualFacingTarget({ origin: here, yaw: 0, candidates, ...opts });

test('pressing middle mouse selects only from a narrow facing line, not by proximity', () => {
  assert.equal(GAME3D_FACING_TARGET_LINE.halfAngleDegrees, 7);
  assert.equal(GAME3D_FACING_TARGET_LINE.maxRange, 30);
  assert.equal(pick([actor('beside', 1.6, -4)]), null);
  assert.equal(pick([actor('behind', 0, 3)]), null);
  assert.equal(pick([actor('too-far', 0, -40)]), null);
  assert.equal(pick([actor('dead', 0, -4, 'enemy', { aliveRef: () => false })]), null);
  assert.equal(pick([actor('hidden', 0, -4, 'enemy', { group: { visible: false, position: { x: 0, z: -4 } } })]), null);
  assert.equal(pick([actor('front', 0, -6)])?.id, 'front');
});

test('manual line works for enemies, bosses, NPCs, and remote players', () => {
  for (const kind of ['enemy', 'rogue', 'boss', 'npc', 'player']) {
    assert.equal(pick([actor(kind, 0, -5, kind)])?.kind, kind);
  }
  assert.equal(pick([actor('front', 0, -6), actor('off-axis', 0.8, -3)])?.id, 'front');
  assert.equal(pick([actor('blocked', 0, -4)], { canSee: () => false }), null);
  assert.equal(pick([actor('turn', 0, -5)], { yaw: Math.PI }), null);
  assert.equal(chooseManualFacingTarget({ origin: here, yaw: NaN, candidates: [actor('front', 0, -5)] }), null);
  assert.equal(pick([actor('invalid', Infinity, -3)]), null);
});

test('camera never autonomously acquires an Eve or Adam opponent', () => {
  const camera = read('src/components/game3d/player/PlayerCameraSystem.jsx');
  const world = read('src/components/game3d/GameWorld3D.jsx');
  assert.doesNotMatch(camera, /chooseEveAdamAutoTarget|updateEveAdamAutoLock/);
  assert.match(camera, /inherited\?\.autoAcquired/);
  assert.match(world, /mode: 'cursor'/);
  assert.match(world, /mode: 'facing'/);
  assert.match(world, /clearOnMiss: false, toggleOnSame: false/);
  assert.match(world, /clearOnMiss: true, toggleOnSame: true/);
  assert.match(world, /npcCandidates/);
  assert.match(world, /yaw: orbit\.current\.yaw/);
  assert.match(world, /currentTarget\.kind !== 'npc' && currentTarget\.kind !== 'player'/);
  assert.match(world, /x: captured \? 0/);
});

test('mouse targeting sets/clears the real ability target without opening a context menu', () => {
  const hit = read('src/components/game3d/middleClickHandler.jsx');
  assert.match(hit, /setTarget\(\{/);
  assert.match(hit, /clearTarget\(\)/);
  assert.match(hit, /chooseManualFacingTarget\(\{/);
  assert.match(hit, /cursorRay\.intersectObjects/);
  assert.match(hit, /groundMeshes/);
  assert.doesNotMatch(hit, /setPlayerMenu/);
});

test('right-click pet/mount and player panels persist until X, Escape or action', () => {
  const menu = read('src/components/game3d/PlayerInteractionMenu.jsx');
  const world = read('src/components/game3d/GameWorld3D.jsx');
  assert.match(world, /setPlayerMenu\(\{ \.\.\.picked \}\)/);
  assert.match(world, /document\.exitPointerLock\?\.\(\)/);
  assert.match(menu, /window\.addEventListener\('keydown', escape, true\)/);
  assert.match(menu, /onClick=\{event => event\.stopPropagation\(\)\}/);
  assert.match(menu, /onClick=\{onClose\}/);
  assert.match(menu, /onAction\?\.\(/);
  assert.match(menu, /onClose\?\.\(\)/);
  assert.doesNotMatch(menu, /onClick=\{onClose\} onContextMenu=/);
});
