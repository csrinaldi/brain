# Apply Progress: Audit PR resolution from the merge commit (#1086)

**Batch**: 2 of 2 (Phases 1-3 landed batch 1; this batch adds Phases 4-5 — all 5 phases now complete)
**Mode**: Strict TDD
**Worktree**: `/home/gandalf/IA/brain-issue-1086` (branch `fix/issue-1086-audit-pr-resolution`)

## Completed Tasks

### Phase 1: `isNotFound` — the shared not-found predicate (D2)
- [x] 1.1 RED — `uncomputable-cause.test.mjs`: added `isNotFound` cases over the full CORPUS, plus an auth-beats-404 precedence probe and an unclassified-false case.
- [x] 1.2 GREEN — `uncomputable-cause.mjs`: exported `isNotFound(text)`; header comment updated to list it as a third approved export.
- [x] 1.3 Verify — `node --test brain/scripts/vcs/lib/uncomputable-cause.test.mjs` → 64/64 pass.

### Phase 2: `prView` reports `absent` additively (D1)
- [x] 2.1 Live read-only confirmation (task-permitted, the only network touch in this batch): `gh pr view 978` against `csrinaldi/brain` (this worktree's own remote) returns exit 1, stderr `GraphQL: Could not resolve to a PullRequest with the number of 978. (repository.pullRequest)\n` — confirmed #978 is a real GitHub issue, not a PR, and the text matches `NOT_FOUND_RE`. Pinned in `github-prView-notfound.json` (`derived` provenance, per design's Open Question). GitLab has no reachable live mirror from this environment (standing constraint, same as every other `gitlab-*.json` fixture) — `gitlab-prView-notfound.json` is derived from `gitlab-api.mjs`'s fixed error template (`GitLab API failed: ${status} (${path})`) with `status: 404`, which is the documented GitLab REST behavior for a merge_requests/:iid lookup that does not resolve, and which classifies `not-found` via the classifier's numeric-code rule — confirmed with a script, not invented.
- [x] 2.2 RED — `vcs.contract.test.mjs`: widened the failure-fixture `deepEqual` pin to include `absent: null`; added a happy-fixture assertion for `absent: false`; added a new test for the `-notfound.json` fixtures asserting `absent: true`.
- [x] 2.3 GREEN — `github.mjs#prView`: computes `absent: isNotFound(r.stderr) ? true : null` on the `gh pr view` failure path; `absent: false` on success; `absent: null` on the JSON-parse catch.
- [x] 2.4 GREEN — `gitlab.mjs#prView`: same shape, `absent: isNotFound(err.message) ? true : null` from the `gitlabApiFetch` catch.
- [x] 2.5 Verify — `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs` → 209/209 pass at end of phase; confirmed (via `rg -n "prView"`) that no existing production consumer (`merge-walk.mjs:307`, `ci-context.mjs:63,70`, `review/cold-boot.mjs:29,158`, `review/queue.mjs:55`, `governance/relabel-retrigger.mjs:88`, `status/cli.mjs:157`) reads `.absent` — additive-safe.

