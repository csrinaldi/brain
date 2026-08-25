---
status: draft
issue: 682
---

# Design — where the challenger is constructed, and the boundary it must not cross twice

The ruling (`proposal.md`, `spec.md`) decided **which** axis. This decides **where
the code goes**, and it is dominated by one constraint the ruling did not see:
the thing #682 needs to build already has a designated home, and that home is
unbuilt.

## Measure first

Taken on `feature/issue-682` @ `df4cb4b`, not recalled.

| question | answer | evidence |
|---|---|---|
| Does brain call a model anywhere today? | **No.** | The only outbound call in the tree is `gitlabApiFetch` (forge API). `brain/scripts/review/` shells out to `git` and nothing else. |
| Is there an injection point for the challenger? | **Yes, already.** | `cli.mjs:510` passes `runner: deps.refuterRunner ?? null` into `applyCausalAdmission` → `evaluateRefuter`. |
| Do evaluators run together or one per mode? | **One per mode**, but the controls seam is plural. | `deriveMode()` picks `tranche` \| `checkpoint` \| `ruling`; each branch sets `controls = unionControls([X_PRODUCES])` — a one-element array in a function that takes many. |
| Does an SDD role port exist? | **No.** | `brain/roles/` does not exist; `harness/cli.mjs:99` is `export const VALID_OPS = ['init'];`. Measured by #599 — not re-measured here. |
| What counts against `diff-size`? | Production code only. | `governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`. At `lite`, 1000 lines of production code. |

## Decision 1 — the producer is an ADDITIVE evaluator, not a fourth mode

`deriveMode()` returns one of three modes and each branch selects one evaluator.
The inferential producer is not a fourth peer: judgment applies **to** a tranche,
a checkpoint or a ruling review, not instead of one.

So the producer runs alongside the mode's evaluator and its findings merge:

```js
controls = unionControls([TRANCHE_PRODUCES, INFERENTIAL_PRODUCES]);
```

`unionControls` already takes an array and has only ever been handed one element.
That plural signature is the affordance left for this, and `controls.mjs` says so
in its own header — *"a judgment evaluator declares `inferential`, and the day it
runs the verdict says so by itself."*

**CORRECTED — the first version of this decision said REQ-682-3's declaration
"needs no new plumbing: declaring `PRODUCES = ['inferential']` is the whole of
it". That is FALSE, and it was false when written.** A cold review measured it:
`CONTROL_CLASSES` is frozen to `['deterministic', 'inferential']` and
`unionControls` THROWS on anything else, so the controls union cannot carry an
axis name at all. Two verdicts challenged by different axes rendered
byte-identically — the exact rendering REQ-682-3 forbids.

