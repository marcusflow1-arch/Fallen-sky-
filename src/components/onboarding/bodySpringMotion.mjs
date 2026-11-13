// Preview/player cosmetic dynamics. Integrates four bounded, damped springs;
// does not influence authoritative movement, damage, bones or saved appearance.
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// Frequency is angular stiffness (radians/second), not a frame-dependent
// animation rate. Faster settling than the original 10 rad/s lateral spring.
const channels = Object.freeze([
  Object.freeze({ name: 'chestLeft', frequency: 22.5, damping: .57, orbitHz: 3.05 }),
  Object.freeze({ name: 'chestRight', frequency: 21.7, damping: .59, orbitHz: 3.18 }),
  Object.freeze({ name: 'gluteLeft', frequency: 21.8, damping: .60, orbitHz: 2.95 }),
  Object.freeze({ name: 'gluteRight', frequency: 21.2, damping: .62, orbitHz: 3.02 }),
]);
export const BODY_SPRING_TUNING = Object.freeze({
  // Owner direction: approximately 80% response relative to mouse yaw speed.
  // This is a normalized turn-input gain, not a verified video speed match.
  turnResponse: .8,
  responseRate: 5.2,            // rad/s for full normalized mouse-turn input
  circleImpulse: .30,          // quick turn/stop/reversal triggers one small orbit
  circleDecay: 5.5,            // s^-1: settles rather than continuously looping
  circleLateral: .52,
  circleVertical: .72,
  // Additional Game 3D movement-directed sway: A moves the chest left,
  // D moves it right. Kept separate from the existing turn/gait/glute springs.
  chestStrafeResponse: .55,
  chestStrafeSpeed: 3.8,
});
export const BODY_SPRING_CHANNELS = channels.map(c => c.name);
const smooth = x => {
  const t = clamp(x, 0, 1);
  return t*t*(3-2*t);
};
// Artist-morph spatial envelope: independent right/left, only supported
// chest or lower-glute geometry. Every weight is zero outside the sculpt.
export function bodySpringVertexWeight({ region, side, lateral, height, sculptFraction }) {
  if (!['chest', 'glutes'].includes(region) || ![-1, 1].includes(side) ||
      ![lateral, height, sculptFraction].every(finite)) return 0;
  const anatomical = region === 'chest'
    ? smooth((height-.17)/.19) * (1-smooth((height-.87)/.15))
    : (1-smooth((height+.06)/.31));
  return smooth((sculptFraction-.015)/.56) *
    smooth((side*lateral+.015)/.11) * anatomical;
}

