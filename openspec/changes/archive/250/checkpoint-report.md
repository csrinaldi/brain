# Checkpoint Report — CP-B0 (Slice B0, issue #250)

> **The foundational Track B tranche — HARD STOP.** B0 writes the harness port contract down and proves the
> port with a second inhabitant on its own `init` op, BEFORE the real baptism (B2/Antigravity).
> **Hand this report + the package to the external reviewer.** Work pauses for the verdict; B1 does not start
> until CP-B0 is signed off.
>
> **⚠ CP-B0 RE-EMITTED (prior APPROVE annulled).** After the first APPROVE, the `decision-gate` (rung 1) caught
> a TRUE-POSITIVE promotion-doctrine violation that all three review layers (two fresh-context agent reviews +
> the external verdict) missed: the normative `brain/core/methodology/sdd-layout.md` + the `HOME.md`/template
> nav entries were shipped in an AGENT PR. Doc-zone `brain/core/**` + HOME are promoted only by a HUMAN MR,
> co-promoted with their ADR (the #216 pattern) — never from an agent slice (C1b was CODE zone, not precedent).
> **Fix (this PR):** `sdd-layout.md` moved to `brain-drafts/` beside the ADR draft; the HOME/template edits
> reverted; the human co-promotion MR is now an explicit B1 deliverable (below). A checkpoint approves BOTH
> content AND packaging — the content was correct, so this re-emits over the corrected tree. Moral recorded:
> the mechanical gate caught what human/agent judgment did not.

## The reframe, now written as contract
Measured (engram `sdd/track-b/contract-inventory` #584): the `SDD_HARNESS` dispatcher supports ONE op (`init`);
`gentle-ai.mjs` exports only `init()`; all SDD artifact work is harness-NEUTRAL and never routes through the
harness. **This is a DESIGN TRUTH, not a bug.** B0 documents it: the port owns exactly four surfaces of the
development environment — **instructions / bootstrap / memory / capabilities** — and NOTHING in the artifact
lifecycle. **The NORM is the four surfaces; the single-`init`-op is current STATE** (new ops may be added only
to serve a surface). The ADR draft cites the analogy the owner required: **Track A's pure-evaluators +
thin-wrappers pattern applied to the EXECUTOR** — the harness is the thin wrapper; artifacts + gates are the
pure, neutral core.

## The CP-B0 package (per the owner's hard-stop requirement)
1. **ADR-0019 draft** — `openspec/changes/issue-250-b0/brain-drafts/adr-draft-harness-port.md`. Number
   VERIFIED against both `brain/project/decisions/` and `openspec/**/brain-drafts/`: 0017 = memory-format
   (Accepted), 0018 = gitlab-governance-pipeline (A2 draft), 0019 = free. Monotonic — never reused.
2. **Normative `sdd-layout.md` (DRAFT)** — `openspec/changes/issue-250-b0/brain-drafts/sdd-layout.md`. Canonical
   flat `spec.md` + the LEGACY-ACCEPTED nested `specs/*/spec.md` (15 flat / 10 nested measured; flat preference);
   mandatory `issue-<N>-<slug>` slug; `resume.md` documented as OPERATIONAL/EPHEMERAL (never a gate); the archive
   path. **Ships as a DRAFT beside the ADR** — the two normative artifacts travel together to their human
   co-promotion MR (B1). Its `brain/core/methodology/` home + the HOME nav entry are NOT in this agent PR
   (promotion doctrine — see the re-emission note above).
3. **The `sdd-layout.mjs` accessor + drift-guard** — `brain/scripts/lib/sdd-layout.mjs`: `REQUIRED_ARTIFACTS`
   (frozen 4), `OPERATIONAL_ARTIFACTS`, `LEGACY_GRANDFATHERED` (the SEALED 12, with the lock comment), path
   helpers (`changeDir`/`artifactPaths`/`archivePath`/`parseChangeId`/`isGrandfathered`/`hasSpec`/
   `missingRequiredArtifacts`). Drift-guard TEST: A1 (single-source scan, precision-hardened) + A2 (`deepEqual`
   the sealed 12 — a 13th entry fails, the lock's teeth). A3 (consumers-reference-the-module) is B1.
4. **A WORKING `SDD_HARNESS=plain`** — `brain/scripts/harness/backends/plain.mjs`: `init()` emits the 9
   `workflow-guide §B` manual steps, zero AI/tools. A real end-to-end `dispatch('plain','init')` through the
   UNMODIFIED `cli.mjs` proves the port is **n=2 on its own `init` op** — the dispatcher validated with two
   inhabitants (gentle-ai + plain) BEFORE Antigravity (B2). "Executable, not asserted."
5. **The B1 worklist** (handed off, below).

## Pins honored (with the evidence)
- **Surfaces-are-norm, op-count-is-state** — the ADR wording is the owner's signed text verbatim; no
  `VALID_OPS` expansion (the reframe dissolved that need).
- **Sealed grandfather** — exactly the 12 measured legacy dirs; `deepEqual` lock (13th fails); the review
  confirmed the 12 are exhaustive (all other 16 change dirs have a flat `spec.md`).
- **Rehearsal-tests smoke-proof** — each accessor helper's test rehearses its cited measured site's call shape
  (check-refs / session-start / new-change / engram / phase-order-check / feature-resolution). The
  stop-condition (a helper that can't satisfy its site without touching it) **did NOT fire** — the API is the
  shape of its real future consumers, not speculative. Frontier clean: the 6 sites are UNTOUCHED (B1 wires).
- **Archive path measured, not assumed** — `openspec/changes/archive/<iid>` (no archived dir exists today;
  PLAN §E1 verbatim); owned by the accessor so E1 can't fork a second source.
- **A1 precision over coverage** — the design's literal "2-token co-occurrence" was a REAL precision bug
  (false-positived on `check-refs.mjs:102`'s pre-existing `['proposal.md','tasks.md']`); fixed to
  "≥3-of-4 in one literal" + backtick-quoted elements. Residual (names split across two brackets) documented,
  not chased — a false-positive is a drift-guard's death mode.

## Evidence
- `npm test`: **1303/1303** · `brain:repo:check` · `brain:nav` green
- Non-test counted diff: **213/400** (`ignoreList` untouched). Well under; no `size:exception`, no split.
- Two fresh-context adversarial reviews — the CP-B0 pass found NO blockers ("clean, honest slice"); two MINORs
  (a tautology test comment; the A1 backtick evasion) fixed before this checkpoint.

## Honest disclosures
- `brain:audit` exits 1 with the **2 PRE-EXISTING** `adrPresence` FAILs (`04ae992`/`8d60661`) — unchanged.
- B0 ships an accessor that **nothing consumes yet** (only its own tests + `plain`). That is the intended
  frontier: B0 = the contract; B1 makes the gates read it. The rehearsal-tests + `plain`'s n=2 are B0's
  in-situ proof that the contract is real and the API fits.

## B1 worklist (handed off — NOT started)
1. Wire the 6 measured sites onto the accessor (`check-refs.mjs:96-112`, `session-start.mjs:38-69`,
   `new-change.mjs:48-110`, `engram.mjs:804-805 & 925-926`, `phase-order-check.mjs`, `feature-resolution.mjs`),
   incl. mandating the `issue-<N>-<slug>` slug in `new-change.mjs`.
2. Swap `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS` → `import { LEGACY_GRANDFATHERED }` (behavior-preserving
   — B0's own tests proved `BASELINE_EXEMPT_DIRS` is a strict subset of the sealed 12).
3. Add drift-guard **A3** (consumers-reference-the-module).
4. Promote the ADR-0019 draft to `brain/project/decisions/` at B1/archive.
5. **The HUMAN co-promotion MR** (explicit now, was implicit) — moves BOTH normative artifacts out of
   `brain-drafts/` in one human MR: `ADR-0019` → `brain/project/decisions/` **and** `sdd-layout.md` →
   `brain/core/methodology/`, plus the `HOME.md` + `HOME.template.md` nav entries. Run the #216 errata
   checklist (banner, `Status:`, links, ISO date) and re-verify the number against `brain/project/decisions/`
   + `openspec/**/brain-drafts/` at promotion time. This is doc-zone work: human MR only, never an agent PR.

## Acceptance
- **This slice:** the port contract is written; the accessor + drift-guard exist and self-test; `SDD_HARNESS=plain`
  reaches n=2 on `init`; suite green; no new audit failure. ✅
- **Track B continues:** B1 (wiring) → **B2 — the Antigravity baptism** (Antigravity completes a real governed
  micro-slice, candidate #247, human as operator; B2's explore empirically verifies the real Antigravity harness).
