// Frame-budgeted quest spawn wave: at most one actor constructed per frame.
// Pure orchestration so it can be tested without a browser or Three.js.
export function createGame3DQuestSpawnWave({
  count, spawnOne, onComplete = () => {}, onError = () => {},
  requestFrame = (fn) => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16),
  cancelFrame = (handle) => typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(handle) : clearTimeout(handle),
}) {
  const target = Math.max(0, Math.floor(Number(count) || 0));
  let current = 0;
  let successful = 0;
  let cancelled = false;
  let handle = null;

  function tick() {
    handle = null;
    if (cancelled) return;
    try {
      spawnOne(current);
      successful++;
    } catch (error) {
      onError(error, current);
    }
    current++;
    if (current < target) {
      handle = requestFrame(tick);
    } else if (!cancelled) {
      onComplete({ attempted: current, successful, failed: current - successful });
    }
  }

  if (target) {
    handle = requestFrame(tick);
  } else {
    onComplete({ attempted: 0, successful: 0, failed: 0 });
  }

  return {
    cancel() {
      cancelled = true;
      if (handle !== null) cancelFrame(handle);
      handle = null;
    },
    get completed() { return current === target; },
  };
}
