# Game 3D — two-repository workflow (owner direction, 2026-11-13)

**Apply future user-authorized Game 3D changes to both repositories together:**

- Main: `marcusflow1-arch/atom-x-eve-os`
- Clone: `marcusflow1-arch/gitsync-pro`

Treat these as two independently deployed/reviewed repositories, not an automatic branch mirror. Inspect the current code and ownership in **both** before editing. Create matching scoped branches/PRs and link each counterpart. Match behavior, equipment identifiers, thumbnails and required binary assets; verify presence in each destination, rather than assuming files transferred when only JavaScript was copied.

Use the existing canonical equipment inventory and player save flows. Do not duplicate or unconditionally reset player-owned inventory. Do not transfer secrets, production database contents, unrelated products/games, or overwrite a repository's unrelated features.

Run focused/native tests separately for both where practical, then signed-in Game 3D Play visual, equipment and multiplayer verification as applicable. Report test evidence honestly. GitHub-hosted no-step CI failures alone do not prove code defects; do not bypass branch protection or merge without review/owner approval.

Landscape square PRs remain governed by hub #1266 and individual LAND-WS01–WS15 ownership and independent 100% acceptance. A related equipment PR does not authorize releasing or merging unfinished terrain squares.

## Equipment baseline in this change

- `Full Set 1` = existing Nightscale armor (six independently equippable slots).
- `Full Set 2` = existing Frostwarden armor (six independently equippable slots).
- Three un-equipped starter bows use existing ranged weapon identity and quick-switch logic.
- Inventory thumbnails show actual armor preview JPGs (clone bundles the same art and the corresponding male/female GLB pieces). Only the equipped slots are visible on the actor; these are not a fake all-in-one full-set equip transaction.
- Inventory starter catalog version 2 introduces these test items once without recreating destroyed/consumed version-1 equipment.
- This document is a workflow record, **not** signed-in Play validation or permission to deploy.
