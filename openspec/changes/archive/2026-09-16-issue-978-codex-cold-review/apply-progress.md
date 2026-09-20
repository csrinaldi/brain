# Apply Progress: Codex Cold-Review Transport

## Completed Tasks

- [x] 1.1–1.6 Output and Candidate Boundaries (PR 1)
- [x] 2.1–2.4 Codex Transport and Security (PR 2)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1–1.2 | Output descriptor tests failed before seam forwarding; focused tests pass. | Passed. | Opaque descriptor is forwarded unchanged. |
| 1.3–1.4 | Final-message prompt assertion failed before mode support. | Passed. | Default file-writing mode preserves Claude compatibility. |
| 1.5–1.6 | Snapshot-difference classification test failed before diagnostics. | Passed. | Snapshot comparison reports added, removed, and changed paths. |
| 2.1–2.2 | `codex.test.mjs` first failed with `ERR_MODULE_NOT_FOUND` before the backend existed. | 4/4 backend tests pass. | Output validation, cleanup, and bounded diagnostic helpers remain localized to the backend. |
| 2.3–2.4 | Codex routed-stage tests first failed because no `output` descriptor reached the seam. | 3 routed integration tests pass; valid final message is renamed then read by the existing parser. | Composition fixture now creates a disposable cold candidate, preserving mandatory snapshot evidence. |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `node --test brain/scripts/harness/backends/codex.test.mjs brain/scripts/review/lib/run-cold-review-stage.test.mjs` — 42 passed, 0 failed. |
| Composition regression | `node --test brain/scripts/review/cli.judgment.test.mjs brain/scripts/review/lib/run-cold-review-stage.test.mjs brain/scripts/harness/backends/codex.test.mjs` — 97 passed, 0 failed. |
| Required full test | `npm test` — 5,373 passed, 0 failed. |
| Runtime harness | N/A — injected seam doubles and temporary cold-worktree fixtures prove the execution boundary without authenticated inference or publication. |
| Rollback boundary | Revert `codex.{mjs,test.mjs}`, the `run-cold-review-stage` output handoff/tests, and the cold-worktree fixture change; PR 1 output/snapshot interfaces and the Claude route remain usable. |

## Remaining Tasks

- [x] 3.1–3.5 Conditional Setup and Self-Hosting (PR 3)

## Phase 3 Completed After Reset-Authorized Retry

The selected chain is `feature-branch-chain`; this is PR 3
(setup/config/docs), targeting the previous child PR rather than main. The
first attempt failed only because restricted-sandbox Node workers could not
create stream file descriptors. After the maintainer reset the objective, the
same work unit completed with distinct full-suite and fresh-install evidence.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1 | `codex-readiness` tests failed first because the helper exported no route/readiness API. | Focused route tests pass. | Kept the vendor-specific `gpt-5.5` check outside the generic opaque-model resolver. |
| 3.2 | Same route tests covered the unsupported/missing Codex route before shell wiring. | Focused route tests pass; shell syntax checks pass. | Setup invokes one shared route/readiness CLI. |
| 3.3–3.4 | Fresh-install positive/negative fixture tests first failed on the missing helper export. | Focused fixture tests pass. | Route-negative fixtures do not invoke Codex detection. |
| 3.5 | N/A — documentation and config are structural changes covered by the route fixtures. | `npm test` passed 5,380/5,380 and `npm run test:fresh-install` passed. | No further refactor needed. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | `node --test brain/scripts/harness/codex-readiness.test.mjs test/fresh-install/codex-route.e2e.test.mjs` — 2 files passed, 0 failed. |
| Shell syntax | `bash -n brain/scripts/install-tools.sh && bash -n brain/scripts/bootstrap.sh` — passed. |
| Required full test | `npm test` — 5,380 passed, 0 failed (escalated retry). |
| Required fresh-install | `npm run test:fresh-install` — passed: registry package `@logikas/brain@1.5.0` installed and completed its consumer onboarding checks. |
| Runtime harness | The PR3 `test/fresh-install/codex-route.e2e.test.mjs` positive/negative route fixtures passed in the full suite. The Docker fresh-install suite verifies the published baseline package; it cannot include this unpublished worktree change. |
| Rollback boundary | Revert `codex-readiness.{mjs,test.mjs}`, route-gated setup shell changes, the fresh-install route fixture, `brain.config.json`, and the reviewer setup section. |
| Native attempt | First attempt failed on the environment-only full-suite error. The maintainer reset the objective; retry token `sha256:d84b…5913` settled passed, remediating `sha256:b2c3…cf9b` with evidence `sha256:4a9b…1d95`. |
