---
status: draft
issue: 506
---

# Design

`verdictsAtHead(priorVerdicts, headSha)` — exported from `lib/parse-verdict.mjs`, one
function, cited by `cli.mjs` (the count) and `poster.mjs` (the lock's sha half).

`gatherColdBoot` gains `doctrine.priorDecisions`, parsed with the existing `parseDecision`
from the **same** `reviews` array. No second fetch, no new verb: `brain:approve` already
posts through `prReviewComment`, so the block is in the list cold boot reads.

`buildVerdict` gains `rulingAtHead = false`. It guards only `boundHit`, never
`unknownCausality`.

## Why the raw list stays unfiltered

`doctrine.priorVerdicts` keeps every verdict. The anti-loop lock needs the **last** one
regardless of head to compare authorship, and a future consumer that wants PR-lifetime data
should not have to re-fetch. The filtering is applied where the question is asked, and the
question is named.

## Red-proof

The ticket named the gap: *every existing test of the bound drives `priorRevCount` directly
rather than deriving it from a review list, so none of them exercises the counting rule at
all.* These derive it — a review list goes through `gatherColdBoot` and the count comes out
the other end. A fixture at `priorRevCount = 0` cannot see this defect; the whole of it
lives at `>= 3`.
