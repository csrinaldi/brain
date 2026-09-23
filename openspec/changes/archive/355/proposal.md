---
status: draft
issue: 355
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-mrlist-contract/proposal
---

# Proposal: mrList Contract-Parity Coverage (M10 Phase 2, Rank 3)

Issue #355. Epic #335. Change folder: `openspec/changes/issue-355-m10-phase2-mrlist-contract/`.

## Intent

`mrList` is the fan-out verb of the entire reviewer subsystem — `review/board.mjs:71`, `review/queue.mjs:50`,
`brain-next.mjs:128` and `project-status.mjs:122` all begin by calling it and then iterate its output, so every
downstream verdict inherits its shape. It has zero cross-provider contract-parity coverage: `vcs.contract.test.mjs`
covers `labelEvents`, `prView`, `mrCreate` and `issueView` only, and the two `mrList` tests that do exist
(`providers.test.mjs:155-165`) are per-provider happy-path unit tests asserting `headBranch` mapping in isolation —
precisely the "two divergent files that can silently drift apart" the contract suite's own header says it exists to
prevent. Rank 3 in the #336 audit, after `prReviews` (rank 2) and ahead of the governance-gate verbs.

## Scope

In scope — test-only, additive, zero production files touched:

- `mrList` contract block in `brain/scripts/vcs/providers/vcs.contract.test.mjs`, parameterized over both providers,
  registered in the existing `PROVIDERS` table.
- Three scenarios per provider: happy-path (multi-entry list), empty result, transport failure. Six scenarios total.
- Exact-key shape lock on each entry: `{ number, title, headBranch }` via `deepEqual` on sorted keys — rejects both
  missing and extra fields, mirroring rank-2's `{ state, author }` lock.
- Six fixtures: `github-mrList-{happy,empty,failure}.json` and `gitlab-mrList-{happy,empty,failure}.json`.
- `recordGithubMrList` case in `fixtures/record-fixtures.mjs`.
- `vcs-contract.md` row 29 (`mrList`) amended with the failure-mode and pagination semantics it currently omits.

Estimate: roughly 110-140 lines in the test file plus six small fixtures. Comfortably inside one reviewable PR.

Out of scope: any change to `mrList`'s normalized shape, its throw-vs-null failure behavior, or its pagination.
Those are recorded as findings and deferred to a follow-up issue.

## Approach

Transport glue. This is the first verb in the suite where BOTH providers spawn a CLI: `gitlab.mrList:293` calls
`runJson('glab', ...)`, not `gitlabApiFetch`. The existing `gitlabCallArgs` helper injects `fetchImpl` and therefore
does NOT apply here. Both providers import `runJson` from the shared `lib/exec.mjs`, so the single `setSpawn` seam
already drives both. Rename `githubJsonCallArgs` to a provider-neutral `jsonSpawnCallArgs` and register it under both
provider entries — a mechanical rename covered by the four verbs already using it.

Shape lock. Assert `deepEqual(Object.keys(entry).sort(), ['headBranch', 'number', 'title'])` per entry, plus a
`deepEqual` on the full normalized array. The empty case asserts `[]` exactly — not null, not undefined — because
`board.mjs` and `queue.mjs` iterate the result unguarded.

Failure mode — the finding that shapes this block. `runJson` throws on non-zero exit and on malformed JSON
(`lib/exec.mjs:29-33`), and `mrList` wraps it in no try/catch on either provider. So `mrList` THROWS where every other
read verb in the contract (`prView`, `prReviews`, `labelEvents`, `prStatusRollup`) returns `null`-on-uncomputable and
promises never to throw. The `vcs-contract.md` row for `mrList` is silent on failure entirely. The failure scenario
therefore asserts the actual behavior via `assert.rejects` on both providers — locking parity in the divergence rather
than pretending it matches — and the contract row is amended to say so explicitly. This is documentation of a defect,
not endorsement of it; changing the behavior would touch production code and belongs in its own change.

Fixture provenance. GitHub happy-path recorded from the live API through the recorder, matching the discipline set by
`github-prView-happy.json`. Everything else necessarily derived: no live GitLab mirror is reachable from this
environment, and forced-failure and empty-list cases cannot be recorded. Every fixture carries exactly one of
`_provenance.recorded` / `_provenance.derived`, enforced by the suite's existing `assertProvenance`.

Pagination. GitHub requests `per_page=100`, GitLab `per_page=50`, and neither paginates — a silent truncation
divergence at different thresholds. A fixture-driven test cannot observe this, so it is captured in the contract doc
row and the follow-up issue rather than asserted.

## Success Criteria

- `mrList` contract block green on both providers, all six scenarios.
- Entry shape locked to exactly `{ number, title, headBranch }` — a widened or narrowed normalizer fails the suite.
- Empty result asserts `[]` distinctly on both providers.
- Failure behavior asserted identically on both providers, and reflected in `vcs-contract.md`.
- GitHub happy fixture carries `_provenance.recorded`; all fixtures pass `assertProvenance`.
- Zero production files modified; full suite passes with zero regressions.
- The #336 Gap A uncovered-verb list no longer contains `mrList`.

## Risks & Rollback

Test-only and additive, so the change carries no runtime risk. Two coordination risks are worth naming.

Sequencing against rank-2. The `prReviews` work (commit `c2a67b0`) lives on `feature/m10-seam-contract-coverage` and is
NOT an ancestor of the current branch. Both changes edit the same `PROVIDERS` table and its destructuring block, so
branching this work before rank-2 lands guarantees a conflict there. Mitigation: base this change on main after rank-2
merges.

Locking a defect. Asserting `assert.rejects` cements today's throw-on-failure behavior. Mitigation: the assertion is
labeled in-test as a documented divergence from the never-throws discipline, and the follow-up issue for null-safety
is opened alongside the PR so the lock reads as a deliberate baseline rather than an approval.

Rollback: single revert of the change commit. No production code path is touched, so revert restores current behavior
exactly.
