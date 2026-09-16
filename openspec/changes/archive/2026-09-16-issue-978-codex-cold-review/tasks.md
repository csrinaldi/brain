# Tasks: Codex Cold-Review Transport

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 780–980 lines across transport, security, setup, tests, and docs |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 output/snapshot seam → PR 2 Codex security → PR 3 setup/config/docs |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Carry host output, prompt mode, and snapshots without changing Claude | PR 1 | `node --test brain/scripts/harness/stage-seam.test.mjs brain/scripts/review/lib/assemble-review-prompt.test.mjs brain/scripts/review/lib/candidate-snapshot.test.mjs brain/scripts/review/lib/run-cold-review-stage.test.mjs` | N/A — injected seam doubles | Revert seam/prompt/snapshot/stage edits |
| 2 | Add isolated Codex `gpt-5.5` execution and fail-closed publication | PR 2 | `node --test brain/scripts/harness/backends/codex.test.mjs brain/scripts/review/lib/run-cold-review-stage.test.mjs` | Optional bounded authenticated `codex exec` probe; otherwise N/A | Revert Codex backend and its security wiring |
| 3 | Make setup/config/docs route-conditional and prove both branches | PR 3 | `npm run test:fresh-install` plus targeted setup tests | Fresh-install positive/negative route fixtures | Restore Claude route and remove Codex setup/docs |

## Phase 1: Output and Candidate Boundaries (PR 1)

- [x] 1.1 RED: add seam tests for preserving `output` and omitted-output Claude compatibility in `brain/scripts/harness/stage-seam.test.mjs`.
- [x] 1.2 GREEN: carry opaque output descriptors through `brain/scripts/harness/stage-seam.mjs`; REFACTOR only after tests pass.
- [x] 1.3 RED: test exact/return-artifact prompt mode in `brain/scripts/review/lib/assemble-review-prompt.test.mjs`.
- [x] 1.4 GREEN: parameterize `brain/scripts/review/lib/assemble-review-prompt.mjs` without changing role/schema text; REFACTOR duplication.
- [x] 1.5 RED: test wrong/missing candidate `cwd` refuses; staged, `commit -a`, and empty-index states cannot alter identity; test path/type/mode/hash additions, deletions, renames, and byte changes.
- [x] 1.6 GREEN: create `brain/scripts/review/lib/candidate-snapshot.mjs` and tests; wire before/after comparison in `brain/scripts/review/lib/run-cold-review-stage.mjs`; REFACTOR diagnostics.

## Phase 2: Codex Transport and Security (PR 2)

- [x] 2.1 RED: cover exact `codex exec --model gpt-5.5` argv/env scrub, isolated writable home, timeout/non-zero/missing output, unsafe output path, and cleanup failures in `brain/scripts/harness/backends/codex.test.mjs`.
- [x] 2.2 GREEN: create `brain/scripts/harness/backends/codex.mjs` with bounded result mapping, read-only sandbox, `--ignore-user-config`, `--ephemeral`, host output, and secret-scrubbed diagnostics; REFACTOR lifecycle helpers.
- [x] 2.3 RED: add routed integration tests for candidate mutation, malformed/empty/multiple/schema-invalid `brain-findings/1`, credential/config leakage, and valid artifact handoff.
- [x] 2.4 GREEN: wire backend selection, snapshots, atomic host rename, and unchanged findings reader in `brain/scripts/review/lib/run-cold-review-stage.mjs`; REFACTOR shared refusal paths.

## Phase 3: Conditional Setup and Self-Hosting (PR 3)

- [x] 3.1 RED: test invalid/missing Codex route, Claude route without Codex, and route identity diagnostics.
- [x] 3.2 GREEN: update `brain.config.json` resolver and conditional probes in `brain/scripts/install-tools.sh` and `brain/scripts/bootstrap.sh`; REFACTOR shell branches.
- [x] 3.3 RED: add conditional-probe/fresh-install route-positive readiness and route-negative absent-Codex tests under `test/fresh-install/`.
- [x] 3.4 GREEN: implement route-gated probes/install behavior in `brain/scripts/install-tools.sh` and `brain/scripts/bootstrap.sh`; REFACTOR shell/fixture helpers.
- [x] 3.5 Update `docs/reviewer-setup.md` with authentication, writable state, model, network, and sandbox requirements; verify `npm test` and `npm run test:fresh-install`.
