---
status: approved
issue: 1119
---

# Proposal: `prLookupFailed` must never claim a push that did not happen

## Problem

`brain/scripts/i18n/en.mjs:428` (`memory.ship.prLookupFailed`) reads: *"the push already
landed and is durable"*. `memory.ship.lane/ship.mjs`'s D4 reordering (#936) moved the PR
lookup (`decidePr()`, `ship.mjs:400`) to run **before** the push (`ship.mjs:412`). When
`decidePr()`'s `mrList` call throws, execution never reaches the push step at all — yet
the operator is told records were durably delivered.

Evidence (issue #1081, finding F7): `openspec/changes/issue-1081-memory-2-0-exit-audit/
evidence/51-seam2a.txt` reproduces the failure via an injected `mrList` outage; the printed
message says "the push already landed and is durable"; `evidence/52-after-2a.txt`'s
`git ls-remote` on the real origin shows no `memory/*` ref exists. The Spanish catalog
(`es.mjs:391`) carries the identical false claim.

## Root cause

`prLookupFailed` is thrown from **two** call sites in `ship.mjs` with opposite push
states:

- `decidePr()` (two throw sites, `ship.mjs:194-200` and `:207-211`) — always runs
  **before** the push block (`ship.mjs:412`). Nothing is ever pushed when this throws.
- `createPr()`'s one-shot `mrList` re-scan (`ship.mjs:236-243`) — only ever reached
  **after** the push block already ran. A real push may already be durable here.

Both throw sites tagged the same `err.prLookupFailed = true` and rendered through the
same static catalog string, which could only be honest for one of the two.

## Decision

Tag each throw site with the caller-observed truth: `err.pushed = false` at both
`decidePr()` sites (always pre-push, D4's own ordering), and `err.pushed = pushed` (the
real local boolean) at `createPr()`'s re-scan site, since it is reached after the push
step whether or not that step actually pushed anything.

`memory/cli.mjs`'s error-to-key mapping forks on `err.pushed`: `prLookupFailed` (nothing
pushed, safe to retry) for the pre-push case, and a new `prLookupFailedAfterPush` key
(push already landed, retry reconciles) for the post-push case. Both `en.mjs` and
`es.mjs` gain the split, each locale's `prLookupFailed` text corrected to state nothing
was pushed and that retrying is safe.

## Non-goals

- No change to `decidePr()`'s decision logic, D4's lookup-before-push ordering, or any
  other `memory.ship.*` outcome shape — this is a message-honesty fix, not a behavior
  change.
- No new locale files — only `en.mjs`/`es.mjs` exist under `brain/scripts/i18n/`.

## Impact

- `brain/scripts/memory/lane/ship.mjs` — `err.pushed` tagged at three throw sites.
- `brain/scripts/memory/cli.mjs` — error-key selection forks `prLookupFailed` on
  `err.pushed`.
- `brain/scripts/i18n/en.mjs`, `es.mjs` — `prLookupFailed` corrected, new
  `prLookupFailedAfterPush` key added, both locales.
