# Tasks — THE CUTOVER (C2b-2, #222)

> Prep + rehearsal only. NO real-store mutation in this PR. The real run is @csrinaldi's post-APPROVE
> keystroke. Strict TDD for the code.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~60–120 (CLI un-refuse + rollback command); runbook + artifacts excluded |
| 400-line budget risk | Low |
| Delivery | Standalone PR-as-review into feature/v2.0.0, Part of #222 |

## Phase 1: Un-refuse the CLI (RED → GREEN)
- [x] 1.1 Test (RED): `memory:migrate-v1` without `--dry-run` executes `runMigration` against a fixture root (records written, chunks → legacy/, report persisted, index rebuilt); `--dry-run` unchanged.
- [x] 1.2 `cli.mjs` (GREEN): replace the `cutoverDeferred` refusal with the real run; i18n adjusted (the refusal string retired / repurposed).

## Phase 2: Rehearsed rollback (RED → GREEN)
- [x] 2.1 Test (RED): a rollback restores a migrated fixture store to byte-identical pre-cutover state (chunks back from legacy/, records/ gone, index rebuilt).
- [x] 2.2 The rollback command/function (GREEN); i18n (en + es).
- [x] 2.3 Rehearse the rollback on a fixture and capture its verbatim output as CP evidence.

## Phase 3: The runbook artifact
- [x] 3.1 `runbook.md` — numbered steps (0 preflight+backup, 1 migrate real, 2 commit dualWrite=true, 3 verification share, 4 post-cutover criteria), exact command + observable verification per step, rollback as its own section (with the rehearsed output), post-cutover criteria vs forecast (275/3/4/0).

## Phase 4: Design carry-over + baseline
- [x] 4.1 Fold the scrub-asymmetry recategorization (records=scan-then-write vs chunks=C1b-backstop is CORRECT, re-architecture REJECTED not deferred) into design.md (already present as Decision 5). NOTE: correcting issue-221's design.md stale "deferred" wording is explicitly out of scope for this slice's apply pass — deferred to the orchestrator per this run's constraints (do not edit `openspec/changes/issue-221-*`).
- [x] 4.2 `npm test` green · `brain:repo:check` · `brain:nav`.
- [x] 4.3 `.memory/` (real store) never mutated by code, tests, or this PR.

## Out of scope
- Round-trip contract test (both directions) + pull→records-only switch + retiring memory.dualWrite → C4.
