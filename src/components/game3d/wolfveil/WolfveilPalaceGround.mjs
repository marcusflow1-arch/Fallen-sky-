import { WOLFVEIL_PALACE, WOLFVEIL_PALACE_APPROACH } from './WolfveilPalaceLayout.mjs';

/**
 * Shared, game-3D-only terrain contract for the reused Luna mansion.
 *
 * The imported manor has a +0.127m internal group lift. Its actual stone
 * foundation bottom is -0.030m relative to the Wolfveil palace root.
 * Preserve the original root height (natural center +0.15m); bring the
 * PHYSICAL terrain to within +0.025m of the foundation underside. Never
 * raise a visual-only fake floor over the collision heightfield.
 */
export const WOLFVEIL_PALACE_GRADE = Object.freeze({
  revision: 2,
  rootLift: 0.15,
  sourceFoundationBottom: -0.030,
  foundationEmbed: 0.025,
  footprintOverhang: 4, // covers BOTH terrain grid vertices beside every house wall
  approachInset: 2.73,
  lateralFeather: 20,
  frontFeather: 24,
  rearFeather: 20,
  pathCoreHalfWidth: WOLFVEIL_PALACE_APPROACH.width / 2 + 1.4,
  pathFeather: 12,
  pathStartFeather: 5,
  pathEndFeather: 4,
});

const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth01 = t => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};

export function palaceRootY(naturalCenterY) {
  return naturalCenterY + WOLFVEIL_PALACE_GRADE.rootLift;
}

/** Terrain is deliberately 2.5cm INSIDE the bottom of the stone foundation. */
export function palaceGroundContactY(naturalCenterY) {
  const s = WOLFVEIL_PALACE_GRADE;
  return palaceRootY(naturalCenterY) + s.sourceFoundationBottom + s.foundationEmbed;
}

/** Clone: halve the natural rise of the mountain BEHIND the large Luna house.
 * Start beyond the mansion's rear foundation; feather at all boundaries.
 * The front stairs and physical foundation contact grade remain untouched.
 * All game movement/terrain/vegetation sample the same analytical height.
 */
export const WOLFVEIL_PALACE_REAR_MOUNTAIN = Object.freeze({
  reduction: 0.50,
  startZ: WOLFVEIL_PALACE.z + WOLFVEIL_PALACE.depth/2 + 6,
  fullZ: WOLFVEIL_PALACE.z + WOLFVEIL_PALACE.depth/2 + 42,
  fadeStartZ: 265,
  endZ: 380,
  coreHalfWidth: 78,
  sideFeather: 48,
});

export function gradeWolfveilPalaceRearMountain(x, z, naturalY, rearReferenceY) {
  if (![x,z,naturalY,rearReferenceY].every(Number.isFinite)) return naturalY;
  const s=WOLFVEIL_PALACE_REAR_MOUNTAIN;
  if (z<=s.startZ || z>=s.endZ || Math.abs(x)>=s.coreHalfWidth+s.sideFeather)
    return naturalY;
  const front=smooth01((z-s.startZ)/(s.fullZ-s.startZ));
  const rear=1-smooth01((z-s.fadeStartZ)/(s.endZ-s.fadeStartZ));
  const side=1-smooth01((Math.abs(x)-s.coreHalfWidth)/s.sideFeather);
  // Halve only the positive rise over the ground at the rear of the manor;
  // do not create depressions in areas that were already lower.
  const rise=Math.max(0,naturalY-rearReferenceY);
  return naturalY-rise*s.reduction*front*rear*side;
}

/**
 * Same analytical height is used by visible terrain, render ground-contact
 * checks, traversable path geometry, and the authoritative Wolfveil worker.
 * It grades a real filled platform beneath every foundation edge and blends
 * it into the unchanged hill on all sides. The long approach gradually gains
 * the extra elevation before it meets the seven real Luna entrance steps.
 */
export function gradeWolfveilPalaceTerrain(x, z, naturalY, naturalCenterY, naturalJoinY) {
  if (![x, z, naturalY, naturalCenterY, naturalJoinY].every(Number.isFinite))
    return naturalY;
  const s = WOLFVEIL_PALACE_GRADE, p = WOLFVEIL_PALACE;
  const target = palaceGroundContactY(naturalCenterY);
  const south = WOLFVEIL_PALACE_APPROACH.toZ - s.approachInset;
  const north = p.z + p.depth / 2 + s.footprintOverhang;
  const halfWidth = p.width / 2 + s.footprintOverhang;

  // Soil beneath the entire building and exterior Luna entry treads.
  const sideWeight = 1 - smooth01((Math.abs(x) - halfWidth) / s.lateralFeather);
  const southWeight = smooth01((z - (south - s.frontFeather)) / s.frontFeather);
  const northWeight = 1 - smooth01((z - north) / s.rearFeather);
  const padWeight = sideWeight * southWeight * northWeight;

  // Preserve the natural hill's small contours while easing the approach up
  // to the foundation grade. No path collision-height/visual mismatch.
  const start = WOLFVEIL_PALACE_APPROACH.fromZ;
  const progress = smooth01((z - start) / (south - start));
  const pathSide = 1 - smooth01((Math.abs(x) - s.pathCoreHalfWidth) / s.pathFeather);
  const pathStart = smooth01((z - start) / s.pathStartFeather);
  const pathEnd = 1 - smooth01((z - south) / s.pathEndFeather);
  const pathWeight = pathSide * pathStart * pathEnd;
  const pathHeight = naturalY + (target - naturalJoinY) * progress;
  const approachedY = naturalY + (pathHeight - naturalY) * pathWeight;
  return approachedY * (1 - padWeight) + target * padWeight;
}
