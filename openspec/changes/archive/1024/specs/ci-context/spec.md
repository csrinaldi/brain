No new ID: this amends REQ-CIC-3's existing `REQUIRED_JOBS` text, which already names
`memory-gate`, to state which fields it consumes and the CI-wiring precondition
(governance-v3 REQ-L3-6) those fields depend on. `REQ-CIC-2`'s `labels` field and
`REQ-CIC-3`'s null-vs-empty contract are unchanged; only the `memory-gate`-specific
consequence is made explicit.

## MODIFIED Requirements

### Requirement: REQ-CIC-3: Missing-Variable Behavior By Gate Type

When a gate needs a context field that `loadContext()` returned as `null`
(uncomputable context), the gate's response MUST follow its class:

- A **REQUIRED_JOBS** consumer of the context (`issue-link`, `diff-size`,
  `memory-gate`, `decision-gate`) MUST **fail closed** — the gate fails; it MUST NOT
  exit 0. (The full `REQUIRED_JOBS` set in `governance-checks.mjs` L27 also includes
  `local-checks`, which consumes no PR/MR context and is therefore not a `ci-context`
  consumer.)
- A **DETECTION_JOBS** consumer (`phase-order`, `actor-check`,
  `brain-writes-reviewed`) MUST **degrade to `warn` with a documented reason** and
  exit 0.

A REQUIRED gate MUST NEVER silently exit 0 on uncomputable context. `ci-context.mjs`
MUST signal the uncomputable state as `null` (Decision: no fabricated default),
leaving the fail-closed/degrade decision to the gate. This split MUST match
ADR-0015's verified precedent (`run-check.mjs` fails closed on an uncomputable diff;
`phase-order-check.mjs`, `actor-check.mjs`, `brain-writes-reviewed.mjs` degrade to
warn).

`memory-gate` is a REQUIRED_JOBS consumer of BOTH `ctx.body` (issue scoping,
governance-v3 REQ-L3-4) and `ctx.labels` (the `skip:memory-gate` override,
governance-v3 REQ-L3-5) from the SAME `loadContext()` call. Both fields are
structurally `null` for this job unless its CI job declares `PR_NUMBER` and
`VCS_TOKEN` (mirroring `issue-link`, governance-v3 REQ-L3-6) — without them,
`loadContext()` never calls `prView`, so this is an uncomputable context for a
REQUIRED consumer, not merely "no PR context". How the `memory-gate` job responds to
each field's `null` state is governance-v3's to define (REQ-L3-4, REQ-L3-5); this
requirement guarantees only that the seam signals `null` truthfully.

(Previously: this requirement named `memory-gate` in the `REQUIRED_JOBS` list but did
not state which fields it consumes or that its CI job must declare `PR_NUMBER` /
`VCS_TOKEN` for those fields to be computable at all.)

[**unit-testable**: feed each gate a context with the needed field `null`; assert
REQUIRED gates return fail / non-zero and DETECTION gates return warn / exit 0 with a
reason string]

#### Scenario: Required gate fails closed on uncomputable context

- GIVEN `loadContext()` returns `baseSha: null` / `headSha: null`
- WHEN a REQUIRED gate (`diff-size` or `decision-gate`) evaluates
- THEN it fails closed (non-zero) with a "cannot compute — failing closed" reason
- AND it does NOT exit 0

#### Scenario: decision-gate fails closed when labels are uncomputable

- GIVEN `loadContext()` returns `labels: null` (the label fetch failed — distinct from
  `[]`)
- WHEN `decision-gate` (REQUIRED) evaluates
- THEN it fails closed with a "cannot fetch labels" reason — it MUST NOT read the
  absence of a `decision` label as "not a decision PR" and exit 0
- AND the same fail-closed-on-`null` holds for `diff-size` (`size:exception`) and
  `memory-gate` (`skip:memory-gate`), and for `issue-link` on `body: null`

#### Scenario: Detection gate degrades to warn on uncomputable context

- GIVEN `loadContext()` returns `baseSha: null` / `headSha: null`
- WHEN a DETECTION gate (`phase-order`) evaluates
- THEN it degrades to `warn` with a documented reason and exits 0

#### Scenario: No silent pass in a required gate

- GIVEN any REQUIRED gate with an uncomputable needed field
- WHEN it evaluates
- THEN it never returns a passing/exit-0 result without having evaluated

#### Scenario: `memory-gate` job wired — both body and labels computable

- GIVEN the `memory-gate` CI job sets `PR_NUMBER` and `VCS_TOKEN` (governance-v3
  REQ-L3-6)
- WHEN `loadContext()` runs and the fetch succeeds
- THEN both `ctx.body` and `ctx.labels` are populated (non-null)

#### Scenario: `memory-gate` job unwired — both fields null, not merely absent

- GIVEN the `memory-gate` CI job omits `PR_NUMBER` and `VCS_TOKEN` (the pre-#1024
  state)
- WHEN `loadContext()` runs
- THEN `ctx.body` is `null` and `ctx.labels` is `null` (uncomputable, not genuinely
  empty)
- AND governance-v3 REQ-L3-4 governs how the gate responds to that `null` body — this
  requirement only guarantees the seam's signal is truthful
