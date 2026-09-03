---
issue: 323
phase: proposal
---

# Proposal — the terminal PR: M8 closes with its evidence on the table

## Intent

Close epic #323 (per-stage SDD engine routing) by proving each deliverable
against what main already carries, and shipping the ONE gap the inventory
found: the epic demands "zero engine-conditional code in any gate" and that
was true but unguarded — a truth with no test is a truth on borrowed time.

## Deliverables → evidence (measured on main at 623490f6)

1. **ADR, amendment not supersede, cross-referenced both ways** — ADR-0019
   Amendment 1 (#323) ruled "the invariant is the artefact contract, not the
   op count"; Amendments 2–5 corrected and extended it (5 signed in #845).
2. **stage→engine resolver + schema + additive migration** — `stage-engine.mjs`
   (#835): `assertRoutedStage`/`assertRoutableStage`, declared-set union,
   C1 pin; migrations promoted via `brain:promote` (#828/#830), dormant until
   the release cut activates them (#806 seam, reported in #313).
3. **≥2 engines wired per stage** — `plain.runStage` (manual handoff) and
   `gentle-ai.runStage` (composes from port instructions, delegates to the
   claude transport) — #837, nine review rounds.
4. **Contract/parity test + zero engine-conditional gate code** — parity:
   `stage-wiring.test.mjs` D4 pair (one target, engine-blind readers).
   THE GAP: nothing guarded the "zero engine-conditional" half. This PR ships
   `engine-blind-gates.test.mjs` — scans every gate surface for every NAMEABLE
   form of an SDD_ENGINES member (quoted literal, bare key, camel/Pascal
   identifier; tokens from platform.mjs, never a copy), empty allowlist,
   bite proven (planted offender + a matcher unit-tested against the bypass
   shapes). What a static scan cannot pin, D4's parity pins behaviourally.
5. **Drift guard (artifact contract not forked)** — slice A's rival-declaration
   scan (sdd-layout.test.mjs A1, two-notation sweep) — it caught #845's own
   scaffold literal this week.

## Exit criterion

"The owner composes the SDD pipeline by choosing an engine per stage" —
`sdd.map.<stage> = {engine, model?}` per #835, consumed end to end by #837,
custom stages included per #845 under ADR-0019 Amendment 5.

## Non-goals

Absorbed-issue verification beyond what shipped: #713's termination rule and
#752's slice-scope header landed in S5 (#841); #456-B landed in S6 (#845).
The premise-2 measurement the roadmap names belongs to #313's axis work, not
this PR.
