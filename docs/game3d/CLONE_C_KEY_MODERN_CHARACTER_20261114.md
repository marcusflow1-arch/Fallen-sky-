# Game 3D clone — C key uses the modern Character/Appearance subpage

**Reported in clone preview 2026-11-14:** C was still opening the old full-screen **AXE Character Interface / Character Hub** (Attributes, Inventory / Gear, Companion, Weapon Mastery, Sets & Ascension, Services). That is obsolete for the C shortcut. The approved replacement already exists at `AXEAppearanceWorkspace` → `Character` → `AXECharacterWorkspace`.

## Fix

- `GameView.jsx` now routes unmodified **C** through `useAXEServiceMode.controller.open('character',{serviceId:'character'})`, rather than setting `progressionOpen=true` and `initialTab='attributes'` on the legacy `CharacterProgressionMenu`.
- The new page is exactly the unified Character/Appearance service workspace: **Character, Equipment, Vanity, Aura** tabs, with a 3D player viewer, actual equipment slots, actual attributes and stat allocation, and real character-scoped stats. This is not a new duplicate Character implementation.
- **C when closed or from another service:** open Character. **C while Equipment/Vanity/Aura is open:** return to Character rather than closing. **C while Character is open:** close the page. **Esc:** existing service close behavior remains. No changes to Shift+C weapon switch or the I inventory shortcut.
- `AXEServiceWorkspace` forwards the visible subpage to `GameView`, and a focus token to `AXEAppearanceWorkspace`. The active subpage is held in React state, not inferred from stale DOM or storage.
- Explicit `axeOpenCharacterHub` events are left intact for their legacy inventory/managing callers until they are independently migrated; **C itself no longer uses that old menu**.
- Clone only. No main Game 3D, terrain, combat stats, or model assets modified.

## Validation

`node --test tests/game3d-clone-c-character-routing.test.mjs`

Six isolated JavaScript/source-contract checks passed for C-key input classification, correct service alias, open/focus/close behavior, removal of legacy C route, live tab propagation, and existing 3D Character panel wiring. The real browser visual and key interaction still need testing after the updated clone is deployed. Do not mistake source tests for successful browser QA.
