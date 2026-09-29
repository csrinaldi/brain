# Design: fork `prLookupFailed` on the real push state

## Approach considered and rejected

**Single message, code-assembled fragment.** Have `cli.mjs` compute a phrase like
`"nothing was pushed"` / `"the push already landed"` and pass it as an interpolation
param (`{pushClaim}`) into one shared catalog string. Rejected: ADR-0010 scopes full
user-facing sentences to the catalog, not English fragments assembled by code and spliced
into a Spanish sentence — that would silently break the Spanish rendering (an English
fragment landing inside `es.mjs`'s sentence) the same way this defect already broke
English/Spanish parity once.

**Chosen approach: tag the real state, fork the key.** `err.pushed` is set at the point
each error is thrown — the one place that actually knows whether the push step ran —
and `cli.mjs`'s existing key-selection ternary (already a chain of `err?.X ? "x" : ...`
for `raced`/`badHost`/`diverged`/`pushFailed`/`prCreateFailed`) gains one more fork. Each
resolved key maps to a complete, locale-owned sentence in both catalogs. This mirrors the
existing pattern exactly (e.g. `closedUnmerged` vs `create` are already two different
outcomes of one decision, rendered through two different keys) rather than introducing a
new mechanism.

## `err.pushed` semantics

| Throw site | `err.pushed` | Why |
|---|---|---|
| `decidePr()` — `mrList` throws (`ship.mjs:197-199`) | `false` (constant) | This call always runs before the push block (D4's ordering — enforced by `decidePr()`'s call site preceding the `if (pendingPush)` push block in `shipLane()`). |
| `decidePr()` — uncomputable `state`/`merged` (`ship.mjs:208-210`) | `false` (constant) | Same call, same ordering guarantee. |
| `createPr()` — one-shot re-scan throws (`ship.mjs:240-242`) | `pushed` (the real local variable from `shipLane()`) | `createPr()` is only ever called after the push block has already run to completion (or been skipped as a no-op when nothing was pending) — `pushed` reflects which actually happened, never assumed `true`. |

`pushed` is threaded into `createPr()` as an explicit parameter rather than inferred
inside the function, because `createPr()` itself has no visibility into whether a push
happened — that state lives in `shipLane()`'s own scope.

## Key mapping (`cli.mjs`)

```
err?.prLookupFailed ? (err.pushed ? "prLookupFailedAfterPush" : "prLookupFailed")
```

Placed in the existing ternary chain, same position as before — no reordering of the
other branches.

## Catalog changes

`en.mjs`/`es.mjs` each gain:
- `memory.ship.prLookupFailed` — corrected text: states the lookup runs before the push,
  so nothing was pushed, and that retrying is safe.
- `memory.ship.prLookupFailedAfterPush` — new key: states the push already landed, the PR
  could not be confirmed afterward, and retrying is safe (the next run reconciles it).

## Sweep of the rest of the ship path

Audited every other `memory.ship.*` message for the same "claims an action that did not
happen" defect (see `spec.md`'s non-requirement section for the full list audited):
`diverged` (two throw sites, both pre-push or a rejected push — accurate as written),
`pushFailed` (git push itself failed — accurate), `prCreateFailed` (makes no push claim),
`raced`/`badHost` (thrown inside `collect()`, always before any push), and the
`memory.ship.sweep.*` family (each gated on `result.pushed`/`result.closedUnmerged`
already computed by `shipLane()`'s own outcome shape, or make no push claim at all). None
required a change.

## Test strategy (STRICT TDD)

1. `ship.mjs` unit tests (`lane/ship.test.mjs`): extend the three existing
   `err.prLookupFailed === true` assertions (decidePr's two throw sites, exercised by
   three separate tests) with `err.pushed === false`. Add one new test proving the
   `createPr()` re-scan path tags `err.pushed === true` when a real push already ran.
2. `cli.mjs` source-guard + catalog test (`cli.ship.test.mjs`): asserts the ternary
   fork exists in source, and that both catalogs' `prLookupFailed` text never claims a
   push landed while `prLookupFailedAfterPush` does.
3. `cli.ship.test.mjs` CLI-level reproduction: drives the real CLI through
   `BRAIN_VCS_TEST_MODULE`/`BRAIN_VCS_TEST_SCRIPT` pointing at a missing script file
   (mirrors evidence 51's injected outage exactly), asserts stderr states nothing was
   pushed and never claims the push landed, and asserts (mirroring evidence 52) that no
   `memory/*` ref exists on the fixture's bare origin afterward.

All three test additions were confirmed RED (failing) against the pre-fix code via a
targeted `git stash` of only the production files, then GREEN after restoring the fix.
