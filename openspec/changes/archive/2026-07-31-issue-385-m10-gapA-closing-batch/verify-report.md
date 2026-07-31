---
status: archived
issue: 385
verdict: PASS WITH WARNINGS
---

# Verify Report — issue-385-m10-phase2-rank6-batch

**Verdict: PASS WITH WARNINGS — READY TO ARCHIVE**

Branch: `feature/385-m10-phase2-gapA-final-batch` (7 commits, off `feature/m10-seam-contract-coverage` @ `c923681`).
Engram: `sdd/issue-385-m10-phase2-rank6-batch/verify-report` (#1764).

## Task Completeness

40/40 tasks complete (all phases 1-7.3 verified; phase 7.4 [PR opened] completed post-verify).

## Test Evidence (clean-worktree measurement)

- **Baseline** (`c923681`, clean worktree): **2073 tests, 0 fail**
- **Branch tip** (`461acbb`, clean worktree): **2096 tests, 0 fail**
- **Delta**: **+23**, matching design precompute exactly (4 whoami + 6 commitStatus in-loop + 2 projectResolve + 2 repoCloneUrl-parity + 2 patSetupUrl-parity + 3 commitStatus-divergence + 1 repoCloneUrl-divergence + 3 patSetupUrl-divergence)

**Production code diff:** `git diff c923681..HEAD -- github.mjs gitlab.mjs normalize.mjs exec.mjs` → **empty**. Zero production files touched.

## Diff Size

**Code/fixture/doc only:** 396 insertions + 6 deletions = **402 lines** across `vcs-contract.md` (+8/-6), 10 fixtures (146 insertions), `vcs.contract.test.mjs` (242 insertions).

**Full branch diff** (including SDD planning artifacts): ~1396 lines across 16 files. Planning docs (`design.md`, `proposal.md`, `spec.md`, `tasks.md`) are 994 additional lines not counted in the 402-line implementation figure.

## Fixture Provenance

All 10 new fixtures pass `assertProvenance`. `github-whoami-happy.json` independently verified against live `gh api /user` call — all fields byte-identical to fixture, with email/notification_email redacted with explicit disclosure note.

## Scenario Coverage

| Verb | Scenarios | Status |
|---|---|---|
| whoami | happy + failure | ✅ VERIFIED |
| commitStatus | happy + empty + failure + divergence tests (two-field read, neutral/skipped collapse, selection asymmetry) | ✅ VERIFIED |
| projectResolve | identity (flat + nested path) | ✅ VERIFIED |
| repoCloneUrl | parity (credential position) + divergence (host-default) | ✅ VERIFIED |
| patSetupUrl | parity (https, scopes, name value) + divergences (host, URL-encoding) | ✅ VERIFIED |
| vcs-contract.md | 5 rows + enum section | ✅ VERIFIED |
| fixtures | all 10 + provenance | ✅ VERIFIED |

## Divergence-Lock Authenticity

Each lock verified against unchanged production source:
- `gitlab.mjs:531` — confirmed no fallback; falsy `host` yields literal "undefined"
- `github.mjs:485` — confirmed `host` never read; hardcoded github.com
- Neither provider URL-encodes name/scopes; `&` creates spurious parameter

All three latent defects locked correctly and filed as #386, #387, #388.

## Findings

- **CRITICAL**: None
- **WARNING 1**: Working tree has unrelated dirty state; clean worktree measurement confirms true delta is +23 tests
- **WARNING 2**: Full branch diff is ~1396 lines (includes SDD planning docs); implementation-only is 402 lines
- **WARNING 3**: Pre-existing repo:check failure (`issue-362-m10-phase2-issueList-contract` missing proposal.md); unrelated to issue #385
- **SUGGESTION**: Task 7.4 (PR open) deliberately unchecked pre-verify; completed after verify pass

## Secret Safety

`PLACEHOLDER_CREDENTIAL = 'placeholder-not-a-real-token'` — no token-format prefix, prose-like. Matches existing precedent.

## Naming Verification

Grepped branch for "rank-6"/"rank-7": only pre-existing authCheck row found. All new content correctly reads "issue #385, M10 Phase 2 — final Gap-A batch". No rank-number leakage.

## Follow-Up Issues

Confirmed via `gh issue view`: #386, #387, #388 all exist, type:bug, epic #335 referenced, one distinct defect each.

## Verdict

✅ **PASS WITH WARNINGS — READY TO ARCHIVE**

No critical blockers. PR #389 opened, all branch-protection checks green, ready for orchestrator merge to main.

See Engram #1764 for complete verification detail.
