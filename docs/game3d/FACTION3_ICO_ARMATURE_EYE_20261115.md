# Faction 3 clone — Icosphere / armature / eyes (2026-11-15)

Scope: `marcusflow1-arch/gitsync-pro`, Faction 3 Fantasy Tiger (`faction_tiger`, owner GLB #160). No model, texture, skin weights, other factions, gameplay, or original repository mutated.

## Owner observation and reason for this pass

User-reported recording continued to show an incorrectly running/moving Faction 3 mount after two heading/retarget changes (#72/#74). User suspects Icosphere helper placement and armature influence, and requests eye controls for movement/blinking without destroying the eyes.

The uploaded #160 asset is documented as one 28-joint skin, 14 meshes, and an `Idle_Relaxed_Tail` clip. Those facts alone do **not** establish that its eye meshes or eyelid blendshapes are separately animatable. Its exact vertex weights and any eye morph target names have **not** been inspected in this execution environment. No claim is made that Icospheres are the established cause of sideways locomotion.

## Code changes

- **Bind-pose safety**: `alignFactionThreeWingBases` reports wing/shoulder offsets but **does not translate weighted wing bones**. The old code moved bones without rebaking inverse bind matrices; that can produce skin deformation. A truly misweighted or misplaced wing needs a source GLB armature/weight repair and re-export.
- **Icosphere attachment**: only small, unskinned, confidently near-tail/wing helper meshes are rigidly attached to their actual matching bone. Already-armature-linked helpers stay in place. Unknown Icospheres and anything near the head or named eye/pupil/iris/lid are protected. No geometry, skeleton inverse binds, or vertex weights are edited. Original parent transforms are restored when the rig is disposed.
- **Eye controls**: up to two invisible `IcosahedronGeometry` markers are added only at *identified* eye bones or separate eye meshes, not as replacement eyeballs. When an uploaded GLB has no separately identifiable eye targets, no marker is invented. When separate eye bones are present, they rotate no more than about 4 degrees left/right and 2.5 degrees vertically. When existing eyelid/blink morph channels are present, they receive a short periodic blink. In the absence of such controls **no eyelid is invented and no eye mesh is squashed or displaced**.
- **Shared update**: the eye pass is called after each mount's own mixer/secondary rig on both local and remote companions. Both are scoped to the `winged_faction_3_160` profile.

## Validation and limitations

Added `tests/game3d-faction3-ico-eye-rig.test.mjs` for bind-pose invariance, helper routing and eye preservation/morphs. **Native Node tests and signed-in visual Play remain unrun** here. The Base44 GLB is hosted remotely and was not available for local binary inspection; thus the eye blink channel count in the real #160 GLB is unknown. A closed-eye effect cannot honestly be promised until a supported morph/eyelid bone is found or properly authored in the source asset. Render/QA with Faction 3 walking and galloping toward camera, sideways pivots, wing/tail occlusion, facial close-up, and a second player remain required.

Do not interpret a passing source test as proof that the animal has stopped running sideways in the owner’s rendered scene. The mount heading logic, root transforms, and player controller are left unchanged in this scoped pass.
