# Game 3D / Book migration restoration — QA HOLD
Date: 2026-11-12 UTC. User-supplied 4m35s recording shows the original Game 3D character selection, functional Play world, Skills, Spirituality, Companions, Quest Logbook, and Echo Chronicle.

## Sources and scope
- Original private source: `marcusflow1-arch/atom-x-eve-os` at `c073fc3be90b7013b1b5dae2da7f802b902675e2` (merged PR #1421).
- Destination: `marcusflow1-arch/gitsync-pro`, restoration branch `fix/game3d-restore-play-assets-20261112`.
- Source PR audit: reviewed all pages of source PR listings back to 2026-10-12. 1,299 PRs were opened in the window; 988 titles matched a *broad* Game 3D / world / character / camera / quest / terrain keyword filter, including some unrelated work. This is not a claim that all 988 affected Game 3D. Recent core work includes PRs #1409–#1421 (creator, character menu, complexion, animations, camera, HUD, history, storage).
- The 922 Game 3D component files and 627 server/game3d files copied by the earlier migration are Git-tree equivalent at that source pin. Their **runtime** is not yet verified.

## Verified migration breakages
1. Shared onboarding/character-creator code had been replaced by thin stand-ins. Example: `src/components/onboarding/CharacterAppearanceEditor.jsx` was roughly 2 KB in the destination versus the original approximately 20 KB. Original creator controls, studio layout and linked sculpt/hair/makeup/morph/lighting dependencies have been restored on this review branch.
2. `activateAndSyncToHUD` previously invoked `saveAppearance` during Play for platform characters. In the migrated app this could block world entry on a remote save that is not necessary for character selection. The entry path now selects the local character without writing to a second account-avatar service; explicit creator Save remains unchanged.
3. **All nine original Game 3D character GLB binaries are absent in the destination repository.** The source branch contains:
   - `public/models/characters/Artemis_Character_v2.glb` (9,478,268 bytes)
   - `public/models/characters/Artemis_Character_v3.glb` (9,478,268 bytes)
   - `public/models/characters/Artemis_Character_v5.glb` (11,811,664 bytes)
   - `public/models/characters/Getsuga_Tensho_Character_v3.glb` (7,691,484 bytes)
   - `public/models/characters/Getsuga_Tensho_Character_v5.glb` (9,304,652 bytes)
   - `public/models/characters/fused/Female_Fused_v1.glb` (4,609,316 bytes)
   - `public/models/characters/fused/Female_Fused_v2.glb` (5,463,668 bytes)
   - `public/models/characters/fused/Male_Fused_v1.glb` (9,428,208 bytes)
   - `public/models/characters/fused/Male_Fused_v2.glb` (10,464,364 bytes).
   GitHub connector Git trees cannot reference cross-repository source blobs directly (`422 invalid blob`); its binary blob fetch cannot decode the assets. No full binary import has been performed.
4. The original published site, `https://atomxeveos.base44.app`, is a strictly allowlisted, read-only best-effort model mirror. The loader tries the same authored GLB at that origin before downgrading to the older hosted platform character. It is not evidence that the model bytes were migrated and depends on the published site's public static asset access and browser CORS settings.
5. The destination Base44 app visible in the screenshot is not among the connected Base44 apps available to this agent. There has been no authenticated browser verification, no destination build/preview result, and no live world server test. Do not state it is fixed in production.

## QA required before merge/publish
1. Copy **byte-for-byte** original `public/models/characters` GLBs from an authenticated GitHub checkout using the existing `npm run migrate:game3d -- --apply` path. Preserve source file hashes and never substitute lower-detail models. Confirm `npm run verify:game3d-characters` passes.
2. Install exact destination dependencies, regenerate lockfile if needed, run `npm run build` and `node --test scripts/check-game3d-restore-bridge.test.mjs`. Fix any missing imports and asset URL/CORS failures.
3. Test both genders, creation + Save, category editor (body/face/hair/skin/makeup/expression), preview rotations, character switch, delete, Play, spawning, WASD camera/animation/attacks, and leaving/re-entering the world.
4. Validate the authoritative Node `server/game3d` deployment separately from the Base44/Cloudflare UI. Confirm required database schemas, backend functions, saved characters, quest, inventory, social, party/trade, storage, session auth and two signed-in clients. Do not fake backend results.
5. Reconcile the restoration branch with latest `main`, run a browser smoke test in GitSync Pro preview, and only merge after QA acceptance. Never treat GitHub PR merge as proof of runtime functionality.

**Current release status: NOT VERIFIED.** This branch restores missing original UI code and reduces Play dependencies, but full native model and server migration remains unfinished.
