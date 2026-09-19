# Draft note for ADR-0034 L2 (Tier 2, maintainer moves it)

Target: `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`, section "L2 + C1 — Merge by tier".

Proposed addition, factual only:

> **Observed repository setting (2026-09-19, #936).** `csrinaldi/brain` has
> `allow_auto_merge: false` (`gh api repos/csrinaldi/brain`). `mrAutoMerge` is therefore
> refused at every tier, and `shipLane` (`brain/scripts/memory/lane/ship.mjs`) records the
> refusal as `autoMerge.enabled: false` without failing. In practice, tier `lite` in this
> repository behaves like `standard`/`regulated`: every lane PR waits for a human merge. The
> table above describes intended behavior under a repository that allows auto-merge. Whether
> to enable the setting or amend the table is deferred to epic #864 task 6.1.

No policy change is proposed here.
