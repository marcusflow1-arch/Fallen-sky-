// Manual-only assist for Game 3D mouse-wheel-button (middle click) targeting.
// This is an invisible narrow line in the direction the player looks, not an
// autonomous target scan. It never changes the target without a user click.
export const GAME3D_FACING_TARGET_LINE = Object.freeze({
  maxRange: 30,
  minForward: 0.35,
  nearHalfWidth: 0.65,
  maxHalfWidth: 1.35,
  halfAngleDegrees: 7,
});

export function chooseManualFacingTarget({
  origin, yaw, candidates = [], canSee = () => true,
  range = GAME3D_FACING_TARGET_LINE.maxRange,
} = {}) {
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.z) ||
    !Number.isFinite(yaw) || !Number.isFinite(range) || range <= 0) return null;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const maxSlope = Math.tan(GAME3D_FACING_TARGET_LINE.halfAngleDegrees * Math.PI / 180);
  const seen = new Set();
  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const group = candidate?.group;
    const point = group?.position;
    if (candidate?.id == null || !point || group.visible === false ||
      (typeof candidate.aliveRef === 'function' && !candidate.aliveRef())) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
    const key = String(candidate.kind || '') + ':' + String(candidate.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const dx = point.x - origin.x;
    const dz = point.z - origin.z;
    const forward = dx * forwardX + dz * forwardZ;
    if (forward < GAME3D_FACING_TARGET_LINE.minForward || forward > range) continue;
    const lateral = Math.abs(dx * forwardZ - dz * forwardX);
    const width = Math.min(GAME3D_FACING_TARGET_LINE.maxHalfWidth,
      Math.max(GAME3D_FACING_TARGET_LINE.nearHalfWidth, forward * maxSlope));
    if (lateral > width || !canSee(candidate)) continue;
    // Prefer a character nearest the aim line, rather than a closer character
    // standing off to the side. Use distance only to resolve similarly aligned actors.
    const score = lateral + forward * 0.015;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
