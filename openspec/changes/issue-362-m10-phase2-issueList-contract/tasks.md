---
status: draft
issue: 362
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-issueList-contract/tasks
---

# Tasks — `issueList` Contract-Parity Coverage (M10 Phase 2, Rank 4, Issue #362)

> **STRICT TDD MODE IS ACTIVE**: RED → GREEN pairs using `node:test` + `assert/strict`.
> **Sequencing note** (design.md Migration section, verified current): `main` is at `5dd7d4c`
> (`mrList`, rank-3, merged). `jsonSpawnCallArgs` already exists and is registered for both
> providers — this change needs **no rename and no seam change**, only two new table entries.
> `prReviews` (`c2a67b0`, rank-2, #317) is **not yet merged** to `main`; it edits the same
> `PROVIDERS` literal and destructuring block this change touches (`:120-127`), so expect a small
> two-hunk conflict whenever it lands — resolve mechanically, do not re-derive.

## Phase 1 — Fixture Evidence (`fixtures/`)
- [ ] **1.1** Add `recordGithubIssueList(project)` (arity 1 — `issueList` is per-project, no
  trailing number, same shape as `recordGithubMrList`) to `fixtures/record-fixtures.mjs`: register
  in `CASES`, hit `gh api repos/<project>/issues?state=open&per_page=100`, and project the response
  using the **"fields the normalizer reads, not maps"** rule — keep `pull_request: { url }` (read as
  filter input, never emitted) and keep `labels` as `[{ name }]` objects (not pre-flattened to
  strings, or the label-unwrap assertion in Phase 2 goes vacuous). Update the header endpoint list
  and the no-number usage line alongside `mrList`.
- [ ] **1.2** Run the recorder against this repo to produce `github-issueList-happy.json`
  (`_provenance.recorded`), verifying it satisfies all three content requirements before commit:
  ≥1 entry carrying `pull_request`, ≥2 entries without it, ≥1 surviving entry with non-empty
  `labels`. Hand-author `github-issueList-{empty,failure}.json` (`_provenance.derived`, `{ throws:
  true, error }` envelope for the failure case).
- [ ] **1.3** Hand-author `gitlab-issueList-{happy,empty,failure}.json` (`_provenance.derived`),
  reflecting the `iid` → `number` mapping and GitLab's already-flat `labels` string array (no
  per-label objects, no `pull_request` field on any entry — GitLab's issues endpoint returns only
  issues); happy fixture carries ≥2 entries.
- [ ] **1.4 GATE** — Confirm all six fixtures pass `assertProvenance` (exactly one of
  `recorded`/`derived`, plus `endpoint` and `date`) before wiring them into the suite.

## Phase 2 — Core Contract Tests (`vcs.contract.test.mjs`) — RED
- [ ] **2.1 RED** — Add the happy-path `issueList` test inside the parity loop: load fixture,
  `assertProvenance`, assert `result.length >= 2` first (fails loudly on a fixture that lost
  entries), then per-entry `deepEqual(Object.keys(entry).sort(), ['labels', 'number', 'title'])`,
  per-label `typeof === 'string'`, plus a full-array `deepEqual` against hardcoded expected values
  (not re-derived from `fixture.data` through the normalizer's own mapping). Fails until Phase 3
  registers `issueList` in `PROVIDERS`.
- [ ] **2.2 RED** — Add the empty-result test: `assert.deepEqual(result, [])`, with an assertion
  message naming `tracker-board.mjs:58`'s unguarded `myIssues.length` as the reason `null`/`undefined`
  is unacceptable there specifically (not a vague "callers iterate unguarded").
- [ ] **2.3 RED** — Add the failure test: `assert.rejects(() => vcs.issueList({ ... }))` on both
  providers, with an in-test comment recording the divergence as **caller-absorbed**
  (`tracker-board.mjs:44-47`'s `safeList` try/catch, `project-status.mjs:115-130`'s wrapping
  try/catch) — the opposite framing from `mrList`'s "pinned because out of scope" comment; this one
  states the throw is contained and load-bearing.
- [ ] **2.4 RED** — Add the GitHub-only `pull_request` filter test *outside* the parity loop:
  derive `prCount = fixture.data.filter(r => r.pull_request).length`, assert `prCount >= 1` (fixture
  guard — fails loudly if re-recorded from a repo with no open PRs), assert `result.length ===
  fixture.data.length - prCount`, and assert no surviving entry's source item carries
  `pull_request`. Include the D1 comment documenting why `assignee: 'me'` is deliberately excluded
  from the loop and what would silently go green (`whoami()` returning the issues array, `undefined`
  login, a malformed trailing `&` in the GitLab query) if someone "improved" coverage by adding it.

## Phase 3 — Transport Glue (`vcs.contract.test.mjs`) — GREEN
- [ ] **3.1 GREEN** — Register `issueList: jsonSpawnCallArgs` under both `PROVIDERS.github` and
  `PROVIDERS.gitlab` (no rename needed — `jsonSpawnCallArgs` already exists from rank-3), and add
  `issueList: issueListArgs` to the loop's destructuring block alongside the existing entries.
- [ ] **3.2 GATE** — The four Phase 2 tests now pass (seven assertions total: three per provider
  inside the loop, one GitHub-only outside it); confirm the two added table entries broke none of
  the existing registrations (`mrList`, `prView`, `labelEvents`, `prStatusRollup`, `issueView`).

## Phase 4 — Verification & Documentation
- [ ] **4.1** Amend `vcs-contract.md` row 28 (`issueList`): document the throw-on-failure behavior
  (contrast with `prView`/`prReviews`/`labelEvents`/`prStatusRollup`'s never-throws convention, same
  divergence already documented for `mrList`), the pagination asymmetry (GitHub `per_page=100`,
  GitLab `per_page=50`, neither paginates further), and the two GitHub-only normalization steps
  (`pull_request` filter, label-object → name-string unwrap).
- [ ] **4.2 GATE** — `npm test` on the full suite: seven new tests green, zero regressions across
  the existing ~1910 (post-`mrList`); confirm the diff lands within the ~150-line estimate and the
  400-line review budget (no chained-PR split needed); confirm `providers.test.mjs:136-151`'s
  existing per-provider `issueList` unit tests are untouched and note the overlap (per-provider
  mechanics vs. cross-provider parity) rather than deleting either.
