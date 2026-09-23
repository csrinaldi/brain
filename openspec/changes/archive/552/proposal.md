---
status: draft
issue: 552
---

# Proposal — rule on the inferential producer, and close the fail-open it rests on (issue 552)

## What

The ruling #552 asks for, plus the one thing that ruling turns out to require
before any producer can be built: **the refuter stops failing open.**

No producer is built. No model is called. Nothing about the reviewer's
network surface, credentials or determinism changes.

## Why

#552 asks whether to build a reasoning evaluator (a), a narrow
deterministic-but-uncertain producer (b), or neither — and recommended
*neither, until (a) has a reason to exist that is not "a fork is unreachable"*.

**The reason now exists**, supplied by four cold reviews run by hand on
2026-08-15 that found real defects — a control that causes the condition it then
misdiagnoses, a flag whose value silently inverted its meaning, a refusal with a
correct verdict and an invented cause — none of them reachable by a rollup, a
numstat, a regex or a base re-run. Three of the four were in the reviewer's own
machinery.

**And the safety net was not real.** Measured while ruling: `cli.mjs` passes
`runner: deps.refuterRunner ?? null` and that dep is a test-side injection, so
the refuter has never run in production. Its early return folded *"nothing to
challenge"* and *"nothing to challenge it with"* into one silent state, and
`refuter_outcome` was never rendered — so a reasoned blocker nobody examined and
one the refuter had upheld rendered **byte-identically**.

That is the `evidence-reader-empty-on-failure` family inside the component whose
job is to be the check on judgment. It is unreachable today, which is precisely
why it had to be closed **before** a producer exists rather than after.

## The ruling

**(a), and not built here.** A reasoning evaluator is worth building; it may not
ship until the refuter can actually run.

**(b) refused**, for #408's own reason: `insufficient` and `inferential` are
different words and only one means *reasoned*.

## Cost

Of the ruling: a network dependency, a second credential #604's negative control
does not cover, non-determinism in a merge-gating verdict, and the refuter work
that must land first.

Of **this change**: one condition and one escalation that fire on a finding
class nothing currently produces — so it lands green and inert across the whole
suite, which is also the honest test that it is wired rather than decorative.

## What this is not

Not a producer, and not a decision to open one. The producer is the largest item
in the reviewer's roadmap and must not be scoped by the agent that just ruled on
it — the self-certification hazard ADR-0031 names, one layer up.
