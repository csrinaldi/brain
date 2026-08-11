---
status: draft
issue: 408
---

# Design

## Where it sits, and why not in the evaluators

`tranche`/`checkpoint`/`ruling` are pure and tier-unaware by design (`causal-admission.mjs`'s
own note: *"they answer what is wrong with this candidate, never which protocol this repo is
on"*). A base comparison spawns git and runs commands — putting it inside an evaluator would
give three of them an I/O seam each, and three places for the discipline to drift.

So it lives at the same convergence point the annotation already uses, and the pipeline becomes
**annotate → classify against base → refute**. That order is load-bearing: the refuter forks on
BLOCKERS, and a finding reclassified to `pre-existing` is on its way out of the blocking set —
refuting it would be challenging a finding that no longer blocks anything.

## Why the obvious design was abandoned, in one line

A comparator reading base's check-run rollup would have been smaller, cheaper and **inert**:
`governance.yml` is `pull_request`-only, so no governance gate exists on a base commit. Measured
before writing, which is the only reason it is not in this PR.

## The base-reproducible set is data, and it has one entry

`BASE_REPRODUCIBLE_GATES = ['local-checks']`. Seven of the eight required jobs are diff- or
PR-scoped by construction. The list being short is the measurement, not a stub — and it is
asserted, so widening it forces a reader back through the reasoning.

## The command list mirrors the workflow, condition included

`commandsFor` re-derives `governance.yml`'s `local-checks` steps, including
`if: hashFiles('.brain-source') != ''`. Two reasons, and only one is cost:

- **Honesty.** A probe claiming "the gate fails at base" must run what the gate runs. Running
  the suite where the gate skips it answers a question nobody asked.
- **Cost.** A consumer's probe is two fast node scripts. Only brain's own repo pays for the
  suite, and only when `local-checks` is already red.

The marker is read from the **base worktree**, not from cwd: whether a tree is a brain source
checkout is a property of the tree being probed.

## Three states, and the middle one is the whole point

| probe | verdict for a `gate:local-checks` blocker |
|---|---|
| red at base | `pre-existing` → `follow_ups[]`, stops blocking |
| green at base | `introduced` → keeps blocking, this change broke it |
| could not run | `introduced` → keeps blocking, and the inability is a condition |

The third is where an implementation goes wrong by having two states. `unknown` is the tempting
answer and it is the wrong one: it forces `STOP` + `escalate: human` per finding, so an infra
failure would summon a human on every review.

## Red-proof

Six mutations, each a plausible implementation. All RED.

| | mutation | result |
|---|---|---|
| M1 | drop the no-base-sha guard (the worktree add would fail anyway) | **1 RED** |
| M2 | classify every gate finding as `pre-existing` | **2 RED** |
| M3 | probe on editorial findings too (drop the laziness rule) | **1 RED** |
| M4 | replace the evidence instead of extending it | **1 RED** |
| M5 | uncomputable becomes `unknown` | **2 RED** |
| M6 | always run the suite, ignoring `.brain-source` | **2 RED** |

**M1 survived the first pass and the test was wrong, not the code.** Asserting only the `null`
return passed either way — without the guard, the worktree add fails and the catch returns
`null` too. What the guard actually buys is that a review with no resolvable base never spawns
git at all, so that is what the test now asserts. The same shape as #533's surviving mutation:
an assertion on the outcome where the property was about the path.
