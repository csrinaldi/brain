# ADR-0023 — The SDD role port: per-action executor role as a contract, n=2 by parity

**Status**: Draft (not ratified — queued behind the v2.0.0 → main merge)
**Date**: 2026-07-24 — proposed by Cristian Rinaldi
**Extends**: [ADR-0019](../project/decisions/adr-0019-harness-port.md) (does NOT supersede)

## Context

The v2.0.0 merge audit found that brain's "agent-neutral" claim is, today, n=1. Two of
brain's three swappable axes are real ports with two inhabitants forced to parity by a
test:

- **VCS**: verb contract + `github`/`gitlab` providers, `vcs.contract.test.mjs`.
- **Memory**: op-surface + `engram`/`plainfiles` backends, round-trip integration tests.

The **role/executor axis is the exception**. ADR-0019 correctly keeps the SDD artifact
lifecycle harness-neutral (one evidence contract), and rules that per-action executor
identity lives under the harness port's *Capabilities / Instructions* surface. But that
surface is only ever inhabited by **one** real implementation — `gentle-ai` — which
carries the per-action agent roles (model tier, tools, reads/writes for
`sdd-explore … sdd-archive`). The `plain` engine implements only `init`. So a project
adopting brain has exactly one way to get per-phase roles: adopt gentle-ai. "Swappable"
is asserted, not demonstrated, on this axis.

ADR-0019's own closing consequence anticipated this: *"`plain` + `gentle-ai` together
prove n=2 on `init`"* — but n=2 on `init` is not n=2 on **roles**. This ADR closes that
specific gap.

## Decision

> The **per-action executor role** is an explicit port contract, not a harness-private
> detail. A role declares, for each SDD action, a normalized shape —
> `{ action, model_tier, tools, reads, writes }` — and brain owns that contract the same
> way it owns the VCS verb contract and the memory op-surface. Two inhabitants must
> implement it and be held to parity by a contract test: `gentle-ai` (the existing
> rich roles) and `plain` (a minimal, real, first-party-neutral role set — NOT a stub).
> The SDD artifact lifecycle stays neutral exactly as ADR-0019 requires: roles govern
> *how* an action is executed, never *what artifact* it must produce.

This is the **first step (C)** of a two-step direction. A later step **(B)** may ship a
richer first-party reference role set authored by brain; when it does, B is simply a
third implementer of *this* port, not a replacement for it. C is therefore non-throwaway:
it is the interface B plugs into.

## Rationale

- Mirrors the two patterns already proven in-repo (VCS port, memory port): a contract +
  ≥2 inhabitants + a parity test. Nothing novel in the mechanism, only in the axis it
  is applied to.
- Turns "agent-neutral" from aspiration into something a test enforces.
- Preserves ADR-0019's core invariant: artifacts remain one neutral evidence contract;
  only the *execution role* becomes explicitly pluggable.

## Consequences

- The `plain` SDD engine must implement the role port **for real** (a minimal but honest
  per-action role set), not merely `init` — this is the concrete work that makes C n=2.
- A new contract test forces both engines to declare a role for every SDD action, the
  way `vcs.contract.test.mjs` forces verb parity.
- ADR-0019 remains in force; this ADR only makes explicit the role sub-surface it had
  folded into Capabilities/Instructions.

## Rejected alternatives

- **B now (brain ships hardcoded reference roles first).** Rejected as the *first* step:
  without the port contract, first-party roles would hardwire a role model into brain's
  core and re-break ADR-0019's neutrality. B is the right *future*, but only as an
  implementer of the port C defines.
- **A only (stay role-agnostic, prove n=2 via a second external harness like a Fission
  adapter).** Rejected as insufficient: it leaves neutrality dependent on an
  externally-authored harness existing, and never gives brain a first-party path.

## Open questions

- Exact shape of `model_tier` — abstract tier (`cheap|balanced|deep`) vs concrete model
  ids? Abstract keeps it platform-neutral (aligns with AGENT_PLATFORM axis).
- Does the role port live under `harness/` or a new `roles/` module? Leaning `roles/`
  for symmetry with `vcs/` and `memory/`.

## Evidence

- v2.0.0 merge audit: `docs/inbox/brain-v2-merge-audit.md`.
- ADR-0019 (`brain/project/decisions/adr-0019-harness-port.md:52-59`) — the n=2-on-init
  consequence this ADR extends to roles.
- `brain/scripts/harness/cli.mjs` (`VALID_OPS = ['init']`) — the single-op surface today.
