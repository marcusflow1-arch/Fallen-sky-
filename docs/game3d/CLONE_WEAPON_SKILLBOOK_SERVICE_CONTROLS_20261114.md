# Game 3D Clone — Weapon Skill Book and Service Control Pass
Date: 2026-11-14. Repository: `marcusflow1-arch/gitsync-pro` (clone only).

## Skill Book — gameplay data is real
- Replaces three anonymous outer preset numbers (I, II, III) with exactly
  **Damage, Range, Defense**.
- These roles intentionally keep the same existing `game_weapon_skill_presets_v1`
  index sequence (0/1/2). The existing `selectSkillPreset`, `equipActive`,
  `saveSkillPreset`, player 1–0 hotbar store and cooldowns remain authoritative.
  Switching the selected weapon mode changes the **actual active skill bar**
  visible at the bottom of the Skill Book and in gameplay.
- The old **left and right external preset rails** are replaced by (a) a left
  **Weapons** selector showing the player's **owned equipment** by its
  `axeWeaponRole` and (b) one inline mode strip **inside** the two-page book.
  Equipment illustrations come from the owned item's `imageUrl`, `iconUrl` or
  `image` fields. When seeded items have no art, the UI uses original sword,
  dagger and bow vector silhouettes, *not invented gear images*.
- Clicking a weapon role uses the existing
  `switchAXEInventoryWeapon(instanceId)` transactional equip action with its
  ownership/level validation. It then selects the corresponding existing
  skill preset and updates skill filter to Damage, Range or Defense.
- **Removes both vertical skill-slot columns and their extra scrollbar**.
  There is one editable horizontal 10-slot active hotbar inside the book.
  The existing passive buff quick-equip remains; equipped passives can be
  removed using compact chips in the Buffs page (not a vertical slot rail).
- Companion remains independent of weapon ownership. Its 3 saved ability
  sets are now internally labeled Support, Combat, Mobility inside the book;
  its 4-key Z/X/V/B bar remains.
- Skill registry, mastery, inventory ownership, rewards and combat damage
  logic are not modified.

## Service sizing and navigation
- For Character, Skill Book, Quest Logbook, Appearance, Companion and Spiritual,
  move the top edge down by ~10dvh (desktop clamp 62–110px) while retaining
  each service's original bottom/left/right positioning, scroll panes and
  close controls. This corrects the last full-height pass that overlapped
  the top Services navigation.
- **Blacksmith is excluded** from the 10% resize and keeps its full-height
  forge scene, artwork, inventory grid and seven forge tabs.
- The existing top Service buttons have a higher z-index while a service is
  open. They remain clickable during Blacksmith mode and every other service
  without moving those buttons or rewriting their onClick callbacks.
- Companion expands all the way to the left/right game viewport bounds
  (100% width; no 1648px/aspect-ratio width cap), preserving subpanels and
  responsive scrolling.
- Blacksmith title moves from 2.9% down to 8.8% of its unchanged
  1672×941 stage, ending immediately above the inventory shell at 15%.
  The title cannot intercept clicks; no forge asset geometry is changed.

## Regression
```sh
node --test tests/game3d-clone-weapon-modes-services-layout.test.mjs
npm run build
```

Source and V8-behavior smoke checks validate role mapping, original equipment
imagery and fallbacks, persisted preset indices, callback wiring, removal of
vertical equip columns and exposed scrollbars, 10dvh height reduction,
Blacksmith exemption, Companion width and navigation click layering.

**Pending browser QA:** confirm all real screenshot layouts and clickable
navigation in Base44/GitSync Pro clone. GitHub merges alone do not certify that
Base44 app deployment has picked up the exact commit.
