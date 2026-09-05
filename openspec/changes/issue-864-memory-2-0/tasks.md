---
status: draft
issue: 864
---

# Tasks: #864 — memory 2.0

Each task is a slice with its own ticket, change dir, worktree and PR to `main`
(design.md §4). Check the box in the slice's PR. The last task is the epic's exit.

## Wave 0 — stop the bleeding
- [ ] 0.1 #820 — skip-and-say mitigation around `import`; the ticket states that the fix is #863's contract, not this guard. Detector for duplicated `rec-` keys lands here or in #863 (design.md §2 D2).

## Wave 1 — rulings
- [ ] 1.1 #862 — the lane ruling recorded (ADR-0002 amendment or new ADR); `consolidation-protocol.md §5` rewritten; lane contract (trigger, branch grammar, path restriction, merge rule) fixed.
- [ ] 1.2 #863 — the backend contract document exists beside `vcs-contract.md`; engram and plainfiles measured against it; `harness-contract.md:32-34` rewritten in records vocabulary.

## Wave 2 — prerequisites
- [ ] 2.1 #805 — a writer for `supersedes` (`memory:save --supersedes <id>`), refusing an id absent from the store; ruling on deletion recorded.
- [ ] 2.2 #738 — provenance at capture: a fresh record carries `actor`, `actorKind`, `issue`, never `@legacy`; guard at `exportObservation`; ruling on `actorKind: unknown`.
- [ ] 2.3 #247 — chunk materialization retired; `share` reads no chunk file; consumers read records.

## Wave 3 — implementation
- [ ] 3.1 lane implementation (slice ticket under #862): a record captured on an unmerged branch reaches `main`; a feature PR adds nothing under `.memory/records/`; path restriction enforced.
- [ ] 3.2 record-first capture (slice ticket under #863): the agent's capture produces a record, the backend hydrates from it; two sessions on one topic yield two records, the later `supersedes` the earlier.

## Wave 4 — hardening
- [ ] 4.1 #361 — reindex parity between backends, per the contract.
- [ ] 4.2 #461 — `source` citing an undeclared issue no longer fabricates `issue`.
- [ ] 4.3 #712 — unparseable `brain.config.json` is "could not look", never "found nothing", on the `share` path.
- [ ] 4.4 #714 — suite verdict independent of `BRAIN_MEMORY_UPSTREAM_REF`.
- [ ] 4.5 #638 — duplicate-report strings in the i18n catalogs.

## Close / amend
- [ ] 5.1 #795 closed in favour of #862 once 3.1's first scenario passes.
- [x] 5.2 #313 banner points to #864 (done 2026-09-05).

## Exit
- [ ] 6.1 `brain:change:verify issue-864-memory-2-0` — every spec.md scenario re-measured under `engram` AND `plainfiles`; each number written on #864 beside the one it replaces (p50 learn→main vs 10.9 h; `rec-` distinct = rows vs 2336/2339; fresh record attributed vs 80% `@legacy`; unmerged-branch record on `main`; `supersedes` written by an agent).

## Review Workload Forecast
- Estimated changed lines (this PR): ~260, all under `openspec/changes/issue-864-memory-2-0/` — planning artifacts, no code.
- 400-line budget risk: Low.
- Chained PRs recommended: No — this PR is the epic's contract; slices are separate PRs by design (design.md §4).
- Decision needed before apply: No.

## Micro-decisiones en caliente
- 2026-09-05 — stacked-to-main, no tracker branch: a tracker for a memory epic would strand the epic's own records (design.md §4).
- 2026-09-05 — the agnosticism test ("does it hold under plainfiles?") is the acceptance filter for every slice, written into spec.md as the first requirement.
