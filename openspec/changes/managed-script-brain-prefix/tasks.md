# Tasks: memory scripts move to the `brain:memory:*` namespace (#961) — Tier-1 PR (Closes #963, Refs #961)

Scope: Tier-1 PR only, plus committing this SDD change's own artifacts (`openspec/changes/managed-script-brain-prefix/`, including `brain-drafts/`). Doctrine promotion (Tier 2/3) is a separate maintainer PR, out of scope, per R1/R10. Word budget exceeded like `design.md`, for the same reason: R3 widened scope to eleven scripts and the anchored file:line list cannot be compressed without losing the mapping design.md deferred to this phase.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~163 counted (package.json +11, scripts ~120, docs/README/templates/.gitignore ~20, CHANGELOG ~12); tests/openspec/AGENTS.md/.memory ignore-listed |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | not passed by orchestrator this run; Low risk makes the choice moot |
| Chain strategy | n/a (single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full Tier-1 rename + guard + SDD artifact commit | PR 1 (Tier-1, `Closes #963`, `Refs #961`) | Single PR; doctrine drafts committed unapplied, promotion is a later maintainer PR |

## Phase 0: Pre-flight (sequential, blocking)

- [x] 0.1 Measure baseline on `origin/main` tip (before merge): `GIT_CONFIG_GLOBAL=/dev/null npm test`; record pass/fail/skip counts in `apply-progress.md`.
- [x] 0.2 Merge `origin/main` into `refactor/managed-memory-scripts-brain-prefix` via `git merge` (never rebase); resolve conflicts.
- [x] 0.3 Re-measure `brain/scripts/memory/chunk-boundary.test.mjs`'s hardcoded `cli.mjs` import line pin (#937) post-merge; re-pin in the same merge commit if it moved.

## Phase 1: Pinning test + `package.json` (RED→GREEN)

- [x] 1.1 RED: create `brain/scripts/memory/package-scripts.test.mjs` — 11-verb pinning test per design's Interfaces/Contracts block, skipped unless `.brain-source` exists; must fail (keys absent). Satisfies spec req "Bare Aliases Stay Runnable Inside brain".
- [x] 1.2 GREEN: insert 11 `brain:memory:*` keys into `package.json` right after `:76` (D1); lines 65-76 stay byte-unchanged.
- [x] 1.3 Mutation: edit one new key's value, confirm ONLY 1.1 fails; revert.

## Phase 2: Hazard guard (RED→GREEN, depends on Phase 1 for real-tree target)

- [x] 2.1 RED: create `brain/scripts/lib/memory-script-prefix.test.mjs` — fixture tests for A1 (`brain:brain:`), A2 (`governance.yml` `memory:index-lag`), A3 (run context), A4 (bare token, T1 set) per design's assertion table; scanner absent, tests fail.
- [x] 2.2 GREEN: implement pure `scan(files)` in the same test file (D3, test-only) satisfying A1-A4.
- [x] 2.3 Add real-tree read-only test (gated on `.brain-source`); expected RED here (bare names still present).
- [x] 2.4 Mutation: apply each Ax's listed fixture mutation, confirm it kills only that assertion.

## Phase 3: Anchored renames — production, hooks, tests (R7 mapping only)

- [x] 3.1 Tighten rename-blind tests first (RED): `harness/backends/plain.test.mjs:36` (`/memory:share/` → `/npm run brain:memory:share/`); `memory/backends/plainfiles.save-index-failure.test.mjs:216-217` (`/memory:reindex/` → `/npm run brain:memory:reindex/`, plus the "Do NOT run" string).
- [x] 3.2 Rename scripts/entry: `brain-to-engram.mjs:6`; `brain-save.mjs:5,33,43`; `brain-metrics.mjs:314,340`; `bootstrap.sh:312,313,334`.
- [x] 3.3 Rename hooks: `hooks/pre-push:6,10,115`; `hooks/post-merge:57`.
- [x] 3.4 Rename harness/vcs: `harness/backends/plain.mjs:18`; `vcs/contributor-scaffold.mjs:276`.
- [x] 3.5 Rename `memory/**` production: `cli.mjs:8`; `staged-records-check.mjs:15`; `index-lag.mjs:45,107`; `lane/plan.mjs:112`; `backends/engram.mjs:14,802,827,1471,1537`; `lib/backend-selection.mjs:13,19`; `lib/store.mjs:101`; `lib/upstream-records.mjs:300`; `lib/duplicates.mjs:13,35,189`; `lib/format.mjs:227`; `lib/migrate-v1.mjs:215`; `lib/secret-scrub.mjs:1,3`; `lib/audit-io.mjs:1,22`; `lib/audit.mjs:1,144`; `lib/resolve-index.mjs:6`; `__fixtures__/env.mjs:12`. Re-verify the `chunk-boundary.test.mjs` pin (0.3) still matches `cli.mjs`; re-pin if shifted.
- [x] 3.6 Update expectations in the 28 dependent test files (82 sites, confirmed by grep on this base — matches design's count): `i18n/coverage.test.mjs`, `memory/cli.collect.test.mjs`, `brain-save.test.mjs`, `memory/cli.reindex-duplicates.test.mjs`, `memory/cli.backend-fallback.test.mjs`, `memory/cli.migrate-v1.test.mjs`, `memory/cli.audit.test.mjs`, `memory/lane/plan.test.mjs`, `memory/cli.ship.test.mjs`, `vcs/contributor-scaffold.test.mjs`, `harness/backends/plain.test.mjs` (also 3.1), `hooks/pre-push.test.mjs`, `memory/backends/plainfiles.save-index-failure.test.mjs` (also 3.1), `memory/staged-records-check.test.mjs`, `lib/pm.test.mjs`, `memory/capture-reachable.test.mjs`, `memory/cli.split-records-duplicates.test.mjs`, `lib/memory-coverage.duplicates.test.mjs`, `memory/cli.save-search.test.mjs`, `memory/lib/duplicates.test.mjs`, `memory/lib/duplicates.i18n.test.mjs`, `memory/lib/migrate-v1.test.mjs`, `memory/lib/supersedes.integration.test.mjs`, `memory/lib/records-merge-duplicate.integration.test.mjs`, `memory/lib/resolve-index.integration.test.mjs`, `memory/lib/audit-io.test.mjs`, `memory/lib/upstream-records.integration.test.mjs`, `memory/lib/audit.test.mjs`.

## Phase 4: i18n catalogs (R9, same PR)

- [x] 4.1 Update `i18n/en.mjs:76,103,201,203,294,334,409,452,470` and `i18n/es.mjs:67,93,185,187,267,303,364,403,421` to `brain:memory:*` (values only, keys unchanged); include `:288,290` in the same commit. Satisfies spec req "The CLI Never Names a Command That Does Not Exist".
- [x] 4.2 Confirm/adjust `coverage.test.mjs:96-104` and `duplicates.i18n.test.mjs:64-65`; design's Testing Strategy row 4 accepts both failing together on a revert of `en.mjs:201` — this is the one known double-kill.

## Phase 5: Docs, root, living specs, CHANGELOG

- [x] 5.1 `docs/workflow-guide.md:86`; `docs/methodology-map/index.html:825,863,867,1026`.
- [x] 5.2 `README.md:193,194`; `.github/PULL_REQUEST_TEMPLATE.md:135`; `.gitlab/merge_request_templates/Default.md:135`; `.gitignore:82` (both missed by explore, found by design).
- [x] 5.3 `openspec/specs/governance/spec.md:687,691,695,701,831`; `feature-working-memory/spec.md:53,58,64,169,177,184,185`; `governance-v3/spec.md:988,1014,1020,1027`.
- [x] 5.4 Add new `## Unreleased — memory scripts join the brain: namespace (#961)` section to `CHANGELOG.md` per design's exact text; lines 523-532 stay untouched (R5).

## Phase 6: Verification, guard closure, commit, PR

- [x] 6.1 Re-run the guard's real-tree test (2.3) — must now be GREEN (A1-A4 pass), all Tier-1 sites renamed.
- [x] 6.2 Full `GIT_CONFIG_GLOBAL=/dev/null npm test`; diff against 0.1 baseline — only expected deltas.
- [x] 6.3 Build the mutation table in `apply-progress.md`: revert each production change one at a time, show exactly its own test dies (per design's Testing Strategy + guard mutation column); never two unless explicitly noted (4.2).
- [x] 6.4 Stage and commit `openspec/changes/managed-script-brain-prefix/` (including `brain-drafts/` as-is, unapplied) as this PR's SDD record; subject cites `#963`.
- [x] 6.5 Record-first closing commit: `npm run memory:save -- "<title>" "<content>" --issue 963 --type <type>` (positionals, issue #928); parse the `rec-` id from stdout; stage only that record file + `.memory/index.jsonl`; verify exactly one net new id. Never stage `.memory/manifest.json` or touch other `.memory/records/**`.
- [ ] 6.6 Open the PR: `Closes #963`, `Refs #961`. Name the coordination risk in the PR body: epic task 2.4 (#955, worktree `brain-artifact-retirement`) edits the same `brain/scripts/memory/cli.mjs`, `i18n/en.mjs`, `i18n/es.mjs`, `brain/scripts/memory/backends/engram.mjs` in parallel — whichever merges second merges `main` and resolves. NOT DONE by sdd-apply per hard constraint (never `git push`, never open a PR — commits are local only, the maintainer pushes and opens the PR).

## Phase 7: Doctrine drafts — BLOCKED, not on the Tier-1 critical path

- [ ] 7.1 **BLOCKED — maintainer decision required.** Resolve the ADR-promotion ruling gap (`design.md` "RULING GAP"): option A (allow one `§1c` `amend-find`/`amend-replace` annotation per ADR draft) or option B (hand-apply acts 1/3/4 per R6, no verb promotion). `brain:promote` refuses the five ADR drafts as written (zero-edit refusal, `amendment-draft.mjs:171-177`) until this is chosen. No task in Phases 0-6 depends on 7.1; the ADR drafts are committed unresolved in 6.4 and promoted in a separate maintainer PR after Tier-1 merges (R1). Owner: maintainer.
