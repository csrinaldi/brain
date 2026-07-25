# Spec Delta — The Harness Port Contract, Written Down (slice B0)

> Ships the normative canonical layout (`sdd-layout.md`), a single `REQUIRED_ARTIFACTS` accessor
> (`sdd-layout.mjs`) with a drift-guard and a sealed legacy-grandfather allowlist, the port-definition ADR
> draft (four surfaces are the norm, artifacts neutral by design), and `plain.mjs` as a real, dispatchable
> `SDD_HARNESS` backend proving n=2 on `init`. See [design.md](design.md).

## REQ-B0-1: `sdd-layout.md` is the normative canonical layout (D1)

`brain/core/methodology/sdd-layout.md` MUST exist and be normative. It MUST document: the change-dir
pattern `openspec/changes/issue-<N>-<slug>/` with the slug MANDATORY (not optional); the four REQUIRED
artifacts at the change-dir root — `proposal.md`, `spec.md`, `design.md`, `tasks.md` (flat) — as canonical
for new changes; the nested `specs/*/spec.md` variant as LEGACY-ACCEPTED (readers MUST tolerate it, the
scaffold MUST NEVER produce it), stated alongside the flat preference, never as an equal alternative; the
checked-task pattern (`- [x]`, case-insensitive); and the archive destination as a path OWNED by the
`sdd-layout.mjs` accessor (the accessor is the single source of truth for the location; the concrete value
is a design-time decision, not asserted here). `resume.md` MUST be documented as an
OPERATIONAL/EPHEMERAL artifact — machine-written, never required, staleness expected and discardable —
explicitly OUTSIDE the `REQUIRED_ARTIFACTS` set.

#### Scenario: the doc states the flat/nested preference and the mandatory slug

- GIVEN `brain/core/methodology/sdd-layout.md` after B0
- WHEN it is read for the spec-artifact convention and the change-dir naming rule
- THEN it states flat `spec.md` as canonical for new changes, nested `specs/*/spec.md` as LEGACY-ACCEPTED
  (tolerated, never scaffolded), and `issue-<N>-<slug>` with a MANDATORY slug as the change-dir pattern

#### Scenario: `resume.md` is documented as operational, not required

- GIVEN `sdd-layout.md`'s artifact contract section
- WHEN it lists `REQUIRED_ARTIFACTS`
- THEN `resume.md` does NOT appear in that set, and a separate note describes it as
  operational/ephemeral — machine-written, discardable, never a gate condition

## REQ-B0-2: a single `REQUIRED_ARTIFACTS` accessor with a drift-guard (D2)

`brain/scripts/lib/sdd-layout.mjs` MUST be the ONE module exporting the canonical `REQUIRED_ARTIFACTS` set
plus the layout path/parse helpers (change-dir path, archive-path accessor, slug parse). No other file in
the repo may declare its own literal artifact-name array standing in as a second definition. A drift-guard
test MUST assert this: it MUST fail if a second, independent definition of the required-artifact set is
introduced anywhere in `brain/scripts/**`.

#### Scenario: the drift-guard catches a second definition

- GIVEN a hypothetical second hardcoded array of required artifact filenames introduced outside
  `sdd-layout.mjs`
- WHEN the drift-guard test runs
- THEN it fails, naming the offending file — proving `sdd-layout.mjs` is the only source

#### Scenario: the accessor is the only place path helpers are defined

