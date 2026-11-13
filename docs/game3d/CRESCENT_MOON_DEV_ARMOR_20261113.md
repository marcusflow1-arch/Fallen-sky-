# Crescent Moon dev armor and the armor runtime (clone port)

Updated 2026-11-13. Ported from `marcusflow1-arch/atom-x-eve-os` branch `claude/armor-sup-dated-eve`
(armor runtime = the delta of that repo's PR #1425 over this repo's pinned source `c073fc3be`, plus the
Crescent Moon set). Nothing here is merged or published; review it as a separate PR.

## What it adds
- **Crescent Moon** armor for Eve (female body only), from the owner's updated `SUP DATED.blend`: six
  individually named pieces, each its own inventory item: **Crescent Moon Helmet, Chestplate, Pants, Gloves,
  Boots, Cape**. Skinned to the fused rig with weights, so they follow the character. Adam has no Crescent Moon.
- The fitted-armor runtime this clone did not have yet: `src/components/game3d/armor/` (equip bridge),
  `armorBodyMask.js`, armor slots / masks / cape spring chains in `customizationRuntime.js`, `hairSprings.js`,
  `avatarCustomization.js` (+ `base44/shared`), the creator Armor tab, `creatorBuiltinLayers.js`, and the armor
  GLBs and pictures under `public/models/characters/fused/armor/` (byte-identical to the source repo: 71 files, hashes
  compared). Nightscale, Frostwarden and Moonfeather come with it (they are the source repo's live sets).
- Miniature equipment pictures on the inventory surfaces (Gear grid and detail, Services inventory, Character
  inventory, loadout pane), copied from the source repo so the pieces show their picture.

## Dev only, never live
- `import.meta.env?.DEV` guards the seed: `inventoryData.jsx` adds the six items only in a development build.
  A production Vite build of that seed has none of them (checked in the source repo: 34 items in production,
  40 in development).
- They are listed in `AXE_DEV_ARMOR_SETS`, NOT in `AXE_ARMOR_PACK_SETS`, which the loot tables read, so the set
  never drops. The inventory store puts a missing `devGrant` piece back on every dev load.
- Manifest entries flagged `dev_only` are dropped by `creatorBuiltinLayers.js` in production builds, so the creator
  and the equip bridge never list the set there. The GLB files themselves are static files in `public/` and
  ship in a build, but nothing links to them.

## Try it
Run the app in development (`base44 dev` / `npm run dev`), open the equipment inventory: the six Crescent Moon
pieces are in the bags, unequipped. Equip and unequip them one by one; each piece appears on or leaves the avatar.
Play as Eve (Adam has no Crescent Moon: the item equips, nothing is drawn).

## Merge notes (files this repo had changed)
`useGameAvatar.js` (kept this repo's "model_url for every roster slot" and wrapped it in `useArmoredAppearance`,
keyed by the active character id), `creatorStageScene.js` (kept this repo's `characterBodyBounds` guard, fused
bodies are measured on the body alone and stand 1.73 m), `avatarCustomization.js` (kept this repo's `Female/Male_Fused_v2.glb`
creator bodies, added `height_m`), `CharacterAppearanceEditor.jsx` (kept the expression panel import, added the Armor tab).
`avatarAssetRuntime.js` merged cleanly. Files this repo had not changed were taken from the source branch.

## Verified
- `node --test tests/game3d-dev-armor-crescent-moon.test.mjs`: 8/8. The whole clone test set: 66 pass / 5 fail,
  the same 5 that fail on this repo's unmodified `main`.
- ESLint (this repo's config) on the 21 changed source and test files: no errors.
- The clone's own source, served by Vite in a browser (dev mode, no Base44 backend): the six pieces are in the
  inventory by default and unequipped; equip, unequip, partial sets and equip-all draw and remove the armor
  on Eve; the Gear inventory grid shows the piece pictures. The creator Armor tab and the other inventory surfaces
  were ported but not opened in a browser.

## Not verified
`npm install` / `npm run build` in this repo (still the open gate in `GAME3D_BOOK_MIGRATION_STATUS.md`), a signed-in
Base44 session, the live Cloudflare build, Adam, and the Blender authoring pipeline (`tools/avatar-armor` stays in
the source repo; it needs a local Blender and the artist's `.blend`).
