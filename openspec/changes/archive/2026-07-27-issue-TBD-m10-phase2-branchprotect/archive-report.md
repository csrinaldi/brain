# Archive Report: branchProtect Contract-Parity Coverage (M10 Phase 2, Rank 2)

**Change**: `m10-phase2-branchprotect`  
**Archived**: 2026-07-27  
**Status**: PASS-WITH-NOTES — ready for merge to main

## Cycle Summary

- **Proposal** (#1398): Cross-provider contract-parity test for `branchProtect` verb; pinning GitLab's `requiredReviews` no-op as a locked, testable limitation.
- **Spec** (#1400): Two requirements — contract shape assertion across GitHub/GitLab; scoped source-scan locking the limitation.
- **Design** (#1402): Five architectural decisions; D1 chosen to pin-not-fix the GitLab issue; single spawn-seam glue; function-scoped source-scan; shape/type-only assertions; two separate test blocks.
- **Tasks** (#1403): 17 items; 15 completed, 2 deferred (issue filing — outside archive scope).
- **Apply Progress** (#1404): All implementation done; 94 lines added to `vcs.contract.test.mjs`; 1959/1959 tests pass (+7 new).
- **Verify Report** (#1405): PASS-WITH-NOTES; 0 CRITICAL, 3 WARNING, 1 SUGGESTION; all code aligned with spec/design/tasks.

## What Shipped

**File Modified**: `brain/scripts/vcs/providers/vcs.contract.test.mjs` — +94 lines, -0 lines

**Implementation**:
1. **BRANCH_PROTECT_PROVIDERS** parity block (50–70 lines): Parameterized test over `['github', 'gitlab']` with per-provider mocked transport. Three test cases per provider:
   - Happy path: `{enforced: true}`
   - Failure path: `{enforced: false, reason: <string>, remedy: <string>}` (reason/remedy text is provider-specific; type/presence asserted only)
   - Never-throws: `assert.doesNotReject` on transport error

2. **Function-scoped source-scan** (30–50 lines): GitLab `branchProtect` function body slice (lines 477–529) asserted to:
   - Never call approval-rules or approvals endpoints
   - Reference `requiredReviews` exactly once (the parameter declaration; never referenced in body)
   - Companion file-wide scan proves narrow scope is load-bearing (file-wide match exists via `prReviews` at line 271)

**Test Results**: 1959/1959 pass. Baseline 1952 + 7 new tests (6 parity + 1 scan). Zero flakes, zero regressions.

**Unchanged**: `github.mjs`, `gitlab.mjs`, `brain-protect.mjs`, provider-specific tests. Read-only.

## Verification

✅ **Code Correctness**:
- Both providers' `branchProtect` return the exact shape `{enforced, reason?, remedy?}` via mocks
- GitHub failure stderr `'403: upgrade to GitHub Pro...'` correctly maps to `reason:'tier'`
- GitLab failure stderr `'glab: 403 Forbidden'` correctly maps to `reason:'permission'`
- Checks param always passed in mocks (`checks: ['ci']`) to prevent unrelated TypeError
- Source-scan slice logic verified: function spans exactly lines 477–529; closing brace at column 0 line 529; `requiredReviews` appears exactly once in slice (signature only)

✅ **Style & Conventions**: Follows existing LABEL_LIST_PROVIDERS and WRITE_VERB_PROVIDERS precedent; comment banners and assertion messages match file style; uses `node:test` + `node:assert/strict`.

✅ **Spec/Design/Tasks Alignment**: Both requirements fully met. All five architectural decisions (D1–D5) correctly applied. 15/17 tasks complete; 2 deferred (issue filing) per no-side-effects constraint.

## Decisions Recorded

### D1 — Pin GitLab `requiredReviews` no-op; do NOT fix it here
**Choice**: Pin current behavior with a scoped source scan (option c).
**Rationale**: Test-only, zero runtime risk. Converts silent behavior into a falsifiable statement. If the approval-rules call is added later, the test fails and forces the decision (implement vs. ratify) into the open. A tracking issue for the fork (implement GitLab API vs. ratify-and-report) MUST be filed before this PR merges.

### D2 — Single spawn-seam glue for both providers
Both use `run()` from `lib/exec.mjs`. One `setSpawn`-based ok/fail glue serves both; per-provider fail stderr flavors documented in the map.

### D3 — Source-scan scoped by string slice, not AST
`indexOf('export async function branchProtect')` → next `'\n}\n'` at column 0. Narrow scope required because `gitlab.mjs:271` legitimately calls `/approvals` in `prReviews`; file-wide match would false-positive immediately.

### D4 — Assert shape and type, never provider vocabulary
GitHub uses `'tier'`; GitLab uses `'permission'` or `'auth'`. Assert `enforced === false`, `typeof reason === 'string'`, `typeof remedy === 'string'`. Vocabulary stays provider-siloed in `providers.test.mjs`.

### D5 — Two separate test blocks
Parity loop (behavior) after LABEL_LIST_PROVIDERS; source-scan (structure) at file tail next to the existing REQ-266-3 precedent.

## Issues Discovered (Not Fixed)

1. **GitHub `branchProtect` TypeError** (open question 4.4, not filed): `github.branchProtect` calls `checks.map()` unguarded. Throws TypeError if `checks` is omitted. Contradicts the verb's implied never-throws behavior for malformed input. Correctly NOT fixed in this test-only PR. Should get its own tracking issue.

2. **D1 Tracking Issue** (not filed): Whether to (a) implement GitLab approval-rules API enforcement or (b) ratify the limitation by having the verb report it. Design explicitly states this issue "MUST be filed before this PR merges." Deferred to orchestrator/user.

3. **File Header Comment** (5.1 deviation, documented): Top-of-file comment (lines 1–24) in `vcs.contract.test.mjs` only names `labelEvents`/`prView`/`mrCreate`, omitting subsequent additions like `branchProtect`. Not a maintained enumeration. Correctly NOT updated — a partial update would misrepresent the list as actively maintained. Recommend a separate doc-only PR to refresh it.

## Warnings (Archive Does Not Block, But Pre-Merge Resolution Needed)

- **Warning 1**: D1 tracking issue (fork a vs. b for GitLab `requiredReviews`) is not yet filed. Design specifies it "must exist before this PR merges." Recommend filing or explicitly waiving in PR description.
- **Warning 2**: GitHub `checks.map()` TypeError contradicts never-throws guarantee. Should be filed as a separate tracking issue.
- **Warning 3**: Minor cross-store inconsistency in hybrid mode: openspec `tasks.md` mark task 5.1 checked with DEVIATION note; engram tasks mark it unchecked with same text. Cosmetic; worth reconciling for consistency.

## Suggestions (Non-Blocking)

- **Doc-only follow-up**: Refresh the stale comment block at the top of `vcs.contract.test.mjs` (lines 1–24) to enumerate all contract-parity verbs added since issue #239 Phase 3. Not done in this PR per task 5.1 deviation (correct call). Recommend a low-risk doc PR after this one merges.

## Artifact Traceability (Engram)

All phase artifacts persisted to engram with topic keys for cross-session recovery:

| Topic Key | ID | Type | Content |
|---|---|---|---|
| `sdd/m10-phase2-branchprotect/proposal` | 1398 | architecture | Intent, scope, approach, risks, rollback |
| `sdd/m10-phase2-branchprotect/spec` | 1400 | architecture | Two requirements + 4 scenarios; non-goals |
| `sdd/m10-phase2-branchprotect/design` | 1402 | architecture | Technical approach; 5 architectural decisions; testing strategy; open questions |
| `sdd/m10-phase2-branchprotect/tasks` | 1403 | architecture | 17 tasks; 15 completed, 2 deferred; workload forecast; phase tracking |
| `sdd/m10-phase2-branchprotect/apply-progress` | 1404 | architecture | Implementation details; test count; commit sha; git-branch corrections |
| `sdd/m10-phase2-branchprotect/verify-report` | 1405 | architecture | Verdict PASS-WITH-NOTES; code correctness; style conformance; warnings/suggestions |
| `sdd/m10-phase2-branchprotect/archive-report` | (new) | architecture | This archive report; change closure; artifact references |

## Cycle Closed

✅ Proposal analyzed → ✅ Spec written → ✅ Design finalized → ✅ Tasks broken down → ✅ Implementation complete → ✅ Verification passed → ✅ Archived

The `m10-phase2-branchprotect` change is complete and ready for merge to main. The PR should include:
- Commit hash of the implementation (apply phase tracked this)
- Reference to the D1 tracking issue (must be filed before merge)
- Acknowledgment of the discovered GitHub `checks.map()` TypeError (task 4.4, should be filed as follow-up)

**Next**: PR creation and merge; M10 Phase 2 continues with rank 3 (mrList) or rank 1 (prReviews) on a separate branch if this merges cleanly.
