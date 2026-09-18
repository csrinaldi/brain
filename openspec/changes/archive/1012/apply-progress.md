# Apply Progress: Lane-Ship Invoker Guard (#1012)

Status: all 24 tasks complete (Phases 1-5). This is the first and only apply batch.
Structured for READ-MERGE-WRITE if a later batch is ever needed — currently there is
no remaining work.

## Summary

Implemented the full invoker guard per design.md: `decideShipInvoker()` in a new
pure module, wired into `cli.mjs`'s `ship` op before any credential read or VCS
call; both real callers (`session-end-ship.mjs`, `day-start-sweep.mjs`) and the
`brain:memory:ship` npm script (+ bare alias) now declare their invoker; a new
meta-test enforces a closed allowlist over every test that spawns a
`brain/scripts/**` runtime entrypoint; an anti-pattern draft was placed under this
change's own `brain-drafts/`, never under `brain/core/**`.

## Tasks completed (24/24)

Phase 1 — RED coverage: 1.1-1.7 — all done.
Phase 2 — Guard + caller markers GREEN: 2.1-2.8 — all done.
Phase 3 — Meta-test + allowlist: 3.1-3.4 — all done.
Phase 4 — Anti-pattern draft: 4.1-4.2 — all done.
Phase 5 — Verification: 5.1-5.3 — all done.

See `tasks.md` for the per-task `[x]` marks (all 24 marked complete in this batch).

## Files changed

Governed (subject to the 400-line budget):
- `brain/scripts/memory/lib/ship-invoker.mjs` (new) — `INVOKERS`, `REFUSAL`, `decideShipInvoker({args, env})`
- `brain/scripts/memory/cli.mjs` — guard call wired between argv parsing and the `try`; `invoker` spread into `--json` output
- `brain/scripts/memory/session-end-ship.mjs` — `--invoker hook` appended to the spawn argv; doc comment updated
- `brain/scripts/memory/day-start-sweep.mjs` — `--invoker sweep` appended to the spawn argv; doc comment updated
- `package.json` — `memory:ship` and `brain:memory:ship` scripts now end `--invoker manual`
- `brain/scripts/i18n/en.mjs`, `brain/scripts/i18n/es.mjs` — `memory.ship.invokerMissing`, `.invokerUnderTest`, `.invokerInvalid`
- `CHANGELOG.md` — Unreleased entry

Tests (ignored by governance, `**/*.test.mjs`):
- `brain/scripts/memory/lib/ship-invoker.test.mjs` (new)
- `brain/scripts/memory/cli.ship-invoker.test.mjs` (new)
- `brain/scripts/memory/cli.ship.test.mjs` (modified — invoker JSON assertions, source-order guard, pinned body update)
- `brain/scripts/memory/session-end-ship.test.mjs` (modified — argv pin, A2 strict-identity check)
- `brain/scripts/memory/day-start-sweep.test.mjs` (modified — argv pin, no-env-key check)
- `brain/scripts/memory/package-scripts.test.mjs` (modified — `ship` verb gets `--invoker manual` in the expected body)
- `brain/scripts/test-spawn-hygiene.test.mjs` (new) — the meta-test + allowlist (~64 entries)
- `test/lane-ship-invoker.e2e.test.mjs` (new) — the 4 real-caller e2e scenarios
- `brain/scripts/memory/chunk-boundary.test.mjs` (modified, incidental) — a pre-existing line-pinned allowlist for `cli.mjs` shifted from line 652 to 665 because of the guard insertion; updated to keep D4 guard 2 green. This is the ONE file touched outside #1012's own direct scope; flagged here explicitly.

Drafts (ignored by governance, `openspec/changes/**`):
- `openspec/changes/issue-1012-lane-ship-invoker-guard/brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md` (new)
- `openspec/changes/issue-1012-lane-ship-invoker-guard/brain-drafts/anti-patterns/README-index-line.md` (new)
- `openspec/changes/issue-1012-lane-ship-invoker-guard/apply-progress.md` (this file)
- `openspec/changes/issue-1012-lane-ship-invoker-guard/tasks.md` (checkboxes marked)

No file under `brain/core/**`, `brain/project/**`, `AGENTS.md`, or `.memory/**` was touched.

## Deviations from a strict RED-before-GREEN order (disclosed)

- Task 1.2 (`cli.ship-invoker.test.mjs`) was written and run for the first time
  AFTER the guard (2.1/2.2) was already implemented, so it never observed a true
  RED against the pre-guard `cli.mjs`. To compensate, the guard call in `cli.mjs`
  was manually, temporarily reverted and this file's 3 tests were re-run: 2 of the
  3 failed for the expected reason (case (a) hit the real "not a git repository"
  error from `collect()`, exactly as design.md predicts for the pre-guard state;
  case (b) fell through into the real port attempt instead of refusing). The guard
  was then restored and all 3 passed again. Evidence is in the transcript; not
  re-run here to avoid re-touching `cli.mjs` in this batch.
- Task 1.7 (`test/lane-ship-invoker.e2e.test.mjs`) was similarly written after
  2.4/2.5/2.6 already added `--invoker` to both real callers, so it never observed
  scenarios (1)/(3) failing "for real." This one was not re-verified against a
  reverted caller (the e2e file's real npm-spawns make a revert-and-rerun far more
  expensive); the correctness of scenarios (1)-(4) rests on the same guard logic
  already proven RED→GREEN at the unit level (1.1) and the CLI level (1.2's
  reverted re-run above), plus this file's own two-tries-stable pass record.

Both deviations are process-order issues only — the assertions themselves are
real end-to-end checks against real child processes, not weakened to compensate.

