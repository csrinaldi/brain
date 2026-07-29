---
status: draft
issue: 355
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-mrlist-contract/tasks
---

# Tasks — `mrList` Contract-Parity Coverage (M10 Phase 2, Rank 3, Issue #355)

> **STRICT TDD MODE IS ACTIVE**: RED → GREEN pairs using `node:test` + `assert/strict`.
> **Sequencing precondition** (design.md Migration section): base this branch on `main`
> *after* the rank-2 `prReviews` commit (`c2a67b0`) merges, then recount `jsonSpawnCallArgs`
> registrations in task 3.1 — it will be five, not four, once `prReviews` lands.

## Phase 1 — Fixture Evidence (`fixtures/`)
- [ ] **1.1** Add `recordGithubMrList(project)` (arity 1 — `mrList` is per-project, not
  per-number) to `fixtures/record-fixtures.mjs`: register in `CASES`, project the `gh api
  repos/<project>/pulls?state=open&per_page=100` response down to `{ number, title, head: { ref } }`
  per entry, and update the usage string to show `mrList` taking `<project>` with no trailing number.
- [ ] **1.2** Run the recorder against a project with ≥2 open PRs to produce
  `github-mrList-happy.json` (`_provenance.recorded`); hand-author
  `github-mrList-{empty,failure}.json` (`_provenance.derived`, `{ throws: true, error }` envelope
  for the failure case).
- [ ] **1.3** Hand-author `gitlab-mrList-{happy,empty,failure}.json` (`_provenance.derived`),
  reflecting the `merge_requests`/`source_branch` → `headBranch` mapping; happy fixture carries ≥2 entries.
- [ ] **1.4 GATE** — Confirm all six fixtures pass `assertProvenance` (exactly one of
  `recorded`/`derived`, plus `endpoint` and `date`) before wiring them into the suite.

## Phase 2 — Core Contract Tests (`vcs.contract.test.mjs`) — RED
- [ ] **2.1 RED** — Add the happy-path `mrList` test: load fixture, `assertProvenance`, call
  `vcs.mrList`, assert per-entry `deepEqual(Object.keys(entry).sort(), ['headBranch', 'number', 'title'])`
  plus a full-array `deepEqual`. Fails until Phase 3 registers `mrList` in `PROVIDERS`.
- [ ] **2.2 RED** — Add the empty-result test: `assert.deepEqual(result, [])`, with an assertion
  message naming `board.mjs`/`queue.mjs`'s unguarded iteration as the reason `null` is unacceptable.
- [ ] **2.3 RED** — Add the failure test: `assert.rejects(() => vcs.mrList({ ... }))` on both
  providers, with an in-test comment recording the throw-vs-null divergence per design D3 (pinned
  because changing it is out of scope, not because a caller depends on it).

## Phase 3 — Transport Glue (`vcs.contract.test.mjs`) — GREEN
- [ ] **3.1 GREEN** — Rename `githubJsonCallArgs` → `jsonSpawnCallArgs` (declaration plus every
  existing registration — recount per the sequencing note above before editing).
- [ ] **3.2 GREEN** — Register `mrList: jsonSpawnCallArgs` under both `PROVIDERS.github` and
  `PROVIDERS.gitlab`, and add `mrList: mrListArgs` to the loop's destructuring block.
- [ ] **3.3 GATE** — The three Phase 2 tests now pass on both providers (six total); confirm the
  rename broke none of the four (or five) previously-renamed registrations.

## Phase 4 — Verification & Documentation
- [ ] **4.1** Amend `vcs-contract.md` row 29 (`mrList`): document the throw-on-failure behavior
  (in explicit contrast to `prView`/`prReviews`/`labelEvents`/`prStatusRollup`'s never-throws
  convention) and the pagination asymmetry (GitHub `per_page=100`, GitLab `per_page=50`, neither
  paginates further).
- [ ] **4.2 GATE** — `npm test` on the full suite: six new tests green, zero regressions across
  the existing ~1900; confirm the diff lands within the ~110–140 estimated line count and the
  400-line review budget (no chained-PR split needed).
