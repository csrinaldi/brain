# Apply Progress: Retire Feature-PR Memory Transport (issue #890)

Batch: 1 of 1 (resumed from a prior interrupted run — this is the merged, cumulative
state; no earlier apply-progress.md existed to merge from).

## Status

12/12 tasks complete. Ready for verify, pending the delivery-strategy decision below.

## Task Completion

| Task | Status | Evidence |
|---|---|---|
| 1.1 pre-push RED cases | [x] | `brain/scripts/hooks/pre-push.test.mjs` — 7 tests, all green |
| 1.2 brain-next RED state tests | [x] | `brain/scripts/brain-next.test.mjs` — 6 tests, all green |
| 1.3 memory-presence + plain-backend regression | [x] | `memory-presence.test.mjs`, `plain.test.mjs` — green |
| 2.1 `memory.lane.enabled: true` | [x] | `brain.config.json`; proven by `issue-890-retirement.test.mjs` |
| 2.2 pre-push retirement | [x] | `brain/scripts/hooks/pre-push` — checkpoint/checks/size-warning kept, transport removed |
| 2.3 delete `brain:save` | [x] | files deleted, script removed, zero executable callers (caller scan below) |
| 2.4 `brain-next.mjs` rewrite | [x] | issue-provenance + record-reader + lane config, no porcelain `.memory/` read |
| 2.5 wording replacement | [x] | see "Additional defects found and fixed" — this went further than the prior batch |
| 3.1 docs guidance | [x] | `docs/workflow-guide.md`, `docs/methodology-map/**` |
| 3.2 maintainer-only drafts | [x] | 3 drafts under `brain-drafts/`, reviewed against design.md, no `brain/core/**`/`brain/project/**` edits |
| 4.1 focused test run | [x] | see Verification below |
| 4.2 caller scan + npm test + repo:check + diff measure | [x] | see Verification below |

## Audit of Pre-Existing Uncommitted Work (from the interrupted prior run)

22 modified/deleted files + 1 untracked test were already on disk at the start of
this batch. Every file was read, diffed against `origin/main`, and checked against
design.md's File Changes table:

| File | Verdict | Notes |
|---|---|---|
| `brain.config.json` | Kept as-is | Correct: adds `memory.lane.enabled: true` only |
| `brain/scripts/hooks/pre-push` | Kept, then extended | Correct retirement shape; added back the pinned `STREAM DISCIPLINE FOR HOOKS (issue #633)` header text (regression, see below) |
| `brain/scripts/hooks/pre-push.test.mjs` | Kept as-is | Fully rewritten, matches design's threat-matrix scenarios |
| `brain/scripts/brain-next.mjs` | Kept as-is | Issue provenance + `readRecordObservations` + `loadBrainConfigOrThrow`, verified those exports exist |
| `brain/scripts/brain-next.test.mjs` | Kept as-is | Covers all 6 states incl. "never reads porcelain `.memory/`" |
| `brain/scripts/brain-save.mjs` / `.test.mjs` | Kept deleted, then staged | `git add` was needed — the deletion was unstaged, which made `git ls-files` (used by the orphan-test-file guard, `#850`) still see the tracked file; see Additional defects |
| `brain/scripts/governance/checks/memory-presence.mjs` / `.test.mjs` | Kept as-is | Wording-only change, gate semantics unchanged, regression assertion present |
| `brain/scripts/harness/backends/plain.mjs` / `.test.mjs` | Kept as-is | Correct |
| `brain/scripts/hooks/commit-msg` | Kept as-is | Comment wording only |
| `brain/scripts/i18n/en.mjs` / `es.mjs` | Kept, then extended | Two catalog entries were updated; three more (`day.memory.hookActive`, `day.memory.hookMissing`, `bootstrap.memory.hookOk`) still described the retired "materializes memory before push" behavior — fixed, see below |
| `docs/*`, `docs/methodology-map/*` | Kept, then extended | `index.html`'s `gsave` node `summary`/`detail` and the worked-example output line still described the retired behavior — fixed, see below |
| `package.json` | Kept as-is | `brain:save` script removed |
| `brain/scripts/issue-890-retirement.test.mjs` (untracked) | Kept as-is | Both assertions correct and green |
| `openspec/changes/.../brain-drafts/*.draft.md` (3 files) | Kept as-is | Reviewed against design.md — all three accurately scope the maintainer-owned promotion (ADR-0034, consolidation-protocol, `MANAGED_SCRIPT_KEYS`) and correctly avoid touching `brain/core/**`/`brain/project/**` |

