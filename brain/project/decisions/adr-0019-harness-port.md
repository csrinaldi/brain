# ADR-0019 — The `SDD_HARNESS` port: four environment surfaces, artifacts neutral by design

**Status**: Accepted
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
  contract.
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
