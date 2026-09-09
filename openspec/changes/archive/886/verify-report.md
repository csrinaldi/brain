---
change: issue-886-mr-auto-merge
status: PASS
verified_at: 2026-09-09T19:59:42Z
head: 6d1452a57fcd66e1c23116ecede1a325352e1f19
---

# Verification Report — #886 `mrAutoMerge`

**Mode**: Strict TDD

PR #895 merged (`6d1452a5`, `origin/main`). All spec requirements, the STRICT TDD test map, the
D1–D6 ratified decisions, and the D6 scope boundary are confirmed against the current tree with
runtime evidence.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total (tasks.md, sections 1-9, excluding non-goals §10) | 15 items (1.1, 2.1-2.2, 3.1-3.2, 4.1-4.3, 5.1-5.2, 6.1, 7.1-7.2, 8.1-8.3, 9.1-9.2) |
| Tasks complete | 15/15 (2.1 live capture landed this batch, see apply-progress #3238) |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Focused** (`node --test scripts/vcs/providers/vcs.contract.test.mjs scripts/vcs/providers.test.mjs scripts/vcs/lib/auto-merge-outcome.test.mjs`):
`338 pass / 0 fail / 0 todo`

**Drift guard** (`node --test scripts/vcs/verb-contract-drift-guard.test.mjs`):
`4 pass / 0 fail` — all 4 checks green (VERBS↔doc-table bidirectional check now green post-`brain:promote`).

**Full suite** (`npm test`):
`4926 pass / 0 fail / 0 todo` (duration ~22.7s). No expected-red state remains — the D5 handover
(maintainer's promotion commit) already landed on `main` before this verify run.

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Signature & fail-closed default (D1) | default refuses | `${provider}.mrAutoMerge (contract): an omitted requiredReviews refuses` | ✅ COMPLIANT |
| Tier refusal never touches provider (D1) | refusal is provable | `requiredReviews>0 refuses, provider seam UNCALLED` + `only requiredReviews===0 arms — null/NaN/-1/"0" all refuse, seam UNCALLED` | ✅ COMPLIANT |
| Armed merge, squash hardcoded (D2/D3) | GitHub arms | `github.mrAutoMerge (contract): armed → {enabled:true,url} via gh pr merge --auto --squash` | ✅ COMPLIANT |
| Armed merge, squash hardcoded (D2/D3) | GitLab arms | `gitlab.mrAutoMerge (contract): armed → {enabled:true,url} via PUT .../merge, pipeline+squash` | ✅ COMPLIANT |
| url reported, never constructed (D4) | no url reported | `gitlab.mrAutoMerge (contract): url is null when the provider reports none` | ✅ COMPLIANT |
| enabled:true = armed, never merged (D4) | armed ≠ merged | `${provider}.mrAutoMerge (contract): armed shape carries no merged/sha field` | ✅ COMPLIANT |
| unsupported vs transport (D2) | GitHub unsupported | `github.mrAutoMerge (contract): captured "auto-merge not allowed" stderr → unsupported` (fixture `_provenance.recorded: true`, live capture 2026-09-09) | ✅ COMPLIANT |
| unsupported vs transport (D2) | GitLab unsupported | `gitlab.mrAutoMerge (contract): 405/406 merge response → unsupported` + regression pin `a 500 on iid 405 classifies transport, not unsupported` | ✅ COMPLIANT |
| unsupported vs transport (D2) | transport failure | `${provider}.mrAutoMerge (contract): network/5xx/401/403 → transport, carries error` | ✅ COMPLIANT |
| fixed key set, never throws (D4) | pinned keys | `${provider}.mrAutoMerge (contract): outcome key set is pinned, exactly` | ✅ COMPLIANT |
| fixed key set, never throws (D4) | never throws | `${provider}.mrAutoMerge (contract): never throws, even under a mocked transport failure` + `never throws — not even when the provider seam itself throws` | ✅ COMPLIANT |
| dispatchable and documented (D5) | drift guard stays green | `verb-contract-drift-guard.test.mjs` — all 4 checks pass | ✅ COMPLIANT |
| scope boundary (D6) | no caller, no enablement | static grep + `gh api repos/csrinaldi/brain --jq .allow_auto_merge` → `false` | ✅ COMPLIANT |

**Compliance summary**: 13/13 requirement scenarios compliant.

## Correctness (Static Evidence)

| Decision | Status | Evidence |
|---|---|---|
| D1 exact-zero gate | ✅ Implemented | `github.mjs:625` and `gitlab.mjs:1182`: `if (requiredReviews !== 0) return refused(...)` — matches the cold-review-required fix (not `> 0`, which fails open on null/NaN/negative). |
| D1 JSDoc consistency | ✅ Corrected (local, uncommitted) | `lib/auto-merge-outcome.mjs:33` now reads `requiredReviews !== 0` — the fresh-review finding `judgment:cold-1` (stale `> 0` wording at reviewed commit `960c1767`) is fixed in the worktree, matching code. Not yet committed to `main`. |
| D2 GitHub classifier | ✅ Implemented, live-captured | `GITHUB_MR_AUTO_MERGE_UNSUPPORTED_RE = /auto[- ]?merge is not allowed/i` (`github.mjs:606`); fixture `fixtures/github-mrAutoMerge-unsupported.json` carries `_provenance.recorded: true`, verbatim GraphQL stderr captured 2026-09-09 against PR #895 itself. |
| D2 GitLab classifier | ✅ Implemented, anchored | `GITLAB_MR_AUTO_MERGE_UNSUPPORTED_RE = /API failed:\s*(?:405\|406)\b/` (`gitlab.mjs:1156`) — anchored on the `API failed:` prefix, not a bare `\b405\b`, so an unrelated 500 on MR iid 405 still classifies `transport` (pinned regression in `providers.test.mjs:649`). |
| D3 squash hardcoded | ✅ Implemented | GitHub argv: `['pr','merge',String(number),'--auto','--squash','--repo',project]` (`github.mjs:633`), pinned exactly in `providers.test.mjs:609`. GitLab payload: `{merge_when_pipeline_succeeds:true,squash:true}` (`gitlab.mjs:1192`), pinned exactly in `providers.test.mjs:623`. No `method` parameter on either signature. |
| D4 fixed key sets, shared constructor | ✅ Implemented | `lib/auto-merge-outcome.mjs` exports `armed()`/`refused()` as the sole constructors; both providers `import { armed, refused, AUTO_MERGE_REASONS } from '../lib/auto-merge-outcome.mjs'` (`github.mjs:15`, `gitlab.mjs:17`) — no re-export, source-guard test enforced. |
| D5 promoted doc row | ✅ Implemented, matches draft | `brain/core/methodology/vcs-contract.md:34` (Required Verbs row) and `:101` (Phase 3 status row) match `brain-drafts/vcs-contract.draft.md`'s `amend-replace` blocks verbatim, both rows. |
| D6 no caller wired | ✅ Confirmed | `grep -rn "mrAutoMerge(" --include="*.mjs"` outside `providers/{github,gitlab}.mjs`, `lib/auto-merge-outcome.mjs`, `cli.mjs`, and `*.test.mjs` → zero matches. |
| D6 no enablement | ✅ Confirmed | `gh api repos/csrinaldi/brain --jq .allow_auto_merge` → `false`. |
| D6 `.memory` scope | ✅ Confirmed | `git show --stat 6d1452a5 -- .memory` → exactly 2 files (`index.jsonl` + `records/2026-09-rec-05767bed7024aee4.jsonl`), matching the single record-first save. |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Design's live-capture-before-regex order (A5) | ✅ Yes | Regex was TODO-gated through `_provenance.recorded` assertion until task 2.1 landed; widened only after RED confirmed the placeholder assumption was wrong (hyphen vs space). |
| Design's never-throws wrapper around the `gh()` seam | ✅ Yes | `github.mjs:631-637` wraps `gh()` in try/catch; `gitlab.mjs:1196-1207` normalizes non-Error rejections via `err?.message ?? String(err)`. |
| Design's one-PR, two-author handover (D5) | ✅ Yes | Agent commits landed first (8 apply + 4 review-correction + 1 record-first + 1 live-capture), maintainer's `brain:promote` commit landed second, drift guard green, `brain:review` ran after, then merge — exact order tasks.md §9.1 specifies. |

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress (#3238) reports RED→GREEN sequence per task, including the task 2.1 live-capture RED-confirmed regex fix. |
| All tasks have tests | ✅ | 15/15 |
| RED confirmed (tests exist) | ✅ | `auto-merge-outcome.test.mjs`, `vcs.contract.test.mjs` `MR_AUTO_MERGE_PROVIDERS` block, `providers.test.mjs` pins — all present and executed. |
| GREEN confirmed (tests pass) | ✅ | 338/338 focused, 4926/4926 full suite, this verify run. |
| Triangulation adequate | ✅ | Each requirement has 2+ distinct test cases (e.g. 4 cases for "fixed key set, never throws"); null/NaN/-1/'0' triangulated in one case. |
| Safety Net for modified files | ✅ | `providers.test.mjs` full pass (338/338) run before and after each provider edit per apply-progress. |

**TDD Compliance**: 6/6 checks passed

### Assertion Quality

No tautologies, ghost loops, or assertion-without-production-call patterns found in
`auto-merge-outcome.test.mjs`, the `MR_AUTO_MERGE_PROVIDERS` contract block, or the
`providers.test.mjs` pins. All assertions call the exported verb and assert on its returned
shape or the seam's captured argv/payload — no CSS/implementation-detail coupling (this is a
Node backend module, not UI).

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics

**Linter**: ➖ Not run (no linter invocation configured for this verify pass; no lint errors reported by apply-progress)
**Type Checker**: ➖ Not available (plain `.mjs`, no TS build step in this repo)

## PR & Review Evidence

- `gh pr view 895 --json state,mergedAt,mergeCommit,reviews`: `state: MERGED`, `mergeCommit.oid: 6d1452a5`, merged `2026-09-09T18:05:29Z`.
- Bot review (`csrinaldibot`) at commit `960c17675f9b89a5f2ce6d7c660d5adccdb41c7f`: GitHub review `state: COMMENTED` (GitHub API mechanics — the bot posts via comment-review, not the native approve action), but the review **body**'s `protocol: brain-review/2` verdict is `APPROVE`, with 2 correction-severity findings recorded (`tier2-frontier` — expected, Tier-2 doc touched by design; `judgment:cold-1` — the stale `auto-merge-outcome.mjs:33` JSDoc, now fixed locally per this verify pass).

## Issues Found

**CRITICAL**: None

**WARNING**: None

**SUGGESTION**:
1. The JSDoc fix at `brain/scripts/vcs/lib/auto-merge-outcome.mjs:33` (`> 0` → `!== 0`, addressing `judgment:cold-1`) is present in the worktree but **not yet committed** to `main`. Same stale `requiredReviews > 0` phrasing also lingers in `brain/scripts/vcs/providers/vcs.contract.test.mjs:2236` (block comment) and in `openspec/changes/issue-864-memory-2-0/tasks.md:34` ("refuses when the tier's `requiredReviews` > 0"). None of these affect runtime behavior — the `if` statements are correct everywhere — but a future editor trusting the comment over the code could reintroduce the exact fail-open bug this change already fixed once. Recommend a small follow-up commit sweeping all three.
2. Task 2.1's deferred scope note (D2's "squash merging is not allowed" GitHub variant) is explicitly out of this slice and correctly left unclassified pending a real capture — no action needed, flagging only for archive-report traceability.

## Verdict

**PASS**

All 13 spec requirement scenarios compliant with passing covering tests; full suite 4926/4926
green including the drift guard; D1-D6 confirmed by source inspection; D6 scope boundary
confirmed empty (no caller, `allow_auto_merge` false, `.memory` scope minimal); PR #895 merged
with an APPROVE-verdict review. Zero CRITICAL, zero WARNING — 2 cosmetic SUGGESTIONs only
(stale comment wording, already functionally corrected).
