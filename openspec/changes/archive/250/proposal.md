# Proposal — The Harness Port Contract, Written Down (Track B / slice B0)

> **Status:** planned · **Issue:** #250 (APPROVED with 3 owner pins)
> **Depends on:** #251 (the `spec.md` scaffold micro-fix — flat `spec.md` now scaffolded, shipped SEPARATELY).
> **Exploration:** measured, not assumed — [[sdd/track-b/contract-inventory]] (engram #584). Owner reframe
> [[sdd/track-b/reframe]] (#585); the 3 binding pins [[sdd/issue-250-b0/constraints]] (#587).
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

Track B's job is to prove brain's `SDD_HARNESS` port is a real, swappable boundary — validated by a
second inhabitant, not asserted. The measurement (#584) surveyed the actual surface and produced a
**MAJOR finding that reframes the whole track**:

- The `SDD_HARNESS`-swappable dispatcher supports exactly ONE op today: `brain/scripts/harness/cli.mjs:52`
  → `VALID_OPS = ['init']`. `backends/gentle-ai.mjs` exports only `_toEngramProject()` and `init()`.
- ALL actual SDD artifact work — scaffolding (`new-change.mjs`), verify (`verify-change.mjs`), the
  phase-order gate (`phase-order-check.mjs`), memory checkpoint/resume — is a SINGLE hardcoded,
  **harness-neutral** implementation, NOT routed through the dispatcher and NOT per-backend.

The owner ruled (#585) this is **DESIGN TRUTH, not a bug**: the port is thin BY DESIGN. Artifact
production is neutral BY DESIGN. The port's real responsibility is four surfaces of the *development
environment* — **instructions / bootstrap / memory / capabilities** — and nothing in the artifact
lifecycle. This mirrors Track A exactly: **Track A split governance into pure evaluators + thin
provider wrappers; Track B applies the identical pattern to the EXECUTOR** — the harness is the thin
wrapper, the SDD artifacts + gates are the pure neutral core.

The problem B0 solves: today that contract is **implicit in gate code** (six hard-coding sites across
five files, #584 §3) and **inconsistent across gates** (#584 §4). An unwritten standard is not
adapter-implementable, and a port whose thinness looks like an accident invites future contributors to
"fix" it by inflating it. B0 writes the contract down and proves the port with a second inhabitant on
its own `init` op — BEFORE the real baptism (B2/Antigravity).

## What this slice ships (4 deliverables — ADR draft + spec doc + accessor + a real backend)

1. **D1 — `sdd-layout.md` (normative canonical layout).** A new normative doc under
   `brain/core/methodology/` fixing the canonical shape: change dir `openspec/changes/issue-{iid}-{slug}/`;
   artifacts `proposal.md`, `spec.md`, `design.md`, `tasks.md`; checked-task pattern (`- [x]`); status
   frontmatter ladder; `resume.md` placement; the archive destination path (currently undefined anywhere,
   #584 §4). It resolves the cross-gate tolerances **per Pin 1**: **flat `spec.md` at change-dir root is
   canonical** (15 users, scaffolded since #251); **nested `specs/*/spec.md` is LEGACY-ACCEPTED** (10 users,
   9 legacy dirs) — readers tolerate it, the scaffold NEVER produces it, the doc records both with the flat
   preference. Killing the nested variant would invalidate ~40% of the spec corpus, so it is grandfathered,
   not removed.

2. **D2 — the single `REQUIRED_ARTIFACTS` accessor + a drift-guard.** One module
   (`brain/scripts/lib/sdd-layout.mjs`) exporting the canonical constants + path/parse helpers, so every
   layout reader has ONE definition and zero drift. B0 delivers the module and a **drift-guard** (a test
   asserting the canonical set is defined once and that a naive "require 4 flat artifacts" check applies to
   NEW changes ONLY). **Per Pin 2**, legacy dirs are grandfathered: the 12 measured legacy dirs that lack a
   flat `spec.md` are exempt; the gate upgrades WITHOUT retroactively rewriting history ("the past is
   recorded, not edited" — the monotonic-versions principle). The actual migration of the six sites onto the
   accessor is B1 — B0 ships the accessor + guard + the worklist.

3. **D3 — the port definition, WRITTEN DOWN (ADR draft).** An ADR draft stating the port is the boundary
   owning exactly four environment surfaces — **instructions, bootstrap, memory, capabilities** — and NOTHING
   in the SDD artifact lifecycle (neutral by design). Per the Fork-A pin: **the NORM is the four surfaces;
   the single-`init`-op is current STATE, not a normative invariant** (new ops may be added only to serve one
   of the four surfaces). The thin-port finding is documented as INTENTIONAL, not an accident. **The ADR draft MUST cite the analogy** (Pin 3 endorsement):
   this is Track A's pure-evaluators + thin-wrappers pattern applied to the executor.

4. **D4 — `plain.mjs` as a REAL selectable backend.** A minimal `brain/scripts/harness/backends/plain.mjs`
   whose `init()` emits/installs the manual-flow manifest — the nine workflow-guide §B steps (#584 §5).
   **Per Pin 3**, this is NOT documentation: `SDD_HARNESS=plain` must actually dispatch. Gain: the port
   reaches **n=2 on its own `init` op from B0** — the dispatcher proven with two inhabitants (gentle-ai +
   plain) BEFORE Antigravity. "Executable, not asserted."

## The reframe dissolves an apparent scope-gap (recorded)

#584 flagged that if B2/B3 were "implement the full verb set," `VALID_OPS` would have to expand beyond
`init` for the proof to mean anything. **The reframe dissolves this**: because artifact production is
neutral BY DESIGN, `init` is the ONLY op the port needs, and n=2 is proven on `init` itself via
`plain.mjs`. No `VALID_OPS` expansion is required or wanted. What looked like hidden scope was a missing
piece of doctrine — now written down in D3.

## PLAN-DEVIATION (recorded)

`PLAN-adapters-v3.md §3` (`:213-235`) frames **B2 = `plain` backend** and **B3 = `openspec-fission`
adapter**, and frames B0 as "the canonical layout is the contract; adapters normalize into it." The owner
reframe (#585) supersedes this: **`plain` folds INTO B0** as a real backend (D4), **B2 = the Antigravity
baptism** (a real competing AI harness completing a real micro-slice under intact governance; candidate
slice #247, the chunk migration), and **B3 is DEFERRED** until an inhabitant with real need exists (no
speculative n=3). The PLAN's B0 "adapters normalize into the fixed layout" claim STANDS and is sharpened
by the four-surface port definition; its B2/B3 slice numbering does not.

## Non-goals (explicit)

- **B1** — migrating the six measured hard-coding sites (`check-refs.mjs:96-112`, `session-start.mjs:38-69`,
  `phase-order-check.mjs`, `new-change.mjs:48-110`, `engram.mjs:804-805` & `:925-926`,
  `feature-resolution.mjs:37-81`) onto the accessor, plus the instruction-emission adapter architecture.
  B0 ships the accessor + the worklist; B1 consumes it.
- **B2** — the Antigravity adapter + the baptism (real second AI inhabitant, #247 candidate).
- **B3** — deferred (no speculative third adapter).
- **The `spec.md` scaffold micro-fix** — shipped SEPARATELY as #251; B0 depends on it and folds the flat
  `spec.md` into `REQUIRED_ARTIFACTS`, but does not re-implement it.

## Two forks — RESOLVED by owner pins (binding for spec/design)

- **Fork A — port wording SIGNED (corrected):** the NORM is the four surfaces; the op-count is current STATE, not a normative invariant. The ADR draft uses this exact wording:
  > The `SDD_HARNESS` port is the boundary through which a backend owns exactly four surfaces of the development environment — and NOTHING in the SDD artifact lifecycle: (1) Instructions … (4) Capabilities … Today that boundary is carried by a single operation (`init`); new operations may be added only when they serve one of the four surfaces. Everything downstream — scaffold, phase-order, verify, archive — is harness-neutral and runs identically regardless of `SDD_HARNESS`. The canonical `openspec/` layout is the fixed evidence contract; harnesses normalize INTO it, they never reshape it.
- **Fork B — Option 1 (static allowlist) SIGNED, with the lock WRITTEN:** the allowlist is CLOSED AND FROZEN — exactly the 12 measured legacy dirs at B0. The module comment MUST read: *"Grandfather = past only. This list is sealed at B0; adding an entry requires ADR-level justification — a NEW change dir must never appear here."* Consolidate the scattered exempt-lists (`phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS`, the tripwire's `EXEMPT_PATH_RE` if applicable) to migrate/reference this module — one greppable place.
- **The 3 extras (resolved):** archive path — the LOCATION is owned by the accessor NOW; the VALUE is measured in design (any archived dir today? PLAN §E1?), not from memory. `resume.md` — documented in `sdd-layout.md` as an OPERATIONAL/EPHEMERAL artifact (machine-written, never required, staleness expected & discardable), OUTSIDE `REQUIRED_ARTIFACTS`. Slug — the NORM lands in B0 (`sdd-layout.md` mandates `issue-<N>-<slug>`); the scaffold fix is B1.

## Acceptance criteria (CP-B0 — hard stop, PR-as-review, Part of #250)

- [ ] D1: `brain/core/methodology/sdd-layout.md` exists, normative; documents the canonical flat layout AND
      the legacy-accepted nested `specs/*/spec.md` variant with the flat preference (Pin 1); defines the
      archive destination path and `resume.md` placement.
- [ ] D2: `brain/scripts/lib/sdd-layout.mjs` exports the single `REQUIRED_ARTIFACTS` set + path/parse
      helpers; a drift-guard test proves one definition and that the 4-artifact check is NEW-changes-only;
      the 12 measured legacy dirs are grandfathered, none rewritten (Pin 2).
- [ ] D3: the ADR draft states the single-op `init` port + the four surfaces (instructions / bootstrap /
      memory / capabilities) with artifacts neutral by design, and CITES the pure-evaluator/thin-wrapper
      analogy to Track A (Pin 3 endorsement).
- [ ] D4: `brain/scripts/harness/backends/plain.mjs` exists and is dispatchable — `SDD_HARNESS=plain` runs
      `init` (emits/installs the workflow-guide §B manifest); the port reaches n=2 on `init` (Pin 3).
- [ ] Forks A + B are explicitly surfaced for owner decision (draft wording + mechanism recommendation),
      NOT silently resolved.
- [ ] **CP-B0 package** delivered: ADR draft + normative `sdd-layout.md` + the accessor with its drift-guard
      + a WORKING `SDD_HARNESS=plain` + the B1 worklist (the six measured sites, grep evidence).
- [ ] Guardrails: docs English (ADR-0009); TDD (drift-guard + `plain` dispatch test written first); ≤400
      changed lines, no `size:exception`; `npm test`, `brain:repo:check`, `brain:change:verify` green.
      STOP at CP-B0.
