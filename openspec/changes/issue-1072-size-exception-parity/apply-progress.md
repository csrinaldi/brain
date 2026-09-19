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
the `prBody` gathered beside them. `evaluators/checkpoint.mjs` already took
`labels` as a parameter of its own and now forwards them too, so both
production callers read the PR once and share that reading.

A port fetch was written here as a fallback for a caller that has none, and
REVERTED — see "The fallback fetch was a defect" below. The gather does not
reach the forge for labels at all.

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

## The fallback fetch was a defect, and CI caught it

`local-checks` went red on the second commit, on one test:
`gatherTrancheInputs: standard's evidence TEXT does change`. It passed locally
and failed in CI, which is the signature worth recognising.

The cause was mine. To let a caller omit the labels, `gatherTrancheInputs`
fell back to fetching them through `prView` — so every existing test that did
not pass labels started REACHING THE NETWORK. On this machine `gh` is
authenticated, the call returned an array, and the suite was green. In CI there
is no such credential, the call threw, `labels` became `null`, and the budget
finding's evidence gained the "labels could not be read" sentence that the
test's exact-equality assertion did not expect.

A unit suite whose result depends on whether the machine can reach a forge is
not a unit suite. The green run was the lie; the red one was the measurement.

The fallback is gone. Labels are an INPUT and nothing else:

- `review/cli.mjs` already passes `boot.prView.labels ?? null`.
- `evaluators/checkpoint.mjs` already TOOK `labels` as a parameter for
  `hasDecisionLabel` and simply was not forwarding them; it does now, so both
  production callers read the PR once and share that reading.
- Anything that is not an array is "not read", which waives nothing.

A test pins it: the gather is handed a `getVcs`/`prView` that throws if called,
and both the supplied and the omitted case pass without touching it.

`trancheAtTier`, the fixture behind the tier-text assertions, now passes
`labels: []` on purpose. Those tests are about the TIER's contribution to the
evidence; without it they described a PR whose labels could not be read, which
is a different fact with a different sentence, and every tier assertion would
have quietly become an assertion about the unread case.
