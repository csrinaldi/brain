---
status: archived
issue: 890
archived_at: 2026-09-17
archived_against: 51c5a06c (origin/main, PR #1018 squash-merged)
---

# Archive report — issue-890-retire-feature-pr-memory-surfaces

**The change is closed.** Issue #890 (memory 2.0 epic #864, task 3.1d) shipped as
PR #1018, squash-merged into `main` as `51c5a06c` on 2026-09-17, after the
prerequisite PR #1013 (`c96889de`) fixed the test that could ship the memory lane
for real. All 12 tasks are `[x]`, the 5 requirements and 11 scenarios of the two
delta specs carry passing runtime coverage, and the post-merge verify report
returned **pass** with 0 CRITICAL and 0 WARNING.

## What was archived

`npm run brain:change:archive -- issue-890-retire-feature-pr-memory-surfaces`
moved the change folder to `openspec/changes/archive/890/` (the path owned by
`archivePath(iid)` in `brain/scripts/lib/sdd-layout.mjs`) and appended each delta
spec body, under a `[issue-890]` provenance header dated 2026-09-17, to its central
spec:

| Delta | Central spec | Requirements |
|---|---|---|
| `specs/feature-working-memory/spec.md` | `openspec/specs/feature-working-memory/spec.md` | REQ-S0-2, REQ-S4-1 (modified) |
| `specs/governance/spec.md` | `openspec/specs/governance/spec.md` | REQ-S5-3 (removed), REQ-S5-5 (modified), REQ-S5-7 (added) |

The archived folder keeps `proposal.md`, `design.md`, `tasks.md`, `apply-progress.md`
(five batches, including the incident record), `verify-report.md` (post-merge,
`gentle-ai.verify-result/v1` envelope, evidence revision
`sha256:9ccacbbab43de1b3d7a456c65fc443f6e27f6b00c894b72ebb8954e7231c0566`),
`specs/` and `brain-drafts/`.

## Delivery

- `c96889de` — PR #1013 (`fix(test)`, closes #1011, refs #1012): the
  `session-end-ship` test reads the real config and drives the module through its
  seams, so it can never spawn the lane for real again.
- `51c5a06c` — PR #1018 (`feat(memory)`, closes #890): lane enabled, `pre-push`
  checkpoint-only, `brain:save` retired with no shim, `brain:next` state machine,
  operator wording, and three maintainer-signed commits promoted inside the PR:
  `7ac4e844` (`brain/core/managed-paths.mjs`, `brain:save` leaves
  `MANAGED_SCRIPT_KEYS`), `747a6266` (`consolidation-protocol.md` §5) and
  `5c3fc4ac` (ADR-0034 Amendment 3 with the `brain/HOME.md` index line and the
  regenerated `AGENTS.md`).

## Verification at archive time

- `npm test` on `51c5a06c`: 5588 passed, 0 failed.
- `npm run brain:repo:check && npm run brain:nav`: clean.
- `node --test brain/scripts/harness/backends/antigravity.drift.test.mjs`: 5/5.
- Lane safety around the suite run: no `memory/*` ref and no pull request appeared
  on `origin`.

## Incident recorded during the change

Running `npm test` with `memory.lane.enabled: true` in the tracked config made a
pre-existing unmocked test spawn the real `session-end-ship`, which pushed a lane
branch and auto-merged PR #1007 into `main` (three memory records, no code).
The instance is fixed by PR #1013; the class is owned by issue #1012 (runtime
invoker guard, a sweep of every test that spawns a real entrypoint, and an
anti-pattern draft for human promotion). The doctrine in `apply-progress.md`
batch 1 and issue #1012 is the record.

## Open follow-ups

- #1012 — the incident class (approved, not started).
- Two SUGGESTION-level coverage gaps from the reviews: `pre-push`'s
  empty-`repo_root` branch is untested, and `brain-next`'s precedence of an open PR
  over failing local checks is unasserted.
- `docs/inbox/**` still mentions retired surfaces; that zone is ungoverned by
  design and was left alone.

## Notes for the next archive

- `gentle-ai` 2.9.0 counts delta-spec requirements only under the
  `### Requirement: <name>` heading form; the delta files were normalized to that
  form before archive so the native gate could compute 5/11. The central specs
  keep their `### Requirement REQ-...: <name>` form.
- The native verb, not a hand-written folder, decides the archive path.
