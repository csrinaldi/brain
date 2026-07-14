# Tasks — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> Hardens `.github/workflows/governance-postmerge.yml` + `brain/scripts/brain-audit.mjs`. Binding:
> [[sdd/issue-259-d2/fork-rulings]] (#879, PINNED) as refined by [[sdd/issue-259-d2/checkpoint-rulings]]
> (#886, FINAL — R-1 dual-path cursor resolution, R-2 narrow range-exit-2 rises to Slice 1). spec.md and
> design.md were reconciled to match #886 before this checklist was written. Strict TDD (RED → GREEN) for
> every code task. Docs English (ADR-0009). Every task carries the GitLab-port-as-future-consumer
> discipline: platform-neutral core under `brain/scripts/governance/postmerge/`, thin GitHub-coupled
> wrapper stays in the YAML only.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice 1 ≈185 counted / Slice 2 ≈105 counted (tests + `openspec/changes/**` ignored per `governance.ignoreList`) |
| 400-line budget risk | Low (per-slice) |
| Chained PRs recommended | Yes — design already committed to a 2-slice split |
| Suggested split | PR 1 (Slice 1) → PR 2 (Slice 2), both into `feature/v2.0.0` |
| Chain strategy | feature-branch-chain suggested (PR 2 depends on PR 1's `postmerge/` modules); confirm with owner before apply |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Cursor core + parser + emission + resolved-skip + narrow R-2 exit-2 + workflow wiring + synthetic fixtures + GitLab draft | PR 1 | Base = `feature/v2.0.0`; ≈185 counted lines |
| 2 | Full 0/1/2 contract across all evaluators + drift-guard + workflow numeric branching | PR 2 | Base = PR 1 branch (retarget to `feature/v2.0.0` once PR 1 merges); ≈105 counted lines |

---

## SLICE 1 (PR 1 → `feature/v2.0.0`)

### Phase 1: Cursor core — `brain/scripts/governance/postmerge/cursor.mjs` (REQ-D2-1, REQ-D2-2, R-1)

- [x] 1.1 RED: `cursor.test.mjs` — `readCursor` returns full sha via injected `git.rev-parse`, `null` when absent.
- [x] 1.2 GREEN: implement `readCursor({ git })`.
- [x] 1.3 RED: `resolveWindow` — push run uses `{before}..{head}`; schedule run with cursor uses `{cursor}..{head}`; schedule run without cursor returns `{ missingCursor: true }`.
- [x] 1.4 GREEN: implement `resolveWindow({ git, head, eventName })`.
- [x] 1.5 RED: `advanceCursor` calls `git update-ref refs/governance/audit-cursor <to>` via injected `git`.
- [x] 1.6 GREEN: implement `advanceCursor({ git, to })`.
- [x] 1.7 RED: `isRevertedInRange(sha, {git, range})` — true when `git log --format=%B <range>` contains `This reverts commit <sha>.`; false otherwise.
- [x] 1.8 GREEN: implement `isRevertedInRange`.
- [x] 1.9 RED (R-1): `acceptManually({git, to, reason})` — throws/refuses when `reason` is empty; otherwise calls `advanceCursor({git, to})` and echoes the reason to stdout.
- [x] 1.10 GREEN: implement `acceptManually` as a thin wrapper over `advanceCursor` plus the mandatory-reason guard.
- [x] 1.11 RED + GREEN: CLI mode — `node postmerge/cursor.mjs accept <sha> --reason "<text>"` invokes `acceptManually`; missing `--reason` exits non-zero with a usage message.

### Phase 2: Single parser — `brain/scripts/governance/postmerge/parse-failures.mjs` (REQ-D2-5)

- [x] 2.1 RED: `parse-failures.test.mjs` — `parseFailingShas(text)` extracts full 40-hex shas from `[FAIL-SHA] <sha>` lines, order-preserving, deduped via `Set`, ignores malformed/short (sha7) lines.
- [x] 2.2 GREEN: implement `parseFailingShas`.
- [x] 2.3 RED + GREEN: CLI mode reads stdin, prints deduped full-sha list one per line; test it against synthetic stdin, zero real process spawn required in the assertion itself.

### Phase 3: `brain-audit.mjs` emission + resolved-skip + narrow exit-2 (REQ-D2-3, REQ-D2-4, R-2)

- [x] 3.1 RED: emission test — a synthetic offending merge produces both `[FAIL] <sha7> ...` (unchanged) and a new `[FAIL-SHA] <full-sha>` line.
- [x] 3.2 GREEN: add the additive `[FAIL-SHA]` print at the existing `[FAIL]` emission site (`brain-audit.mjs:236` today).
- [x] 3.3 RED: resolved-skip test — a flagged merge with a matching `isRevertedInRange` hit is reported `[SKIP] <sha7> — resolved by revert` and NOT counted as a failure.
- [x] 3.4 GREEN: import `isRevertedInRange` and add the pre-evaluation skip class (symmetric to the existing pre-baseline skip at `brain-audit.mjs:159-167`); four evaluators (`diffSize`/`issueLink`/`adrPresence`/`memoryPresence`) stay untouched.
- [x] 3.5 RED (R-2): range-uncomputable test — inject a throwing `git log` for the range; assert `brain-audit.mjs` exits 2 (not the old fail-open exit 0).
- [x] 3.6 GREEN (R-2): add a throwing `gitOrThrow` for the range-load (`brain-audit.mjs:145-149`), distinguishing "git threw" (→ `process.exit(2)`, one narrow site, no `resultToExit`/`EXIT` wiring yet) from "log genuinely empty" (→ 0).

### Phase 4: Workflow wiring — `.github/workflows/governance-postmerge.yml` (REQ-D2-1, REQ-D2-2, REQ-D2-3, REQ-D2-4)

- [x] 4.1 Edit the window-resolution step to call `resolveWindow`/`readCursor` instead of `git describe --tags --abbrev=0`.
- [x] 4.2 Edit the missing-cursor branch: `{ missingCursor: true }` → exit 2, open/update a `governance:cursor-missing`-labeled issue containing the exact `git update-ref ...` + `git push ...` init command; no auto-create, no revert.
- [x] 4.3 Edit the range-uncomputable branch (R-2, from Phase 3.6's exit 2): route through the SAME loud-issue mechanism as 4.2 (recommended label `governance:audit-uncomputable`), never a revert.
- [x] 4.4 Edit the revert step: `mapfile` the parser's stdout (never inline grep), revert exactly the parsed offender SHAs — remove the unconditional `github.sha` revert target (fixes bug 2).
- [x] 4.5 Edit the dedup check: key the `auto-revert/<sha7>` branch existence check on the offender sha, not the push HEAD sha (fixes bug 3).
- [x] 4.6 Edit the clean-exit branch: on exit 0, call `advanceCursor(to = HEAD)` and push `refs/governance/audit-cursor`.

  > **Apply-time note:** correctly routing exit 2 away from the revert path (4.2/4.3) required
  > capturing brain-audit's NUMERIC exit code (dropping `continue-on-error`/`steps.audit.outcome`,
  > which flattens 1 and 2) already in Slice 1 — the general "drop continue-on-error, case 0/1/2/*"
  > framing in Phase 11 (Slice 2) is understood to extend/hardened this same mechanism, not
  > introduce it from scratch. Flagged for review.

### Phase 5: Synthetic fixtures — 100% synthetic, no real fossils (REQ-D2-8)

- [x] 5.1 RED-first fixture: release-tag move masking an offender — proves the cursor-derived window still includes it (bug 1 shape), fails under pre-fix behavior.
- [x] 5.2 RED-first fixture: multi-merge push (good M1, offender M2, good HEAD M3) — proves M3/HEAD survives and only M2 is reverted (bug 2 shape).
- [x] 5.3 RED-first fixture: repeated-cycle re-detection of an already-in-flight offender — proves no second branch/PR spawns (bug 3 shape). Covered via structural assertions (dedup keyed on the offender-sha loop variable + the pre-existing `git ls-remote` idempotency guard test) — the `git ls-remote`/branch-creation bash itself has no execution-level test harness in this repo; flagged for reviewer awareness rather than a full end-to-end bash-execution fixture.
- [x] 5.4 RED-first fixture: missing cursor on a schedule run — proves exit 2 + loud issue, zero revert, zero auto-init.
- [x] 5.5 RED-first fixture (R-2): uncomputable range (throwing git log) — proves exit 2, not the old fail-open exit 0.
- [x] 5.6 RED-first fixture (R-1): human-accept command on an unresolved offender — proves the cursor jumps past it and a subsequent schedule run's window starts after it.
- [x] 5.7 Confirm (no code): fixture provenance audit — none reference or replay the re-measured 168 closed PRs / 0 real `auto-revert/*` branches. Confirmed: all fixtures use `mkdtempSync` synthetic repos with fabricated commits.

### Phase 6: GitLab-porting constraint draft (REQ-D2-9)

- [x] 6.1 Write `openspec/changes/issue-259-d2/brain-drafts/gitlab-porting-constraint.md` stating rung-3 auto-revert must not port to GitLab until D2's fixes land, and that the GitLab port covers PR-time gates (`GOVERNANCE_JOBS`) only.
- [x] 6.2 Confirm (no code): no ADR / `brain/core/` / PLAN file is touched by this PR — human co-promotes the draft separately (pattern #216). Confirmed via `git status`.

### Phase 7: Slice 1 gate

- [x] 7.1 `npm test` green (1479/1479) · `brain:repo:check` green · `brain:nav` green. `brain:change:verify` fails on `node --check brain/scripts/lib/chunk-reader.mjs` — confirmed via `git stash` that this is a PRE-EXISTING failure on the base branch (chunk-reader.mjs was deleted by issue-247/#257, merged before this branch; some static gate-file list in `verify-change.mjs` still references it), unrelated to and not introduced by this change. Flagged for reviewer/owner attention — out of D2's scope to fix.
- [x] 7.2 Budget check: `cursor.mjs` (124) + `parse-failures.mjs` (40) + `brain-audit.mjs` (43+1) + `governance-postmerge.yml` (100+50) = **358 counted lines** (test files excluded per `governance.ignoreList`) — above the ~185 design estimate (verbose JSDoc/rationale comments + the dual-path resolution/CLI/exit-2 wiring beyond the estimate's granularity) but comfortably ≤400; no `size:exception` used.
- [ ] 7.3 `memory:share` before push, per house convention. — NOT run (apply phase stops before push per instructions).
- [ ] 7.4 Push, open chained PR #1 into `feature/v2.0.0`; do not begin Slice 2 code in this PR. — NOT done (apply phase stops before push/PR per instructions; a fresh review runs first).

---

## SLICE 2 (PR 2 → base = PR 1 branch, retarget to `feature/v2.0.0` once PR 1 merges)

### Phase 8: `postmerge/exit-codes.mjs` — EXIT enum + `resultToExit` (REQ-D2-6)

- [ ] 8.1 RED: `exit-codes.test.mjs` — `resultToExit({uncomputable:true}) === 2`; `resultToExit({pass:true}) === 0`; `resultToExit({pass:false}) === 1`.
- [ ] 8.2 GREEN: implement `EXIT = {PASS:0, VIOLATION:1, UNCOMPUTABLE:2}` and `resultToExit(result)`.

### Phase 9: `run-check.mjs` wiring — full contract across all evaluators (REQ-D2-6, REQ-D2-7)

- [ ] 9.1 RED: `decision-gate`/`diff-size` runners — inject a throwing `defaultDiffNameOnly`/`defaultDiffNumstat`; assert `uncomputable:true` on the returned result.
- [ ] 9.2 GREEN: add `uncomputable:true` to the existing infra fail-closed returns for those two runners.
- [ ] 9.3 RED: `issue-link` runner — inject non-string body / uncomputable `defaultBranch` / throwing `fetchIssue`; assert `uncomputable:true`.
- [ ] 9.4 GREEN: wire the same flag into `runIssueLinkCheck`'s fail-closed paths.
- [ ] 9.5 RED (memory-gate genuine →2, §4.4): inject a throwing `readRecords` (IO/permission) vs. an empty-array `readRecords`; assert the throw maps to `uncomputable:true` (→2) and the empty array stays a real violation (→1).
- [ ] 9.6 GREEN: wrap the memory-gate's `readRecords` call at the runner boundary per the throw/empty distinction.
- [ ] 9.7 RED + GREEN: `main()` in `run-check.mjs` uses `resultToExit(result)` for `process.exit`, replacing any ad-hoc 0/1 mapping.

### Phase 10: `brain-audit.mjs` general top-level catch (REQ-D2-6)

- [ ] 10.1 RED: inject an unexpected exception at the top-level try; assert exit code 2 (not today's exit 1).
- [ ] 10.2 GREEN: change `brain-audit.mjs:241-244`'s `catch → process.exit(1)` to `→ 2`.

### Phase 11: Workflow numeric exit capture + 0/1/2 branch (REQ-D2-6)

- [ ] 11.1 Edit `governance-postmerge.yml`: drop `continue-on-error` + `steps.audit.outcome`; capture the numeric `$?` via `set +e; ...; code=$?; set -e`.
- [ ] 11.2 Edit the case statement: `0` → advance cursor; `1` → revert parsed offenders; `2` → loud infra issue, never revert/advance; any other code → treat as infra-loud.
- [ ] 11.3 RED + GREEN (integration): a synthetic run with a stray `[FAIL-SHA]`-like string in stdout but exit code 2 — assert no revert occurs (numeric code, not text, is authoritative).

### Phase 12: Drift-guard — both-fixtures per check (REQ-D2-7)

- [ ] 12.1 RED: `exit-code-contract-drift-guard.test.mjs` — define the `CHECKS` registry (`decision-gate`, `diff-size`, `issue-link`, `memory-gate`, `brain-audit`); assert each drives to both `resultToExit === 1` (violation fixture) and `resultToExit === 2` (uncomputable fixture).
- [ ] 12.2 GREEN: wire each check's real runner into the registry so 12.1 passes for all 5.
- [ ] 12.3 RED + GREEN: a hypothetical evaluator exiting only 0/1 (no 2 path) fails the guard, naming the missing evaluator — prove the guard's teeth via a deliberately incomplete stub before trusting it against the real 5.
- [ ] 12.4 RED + GREEN: an evaluator missing its →2 fixture (but with correct logic) fails the guard, naming the missing fixture.

### Phase 13: Slice 2 gate

- [ ] 13.1 `npm test` green (all Phase 8–12 tests, including the drift-guard) · `brain:repo:check` · `brain:change:verify`.
- [ ] 13.2 Budget check: sum counted lines across `exit-codes.mjs`, `run-check.mjs`, `brain-audit.mjs`, `governance-postmerge.yml` — confirm near the ~105 estimate, ≤400, no `size:exception`.
- [ ] 13.3 `memory:share` before push, per house convention.
- [ ] 13.4 Push, open chained PR #2 against PR #1's branch; retarget to `feature/v2.0.0` once PR #1 merges.

## Open items where spec/design left a choice for apply time

- **Acceptance audit-trail sink** (task 1.10): `acceptManually`'s `reason` is echoed to stdout; whether it
  is additionally persisted to an issue comment/PR description is an apply-time choice.
- **Loud-issue label strings** (tasks 4.2, 4.3): `governance:cursor-missing` /
  `governance:audit-uncomputable` are recommendations — confirm exact strings against existing label
  conventions before merging Slice 1.
- **Chain strategy** (Suggested Work Units): confirm `feature-branch-chain` vs. sequential-merge-then-PR
  with the owner before Slice 2's PR is opened.

## Out of scope

- **Porting rung-3 auto-revert to GitLab.** Unblocked, not executed, by D2.
- **D1 and D3.** Sibling Track-D slices.
- **Rewriting evaluator semantics.** Only the exit contract is added; `diffSize`/`issueLink`/`adrPresence`/`memoryPresence` decisions are unchanged.
- **Committing the GitLab constraint into the doc zone.** Draft only (Phase 6).
- **`brain-audit.mjs`'s chunk-reader/records-reader drift.** Separate cleanup unless it blocks emission.
