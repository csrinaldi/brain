---
issue: 323
phase: spec
capability: epic-closure
---

# Spec — engine-blind gates, guarded

## Requirement: no gate names an engine (S7-R1)

Every gate surface (`brain/scripts/vcs/**`, `brain/scripts/governance/**`,
`check-refs.mjs`) carries zero NAMEABLE forms of an SDD_ENGINES member —
quoted string literal, or bare identifier in CODE — comments and string
contents stripped first, single-word engines included (rounds 1 and 2:
literals alone were narrower than the claim, and `plain`'s bare form had no
check at all). The token list is
the platform's own export, so a future engine joins the guard when it joins
the platform. A static scan cannot pin "zero engine-conditional code" in
full — the honest contract is the PAIR: this scan pins every nameable form,
and stage-wiring's D4 parity pins the behaviour.

### Scenario: the guard bites
- WHEN a gate file gains a string literal naming a wired engine
- THEN the guard fails naming the file and the engine, and the only exit is a
  reviewed allowlist entry with a reason — never a widened scan.

### Scenario: the scan is not vacuous
- WHEN the gate tree moves or shrinks below plausibility
- THEN the guard fails on its own file-count floor rather than passing empty.
