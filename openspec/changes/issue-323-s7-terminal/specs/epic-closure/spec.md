---
issue: 323
phase: spec
capability: epic-closure
---

# Spec — engine-blind gates, guarded

## Requirement: no gate names an engine (S7-R1)

Every gate surface (`brain/scripts/vcs/**`, `brain/scripts/governance/**`,
`check-refs.mjs`) carries zero SDD_ENGINES string literals; the token list is
the platform's own export, so a future engine joins the guard when it joins
the platform.

### Scenario: the guard bites
- WHEN a gate file gains a string literal naming a wired engine
- THEN the guard fails naming the file and the engine, and the only exit is a
  reviewed allowlist entry with a reason — never a widened scan.

### Scenario: the scan is not vacuous
- WHEN the gate tree moves or shrinks below plausibility
- THEN the guard fails on its own file-count floor rather than passing empty.
