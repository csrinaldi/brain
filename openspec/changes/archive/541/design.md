---
status: draft
issue: 541
---

# Design

## Why a counter and not a guard

The acceptance offers "a guard that fails when an observation without a block reaches
`exportObservation`". Failing is the wrong verb **today**: 2070 of 2163 observations in this
repository would trip it, so `share` becomes unusable and the fix is measured in how quickly
someone stops running it. #529's ruling refused the identical shape for `memory-gate` — tightening
before the writer is reliable blocks everything with no override.

A count that appears on every share is the strongest honest instrument while the emitter does not
exist: it converts *"the emitter was never built"* from something you learn by reading two
thousand records into a number printed at the point of use.

## The flag was already there

`exportObservation` returns `{ record, recovered }`. The share loop destructured `record` and
discarded `recovered`. So the fallback — `@legacy`, no `issue` — was applied silently and produced
a record indistinguishable from a healthy one. The change is two lines; the finding is that the
evidence existed and nothing read it.

## Red-proof

| mutant | the lie it would tell | red |
|---|---|---|
| M1 the flag is discarded again | the defect returns exactly as it was | 2 |
| M2 the counter is a constant | a number that always fires measures nothing | 1 |
| M3 the count never reaches the accounting | measured and unreportable | 5 |
| M4 an unprovenanced observation is rejected | the gate #529 warned against, arriving early | 12 |

M2 is the one worth naming: without the compliant-observation counterweight, a counter hardwired
to `+= 1` passes the first test. Two fixtures that differ in exactly the thing under test is the
same N≥2 discipline `identity-binding.test.mjs` states in its header.

## A fixture detail that cost a cycle

engram's `created_at` is naive (`'2026-08-11 10:00:00'`), not ISO-with-Z. An ISO string throws in
`toUtcSeconds`, and the observation lands in `errored` rather than the bucket under test — a
green-looking failure that measures the wrong thing. The fixtures now use the shape every other
test in that file uses, and say why.

Full suite: **3044 tests, 0 failures**.
