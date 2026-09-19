# Apply progress — issue-1072-size-exception-parity

## What was done

`sizeExceptionRuling({labels, tier})` in `vcs/governance-tiers.mjs` is now the
one reading of `size:exception`. `governance/run-check.mjs` and
`review/evaluators/tranche.mjs` both call it.

The three states are kept apart deliberately. REQ-TIER-6 requires a tier that
refuses the waiver to say the label WAS present and the tier refused it; a
caller checking only `honored` would collapse "nobody asked" into "refused"
and lose that sentence. `refusedByTier` exists for it.

A label set that could not be read waives nothing. Granting an exception on
the strength of a failed fetch is the one direction this must never fail, so
`gatherTrancheInputs` hands `null` — never `[]`, which would claim the PR
carries no exception when nothing was read.

The reviewer takes the labels from the CALLER. `review/cli.mjs` already boots
with a `prView` and reads `boot.prView.labels` twice before the gather; taking
them as an input costs the forge nothing and keeps the labels consistent with
the `prBody` gathered beside them. The port fetch remains as the fallback for
a caller that has none.

**Waiving is not forgetting.** The gate returns pass WITH a reason, so the
reviewer states the waiver as an `editorial` finding carrying the count, the
budget, the label and the tier. An area where a waived 3,101-line diff used to
be reported must not go blank, or the verdict stops carrying the fact that an
exception was granted.

## Mutations

Calling one function is not the same as agreeing — either side could grow a
branch that overrides it. The parity test drives both authorities across every
tier, with and without the label, above and below budget.

| mutation | parity suite |
| --- | --- |
| the reviewer stops reading the ruling (**this is the defect that shipped**) | 3 of 3 red |
| the gate stops reading the ruling | 3 of 3 red |

The first mutation reproduces PR #1067 exactly, which is the point: this is
the test that would have caught it.

## Measured

Whole repository: 6097 tests, 6097 pass, 0 fail. `governance/**` alone: 439
pass, unchanged by the refactor.

## Cold review round 1 of PR #1073 — APPROVE, with one editorial that was right

The finding: `gatherTrancheInputs` states in its own comment that "a refusal
is null, never []", and `review/cli.mjs` then wrote `boot.prView.labels ?? []`
— coercing exactly that null into exactly that empty array. The verdict was
still fail-closed, so nothing was waived wrongly, but the doctrine was honored
everywhere except on the path that uses it.

`?? null` now, rather than the raw value the reviewer suggested: an ABSENT
labels field would otherwise read as "the caller supplied none" and fall
through to the fallback fetch, turning a refused read into a second request
that could succeed and waive a budget the first read never authorised.

**The first test for it did not bite.** `[]` and `null` both fail closed, so a
test that only watched the verdict could not tell them apart — the mutation
ran green and the fix was unprovable. That is not a testing problem, it is a
design one: a distinction nothing can observe is not worth keeping.

So the distinction was made observable, which is also the honest behaviour. A
budget blocker on labels that could NOT BE READ now says so, because that is a
different fact from a PR that genuinely carries no exception: the first may be
a refused forge read, the second is a real answer. With that sentence in the
verdict the mutation turns red.

| mutation | cli suite |
| --- | --- |
| the refusal is coerced back to `[]` | 1 red |

Whole repository after the round: 6099 tests, 6099 pass, 0 fail.