export function createBodySpringState() {
  return {
    initialized: false, x: 0, z: 0, yaw: 0, speed: 0, travel: 0, lastTurn: 0,
    lastChestStrafe: 0,
    values: channels.map(() => 0), velocities: channels.map(() => 0),
    // Paired lateral/vertical paths make real small circular/elliptical
    // displacement rather than rotating the entire chest or pelvis.
    springValues: channels.map(() => 0),
    verticalValues: channels.map(() => 0),
    verticalBase: channels.map(() => 0),
    verticalVelocities: channels.map(() => 0),
    circleEnergy: channels.map(() => 0),
    circlePhase: channels.map((_, i) => i * .22),
  };
}
export function clearBodySpringState(state) {
  state.initialized = false;
  state.speed = 0;
  state.travel = 0;
  state.lastTurn = 0;
  state.lastChestStrafe = 0;
  state.values.fill(0);
  state.velocities.fill(0);
  state.springValues.fill(0);
  state.verticalValues.fill(0);
  state.verticalBase.fill(0);
  state.verticalVelocities.fill(0);
  state.circleEnergy.fill(0);
  state.circlePhase.forEach((_, i) => { state.circlePhase[i] = i * .22; });
  return state.values;
}
export function stepBodySpring(state, {
  x, z, yaw, dt, reducedMotion = false, cameraRight = null,
} = {}) {
  if (!state || ![x,z,yaw,dt].every(finite) || dt <= 0 ||
      dt > .25 || reducedMotion) {
    if (state) clearBodySpringState(state);
    return state?.values || [0, 0, 0, 0];
  }
  if (!state.initialized) {
    state.x = x; state.z = z; state.yaw = yaw;
    state.initialized = true;
    return state.values;
  }
  const dx = x-state.x, dz = z-state.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 2.6) {
    clearBodySpringState(state);
    state.x = x; state.z = z; state.yaw = yaw;
    state.initialized = true;
    return state.values;
  }
  const angle = Math.atan2(Math.sin(yaw-state.yaw), Math.cos(yaw-state.yaw));
  const turnRate = clamp(angle / dt, -7.5, 7.5);
  const turn = clamp(turnRate / BODY_SPRING_TUNING.responseRate, -1, 1);
  const turnChange = Math.abs(turn - state.lastTurn);
  const speed = clamp(distance / dt, 0, 11);
  const acceleration = clamp(speed - state.speed, -4, 4);
  // Camera-local horizontal travel is independent of character facing.
  // The avatar can rotate to face its travel direction; its torso yaw alone
  // would then misclassify A/D motion as forward. Signed displacement along
  // camera-right preserves the requested on-screen left/right response.
  // No camera? Existing secondary motion behaves exactly as before.
  const rx = cameraRight?.x, rz = cameraRight?.z;
  const rightLength = finite(rx) && finite(rz) ? Math.hypot(rx, rz) : 0;
  const chestStrafe = rightLength > .001
    ? clamp((dx*rx+dz*rz)/(rightLength*dt*BODY_SPRING_TUNING.chestStrafeSpeed),-1,1)
    : 0;
  const chestStrafeChange = Math.abs(chestStrafe-state.lastChestStrafe);
  state.x = x; state.z = z; state.yaw = yaw;
  state.travel += distance;
  state.speed = speed;
  state.lastTurn = turn;
  state.lastChestStrafe = chestStrafe;

  // Turning follows the mouse immediately, then the fast underdamped springs
  // catch up. A change of direction or release injects a small one-turn
  // circular rebound which dies out (not perpetual exaggerated bouncing).
  const gain = BODY_SPRING_TUNING.turnResponse;
  const gait = Math.sin(state.travel * 8.1) * Math.min(1, speed / 3.8);
  const surge = clamp(acceleration * .034, -.14, .14);
  const lateral = [
    gain * turn + surge + gait * .10 +
      BODY_SPRING_TUNING.chestStrafeResponse * chestStrafe,
    gain * turn * .96 + surge * .9 + gait * .085 +
      BODY_SPRING_TUNING.chestStrafeResponse * chestStrafe * .96,
    gain * turn * .92 + surge * .8 + gait * .13,
    gain * turn * .89 + surge * .78 + gait * .12,
  ];
  const vertical = [
    gait * .11 - Math.abs(turn) * .055,
    gait * -.10 - Math.abs(turn) * .053,
    gait * .13 - Math.abs(turn) * .04,
    gait * -.12 - Math.abs(turn) * .036,
  ];

  // Substep the springs at 120 Hz to prevent high-frequency flutter at 30 FPS.
  const steps = Math.ceil(dt / (1 / 120)), h = dt / steps;
  for (let i = 0; i < channels.length; i++) {
    const spec = channels[i];
    state.circleEnergy[i] = clamp(
      state.circleEnergy[i] * Math.exp(-BODY_SPRING_TUNING.circleDecay * dt) +
      (turnChange + (i < 2 ? chestStrafeChange * .45 : 0)) *
        BODY_SPRING_TUNING.circleImpulse, 0, .28);
    state.circlePhase[i] += dt * 2 * Math.PI * spec.orbitHz;
  }
  for (let n = 0; n < steps; n++) {
    for (let i = 0; i < channels.length; i++) {
      const { frequency, damping } = channels[i];
      const stiffness = frequency * frequency, dampingTerm = 2 * damping * frequency;
      state.velocities[i] = clamp(state.velocities[i] +
        (stiffness * (lateral[i] - state.springValues[i]) -
          dampingTerm * state.velocities[i]) * h, -10, 10);
      state.springValues[i] = clamp(state.springValues[i] +
        state.velocities[i] * h, -.78, .78);
      state.verticalVelocities[i] = clamp(state.verticalVelocities[i] +
        (stiffness * (vertical[i] - state.verticalBase[i]) -
          dampingTerm * state.verticalVelocities[i]) * h, -10, 10);
      state.verticalBase[i] = clamp(state.verticalBase[i] +
        state.verticalVelocities[i] * h, -.78, .78);
    }
  }
  for (let i = 0; i < channels.length; i++) {
    const energy = state.circleEnergy[i], phase = state.circlePhase[i];
    state.values[i] = clamp(state.springValues[i] +
      energy * BODY_SPRING_TUNING.circleLateral * Math.cos(phase), -.78, .78);
    state.verticalValues[i] = clamp(state.verticalBase[i] +
      energy * BODY_SPRING_TUNING.circleVertical * Math.sin(phase), -.78, .78);
  }
  return state.values;
}
