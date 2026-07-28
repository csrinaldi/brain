# Tasks: branchProtect contract-parity coverage (M10 Phase 2, rank 2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80-120 (parity block 50-70, source-scan test 30-50) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Parity block + source-scan test in `vcs.contract.test.mjs` | PR 1 (single) | Test-only, both additions ship together; no dependency on other Phase 2 slices |

## Phase 1: Contract-Parity Block (Behaviour)

- [x] 1.1 In `brain/scripts/vcs/providers/vcs.contract.test.mjs`, after `LABEL_LIST_PROVIDERS` (~line 530), add a `BRANCH_PROTECT_PROVIDERS` map with `github`/`gitlab` entries, each exposing `ok(checks)` and `fail(stderrFlavour)` glue via `setSpawn` — GitHub fail stderr must trip the `403 … upgrade to Pro` branch, GitLab fail stderr the `: 403` branch.
- [x] 1.2 Add a `for (const providerName of Object.keys(BRANCH_PROTECT_PROVIDERS))` loop with 3 tests per provider: (a) happy path calls `branchProtect({ project, checks: ['ci'] })` via `ok` glue and asserts result is exactly `{ enforced: true }`; (b) failure path via `fail` glue asserts `enforced === false`, `typeof reason === 'string'`, `typeof remedy === 'string'`; (c) `assert.doesNotReject` wrapping the failure-path call, proving `branchProtect` never throws under mocked transport failure.
- [x] 1.3 Confirm `checks: ['ci']` is passed in every mocked call — `github.branchProtect` does `checks.map()` with no default and throws on `undefined`; omitting it would make test 1.2(c) fail for the wrong reason (unhandled TypeError, not `never-throws` contract).
- [x] 1.4 Assert reason/remedy values are never compared for exact string equality across providers — only type and presence (per spec Requirement 1, Scenario "Failure path shape").

## Phase 2: Source-Scan Lock (Structure)

- [x] 2.1 At the file tail, next to the existing `REQ-266-3 lock 2` source-scan block (~line 587), add a new test that reads `gitlab.mjs` via `readFileSync`/`fileURLToPath` (reuse existing import pattern) and extracts the `branchProtect` function slice: `src.indexOf('export async function branchProtect')` through the next `\n}\n` at column 0.
- [x] 2.2 Assert the extracted slice does NOT match `/approvals|approval[_-]?rules/i` — this is the GitLab `requiredReviews` no-op lock. Add a load-bearing comment stating the scan is intentionally function-scoped because `gitlab.mjs:271` (`prReviews`) legitimately calls `.../approvals` and a file-wide scan would false-positive.
- [x] 2.3 Assert `requiredReviews` occurs exactly once in the slice (the function signature) via a count check (e.g. `(slice.match(/requiredReviews/g) || []).length === 1`) — proves the param is declared and never referenced in the body.
- [x] 2.4 Add a companion assertion (or inline comment with a quick manual check) confirming the SAME pattern DOES match when scanned file-wide — proving the narrow scope is load-bearing, not incidentally passing (per spec Scenario "Scan does not false-positive").

## Phase 3: Verification

- [x] 3.1 Run `npm test` — all pre-existing tests (1952+) must stay green, including the 15 `providers.test.mjs` `branchProtect` tests (protected by `afterEach(() => setSpawn(spawnSync))`). Result: 1959/1959 pass, 0 fail.
- [x] 3.2 Confirm exactly the expected number of new tests appear in the run output (6 parity tests: happy/fail/never-throws x 2 providers, + 1 source-scan test = 7; adjust if consolidated). Confirmed: 1952 baseline + 7 new = 1959.
- [x] 3.3 Manually verify mocked GitHub/GitLab stderr fixtures are realistic against the real `github.mjs`/`gitlab.mjs` branch conditions read in this session (403+"upgrade...pro" for GH tier block; `: 403` for GL permission block) — no live API call needed, just re-read the provider source.

## Phase 4: Review Checklist

- [x] 4.1 Diff review: confirm `brain/scripts/vcs/providers/github.mjs` and `brain/scripts/vcs/providers/gitlab.mjs` are UNCHANGED (git diff shows zero lines touched in either). Confirmed via `git diff --stat` — empty for both files.
- [x] 4.2 Style review: new blocks match existing `vcs.contract.test.mjs` conventions — comment banners (`// ── ... ──`), `setSpawn`/glue map naming, assertion message strings explaining WHY, not just WHAT.
- [ ] 4.3 File a tracking issue for the D1 fork (implement GitLab approval-rules API vs. ratify-and-report) before merge — referenced in design.md Open Questions; link the issue number in the PR description. NOT FILED in this apply batch (creating GitHub issues is a side effect outside this batch's explicit scope) — logged as an open question for the orchestrator/user to file before merge.
- [ ] 4.4 File a tracking issue for the discovered `github.branchProtect` never-throws contradiction (`checks.map()` throws when `checks` is omitted) — do not fix in this PR, only file it. NOT FILED in this apply batch — same rationale as 4.3, logged as an open question.

## Phase 5: Documentation

- [x] 5.1 If `vcs.contract.test.mjs` has a header/top-of-file comment enumerating covered verbs, add `branchProtect` to that list. DEVIATION: the top-of-file comment (lines 1-24) is a historical note from issue #239 A3 Phase 3 naming only `labelEvents`/`prView`/`mrCreate` — it was never updated for `issueView`, `prStatusRollup`, `labelList`, or the `WRITE_VERB_PROVIDERS` verbs added since. It is not a maintained enumeration, so `branchProtect` was deliberately NOT added there to avoid implying it alone was appended after those others. Flagged for the reviewer.
- [x] 5.2 Commit message: `test: add branchProtect contract-parity assertions (M10 Phase 2)` — body notes the GitLab `requiredReviews` no-op is pinned, not fixed, and references the tracking issues from 4.3/4.4. Committed as `d6666d5` on branch `feature/m10-phase2-branchprotect`.

## Tracking Only (not implementation tasks)

- GitHub `checks` undefined → TypeError contradicts the never-throws contract — filed per task 4.4, fixed in a future slice.
- D1 decision (GitLab `requiredReviews`: implement vs. ratify) — filed per task 4.3, tracked issue TBD, resolved in a future slice.
- Issue iid is still TBD — rename `openspec/changes/m10-phase2-branchprotect/` to `openspec/changes/issue-{iid}-m10-phase2-branchprotect/` once assigned (per design.md Open Questions).
