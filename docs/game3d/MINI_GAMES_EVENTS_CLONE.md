# Mini Games / social arenas — clone preview

Owner request, 2026-11-14. This is a **Game 3D clone** feature. Keep the main `atom-x-eve-os` game unchanged until the owner reviews the clone.

## HUD and navigation
- Third 42px (36px mobile) icon beside Echo Chronicle and the Blueprint Library, without moving the player portrait, top-left online badge, compass, HP or chat.
- Esc → HUD & Community can hide/show this icon; preference is local only.
- A liquid-glass modal with the nine requested games, one course preview per game and actual signed-in lobby registrations.
- Game choices: Football, Soccer, Basketball, Tennis, Chess, Checkers, **Palm Clash** (original turn-based palm-strike challenge, not licensed Power Slap), Sumo Wrestling, Volleyball. All games are open to all players.
- Key: Escape closes the UI before the global pause menu. Player movement stops while menu owns pointer, with prior modal flag restored on exit.

## Matchmaking, backend integrity
- `base44/functions/game3dMiniGames/entry.ts` owns list/create/rsvp/leave/cancel.
- `Game3DMiniEvent` and `Game3DMiniRSVP` are admin-write, server-mediated records, not client-provided totals. Identity comes only from Base44 authentication. Active RSVP records are deduplicated by user ID; spectators do not count toward match-ready thresholds.
- Events expire after 4 hours. Hosts can hold up to three open lobbies, one per game. Max 64 spectators per event. Limits are in code.
- When `minPlayers` is met, server responses label the lobby `ready`. **Ready is not Running** and grants no XP, AGP, items, wins, rankings or achievements.
- Event refresh polls while the hub is open. If backend function/entity deployment fails, the UI reports the failure instead of silently fabricating participants.
- Known next-phase backend need: transactional uniqueness/capacity and race-safe session assignment before real matchmaking is exposed at scale.

## Arena geometry
- `miniGameArena.mjs` creates a separate THREE.Group from simple built-in geometry for each field/court/ring/board: football field and goalposts, soccer goal/center circle, basketball court and hoops, tennis and volleyball nets, 8×8 chess/checker boards, original Palm Clash platform, sumo ring.
- `MiniGameArenaPreview.jsx` renders a bounded separate canvas when the hub is open. Closing/switching games disposes it. No model downloads/textures or permanent world terrain mutations.
- A playable-world implementation must create an **isolated match instance** with a temporary arena floor and trusted collision, spawn/return points, camera/spectator transport and clean teardown. Do NOT alter the Wolfveil town's center tree/plaza/perimeter or reuse the main world heightfield as the sports playing field.
- The current preview geometry is **visual only**, not a live sports simulation.

## Remaining required gameplay work
1. Game-specific controllers: football/soccer possession and scoring; basketball dribble/pass/shoot, tennis and volleyball balls/nets; two-player chess/checkers valid moves and turn synchronization; Palm Clash original timing/impact mechanics; sumo ring-out and balance.
2. Authenticated server-authoritative clock, inputs, physics/turns, score/results, anti-spam and tournament rewards.
3. Dedicated arena session routing, collision, return transport and spectators' camera view; keep it a separate world instance, not a real-time terrain overwrite of the shared town.
4. Enforced event capacity and single-seat uniqueness in transactional storage; cleanup expired invitations; reconnect/late join and disconnect handling.
5. Live preview and device QA (mobile, pointer lock, ESC, 2–20 concurrent players, spectator slots and protected HUD).

**No Base44 Publish or playable-match completion claim until the above steps are actually implemented and tested.**
