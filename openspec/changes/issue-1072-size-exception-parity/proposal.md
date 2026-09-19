# Proposal — issue-1072-size-exception-parity

## The problem, measured

On PR #1067 the `diff-size` CI gate passed and the cold reviewer emitted a
`budget` blocker, about the same 3,101 lines, eight seconds apart.

```
tier: lite | diffBudget: 1000 | honorSizeException: true
```

`governance/run-check.mjs` read `size:exception` from the fresh label set and,
because `lite` honors it, returned pass with a reason.
`review/evaluators/tranche.mjs` read `tierParams(tier).diffBudget` from the
same frozen params object and never read the label at all — one field used,
its sibling ignored.

## Why it is a defect and not a stricter policy

`honorSizeException` is a tier PARAMETER. If the reviewer were meant to hold a
stricter line regardless of tier, the flag would have no meaning at review
time, and neither module says so.

The consequence is that a maintainer who grants an exception, and whose CI
accepts it, cannot get an APPROVE: removing the label fails the gate and
keeping it fails the review. There is no move that satisfies both.

## The decision

The maintainer's ruling: the reviewer honors the label exactly as the gate
does.

## The approach

One reading, in the module that owns the tier: `sizeExceptionRuling({labels,
tier})` in `vcs/governance-tiers.mjs`, returning the three states apart —
`present`, `honored`, `refusedByTier`. Both authorities call it.

The three states stay apart because REQ-TIER-6 requires a tier that refuses
the waiver to report that the label WAS present and the tier refused it. A
caller checking only `honored` would collapse "nobody asked" into "refused"
and lose the sentence the requirement exists to produce.

Calling one function is not the same as agreeing: either side could grow a
branch that overrides it. A parity test drives BOTH authorities across every
tier, with and without the label, above and below budget, and fails if their
answers diverge.

## What does not change

No second budget literal. `tierParams` stays the one source (REQ-TIER-9). The
gate's observable behaviour is unchanged — its 439 existing tests pass
untouched.
