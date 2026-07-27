# Tasks: brain:ship derives PR labels from the issue (#334)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 (A: ~150, B: ~200) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (Batch A + Batch B) |
| Delivery strategy | ask-on-risk (default) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Decision Needed Before Apply (Governance Scope — separate from workload guard)

**DECISION NEEDED**: `ship-pr-label-resolution` (spec) says REQ-S5-4's text is NOT modified;
design A6 assumes an ADDITIVE cross-reference + 2 new scenarios appended to
`openspec/specs/governance/spec.md`, no existing sentence reworded. Confirm this approach
before Phase 3 runs, or Phase 3 is skipped and the cross-reference stays spec-only.

## Phase 0: Fixture Prep

- [x] 0.1 Record `github-issueView-happy.json` from a real issue carrying a `type:*` label
      (suggest #334 itself) via `record-fixtures.mjs`; add `recordGithubIssueView` case.
- [x] 0.2 Author `github-issueView-failure.json` (derived, `throws: true`) and
      `gitlab-issueView-{happy,failure}.json` (derived — `iid`/`description`/`author.username`).

## Phase 1: Contract Coverage (Batch A) — RED

- [x] 1.1 Write failing `issueView` block in `vcs/providers/vcs.contract.test.mjs`: shape
      match both providers, `labels` always `string[]` (never null), `assert.rejects` on failure.
      (Confirmed GREEN immediately — `issueView` was already implemented per contract on both
      providers before this change; the block still pins the contract going forward.)
- [x] 1.2 Write failing `labelList` block (inline mocks, precedent `labelAdd`/`prStatusRollup`):
      case-sensitive parity, GitHub `--paginate`, GitLab `gitlabApiFetch`. Confirmed RED (8
      failing — `labelList is not a function`) before Phase 2.
- [x] 1.3 Write failing `vcs/label-preflight.test.mjs`: never-throws, no-cache (two calls = two
      lookups), exact-match exists/absent, lookup-failure resolves. Confirmed RED (module not
      found) before Phase 2.

## Phase 2: Contract Coverage (Batch A) — GREEN

- [x] 2.1 Implement/confirm `issueView` in `vcs/providers/github.mjs` + `gitlab.mjs`.
      (Already implemented — confirmed via the Phase 1.1 contract block.)
- [x] 2.2 Implement `labelList` in `providers/github.mjs` (`--paginate`) and `providers/gitlab.mjs`
      (`gitlabApiFetch`), paginated (>30 labels must not false-reject). GitLab paginates
      page-by-page (`gitlabApiFetch` exposes no `Link` header to auto-follow), stopping on a
      short page.
- [x] 2.3 Create `vcs/label-preflight.mjs`: `labelPreflight({provider, project, label,
      labelListFn?}) => {exists, error?}`, dispatch on provider, catches, never throws.
- [x] 2.4 Update `brain/core/methodology/vcs-contract.md`: `labelList` row, label-resolution
      rule, adapter-status rows.

## Phase 3: Governance Cross-Reference (gated on Decision above)

- [ ] 3.1 SKIPPED — per explicit apply-time instruction: "cross-reference spec-only, do not
      modify `openspec/specs/governance/spec.md`". The A6 decision in design.md was never
      separately confirmed before this apply batch, so Phase 3 is left undone by design; the
      `ship-pr-label-resolution` spec's cross-reference (REQ-S5-4 = the issue's own type:*
      label, verbatim, preflight-confirmed) stands as spec-only documentation. Re-open this
      task if/when the governance/spec.md delta is separately approved.

## Phase 4: brain-ship Refactor (Batch B) — RED

- [x] 4.1 Add `findTypeLabel` to `lib/branch-type.mjs` (`/^type::?/i`, verbatim); widen
      `deriveBranchType` strip from `/^type:/` to fix the `type::bug` → `:bug` latent bug.
- [x] 4.2 Write failing `lib/branch-type.test.mjs` cases: `type::bug` → `fix`, `findTypeLabel`.
      (`findTypeLabel`/regex widening were implemented alongside 4.1 in the same edit — the
      new test cases confirmed GREEN immediately; one case caught a case-sensitivity gap,
      fixed by adding the `i` flag to `TYPE_PREFIX`.)
- [x] 4.3 Rewrite `brain-ship.test.mjs` with injected `issueViewFn`/`labelPreflightFn` stubs:
      verbatim label passthrough, title/label independence, all 4 error paths, zero remote
      calls on red tree (A5: failure stub must reject, not return `null`). Confirmed RED
      (7/12 failing) before Phase 5.

## Phase 5: brain-ship Refactor (Batch B) — GREEN

- [x] 5.1 Refactor `runShip()` in `brain-ship.mjs`: order `checkFn → issueViewFn →
      findTypeLabel → labelPreflightFn → mrCreateFn` (A4); label travels verbatim.
- [x] 5.2 Wire `issueViewFn`/`labelPreflightFn` injection at the CLI entrypoint.
- [x] 5.3 Implement error messages per design's Error Handling table (4 conditions,
      `brain:ship: ` prefix), fail closed on missing label or `exists:false`.
      `titleFromBranch` rewritten to conventional-commit format
      (`<type>: <branch-slug>`), fed by `deriveBranchType([typeLabel])`.

## Phase 6: Verification

- [x] 6.1 `npm test` — all contract/unit/integration suites green; no live network/spawn calls.
      Result: 1935/1935 pass (+28 new vs. the 1907 pre-change baseline), 0 regressions. Also
      fixed an incidental drift-guard failure: `vcs/cli.mjs`'s `VERBS` array was missing the
      new `labelList` verb — added per `verb-contract-drift-guard.test.mjs`'s own design intent.

## Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| A | Contract coverage (Phases 0-2) | Single PR | Spec as proof; RED→GREEN |
| B | brain-ship refactor (Phases 4-5) | Single PR | Depends on A's `labelList`/`labelPreflight` |
| Gov | REQ-S5-4 cross-reference (Phase 3) | Same PR | Gated on decision above |
