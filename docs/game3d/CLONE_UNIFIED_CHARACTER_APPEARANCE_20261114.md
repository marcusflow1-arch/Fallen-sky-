# Game 3D Clone — Character + Appearance merged UI (Nov 14, 2026)

## Owner request
Retire the standalone **Character** destination and move its functional
character viewer/stats sheet into the former **Appearance** page in place of
**Overview**. Keep *only* Overview's owned **Outfits** left rail and position
it immediately beside the Character box. Rename the top-level **Appearance**
button to **Character** and place it in Character's original Services
navigation position.

## Implementation
- **One** top navigation destination named **Character**, in its original
  slot after Blacksmith and before Skill Book. The duplicate Appearance
  service button is removed from the canonical six-item group list.
- Preserve the service ID `character` plus all existing appearance service
  IDs `cape`, `vanity`, `costume`, `equipment_aura` under the combined
  Character group. Direct legacy `groupId:'appearance'` requests alias to
  `character` and the controller normalizes its live session ID; external
  wardrobe/cosmetic links continue to open the expected subpage.
- Former Appearance sub-tabs now read **Character | Equipment | Vanity |
  Costumes | Wings | Aura**. There is no Overview tab or its obsolete
  Overview-only details block.
- **Character** tab reuses the actual original `AXECharacterWorkspace` as
  an embedded panel, preserving its live 3D equipment viewer, all supported
  equipped slots, player level, XP, combat statistics, and original attribute
  allocation/confirmation behavior. The nested component suppresses only
  its redundant standalone banner.
- **Outfits** rail reuses the exact original owned-costume list and active
  outfit checkmark. In the Character tab clicking an owned outfit invokes
  the existing `equipAXECostume(def.id)` transaction directly, refreshing
  the live character preview without navigating away. Other cosmetic
  subpages retain their item inspection and equip interactions.
- Character and Outfits share a responsive, horizontal two-column glass
  composition; inside Character, the real model/equipment panel and live
  stats column retain their existing display logic. Small screens scroll
  instead of truncating attributes or the 3D viewer.
- The merged page retains a visible **Close Character** button, ESC support,
  and existing service-group navigation. Character continues to be
  accessible even when world workstations are unavailable.

## Files intentionally untouched
No changes to actual equipment ownership/persistence, armor rendering,
player model GLBs, character stat calculations, combat, quests, companion,
Blacksmith, world terrain, or inventory transactions.

## Regression QA
```sh
node --test tests/game3d-clone-unified-character-appearance.test.mjs
node --test tests/game3d-clone-services-extend-top.test.mjs
node --test tests/game3d-clone-weapon-modes-services-layout.test.mjs
node --test tests/game3d-appearance-sidebar-doubleclick.test.mjs
npm run build
```
The first regression covers navigation order, alias routing, original
stats + 3D model, outfit selection, retention of all five other tabs, and
no double-mounted viewer on Character. The two earlier service-nav tests
were updated from seven to six top-level buttons.

**Verification caveat:** targeted JS logic/source checks passed inside an
isolated runtime. Actual Vite/JSX build, signed-in playable Base44 preview,
responsive appearance comparison and screenshot checks have not been
verified. A GitHub merge does not itself establish a Base44 Publish.
