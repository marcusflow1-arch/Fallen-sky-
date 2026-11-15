# Suigen 2.4km Map — Living Town + Mountain Routes, Clone Phase 2

**Repository:** `marcusflow1-arch/gitsync-pro` only. No edits to `atom-x-eve-os` or Classic Wolfveil.

## Built in this pull request

### A town large enough to traverse
- A **~588 × 684m planning envelope** across the existing 2,400m map.
- Sixty deterministic original plot IDs distributed across western and eastern arcs, with the historic original canal and Acropolis center left intact.
- Twelve signed merchant destinations: blacksmith, weapons, health-pill apothecary, general supplies, materials exchange, wardrobe, spirituality, inn, tavern, stables, guild and curios.
- Nine linked road sections with terrain-following stones and edge details. The eastern homes and avenue bend around the protected water-vortex basin; the northern crossing rejoins the street network.
- All 60 generated buildings have enterable front sliding doors, textured underside roof surfaces, ceramic roof pattern, wood/plaster walls, molded corners/trim, window glass, foundations, and working numeric wall/door collision.
- Interiors include finished ground floors, kitchen center island, refrigerator, cabinets, counters, sink/hob, dining seating, sitting area, framed art, decorative lamps, furniture. Most residences include a second storey with bedrooms, furnishings, continuous floor panels with stairwell opening, a modeled wooden stair of **18 individual climbable treads** and glass/wood rails.
- Shared `InstancedMesh` geometry/material batches, frustum culling, and indexed grid-based O(1) terrain height samples reduce load and draw costs. A merged non-rendered collider provides actual walkable floors, porches and stair treads.
- A **smooth, clone-only terrain grading pass** adjusts original glTF terrain in planned home footprints and blends to nearby slopes over 10m. This is necessary: an offline source-terrain sample found up to **19m** of front-door elevation mismatch in the original steep hillside. The original source asset and Classic landscape remain unchanged.

### Real shop interactions
- When the player approaches a town house door, **E opens or closes its visible sliding panels**. Inside a merchant's shop, **E opens the merchant panel** at the counter.
- Apothecary and supply shops sell real character-scoped healing pills, rations, edge oil and temporary focus tonics using the existing Silver/shop inventory APIs. Consuming them invokes the game's existing `ShopEffectsBridge` heal and combat-buff behaviors. Owned shop consumables can be sold for the existing store's 50%-price rule.
- Blacksmith, Character/Vanity, Spirituality, Mount/Companion and Questbook link to the existing corresponding service IDs, avoiding a second player-inventory backend.
- **Important limitation:** Selling authoritative **equipped weapons/armor** is deliberately disabled. The existing canonical equipment store has separate persistence and locking rules; a server-checked, rollback-safe weapon sale cannot honestly be represented by subtracting a local item and adding Silver. A visible weapons merchant and its consumable goods are implemented, but complete secure weapon resale still requires backend work.

### Cave and water-tornado upgrade
- The original Acropolis/Canal, imported 26 Abyss stairs and deep vault coordinates are preserved.
- Added 156 finer 0.17m-approx. risers along the original 26-step 2.5m-descending corridor with explicit raycastable step geometry, reinforcement boulders and retaining rock edges.
- Cut a narrow corridor from the **Suigen copy** of the imported terrain mesh only. Otherwise the existing mountains rise dozens of metres **above** the −25m vault and the added steps remain buried and impossible to traverse.
- Added a new water-vortex effect rooted in the actual Suigen mountain surface near (205,390), with a graded shallow lake basin, reflective water and energy ribbons, replacing the visually mismatched Classic effect at Y=82.6 while Suigen is selected.
- Added proximity portals routing to the game's already-existing, separately loaded **five-area Lunar Cave** and **Astral Dungeon** scenes. Existing quest/progression systems still govern encounters; no new XP or loot awards are fabricated here.
- Added POI IDs for the town, keep, bamboo shrine, Abyss, celestial gate and vortex for subsequent quest authoring. **POI registry does not mean new quests have been implemented.**

### Switching, compatibility, and safety
- Escape → Graphics → World Map remains **Dominion of Suigen** (default) or **Wolfveil · Classic Backup**.
- Both original GLB shards load before replacing Classic. If the new procedural town or mountain details fail, their errors are reported while the imported source scene remains; Classic stays selectable.
- The player keeps their existing character, Silver, inventory, combat, mounts, quest store and multiplayer runtime.
- Existing Classic-only vortex + mountain gates are hidden during Suigen and returned to their original visibility on Classic.

## Must still be completed before AAA/100% acceptance

1. **Native signed-in Play validation** of 2-story traversal, collision, E interaction, shop purchase/consume/sell, level change and Clone/Base44 preview rendering. No successful production WebGL walkthrough has been observed here.
2. **Exterior/interior art pass:** replace procedurally assembled, texture-generated building details with reviewed original GLB architecture and artistic assets where warranted. The code creates substantive geometry, but a 60-building procedural pass is **not yet proof of final AAA art quality**.
3. **Terrain and path QA:** check steep intersections, mountain trench geometry, rock step spacing, room/door clearance, river/canal connectivity, rooftop occlusion, lightmap/art finish, and any duplicated historic scene elements.
4. **Game-wide world travel:** the imported terrain spans 2.4km, but the current game client and authoritative worker have a **~528m half-span** safety envelope; far outer world terrain is still not fully traversable. Expanding this requires coordinated client/server region/anti-cheat/streaming changes, not a client-only removal.
5. **Merchant inventory authority:** add secure canonical weapon buyback/sale and server-validated exchange. Current apothecary consumables work through existing **character-scoped local Silver**.
6. **Quest realization:** wire new POI to five story chapters/two side quests per chapter, NPC schedules, cinematic events, boss objectives and verified progress. Existing Lunar/Astral destinations are real but the new Suigen quest arcs are not yet complete.
7. **Performance and multiplayer:** profile 60 buildings, texture maps, many instances, grass/trees and both GLB shards on desktop/mobile with 20 simulated players. Validate door state consistency in multiplayer; currently doorway animations are client-local, not server replicated.
8. **Map-quality benchmark:** one home must pass a full inspection from foundation to roof, all rooms, stair and furniture collision, day/night lighting and camera motion before calling any building **100%**.

## Changed files
- `src/components/game3d/worlds/SuigenTownPlan.mjs`
- `src/components/game3d/worlds/SuigenTownDistrict.mjs`
- `src/components/game3d/worlds/SuigenTownMerchants.jsx`
- `src/components/game3d/worlds/SuigenMountainWayfinding.mjs`
- `src/components/game3d/worlds/loadSuigenWorld.mjs`
- `src/components/game3d/GameWorld3D.jsx`
- `src/pages/GameView.jsx`
- `src/components/game3d/worlds/SuigenTerrainHeight.mjs`
- `tests/game3d-suigen-town-upgrade.test.mjs`
- `tests/game3d-suigen-terrain-height.test.mjs`

**Validation category:** source-level invariants and syntax checks on pure JS modules, plus geometric inspection of the uploaded source terrain. No native npm build or logged-in Play test could be run from this connected environment. Do not claim that a source check proves the player can physically enter every home at runtime.
