# Game 3D Combat/Quest 95.1 — clone verification work

**Target:** `marcusflow1-arch/gitsync-pro` clone. The owner explicitly redirected work away from `marcusflow1-arch/atom-x-eve-os` on 2026-11-14. No changes to the original main Game 3D.

## Current state and specific defect

The clone contains the original 84.4 scheduler and 85.1 regression manifest plus `combat950.ci-release-gate.test.mjs`. However, the clone did **not** contain `.github/workflows/game3d-combat-950.yml`, which the existing 95.0 release-gate test reads. That can fail even before a single meaningful private Combat/Quest check is attempted.

## 95.1 implementation

1. Restore the complete native Node 22 CI verification gate under the filename expected by `combat950.ci-release-gate.test.mjs`. Run the 84.4, 86.9, 87.0, 87.1, 87.2 and 87.3 core suites and the complete 31-suite original 85.1 offline manifest. `continue-on-error` or `|| true` is prohibited.
2. Add `combat951.clone-verification.test.mjs` to prove workflow presence, a complete manifest, a safe worker entrypoint, and absence of activation of public world authority, reward writer, session issuance and production release switches.
3. This gate is **source/offline-only**. It never configures PostgreSQL, authenticates real users, starts a WebSocket gateway or enables Combat/Quest routes.

## Verification record

- File restore and native test coverage: candidate code committed to clone GitHub.
- Node 22 TAP results: **pending** until a runner executes `node --test` against the actual PR head.
- Disposable PostgreSQL 16 receipt/replay integration: **not tested**.
- Authenticated 84.5 → 13.7/13.8 world admission and reconnect/shutdown on deployed staging: **not tested**.
- Two-client end-to-end and reward idempotency: **not tested**.
- Production readiness: **false**.

**Progress policy:** Treat 95.1 as work **started**, not finished, and retain the last verified source milestone at **95.0** until required native regression checks pass. The earlier 95.0 number was a roadmap marker, not 95% live gameplay verification. Do not auto-advance other 0.1-point steps.

## Commands for authorized native checkout

```sh
node --version                       # >=22
node --test server/game3d/tests/combat950.ci-release-gate.test.mjs
node --test server/game3d/tests/combat951.clone-verification.test.mjs
node --test server/game3d/tests/combat851.offline.test.mjs
node server/game3d/tools/verifyCombatQuest851.mjs
```

Record full TAP output, exact commit SHA and failures. CI runners that fail before executing steps do not provide pass/fail evidence. Do not bypass the gate and claim the milestone complete.
