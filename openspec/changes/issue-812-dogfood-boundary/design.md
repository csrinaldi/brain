---
issue: 812
phase: design
---

# Design — #812

## D1 — the boundary already had a precedent in the same function

`readyDeps` pins `tier: 'standard'` and explains why. This change adds the
sibling pin for the judgment axis rather than inventing a mechanism: the file
had already answered this question once, for the axis that bit first.

## D2 — the line the boundary follows

Doctrine may be inherited from the real config; environment must be pinned.
The protocol version and the declared tier are doctrine — a test that reads
them proves the repo's own declaration works. A transport is environment: it
says what machine this is, not what the project decided.

## D3 — `{}` rather than a fake generator

An injected generator would make the tests assert on a judgment half that never
ran against anything real — a fixture agreeing with itself. `{}` reproduces the
state of a repo that has not run the stage, which is both honest and the state
the verdict protocol already knows how to report.

## D4 — committing the key is part of the fix, not a follow-up

The uncommitted workaround has a failure mode worse than the gap: a `git pull`
removes it and the next verdict reads `APPROVE` with the inferential control
silently not applied. Leaving the key out would keep that trap armed while
claiming the ticket closed.
