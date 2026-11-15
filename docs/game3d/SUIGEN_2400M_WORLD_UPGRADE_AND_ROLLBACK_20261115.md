# Wolfveil Dominion of Suigen — Clone Map Upgrade & Rollback
**Status: Phase 1 integrated, not 100% quality certified.**
**Repository:** `marcusflow1-arch/gitsync-pro` (the clone only).
**Original:** unchanged; legacy Wolfveil renderer remains in the clone as a reversible alternative.

## Exact source data and provenance
The owner supplied two identically hashed 30,327,245-byte modules:
`Wolfveil_Dominion_Of_Suigen_2400m_AAA_Map.mjs` and `(1).mjs`.
Each decodes to the same 22,742,008-byte glTF2 binary.
The resulting scene has a 2,400 × 2,400 meter terrain (X,Z −1200...1200),
2,552 nodes, 928 meshes, 27 materials, 11 embedded textures and images.
This is a **5.76 km²** world. Do not mislabel it 4 × 4 km (16 km²).
A 4 km expansion is a separate future design phase, requiring additional terrain.

The exported map geometry has been preserved in two original-placement GLB shards:
- Dominion shard A (16,648,552 bytes): `https://media.base44.com/files/public/6ab42219a52fd34656a53b37/70f28504c_wolfveil_suigen_north.glb`
- Dominion shard B (7,196,468 bytes): `https://media.base44.com/files/public/6ab42219a52fd34656a53b37/777b3d50e_wolfveil_suigen_south.glb`

**Note:** Shard names are packaging identifiers, not literal north/south districts.
Each was verified as a GLB scene (916 + 32 unique meshes) and keeps the
source transform and mesh/material definitions. Both files must load.

## Existing landmarks preserved from the imported model
`Map_Terrain_2400m`; three canal bridges; `Acropolis_Keep_Foundation`
with four vertical keep tiers and roofs; bamboo forest; 26 named
`Abyss_Stair` objects leading down to `Abyss_Vault_Floor`; 12
`Sacred_Dragon_Gem` landmarks; baked grass, natural stone, cherry foliage,
glazed roof materials, water, fortress stone, wood and tatami materials.

**Real features are not implied by object labels:** the binary alone does not
establish interactive shops, functional homes, NPC schedules, dungeon enemies,
world persistence, correct internal collision or full AAA quality. Those require
gameplay integration and signed-in visual inspection.

## Mode selection and safety
Escape → Graphics → World Map:
- **Dominion of Suigen · New** (default for this clone)
- **Wolfveil · Classic Backup** (unchanged legacy renderer)

Switches use the live Game 3D renderer. The new GLB loads entirely before any
legacy terrain is hidden; if loading fails, the classic world remains visible,
the selected mode rolls back to Classic, and an error is reported.
The character, inventory, quest progression and multiplayer storage are not
overwritten. Neither original terrain files nor the uploaded assets are deleted.
The existing vortex lake/tornado and separate dungeon portal systems remain
registered; their placement relative to the new terrain needs Play QA.

## Next architecture passes (do not claim built yet)
**Town v2**: design a genuine 450–600 m main town footprint, subject to terrain
survey and collision-free siting. Target 40–70 distinct buildings and an
interconnected public square, blacksmith, armor/weapon buy-and-sell merchant,
apothecary health/will/antidote pills, consumables merchant, inn/tavern, food,
clothing/Vanity, spiritual temple, guild, stables and player homes.

**Architectural reference prototype**: finish one original 2-story enterable
residence with roof tiles and ridge/underside details, facade paneling,
molding, door/window frames, glossy timber flooring, glass/wood railing,
stairs with usable collision, structural second floor, kitchen center island,
refrigerator, sink, stovetop, utensils/cabinets, dining room, lounge,
paintings, original Japanese-inspired art, bedroom, bath and illumination.
Only replicate once real signed-in walkthrough and collision QA pass.

**Map v2 landscape**: natural, believable walkable rocky stairs, terraces and
switchbacks rather than hovering slabs; terrain blend seamless to rocks,
grass and river. Add deliberately placed forest species with proper original
wood/leaf materials, wind sway, bridges, waterfalls and valley routes.
Keep the game’s vortex-water landmark and teleportable mountain/cave gates,
verify that entrances lead to large navigable underground dungeons.

**Quest integration**: at least five campaigns with two side quests each,
location registry/POI, NPC interact, objective triggers, boss arenas,
equipment rewards, safe progression and return navigation; validate location
overlap with the existing world/quests before repositioning any NPC.

**Performance**: do not render two giant terrains at once; maintain a fallback
without doubling draw calls. Budget terrain streaming/LOD/instancing,
texture compression and collision sampling with a real GPU/CPU/FPS profile.

## QA gate before calling this feature 100%
Native Node tests; clone production build; two-GLB network/CORS load; signed-in
Play desktop and mobile; enter and return to Classic; reload retained setting;
watch camera/checkpoint after switch; terrain raycast vs meshes; quest NPC
contact and shop purchase; mounted turns; water/tornado and portal collision;
cave transition; FPS/LOD; two-client parity. This initial integration has
**not** received these final Play confirmations.