- GIVEN any script needing the change-dir path, the archive path, or the required-artifact list
- WHEN it needs that value
- THEN it imports it from `sdd-layout.mjs` rather than re-deriving it inline (verified by the drift-guard
  plus a grep-based assertion in the B1 worklist, out of scope for B0's own migration)

## REQ-B0-3: the 4-artifact check is NEW-CHANGES-ONLY, with a sealed legacy-grandfather allowlist (D2, Fork B)

A NEW change dir (any `openspec/changes/issue-<N>-<slug>/` not already present in
`LEGACY_GRANDFATHERED`) MUST carry all four `REQUIRED_ARTIFACTS`; a new dir missing any of them is a
violation. `LEGACY_GRANDFATHERED` MUST be a static, exhaustive allowlist containing EXACTLY the 12 legacy
change dirs measured at B0 (per the contract inventory, #584) — CLOSED AND FROZEN at B0. The module MUST
carry the comment, verbatim in substance: *"Grandfather = past only. This list is sealed at B0; adding an
entry requires ADR-level justification — a NEW change dir must never appear here."* A NEW change dir
appearing in `LEGACY_GRANDFATHERED` MUST itself be treated as a violation (a guard, not merely a
convention) — the allowlist exempts history, it never becomes a hatch for a hurried future exemption.
Scattered exempt-lists that pre-date this module — `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS` and
the tripwire's `EXEMPT_PATH_RE`, where applicable — MUST be consolidated to reference `sdd-layout.mjs`'s
`LEGACY_GRANDFATHERED` as the one greppable place (migration of the call sites themselves is B1; B0 ships
the sealed set and the guard it must be checked against).

#### Scenario: a new change dir missing `spec.md` fails the check

- GIVEN a new change dir not present in `LEGACY_GRANDFATHERED` that lacks a flat `spec.md`
- WHEN the 4-artifact check runs against it
- THEN it fails, naming the missing artifact

#### Scenario: a grandfathered legacy dir passes despite missing artifacts

- GIVEN one of the 12 dirs listed in `LEGACY_GRANDFATHERED`
- WHEN the 4-artifact check runs against it
- THEN it passes without requiring the missing artifact(s), and no history is rewritten

#### Scenario: a new dir appearing in the allowlist is itself rejected

- GIVEN a hypothetical edit adding a 13th, non-legacy entry to `LEGACY_GRANDFATHERED`
- WHEN the guard (test or lint) inspects the allowlist against the set of dirs that existed at B0
- THEN it fails, flagging the new entry as an unauthorized addition to a sealed list

## REQ-B0-4: the port contract — four surfaces are the norm, artifacts are neutral by design (D3, Fork A)

An ADR draft MUST state the port definition using the SIGNED wording (verbatim in substance):

> The `SDD_HARNESS` port is the boundary through which a backend owns exactly four surfaces of the
> development environment — and NOTHING in the SDD artifact lifecycle: (1) Instructions … (4)
> Capabilities … Today that boundary is carried by a single operation (`init`); new operations may be
> added only when they serve one of the four surfaces. Everything downstream — scaffold, phase-order,
> verify, archive — is harness-neutral and runs identically regardless of `SDD_HARNESS`. The canonical
> `openspec/` layout is the fixed evidence contract; harnesses normalize INTO it, they never reshape it.

The four surfaces — instructions, bootstrap, memory, capabilities — MUST be stated as the NORM (the
invariant a backend is judged against); the single-op (`init`) surface MUST be stated as current STATE,
not a normative ceiling — a future op is legitimate ONLY when it serves one of the four surfaces, never to
carry artifact-lifecycle logic. The ADR draft MUST cite the Track A pure-evaluator/thin-wrapper pattern as
the applied analogy: the harness is the thin wrapper, the SDD artifacts and gates are the pure neutral
core.

#### Scenario: the ADR states the four surfaces as the invariant, not the op count

- GIVEN the ADR draft after B0
- WHEN it is read for the port's normative boundary
- THEN it names instructions/bootstrap/memory/capabilities as the four surfaces owned by a backend, states
  that new operations may be added only to serve one of them, and does NOT present the single-op `init`
  surface as a ceiling on the port

#### Scenario: the ADR cites the Track A analogy

- GIVEN the ADR draft
- WHEN it is read for its justification of the thin-port finding
- THEN it explicitly cites Track A's pure-evaluators + thin-wrappers split as the pattern being applied to
  the executor, framing the thinness as intentional design, not an accident

## REQ-B0-5: `plain` is a real, dispatchable `SDD_HARNESS` backend (D4)

`brain/scripts/harness/backends/plain.mjs` MUST exist and be a genuine second inhabitant of the
`SDD_HARNESS` dispatcher's `init` op — not documentation-only. With `SDD_HARNESS=plain`, dispatching
`init` MUST emit or install the manual-flow manifest corresponding to the nine `docs/workflow-guide.md`
§B steps (the already-working "Manual, no AI" npm-verb sequence). The backend MUST require no AI
provider, no external network call, and no tool other than what is already part of the repo's own
tooling. This closes the port on n=2 for `init` — `gentle-ai` and `plain` — ahead of the real B2 baptism.

#### Scenario: `SDD_HARNESS=plain init` runs and produces the manifest

- GIVEN `SDD_HARNESS=plain` set in the environment
- WHEN the harness dispatcher's `init` op is invoked
- THEN `plain.mjs#init()` runs, emits or installs the manual-flow manifest reflecting the nine
  workflow-guide §B steps, and exits successfully with no AI provider or external tool invoked

#### Scenario: the port dispatches identically in shape across both backends

- GIVEN `SDD_HARNESS=gentle-ai` and `SDD_HARNESS=plain` in turn
- WHEN `init` is dispatched under each
- THEN both resolve through the same `harness/cli.mjs` dispatch path to a backend-specific `init()`
  export, proving the dispatcher itself is backend-agnostic — not proving anything about artifact
  scaffolding, which stays harness-neutral by design (REQ-B0-4)

## Out of scope (non-goals)

- **B1** — migrating the six measured hard-coding sites (`check-refs.mjs:96-112`,
  `session-start.mjs:38-69`, `phase-order-check.mjs`, `new-change.mjs:48-110`, `engram.mjs:804-805` &
  `:925-926`, `feature-resolution.mjs:37-81`) onto the `sdd-layout.mjs` accessor, the instruction-emission
  adapter architecture, and the scaffold's slug-mandatory fix (B0 lands the norm in `sdd-layout.md`; the
  scaffold wiring is B1).
- **B2** — the Antigravity adapter and the real second-AI-harness baptism (#247 candidate slice).
- **B3** — deferred (no speculative third adapter).
- **The `spec.md` scaffold micro-fix** (#251) — shipped separately; B0 depends on it and folds the flat
  `spec.md` requirement into `REQUIRED_ARTIFACTS`, but does not re-implement it.
- The concrete VALUE of the archive destination path — REQ-B0-1 pins that `sdd-layout.mjs` OWNS the
  location; the value itself is a design-time decision informed by measurement, not asserted here.

## Gate

`npm test`, `brain:repo:check`, and `brain:nav` MUST stay green with no new `brain:audit` failure. Docs
MUST be in English (ADR-0009). TDD: the drift-guard and the `plain` dispatch test are written first.