### Phase 3: `commitPrs` — the new port verb (D3)
- [x] 3.1 RED — `vcs.contract.test.mjs`: added `commitPrs` happy/empty/failure contract cases for both providers, wired through `jsonSpawnCallArgs` (github) / `gitlabCallArgs` (gitlab).
- [x] 3.2 Created fixtures `{github,gitlab}-commitPrs-{happy,empty,failure}.json`, all `derived`.
- [x] 3.3 GREEN — `github.mjs#commitPrs`: `gh api --paginate repos/{project}/commits/{sha}/pulls`, maps `r.number`, ascending, `null` on any failure or malformed response, never throws.
- [x] 3.4 GREEN — `gitlab.mjs#commitPrs`: `GET projects/:enc/repository/commits/:sha/merge_requests` over `gitlabApiFetch`, maps `r.iid`, same `[]`/`null` discipline.
- [x] 3.5 — `cli.mjs` `VERBS`: added `'commitPrs'`. **This intentionally turns `verb-contract-drift-guard.test.mjs` RED** — see Known Failure below.
- [x] 3.6 — `record-fixtures.mjs`: added `recordGithubCommitPrs`, with a raw-string trailing-arg carve-out (a commit sha is not numeric, unlike every other recorder's id argument).
- [x] 3.7 Verify — `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs` → 215/215 pass.

### Phase 4: `fetchPrMeta` dispatch + audit/metrics wiring (D4-D6)
- [x] 4.1 RED — fail-closed proof: `merge-walk.test.mjs` — a fake port with `prView` → `{labels:null, body:null, absent:null}` asserts a `commitPrs` spy is called `0` times and `prMetaError` is set.
- [x] 4.2 RED — regression pin on the real shape: subject `feat(setup): add conditional Codex readiness and routing (#978)`, real sha `d4cb7f829c3ea968d8bc17f5f2c47d6f0e3b3bee`, fake `prView(978)` → `absent:true`, fake `commitPrs(sha)` → `[991]`, fake `prView(991)` carrying `Closes #978` → a real verdict, `prSource === 'commit-sha'`.
- [x] 4.3 RED — the remaining dispatch-table rows: exactly one containing PR → audit it; empty list → commit-body path (`prSource: null`, `prMetaError: null`); two-or-more → uncomputable naming both numbers, neither PR's `prView` called; `commitPrs` verb missing → uncomputable; `commitPrs` returns `null` (transport failure) → uncomputable; all four uncomputable causes pairwise distinguishable.
- [x] 4.4 GREEN — `merge-walk.mjs`: widened `fetchPrMeta(subject, vcs, config, sha)` (fourth positional). `pr.absent === true` → `resolveByCommitSha()` (`commitPrs` → dispatch per the table); `absent === false`/`null`/`undefined` → unchanged legacy path, never touches `commitPrs`. Added a local `readPr(vcs, config, number)` one-level re-read helper (no recursion) and a shared `fetchReviews()` helper (dedupes the reviews-fetch logic between the subject path and the commit-sha re-read). Return shape gained `subjectRef` (always `parsePrNumber(subject)`) and `prSource: 'subject'|'commit-sha'|null`.
- [x] 4.5 Verify — `node --test brain/scripts/lib/merge-walk.test.mjs` → 23/23 pass (16 pre-existing #474/baseline tests untouched and green, 7 new #1086 tests green).
- [x] 4.6 GREEN — `brain-audit.mjs`: `fetchPrMeta(subject, vcs, config, sha)` now receives `sha`; destructures `subjectRef`/`prSource` alongside the existing fields; added two pure exported formatters, `formatUncomputableLine(sha, subject, {prNum, prMetaError})` and `formatPrSourceSuffix({subjectRef, prNum, prSource, prMetaError})`; `[UNCOMPUTABLE]`/`[PASS]`/`[FAIL]` emission now calls them. `[LANE]`/`[SKIP]`/`[FAIL-SHA]` lines are unchanged — the design's Open Question ("should `[LANE]` carry D6's suffix?") is resolved **no**, per the design's own proposed default: a lane merge's verdict does not depend on the pull request.
- [x] 4.7 RED+GREEN — `brain-audit.test.mjs`: 6 new pure unit tests on the two formatters (no entrypoint spawn, no real `.git`, no temp repo at all): the legacy `[UNCOMPUTABLE]` line byte-identical; an ambiguous two-PR line distinguishable from the legacy line; the commit-sha suffix; the no-containing-PR suffix; no suffix for the two unchanged-today shapes. Full existing suite (`brain-audit.test.mjs`, spawn-based) re-run and confirmed still green — 62/62.
- [x] 4.8 GREEN — `brain-metrics.mjs`: `fetchPrMeta(subject, vcs, config, sha)` now receives `sha` (so a `(#978)`-shaped merge resolves to a real verdict in metrics too, not just in the audit path — sharing the fix is design D4's point); corrected the stale `:135` comment ("the PR number `fetchPrMeta` parses from the subject" → names `subjectRef`/`prNum` and the commit-sha fallback).
- [x] 4.9 Verify — `node --test brain/scripts/lib/merge-walk.test.mjs brain/scripts/brain-audit.test.mjs brain/scripts/brain-metrics.test.mjs` → 118/118 pass.

### Phase 5: Tier 2 draft, #996 correction, closing verification
- [x] 5.1 Created `openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.draft.md` — a `brain-amendment/1` draft (non-ADR target: `target: brain/core/methodology/vcs-contract.md`, `issue: 1086`) with two `amend-find`/`amend-replace` pairs: (1) the `prView` row gains `absent` in its signature and a sentence describing the three-state discipline; (2) a new `commitPrs` row is inserted immediately after `commitStatus` (its find-anchor), mirroring `commitStatus`'s `{project, sha}` shape per the `issue-936` `vcs-contract-mrlist-row.draft.md` precedent. Verified against the REAL target file with `planAmendment({draftText, targetText, homeText: null, gitUserName, today})` from `brain/scripts/lib/amendment-draft.mjs` — see "planAmendment verification" below.
- [x] 5.2 Drafted the #996 comment (below). **Not posted** — the orchestrator's launch instructions explicitly reserve posting for itself ("Do NOT post the #996 comment yourself").
- [x] 5.3 Confirmed — cross-reference to 2.1 (batch 1): both not-found fixtures are `derived`/live-confirmed, not trusted from the design's reading alone.
- [x] 5.4 Full verification — `npm test`: **6333/6334 pass**. The ONLY failure is `verb-contract-drift-guard.test.mjs`'s `"every verb in cli.mjs VERBS is either documented in the Required Verbs table or a listed deliberate exception"` — the exact, anticipated D7 blocker (fires because 3.5 added `commitPrs` to `VERBS` before 5.1's row is promoted). `governance.auditBaseline` confirmed unchanged at `v1.0.0` (`git diff a8c04640 HEAD -- brain.config.json` is empty). Exit-code ladder confirmed unedited (`git diff a8c04640 HEAD -- brain/scripts/governance/postmerge/exit-codes.mjs` is empty). Confirmed by diffing every `*.test.mjs` file this branch touches (`uncomputable-cause.test.mjs`, `providers.test.mjs`, `vcs.contract.test.mjs` from batch 1; `merge-walk.test.mjs`, `brain-audit.test.mjs` from batch 2) that every NEW test in this change is a fake-port/pure-function unit test — no new `spawnSync`, no new temp-git-repo fixture, no new network call. The only live call in the whole change remains 2.1's single read-only `gh pr view 978` from batch 1.
- [x] 5.5 Success Criteria, verified **by construction and by the regression-pin test, not by a live `brain:audit` run** (no further live calls authorized this batch — see Deviations): confirmed the real merge `d4cb7f829c3ea968d8bc17f5f2c47d6f0e3b3bee` (`feat(setup): add conditional Codex readiness and routing (#978)`) exists in this repo's history, and 4.2's regression-pin test drives `fetchPrMeta` with that exact sha and subject to a real, non-uncomputable verdict via `prSource: 'commit-sha'`. Confirmed the other three named merges (`789f6c2e`, `c6ab10c3`, `4d47e2f9` — all `docs(sdd): archive Codex … records (#978)`) share byte-identical subject shape (`(#978)` trailing parenthetical), so the same code path applies to them by construction; their real-world resolution through `commitPrs` was not independently live-verified. 4.1 proves a simulated transport failure never reaches the lookup (exits uncomputable, lookup called 0 times). 4.3's two-PR test proves two containing PRs stay uncomputable, neither evaluated.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `uncomputable-cause.test.mjs` | Unit | ✅ 47/47 (baseline) | ✅ Written (import failure) | ✅ 64/64 | ✅ Full CORPUS + precedence probe | ➖ None needed |
| 2.1-2.5 | `vcs.contract.test.mjs`, `providers.test.mjs` | Unit/Contract | ✅ 203/209 pre-change subset green | ✅ Written (6 failing before GREEN) | ✅ 209/209, then 142/142 (providers.test.mjs) | ✅ happy/notfound/generic-failure × 2 providers | ✅ Two pre-existing fixtures corrected (see Deviations) |
| 3.1-3.7 | `vcs.contract.test.mjs` | Contract | ✅ 209/209 (baseline) | ✅ Written (6 failing — missing fixtures + function) | ✅ 215/215 | ✅ happy/empty/failure × 2 providers | ➖ None needed |
| 4.1-4.3 | `merge-walk.test.mjs` | Unit (fake port) | ✅ 16/16 pre-#1086 `fetchPrMeta` tests (baseline) | ✅ Written (7 failing — dispatch did not exist) | ✅ 23/23 | ✅ one-PR / empty / two-PR / missing-verb / null-return × dispatch, plus the fail-closed and regression-pin cases | ➖ None needed |
| 4.6-4.7 | `brain-audit.test.mjs` | Unit (pure formatter) | ✅ 56/56 pre-existing (baseline) | ✅ Written (formatters did not exist) | ✅ 62/62 | ✅ legacy / ambiguous / commit-sha / no-PR / two unchanged-today shapes | ➖ None needed |
| 4.8 | `brain-metrics.test.mjs` | — (wiring only, no new behavior) | ✅ 33/33 (baseline) | ➖ N/A — additive positional arg, no new branch | ✅ 33/33 unchanged | ➖ Skipped: passing an existing value through an existing parameter has exactly one outcome | ➖ None needed |

### Test Summary
- **Total tests written this change (cumulative)**: 40 new/modified test cases — 27 in Phases 1-3 (batch 1) + 13 in Phase 4 (batch 2: 7 in `merge-walk.test.mjs`, 6 in `brain-audit.test.mjs`).
- **Total tests passing**: full `npm test` — **6333/6334** (see Known Failure — the one failure is the anticipated D7 blocker, unchanged in nature from batch 1's 6319/6320).
- **Layers used**: Unit (uncomputable-cause, merge-walk fake-port, brain-audit pure-formatter), Contract (vcs.contract.test.mjs — both providers parameterized).
- **Approval tests**: None — no refactoring-of-existing-behavior tasks in this change.
- **Pure functions created**: `isNotFound` (batch 1); `formatUncomputableLine`, `formatPrSourceSuffix` (exported, batch 2); `resolveByCommitSha`, `readPr`, `fetchReviews` (module-private, batch 2).

## Live Confirmation Pinned (task 2.1)

- **GitHub**, `gh pr view 978` (repo `csrinaldi/brain`, this worktree's own remote), real `gh` 2.46.0, read-only:
  `GraphQL: Could not resolve to a PullRequest with the number of 978. (repository.pullRequest)\n`
  (verified independently via a raw `spawnSync` call matching production's `run()` wrapper — identical output.)
- **GitLab**: no live mirror reachable from this environment (standing constraint). Derived from `gitlab-api.mjs`'s fixed error-message template; not a live call.

## Deviations from Design

1. **Two pre-existing "generic failure" fixtures/tests accidentally collided with the new NOT_FOUND classification and were corrected, not left as-is:**
   - `brain/scripts/vcs/fixtures/gitlab-prView-failure.json` used `status: 404`, which — once `absent` exists — classifies `not-found` (via the classifier's numeric-code rule), turning a fixture meant to represent "the read could not be completed" into a false definitive-negative. Changed `status` to `500` (a genuinely generic/unreadable failure), with a note explaining why.
   - `brain/scripts/vcs/providers.test.mjs`'s two analogous inline pins (`github.prView … on gh failure`, stderr `'not found'`; `gitlab.prView … on fetch failure`, `status: 404`) had the same collision. Changed the github stderr text to `'gh: fixture simulated failure'` and the gitlab status to `500`; added one NEW test per provider asserting `absent: true` for the genuine not-found case, so both the generic-failure and definitive-negative paths stay covered and distinguishable.
   - This is exactly the class of latent axis-collision `red-proof-blind-along-an-unvaried-axis.md` warns about: the original fixtures were authored before "the specific status/text value classifies a failure" was a real code path, so an arbitrary-but-plausible choice (404, "not found") silently became load-bearing once this change landed. Design.md's Blast Radius section only anticipated `vcs.contract.test.mjs:265`'s pin needing the field — it did not anticipate `providers.test.mjs`'s separate exact-shape pins, nor the fixture-value collision. Both are now covered.
2. **`github-prView-notfound.json` and `gitlab-prView-notfound.json` are marked `derived`, not `recorded`**, even though the GitHub text is genuinely live-captured verbatim — per this repo's convention that the not-found/failure fixture family is `derived` (matching `github-prView-failure.json`'s discipline), and per the orchestrator's explicit instruction to pin the live confirmation in a `derived` fixture. The provenance note states plainly that the text is live-captured, not hand-authored, so this is documentation discipline, not a claim of fabrication.
3. **No live GitLab confirmation was possible or requested** — only one live, read-only `gh` call was authorized. The GitLab not-found fixture and the GitLab `commitPrs` fixtures are derived from GitLab's documented, deterministic error-message construction (`gitlab-api.mjs:65`) and REST API v4 shapes, cross-checked against the already-pinned corpus row in `uncomputable-cause.test.mjs` (`GitLab API failed: 404 (...)` → `not-found`).

No other deviations in Phases 1-3 — that production code matches design.md's D1/D2/D3 decisions.

### Phase 4-5 deviations (batch 2)

4. **The Tier 2 draft is a `.draft.md`, not the bare `.md` tasks.md 5.1 names.** `openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.draft.md` — the real `brain-amendment/1` promotable shape (`amendment-draft.mjs`'s `AMENDMENT_DRAFT_SUFFIX` contract), matching what the `issue-936` precedent actually ships (`vcs-contract-mrlist-row.draft.md`, not `vcs-contract-mrlist-row.md` — that sibling file is the human-readable rationale, which this batch did not duplicate given the scope). Verified against the real target file with `planAmendment` — see below.
5. **The Tier 2 draft is NOT committed by this batch.** The launch instructions explicitly say "Never commit … the openspec change files", and the whole `openspec/changes/issue-1086-audit-pr-resolution/` directory has been untracked since batch 1 (confirmed: `git status` shows it as `??` before and after this batch's commit). The draft file exists on disk in the worktree but is not staged or committed. **This creates a real tension with design D7** ("the maintainer lands it in `brain/core/methodology/vcs-contract.md` **inside this PR**") and with tasks.md's own Phase 5 commit plan (`docs(sdd): issue-1086 Tier 2 draft, #996 correction, closing verification (#1086)`): `brain:promote` needs the draft file to exist in the PR's pushed branch to be run against it. Flagged as a risk for the orchestrator to resolve explicitly (e.g. a follow-up commit adding just the `brain-drafts/` file, or an explicit call that this file is handed to the maintainer out-of-band) rather than silently worked around.
6. **No Phase 5 git commit was made.** Every Phase 5 deliverable (the Tier 2 draft, the #996 comment text) is either excluded by the no-openspec-commit rule or explicitly held back from posting. There is no production/test code change in Phase 5, so there is nothing else to commit under that phase's plan.
7. **5.5's Success Criteria were confirmed by construction/regression-pin, not by a live `brain:audit "v1.5.0..HEAD"` run** — the launch instructions say "no further live calls" beyond what batch 1 already did (2.1's single `gh pr view 978`). See task 5.5 above for exactly what was and was not independently verified.

## Known Failure (expected, by design — D7)

`node --test brain/scripts/vcs/verb-contract-drift-guard.test.mjs` → **1 failing**:
`"every verb in cli.mjs VERBS is either documented in the Required Verbs table or a listed deliberate exception"`.

This is the exact, anticipated consequence of task 3.5 (adding `'commitPrs'` to `cli.mjs`'s `VERBS`) landing before the Tier 2 `vcs-contract.md` row (Phase 5's draft, human-promoted, out of either batch's writing scope by design D7). Confirmed via full `npm test` at the end of BOTH batches: batch 1 — 6319/6320; batch 2 (after Phase 4-5 additions) — **6333/6334**. In both runs this is the ONLY failing test in the entire suite. No other test is red. This is not suppressed, allowlisted, or worked around — it is the intended, documented blocking hand-off to the maintainer (design D7, tasks.md Phase 5 note).

## planAmendment verification (task 5.1)

Ran `planAmendment({ draftText, targetText, homeText: null, gitUserName: 'Cristian Rinaldi', today: '2026-09-20' })` from `brain/scripts/lib/amendment-draft.mjs` against the REAL `brain/core/methodology/vcs-contract.md` and the drafted `.draft.md` (script run from inside the worktree, then deleted — never committed, never part of the diff). Result:

```
PLAN OK
commitSubject: docs(brain): amend brain/core/methodology/vcs-contract.md (#1086)
acts: [
  { "act": "2", "what": "in-place edit 1", "state": "pending" },
  { "act": "2", "what": "in-place edit 2", "state": "pending" }
]
target changed: true
new target length delta: 1597
```

Both `amend-find`/`amend-replace` pairs are `pending` (state `blocked` would mean the anchor drifted or is ambiguous; `done` would mean already applied) — a real, unique, applicable amendment against the file as it stands on this branch today. Not a promise; this is `planAmendment`'s own pure verdict from the real bytes.

## Draft comment for issue #996 (task 5.2 — NOT POSTED, text only)

> The `(#978)` merges that `brain:audit`/`brain:metrics` report as `[UNCOMPUTABLE]` are not a
> transient outage — re-running the audit will never clear them. `978` is a closed GitHub
> **issue**, not a pull request; the evaluator parsed the trailing `(#978)` in each merge
> subject as a PR number, asked the provider for that pull request, and correctly found none.
> With no pull request to read, it had no evidence to audit from and correctly refused to
> guess, reporting the merge as uncomputable rather than rendering a false verdict.
>
> #1086 fixes the evaluator, not these four merges: when the provider reports that a subject's
> number is DEFINITIVELY not a pull request, the evaluator now asks "which pull requests
> contain this merge commit?" and, when exactly one answers, audits that pull request instead.
> A transport failure never reaches that fallback — only a definitive "not a pull request"
> does — so this does not weaken the audit's fail-closed behavior anywhere else; an ambiguous
> answer (two or more containing pull requests) still reports uncomputable rather than guess.
>
> No further action is needed on this issue beyond closing it once #1086 merges — the root
> cause was the evaluator misreading an issue number as a pull request, not the four merges it
> flagged.

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `brain/scripts/vcs/lib/uncomputable-cause.mjs` | Modified | Exported `isNotFound`; header comment updated |
| `brain/scripts/vcs/lib/uncomputable-cause.test.mjs` | Modified | Added `isNotFound` test coverage |
| `brain/scripts/vcs/providers/github.mjs` | Modified | `prView` gains `absent`; new `commitPrs` verb |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modified | `prView` gains `absent`; new `commitPrs` verb |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modified | `absent` + `commitPrs` contract cases, both providers |
| `brain/scripts/vcs/providers.test.mjs` | Modified | Widened/corrected pre-existing `prView` pins; added `absent:true` cases |
| `brain/scripts/vcs/cli.mjs` | Modified | `VERBS` gains `'commitPrs'` (fires drift guard by design, D7) |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Modified | Added `recordGithubCommitPrs` + raw-trailing-arg carve-out |
| `brain/scripts/vcs/fixtures/github-prView-notfound.json` | Created | Live-confirmed not-found fixture |
| `brain/scripts/vcs/fixtures/gitlab-prView-notfound.json` | Created | Derived not-found fixture |
| `brain/scripts/vcs/fixtures/gitlab-prView-failure.json` | Modified | `status` corrected 404→500 (deviation #1) |
| `brain/scripts/vcs/fixtures/{github,gitlab}-commitPrs-{happy,empty,failure}.json` | Created | New verb's contract fixtures |
| `brain/scripts/lib/merge-walk.mjs` | Modified | `fetchPrMeta` widened to `(subject, vcs, config, sha)`; commit-sha dispatch (`resolveByCommitSha`, `readPr`, `fetchReviews`); `subjectRef`/`prSource` added to the return shape |
| `brain/scripts/lib/merge-walk.test.mjs` | Modified | 7 new #1086 tests: fail-closed proof, regression pin, and the remaining dispatch-table rows |
| `brain/scripts/brain-audit.mjs` | Modified | Passes `sha` into `fetchPrMeta`; new exported `formatUncomputableLine`/`formatPrSourceSuffix`; `[UNCOMPUTABLE]`/`[PASS]`/`[FAIL]` emission wired through them |
| `brain/scripts/brain-audit.test.mjs` | Modified | 6 new pure unit tests on the two formatters (no spawn, no `.git`) |
| `brain/scripts/brain-metrics.mjs` | Modified | Passes `sha` into `fetchPrMeta`; corrected the stale `:135` comment |
| `openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.draft.md` | Created | Tier 2 `brain-amendment/1` draft (D7) — NOT committed, see Deviations #5 |
| `openspec/changes/issue-1086-audit-pr-resolution/tasks.md` | Modified | Tasks 1.1-5.5 marked `[x]` (on disk only — openspec files are not committed, see Deviations #5-6) |

## Commits (cumulative — batch 1 + batch 2)

1. `5ee9c2f8` — `fix(vcs): isNotFound classifies a definitive not-found cause (#1086)` (Phase 1, batch 1)
2. `f6201519` — `feat(vcs): prView additively reports whether a number is absent (#1086)` (Phase 2, batch 1)
3. `ed04aa88` — `feat(vcs): commitPrs resolves the pull requests containing a commit (#1086)` (Phase 3, batch 1)
4. `22a1a0a3` — `fix(audit): resolve a merge's PR by commit sha when the subject number is absent (#1086)` (Phase 4, batch 2)
5. _(none)_ — Phase 5 produced no commit; see Deviations #5-6.

## Remaining Tasks

- [ ] None from `tasks.md` — all 5 phases (29/29 tasks) are marked `[x]`.
- Outstanding, but outside this apply batch's authority: the maintainer promoting `brain-drafts/vcs-contract-commitprs-row.draft.md` via `brain:promote` (D7's blocking hand-off — the ONE reason `verb-contract-drift-guard.test.mjs` stays red), the orchestrator posting the #996 comment, and deciding how the uncommitted `brain-drafts/` file reaches the PR (Deviation #5).

## Workload / PR Boundary

- Mode: single PR (chain strategy pending per tasks.md; `ask-on-risk` delivery strategy; risk is Medium, no chaining decided)
- Current work unit: all 5 units (`isNotFound`, `prView.absent`, `commitPrs`, `fetchPrMeta` dispatch + audit/metrics wiring, Tier 2 draft) — all landed except the human-only promotion/posting steps
- Boundary: starts at `origin/main` (`a8c04640`); ends at commit `22a1a0a3` (Phase 4). Phase 5 produced no commit (docs-only, excluded/held-back per Deviations #5-6).
- Estimated review budget impact: governed diff (whole branch vs `origin/main`, excluding `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`) measured via `git diff --stat a8c04640 HEAD` = **510 insertions + 71 deletions across 17 files = 581 changed lines**. Above design's ~340-line estimate (the literate/doc-comment style this codebase uses runs denser than the estimate accounted for) but well within the `lite`-tier 1000-line budget from `tasks.md`'s own forecast — no `size:exception` needed, no re-slicing required.

## Status

**5/5 phases (29/29 tasks) complete.** `npm test`: 6333/6334 — the one failure is the anticipated, documented D7 hand-off (`verb-contract-drift-guard.test.mjs`), not a defect. Ready for `sdd-verify`. Two items remain outside an apply agent's authority before this can merge: the maintainer's `brain:promote` of the Tier 2 draft, and the orchestrator's posting of the #996 comment (text prepared above, not sent).
