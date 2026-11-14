// Tiny store that carries OTS aim state to the HUD and the centre-screen ray to
// whoever needs to know where a shot would land.
//
// Only discrete changes (aiming on/off, shoulder side) notify React, so the
// 60fps ray update never re-renders the reticle.
const state = { aiming: false, side: 1, bowEquipped: false, blocked: false, ray: null };
const listeners = new Set();

export function getOTSAimState() {
  return state;
}

/** Notifies subscribers only when a visible value actually changed. */
export function publishOTSAim(patch = {}) {
  let changed = false;
  for (const key of ['aiming', 'side', 'bowEquipped', 'blocked']) {
    if (patch[key] !== undefined && state[key] !== patch[key]) {
      state[key] = patch[key];
      changed = true;
    }
  }
  if (changed) listeners.forEach((fn) => fn({ aiming: state.aiming, side: state.side, bowEquipped: state.bowEquipped, blocked: state.blocked }));
}

/** Per-frame centre-screen ray (origin, direction, world hit point). */
export function setOTSAimRay(ray) {
  state.ray = ray;
}

export function getOTSAimRay() {
  return state.ray;
}

export function subscribeOTSAim(fn) {
  listeners.add(fn);
  fn({ aiming: state.aiming, side: state.side, bowEquipped: state.bowEquipped, blocked: state.blocked });
  return () => listeners.delete(fn);
}