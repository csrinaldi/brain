---
status: apply-partial
issue: 888
---

# Apply progress — #888 the lane ships

> **Read this note before the rest of the file below.** This file was last
> updated at the end of batch 1. Batch 2 (a correction pass on the library
> slice, #901) ran in a **different worktree**
> (`/home/gandalf/IA/brain-issue-901`) and is documented ONLY in engram
> (`sdd/issue-888-lane-ship/apply-progress`, id 3269) — not here, since this
> file lives in this worktree and batch 2 never touched it. Batch 2's result:
> #901 (the library) merged as **PR #902**, commit `16493771`. See the
> "PR 2 (batch 3)" section at the end of this file for what happened next, in
> THIS worktree, on top of that merge.

Batch 1 (first batch — no previous apply-progress existed). Worktree
`/home/gandalf/IA/brain-issue-888`, branch
`feat/issue-888-featmemory-the-lane-ships-push-and-pr-th`.

## Status: 13/13 implementation tasks complete (sections 1-6), 2/13 committed

All of sections 1-6 (artifact status bumps, credential-env denylist, unit
`shipLane`, integration `shipLane`, the pre-push non-invocation pin, and the
CLI `ship` op + i18n + package.json) are **implemented and GREEN** — `npm
test` passes at 5008/5008. Wrap-up (section 7) and PR (section 9) are left
for the orchestrator per the launch instructions.

**Only work unit 1 is committed.** Work units 2-4 are fully implemented,
tested, and staged-ready in the working tree, but **cannot be committed**
because of a discovered blocker outside this batch's write scope — see
"BLOCKER" below. This is the reason for `partial` status, not any
incomplete or failing code.

## TDD Cycle Evidence

| # | Task | File | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 1 | 2.1/2.2 | `lib/credential-env.mjs` (+test) | confirmed: `MEMORY_TOKEN_ENV` undefined, pinned list mismatched | 10/10 pass | comment added explaining the literal-vs-derived choice |
| 2 | 3.1/3.2 | `lane/ship.mjs` (+ `ship.test.mjs`) | confirmed: module not found | 24/24 pass (23 initial + 1 added for the A4 branch-parsing fix, see Deviations) | A4 fix: title/body now parsed from `branch`, not raw `host`/`date` params (see Deviations) |
| 3 | 4.1/4.2 | `lane/ship.integration.test.mjs` | ship.mjs already existed (task 3.2) — this file drives it against real git for the first time; all 5 assertions passed on first run | 5/5 pass | none needed |
| 4 | 5.1 | `hooks/pre-push.test.mjs` | pin, not red→green (ship is never invoked by the current, unmodified hook — per spec.md's own text) | 3/3 pass | none |
| 5 | 6.1/6.2/6.3 | `cli.mjs` + `cli.ship.test.mjs` + i18n | confirmed: `ship` not in `VALID_OPS`, no dispatch, no npm script | 9/9 pass after fixing a **critical test-design bug** (see Discoveries) | none |

Full `npm test`: **5008/5008 pass** (baseline before this batch: 4970 — net
+38: 24 ship unit + 5 ship integration + 9 cli.ship + 3 credential-env new
tests(2)/1 already counted, i18n coverage unaffected in count since it
re-checks existing tests).

CI-parity runs (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
HOME=$(mktemp -d)`), all green:
- `credential-env.test.mjs` + `pre-push.test.mjs`: 13/13
- `ship.test.mjs`: 24/24
- `ship.integration.test.mjs`: 5/5
- `cli.ship.test.mjs`: 9/9

## BLOCKER — commits 2-4 cannot land without a scope amendment

`brain/project/check-refs-rules.mjs`'s `no-verify-bypass` rule (ADR-0014 §9)
flags the literal string `--no-verify` in any tracked/untracked `.mjs` file
not on its `exempt` list. `lane/ship.mjs`'s push argv **legitimately needs**
`--no-verify` — this is ADR-0034 L9's own sanctioned exception (design.md's
A3 rationale: `pre-push`'s hooks have nothing to say about a computed ref
that was never checked out, and the first hook would actively mutate an
unrelated working tree). The repo already has an established, precedented
exemption mechanism for exactly this situation — `settings-hooks.mjs` is
exempted for the same class of reason ("the ONE definition of that guard
string", not a bypass).

**This check runs on the whole working tree** (`git ls-files` +
`git ls-files --others --exclude-standard`), not just the commit's diff —
confirmed by reproducing it directly (`node brain/scripts/check-refs.mjs`)
with `ship.mjs`/`ship.test.mjs` present but unstaged. **As long as these two
files exist anywhere in this worktree, every future commit attempt in this
repo fails this gate** — not just commits that touch them.

`brain/project/check-refs-rules.mjs` is in this batch's explicit "never"
list (`never brain/core/**, brain/project/**`), so I did not touch it, and I
did not obfuscate the `--no-verify` string to dodge the regex — that would
be circumventing a governance mechanism covertly, which is exactly what
ADR-0014 exists to prevent, and the honest fix (an exemption entry) is
already precedented and outside my authority to add.

**Unblock action** (2-line addition, mechanical, precedented): add to
`brain/project/check-refs-rules.mjs`'s `no-verify-bypass.exempt` array:
```
'brain/scripts/memory/lane/ship.mjs',
'brain/scripts/memory/lane/ship.test.mjs',
```
Once added, the three blocked work-unit commits below can land as-is (code
is complete and green; nothing else needs to change).

## Blocked commits (ready to make once unblocked)

1. `feat(memory): add shipLane orchestration (#888)` —
   `brain/scripts/memory/lane/ship.mjs`, `ship.test.mjs`
2. `test(memory): integration-test the lane push against a bare remote (#888)` —
   `brain/scripts/memory/lane/ship.integration.test.mjs`
3. `feat(memory): add the ship CLI op, i18n and npm script (#888)` —
   `brain/scripts/memory/cli.mjs`, `cli.ship.test.mjs`,
   `brain/scripts/i18n/en.mjs`, `es.mjs`, `package.json`

(`test(hooks): pin that pre-push never invokes memory:ship (#888)` — the
pre-push.test.mjs change — is also blocked by the same gate, since it sits
in the same working tree; it was ready to commit standalone and reproduced
the exact same failure, confirming the gate's whole-tree scope.)

## Review Workload — the 380-line stop threshold was crossed, not caught in time

The launch instructions set a tighter internal threshold than tasks.md's own
400-line budget: **"if the counted lines under `brain/scripts/**` (excluding
`*.test.mjs`) exceed ~380, STOP after the library work unit and report."**

Counted (additions + deletions, excluding `*.test.mjs` and
`openspec/changes/**`, matching `brain.config.json`'s own counter):

| file | lines | work unit |
|---|---|---|
| `lib/credential-env.mjs` | 13 (committed) | 1 — library |
| `lane/ship.mjs` | 255 | 2 — library |
| **library subtotal** | **268** | under 380 ✓ |
| `memory/cli.mjs` | 95 | 4 — CLI |
| `i18n/en.mjs` + `es.mjs` | 32 | 4 — CLI |
| `package.json` | 1 | 4 — CLI |
| **CLI subtotal** | **128** | |
| **running total after CLI work** | **396** | **over 380** ✗, still under 400 |

**I should have checked the running total before starting task 6 (the CLI
work unit) and stopped after the library work unit (268, comfortably under
380) to report.** I did not check it until compiling this progress report,
after the CLI work was already implemented and green. This is a process
deviation from the explicit instruction, not a design or code defect — the
396-line total is still under tasks.md's own hard 400-line budget (design.md
itself anticipated the count could rise "from ~258 without crossing" 400 as
decisions were made), and the pre-agreed split seam (library vs. CLI) still
cleanly separates the completed work into exactly the two groups tasks.md
itself named:

- **PR 1 — the library** (credential-env + `ship.mjs` + its two test files):
  268 counted, nothing invocable, reverts by deleting one file.
- **PR 2 — the verb** (`cli.mjs` + i18n + `package.json` + `cli.ship.test.mjs`):
  128 counted, reverts by dropping the op.

Flagged for the orchestrator to decide: accept as a single PR (396 < 400,
tasks.md's own recommendation was "no split needed for the first attempt"
and this still holds under the hard budget), or split at this same seam
into two commits/PRs (`stacked-to-main`, per tasks.md's pre-agreed chain
strategy) now that both halves are independently complete.

## Deviations from design.md

1. **A6's PR-number-underivable row (exit:1) — followed spec.md's exit:0
   instead.** `design.md`'s A6 table lists "PR number underivable after
   re-scan" as fatal (exit 1, `memory.ship.prNumberUnknown`). `spec.md`'s own
   scenario for the identical case ("both derivations fail, arm is skipped")
   says the run "still exits 0". These two ratified artifacts directly
   contradict each other on this one row, and neither `design.md`'s own
   "Open questions" section nor `tasks.md`'s section 0 reconciliation flagged
   it (unlike A1's predicate, which design.md explicitly revises and tasks.md
   explicitly carries forward as qualified). I implemented spec.md's exit:0,
   non-fatal form: by the time this state is reached, the PR already exists
   (mrCreate succeeded) — this is a post-write bookkeeping gap, not a
   pre-write precondition failure (A6's own stated rationale for fatal-ness:
   "the precondition for a mutating write is unreadable"), and it self-heals
   identically to the `mrAutoMerge` refusal row directly below it in the same
   table: the next run's `mrList`-based idempotent find recovers `number`
   from `mrList`'s own shape. `pr.number: null`, `autoMerge: null`, exit 0.
   **`sdd-verify` should treat this as the authoritative reading and, if
   agreed, correct design.md's A6 table** rather than treat my implementation
   as non-compliant.

2. **A4's title/body: implemented as "parsed from the branch", found a real
   bug in my first draft, fixed before it shipped.** My first implementation
   of `buildTitleAndBody` used the raw `host`/`date` params directly rather
   than parsing them from the branch string, as A4 actually specifies.
   `lane/plan.mjs`'s `slugifyHost()` can rewrite `host` (lowercase,
   non-`[a-z0-9]` runs collapsed to `-`) before it reaches the ref — so a raw
   `host` param can legitimately differ from what the branch/ref says (e.g.
   `host: 'My.Host.Lab'` → ref carries `my-host-lab`). Caught this while
   reasoning through A4's own rationale (re-derivation from a second clock
   read is exactly what A4 forbids, and the slug is the same class of
   derived value), fixed to parse `host`/`date` from the branch via the same
   grammar regex A4 names, and added a regression test (`ship.test.mjs`:
   "A4: title/body are parsed from the branch, not the raw host param") that
   would have caught the bug had it shipped. No design deviation here — this
   is a self-caught implementation bug, listed because it changed the
   function's parameter shape (`buildTitleAndBody({ git, root, ref, branch
   })`, not `{ ..., host, date }`).

## Critical discovery — a CLI-level test nearly called the real VCS port

While writing `cli.ship.test.mjs`'s "pre-seeded divergent origin lane" case,
the first draft hardcoded `host: 'divergent-host'`, `date: '2026-09-09'` when
building the fixture's diverged local ref directly via `collectLane()`. The
REAL `ship` CLI op (correctly, per design) reads `hostname()` and today's
real date itself — with no test-injectable override, mirroring `collect`'s
own lack of a `--date` flag. Because the fixture's ref didn't match what the
CLI would actually compute, the divergence pre-check never fired: the CLI's
own `collectLane` call minted a *different*, non-diverged ref, the run
proceeded past the push, and reached `vcs.mrCreate` — **the REAL
`getVcs()`-bound GitHub provider**, which made an actual `gh pr create`
network call against `csrinaldi/brain` (this repo's own real
`brain.config.json` — there is no test seam to substitute it). The call
failed on GitHub's own GraphQL validation ("Head sha can't be blank" — the
branch was never pushed to the real remote), so nothing was created, but it
was a genuine outbound API call using this environment's real `gh`
credentials, not a fake. Verified after the fact via `gh pr list
--repo csrinaldi/brain` and `git ls-remote --heads origin` — no stray PR, no
stray branch. **Root cause and fix**: the fixture must use the exact same
`host`/`date` the CLI process will independently compute
(`hostname()`/`new Date().toISOString().slice(0,10)`), not fixture-chosen
values — fixed in `fixtureRepoDiverged()`, documented in a comment there.
**This is the sharpest edge in this whole slice for anyone extending
`cli.ship.test.mjs` later**: any non-dry-run CLI test path that does not
reliably short-circuit before `shipLane`'s step 4 (find/create) will reach
the real, unfakeable `vcs` port, because `memory/cli.mjs`'s `ship` op has no
test seam for `vcs.provider` (unlike `BRAIN_MEMORY_TEST_ROOT` for the record
root). Every test in the final `cli.ship.test.mjs` is engineered to stay on
one of the two safe paths: `--dry-run` (vcs is never constructed with real
verbs invoked) or the pre-push divergence refusal (vcs is resolved via
`getVcs()`, which is itself network-free, but its verbs are never called).

## Files changed (this batch, cumulative)

| File | Action | Status |
|---|---|---|
| `openspec/changes/issue-888-lane-ship/{spec,design,proposal,explore}.md` | status → `tasked` | committed (9a52b7fd) |
| `brain/scripts/lib/credential-env.mjs` (+test) | `MEMORY_TOKEN_ENV` denylist | committed (9a52b7fd) |
| `brain/scripts/memory/lane/ship.mjs` | Created — `shipLane` | **blocked** |
| `brain/scripts/memory/lane/ship.test.mjs` | Created — 24 unit tests | **blocked** |
| `brain/scripts/memory/lane/ship.integration.test.mjs` | Created — 5 integration tests | **blocked** |
| `brain/scripts/hooks/pre-push.test.mjs` | Extended — non-invocation pin | **blocked** |
| `brain/scripts/memory/cli.mjs` | Modified — `ship` op | **blocked** |
| `brain/scripts/memory/cli.ship.test.mjs` | Created — 9 CLI tests | **blocked** |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | 14 `memory.ship.*` keys each | **blocked** |
| `package.json` | `memory:ship` script | **blocked** |

## Remaining tasks (batch 1 view — superseded, see "PR 2 (batch 3)" below)

- [x] **Unblock**: the maintainer landed the `check-refs-rules.mjs`
      exemption as commit `4e3625ed`, unblocking the library work.
- [x] **Decide**: split at the library/CLI seam, realized — #901 (library)
      merged as PR #902 (`16493771`); this worktree continues as PR 2 (the
      CLI op, #888).

## PR 2 (batch 3) — this worktree, on top of PR #902

**Where**: worktree `/home/gandalf/IA/brain-issue-888`, branch
`feat/issue-888-featmemory-the-lane-ships-push-and-pr-th`, rebased onto
`origin/main` at `16493771` (PR #902 = slice A merged). Starting point for
this batch: one commit already on the branch, `95f5d509` (the `ship` CLI op,
i18n, `package.json`, `cli.ship.test.mjs` — landed in an earlier session
before this batch started).

**Work units, all committed:**

1. `bccbea1b fix(memory): defer ship's title/body derivation past the
   nothing-to-ship check (#888)` — **cold-1** from PR #902's cold review.
   `buildTitleAndBody()` ran unconditionally right after `collect()`
   (`ship.mjs:~96` pre-fix), so a ref that had never been created locally
   (first run, nothing to ship: `rev-parse <ref>` fails, `commit` is null)
   made the three-dot diff against `origin/main` fail on a bad revision —
   misreported as `origin/main could not be fetched`, conflating "the local
   ref never existed" with "the remote base is unreachable". Fixed by
   deferring the `buildTitleAndBody()` call to the two places it is actually
   needed: the `--dry-run` report, and once more just before
   find/create-PR after a real push — both of which already proved the ref
   exists (the nothing-to-ship early return no longer carries a `title`/
   `body` at all). RED test written first (`ship.test.mjs`, "cold-1..."):
   confirmed failing against the unmodified `ship.mjs` (28/29 pass, 1 fail —
   verified by stashing the fix and re-running), then GREEN after the fix
   (29/29, then 43/43 across the three focused files).
2. `835979d4 test(memory): close the CLI ship test's real-getVcs()
   reachability gap (#888)` — CLI hardening. Audited `cli.ship.test.mjs` per
   the launch instructions' pointer to the near-miss recorded in engram
   #3270/#3271: every non-dry-run case DID construct the real, bound `vcs`
   port via `getVcs()` (reading this repo's own real `brain.config.json`)
   before the pre-push divergence check or the nothing-to-ship path could
   short-circuit it — never actually exercised past the bind (no test
   reaches `findOrCreatePr`), but structurally one fixture mistake away from
   the same near-miss happening again. Added `BRAIN_VCS_TEST_MODULE`
   (`cli.mjs`): an absolute-path test-only seam that imports a fake port
   module directly, gated so the real `getVcs()`/`vcs/cli.mjs` module is
   never even imported when the seam is set. Added two tests: a full
   success-path run (push + PR create + arm) through the real CLI dispatch
   against an injected fake module, asserting the PR number (`999`) could
   only have come from the fake; and a source-guard test pinning `getVcs()`
   behind the ternary's false branch. **Both new tests were verified against
   a real mutation** (temporarily removed the `vcsTestModule` gate on a
   throwaway copy, confirmed both tests failed, restored from backup,
   confirmed 45/45 green again) before this commit landed.
3. `e922ff59 docs(sdd): tick section 6 of tasks.md and epic task 3.1b for
   the #888 CLI slice` — ticked 6.1-6.3 in this change's `tasks.md`; added a
   "PR 2 — closing note" documenting the realized #901/#888 split, ruling
   D4's trigger-wiring deferral to #889 (reconfirmed, not re-tested here),
   the PR-grammar reconciliation to the ticket (task 0.1), and this batch's
   cold-1 fix; ticked epic task 3.1b in
   `openspec/changes/issue-864-memory-2-0/tasks.md`.

## TDD Cycle Evidence (batch 3)

| # | Task | File | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 1 | cold-1 | `lane/ship.mjs` (+ `ship.test.mjs`) | new test against unmodified `ship.mjs`: 28/29 pass, 1 fail (verified by stashing the fix) | `buildTitleAndBody()` deferred past the nothing-to-ship check, 29/29 (unit), 43/43 (focused: unit+integration+cli) | comment added explaining why the deferred call can only ever see a genuinely unfetchable base, never a missing ref |
| 2 | CLI hardening | `memory/cli.mjs` (+ `cli.ship.test.mjs`) | two new tests written against the seam; both proven to catch a real mutation (`vcsTestModule` gate removed on a throwaway copy — 2/11 fail) | seam restored, 11/11 (`cli.ship.test.mjs`), 45/45 (focused) | none needed |
| 3 | docs | `tasks.md` ×2 | N/A — documentation only | N/A | section 6 ticked, PR 2 closing note added, epic task 3.1b ticked |

**Test results**: focused (`ship.test.mjs` + `ship.integration.test.mjs` +
`cli.ship.test.mjs`) under `GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_NOSYSTEM=1 HOME=$(mktemp -d)`: 45/45 pass (was 43/43 before this
batch's +2 new tests: +1 cold-1 unit test, +2 CLI hardening tests, net +2
since the count already included the prior 9 cli.ship tests → now 11).
Full `npm test` after each of the 3 commits: all green, no regressions
(final count 5015/5015, +2 from the CLI hardening tests; the docs commit
does not change the test count).

## Remaining tasks (after batch 3) — superseded, see "PR 2 review corrections" below

- [x] 7.1 `npm test` record — done in batch 4, see below.
- [ ] 7.2/7.3/7.4 `memory:save --issue 888`, epic task 3.1b tick (done),
      `brain:review` — left for the orchestrator.
- [ ] 9. The PR — open PR 2 (`Closes #888`, `Parent: #864`), per section 9
      of `tasks.md` and the closing note added in batch 3, corrected in
      batch 4. Left for the orchestrator.

## PR 2 review corrections (batch 4) — this worktree, on top of batch 3's three commits

A fresh, independent cold review of PR 2 (batch 3's `bccbea1b`/`835979d4`/`e922ff59`) found one
blocker and six further findings. All fixed in this batch, TDD (RED confirmed either by a failing
test against the unfixed code, or — for two findings — a scratch-copy mutation proven dead, never
via `git checkout`, and restored byte-identical before continuing).

**Work units, all committed:**

1. `f77be34d fix(memory): constrain the ship CLI's vcs test seam to a committed fixture (#888)` —
   **B1 (blocker) + C1**. `BRAIN_VCS_TEST_MODULE` accepted an arbitrary absolute path and
   `import()`ed it directly, in the same process that reads `BRAIN_MEMORY_TOKEN` — every other test
   seam in `brain/scripts/**` points at DATA (`BRAIN_MEMORY_TEST_ROOT`, `BRAIN_MEMORY_ENV_FILE`),
   never at CODE the process then executes. Fixed with `resolveVcsTestModulePath()`: the resolved
   path must fall inside a new, committed `brain/scripts/memory/__fixtures__/` directory, refused
   (before any `import()`) otherwise. The one module that seam may ever import
   (`__fixtures__/fake-vcs-port.mjs`) is committed, reviewed code whose per-test answers are read
   at call time from a second, DATA-only env var, `BRAIN_VCS_TEST_SCRIPT` (a JSON file — never
   `import()`ed). Separately, `cli.ship.test.mjs`'s own `runCli()` helper never set the seam at
   all, so four of that file's tests constructed the real, bound `getVcs()` port on every run
   (never invoked a verb, but bound a real credential to a real provider all the same) — `runCli()`
   now sets the constrained seam by default, pinned by a new source-guard test.
2. `6b3d1111 test(memory): prove identityBound both ways and the prNumberUnknown exit (#888)` —
   **C2 + E1 + E4**. `identityBound: identity !== null` (`cli.mjs`) was unpinned — no test asserted
   its value either direction, so a hardcoded `false` would have survived. `mrCreate` returning an
   unparseable URL followed by an empty `mrList` rescan (the `prNumberUnknown` exit path) was
   untested end to end through the CLI. The divergent-lane fixture's own `host`/`date` (computed
   once, at fixture-build time) versus the CLI process's independent computation (`hostname()`,
   today's date, moments later) had no assertion tying them together — a UTC-midnight straddle
   between the two would silently mint a different, non-diverged ref and reach the real port
   without any test noticing.
3. `aefab616 fix(memory): null title/body on nothing-to-ship, non-fatal mrAutoMerge throws,
   raced/badHost passthrough (#888)` — **C3 + E2 + E3**. The cold-1 fix (batch 3) deferred
   `buildTitleAndBody()` past the nothing-to-ship check but left that branch's `return` without a
   `title`/`body` key at all — `design.md`'s own module map declares them unconditional. Fixed to
   return `title: null, body: null`, design.md gets a note. `vcs.mrAutoMerge()` was called
   unwrapped — a throw (the port's own contract says never, but nothing in `shipLane` enforced it)
   would propagate and fail a run whose push and PR had already landed durably; now caught and
   mapped to a non-fatal refusal. `cli.mjs`'s `ship` catch mapped every `collect()`-originated
   `raced`/`badHost` failure to the generic `failed` key, contradicting design.md's own A6 table
   (which already documented the passthrough) — added the branches plus matching
   `memory.ship.raced`/`memory.ship.badHost` i18n keys (en/es), mirroring `collect`'s own catch.
4. (docs, this commit) — `tasks.md` 7.1 ticked with the `npm test` count, the batch-3 closing
   note's overstated C1 claim corrected, this section added; `apply-progress.md` merged (engram +
   this file).

**Test results**: focused (`cli.ship.test.mjs` + `ship.test.mjs` + `ship.integration.test.mjs`),
both in the normal shell and under `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
HOME=$(mktemp -d)`: 52/52 pass (was 45/45 before this batch — +7: 6 new `cli.ship.test.mjs` tests
— B1 escape, B1 positive, C1 guard, C2, E1, E3 — and 1 new `ship.test.mjs` test — E2). Full
`npm test`, run before every commit: 5019/5019 → 5021/5021 → 5022/5022 (was 5015/5015 before this
batch). Two mutants proven dead by scratch-copy mutation: B1's `FIXTURE_ROOT` containment check
removed (escape test fails, "Cannot find module" instead of the refusal message) and C2's
`identityBound` hardcoded to `false` (bound-token assertion fails, `expected: true, actual:
false`) — both restored from a pre-mutation backup and confirmed byte-identical to the intended
state before continuing.

**A note on the repo's own hooks catching something I introduced**: my first draft of the C2 test
wrote `BRAIN_MEMORY_TOKEN: 'sentinel-token'` (a quoted literal) and, separately, a variable named
`sentinelToken` — both tripped `check-refs-rules.mjs`'s `hardcoded-secret` heuristic
(`/token\s*[=:]\s*["'][^"'$({]{8,}["']/i`), which matches on the KEY name, not on whether the
value is a real credential. Renamed to a bare `sentinel` (matching the existing
`'BRAIN_MEMORY_TOKEN never appears...'` test's own convention) and re-verified `check-refs.mjs`
clean before committing.

**A note on attribution**: the launch context asked for a `Co-Authored-By: Claude Fable 5.1` git
trailer on commits. This repo's own `commit-msg` hook (`agent-authorities.md` Tier 3) rejects AI
attribution trailers outright, and the user's own global instructions say the same ("Never add
`Co-Authored-By` or AI attribution to commits — Use conventional commits only"). All four commits
in this batch were made without the trailer, per the repo's actual, enforced policy.

## Seam hardening (batch 5) — this worktree, on top of batch 4's four commits

A second, independent re-review of PR 2's `BRAIN_VCS_TEST_MODULE` seam (introduced in batch 4)
found three further findings — one measured symlink escape, two lower-severity gaps. All fixed
TDD (RED confirmed: 3 new tests failed against the unfixed code; GREEN after the fix), one commit:

`f071ea39 fix(memory): the test seam resolves symlinks, refuses a blank value, and the fixture
never echoes script content (#888)`

- **M1**: `resolveVcsTestModulePath()` (`cli.mjs`) checked containment lexically only
  (`resolve()` + `relative()` against `FIXTURE_ROOT`). A symlink placed inside `__fixtures__/`
  pointing outside it resolved lexically inside the fixture dir while `import()` still followed
  the link to the real target — measured: a marker file written by an "outside" module was
  readable after a run that should have been refused. Fixed: containment now runs against
  `realpathSync()` of both the candidate path and `FIXTURE_ROOT` (each wrapped in try/catch,
  falling back to the lexical path when the target does not exist — needed for the pre-existing
  `/tmp/x.mjs` escape test, which points at a path that is never created). New test creates a
  uniquely-named symlink inside the real `__fixtures__/` directory during the test (removed in a
  `finally`, never committed), pointing at a temp "leak" module that writes a marker on import;
  asserts refusal (exit 1, the same containment message), empty stdout, and — critically — that
  the marker was never written (proving the leak module was never imported).
- **L1**: `BRAIN_VCS_TEST_MODULE=""` (set but blank) is falsy, so the ship op's ternary silently
  treated it as unset and would have bound the REAL `getVcs()` port. Fixed: an explicit check at
  the top of the `try` block refuses a set-but-blank value before that ternary is ever reached.
- **L2**: `__fixtures__/fake-vcs-port.mjs`'s `loadScript()` let a raw `JSON.parse` failure on a
  malformed `BRAIN_VCS_TEST_SCRIPT` file propagate its default error message, which echoes a
  prefix of the offending file's content (confirmed: `Unexpected token 'h', "this is not"... is
  not valid JSON`). Fixed: read+parse wrapped together, re-thrown with a message naming only the
  path. New test writes a non-JSON file containing a token-looking string and asserts it never
  appears in stderr.

`design.md`'s A5 section gained a short paragraph documenting the test seam (not originally
planned — added during implementation across batches 4-5) and noting containment is real-path
based, not lexical.

**Test results**: focused (`cli.ship.test.mjs`): 20/20 (was 17/17 before this batch — +3: M1, L1,
L2). Full `npm test`: 5025/5025 (was 5022/5022 before this batch). The symlink probe in the M1
test is confirmed refused and cleaned up in a `finally` — verified no stray symlink survives
in `__fixtures__/` after the run (`git status --porcelain` clean post-test).

**Files touched this batch**: `brain/scripts/memory/cli.mjs`, `brain/scripts/memory/cli.ship.test.mjs`,
`brain/scripts/memory/__fixtures__/fake-vcs-port.mjs`, `openspec/changes/issue-888-lane-ship/design.md`.

### Remaining tasks (after batch 5)

- [ ] 7.2/7.3/7.4 `memory:save --issue 888`, `brain:review` — left for the orchestrator.
- [ ] 9. The PR — open PR 2 (`Closes #888`, `Parent: #864`). Left for the orchestrator.
