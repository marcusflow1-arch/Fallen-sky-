import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame3DSceneWarmup } from '../src/components/game3d/performance/SceneWarmup.mjs';

function node(children = [], extra = {}) {
  const result = { children, ...extra };
  for (const child of children) child.parent = result;
  result.traverse = (visit) => { visit(result); for (const child of children) child.traverse(visit); };
  return result;
}
function mock() {
  const calls = { compiled: [], textures: [] };
  const material = { map: { isTexture: true, image: {} } };
  const mesh = node([], { isMesh: true, material });
  const scene = node([mesh]);
  let tick = null;
  let cancelled = false;
  const host = {
    setTimeout(fn) { tick = fn; return 1; },
    clearTimeout() { cancelled = true; },
    addEventListener() {}, removeEventListener() {},
    __localPlayerPos: { x: 0, z: 0 }, __gw3dEnemies: [],
  };
  const renderer = {
    compileAsync: async (root) => { calls.compiled.push(root); },
    initTexture: (texture) => { calls.textures.push(texture); },
  };
  return { calls, material, mesh, scene, renderer, host, next: async () => {
    const fn = tick; tick = null;
    if (fn) await fn();
  }, get cancelled() { return cancelled; } };
}

test('prepares newly attached scene meshes and textures without blocking startup', async () => {
  const m = mock();
  const manager = createGame3DSceneWarmup({ scene: m.scene, camera: {}, renderer: m.renderer, host: m.host });
  await m.next();
  assert.equal(m.calls.compiled[0], m.mesh);
  assert.equal(m.calls.textures[0], m.material.map);
  const extra = node([], { isMesh: true, material: {} });
  m.scene.children.push(extra); extra.parent = m.scene;
  // Next cycle rescans the scene after the bounded interval.
  await new Promise((r) => setTimeout(r, 2650));
  await m.next();
  assert.ok(m.calls.compiled.includes(extra));
  manager.dispose();
  assert.equal(m.cancelled, true);
});

test('prioritizes nearby enemy roots and ignores far enemies', async () => {
  const m = mock();
  const near = node([], { isMesh: true, material: {} });
  const enemyRoot = node([near], { position: { x: 10, z: 10 } });
  m.host.__gw3dEnemies = [{ group: enemyRoot }];
  const manager = createGame3DSceneWarmup({ scene: m.scene, camera: {}, renderer: m.renderer, host: m.host });
  await m.next();
  assert.equal(m.calls.compiled[0], near);
  manager.dispose();
});

test('quest enemies in combat range reserve frame time for actual gameplay', async () => {
  const m = mock();
  m.host.__gw3dEnemies = [{
    isQuestSpawn: true, alive: true, dying: false,
    group: { visible: true, position: { x: 12, z: 2 } },
  }];
  const manager = createGame3DSceneWarmup({
    scene: m.scene, camera: {}, renderer: m.renderer, host: m.host,
  });
  await m.next();
  assert.equal(m.calls.compiled.length, 0);
  assert.equal(m.calls.textures.length, 0);
  m.host.__gw3dEnemies[0].alive = false;
  await m.next();
  assert.equal(m.calls.compiled[0], m.mesh);
  manager.dispose();
});
