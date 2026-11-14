# Clone-only: first approved curved weapon-switching HUD

Source: the owner's **first** blue-and-gold C-arc visual mockup, before the three alternative concepts. This is an actual reusable React template and original CSS/SVG, **not an image overlay** and not a new 3D weapon model. It is sized around 25% smaller than that mockup and replaces only the three existing HUD weapon panels at the right side of the game.

## Architecture
- Reusable `src/components/game3d/axe/weapons/AXECurvedWeaponTemplate.jsx`: cyan C-shaped SVG sweep, nested translucent weapon sockets, selected gold outline, real image/portrait areas, small assignment gear controls and a compact input legend. Each visible socket is an independent semantic clickable button over an otherwise decorative shell.
- `JadeSoulHUD.jsx` remains the controller; it uses the existing `AXEWeaponRoleSlots` and `AXEEquipmentInventoryStore.switchAXEInventoryWeapon` transaction. No clone-only fake equipment state or extra stat multiplier. The current equipped inventory weapon determines selection highlighting, actual combat equipment, skill/mastery identity and animation context.
- `JadeSoulHUD.css` sizes the entire selector to approximately 308×320px on large screens versus the roughly 400×420px first mockup. It preserves the current right-hand area, avoids reflow of the world, weather, minimap, chat, skills and quest tracker, and reduces/hides the shortcut legend in constrained displays.
- Artwork priority: the owned item's `iconUrl`, `thumbnailUrl`, `imageUrl`, `image` or `thumbnail` when a safe relative HTTPS URL is available; otherwise use a locally rendered weapon-family glyph. **Training Bow's actual `/game3d/test-gear/training-bow.svg` appears automatically.** No invented GLB/PNG for unmodeled weapons.

## Controls
- **Mouse:** click any panel to equip that exact item; click its cog to choose **any owned weapon** for that slot (Damage/Defense/Ranged labels are interface roles, not item-type restrictions). Reassigning a weapon clears its former slot association without destroying, duplicating, or unequipping it.
- **Wheel** while hovering this element: previous/next available slot. 180ms throttle protects against trackpad runaway. It is not a global wheel listener.
- **← Left:** previous available slot. **→ Right:** next available slot. **↑ Up:** choose the primary/favorite slot (Damage, configurable to any owned weapon). The previous Shift+C weapon cycle still works. Plain C remains Character/Stats; keys 1–0 remain combat skills.
- Touch swipe up/down and top/bottom circle buttons also cycle; accessible button labels and visible selected state retained. Keyboard switching is ignored while the player is typing, in the pause menu, services, map, dialogue or another UI modal.
- Weapon switches honor current player level and inventory equip validation. If a weapon is too high-level or unavailable, the selector reports it and cycling attempts another available role; an invalid weapon never becomes a fake visible equip.
- The *full-screen reference* also pictured other status/menu/chat arrangements. This change implements the requested **weapon module only** and intentionally does not overwrite those independent HUD subcomponents.

## QA
- Focused tests: `node --test tests/game3d-clone-curved-weapon-template.test.mjs`.
- Isolated JavaScript execution passed 6/6 source-contract and pure role-slot selection checks: three slots, assign-any-weapon semantics, boundary cycling, clickable template/real image wiring, arrow/wheel/touch integration, and scaled curved CSS.
- **Not independently verified:** complete Vite build, CSS rendering inside live Game 3D, device-specific mouse/touch/key conflicts and a real in-game weapon switch. User should verify on the deployed clone after this PR merges.
- Main Game 3D, terrain and avatar equipment/Blacksmith remain untouched.
