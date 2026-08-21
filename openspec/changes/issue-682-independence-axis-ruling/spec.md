---
status: draft
issue: 682
---

# Spec — the independence axis, graded by tier and declared on the wire

#682 asks one question and says the answer is the deliverable: **which axis of
independence makes the refuter's challenge real, and what does that axis cost?**
Four were on offer — a different context, a different model family, a mechanical
challenger for a subset, or a human with the reviewer merely routing.

This change answers it. **It builds neither the producer nor the challenger**,
because #682 requires those to land together and the ruling is what they were
waiting on.

---

## Ruling — the axis is the reviewer's, resolved from tier, and declared in every verdict

> **The independence axis is a property of the reviewer, configured per repo and
> graded by tier, and it is declared in every verdict it produces.** The default
> is a challenger in a fresh context — the same model as the launching agent,
> never the same process and never holding the producer's reasoning — because
> that costs one extra model call per reasoned finding and no second vendor
> credential, where a cross-family jury costs a second credential and a second
> price on every run and the human axis costs a person's attention before any
> code is touched.

### Why not bound to the launch scenario

The reviewer can be launched as an SDD-stage subagent, a human `brain:review`
run, a CI job, or an MCP server. Those differ in *transport*, not in evidence:
every one of them can run with `runner: null` and challenge nothing. Binding the
axis to a scenario yields a reviewer honest in one deployment and blind in
another, and a verdict whose reader cannot tell which one produced it.

### Why `same-model` clears #552's bar and `human` is not the default

#552 refuses *"the same process, holding the same context, that produced the
finding"*. A fresh context of the same model, handed the finding and the diff
and never the producer's reasoning, is #682's own first axis and is not that
refusal. Its weakness is named rather than hidden: correlated errors survive,
which is why REQ-682-3 makes the axis visible instead of implied.

`human` remains wired, free and honest, and is opt-in by maintainer ruling: a
reviewer that stops for a person on every reasoned finding cannot run
unattended, and three of the four launch scenarios exist to run unattended.

---

## REQ-682-1 — The axis resolves from config, falling back to tier

`brain.config.json` carries the axis under the existing `reviewer` block, beside
`reviewer.protocol` which is already overridable per repo:

```json
"reviewer": {
  "inferential": { "enabled": null, "level": 2,
                   "challenger": { "axis": "same-model", "agent": null, "model": null } },
  "convergence": { "maxRounds": 2 }
}
```

`null` means *resolve from tier*, the same discipline `resolveTier` /
`tierParams` already apply (`cli.mjs:279`).

- **WHEN** `reviewer.inferential.challenger.axis` is absent or `null`
  **THEN** the axis is `tierParams(tier).challengerAxis`.
- **WHEN** it names one of `human | same-model | cross-family | mechanical`
  **THEN** that value wins over the tier default.
- **WHEN** it names anything else
  **THEN** the run REFUSES and posts nothing — an unrecognised axis is an
  unknown evidentiary strength, and #683's rule is that a verdict whose
  self-description is false must not be posted.

## REQ-682-2 — The inferential producer is OFF at `lite`

- **WHEN** the resolved tier is `lite` and `reviewer.inferential.enabled` is
  absent or `null`
  **THEN** no inferential evaluator runs, no reasoned finding is emitted, no
  challenger is resolved and no model credential is required.

This keeps `lite` at exactly today's behaviour — mechanical controls only,
declared as such since #683/#690 — and it protects a claim
`test/fresh-install/in-container.sh` enforces today:

```
#   1. Install @logikas/brain from the REGISTRY, with no credential
# No credential gate. See the header: needing one was the defect, not the setup.
```

That was #435's exit criterion, shipped 2026-08-18. A `same-model` default at
`lite` would require a model key in a fresh install and falsify it. #682's own
cost table already points here — *"tier — almost certainly not `lite` by
default"*.

Tier defaults:

| tier | producer | challenger axis |
|---|---|---|
| `lite` | off | — |
| `standard` | on | `same-model` |
| `regulated` | on | `cross-family` |

## REQ-682-3 — A verdict declares the axis that challenged its reasoned findings

A configurable axis makes evidentiary strength vary per repo and per run. Two
verdicts must not render identically when one was challenged by the same model
and the other by a different family.

- **WHEN** a verdict carries at least one finding with
  `evidence_class: inferential`
  **THEN** it declares the resolved axis on the wire, beside the controls
  declaration #683/#690 already emit.
- **WHEN** it carries none
  **THEN** it declares nothing new — an axis that challenged nothing is not
  evidence about this verdict, and a constant in the alarm channel is the
  wallpaper #690 refused.

This is #683's rule applied one field over: *a mechanical-only verdict does not
say it is mechanical-only.* A same-model-challenged verdict must not read like a
cross-family-challenged one.

## REQ-682-4 — The producer's output carries no reasoning into the challenger

The runner contract already draws the boundary:

```js
runner(inferentialBlockers) → { outcomes: [{ id, outcome, rationale }] }
```

The challenger receives findings, never the producer's reasoning. The boundary
is real only if the finding object does not smuggle that reasoning through its
own fields.

- **WHEN** the producer emits an inferential finding
  **THEN** its fields carry the claim, the location and the evidence a reader
  needs — and not the producer's chain of thought.

Without this the `same-model` default is self-attestation with extra steps,
which is the shape ADR-0031 and #604 Ruling 3 refuse.

## REQ-682-5 — The round limit and the challenger are separate keys

`convergence.maxRounds` governs whether a fix converges. The challenger governs
whether the finding was true. They are nested apart so no reader treats one as
the other.

The distinction is not cosmetic. In a review→fix loop the fixing agent *complies
with* a finding, it does not test it — so a reasoned finding that is confidently
**wrong** converges fastest: one round, no disagreement, no escalation. The
round limit fires only on non-convergence, so it never sees that case.

- **WHEN** the round limit is exhausted
  **THEN** escalate, as designed — that is the disagreement case.
- **WHEN** a reasoned finding is refuted
  **THEN** its severity drops to `correction` before the verdict is posted, and
  the fixing agent is never asked to comply with it.

The loop catches disagreement. The challenger catches falsehood.

## REQ-682-6 — `unchallenged` and "routed to a human by design" are different states

`refuter_outcome: 'unchallenged'` means *nothing was available to challenge
this*. If the resolved axis is `human`, a person challenges by design, and that
is not the same state.

- **WHEN** the resolved axis is `human`
  **THEN** the finding is marked with an outcome distinct from `unchallenged`,
  and the verdict says a human challenge is pending by configuration rather
  than missing by accident.

Rendering both as `unchallenged` re-folds two states into one — the exact defect
#552 unfolded, one layer up, and this time produced by a configuration option.

---

## What ships here

The ruling, and nothing else. No producer, no challenger, no model call, no
change to the reviewer's network, credential or determinism surface.

REQ-682-1 through REQ-682-6 are normative constraints on the implementation
ticket that follows. They are recorded here because #682's acceptance requires
the ruling *before any code*, and a ruling whose constraints live only in a
conversation is the artefact this repository keeps finding thrown away.

## What this change does NOT decide

- The producer's finding taxonomy beyond the `level` key's existence.
- The four launch scenarios — subagent, headless CLI, CI, MCP. Those are a
  distribution ticket and are orthogonal to this ruling by REQ-682-1's argument.
- Any backfill.

## Open for the maintainer

1. **REQ-682-2** is the one requirement the maintainer did not ask for.
   Rejecting it means accepting a model credential in a fresh install, and
   `test/fresh-install/` changes with it.
2. Whether `regulated` earns `cross-family` by default, or whether that too
   should be opt-in.
