---
change: issue-862-memory-lane
status: verified
verified_at: 2026-09-09
head: 2c2105a6617b2489ad4b3e4c775407c59685dc6c
---

# Verify Report — issue-862-memory-lane

**Verdict: PASS — READY TO ARCHIVE.**
Engram: `sdd/issue-862-memory-lane/verify-report`.

This is a **ruling ticket** (#862, Wave 1 task 1.1 of #864). It implements nothing itself. Per
the ruling ticket bar: it passes when its decisions are recorded in doctrine and every spec
requirement has an owning slice ticket — not when the slices are built.

## Task completeness

All five sections of `tasks.md` are `[x]`. Sections 1–4 were closed and pushed on the apply run
(PR #891, merged `a14ff426`). Section 5 (the PR itself + the follow-up ticket) was authorised and
closed at the orchestrator/maintainer's own sitting, per the note at the end of section 5: PR
#891 opened/merged, `brain:review` run twice (round 1 APPROVE with corrections, round 2 clean),
follow-up #892 filed and its PR #893 merged (`2c2105a6`). Local `tasks.md` in this worktree
carries that closing text uncommitted (documentation only, not re-pushed) — it matches the actual
GitHub state verified below, so it is a record of fact, not an open task.

## REQ → doctrine → owning slice

| Requirement | Doctrine evidence | Owning slice | Status |
|---|---|---|---|
| lane recognition is narrow and structural | ADR-0034 §L1 (`brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`); design.md L1 | #889 (`lane-paths`, issue-link/actor-check lane branch) | PASS |
| merge auto-merges only where the tier allows | ADR-0034 §L2; design.md L2 | #886 (`mrAutoMerge`) | PASS |
| secret scrub is a required lane check (C1) | ADR-0034 §"L2 + C1 — Merge by tier, gated by a required secret scrub" | #889 (`lane-scrub`, C1 stated explicitly in ticket body) | PASS |
| index stays off the lane | ADR-0034 §L3; consolidation-protocol.md §5 | #889 (two-lanes-one-index rule) | PASS |
| collector, deterministic dedup (C2) | ADR-0034 §L4 ("first-wins rule the reader already uses") | #887 (C2 stated explicitly in ticket body) | PASS |
| trigger + credential separated | ADR-0034 §L5 | #888 (`brain:memory:ship`, ADR-0033 credential rule) | PASS |
| `memory-gate` unchanged / template wording | ADR-0034 §L6/L7; consolidation-protocol.md §5 | #890 | PASS |
| feature-PR surface retirement, sequenced | ADR-0034 §L7; spec.md "retirement is sequenced" | #890 (sequencing gates stated: #888's first scenario + #874) | PASS |
| latency targets ratified (L9) | ADR-0034 §L9; consolidation-protocol.md §5 (baseline + targets stated) | epic exit 6.1, measured by `memory:audit` (#870) — by design, not a Wave-3 slice | PASS |

Dependency chain 2.5 (#886) → 3.1a (#887) → 3.1b (#888) → 3.1c (#889) → 3.1d (#890) is stated in
every ticket body's "Dependencies" section, cross-referencing #805 (supersedes, gates #888's
auto-merge *enablement*, not its filing) and #874 → epic task 2.4 (gates #889/#890's *shipping*,
not filing) — matches design.md's dependency diagram exactly. Epic `tasks.md` (issue-864-memory-2-0)
carries all five numbers on tasks 2.5 and 3.1a–3.1d.

## Doctrine promotion — draft vs. landed text

- `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md` — **exists**. Diffed
  against `openspec/changes/issue-862-memory-lane/brain-drafts/adr-0034-memory-travels-on-its-own-lane.md`:
  only the status/date header line differs (`proposed — pending human promotion` →
  `**Status**: Accepted`), which is `transformDraft`'s expected promotion rewrite. Body identical.
  Listed in `brain/HOME.md:85`.
- `brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md` — carries **"Amendment 2 — the
  canonical flow points at the lane (issue #862)"** (line 77), landed via the `brain-amendment/1`
  act on top of #863's Amendment 1.
- `brain/core/methodology/consolidation-protocol.md` §5 — rewritten (lines 194–202): states the
  lane's actual flow (record reaches `main` on its own PR via the collector, merged by tier),
  cites the ratified L9 targets against the measured baseline, and **deliberately keeps** the
  "until the memory lane exists, records still travel with the branch" caveat with an explicit
  note that the amendment does not touch it — correct, since 3.1b's first scenario has not yet
  passed on `main` (the caveat drop was conditioned on that, per design.md's task 2.2 note).
- `openspec/README.md` rule 3 (lines 25–28) — carries the lane exception, citing ADR-0034 and #862.

All four promotions landed via PR #893 (`Closes #892`), cold-reviewed round 1 APPROVE (four
citation corrections) → round 2 APPROVE, merged `2c2105a6`.

## Checks run (read-only, on `head` above)

| Check | Command | Result |
|---|---|---|
| Filed-ticket ownership + dependency text | `gh issue view {886..890} --json body,labels,state` | All 5 OPEN, `status:approved` + `type:feature`, each body states `Parent: #864`, its owned REQ(s), and dependency chain — PASS |
| PR merge + review state | `gh pr view 891/893 --json state,mergeCommit,reviews` | Both `MERGED` (`a14ff426`, `2c2105a6`); cold-review bot comments recorded on both (see engram #3222/#3225 for round-by-round APPROVE verdicts — GitHub's review API surfaces the bot's structured comments as `COMMENTED`, not a native `APPROVE` state, but the recorded review text and the merge itself are the operative evidence) | PASS |
| Doctrine drift / draft-vs-landed diff | `diff` draft vs. `brain/project/decisions/adr-0034-*.md` | Identical except the expected status-line promotion rewrite | PASS |
| AGENTS.md byte-equality to compiled SOURCE_DOCS | `node --test brain/scripts/harness/backends/antigravity.drift.test.mjs` | 5/5 pass, 0 fail | PASS |
| `brain/` navigation integrity | `npm run brain:nav` | "sin huérfanos, sin links rotos, sin rutas citadas inexistentes" | PASS |
| Non-goal: no `memory-gate` logic change | `git show --stat a14ff426 2c2105a6 \| rg -i "memory-gate\|run-check"` | no matches | PASS |
| Non-goal: nothing under `brain/scripts/` touched | `git show --stat --format="" a14ff426 2c2105a6 \| rg "brain/scripts"` | no matches | PASS |
| Status frontmatter bumped to `tasked` on all 5 artifacts | `rg "^status:" {explore,proposal,spec,design,tasks}.md` | all 5 read `tasked` | PASS |

## Findings

- **CRITICAL**: none.
- **WARNING**: none.
- **SUGGESTION**: `gh pr view --json reviews` reports the cold-review bot's verdicts as
  `COMMENTED` rather than a native GitHub `APPROVE`/`CHANGES_REQUESTED` review state — this
  appears to be how the review tooling posts its structured comments rather than using GitHub's
  review-state API. Cross-checked against engram records (#3222, #3225) which log the bot's
  actual round-by-round APPROVE text for both PRs, so this is a reporting-surface quirk, not a
  gap in the review evidence. No action required for this change; worth noting for future
  verify runs relying solely on the GitHub review-state field.

## Scope discipline

Non-goals from proposal.md held: no gate added on feature PRs, no change to `memory-gate`'s
logic, no dependency on the backend introduced — confirmed by the merge-commit stat checks above
and by ADR-0034/#890's explicit "memory-gate itself is UNCHANGED" text.

**Ready to archive: YES.**
