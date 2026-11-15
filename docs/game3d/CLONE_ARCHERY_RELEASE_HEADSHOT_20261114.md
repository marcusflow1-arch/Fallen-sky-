# Game 3D clone — charged bow release, headshots and charged abilities

**Scope:** `marcusflow1-arch/gitsync-pro` clone only. Original Game 3D and the terrain unchanged.

## Archery control and charge progression

- **Left mouse DOWN over the actual world canvas:** begin drawing an equipped bow. No arrow flies and no stamina is spent yet.
- **Keep holding:** a native DOM charge meter beside the existing third-person reticle shows 0–100%. The owner specified two anchors: **0.7 seconds = ~50%**, **1.2 seconds = full 100%**; a two-segment linear interpolation fits both, so charging starts smoothly and cannot jump suddenly.
- **Continue holding at 100%:** indefinitely maintain a fully drawn bow, with a hard 2× charge-damage multiplier cap. No bonus damage past 1.2 seconds and no automatic fire.
- **Release LEFT:** queue exactly one bow attack using the same existing PvE target selection, camera-to-target tracer, stamina, animation and single AXE combat resolution. Quick tap has standard bow damage; half charge scales normal damage 1.5×; full charge scales it 2×.
- The old boss/rogue bridge used to fire on mousedown and deal *additional* damage at mouseup. Its separate bonus hit and mouseup listeners were removed; boss, rogue, normal AI all consume the **same release-time charge** on their already-confirmed single impact. No extra XP, no second crit roll, no phantom hits.
- Opening the menu/map/dialogue, losing window focus, death, changing equipped weapon mid-draw, mounting, or unmounting cancels charge. No stale shot should be able to fire afterward.
- Normal melee left-click attacks are still immediate. Right mouse aims/blocks and middle mouse locks on as before.

## Headshots

- A headshot only counts if the centered camera ray physically intersects the target's actual body bounds in the **top 22%** zone. Lock-on grace without a true hitbox ray never earns a headshot. Walls and muzzle occlusion still disqualify targets.
- After the canonical hit/dodge/crit/defense calculation has returned a true hit, apply **2×** headshot damage. This stacks with bow charge, so a full-charge headshot yields **4× the resolved normal impact** (before health depletion), not a fake extra attack.
- Display **HEADSHOT ×2** and the applied damage near the existing reticle. Confirmed MISS and DODGED results remain as before.
- Current head detection is an inexpensive **bounding-box approximation**, not an animated per-bone collision volume. Some oversized ornaments, bosses, and unusual 3D rigs need visual/head-zone validation later.
- **PvP:** the duel server remains authoritative. Client-supplied headshot and charge claims do not multiply duel damage. To enable this fairly for PvP, a separate validated server/head-hitbox protocol must be implemented.

## Chargeable abilities

- Existing max-mastery charged singles/three-hit attacks now scale from **10% increments** to full at **1.2 seconds** by default, with hold time bounded after completion. A partial release gets the proportional fraction of its configured existing charge bonus, not an invented full bonus.
- A specific ACTIVE_ATTACK skill can opt in before max mastery with `chargeable:true` or a valid `charge_duration_ms`/`charge_time_ms`/`chargeTimeMs` (200ms–10000ms). This enables authored 1.2-second or 5-second casts without affecting unrelated instant skills.
- AoE channel inputs, passive skills and ordinary low-mastery instant attacks retain their existing behavior. Three-hit charge buffs still apply only to the final qualifying hit.
- A small built-in in-world ability charge indicator shows 0,10,20...100%, updated from the current gameplay frame without timers or rerendering the world. Releasing at full does not force auto-cast until key-up.

## Verification

Run `node --test tests/game3d-clone-bow-release-headshot-skill-charge.test.mjs` plus existing:
`tests/game3d-bow-camera-aim-spirit-bird.test.mjs`,
`tests/game3d-bow-centre-mouse-aim.test.mjs`, and
`tests/game3d-bow-feedback-contract.test.mjs`, then `npm run build`.

**9/9 isolated V8 pure-math and source-contract tests passed**, covering the user's charge anchors, head impact, early release, indefinite cap, miss safety, skill 10% steps/5s config, current max-mastery combo restriction, one-shot release control, boss/rogue no-extra-hit and UI wiring.

**Not independently verified:** full Vite/Node build, live Game 3D/Book WebGL input on Base44, actual player hitbox alignment and boss model head zones, 30-AI performance, PvP server support. GitHub merge does not itself publish the user's Base44 editor preview; test after sync/deploy.
