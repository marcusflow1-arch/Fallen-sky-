# Game 3D clone — movement while holding and releasing a bow (Nov 15, 2026)

## Owner request
Continue moving while drawing, holding indefinitely, aiming and firing the charged bow. This also applies in narrow gameplay spaces such as hallways, subject to actual world collision. A shot is not a movement stun.

## Source-level defect
`GameWorld3D` calculates real, collision-checked WASD movement every frame, but `LunaDashboardPlayerController.isMovementOverridden()` previously returned `isBusy || isDead`. A release animation (`aimRecoil` / `drawArrow`) sets `isBusy=true`, which stopped the character's movement for the entire animation even though a bow shot should not stop walking. Also, the left-click charge had not been included in the animation's `aiming` state; only holding the right mouse button enabled the aim-walk movement clips.

## Fix, clone only
- The controller marks **only a genuine ranged release/recoil** (`!melee && equipment.weaponType==='bow'`) as a movement-allowed busy action. Collision, map boundaries, camera movement, jump/roll/dodge, and non-bow combat locks are not bypassed.
- A bow shot preserves its actual release pose for the first **120 ms**. If the player is moving, their existing aim-walk or strafe clip then fades in. Stationary players keep the full release montage.
- During left-click hold, the movement animation considers the bow drawn/aimed even if right click is not pressed; the existing directional aim-walk clips are used for W/A/S/D.
- A moving player keeps camera-relative bow facing instead of snapping to travel direction during the draw. The full charge still waits for left-click release and stays at 100% after **1.2s**, regardless of movement.
- Other animation states reset the ranged movement exemption to avoid turning hit reactions, melee swings, rolls, or death into unintended mobile states.
- No manual disabling of environmental collisions, no character teleports, no new weapon damage multiplier, and no collision bypass through an actual hallway fire prop or wall.

## Test and QA
- `node --test tests/game3d-clone-bow-movement-during-charge.test.mjs` validates movement freedom, real busy locks, 120ms footwork handoff, no charge reset, world input/animation wiring and menu cancellation.
- **7/7 isolated pure-rule/source-contract tests passed.** A separate isolated simulated player animation controller/mixer exercise returned **10/10 expected state transitions**, including bow release moving immediately, aim-walk-left at 150ms, busy timeout, and melee still restricting movement.
- **Not yet verified**: full npm build, real browser collisions, 3D animation appearance and gameplay input on the deployed Base44 clone. After GitHub sync, test drawing a bow and moving W/A/S/D, including strafing in a hallway; release while moving, verify only one arrow, full-charge damage and no movement stutter. Confirm actual environmental obstacles remain solid.
- Original `marcusflow1-arch/atom-x-eve-os` untouched.
