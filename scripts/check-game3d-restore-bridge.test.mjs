import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalGame3DModelUrl, REQUIRED_GAME3D_MODEL_PATHS} from '../src/components/onboarding/legacyModelMirror.mjs';

test('every original authored Game 3D character path has a constrained read-only mirror', () => {
  assert.equal(REQUIRED_GAME3D_MODEL_PATHS.length, 9);
  for (const path of REQUIRED_GAME3D_MODEL_PATHS) {
    assert.equal(originalGame3DModelUrl(path), 'https://atomxeveos.base44.app' + path);
  }
});
test('never mirror arbitrary player URLs or suspicious filenames', () => {
  for (const input of [
    'https://example.com/characters/Adam.glb',
    '/models/characters/../../../secrets',
    '/models/characters/Injected_Fused.glb',
    '/models/characters/fused/Unknown.glb',
    '/models/characters/fused/Female_Fused_v2.gltf',
    null, undefined, '',
  ]) assert.equal(originalGame3DModelUrl(input), null);
});

test('world entry never implicitly saves the account avatar to a second Base44 app', () => {
  const content = readFileSync(new URL('../src/components/game3d/characterStore.jsx', import.meta.url), 'utf8');
  const entry = content.match(/export async function activateAndSyncToHUD\(id\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(entry, 'Game 3D entry activation must exist');
  assert.doesNotMatch(entry, /saveAppearance|\.functions\.invoke|fetch\(/, 'Play should not require external writes');
  assert.match(entry, /setActiveCharacter\(id\)/);
});

test('restored character creation uses original category controls and studio navigation', () => {
  const editor = readFileSync(new URL('../src/components/onboarding/CharacterAppearanceEditor.jsx', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/components/onboarding/CreatorStudio.jsx', import.meta.url), 'utf8');
  const login = readFileSync(new URL('../src/components/game3d/CharacterLoginScreen.jsx', import.meta.url), 'utf8');
  assert.match(editor, /CREATOR_BODY_PRESETS|SHAPE_CONTROLS/);
  assert.match(studio, /CreatorNavigation/);
  assert.doesNotMatch(login, /CharacterCreatorLayoutFix\.css/);
});
