import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame3DQuestSpawnWave } from '../src/components/game3d/performance/QuestSpawnWave.mjs';

function fakeFrames() {
  const jobs = new Map();
  let id = 0;
  return {
    requestFrame(fn) { jobs.set(++id, fn); return id; },
    cancelFrame(handle) { jobs.delete(handle); },
    frame() {
      const tasks = [...jobs.values()];
      jobs.clear();
      for (const fn of tasks) fn();
    },
    get pending() { return jobs.size; },
  };
}

test('five quest enemies are constructed across five different frames', () => {
  const frames = fakeFrames();
  const indices = [], complete = [];
  const wave = createGame3DQuestSpawnWave({
    count: 5,
    spawnOne(i) { indices.push(i); },
    onComplete(result) { complete.push(result); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
  });
  assert.equal(indices.length, 0);
  for (let i = 0; i < 5; i++) {
    frames.frame();
    assert.equal(indices.length, i + 1);
  }
  assert.deepEqual(indices, [0, 1, 2, 3, 4]);
  assert.deepEqual(complete, [{ attempted: 5, successful: 5, failed: 0 }]);
  assert.equal(wave.completed, true);
  assert.equal(frames.pending, 0);
});

test('disposing a world cancels any remaining quest wave frames', () => {
  const frames = fakeFrames();
  let spawned = 0;
  const wave = createGame3DQuestSpawnWave({
    count: 5,
    spawnOne() { spawned++; },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
  });
  frames.frame();
  wave.cancel();
  frames.frame();
  assert.equal(spawned, 1);
  assert.equal(frames.pending, 0);
});

test('a failing clone does not prevent later quest enemies spawning', () => {
  const frames = fakeFrames(), built = [], errors = [], results = [];
  createGame3DQuestSpawnWave({
    count: 5,
    spawnOne(i) {
      if (i === 1) throw new Error('simulated model failure');
      built.push(i);
    },
    onError(err, i) { errors.push([i, err.message]); },
    onComplete(result) { results.push(result); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
  });
  for (let i = 0; i < 5; i++) frames.frame();
  assert.deepEqual(built, [0, 2, 3, 4]);
  assert.deepEqual(errors, [[1, 'simulated model failure']]);
  assert.deepEqual(results, [{ attempted: 5, successful: 4, failed: 1 }]);
});

test('zero targets are a no-op and do not request a frame', () => {
  const frames = fakeFrames(), results = [];
  createGame3DQuestSpawnWave({
    count: 0, spawnOne() { assert.fail('unexpected spawn'); },
    onComplete(result) { results.push(result); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
  });
  assert.equal(frames.pending, 0);
  assert.deepEqual(results, [{ attempted: 0, successful: 0, failed: 0 }]);
});
