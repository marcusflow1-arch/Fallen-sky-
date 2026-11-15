// Drawing and releasing a bow is a combat action, NOT a movement stun.
// Keep real death, dodge, rolls, jumps and enemy crowd-control independent.
export const BOW_RELEASE_FOOTWORK_BLEND_SECONDS = 0.12;

export function blocksBowMovement({
  busy = false, dead = false, bowAttackActive = false,
} = {}) {
  return !!dead || (!!busy && !bowAttackActive);
}

// After a brief release/recoil pose, resume actual run/strafe legs when the
// player is moving. Full-body attack clips stay intact for stationary shots.
export function shouldBlendBowFootwork({
  bowAttackActive = false, moving = false, elapsedSeconds = 0,
} = {}) {
  return !!bowAttackActive && !!moving &&
    Number.isFinite(elapsedSeconds) &&
    elapsedSeconds >= BOW_RELEASE_FOOTWORK_BLEND_SECONDS;
}

// Hold-to-draw is independent of locomotion; only genuine world/menu restrictions
// can cancel a draw. This is for gamepad/keyboard as well as mouse users.
export function shouldUseBowAimingLocomotion({
  drawn = false, bowEquipped = false, mounted = false, aimHeld = false,
} = {}) {
  return !!aimHeld || (!!drawn && !!bowEquipped && !mounted);
}
