# vcs-pr-review-bodies Specification

## Purpose

Provider-agnostic read of verdict-bearing review comment **bodies** for a
PR/MR, distinct from `prReviews`' approval-state-only shape. Restores
cold-boot.mjs and board.mjs's ability to feed real bodies into
`parseVerdict`, unblocking `priorVerdicts`, the anti-loop lock, the
`rev >= 3` bound, and board `seq:*`/`reviewed:*` reconciliation (issue #317).

## Requirements

### Requirement: `prReviewBodies` contract shape

The system MUST expose a `prReviewBodies({ project, number, apiBase?, token?,
proxyUrl?, fetchImpl? })` verb on every VCS provider, returning
`Promise<Array<{ author: string|null, body: string, at: string }>|null>`.

`null` MUST mean uncomputable (fetch failed) and MUST NOT be conflated with
a genuinely empty result, which MUST be `[]`. `body` MUST be the empty
string `''` when a comment has no text, never `null`, mirroring the
`prView`/`labelEvents` uncomputable-vs-empty discipline already in
`vcs-contract.md`. The verb MUST be registered in all three drift-guard
sources of truth: `vcs-contract.md`'s Required verbs table, `cli.mjs`'s
`VERBS`, and both provider modules' exports.

#### Scenario: Successful fetch on both providers

- GIVEN a PR/MR with review comments carrying non-empty bodies
- WHEN `prReviewBodies` is called
- THEN it resolves to an array of `{ author, body, at }` entries
- AND `body` is never `null` for any returned entry

#### Scenario: Fetch failure

- GIVEN the underlying API call throws or rejects
- WHEN `prReviewBodies` is called
- THEN it resolves to `null`, never a fabricated `[]`
- AND the function never throws

#### Scenario: Ascending order by timestamp

- GIVEN a PR/MR with multiple review comments posted over time
- WHEN `prReviewBodies` resolves
- THEN entries are ordered ascending by `at`
- AND callers may treat the last array entry as the most recent comment (same convention as `labelEvents`)

### Requirement: Per-provider filtering of non-verdict noise

The system MUST exclude entries that are structurally present in the
provider's raw response but are not human/bot review comment bodies.

| Provider | Source | Exclusion rule |
|---|---|---|
| GitHub | Reviews API (`pulls/{number}/reviews`, paginated) | None needed — the Reviews API returns only actual reviews |
| GitLab | Notes API (`merge_requests/{iid}/notes`) — same resource `prReviewComment` writes to | MUST exclude notes where `system: true` (state-change system notes, e.g. "assigned to", "changed the description") |

#### Scenario: GitLab system notes excluded

- GIVEN a GitLab MR whose notes include both system notes (`system: true`) and a human/bot verdict comment
- WHEN `prReviewBodies` is called
- THEN the returned array contains only the non-system note(s)
- AND the system notes are absent, not merely empty-bodied

#### Scenario: GitHub pagination preserved

- GIVEN a PR with review comments spanning multiple pages
- WHEN `prReviewBodies` is called
- THEN all pages are fetched (`--paginate`, matching `prReviews`' existing discipline)

### Requirement: Contract parity and `parseVerdict` integration test

The system MUST have an automated test asserting that `prReviewBodies`'
normalized shape is identical across GH/GL (including `null` vs `[]` vs
`''` semantics), and a separate integration test asserting that a REAL
(non-fabricated) normalizer output, fed through `parseVerdict({ body,
author })`, yields a non-null verdict for at least one entry carrying a
valid verdict payload.

#### Scenario: Parity test

- GIVEN fixture responses shaped like each provider's raw API
- WHEN both providers' `prReviewBodies` normalize them
- THEN the resulting shapes are structurally identical modulo values

#### Scenario: Real-shape integration test

- GIVEN a `prReviewBodies`-shaped entry with a real verdict-formatted `body` (no fixture fabricates a `body` that bypasses the normalizer)
- WHEN it is passed to `parseVerdict`
- THEN `parseVerdict` returns a non-null verdict object

### Requirement: Integration with cold-boot and board

The system MUST route `cold-boot.mjs`'s `defaultFetchReviews` and
`board.mjs`'s `reconcileOnePr` through `prReviewBodies` instead of
`prReviews`, so `doctrine.priorVerdicts` and `latestVerdict` are populated
from real bodies in production. `prReviews` and its existing callers
(`brain-writes-reviewed.mjs`, `actor-check.mjs`) MUST remain unchanged.

#### Scenario: Cold-boot reads real prior verdicts

- GIVEN a PR carrying a prior posted verdict comment
- WHEN cold-boot fetches reviews via `defaultFetchReviews`
- THEN `doctrine.priorVerdicts` is non-empty
- AND the anti-loop lock and `rev >= 3` STOP/escalate bound can fire

#### Scenario: Board reconciliation uses real latest verdict

- GIVEN a PR whose most recent review comment is a valid verdict
- WHEN `board.mjs`'s `reconcileOnePr` runs
- THEN `latestVerdict` is derived from that real body, not `null`
- AND `seq:*`/`reviewed:*` labels reconcile accordingly

#### Scenario: `prReviews` callers unaffected

- GIVEN `brain-writes-reviewed.mjs` and `actor-check.mjs` still call `prReviews`
- WHEN their existing tests run
- THEN they remain green, unchanged by this capability
