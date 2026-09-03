# Design: #323 S4

- `assertBoundEvidence(stage, routed, changeId)` — shared verbatim by both wirings
  (duplicated by value in each backend on purpose: a backend may not import
  the other's internals, and the guard is four lines whose drift the routing
  tests would catch).
- plain: no spawn path exists or is faked; the handoff's three steps name the
  routing fact, the accessor's target, and the producer's own gate.
- gentle-ai: `_transport` seam defaults to a lazy import of the claude
  backend's `runStage` — sibling-backend import (allowed; the dispatcher
  stays unimported per platform.mjs). Model precedence: explicit param →
  `routed.routing.model` → null (the transport's own default).
- Parity: the mechanical halves only — same target, engine-blind presence
  readers; the full gate-run parity is e2e territory beyond S4's claim.
