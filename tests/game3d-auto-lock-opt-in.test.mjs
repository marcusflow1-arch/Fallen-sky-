import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('nearby auto-target is disabled by default and an explicit persisted user choice', () => {
  const store = read('src/components/game3d/axe/player/AXEControlSettingsStore.js');
  assert.match(store, /AXE_CONTROL_SETTINGS_DEFAULTS = Object\.freeze\(\{ clickToMove: false, autoTargetNearby: false \}\)/);
  assert.match(store, /autoTargetNearby: saved\.autoTargetNearby === true/);
  assert.match(store, /export function isAXEAutoTargetNearbyEnabled\(\)/);
  assert.match(store, /export function setAXEAutoTargetNearbyEnabled\(enabled\)/);
});

test('camera releases automatic targets when the user disables nearby auto-lock', () => {
  const camera = read('src/components/game3d/player/PlayerCameraSystem.jsx');
  assert.match(camera, /const disabled=!global\|\|!isAXEAutoTargetNearbyEnabled\(\)\|\|/);
  assert.match(camera, /if\(disabled\)\{[\s\S]*?if\(current\?\.autoAcquired\)release\(current\)/);
  assert.match(camera, /else if\(current\)\{[\s\S]*?user-selected enemy or player/);
});

test('controls allow explicit opt-in and preserve manual middle-click lock-on', () => {
  const menu = read('src/components/game3d/PauseMenu.jsx');
  const world = read('src/components/game3d/GameWorld3D.jsx');
  assert.match(menu, /label="Automatically lock nearby enemies" checked=\{controls\.autoTargetNearby\}/);
  assert.match(menu, /setAXEAutoTargetNearbyEnabled\(!controls\.autoTargetNearby\)/);
  assert.match(world, /handleMiddleClick\(\{ event: e, renderer, camera/);
  assert.match(world, /lockOnTargetRef\.current = target/);
});
