# ADR-0019 — The `SDD_HARNESS` port: four environment surfaces, artifacts neutral by design

**Status**: Accepted · **amended 31/08/2026** (Amendments 1-2 — see below)
**Date**: 2026-07-12 — Cristian Rinaldi (proposed + accepted via #250 / B0; promoted with #253 / B1)

## Context

The contract inventory (#584) measured `harness/cli.mjs`'s actual shape: `VALID_OPS =
['init']` — the dispatcher routes exactly one operation. `gentle-ai.mjs`, the only
harness implemented until now, exports only `_toEngramProject()` and `init()`. Every
piece of SDD artifact work — scaffold (`new-change.mjs`), phase-order
(`phase-order-check.mjs`), verify (`brain:change:verify`), memory
(`feature-resume`/`feature-checkpoint`) — is a single, harness-neutral implementation
that is **not** routed through the `SDD_HARNESS` dispatcher at all. The owner ruled
this is design truth (#585), not an accident to "fix" by expanding `VALID_OPS`.

Read at face value, a single-op dispatcher looks unfinished — like a port that only
grew one leg. This ADR states why that reading is wrong: the thinness is the design.

## Decision

> The `SDD_HARNESS` port is the boundary through which a backend owns exactly four
> surfaces of the development environment — and NOTHING in the SDD artifact lifecycle:
> (1) Instructions, (2) Bootstrap, (3) Memory, (4) Capabilities. Today that boundary is
> carried by a single operation (`init`); new operations may be added only when they
> serve one of the four surfaces. Everything downstream — scaffold, phase-order,
> verify, archive — is harness-neutral and runs identically regardless of
> `SDD_HARNESS`. The canonical `openspec/` layout is the fixed evidence contract;
> harnesses normalize INTO it, they never reshape it.

### The four surfaces are the norm, not the op count

**Instructions, Bootstrap, Memory, Capabilities** are the invariant a backend is
judged against — the norm. The single-`init`-op surface is current **state**, not a
ceiling: a legitimate future op (e.g. a doctor check, an explicit memory-wire step) is
permitted the moment it serves one of the four surfaces, and forbidden the moment it
would carry artifact-lifecycle logic instead.

## Rationale

This is Track A's split — pure evaluators plus thin, injectable provider wrappers —
applied to the **executor** side of the system instead of the evaluator side: the
harness is the thin wrapper; the SDD artifacts and the gates that read them
(phase-order, diff-size, decision-gate, ...) are the pure, neutral core. Track A proved
this split keeps a gate provider-agnostic without inflating its surface; the same
reasoning holds here — a harness-agnostic core is what let B0 ship a second `init`
inhabitant (`plain.mjs`) with zero changes to `cli.mjs`, `new-change.mjs`,
`phase-order-check.mjs`, or any gate.

## Consequences

- New `SDD_HARNESS` ops are legitimate **only** when they serve one of the four
  surfaces — never to carry scaffold/verify/archive logic per-backend.
- The neutral core (scaffold, phase-order, verify, memory) runs identically under any
  backend, present or future.
- `openspec/`'s canonical layout (`sdd-layout.md`) is the fixed evidence contract every
  harness normalizes into; no harness may reshape it.
- `plain` + `gentle-ai` together prove n=2 on `init` ahead of B2's real second-AI-harness
  baptism (the Antigravity adapter, #247 candidate slice).

## Rejected alternatives

- **Expand `VALID_OPS` to route scaffold/verify/archive per-backend.** Rejected: it
  inflates the port and directly contradicts the neutral-by-design finding (#585) —
  the SDD artifact lifecycle would fork per harness instead of staying one evidence
  contract. **[Amended by Amendment 1 (#323) — what this rejects is a FORKED LAYOUT,
  not a routed producer. Routing which engine WRITES an artefact, while the path, the
  filename and every shared reader stay one, does not fork the contract. See the
  amendment for the four conditions that keep that true.]**
- **Treat the single-`init`-op surface as the normative ceiling.** Rejected: it would
  force a future legitimate surface op (e.g. a doctor check, a memory-wire step) to
  require an ADR amendment for something the four surfaces already permit by design —
  the four surfaces are the invariant, the op count is just today's state.

## Evidence

- #584 (contract inventory measurement), #585 (owner ruling: thinness is design
  truth), #587 (B0 design ruling: frontier approved, ADR number verified).
- `brain/scripts/harness/cli.mjs:52` (`VALID_OPS = ['init']`).
- `brain/scripts/harness/backends/gentle-ai.mjs:74,221` (`_toEngramProject()`,
  `init()`'s injectable-opts shape).

## Amendment 1 — the invariant is the artefact contract, not the op count (issue #323)

**Signed**: 28/08/2026 — Cristian Rinaldi

### What changed

Nothing in the decision. The first rejected alternative is annotated to say what it was
rejecting, because M8's stage → engine router (#323) reads as if it were covered by it and
it is not.

The rejected alternative and the router differ on the one thing the rejection was about:

| | the rejected alternative | M8's router |
|---|---|---|
| who writes `spec.md` | a per-backend `scaffold` op | an engine named in `sdd.map` |
| **where it lands** | **per harness** | `openspec/changes/issue-<id>-<slug>/spec.md` |
| **what a gate must know** | **which harness produced this change** | nothing |

The rejection's own words name the harm: *"the SDD artifact lifecycle would **fork per
harness** instead of staying one evidence contract."* A fork is the second column. Routing
the producer is not a fork as long as the third column stays empty.

### Why this is an amendment and not a supersede

ADR-0024:53-55 predicted that per-stage composition *"would require its own ADR superseding
ADR-0019's single-lifecycle decision."* That prediction is stronger than ADR-0019 requires,
and ADR-0019 says so itself two bullets down:

> *"the four surfaces are the invariant, **the op count is just today's state**."*

That second rejected alternative already refused to treat the op surface as a ceiling, and
it has already been exercised: **ADR-0033 grew `VALID_OPS` from `['init']` to
`['init', 'run-stage']`** with no supersede, on exactly this argument. The precedent is in
`main`.

So what remains genuinely undecided is narrower than the prediction assumed: not whether the
port may grow, but whether the four stages that produce **the artefacts the shared readers
probe** may be routed. This amendment rules that they may, under conditions — and names them,
because a permission without conditions is the fork this bullet rejected.

### What the evidence contract actually is, said once so the conditions have a referent

It is not the methodology and it is not a stage count. It is a map from artefact name to
path, plus the readers that trust it:

```
sdd-layout.mjs  ARTEFACT_FILE = { proposal: 'proposal.md', spec: 'spec.md',
                                  design: 'design.md',     tasks: 'tasks.md',
                                  verification: 'verify-report.md' }
sdd-layout.mjs  artifactPaths()   openspec/changes/issue-<id>-<slug>/<file>
```

Ten production modules import that layout, eighteen counting tests. Three of them are gates on every pull request —
`phase-order-check.mjs:131` fails a PR for a missing artefact, `review/evaluators/checkpoint.mjs:106`
cites `REQUIRED_ARTIFACTS` as doctrine, and `check-refs.mjs` validates references inside the
files. **None of them asks an engine where anything is.**

`artefactFiles()` throws on a name it does not know rather than appending `.md`, and says
why: *"Appending `.md` would invent a path no gate probes (#555)."* **A file no shared reader
probes is not evidence — it is a file.** That sentence is the whole test, and it is what the
conditions below operationalise.

### The four conditions under which a lifecycle stage may be routed

1. **One layout, and it stays `sdd-layout.mjs`.** An engine normalises INTO the contract; no
   engine may reshape it, add a root, or rename a file. The accessor stays the single one.
2. **Verification stays neutral.** Routing decides who PRODUCES. Who VERIFIES —
   `phase-order`, the checkpoint evaluator, `check-refs`, `change:archive` — stays shared and
   engine-blind. The moment a shared reader needs to know which engine produced a change, the
   contract has forked and this amendment does not authorise it.
3. **A routed stage is indistinguishable at the boundary.** The artefact a routed engine
   writes must satisfy the same readers as one written by any other, including the default.
   This is a testable property, not a promise: the same change dir, produced by two engines,
   passes the same gates.
4. **The refusal is replaced, not removed.** `stage-engine.mjs`'s `assertRoutableStage`
   refuses the four today, and that refusal is what has been holding conditions 1–3 true.
   Lifting it requires putting the conditions somewhere a reader enforces them — a check, not
   a comment. **This is the load-bearing condition: everything above is doctrine until
   something refuses on its behalf.**

### What this amendment does NOT authorise

**A new artefact joining the contract.** Declaring additional stages is already permitted and
already done — `cold-review` is a fifth stage, routed in `sdd.map`, and it landed without this
gate because it writes to its own root (`openspec/reviews/pr-<n>/cold-review.md`,
`findings-artifact.mjs:180,201`), gitignored, read only by its own chain. Nothing shared learned
anything.

A stage that writes INTO `openspec/changes/**` and expects the shared readers to find it is a
different act: it changes what the gates demand. That is **#456**'s question (stage-set
configurability), not this one, and it is not authorised here.

**A forked verifier.** Condition 2 is not a preference. If verification forks per engine, every
gate has to learn N shapes and the evidence contract is gone — which is precisely what the
bullet above rejects and continues to reject.

## Amendment 2 — the citations, corrected to symbols (issue #456)

**Signed**: 31/08/2026 — Cristian Rinaldi

### What changed

Three citation defects in Amendment 1's *"What the evidence contract actually
is"* section. The rulings above them are untouched.

1. **`ARTEFACT_FILE` was quoted with four entries.** The tree has **five** —
   `verification: 'verify-report.md'` was already there when Amendment 1 was
   written and was left out of the quoted block. The section's whole purpose is
   to say *once* what the evidence contract is, so a short quotation of it is
   the one error that matters most there.

2. **"Twelve modules import that layout" was never true.** Measured during
   #456: **ten** production modules import `sdd-layout.mjs`, eighteen counting
   test files. Twelve is neither number.

3. **Both citations named line numbers.** `sdd-layout.mjs:28-32` and
   `sdd-layout.mjs:96-99`. They now name symbols — `ARTEFACT_FILE` and
   `artifactPaths()`.

### Why line numbers, specifically, are the defect that reproduces

`reviewer-protocol.md` §2 already carries this rule and the incident behind it
(#580): a doctrine citation pointed at a source line that, within one release
cycle, had become an unrelated JSDoc block while the mechanism moved elsewhere.
A doctrine that points at a moving target sends its own verifier to the wrong
text.

Amendment 1 cited line numbers anyway, and #456 slice A is precisely the change
that would have invalidated them: `LIFECYCLE_STAGES` and `resolveStageSet` land
above `ARTEFACT_FILE` in that file, pushing every cited line down. The rule and
the violation are eleven days apart in the same repository.

### Why this is an amendment and not an edit

ADR-0019 is signed. A correction to a signed artefact is a new, numbered,
signed act — the same reasoning `memory-format.md` applies to durable records,
where corrections are new records carrying `supersedes` rather than mutations
of the original.

This draft was first written as a prose note proposing a direct edit. The
promotion verb refused it — an ADR target requires `amendment: N`, a
`home-summary` for the `brain/HOME.md` index, and a `body`. The refusal was
right and the note was wrong: it is what turned an unnumbered edit into this
amendment.
