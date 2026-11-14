# Clone Game 3D — Living Perspectives: the World Beneath the World
Date: 2026-11-14. Target: **clone GitHub repository `marcusflow1-arch/gitsync-pro` ONLY**.
Creative reference: the owner's generated widescreen concept depicting luminous energy grass,
an expanding river, a whirlpool above an abyss, a wide daylight mountain opening, and a
dragon breathing a descending living firestorm.

## Playable vertical slice built in this PR

**1. The expanded mountain basin.**
- The EXISTING upper Wolfveil river flows through local (205,320) at water height 83m.
- `VortexLakeLayout.mjs` shapes a ~86×74m bowl around that real river via
  `gradeVortexLakeBasin`; the same `wolfveilHeight` supplies the original
  single walkable terrain, BVH raycasts and external meadow height sampling.
  Outside the claimed lake/mouth the analytical height is unchanged.
- Adds a 32m-wide, 26m-high sunlit mountain passage (local ~215,358), with
  genuine three-dimensional stone arches, open sky-facing ends, natural roof
  rocks, and connected water stretching beneath the roof toward (217,388).
  The cavern passage is a visual open bay, **not a separately collision-verified
  explorable underground terrain zone**.
- One 128×32 radial-band original `ShaderMaterial` makes a deforming lake/
  descending whirlpool, shaded teal/blue/violet with no full-frame bloom.
  16 3D flowing sumi-energy streams swirl down toward a dark 11.5m core.
- Walkable bridge and a grade-matched land approach ramp are registered in
  the EXACT original Game 3D groundMeshes registry, not fake overlay floors.
- Existing meadow, safe imported trees, living-fire grass and planting grids
  exclude water/mountain channel footprints, preventing floating green blades.

**2. Portal that works.**
- The 5.9m inward-crossing vortex trigger emits
  `game3dPortalTravel {target:'lunar-cave',sourcePortal:'vortex'}`.
- The exact existing five-hall Lunar Cave dungeon is the first **playable**
  exploration destination (no invented downloadable map or unready room).
- `VortexDungeonEcho.mjs` puts dynamic symbolic energy filaments over all
  corridors and five thematic circles in the existing dungeon root—visual
  progression without changing monster balance, loot, floors, collisions,
  or multiplayer maps. Different rings are different perspectives of the
  same energy; no explanatory text is imposed on the player.
- `GameView.jsx` remembers a vortex dungeon origin through region remount;
  using either ordinary cave return portal returns to the lake bridge
  rather than the unrelated mountain gate. Ordinary Lunar/Astral gates keep
  their existing return behavior.
- Admin Workflow navigation recognizes `vortex-lake` and
  `world-beneath-world` with the bridge as its safe first-pass test landing.

**3. The dragon in the concept is a real encounter.**
- The old quarry dragon **still exists** at its original location.
- A distinct lazy-loaded instance of its original hosted GLB now perches on
  the eastern lake-mountain ridge and uses the same existing boss HP/mixer,
  engagement, and player shield/damage routines.
- The dragon alternates **fire rain** (24 visible falling flame streaks with
  ground target ring), **sustained fire breath** (a cylinder/ink-stream blast
  along a locked player-target line), **descending fire cyclone** (13
  swirling rings and 100 rising embers starting ~28m overhead), and the
  original aerial slam. Each has a >=1s warning and **one bounded hit check**,
  not damage per rendered particle.
- Both instances remain client-preview-only, no XP or server grant. Models
  download only when the player approaches their own site; fire effects and
  mesh resources are disposed on unmount or defeat. The main game's dragon
  and gameplay code are untouched.

## Exact locations
Wolfveil LOCAL: lake (205,320); mountain mouth (215,358); lake dragon
(263,350). Game 3D scene uses the existing **+70m world Z offset**.
Lake test bridge and return: world (205,84.5,356).

## Performance and scope
- No new binary GLB, image textures, or externally generated 3D mesh.
- Vortex is procedural GPU shaders/geometry and low-cost static rock meshes;
  not an actual fluid solver or real terrain volumetric boolean cave.
- The separate dragon GLB is loaded on demand; VFX is inactive when no boss
  is engaging. No replacement of character, buildings or terrain materials;
  the main user's chosen Living Ultra-Sumi look remains intact.
- Original Questbook, combat queues, enemy drops, 3D camera, Marketplace,
  server movement, dungeon encounters and the main repo are unmodified.

## QA
New tests:
```sh
node --test tests/game3d-clone-living-vortex-lake-dragon.test.mjs
node --test tests/game3d-clone-world-ultra-sumi-3x.test.mjs
npm run build
```
Unit/source smoke checks validate basin and mouth continuity, exact safe
portal crossing, bridge raycaster registration/removal, return routing,
one-hit dragon warning logic, imported boss identity, vegetation exclusions
and dungeon echo wiring.

**Honest remaining validation:** no signed-in clone Base44 browser WebGL
render, no runnable Node/Vite checkout in this tool session, no driver shader
compile, no test of player physically walking onto the ramp, no GPU frame-time
profile, and no verified production Publish. The separate Base44 Copy
app is not connected to GitHub and remains independently deployed; merging
the GitHub clone PR does not automatically update its preview.

### Guided clone Play QA
1. Open admin Workflow and select **vortex-lake**. Walk the approach ramp
   onto the bridge. Verify foot collision and no floating bridge edges.
2. View the basin from the south, spin and dark core, daylight entering the
   mountain mouth and water continuing under its stone vault.
3. Walk inward across the 5.9m portal radius. Confirm the normal **Lunar Cave**
   dungeon loads, observe the new five-hall energy memory shapes, and enter
   either existing exit portal. Confirm return to lake, not back to gate.
4. Approach the **Dragon of Living Perspectives** at (263,420) Game 3D
   world coordinates. Validate the rain, breath, descending cyclone and slam:
   ground warnings precede one damage event; dodge outside the target area.
5. Compare Classic, Sumi-e and Ultra-Sumi graphics around lake: water remains
   dark and translucent; surrounding trees/grass retain energy, while buildings,
   player skin/armor and terrain avoid the previous whiteout.
