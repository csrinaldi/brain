# Apply progress: issue-921-923-observability

Strict TDD. Test runner: `node --test <file>` (focused) + `npm test` (full),
always under `GIT_CONFIG_GLOBAL=/dev/null`.

## Commits

| Commit | Summary |
|---|---|
| `24d452d3` | fix(memory): collectLane() reports unreadable worktrees instead of dropping them (#921) |
| `3e7db3d4` | feat(memory): surface skipped worktrees through ship and the CLI (#921) |
| `034b5dee` | fix(session-start): preserve the engram hydration failure cause (#923) |

(Record-first closing commit and openspec-artifact commit follow separately.)

## Tasks — all complete

See `tasks.md` — all 17 items `[x]`.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1-1.2 collect.mjs `skippedWorktrees` | 2 new tests in `collect.integration.test.mjs` written first; failed against pre-fix `collect.mjs` (2/11 fail) | Implemented `skippedWorktrees` capture + both return paths; 11/11 pass | None needed |
| 1.3 ship.mjs forwarding | 2 new tests in `ship.test.mjs` (full run + dry-run) written first; failed (2/40 fail) | Destructure + default `[]` + include in `base`; 40/40 pass | None needed |
| 1.4-1.6 cli.mjs stderr + i18n | 2 new tests in `cli.collect.test.mjs` written first; 1 failed (empty-stderr assertion) | Added stderr block in `collect` and `ship` ops + i18n keys (en/es); 10/10 (+80/80 combined with ship CLI) pass | None needed |
| 2.1 step2HydrateEngram reason | Rewrote 2 existing tests + added 1 new one, expecting `{ok:false, reason}`; failed against pre-fix shape (5/68 fail) | Implemented stderr/exit-code/exception-message capture | None needed |
| 2.2 renderContextBlock reason line | New test asserting cause appears, bare line does not, when `reason` present | Additive branch in `renderContextBlock`; old bare-skip test (no `reason`) stays green unmodified | None needed |
| 2.4 step5 decision recorded | N/A — documentation only, no behavior change | N/A | Comment added on `runSessionStart`, linked to #267 |

## Mutation table (revert-one-prove-one)

| Reverted file | Tests that go red | Tests unaffected |
|---|---|---|
| `collect.mjs` (skippedWorktrees) | `collect.integration.test.mjs`: 2/11 (`#921 — a worktree whose git status fails...`, `#921 — no skipped worktrees...`) | 9/11 other collect.integration tests |
| `session-start.mjs` (step2HydrateEngram + renderContextBlock) | `session-start.test.mjs`: 5/68 (3 step2HydrateEngram shape tests + 1 renderContextBlock reason test + 1 resolveSessionStrings catalog-parity test) | 63/68 other session-start tests |

Each guard was proven independently: `git stash push -- <file>` isolated
exactly that production change, the paired test file was re-run (RED
confirmed, only the new/updated tests failed), then `git stash pop` restored
the fix (GREEN reconfirmed). `ship.mjs`'s guard was proven the same way via
its own RED run before implementation (2/40 failed, then 40/40 after).

## Test counts

- Focused suites after fix: `collect.integration.test.mjs` 11/11,
  `ship.test.mjs` 40/40, `ship.integration.test.mjs` + `cli.ship.test.mjs` +
  `day-start-sweep.test.mjs` + `session-end-ship.test.mjs` combined 58/58,
  `cli.collect.test.mjs` 10/10, `session-start.test.mjs` 68/68,
  `i18n/coverage.test.mjs` green (both files combined report 115/115),
  `chunk-boundary.test.mjs` 15/15 (pinned-line fix).
- Full `npm test` under `GIT_CONFIG_GLOBAL=/dev/null`: **5285/5285 green**
  (baseline was 5277/5277; net +8: +2 `collect.integration.test.mjs`, +2
  `ship.test.mjs`, +2 `cli.collect.test.mjs`, +2 `session-start.test.mjs` —
  the latter is 3 new tests replacing 2 rewritten-in-place ones, net +1,
  plus +1 new `renderContextBlock` reason test).
- No `brain/scripts/scratch/` debris was present at any point in this run
  (checked before and after the full suite).
- One transient failure was measured, not assumed pre-existing:
  `chunk-boundary.test.mjs`'s pinned import-line allowlist (`cli.mjs`
  line 624) broke because THIS change's own edits to `cli.mjs` pushed that
  import 20 lines down to 644. Confirmed the cause (not a flake, not
  pre-existing) by reading the diff, then fixed the pinned row in the same
  work unit that grew `cli.mjs` — see the second commit.

## Consumers checked (#921 shape change)

| Consumer | Outcome |
|---|---|
| `memory/cli.mjs` | Updated — prints the new line in both `collect` and `ship` ops. |
| `memory/lane/ship.mjs` | Updated — forwards the field, defaulted for older fakes. |
| `memory/session-end-ship.mjs` | Unchanged — already redirects the `ship` child's stdout+stderr into its private log verbatim; tests re-run, 58/58 green, no regression. |
| `memory/day-start-sweep.mjs` | Unchanged — `laneSweepLine()` treats `sweep.outcome` as an opaque parsed object; the field is available to it without modification. Tests re-run green. |

## Deviations / things not done

- Did not wire `step5SynthesizeContext` into `runSessionStart()` — explicit
  non-goal per the ticket (acceptance B is a product decision, recorded as a
  code comment, not resolved here).
- Did not touch `brain/core/**` or `brain/project/**`.
- Did not run `memory:ship`/`memory:collect`/`memory:share`, did not push,
  did not open a PR, did not hit a real remote.
- Epic tasks 4.7 and 4.9 in `openspec/changes/issue-864-memory-2-0/tasks.md`
  ticked `[x]`, cross-referencing this change.

## Fresh adversarial review batch (F1–F5)

Branch `fix/issue-921-923-observability`, worktree
`/home/gandalf/IA/brain-fix-observability`. All five review findings closed.

### Commits

| Commit | Summary |
|---|---|
| `6f123ff2` | fix(memory): cover the ship op's worktreeSkipped print, guard and name the reason (#921) |
| `8741100f` | fix(memory): day:start lane sweep distinguishes a skipped worktree from "nothing to ship" (#921, #923) |
| `84926cb3` | docs(sdd): reword 4.9's checkbox to what issue-921-923-observability actually delivered |

### F1 (HIGH) — ship op's print had zero coverage

Added `#921 — memory:ship prints memory.collect.worktreeSkipped...` to
`cli.ship.test.mjs`, mirroring `cli.collect.test.mjs`'s own equivalent.

RED/GREEN proof (temporary mutation, reverted before commit):
- Deleted the entire skippedWorktrees print block in the `ship` op →
  `node --test cli.ship.test.mjs`: **23/24 pass, 1 fail** — only the new
  test failed; all 23 pre-existing ship tests stayed green (confirms the
  reviewer's "zero coverage" claim: nothing else depended on this block).
- Restored the block → **24/24 pass** (GREEN).

### F2 (HIGH) — day:start sweep masked the skipped-worktree fact

`laneSweepLine()` (`day-start-sweep.mjs`) now branches on the already-parsed
`outcome.skippedWorktrees` (never reads stderr — `runLaneSweep()` above never
captures it) as a replacement for the `nothing` fallback only. Added
`day.memory.laneSweep.worktreeSkipped` to `en.mjs`/`es.mjs`.

Operator-visible text, before vs. after:
- Nothing pending, nothing skipped: `Lane sweep: nothing to ship.` (unchanged).
- Nothing pending, 1 worktree skipped: **before** — identical line, the skip
  was invisible; **after** — `Lane sweep: nothing to ship, but 1 worktree(s)
  could not be inspected: /repo/wt-b (fatal: not a git repository)`.

Scope boundary (documented, not silently narrowed): a `pushed`/`reconciled`
run that also skipped a worktree still renders `shipped`/`reconciled` —
checked and pinned by its own test
(`pushed:true with a skipped worktree still renders "shipped"`). That
combination's count/paths remain available via `--json` and the SessionEnd
log; folding it into the single-line render was judged out of this fix's
scope.

SessionEnd half: confirmed unchanged and correct —
`session-end-ship.mjs:176-186` passes `stdio: ['ignore', fd, fd]`, so
stdout+stderr both land in the same fd; it already inherits the ship
child's stderr verbatim, no code change needed there.

RED/GREEN proof (temporary stash of `day-start-sweep.mjs` only, test file
kept): pre-fix → **19/20 pass, 1 fail** (only the new worktreeSkipped test);
post-fix (stash popped) → **20/20 pass**.

### F3 (LOW) — unguarded reads at cli.mjs:365/523

Both sites now read `result.skippedWorktrees ?? []`, mirroring `ship.mjs`'s
own defensive default. No new automated regression test was added for this
guard specifically: both real producers (`collect.mjs`, `ship.mjs`) always
populate the field today and there is no CLI-level seam to inject a fake
`collect` step (unlike `ship`'s own `BRAIN_VCS_TEST_MODULE` seam, which only
fakes the vcs port, not `collect`) — so no reachable path exists, through
production code or any existing test harness, that produces the pre-guard
crash. Inventing an artificial seam solely to exercise this LOW-risk,
no-live-bug defensive line was judged disproportionate. Full suite re-run
green with the guard in place (see Test counts below).

### F4 (LOW) — text surface named the path but never the reason

Both `cli.mjs` stderr lines now append `(${w.reason})` per worktree, matching
what `--json` already carried. Extended (not duplicated) the existing
worktree-skip tests in `cli.collect.test.mjs` and `cli.ship.test.mjs` with a
`/not a git repository/i` assertion, proven RED against the pre-fix line
(count+path only) and GREEN after.

### F5 (LOW) — honest checkbox

`openspec/changes/issue-864-memory-2-0/tasks.md` 4.9 reworded (not unticked):
the row's own text demanded `step5SynthesizeContext` be "either wired or
retired (#267)" — neither happened. Chose reword over untick because the
task's actually-scoped, deliverable half (hydration-failure-cause
preservation) is genuinely complete; the wiring question is an explicit open
product decision this task never owned, not an unresolved bug the checkbox
should keep flagging as open work.

### Test counts (this batch)

- Focused (9 files, includes every touched suite): **178/178 green**.
- Full `npm test` under `GIT_CONFIG_GLOBAL=/dev/null`: **5289/5289 green**
  (prior baseline 5285/5285; net +4 — 1 new ship-op test (F1), 3 new
  day-start-sweep tests (F2): the worktreeSkipped case, its "still nothing"
  regression guard, and the pushed-wins-over-skip scope-boundary test). F4's
  assertions extended two EXISTING tests rather than adding new ones.
- No `brain/scripts/scratch/` debris present before or after.
- No forbidden paths touched (`brain/core/**`, `brain/project/**`); no
  `.memory/index.jsonl`/`manifest.json` staged; no push, PR, `gh` write,
  `memory:ship`/`collect`/`share` against a real remote, `--force`,
  `--no-verify`, merge, or rebase.

### Where (this batch)

- `brain/scripts/memory/cli.mjs`, `cli.collect.test.mjs`, `cli.ship.test.mjs`
- `brain/scripts/memory/day-start-sweep.mjs`, `day-start-sweep.test.mjs`
- `brain/scripts/memory/chunk-boundary.test.mjs` (pinned-line re-fix, 644→655)
- `brain/scripts/i18n/en.mjs`, `brain/scripts/i18n/es.mjs`
- `openspec/changes/issue-864-memory-2-0/tasks.md` (4.9 reworded)
- `openspec/changes/issue-921-923-observability/apply-progress.md` (this file)