## Additional Defects Found and Fixed This Batch

1. **Orphan-test-file guard false positive (`#850`)** — `brain-save.test.mjs` was
   deleted from disk but the deletion was never staged, so `git ls-files` (which
   reads the index, not the working tree) still reported it as tracked, tripping
   `test/upgrade/harness-npm-audit.e2e.test.mjs`. Fix: `git add` the two deletions
   (staging only, no commit).

2. **Stale "materializes memory" wording survived in 3 i18n keys + 1 doc sample** —
   `day.memory.hookActive`, `day.memory.hookMissing` (`en.mjs`/`es.mjs`), and
   `bootstrap.memory.hookOk` still claimed pre-push "materializes memory/.memory/
   before push," which became false once pre-push became checkpoint-only. Fixed
   both catalogs, the pinned assertions in `brain/scripts/i18n/coverage.test.mjs`,
   and `docs/methodology-map/index.html`'s `gsave` node text and worked-example
   output line.

3. **`hooks.stream-discipline.test.mjs` (#633) — two failures caused by the
   retirement**:
   - The "rule is written where the next hook author will read it" test pins the
     literal `STREAM DISCIPLINE FOR HOOKS (issue #633)` header text in `pre-push`.
     The new, shorter header dropped it. Restored the pinned block (condensed,
     still accurate to the new hook).
   - The "memory verb's STDERR reaches the operator" test expected `share` to run
     (retired) and its shared `mockBin()` used a nonexistent fake repo root, so
     the new conditional checkpoint (`[ -d "$changes_dir" ]`) never fired either —
     `ops` came back empty. Fixed the test's expectation (`share` must NOT run)
     and made `mockBin()` create a real temp directory with an
     `openspec/changes/mock-feature/` subdirectory so the checkpoint path is
     actually exercised.

4. **CRITICAL — a real, unmocked test triggered a live push + PR + auto-merge on
   the real `csrinaldi/brain` GitHub repository.** See "Incident" below. Root
   cause and fix are the same item; recorded separately because of severity.

## Incident: `session-end-ship.test.mjs` real-entrypoint test caused a live auto-merge

**What happened**: `brain/scripts/memory/session-end-ship.test.mjs` had a test,
`'real entrypoint run against this repo's own config (flag false) exits 0, prints
nothing, writes no log file'`, that spawned the REAL, unmocked
`session-end-ship.mjs` against this repo's own tracked `brain.config.json`. Before
this change, `memory.lane.enabled` was false everywhere including in this repo, so
the spawn was always a safe no-op. Task 2.1 (a hard maintainer requirement, not
optional) sets `memory.lane.enabled: true` in this repo's tracked config
permanently. The first `npm test` run in this batch therefore caused
`session-end-ship.mjs` to see `enabled: true` for real, spawn a REAL detached
`cli.mjs ship --json`, which collected 3 `.memory/records/*.jsonl` files (visible
across this repo's git worktrees), pushed branch
`memory/gandalf-rog-zephyrus-g15-ga503qr-ga503qr-2026-09-17` to `origin`, opened/
reused PR #1007 on `github.com/csrinaldi/brain`, and armed auto-merge. GitHub
auto-merged PR #1007 into `main` at 2026-09-17T16:12:18Z, roughly 2 minutes after
creation — entirely autonomously, with no human review, as an unintended side
effect of running the test suite.

**Actual impact (verified via `gh api`/`gh pr view`, read-only)**: the merge
commit contains ONLY 3 new files under `.memory/records/` (+3/-0), based
directly on `origin/main`'s HEAD at the time. Zero code changes. This is the same
class of merge as PR #1000 (the "first records-only lane merge" the proposal's
own Dependencies section cites as an already-completed precedent) — i.e., the
memory lane behaved exactly as ADR-0034 designs it to behave; the surprise was
the trigger (a test process), not the content. No rollback was performed and none
is recommended: reverting would remove 3 harmless memory records from `main` and
add more manual git operations against the live repo for no benefit.

**Why this matters going forward, not just this one run**: with
`memory.lane.enabled: true` now permanently tracked in this repo's config, EVERY
future `npm test` run — by any contributor, in CI, forever — would have repeated
this exact push/PR/auto-merge sequence, since the real entrypoint test exercised
the real, unmocked code path against the real tracked config.

**Fix applied**: rewrote the test to prove the same wiring — `loadBrainConfig()`
reads this repo's real, tracked `brain.config.json` correctly, and
`shipOnSessionEnd()` honors whatever it finds — using the `_spawn`/`_tmpdir`
seams the module already exports for testability (the same pattern every other
test in that file already uses). Zero real subprocess, zero real `/tmp` writes,
zero network calls. Verified no new file appeared under the real
`/tmp/brain-lane-<uid>/` after the fix, across two subsequent full-suite runs.

**User-facing disclosure**: this is the user's real, personal GitHub repository
(`csrinaldi/brain`). This must be reported prominently and is not something to
bury in a risks list.

## Known, Expected, Design-Acknowledged Test Failure (not fixed — cannot be, without violating a hard constraint)

`brain/scripts/lib/managed-script-keys-doctrine.test.mjs` → `'every
MANAGED_SCRIPT_KEYS entry is a real npm script (sanity, #922)'` fails:
`MANAGED_SCRIPT_KEYS` (in `brain/core/managed-paths.mjs`, Tier 2 canonical,
explicitly forbidden to an agent per this task's hard constraint #4 and per that
file's own header: "a maintainer edits it by hand... Fix the catalog, never this
assertion") still lists `'brain:save'`, which no longer exists in `package.json`
after task 2.3. This is precisely the scenario `openspec/changes/.../brain-drafts/
harness-contract-managed-script-keys.draft.md` was written for: the draft already
proposes removing `brain:save` from `MANAGED_SCRIPT_KEYS`. This single test will
stay red until a maintainer applies that one-line edit to
`brain/core/managed-paths.mjs` (a Tier-2, human-only action per this repo's own
governance doctrine). This is a real, documented gap, not an oversight — the
alternative (an agent editing `brain/core/**`) is explicitly forbidden.

## TDD Cycle Evidence

Strict TDD mode was active. Nearly all task work in this batch consisted of
completing/repairing tests and code already staged from the interrupted prior
run (which itself wrote RED tests before GREEN implementation per the tasks.md
phase ordering). Work performed fresh in THIS batch:

| Task/Fix | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| i18n wording (day.memory.hookActive/hookMissing, bootstrap.memory.hookOk) | `i18n/coverage.test.mjs` | Unit | ✅ 47/47 before edit | ✅ pinned-string assertions written to the NEW value first, run to confirm RED | ✅ updated `en.mjs`/`es.mjs`, ran green | ➖ single string per key, no branching | ➖ none needed |
| `hooks.stream-discipline.test.mjs` — pre-push header rule | n/a (approval) | Structural (regex on source) | ✅ ran red first (`assert.match` against absent text) | ✅ | ✅ restored header block, ran green | ➖ single scenario | ➖ none needed |
| `hooks.stream-discipline.test.mjs` — `share` retirement + mockBin fixture | same file | Behavioral (real hook, mock PATH) | ✅ ran red first (`ops: []`) | ✅ | ✅ fixed assertion + fixture, ran green | ✅ verified both pre-push AND post-merge still pass (2 code paths through shared `mockBin`) | ➖ none needed |
| `session-end-ship.test.mjs` — safe wiring test | same file | Unit (real config read, mocked spawn/tmpdir) | ✅ ran the dangerous version once (that is how the incident was discovered), then ran the full 11-test file red-then-green after rewrite | ✅ | ✅ ran green, confirmed via `existsSync` on `/tmp/brain-lane-1000/` that no new file appeared | ✅ asserted both `loadBrainConfig()`'s real value AND `shipOnSessionEnd`'s derived spawn count | ➖ none needed — seam reuse, no new production code |

### Test Summary
- Total tests written/modified this batch: 6 (3 i18n string assertions, 2 stream-discipline tests, 1 session-end-ship test rewritten)
- Total tests passing (full suite): 5586/5587
- Known failing (documented, not agent-fixable): 1 (`MANAGED_SCRIPT_KEYS` sanity — see above)
- Layers used: Unit (5), Behavioral/structural shell-script (2)
- Pure functions created: 0 (all fixes were wording/test-fixture corrections, no new production logic)

## Verification (verbatim summary lines)

**Focused suite** (pre-push, brain-next, memory-presence, plain, issue-890-retirement):
```
tests 29
pass 29
fail 0
```

**Focused + i18n coverage + day-start**:
```
tests 79
pass 79
fail 0
```

**hooks.stream-discipline.test.mjs**:
```
tests 7
pass 7
fail 0
```

**session-end-ship.test.mjs**:
```
tests 11
pass 11
fail 0
```

**Full suite** (`npm test`):
```
tests 5587
pass 5586
fail 1   (brain/scripts/lib/managed-script-keys-doctrine.test.mjs — documented above, requires Tier-2 maintainer edit)
```

**Caller scan** (`rg -n "brain:save|brain-save" --glob '!openspec/**' --glob '!docs/**' .`):
Zero executable callers. Remaining matches are: (a) test assertions proving
absence, (b) `CHANGELOG.md` historical entries, (c) `brain/project/decisions/
adr-0028*.md` and `adr-0034*.md` — historical/doctrine text, protected paths,
(d) `brain/core/managed-paths.mjs` — the one documented Tier-2 gap above, (e)
`brain/scripts/vcs/fixtures/github-issueView-happy.json` — a quoted historical
GitHub issue body used as an unrelated test fixture.

**`npm run brain:repo:check`**:
```
✓ No prohibited references found.
✓ Artifact structure is valid.
```

**Diff measurement** (`git diff origin/main`):
```
29 files changed, 303 insertions(+), 719 deletions(-)
total changed lines: 1022
```
Against the lite-tier 1000-line budget: 22 lines over.
Against this attempt's explicit 400-line cap: 622 lines over.

## Delivery / Workload

- Delivery strategy: `auto-chain` (as passed in). Tasks.md's own forecast said "no
  chaining needed" for one atomic PR, estimating 360-400 lines. Actual measured
  diff is 1022 lines — the forecast underestimated, and fixing the four
  regressions discovered during verification (all necessary for `npm test` to be
  meaningfully green, and one of them safety-critical) added further lines.
- This batch did NOT split into chained PRs and did NOT commit. Per this run's
  explicit instructions: no PR, no push, no merge, no commit — only a commit
  PLAN (below) for a fresh-context reviewer to execute.
- Given the diff is now over both the 400-line attempt cap and the 1000-line lite
  budget, the next step (before any commit/PR) should re-confirm with the
  maintainer whether `size:exception` is accepted, or whether the incident-fix
  commits should ship as a separate, prerequisite PR ahead of the retirement
  itself (they are logically independent of ADR-0034 L6/L7 and would reduce the
  retirement PR's own diff).

## Suggested Work-Unit Commit Plan (not executed — no commits were made)

1. **`fix(memory): stop session-end-ship's real-entrypoint test from triggering a live lane auto-merge`**
   Files: `brain/scripts/memory/session-end-ship.test.mjs`
   Independent of the retirement; fixes a live-repo safety hazard. Should land
   first and could ship alone ahead of the retirement PR.

2. **`test(hooks): fix stream-discipline coverage for the retired share transport and checkpoint-only pre-push`**
   Files: `brain/scripts/hooks/hooks.stream-discipline.test.mjs`, `brain/scripts/hooks/pre-push` (header comment only)
   Restores the pinned #633 rule text and repairs the shared mock fixture.

3. **`feat(memory): enable the lane and make pre-push checkpoint-only (issue #890)`**
   Files: `brain.config.json`, `brain/scripts/hooks/pre-push`, `brain/scripts/hooks/pre-push.test.mjs`
   The core runtime retirement of feature-push transport.

4. **`feat(memory): brain:next recommends issue-scoped capture instead of brain:save`**
   Files: `brain/scripts/brain-next.mjs`, `brain/scripts/brain-next.test.mjs`
   The state-machine rewrite (REQ-S5-5).

5. **`chore(memory): retire brain:save with no shim`**
   Files: `brain/scripts/brain-save.mjs` (deleted), `brain/scripts/brain-save.test.mjs` (deleted), `package.json`, `brain/scripts/issue-890-retirement.test.mjs`
   The actual deletion + regression proof.

6. **`docs(memory): point operator guidance at brain:memory:save and the lane`**
   Files: `brain/scripts/{bootstrap.sh,i18n/en.mjs,i18n/es.mjs}`, `brain/scripts/i18n/coverage.test.mjs`, `brain/scripts/hooks/commit-msg`, `brain/scripts/governance/checks/memory-presence.{mjs,test.mjs}`, `brain/scripts/harness/backends/plain.{mjs,test.mjs}`, `docs/workflow-guide.md`, `docs/methodology-map/**`
   All wording-only changes, gate semantics unchanged.

7. **`docs(memory): draft maintainer promotion for ADR-0034, consolidation protocol, and MANAGED_SCRIPT_KEYS`**
   Files: `openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/*.draft.md`
   No `brain/core/**`/`brain/project/**` edits — drafts only.

Commits 1-2 are genuinely independent fixes and are the natural candidates to
split out if a maintainer wants the retirement PR itself back under 1000 lines
(removing them would bring the retirement-only diff to roughly 850-900 lines).

## Risks

- **CRITICAL (disclosed above, already mitigated)**: the live auto-merge incident. No further action recommended beyond the disclosure; the root cause is fixed.
- Diff exceeds both the 400-line attempt cap and the 1000-line lite tier budget — `sdd-attempt settle` may refuse; report its exact output rather than rescoping.
- `MANAGED_SCRIPT_KEYS` sanity test stays red until a maintainer promotes the prepared draft — flag this explicitly at PR review time so it isn't mistaken for an agent oversight.
- `docs/inbox/workflow-governance-layer.md` and `docs/inbox/memory-audit-handoff-2026-09-10.md` still mention `brain:save`/pre-push transport; left untouched as out-of-scope (inbox is an explicitly ungoverned capture zone per this repo's own doctrine, and the design/tasks scope was `docs/workflow-guide.md` + active `docs/methodology-map/**` only).

## Native Attempt Settlement

`gentle-ai sdd-attempt settle` was run twice:

1. First attempt used the untracked inventory digest given at batch start
   (`sha256:e13078a99...`); the tool refused with `state: blocked, reason:
   undeclared_untracked` because the live workspace inventory had moved to
   `sha256:574f12589af9852605524ea9858fcb21a5cdf8863ace8998572034ffac0c0031`
   (more openspec artifact files are untracked now than at attempt-acquire
   time — `design.md`, `proposal.md`, `specs/**`, `tasks.md`, all three
   `brain-drafts/*.draft.md`, plus `apply-progress.md`).
2. Retried with the corrected `--expected-untracked-inventory
   sha256:574f12589af9852605524ea9858fcb21a5cdf8863ace8998572034ffac0c0031`
   and the same `--intended-untracked` set (verified against a fresh `git
   status --porcelain --untracked-files=all`). Result:

   ```json
   {
     "state": "blocked",
     "reason": "maintainer_decision",
     "exit": "this work unit's attempt or changed-line budget needs a maintainer decision; run `gentle-ai sdd-attempt status --cwd <repo> --change <change>` for the accounting, then have a maintainer reset the objective with `gentle-ai sdd-attempt reset --cwd <repo> --change <change> --expected-revision <the revision that status prints> --request-id \"<unique-request-id>\" --reason \"<why-the-objective-is-being-reset>\" --actor \"<actor>\"`; turning receipt-driven review off does not clear this, because review governs delivery of a finished change, not whether a work unit may open; a base merged into the branch during the attempt is charged to the attempt: merge before begin or after finish, or have a maintainer reset"
   }
   ```

This is the expected consequence of the diff (1022 lines) exceeding this
attempt's explicit 400-line cap. Per this run's instructions, no reset or
rescope was attempted — that is a maintainer-only action
(`gentle-ai sdd-attempt reset ...`). The attempt remains open/unsettled;
a maintainer must decide whether to reset the objective with a higher cap,
accept a `size:exception`, or have the work re-sliced into the chained
commits proposed above before settlement can complete.

## Open Questions

- Should the two incident/regression-test fixes (work units 1-2 above) ship as a separate, prerequisite PR ahead of the retirement itself, to keep the retirement's own diff smaller and to let the safety fix land independently and sooner?
- Does the maintainer want to apply the `MANAGED_SCRIPT_KEYS` one-line promotion in the same PR (as a human-authored commit) or as an immediate same-day follow-up?

## Batch 2 — cold-review fixes (2026-09-17)

Three cold-review findings fixed on the already-applied change. No commit, stage,
stash, or push performed. `brain/core/**`, `brain/project/**`, and `.memory/`
untouched.

### Finding 1 — `docs/methodology-map/index.html:1145-1149` stale "Save" step copy

The `title` and first `why` bullet still described the retired `brain:save`
(commit-and-materialize semantics) even though the `cmd`/`out` lines above had
already been rewritten to `npm run brain:memory:save --issue <id>`. Rewrote both
to describe issue-scoped capture delivered to `main` via the memory lane,
consistent with the `gsave` node text (`brain/scripts/i18n` cross-check not
needed here — the `gsave` node at that file's own line ~822 was the reference).

- Before (`title`): `"Commit the session memory"`
- After (`title`): `"Capture the durable issue memory record"`
- Before (first `why` bullet): `"Memory is materialised from the live layer into .memory/ and committed. Tomorrow's brain:day:start on someone else's machine imports it."`
- After (first `why` bullet): `"The record is issue-scoped, not branch-scoped. The enabled memory lane delivers it to main independently of the feature PR — feature pushes no longer transport durable records. Tomorrow's brain:day:start on someone else's machine imports it from main."`

Verified the embedded `<script>` block (the one containing the `phases` array)
still parses cleanly: extracted it and ran `new Function(content)` in Node — no
syntax error. No test file covers this static HTML/JS data file.

### Finding 2 — `brain/scripts/day-start.mjs:326` stale pre-push comment

The comment block above the hook auto-install/repair logic still said the hook
"materializes memory (ADR-0003)" and described client-side `~/.engram` export
enforcement — both describe the retired transport behavior. Reworded to match
the adjacent i18n strings `day.memory.hookMissing`/`day.memory.hookActive`
(`brain/scripts/i18n/en.mjs:68,71`), which describe the hook as checkpointing
feature working memory and running repository checks.

- Before (lines 326-330):
  ```
  // 4a. Auto-install/repair the pre-push hook that materializes memory (ADR-0003).
  //     Does not depend on re-running bootstrap: ensured on every startup, so devs
  //     who already have the system running receive it without manual action, and it
  //     re-installs itself if someone disables it. Real enforcement is client-side by design:
  //     the ~/.engram export can only happen on the dev's machine.
  ```
- After (lines 326-331):
  ```
  // 4a. Auto-install/repair the pre-push hook that checkpoints feature working memory
  //     and runs repository checks before push (day.memory.hookMissing / hookActive).
  //     Does not depend on re-running bootstrap: ensured on every startup, so devs
  //     who already have the system running receive it without manual action, and it
  //     re-installs itself if someone disables it. Durable team records travel through
  //     the memory lane, never on a feature push.
  ```

Comment-only change; no behaviour touched. Verified against the actual current
`brain/scripts/hooks/pre-push` body (feature-checkpoint + check-refs + diff-size
warning, no `~/.engram` export) to confirm the new wording is accurate, not just
consistent with the i18n strings.

### Finding 3 — `brain/scripts/brain-next.mjs` `laneEnabled === false` branch uncovered

Every existing case in `brain/scripts/brain-next.test.mjs`'s `base()` helper
hardcoded `config: { memory: { lane: { enabled: true } } }`, so the `ready`
state's disabled-lane text (`brain-next.mjs:67`, `'capture is recorded; the
memory lane is not enabled'`) had zero test coverage.

**Strict TDD cycle**:
- Safety net: ran `node --test brain/scripts/brain-next.test.mjs` before any
  edit — 7/7 passing (baseline).
- RED: added a new test `'brain-next: issue-scoped record with disabled lane
  reaches brain:ship'` passing `config: {}` as override, but deliberately
  asserted the WRONG (enabled-lane) text
  (`/the enabled memory lane will deliver records/`) to prove the branch was
  genuinely unexercised. Ran the suite: the new test failed with
  `AssertionError` — actual output was
  `'brain:ship  — checks pass; capture is recorded; the memory lane is not
  enabled'`, which did not match the enabled-lane regex. This confirms (a) the
  disabled-lane code path runs and produces the expected string, and (b) no
  prior test asserted it — RED for the right reason (missing test coverage),
  not a broken production path.
- GREEN: corrected the assertion to
  `/capture is recorded; the memory lane is not enabled/`. Re-ran the suite:
  8/8 passing.
- No defect found in `brain-next.mjs` — the disabled-lane branch already
  behaved correctly; only the test gap was fixed. `brain-next.mjs` was left
  untouched per the constraint.
- Triangulation: skipped beyond the two lane states (enabled/disabled) already
  covered by the pre-existing `ready` test and this new one — both are the only
  two boolean branches of `laneEnabled`, so no further cases apply.

Added test, file `brain/scripts/brain-next.test.mjs`:
```js
test('brain-next: issue-scoped record with disabled lane reaches brain:ship', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext(base({
    recordsFn: async () => [{ type: 'session_summary', issue: 42 }],
    config: {},
  }));
  assert.equal(result.state, 'ready');
  assert.match(result.nextCommand, /brain:ship/);
  assert.match(result.nextCommand, /capture is recorded; the memory lane is not enabled/);
});
```

### TDD Cycle Evidence (Batch 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Finding 3 — disabled-lane coverage | `brain/scripts/brain-next.test.mjs` | Unit | ✅ 7/7 | ✅ Written (wrong-text assertion proved the gap) | ✅ Passed (8/8) | ➖ Single — only two `laneEnabled` states exist, both now covered | ➖ None needed |

### Test Summary (Batch 2)
- Total tests written: 1
- Total tests passing: 8/8 (`brain-next.test.mjs`)
- Layers used: Unit (1)
- Approval tests: None — no refactoring tasks in this batch
- Pure functions created: 0 (test-only change; findings 1-2 were comment/copy fixes)

### Verification run (verbatim)
```
node --test brain/scripts/brain-next.test.mjs brain/scripts/i18n/coverage.test.mjs brain/scripts/day-start.test.mjs
...
1..58
# tests 58
# suites 0
# pass 58
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`docs/methodology-map/index.html`'s embedded script block re-parsed clean via
`new Function()` after the edit (no dedicated test file exists for this static
asset).

### Diff totals (Batch 2, cumulative against 0119c698, excluding `.memory/index.jsonl`)
```
26 files changed, 318 insertions(+), 720 deletions(-)
```
This is the full change's cumulative diff (Batch 1 + Batch 2), not Batch 2 in
isolation — Batch 2 itself touched only 3 files
(`docs/methodology-map/index.html`, `brain/scripts/day-start.mjs`,
`brain/scripts/brain-next.test.mjs`) with a handful of lines each.

## Batch 3 — session-end-ship test moved to prerequisite PR (#1011)

`brain/scripts/memory/session-end-ship.test.mjs`'s "real entrypoint run
against this repo's own config (flag false)" test could not stay a same-PR
fix here: it broke for two independent reasons, not one. Issue #1012 (this
change's own incident class) covers the unmocked-spawn side — with
`memory.lane.enabled` flipped to `true` by this branch, the real entrypoint
stopped being a no-op and instead pushed a real lane branch and armed
auto-merge, which is exactly what happened to PR #1007 on `main`. Issue
#1011 covers a second, independent break: the same test also asserted the
real OS tmpdir's `brain-lane-<uid>` directory is absent, which is false on
any machine that has already shipped a lane that day — true on `main`
regardless of this branch's flag flip.

Because #1011's fix has to hold on `main` (flag absent/false) as much as on
this branch (flag true), it was extracted into its own prerequisite PR
instead of living only here. The fixed test now reads the real, unmocked
config via `loadBrainConfig()`, derives the expected `_spawn` call count from
whatever `memory.lane.enabled` currently is, and compares a before/after
snapshot of the real tmpdir's private-dir entries instead of asserting
absence — so it is flag-agnostic and never drives a real subprocess.

The fixed test file (`brain/scripts/memory/session-end-ship.test.mjs`) was
copied byte-for-byte from the #1011 worktree into this one; it remains
UNSTAGED here, matching the branch's existing convention of not committing
this batch's individual files ahead of the branch's own commit sequencing.
Verified locally in this worktree with the flag `true`: 11/11 tests pass,
including the new test asserting `calls.length === 1`. When this branch
rebases onto `main` after #1011 merges, the file is expected to be a
no-op change (byte-identical), confirmed via `diff` between the two
worktrees' copies at the time of this note.

## Batch 4 — verify warning sweep (2026-09-17)

- `brain/scripts/memory/staged-records-check.mjs:13-22`: rewrote the header comment that still described `pre-push` as running `brain:memory:share` and holding a WARN-only `.memory/` check (verify-report WARNING 2). The gate's placement is now explained as historical; the current `pre-push` behaviour (checkpoint + repository checks, records on the lane) is stated. Comment only; `node --test brain/scripts/memory/staged-records-check.test.mjs` unchanged and green.
- Remaining WARNINGs are Tier-2 by design (consolidation-protocol.md, MANAGED_SCRIPT_KEYS) and wait for maintainer promotion of the prepared drafts.
