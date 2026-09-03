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
re-export. The surface is BRAIN'S OWN DECLARATION —
`VERIFICATION_SURFACE` in `governance-tiers.mjs`, the gates' vocabulary
owner: whole verify-side DIRS (`vcs/**`, `governance/**`,
`review/evaluators/**`, `review/lib/**`) plus the named entry scripts
outside them — check-refs, brain-audit, change:archive, poster, verdict.
Rounds 7–8: ADR condition 2 enumerates FOUR readers and a hand-kept file
list missed archive, then missed the evaluator's own decision core
(tranche.mjs, split out by the D1 pattern) — decision files are declared by
DIRECTORY, which survives refactors; the one producer inside a verify-side
dir (the cold-review runner) carries the allowlist's single reviewed entry. The maintainer's ruling on #847: "what is a gate" is
never resolved from a forge's CI config — that is one adapter's wiring, and
it is checked AGAINST the declaration (a drift test on effective, comment-
stripped lines), never read as the authority. Round 5's remembered list and
round 6's read-the-forge derivation were the same mistake at two depths. These are the
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
