# Clone Game 3D — world-wide ULTRA MAX · Living Ultra-Sumi + 3× flame grass
Date: November 14, 2026. This is a **clone-only graphics migration**, not a gameplay/terrain merge.

## What the owner requested
Move the *main game's combined Atomic Ultra-Sumi + Sanctuary energy material
setting* into the test/clone Game 3D scene. Activate it by default across
the outdoor world. Scale the flame/grass appearance to approximately
three times the current height.

## Files moved from main
Only the compatible art-style shader/runtime modules were ported, not the
main world's player, quests, services, structures, shaders for characters,
terrain meshes, database, weapons or other gameplay code:
- `render/BlazeGrassSettings.mjs`
- `render/BlazeBiomeLandscaping.mjs`
- `render/BlazeGrassShaders.mjs`
- `render/BlazeGrassStream.mjs`
- `render/LivingTreeWindPhysics.mjs`
- `render/BlazeOfGrassWorld.mjs`

The clone's existing `render/atomicUltraSumiMode.mjs` keeps its legacy
public API but now delegates to the **main's safe Living Ultra-Sumi
vegetation shader**, rather than the old clone renderer that replaced
character, buildings and ground with bright untextured plasma and applied
very strong postprocessing bloom.

## Appearance and height
- Stream 16m grid tiles of 16-segment ink/flame grass as the avatar moves
  through eligible Wolfveil meadow/forest terrain. New source body height
  **1.41 m** (three times the main's prior 0.47 m knee-length body); with
  instancing variability, blades typically extend **1.16–1.61 m**.
  The original source-grass visual cap is also tripled, from 0.55m to 1.65m.
- Extra flame wisps rise **three times higher** with wider, still bounded
  Sumi ink/cobalt-violet droplet silhouettes.
- No whole-screen exposure or 1.35 bloom, inverted hull building glow,
  character aura emitter, or flat replacement materials. The original
  ground, buildings, actor skin and armors keep their textures.
- Imported GLB bark and leaf material variants are tagged in the clone's
  *existing* owner tree loaders; spring-responsive GPU wind works with
  the genuine asset's existing native texture/leaf wind and fixes roots.
  Tree colliders, vertex buffers, instance transforms and gameplay remain
  untouched.
- The same original scene and existing WebGL context guard render this
  mode. No second camera/canvas/character and no extra GLB fetch.

## Always-on on clone, user can change styles
The clone now defaults to `artStyle:'atomic-ultra-sumi'`; the one-time
`game3d_clone_ultra_sumi_world_v3` migration updates an old saved
Ink preference to the new mode while preserving other settings.
After migration, manual Classic / Sumi-e selection remains respected.
Entry and Escape graphics menus share the same saved setting.

## Safe placement
Uses existing Wolfveil route, river and imported-town clearances and
the already-authored analytical meadow height with the live +70m scene
offset. Places no extra blade over buildings, rivers or roads, never
changes ground/terrain meshes or physics, and does not stream grass into
a dungeon. Far tiles free their own GPU buffers; GPU quality settings
still reduce instance count.

## Verification
- 37/37 targeted source/syntax/material smoke checks passed in a
  JavaScript isolate: old settings migrate once, 3× height and ember rise,
  imported tree leaf/bark classification, original shader sampling kept,
  player/building exclusion and restoration.
- Added `tests/game3d-clone-world-ultra-sumi-3x.test.mjs`.
- Still needed: full `node --test`, Vite build, actual GLSL WebGL compile,
  browser visual comparison and frame-time measurements.
- **The Base44 Copy app currently has no GitHub connection and its direct
  sandbox code editing is restricted to Builder plans.** Merging
  `marcusflow1-arch/gitsync-pro` changes does not automatically synchronize
  `Atom x Eve OS (Copy)` in Base44. Keep these separate release statuses
  unless a confirmed sync occurs.

## QA in a connected clone deployment
```bash
node --test tests/game3d-clone-world-ultra-sumi-3x.test.mjs
node --test tests/game3d-console-settings-shared.test.mjs
npm run build
```
Enter Game 3D and check Graphics shows **ULTRA MAX · Living Ultra-Sumi** as
selected. Walk into grass/forest and confirm 3× flames reach 1.2–1.6m,
tree bark and leaves flow with the same pigment, sky/buildings/player are
not washed out, and the camera/character can still move through the
original collision terrain. Switch Classic → Ultra → Classic to check
material restoration.
