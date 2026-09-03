---
issue: 323
phase: spec
capability: epic-closure
---

# Spec — engine-blind gates, guarded

## Requirement: no gate names an engine (S7-R1)

Every gate surface carries zero engine-name string literals (raw text, any
quote) and zero imports whose specifier resolves into the engines' home
(`brain/scripts/harness/**`, path-boundary not prefix) — static, dynamic, or
re-export. The surface is `brain/scripts/vcs/**` + `brain/scripts/governance/**`
+ every script the CI workflows themselves invoke (DERIVED from
`.github/workflows/*.yml`, never hand-remembered — round 5's blocker was a
remembered list missing `brain-audit.mjs`), plus `check-refs.mjs` pinned for
its npm-script indirection. These are the
only two binding roads a WORKING engine-conditional has: a bare identifier
bound to neither is a ReferenceError, not a fork (rounds 1–4 retired a
strip-then-scan lexer that lost this arms race three times: URLs in strings,
template interpolations, regex literals). The token list is the platform's
own export, so a future engine joins the guard when it joins the platform.
What a static scan cannot pin, stage-wiring's D4 parity pins behaviourally.

### Scenario: the guard bites
- WHEN a gate file gains a string literal naming a wired engine
- THEN the guard fails naming the file and the engine, and the only exit is a
  reviewed allowlist entry with a reason — never a widened scan.

### Scenario: the scan is not vacuous
- WHEN the gate tree moves or shrinks below plausibility
- THEN the guard fails on its own file-count floor rather than passing empty.