## Verification evidence

- Focused suite (`brain/scripts/memory/lib/ship-invoker.test.mjs
  brain/scripts/memory/cli.ship-invoker.test.mjs brain/scripts/memory/cli.ship.test.mjs
  brain/scripts/memory/session-end-ship.test.mjs brain/scripts/memory/day-start-sweep.test.mjs
  brain/scripts/memory/package-scripts.test.mjs brain/scripts/test-spawn-hygiene.test.mjs
  test/lane-ship-invoker.e2e.test.mjs`): 101/101 pass.
- `npm test` (lane-safety guarded, see below): 5632/5632 pass, after fixing one
  pre-existing line-pinned allowlist collision in `chunk-boundary.test.mjs` (see
  Files changed above).
- Lane safety: `git ls-remote origin 'refs/heads/memory/*'` and
  `gh pr list --repo csrinaldi/brain --state open` were identical before and after
  both the e2e run and the full `npm test` run — no real lane ref or PR was ever
  created.
- `npm run brain:repo:check`: PASS. `npm run brain:nav`: PASS.
- `npm run brain:check`: `diffSize` PASS, `adrPresence` PASS, `memoryPresence`
  PASS, `repoCheck` PASS. `issueLink` and `npmTest` FAIL — both expected in this
  run: no commit/PR exists yet (this batch deliberately does not commit), so there
  is no issue-closing keyword to find and the checker's own npmTest heuristic reads
  against PR context that does not exist here.
- Diff size: governed (per `brain.config.json`'s `governance.ignoreList`) = 179
  added / 9 deleted = 188 lines total, comfortably under the 400-line default
  budget (design.md estimated ~85; the guard module's header comments account
  for most of the difference). Raw total (including all new test files, the
  meta-test's ~64-entry allowlist, and the two brain-drafts files) = 1932 added /
  16 deleted = 1948 lines, all governance-ignored.

## Pre-existing, untouched artifact noted (not part of this change)

`.memory/index.jsonl` shows as modified in `git status` in this worktree — two
records (issue #890, #1011) already indexed, dated 2026-09-17, predating this
session. This file is on `governance.ignoreList` and was never touched by any
edit in this batch; flagged here only for transparency, not remediated.

## Commit plan (NOT executed in this batch — plan only, per delivery_strategy)

Conventional commits, `(#1012)`, no attribution trailers (repo's `commit-msg`
hook rejects them):

1. `test(memory): add RED coverage for the ship-op invoker guard (#1012)`
   — `brain/scripts/memory/lib/ship-invoker.test.mjs`,
     `brain/scripts/memory/cli.ship-invoker.test.mjs`,
     the RED-edited assertions in `cli.ship.test.mjs`, `session-end-ship.test.mjs`,
     `day-start-sweep.test.mjs`, `package-scripts.test.mjs`,
     `test/lane-ship-invoker.e2e.test.mjs`.
2. `feat(memory): refuse cli.mjs ship without a declared or test-context invoker (#1012)`
   — `brain/scripts/memory/lib/ship-invoker.mjs`, `cli.mjs`, `i18n/en.mjs`,
     `i18n/es.mjs`, `session-end-ship.mjs`, `day-start-sweep.mjs`, `package.json`,
     `CHANGELOG.md`.
3. `test(scripts): enforce a closed spawn-hygiene allowlist for runtime spawns (#1012)`
   — `brain/scripts/test-spawn-hygiene.test.mjs`,
     `brain/scripts/memory/chunk-boundary.test.mjs` (incidental line-pin fix).
4. `docs(anti-patterns): draft test-spawns-a-live-entrypoint for maintainer promotion (#1012)`
   — both `brain-drafts/anti-patterns/*.md` files.

Single PR (per tasks.md's Review Workload Forecast — governed diff well under
budget; chain_strategy `feature-branch-chain` stays pre-selected but unused).

## Batch 2 — cold-review fixes and orchestrator verification (2026-09-18)

- Cold review (fresh context): APPROVE, no BLOCKER or MAJOR. Two MINOR findings and one NIT, all fixed here.
- `brain/scripts/memory/cli.mjs`: the ship block's three dynamic imports ran before `decideShipInvoker()`. The guard is now the first statement of the block, before any module load. `cli.ship.test.mjs`'s source-order test gains `guard < first "await import("`; RED proven by temporarily moving one import above the guard (the new assertion failed), then restored byte-identical.
- `brain/scripts/memory/chunk-boundary.test.mjs`: the pinned `cli.mjs` line moved again, 665 → 666, forced by the reorder.
- Anti-pattern draft: removed the draft-only `Status` and `Registered` sections so the file copies verbatim; split the second lesson into its own rule (a seam-presence check must not stand in for the mechanism); corrected "issue #1007" to PR #1007 (incident) / issue #1012 (class). The index line and promotion steps moved into `README-index-line.md`, now titled "Promotion notes". REQ-SHIP-5's wording was aligned to that layout.
- Orchestrator mutation checks on the e2e file (the executor's admitted gap, task 1.7): removing `--invoker hook` from `session-end-ship.mjs` turns e2e case 1 red; removing `--invoker sweep` from `day-start-sweep.mjs` turns the sweep e2e case and the sweep argv pin red. Both restored byte-identical.
- Evidence after the fixes: focused 55/55 on the touched files; `npm test` 5632/5632; `brain:repo:check` and `brain:nav` clean; `brain:check` diffSize PASS; lane refs and open PRs identical before and after each full run.
- Commit plan revised: tests travel with the code they cover, so no intermediate commit is red and no intermediate commit leaves the hook refused.
