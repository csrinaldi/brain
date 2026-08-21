# ADR-0033 — The cold review runs as a spawned subagent: the transport is a stage engine, and the producer never holds a credential

> **status:** proposed — pending human promotion | **date:** 2026-08-21 | **owner:** @crinaldi

## Context

`brain:review`'s judgment half is built and unreachable. `evaluateInferential`,
`evaluateRefuter`, `resolveJudgment` and `buildVerdict` all exist and are tested;
`gatherInferentialInputs` exposes `deps.generate` as the seam that would feed them. Two
measurements on `main @ 005dc35`:

```
grep -c 'deps.generate' brain/scripts/review/cli.mjs   → 0 production callers
grep -n  'VALID_OPS'    brain/scripts/harness/cli.mjs  → VALID_OPS = ['init']
```

`main()` is invoked with no arguments, so `inferentialDeps` is reachable only from tests.
The seam exists; nothing can enter it.

`inferential.mjs` refuses to pick a transport and says why:

> *"There is no production default and this file will not invent one: slice 3's ADR
> decides whether it is an SDK call, a spawned agent, or the harness, and that decision
> changes the reviewer's network, credential and determinism surface."*

This ADR is that decision.

It arrives with two constraints that are facts rather than preferences. The maintainer
has **no API access**, so an SDK call is not implementable today. And M5 and M8 are being
built on one premise — *a stage, an engine, and a model, all declared* — so a transport
that is not shaped like a stage engine is a second mechanism that M8 would have to
absorb or fight.

## Decision

**The cold review is an SDD stage. Its engine is a subagent spawned through the harness
port. Its output is a file. Only `brain:review` touches the forge.**

Four parts, and each is separable:

1. **Resolution.** `sdd.map['cold-review'] → { engine, model }`. `model` is a
   pass-through: brain does not interpret it, validate it against a catalogue, or map it
   to a tier. This is #323's already-ruled shape for M8's router; the cold review is its
   first inhabitant rather than a second opinion.
2. **Execution.** The orchestrator spawns the engine through the harness with a prompt
   and a model. The harness gains one op.
3. **Output.** The engine writes `openspec/reviews/pr-NNN/cold-review.md`, carrying a
   ` ```brain-findings/1 ` block. It is written, never committed by the run.
4. **Projection.** `brain:review` reads that file, merges its findings into the existing
   pipeline, challenges them, builds the verdict, and posts — the fenced block plus
   inline comments on the changed lines.

### Why the producer holds no credential, stated as the property it buys

The subagent reads a cold worktree and writes a file. It opens no connection to the
forge, holds no token, and posts nothing.

This is the load-bearing half. `reviewer-protocol.md` §2's three structural locks —
COMMENT-only state, no approve verb in the port, the two-key split — all live in the
poster. A producer that posted would need each lock re-proved on a second surface, and
the credential that surface requires is the one #604 proved cannot be trusted where the
environment injects it. That was not theoretical: four consecutive cold reviews of this
ticket's own PRs hit it, and two of them could not produce a verdict at all.

Keeping the producer credential-free means the identity problem cannot reappear on the
new path, by construction rather than by care.

### Why growing `VALID_OPS` needs no supersede

ADR-0024 predicts that a `stage → engine` map *"would require its own ADR superseding
ADR-0019's single-lifecycle decision"*. ADR-0019's own rejected alternatives say
otherwise, and the second one is never cited:

> *"Treat the single-`init`-op surface as the normative ceiling. **Rejected**: … the four
> surfaces are the invariant, **the op count is just today's state**."*

Adding an op is permitted. What ADR-0019 forbids is the **SDD artifact lifecycle**
forking per harness — `proposal / spec / design / tasks` produced differently depending
on the backend. `cold-review` produces none of those. Its artifact is consumed by
`brain:review` and by a human reading a PR, not by `phase-order` or `change:archive`.

So this ADR decides a transport and supersedes nothing. The question ADR-0024 was
actually warning about — routing a stage that *does* produce one of the four — is M8's,
and is still ahead.

## Consequences

**Determinism.** Two runs of the same stage over the same tree may differ. The verdict
already carries the vocabulary for this: `evidence_class: inferential` marks a finding as
reasoned rather than observed, and the refuter exists because a reasoned finding must be
challengeable. What changes is that the vocabulary stops being decorative.

**Network.** The reviewer gains a dependency on whatever the engine talks to. It is the
engine's dependency, not brain's: brain spawns a process and reads a file. A failed spawn
is a failure, not an empty finding list — `cli.mjs` already refuses to post rather than
render a green judgment half over nothing.

**Cost.** A review now costs a model run. It is per-PR and visible, and nothing forces it
on a repo that has not declared the map entry.

**The condition disappears.** Every verdict currently carries *"the judgment half is
enabled but no transport is configured"*. This ADR is what retires that sentence, and a
test pins it so the day it goes false is a day a test says so.

## Rejected alternatives

- **An SDK call from inside `brain:review`.** Rejected: not implementable — no API
  access. It also puts a vendor credential in the reviewer's own environment, which is
  the surface #604 measured as untrustworthy, and makes brain a client of a specific
  vendor rather than of a harness it already abstracts.
- **A transport specific to the reviewer, outside the stage/engine shape.** Rejected: it
  is a second mechanism answering the question M8 exists to answer. The reviewer would
  become the one consumer M8's router does not serve.
- **The subagent posts its own findings.** Rejected: §2's locks would need re-proving on
  a second surface, and the producer would need the credential this decision exists to
  avoid. It also collapses two states worth keeping apart — *what was found* and *what
  was published* — into one act.
- **Abstract model tiers (`cheap | balanced | deep`) here.** Rejected *for this layer*, not
  in general: a tier needs a translator to a concrete id, that translator does not exist,
  and building it in the reviewer is the binding M5's role port is meant to own. #323
  already ruled `model` an opaque pass-through in the map.
- **Waiting for M5 and M8.** Rejected: it leaves #682 open for weeks with the judgment
  half on and unable to run in every repo. The provisional-inhabitant pattern is already
  written into `resolve-challenger.mjs`'s header for the challenger binding, and this is
  its second use on the same ticket — with the debt recorded on #312, not only in a
  comment.

## Evidence

- `brain/scripts/review/evaluators/inferential.mjs` — `gatherInferentialInputs`, the DI
  seam and its refusal to invent a default; `CARRIED_FIELDS` and `sanitiseFinding`.
- `brain/scripts/review/poster.mjs` — `deriveInlineComments`, and `postVerdict` riding
  inline comments on the same `prReviewComment` call as the block (#405).
- `brain/scripts/harness/cli.mjs:99` — `VALID_OPS = ['init']`.
- ADR-0019 rejected alternatives 1 and 2 · ADR-0024 lines 53-55 · ADR-0032 / #495 D1
  (the fenced-block family rule).
- #604 (the negative control), and the four cold-review rounds on #758 and #762 that
  measured it in practice.
- #323 (`model` as opaque pass-through) · #456 (the stage set as data) · #576 / #754 (the
  Adversary archetype that takes over the prompt) · #552 (the state a producer without a
  challenger re-creates).
