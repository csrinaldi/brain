---
status: draft
issue: 519
---

# Design — report, do not gate

`step4bMemoryRecency(cwd, deps)` → `{ ageDays: number|null, newest: string|null }`.

Injectable through `deps._recency` and `deps._now`, matching the file's existing seam
discipline (every step is independently try/caught and folds failure into its return shape).

`renderContextBlock` takes `recency` as an **optional** field defaulting to `null`, so a
model without it renders exactly as before — the change is additive at the renderer.

## The threshold

`STALE_MEMORY_DAYS = 2`, a module constant, deliberately **not** derived from the tier
matrix. It decides what to SAY, never what to allow; routing it through tier resolution
would imply it is policy and invite exactly the tightening this change refuses to make.

## What the mutations found

**M3 was green** — dropping `recency` from the `renderContextBlock` call left the
composition test passing. The test injected a *fresh* value, which renders no line, so a
field that never reached the renderer looked identical to one that did. The injected value
is stale now, and M3 is red. That is the #367 defect class (a reader that exists and is
never threaded) reappearing in a test's own fixture rather than in production.
