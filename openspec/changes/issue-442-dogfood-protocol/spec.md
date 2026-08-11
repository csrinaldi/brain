---
status: draft
issue: 442
---

# Spec

## REQ-442-1 — the protocol is separable from the tier
`reviewer.protocol` MUST override the tier's default reviewer protocol, at every tier and in
both directions.

## REQ-442-2 — absent is a no-op
With no override, every tier MUST resolve exactly the protocol it resolved before this change.

## REQ-442-3 — fail-closed on an unknown value
An explicit unrecognised protocol MUST refuse the run. It MUST NOT fall back to the tier
default. The refusal MUST name the rejected value and MUST post nothing.

## REQ-442-4 — one resolver
The resolution MUST live in one pure function beside `resolveTier`, not at the call site.

## REQ-442-5 — the tier does not move
Applying the override MUST NOT change `governance.tier`, the gate matrix, budgets or approval
evidence.

## REQ-442-6 — brain dogfoods it
Brain's own `brain.config.json` MUST request `brain-review/2`, and a guard MUST fail if that
stops being true.

## REQ-442-7 — proven on the wire
A real run at `lite` with the override MUST post a `/2` verdict; without it, a `/1` verdict; an
unknown value MUST refuse at boot. None of the three may be asserted in memory only.

## REQ-442-8 — no second production seam
`deps.tier` stays test-only. The config override is the only production way to select a
protocol.
