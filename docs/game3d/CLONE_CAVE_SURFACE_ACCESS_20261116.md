# Clone Game 3D — Sealed-roof cave access trail construction (2026-11-16)

## Owner goal
Provide actual paths from Wolfveil valley trails/bridge to the four caves,
with a readable rock arch, a flat threshold, lighting, safe entrance guard rails,
a descending internal ramp and a navigable return to daylight.

## Scope in this PR
- Jade Lantern Grotto: Training Forest Trail, via a cedar-style staging path.
- Whispering Root Hollow: Western Woodland Fork, root-stone approach.
- Sunken Inkstone Cistern: Northern Ridge Path, hot-spring stone approach.
- Echoing Crystal Vault: Outrider Bridge Approach, crystal-ridge path.
- Exterior stone ribbons are built as real Three.js floor triangles sampled
  against the shared WolfveilHeight hillside. They widen toward the existing
  real stone-mouth thresholds; bend landings cover turn joints.
- Short stone railings are physically guarded in the local client movement
  resolver; lanterns, posts, braziers and path-edge rocks reinforce the mouth.
- Reuse the SAME existing cave builder floor mesh/raycast registration, and
  clear only narrow Game 3D-only grass/shrub/stone scatter from these trails.
- Add live cave entrance markers and four access routes in the M world map,
  using the original Wolfveil +70m world Z transform.
- New ramp lanterns point both into the cave and out to daylight.

## Preserve the other concurrent cave safety work
- ALL surface terrain cells remain sealed; no cave mouth polygons removed.
- Entry is currently the deliberate **E** interaction at the actual rock
  arch, to avoid falling through the waterfall roof. A successful entry
  places the player on the actual interior descending walkway.
- E near the interior arch returns the player to the same outdoor threshold.
- Keep the other developer's ramp/chamber grading, tunnel apron repairs,
  connected cave graph, four hub-direction signs, cave event prompts,
  checkpoint rescue and texture disposal.
- No server authority, drops, loot, PvP strike distance or progression changes.
- No source changes to LAND-WS exact terrain squares, original Game 1 scene,
  or shared height profiles. This is clone-only.

## Verification completed
- 4/4 author routes terminate at the existing cave interaction thresholds.
- Existing physical route list includes every trail/bridge junction.
- 300 surface path quads/fans are finite in isolated V8 geometry collector.
- Current main's E-entry selection works for all four ends; the new collision
  rails reject sideways movement but not movement along the middle.
- Pure-source syntax validates for the merged CaveSystem; did not run a full
  Vite/Three browser build or signed-in Play here.

## Required before marking final/merging
Run:
  node --test tests/game3d-clone-cave-sealed-roof-access.test.mjs
  npm run build
Then signed-in Play QA: run/ride across all four approaches, reach E from
both sides of each outdoor threshold, descend every ramp, return to the inner
arch and press E to leave, and compare collision with enemy knockback, logout
and two simultaneous clients. Verify water/waterfall surface remains sealed
(no 7-foot-radius fall-through), path does not intersect imported trees or
river/bridge rails, and both M-map and 3D sunlight/lanterns reflect correct
positions. Verify frame times and WebGL draw calls with the extra geometry.

The user requested a natural walk-in/walk-out cave. The present safe design
still requires the pre-existing E interaction to transfer between the
overworld and underground floor layers; true seamless cross-layer walking
needs server/world-layer authority and signed-in collision QA first.
