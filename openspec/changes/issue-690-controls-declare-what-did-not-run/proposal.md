---
status: draft
issue: 690
---

# Proposal — the declaration closes the word "only" (issue 690)

## What

Three fixes from a cold review of #683, run **after** its merge because the
review did not happen before it. A new ticket and a new PR on top of `main`,
never a commit stacked on merged history.

1. **`controls_not_applied`** — the verdict states which control classes did
   *not* run, derived from the same closed vocabulary.
2. **An e2e for `brain-review/1`** — the protocol `lite` and `standard` post by
   default, which #683 proved only at `regulated`.
3. **The structural pin rewritten** so a reformat cannot break it for a
   cosmetic reason.

## Why

#575 Ruling 3 requires a mechanical-only review to declare it ran mechanical
checks **only**. #683 shipped `controls: ["deterministic"]`, which declares what
ran and leaves *"and nothing else"* to be inferred from an absence — by a reader
who has to know the vocabulary is closed and notice which member is missing.

That is a real improvement over `conditions: []` and it is one notch short of
the ruling: **absence is doing the work again**, in the field written to stop
absence doing the work.

The two coverage gaps are smaller and the same kind: a property proven where it
mattered least (`/2`, at `regulated`) and a pin that fails for the wrong reason.

## The decision inside this change

`conditions` was the obvious home and was **measured, then rejected**. It is
inert with respect to the conclusion, so it would have been safe — but it is the
channel a reader scans for something wrong with *this* verdict, and a constant
firing on every verdict until #682 lands makes that channel noise.

A sibling field, derived from the same list, costs one line and dilutes nothing.

## Cost

One more line on every posted verdict, and it shrinks to `[]` by itself the day
#682's evaluator runs. No behaviour changes: nothing consumes either field yet,
`conditions` is untouched, and no verdict already posted is affected —
`parseVerdict` simply omits keys a block does not carry.