**`PRODUCES` delivers the CONTROLS declaration (#683's field). The AXIS is a
separate field and needed its own plumbing**: a `challenger_axis` line in
`renderVerdict`, a reader and a `TOP_LEVEL_KEYS` entry in `parseVerdict` —
without the latter it terminated nothing and swallowed the whole findings list
when placed after it — and a fix to the drift guard's fixture, which was blind
because it never set `judgmentAxis`.

A control class says WHICH KIND of control ran. The axis says WHAT CHALLENGED
the reasoned findings. One vocabulary does not carry the other, and reading the
sentence above as if it did is what shipped REQ-682-3 unimplemented while a PR
body claimed it delivered.

**Rejected:** a `judgment` mode. It would make judgment exclusive with the
mechanical review rather than additive, and #575 Ruling 3 rules that the two
halves join, not alternate.

## Decision 2 — the challenger is a RESOLVER, and it is provisional by construction

This is the decision the maintainer flagged, and it is the important one.

`reviewer.inferential.challenger.{axis, agent, model}` binds **a role** (the
refuter) to **an agent** and **a model** through **`brain.config.json`**. That is,
respectively, #312's port, #576's archetypes and #323's config map — three open,
approved tickets whose entire subject is that binding.

Building it inside the reviewer would give brain a second way to bind a role to
an engine, in the component that is already the weakest axis of the audit, while
the designated home sits at zero implementation. #323's stated problem is that
the swappable-engine claim *"is true for bootstrap and false for everything the
developer actually does"*. A reviewer-local binding adds an entry to that list.

**And #682 cannot wait for M5.** #599 measured M5 at zero, M8 depends on M5, and
the chain has gone untouched across four handoff cuts. Blocking #682 behind it
trades one stalled ticket for two.

**So: one function, declared provisional.**

```
brain/scripts/review/lib/resolve-challenger.mjs

  resolveChallenger({ config, tier }) → runner | null
```

It resolves the axis (REQ-682-1), refuses an unrecognised one, returns `null`
when the producer is off (REQ-682-2), and constructs the runner the existing
`refuterRunner` dep already expects. **It invents no port.** `refuterRunner` is
already an injection point — `cli.mjs:510` has passed it since #552 — so the
seam exists at the function level and this only supplies its constructor.

### The boundary debt, recorded against #312

> **`resolveChallenger`'s agent/model binding is a provisional inhabitant of
> #312's role port.** When #312 lands, the binding half of this function is
> deleted and `resolveChallenger` becomes a caller of the port, keeping only the
> axis resolution — which is reviewer policy and belongs here either way.

Recorded here rather than left implicit because #323 exists precisely because
the previous instance of this shape was never written down. The debt is one
function's binding half, not an architecture, and it is bounded by the tickets
that absorb it: **#312** (the port), then **#576** (the role set).

**Rejected — #682 waits for #312/#576.** Correct boundary, zero debt, and it
blocks the reviewer's largest item behind a chain at zero implementation. The
maintainer ruled for the resolver with the debt recorded.

**Rejected — a full binding inside the reviewer.** Unblocks identically and
creates the second offender M8 exists to remove.

## Decision 3 — the axis is resolved once, upstream of the runner

`resolveChallenger` returns a runner already bound to its axis; the runner does
not re-read config. Two reasons, and the second is the one that matters:

1. `evaluateRefuter`'s contract takes a function, not a policy object. Widening
   it to carry config would put policy inside the evaluator that #552 just
   finished making honest.
2. **The verdict must declare the axis that actually ran.** If the runner
   resolved its own axis per call, the declared value and the used value could
   diverge, and #683's rule is that a verdict whose self-description is false
   must not be posted at all. One resolution, one declared value, no gap.

## Decision 4 — `routed:human` is an outcome, not the absence of a runner

REQ-682-6. When the axis is `human`, `resolveChallenger` returns a runner that
marks each inferential blocker with an outcome distinct from `unchallenged` and
escalates — **not** `null`.

Returning `null` would be the cheap implementation and it is wrong: `null` means
*"nothing was available to challenge this"*, and rendering "a human challenges
this by design" identically to that re-folds the two states #552 unfolded. This
axis is the one most likely to be implemented by returning `null`, which is why
it gets its own decision rather than a line in the spec.

## Decision 5 — no model transport is chosen here

The measurement says brain has no outbound model machinery at all. Which
transport `same-model` and `cross-family` use — an SDK, a spawned agent CLI, or
the harness — is a **separate decision with its own ADR**, and it is where
#682's network, credential and determinism costs actually land.

This design fixes the *shape*: `resolveChallenger` returns a function matching
`runner(inferentialBlockers) → { outcomes }`. Everything behind that signature is
transport and is decided in the ADR, not here. Fixing the shape first is what
lets the producer, the declaration and the `human` axis land and be tested with
no network at all.

## Decision 6 — the producer emits findings, never its reasoning

REQ-682-4 does not enforce itself, so the design places the constraint where it
can be tested: the producer's finding objects carry claim, location and
evidence, and the challenger receives exactly the finding objects. There is no
side channel from producer to challenger — not a shared context object, not an
extra field, not a log the challenger reads.

A test asserts the challenger's input is a subset of what the verdict renders:
if the challenger can see something a reader of the verdict cannot, the boundary
has already leaked.

## Slice boundaries

`diff-size` at `lite` budgets 1000 production lines, and tests and
`openspec/changes/**` are excluded — so these slices are sized by review
attention, not by the gate. They merge into `feature/issue-682`; only the
tracker merges to `main`, which is how #682's *"producer and challenger land
together"* is honoured while the work stays reviewable.

| slice | contents | lands with |
|---|---|---|
| 1 | `resolveChallenger` + tier/config resolution + the `human` axis end to end | REQ-682-1, -2, -6 |
| 2 | the inferential producer, `PRODUCES = ['inferential']`, additive wiring, the controls declaration | REQ-682-4 (and #683's controls union, NOT REQ-682-3) |
| 3 | the ADR for the model transport, then the `same-model` runner behind it | REQ-682-5 and Decision 5 |

Slice 1 ships a challenger with **no network and no credential** — the `human`
axis is fully functional on its own, and it is the axis that makes the producer
in slice 2 safe to turn on. That ordering is deliberate: at no point does a
reasoned finding exist without something to challenge it.

**The ADR precedes the code that cites it, on the same branch.** The
`adr-citations` gate refuses code citing a draft, so slice 3 promotes the ADR
first and cites it second.

## Two requirements this decomposition DROPPED

A cold review found both, and the pattern matters more than either: **a
requirement can be written into `spec.md` and covered by no task, and nothing in
this repo checks the correspondence.** Twice out of six.

**REQ-682-3 — the axis on the wire.** Assigned to slice 2 by the table above and
delivered by nothing: `resolveAxis`'s value was consumed as a boolean and
discarded. It landed in the correction slice, and the table now says so.

**REQ-682-5 — `convergence.maxRounds` as a key separate from the challenger.**
It appears exactly once, in a slice-3 table cell, and no decision addresses it.
Slice 3's tasks touch the ADR, the promotion, the runner, the negative case, the
e2e and the cross-family refusal — **zero config keys** — while the config work
belongs to slice 1. Measured: `rg 'maxRounds'` finds it in no production file.

Neither is rehomed here by fiat. Naming them as unassigned is the honest state;
assigning them is a planning decision.

## What this design does not decide

- The producer's prompt, its finding taxonomy beyond `level`, or its model.
- The four launch scenarios — subagent, headless CLI, CI, MCP. Orthogonal per
  the ruling, and a separate distribution ticket.
- Anything about M5's port shape. This design consumes whatever #312 lands; it
  does not propose it.
