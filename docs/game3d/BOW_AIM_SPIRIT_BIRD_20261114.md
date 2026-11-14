# Game 3D — Bow aim repair and original spirit-bird shot effect (2026-11-14)

## Video reference

The owner's 30-second bow reference video, `2026-11-14 06-51-02.mp4`, shows over-the-shoulder bow aiming in a foggy forest, a tiny amber point near the centre of aim, and sweeping light effects near the aim path. The requested **diving bird** is a new art direction inspired by the described motion; the source clip is not imported as game art or animation data.

## Defect and implementation

Before this change, Game 3D could select the nearest hostile from a **150° character-facing fan** even while a bow was aimed using the camera. The separate boss bridge had a **33° camera-assist cone**, and on mouse release its charged-shot code could independently register a hit after the click was already processed. Thus the crosshair was not reliably tied to target selection.

- `src/components/game3d/combat/BowCameraAim.mjs`: targets living enemies, rogues and bosses at the tiny centre reticle. Raycast geometry takes priority, with a narrow edge grace for small models and a slightly wider allowance for explicit lock. Enforces the **existing** 12m `RANGED_ATTACK_RANGE` and checks actual terrain/building line-of-sight; no remote player or friendly auto-target.
- `rogueAttackBridge.jsx`: boss, rogue and ordinary enemy target priority now shares that same camera-ray winner; no boss or rogue can steal an arrow through another enemy. The bridge captures charges only from the actual Game 3D canvas when a bow is equipped and in valid play mode. On release, **only a previously verified boss/rogue hit** may receive a capped charge bonus. No ghost hit on an empty click, cooldown, or stale target. Melee maintains its existing target/area rules.
- `src/components/game3d/vfx/Game3DBowSpiritBird.mjs`: compact **original** low-poly spirit falcon that lifts off near the archer, beats its wings and curves down toward the exact aim point on a short Bézier dive. Capped at six active birds; resources removed at effect end and world unmount. The animation is purely visual; it cannot apply hit points, criticals, XP, loot, quest credit or multiplayer damage.
- Original main Game 3D gets a **3–4px gold aim dot** while the bow is equipped, plus four short brackets that flash only when damage was confirmed.
- Clone Game 3D already has a dedicated OTS camera/reticle. Do **not** overlay a second dot: preserve its existing `OTSAimReticle` and add only separate confirmed-hit brackets and diving bird, while mapping the reticle's actual camera centre to bow combat.
- Existing AoE multi-target skills, character facing/melee, other weapons, mount mode, locking controls, enemy stats, server-authoritative duel damage, and manual camera movement remain separate from this effect.

## Review checklist

Automated regression coverage: exact vs off-axis targeting, dead/hidden/out-of-range rejection, wall occlusion, finite empty-aim endpoint, VFX cap and disposal, no phantom boss/rogue release damage, and source wiring. The PR adds a scoped GitHub Actions workflow that runs the test and `npm run build`.

**Rendered Play QA still required**: aim with bow across open ground, behind a wall, into a tree/cliff and at overlapping boss/normal enemies; shoot an empty space; click while the backpack/services menu is open; verify brief hit-marker only for landed damage; confirm bird wing beat/swoop at idle, walking and over-the-shoulder camera while switching shoulders on the clone; test one ranged AoE, a legal PvP duel, low-FPS systems, mounts and web/mobile pointer controls.

Merging a GitHub PR does **not** automatically update the Base44 editor preview. No in-game verified video after the change was available during this commit.
