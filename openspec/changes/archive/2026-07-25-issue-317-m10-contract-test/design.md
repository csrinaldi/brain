---
status: draft
issue: 317
epic: 335
sequence: 313
artifact_store: hybrid
file: openspec/changes/issue-317-m10-contract-test/design.md
---

# Design — M10 Phase 2: contract test for `prReviews` (issue #317)

## Technical Approach

Test-only, additive. `prReviews` slots into `vcs.contract.test.mjs`'s existing
parameterized loop unmodified: `github.prReviews({project, number})` reads via
`runJson('gh', …)` (the `setSpawn` seam → `githubJsonCallArgs`),
`gitlab.prReviews({…, fetchImpl})` reads via `gitlabApiFetch` (→
`gitlabCallArgs`). Both glue functions already exist; the change is one
`prReviews` entry per provider in `PROVIDERS` plus one assertion block, four
fixtures, one recorder case, and one `vcs-contract.md` clarification.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Test placement | Extend the top-level `PROVIDERS` loop in `vcs.contract.test.mjs` | New `prReviews.contract.test.mjs`; a dedicated `PRREVIEWS_PROVIDERS` block | Both verbs fit the `{data}\|{throws}` fixture glue with zero new transport code. A separate block would only be justified by a multi-call shape (as `prStatusRollup`/`baseRefOid` needed). |
| D2 | Shape lock | `assert.deepEqual(Object.keys(entry).sort(), ['author','state'])` per entry | Individual `!('body' in entry)` checks | An exact-key lock rejects `body` **and** every other future accidental widening in one assertion. This is the M10 Gap A seam: the shape must be pinned, not sampled. |
| D3 | `[]` vs `null` | Three cases: failure fixture → `null`; inline zero-review success → `[]`; happy fixture → non-empty | Two more fixture files for the empty case | Inline mocks for the empty case follow the existing `headRefOid`/empty-`body` precedent in this same file. `null`≠`[]` is the invariant the DETECTION gate depends on. |
| D4 | Chain target | `gatherBrainWritesReviewedInputs` → `evaluateBrainWritesReviewed`, with `deps.getVcs` injected and `deps.fetchReviews` **not** injected | Calling `evaluateBrainWritesReviewed(reviews)` directly | The `null → []` collapse lives in `defaultFetchReviews` (`reviews ?? []`, `brain-writes-reviewed.mjs:163`), NOT in the evaluator — `evaluateBrainWritesReviewed({reviews: null})` would **throw** at `reviews.length`. Asserting the failure path directly on the evaluator would require the test to re-implement the caller's fallback, i.e. the inline fake the proposal forbids. Injecting only `getVcs` keeps the real wrapper, real normalizer, real fixture. |
| D5 | Recorded-fixture handling | Project to consumed fields + `body`; values **verbatim**, no login/number redaction | Redacting `user.login`/PR number | `github-prView-happy.json` already stores a real login and a full body verbatim; `_provenance.recorded` means recorded. Redaction would also break D4 — the chain needs a real approver login distinct from the PR author. `body` is retained *deliberately* so D2 proves the normalizer drops it. |
| D6 | GitLab happy fixture | 2 approvers, `_provenance.derived` + note on the structural limitation | Recording live GitLab | No reachable GitLab mirror (existing convention, `record-fixtures.mjs` header). The approvals endpoint carries no per-reviewer state and no body **by construction** — noted, not worked around. |

## Data Flow

```
fixture JSON ──▶ githubJsonCallArgs (setSpawn)  ─┐
             └─▶ gitlabCallArgs   (fetchImpl)   ─┴─▶ vcs.prReviews ──▶ [{state,author}] | null
                                                                            │
                                     deps.getVcs ─▶ defaultFetchReviews ────┤ (reviews ?? [])
                                                                            ▼
                                        gatherBrainWritesReviewedInputs ─▶ evaluateBrainWritesReviewed
                                                                            ▼
                                                              happy → pass | failure → warn
```

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modify | `prReviews: githubJsonCallArgs` / `gitlabCallArgs` in `PROVIDERS`; 4 tests in the loop (happy shape, exact-key lock, failure→`null`, empty→`[]`) + 2 chain tests |
| `brain/scripts/vcs/fixtures/github-prReviews-happy.json` | Create | `_provenance.recorded`; `data: [{state, user:{login}, body}]`, ≥2 reviews, ≥1 `APPROVED` |
| `brain/scripts/vcs/fixtures/github-prReviews-failure.json` | Create | `_provenance.derived`; `{throws:true, error}` |
| `brain/scripts/vcs/fixtures/gitlab-prReviews-happy.json` | Create | `_provenance.derived`; `data:{approved_by:[{user:{username}},…]}` (2 approvers) |
| `brain/scripts/vcs/fixtures/gitlab-prReviews-failure.json` | Create | `_provenance.derived`; `{throws:true, status:404}` |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Modify | `recordGithubPrReviews` + `CASES.prReviews`; header endpoint list + usage string |
| `brain/core/methodology/vcs-contract.md` (row 34) | Modify | Append: approval **state only**, carries no `body` on either provider |

## Interfaces / Contracts

```js
// PROVIDERS additions — no new glue needed
github: { …, prReviews: githubJsonCallArgs }
gitlab: { …, prReviews: gitlabCallArgs }

// D4 chain seam: transport injected, normalizer real
const chainVcs = providerName === 'github'
  ? (fixture) => { githubJsonCallArgs(fixture); return github; }
  : (fixture) => ({ prReviews: (a) => gitlab.prReviews({ ...a, ...gitlabCallArgs(fixture) }) });

await gatherBrainWritesReviewedInputs({
  baseSha:'a', headSha:'b', prNumber:1, repo:'x/y', author:'pr-author',
  deps: { getVcs: async () => chainVcs(fixture),
          diffNameOnly: () => ['brain/core/methodology/vcs-contract.md'],
          readBotAllowlist: () => [], readOverrideActors: () => [] },
});
```

Recorder endpoint: `gh api --paginate repos/{project}/pulls/{n}/reviews`,
projected to `{ state, user: { login }, body }`.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Contract | Shape, exact keys, `null` vs `[]` | Parameterized loop, fixture-backed, both providers |
| Chain | Fixture → normalizer → wrapper → gate | Real `gatherBrainWritesReviewedInputs`; only transport + git/config deps injected |
| Regression | `brain-writes-reviewed.test.mjs`, `providers.test.mjs` | Must stay green byte-identical — no production code changes |

## Migration / Rollout

No migration. Single-PR slice (~200 changed lines, well under the 400-line
budget). Revert = one commit.

## Open Questions

- [ ] Which PR supplies the recorded GH fixture — needs ≥1 `APPROVED` review by a
      login distinct from the PR author (D4 depends on it) and a short review body.
- [ ] Merge order vs `issue-317-prreviews-empty-body`, which amends the SAME
      `vcs-contract.md` row 34. Keep this edit to one appended sentence.
