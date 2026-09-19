# Apply progress: issue-1024-memory-gate-pr-context

**Mode**: Strict TDD (native test runner: `node --test`)
**Status**: 25/25 tasks complete + Batch 2 incident fix + Batch 3 cold-review fixes + Batch 4 live-CI bug fix. Ready for verify.

**Commit note**: Batches 1-3 (plus this change's SDD artifacts) were committed by the
maintainer as 7 commits and pushed as PR #1048 on `fix/issue-1024-fixgovernance-memory-
gate-never-receives`. Batch 4 below is a NEW, currently UNCOMMITTED fix on top of that
branch, per the maintainer's explicit instruction to leave it uncommitted for now and not
rewrite history.

## Batch 4 — live-CI bug: `git cat-file --batch` ENOBUFS on real record volume

**Evidence.** Live CI on PR #1048 printed `memory-gate: path=retrieval #1024 (records:
pr-tree only — default branch unreadable: git cat-file failed: )` and exited 2. The
orchestrator reproduced it locally against the real volume: `origin/main` holds
8,967,273 bytes of `.memory/records/`; `readDefaultBranchRecords` returned `{ n: 0, error:
"git cat-file failed: " }` — a bare, silent cause with nothing after the colon.

**Root cause (two compounding bugs).**
1. `execFileSync`'s default `maxBuffer` is 1 MiB. `git cat-file --batch`'s single-call
   design (D2) must hold the WHOLE default branch's `.memory/records/` blob stream in
   memory at once, so it throws `ENOBUFS` once the real volume exceeds 1 MiB — which no
   test before this batch ever did (every fixture stayed well under 1 MiB).
2. On `ENOBUFS`, `execFileSync`'s thrown error has an EMPTY `stderr` (the child is killed
   before any stderr is captured) — `firstStderrLine` only ever read `stderr`, so it fell
   through to a bare, silent `''`, producing `"git cat-file failed: "` with the actual
   cause (`ENOBUFS`) nowhere in the message. `brain-check.mjs`'s own documented `npmTest`
   ENOBUFS (Batch 1's Risks section) is the same class of defect, encountered independently.

**Fix — `default-branch-records.mjs`** (diff below):
1. `defaultGit` now passes `maxBuffer: MAX_BUFFER` (512 MiB, a fixed cap — see the
   in-source comment for the one-line justification: cheap, generous, no second
   `git ls-tree -r -l` round trip needed to compute an exact size) to every real git call,
   overridable by a caller-supplied `opts.maxBuffer`.
2. `firstStderrLine` now falls back to the thrown error's own `code`/`message` (e.g.
   `ENOBUFS` / `"spawnSync git ENOBUFS"`) when no non-empty stderr line exists, so the
   cause is never silently empty.

```diff
--- a/brain/scripts/governance/default-branch-records.mjs
+++ b/brain/scripts/governance/default-branch-records.mjs
@@ const RECORDS_PATH = '.memory/records/';
+// Batch 4 (#1024 live-CI bug, PR #1048): execFileSync's default maxBuffer
+// is 1 MiB. git ls-tree's listing and git cat-file --batch's blob stream
+// (D2's ONE-call design) both need to hold the WHOLE default branch's
+// .memory/records/ in memory at once — this repo's own real origin/main
+// already measures 8,967,273 bytes, well past 1 MiB, and a production
+// consumer's history only grows. 512 MiB is a generous, cheap FIXED cap,
+// chosen over a computed size (a second git ls-tree -r -l round trip).
+const MAX_BUFFER = 512 * 1024 * 1024;

 function defaultGit(args, opts = {}) {
-  return execFileSync('git', args, opts);
+  return execFileSync('git', args, { maxBuffer: MAX_BUFFER, ...opts });
 }

 function firstStderrLine(err) {
   const stderr = ...;
-  const text = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : ... err.message ... ;
-  const line = text.split('\n').find((l) => l.trim() !== '');
-  return line ?? text.trim();
+  const stderrText = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : typeof stderr === 'string' ? stderr : '';
+  const line = stderrText.split('\n').find((l) => l.trim() !== '');
+  if (line) return line;
+  const code = err?.code;
+  const message = err instanceof Error ? err.message : ...;
+  if (message) return code && !message.includes(String(code)) ? `${code}: ${message}` : message;
+  if (code) return String(code);
+  return 'unknown error (no stderr, no code, no message)';
 }
```
(Full literal diff captured via `git diff` and included verbatim in the return summary.)

**RED-first evidence.**
1. Two new unit tests in `default-branch-records.test.mjs`: a `cat-file` failure with an
   EMPTY-but-present `stderr` Buffer and `code: 'ENOBUFS'`, and a `fetch` failure with the
   same shape and `code: 'ETIMEDOUT'` — both run and confirmed to fail against the pre-fix
   source (`result.error` was the bare `'git cat-file failed: '` / `'git fetch origin main
   failed: '`), then passed after the fix.
2. Two new integration tests in `default-branch-records.integration.test.mjs`: a helper
   (`buildLargeRecordsOriginAndClone`) seeds a bare origin with 1,500 real ~1 KB records
   (>1.4 MB total, comfortably over the 1 MiB default), then clones it FULL and SHALLOW.
   Both were run and confirmed to fail against the pre-fix source — the EXACT live-CI
   reproduction: `must not fail with ENOBUFS on a large volume: git cat-file failed: `
   (`actual: 'git cat-file failed: '`, `expected: null`) — then passed after the fix
   (1500/1500 records, `error: null`, `fetched: false` on the full clone / `true` on the
   shallow clone).

### Verification (verbatim summary lines)

- Unit + integration suites for the touched files: `default-branch-records.test.mjs`
  **14/14 pass**; `default-branch-records.integration.test.mjs` **6/6 pass**.
- Focused suite (11 files spanning all four batches): **493/493 pass**.
- Git spy (a `git` shim on `PATH` logging every `fetch` call's cwd+args before exec'ing the
  real binary) wrapped around the full `npm test`: **227 total fetch calls, ALL under
  `/tmp/...`, ZERO outside it**.
- `git rev-parse --is-shallow-repository`: `false` before, `false` after (`.git/shallow`
  absent both times).
- Lane safety: `git ls-remote origin 'refs/heads/memory/*'` (0 refs) and `gh pr list`
  identical before/after this `npm test` run.
- Full `npm test`: **5914/5914 pass** (4 more than Batch 3's 5910 — the 2 new unit + 2 new
  integration cases from this batch).
- Real-volume probe (read-only — a full clone never fetches, so this is a pure local
  `ls-tree`+`cat-file` read, no network, no write), run exactly as specified:

  ```
  node --input-type=module -e 'import { readDefaultBranchRecords } from "./brain/scripts/governance/default-branch-records.mjs"; const r = await readDefaultBranchRecords({ cwd: process.cwd(), defaultBranch: "main" }); console.log(JSON.stringify({ n: r.records?.length, error: r.error, fetched: r.fetched }));'
  ```

  Output: **`{"n":2409,"error":null,"fetched":false}`** — 2,409 records (roughly the
  expected ~2,400), `error: null`, `fetched: false` (this worktree is a full clone, so the
  read came from the local ref with no fetch — matching the expectation exactly).

- `brain:repo:check` and `brain:nav` were NOT re-run in this batch (no change to
  navigable/referenced files) — Batch 3's runs already confirmed both pass and nothing in
  Batch 4 touches doc/reference structure. `run-check.mjs`/`brain:check` were NOT run as
  standalone commands against the real worktree in this batch, per the explicit constraint.

### Files touched in Batch 4 (all already-touched files; no new files)

`brain/scripts/governance/default-branch-records.mjs` (the fix), `brain/scripts/governance/
default-branch-records.test.mjs` (2 new unit cases), `brain/scripts/governance/
default-branch-records.integration.test.mjs` (2 new integration cases + a
`buildLargeRecordsOriginAndClone` helper).

**Left uncommitted**, per the maintainer's explicit instruction — no commit was made in
this batch.

## Batch 3 — cold review fixes (REQUEST_CHANGES, orchestrator-verified findings)

### 1. BLOCKER — `defaultFetchPrLabelEvents` never threaded GitLab's `kind`/API config

**Finding.** `run-check.mjs`'s `defaultFetchPrLabelEvents` called `vcs.labelEvents({ project,
number })` with no `kind` and no `gitlabApiConfig()` threading, unlike its sibling
`defaultFetchIssue`. On GitLab this read ISSUE label events for the MR's own IID — the
skip:memory-gate override's applier could never be resolved there, so the override could
never be honored on GitLab.

**Fix.** `defaultFetchPrLabelEvents` now mirrors `defaultFetchIssue` exactly: `const {
apiBase, token, proxyUrl } = gitlabApiConfig(); return vcs.labelEvents({ project: ctx.repo,
number: ctx.prNumber, kind: 'mr', apiBase, token, proxyUrl });`.

**RED-first evidence.** Two new tests in `run-check.test.mjs`, both run and confirmed to
fail against the pre-fix source before the fix landed:
- A source-text wiring test (modelled on the existing `defaultFetchIssue` pin at
  `:1909-1918`) asserting `gitlabApiConfig` appears in `defaultFetchPrLabelEvents`'s body
  and that `vcs.labelEvents({...})` includes `kind: 'mr'` ahead of `apiBase`/`token`/
  `proxyUrl`.
- A behavioural test with an injected `getVcs` fake recording the exact `labelEvents` call
  args (`project`, `number`, `kind`) for a `provider: 'gitlab'` context.

Both failed for the right reason (missing `kind`/config threading), then passed after the fix.

### 2. MAJOR — the override's refusal reason was discarded unless honored

**Finding.** `override.reason` was only ever surfaced inside `if (override.honored)`. A
regulated refusal, an author/deny-listed refusal, an unreadable-applier note, or a `lite`
not-consulted note were all COMPUTED by `decideMemoryGateOverride` but never appended to
the final result on any other outcome — violating REQ-L3-5/REQ-L3-4's intent that these be
visible, the same discipline `runDiffSizeCheck` already applies to `size:exception`'s tier
refusal.

**Fix.** Refactored `runMemoryGateCheck`: steps 2-6 (the scoped/fallback evaluation) are
now `evaluateMemoryGateFallback`, called once; its result passes through the new
`applyOverrideNote(result, override, tier, labels)` before returning — applied uniformly
regardless of which step produced the result (pass, warning, fail, or uncomputable):
- `override.present` (label was present, decided but not honored) → append
  `override.reason` unconditionally. Covers the `lite` not-consulted note, the `regulated`
  refusal, the author refusal, the deny-listed refusal, and the unreadable-applier note —
  ONE mechanism, not five.
- No label present at all, but the outcome is a genuine SCOPED MISS (`path` starts with
  `retrieval`, `pass: false`, not `uncomputable`) at the `standard` tier → append
  "skip:memory-gate is available..." (REQ-L3-5 scenario "Unlabeled PR still fails a scoped
  miss at standard"). If `labels` was explicitly `null` (a real fetch failure, not merely
  unset in a hand-built `ctx`), the D7 degradation-table note ("labels uncomputable...") is
  appended instead, at any tier.

**Verbatim reason texts** (captured by running the fixed code directly):

| Scenario | Final `result.reason` |
|---|---|
| Regulated refusal (scoped MISS) | `memory-gate: no memory records scoped to issue #1024 — capture a session summary (mem_session_summary) referencing this issue before closing — skip:memory-gate is not honored at the "regulated" tier — the override is refused, consistent with this tier refusing size:exception; evaluation continues.` |
| Author refusal (scoped PASS — clean hit on its own merits) | `memory-gate: verified session_summary scoped to issue #1024 — skip:memory-gate applied by the PR author (@bob) is refused — the author cannot waive their own PR` |
| Standard, unlabeled scoped MISS | `memory-gate: no memory records scoped to issue #2048 — capture a session summary (mem_session_summary) referencing this issue before closing — skip:memory-gate is available (honored when applied by someone other than the PR author, at the "standard" tier)` |
| Lite, label present, not consulted (printed by `main()`, softened to a warning) | `::warning::memory-gate: memory-gate: no memory records scoped to issue #1024 — capture a session summary (mem_session_summary) referencing this issue before closing — skip:memory-gate noted, not consulted at the "lite" tier (detection-only — nothing to skip) (tier: lite)` |

**RED-first evidence.** Four assertions (three updated on existing tests, one new test) in
`run-check.test.mjs`, all run and confirmed to fail against the pre-fix source (the reason
text was simply absent) before the fix landed; all four pass after.

### 3. MINOR — `applier === prAuthor` compared case-sensitively

**Finding.** `memory-gate-override.mjs`'s author-refusal check compared logins
case-sensitively while `isInList` (used for the deny lists) already lowercases — a login
differing only in case (`Bob` vs `bob`) would NOT be refused as the author.

**Fix.** `applier.toLowerCase() === String(prAuthor).toLowerCase()`.

**RED-first evidence.** New test in `memory-gate-override.test.mjs` with an applier
(`'Bob'`) differing from the author (`'bob'`) only in case — run and confirmed to fail
(the mismatched-case applier was wrongly honored) before the fix, passes after.

### 4. MINOR (visibility) — a full clone's local ref could look like fresh evidence

**Finding.** On a full (non-shallow) clone, the reader reads the LOCAL
`refs/remotes/origin/<b>` without fetching (Batch 2's own fix) — but nothing told the
caller whether the evidence came from a live fetch or a possibly-stale local ref.

**Fix.** `readDefaultBranchRecords` now returns a `fetched: boolean` field (`true` only
when a live fetch actually ran). `run-check.mjs`'s union `pathDetail` now reads `records:
pr-tree+origin/<default> (fetched)` on a shallow checkout or `records:
pr-tree+origin/<default> (local ref, not fetched)` on a full clone.

**RED-first evidence.** Five new/extended assertions across `default-branch-records.test.mjs`
(shallow → `fetched: true`; non-shallow → `fetched: false`; the two exact-`deepEqual`
fixtures updated to include the new field), `default-branch-records.integration.test.mjs`
(both real-git cases assert `fetched` explicitly), and `run-check.test.mjs` (two new tests,
one per pathDetail label) — all run and confirmed to fail against the pre-fix source (the
field/text was simply absent) before the fix landed.

### 5. Governed diff re-measured

Batch 1's apply-progress claimed ≈866 governed lines, based on an incorrect module-size
figure (417 instead of the real 304+162=466 at that time). Re-measured after Batch 3
(`git diff --numstat` on tracked files, excluding `*.test.mjs`, `openspec/changes/**`,
`AGENTS.md`, `.memory/**` per `brain.config.json`'s `governance.ignoreList`, plus the two
untracked non-test modules):

- Tracked, governed: **540 lines** (+469/-71) — `run-check.mjs` alone is now +247/-21
  (Batch 3's extraction of `evaluateMemoryGateFallback`/`applyOverrideNote` plus their
  JSDoc grew the file substantially).
- Untracked non-test modules: `default-branch-records.mjs` **310** lines +
  `memory-gate-override.mjs` **162** lines = **472** lines.
- **Total governed: 540 + 472 = 1012 lines.**

This is now AT/OVER the `lite` tier's 1000-line budget (this repository's own declared
tier) — up from Batch 1's corrected estimate and requiring the maintainer's attention
before merge (a chained/stacked-PR split, or an explicit `size:exception`, per this
project's own review-workload guard). `brain:check`'s own `diffSize` sub-check reports
`[PASS]` only because it compares `git diff <base> HEAD` — i.e., COMMITTED state — and
nothing has been committed in this session yet; it is not a valid signal for uncommitted
work and must not be read as contradicting this measurement.

### Verification (verbatim summary lines)

- Focused suite across every touched test file: **489/489 pass**
  (`ci-context-drift-guard.test.mjs`, `default-branch-records.test.mjs`,
  `default-branch-records.integration.test.mjs`, `memory-gate-override.test.mjs`,
  `run-check.test.mjs`, `providers.test.mjs`, `contributor-scaffold.test.mjs`,
  `brain-check.test.mjs`, `workflow-auth.test.mjs`, `metrics-aggregate.test.mjs`,
  `brain-metrics.test.mjs`).
- Git spy (a `git` shim on `PATH` logging every `fetch` call's cwd+args before exec'ing the
  real binary) wrapped around the full `npm test`: **226 total fetch calls, ALL with `cwd`
  under `/tmp/...`, ZERO outside it**.
- `git rev-parse --is-shallow-repository`: `false` before, `false` after (`.git/shallow`
  absent both times).
- Lane safety: `git ls-remote origin 'refs/heads/memory/*'` (0 refs) and `gh pr list`
  identical before/after this `npm test` run.
- Full `npm test`: **5910/5910 pass** (6 more than Batch 2's 5904 — the new tests added in
  items 1/2/3/4 above).
- `npm run brain:repo:check`: pass. `npm run brain:nav`: pass.
- (`run-check.mjs`/`brain:check` were NOT run from the real worktree as standalone
  commands per this batch's explicit constraint — only exercised through `npm test`'s
  hermetic unit/integration tests, and `brain:check` was run once at the very start purely
  to confirm the working-tree-vs-HEAD diffSize caveat above, which touches no git state.)

### Files touched in Batch 3 (all already-touched files; no new files)

`brain/scripts/governance/run-check.mjs` (items 1, 2, 4), `brain/scripts/governance/
run-check.test.mjs` (items 1, 2, 4), `brain/scripts/governance/memory-gate-override.mjs`
(item 3), `brain/scripts/governance/memory-gate-override.test.mjs` (item 3),
`brain/scripts/governance/default-branch-records.mjs` (item 4), `brain/scripts/governance/
default-branch-records.test.mjs` (item 4), `brain/scripts/governance/
default-branch-records.integration.test.mjs` (item 4).

## Batch 2 — incident fix: `default-branch-records.mjs` shallowed a full clone

**What happened.** The orchestrator's git spy caught 9 `git fetch --no-tags --depth=1
origin +refs/heads/main:refs/remotes/origin/main` calls during `npm test`, with `cwd`
= `/home/gandalf/IA/brain-issue-1024` (the real, full clone this apply session runs in)
against the real `origin`. `--depth=1` against a full clone writes `.git/shallow` and
GRAFTS the fetched commit as parentless, cutting history for every worktree of the
repository. The orchestrator repaired it (backed up and removed `.git/shallow`; ancestry
and `git fsck` re-verified) before reporting the incident. The SAME code path runs in
`npm run brain:check` on every developer's machine, so as originally written this would
have shallowed every consumer's local clone the first time they ran it.

**Root cause.** `readDefaultBranchRecords` (Batch 1) always ran the targeted `--depth=1`
fetch, unconditionally — correct for CI's own shallow checkout (the scenario D1 was
designed for), but never checked whether the checkout it was running against was ALREADY
shallow. Three test call sites (below) reached this production default with the REAL
repo as `cwd`, because they modeled a scoped MISS/PARTIAL result (D3's lazy union) without
injecting a fake `readDefaultBranchRecords`.

**Fix — `default-branch-records.mjs` (D1 amended).** The reader now calls `git rev-parse
--is-shallow-repository` FIRST. Only `true` (a CI shallow checkout, or a consumer's own
shallow clone) runs the targeted `--depth=1` fetch. `false` (a full clone — every
developer machine, and this repo's own worktree) NEVER fetches: the reader reads
`refs/remotes/origin/<b>` as it already stands (a full `git clone` already populates every
remote-tracking ref, not only the checked-out branch, so no fetch is needed there in the
first place); if that ref does not exist, the existing `ls-tree` failure path supplies the
"unreadable" cause — no new cause string was needed. An unresolvable shallow-check (the
probe itself throws) defaults to `false` (never fetch) — the safe direction, since skipping
a fetch costs at most an "unreadable" result, while a wrongful fetch costs repository
history.

**Test call sites fixed** (each was reaching the real reader with the real cwd because the
scoped evaluation resulted in a MISS or PARTIAL — a clean HIT short-circuits before ever
calling the default-branch reader, per D3, so those call sites were never at risk):
- `brain/scripts/governance/run-check.test.mjs:2035` ("ctx.body has a reference but NO
  record scoped to that issue → fail") — MISS.
- `brain/scripts/governance/run-check.test.mjs:2044` ("ctx.body has scoped records but
  none is session_summary...") — PARTIAL.
- `brain/scripts/vcs/contributor-scaffold.test.mjs:256` ("the memory-gate row describes
  BOTH pipeline wirings...", the `withBody` case) — MISS.

Each now injects `readDefaultBranchRecords: () => ({ records: [], error: null })` — a
hermetic fake, matching the discipline every other memory-gate test in this change already
followed. (`brain/scripts/brain-check.mjs`/`brain-check.test.mjs` were already fixed in
Batch 1 for the same underlying reason, before this incident was reported — that fix
stands unchanged.)

**RED-first evidence (strict TDD).** Both fixes were written test-first this time:
1. `default-branch-records.test.mjs`: three new unit cases (shallow → fetches with the
   exact argv, non-shallow → fetch never runs, unresolvable-shallow → defaults to no
   fetch) were run against a temporarily-reverted (pre-Batch-2) copy of
   `default-branch-records.mjs` — confirmed RED (3/3 failed for the right reason: the
   reverted code always fetched, contradicting the new "never on a full clone"
   assertions) — then the real fix was restored and the same 3 tests went GREEN (12/12
   in the file).
2. `default-branch-records.integration.test.mjs`: two new real-git cases (a full clone
   proves zero fetch + no `.git/shallow` created + the record is still read from the
   existing ref; a shallow clone proves the fetch still runs live, picking up a record
   added to origin AFTER the initial clone) were run the same way — RED against the
   reverted module (1 of 2 failed: the full-clone case, correctly — the reverted code
   always fetched, which the "full clone never fetches" assertion catches; the
   shallow-live case incidentally still passed against the reverted code since it
   always fetches anyway, which is expected and not a gap — that scenario doesn't
   distinguish old vs. new behavior) — then GREEN after restoring the fix (4/4).
3. The three test-call-site fixes (run-check.test.mjs ×2, contributor-scaffold.test.mjs
   ×1) are safety-net fixes for a hermeticity/incident issue, not new-feature TDD —
   applied directly, verified GREEN in isolation (184/184 across both files) before the
   full suite ran.

**Verification (verbatim summary lines).**
- Guard test in isolation (before the full suite ran, per the incident's explicit
  ordering requirement): `node --test brain/scripts/governance/default-branch-records.test.mjs`
  → 12/12 pass. `node --test brain/scripts/governance/default-branch-records.integration.test.mjs`
  → 4/4 pass.
- Git-spy + lane-guard + shallow-check, full `npm test`: **before** this incident's own
  fix (i.e., the state the orchestrator's spy observed) — 9 fetch calls with `cwd`
  outside `/tmp` (their finding; NOT reproduced here — re-running the unconditional-fetch
  code against this real, full clone would re-trigger the exact incident, so the "before"
  count is taken from the orchestrator's report, not re-measured). **After**: a live git
  spy (a `git` shim on `PATH` that logs every `fetch` invocation's cwd+args before
  exec'ing the real binary) wrapped around the full `npm test` run recorded **226 total
  fetch calls, ALL with `cwd` under `/tmp/...`, ZERO outside it** (`grep -v "PWD=/tmp"
  git-spy.log` → empty).
- `git rev-parse --is-shallow-repository`: `false` before, `false` after (`.git/shallow`
  absent both times).
- Lane safety: `git ls-remote origin 'refs/heads/memory/*'` (0 refs) and `gh pr list`
  identical before/after this `npm test` run.
- Full `npm test`: **5904/5904 pass** (4 more than Batch 1's 5900 — the 3 new unit cases
  + 1 new integration pair, net of the pre-existing 2 that stayed).
- `npm run brain:repo:check`: pass. `npm run brain:nav`: pass.
- `npm run brain:check`: same shape as Batch 1 — `[PASS] diffSize/adrPresence/
  memoryPresence/repoCheck`; `[FAIL] issueLink` (no commit made — expected) and
  `[FAIL] npmTest` (the pre-existing `ENOBUFS` limitation in `brain-check.mjs`'s
  `spawnCommand`, unrelated to this incident — see Batch 1's Risks).

**Design deviation note (D1 amended).** design.md's D1 ("The reader runs a targeted
fetch") is now conditional: the targeted `--depth=1` fetch runs ONLY when `git rev-parse
--is-shallow-repository` reports `true` for the checkout the reader is running against. A
full (non-shallow) clone never fetches and reads whatever `refs/remotes/origin/<default>`
already holds. This preserves D1's original CI rationale (GitHub's depth-1 checkout, and
a manual re-run actually picking up a fresh fetch) while closing the destructive-history
defect a full/local clone would otherwise suffer. No CHANGELOG addition was made: the
existing #1024 entry mentions "(fetch/ref failure)" only as a generic failure-mode
category, never describing the fetch's mechanics or conditions, so it was not made
inaccurate by this fix.

**Files touched in Batch 2** (all already-touched-in-Batch-1 files; no new files):
`brain/scripts/governance/default-branch-records.mjs` (the fix itself),
`brain/scripts/governance/default-branch-records.test.mjs` (3 new unit cases + `rev-parse`
handling added to every existing fixture), `brain/scripts/governance/
default-branch-records.integration.test.mjs` (2 new real-git cases, plus a
`buildOriginAndClone` helper fix returning `seedDir`), `brain/scripts/governance/
run-check.test.mjs` (2 sites hermeticized), `brain/scripts/vcs/contributor-scaffold.test.mjs`
(1 site hermeticized).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/2.1 | `ci-context-drift-guard.test.mjs` | Unit (source-scan) | N/A (new test) | ✅ Written first, ran against base, failed naming `VCS_TOKEN` | ✅ Passed after `governance.yml` edit | ➖ Single (one job block) | ➖ None needed |
| 1.2/1.3/2.2 | `default-branch-records.test.mjs` | Unit (injected git runner) | N/A (new module) | ⚠️ **Module written BEFORE this test.** RED proven retroactively: moved `default-branch-records.mjs` to `/tmp`, ran the test file, confirmed `ERR_TEST_FAILURE` (module-not-found), restored the file byte-identical (`mv` back, no edits), reran — GREEN | ✅ 10/10 passed on first run after restore | ✅ 10 cases (argv, batch parsing w/ embedded newline + missing, 4 cause strings, empty listing, corrupt line, union ×3, parity) | ➖ None needed |
| 1.4 | `default-branch-records.integration.test.mjs` | Integration (real git, `testTmp()`) | N/A (new file) | ⚠️ Written against an already-implemented, already-unit-tested reader — this is an empirical/functional proof, not a RED-first unit test. Passed on first run (2/2) | ✅ 2/2 passed | ➖ 2 cases (hit + fetch-failure) | ✅ Switched `rmSync` → `removeTempTree` after the `#802` spawn+rmSync hygiene test caught the bare form |
| 1.5/2.3 | `memory-gate-override.test.mjs` | Unit | N/A (new module) | ⚠️ **Module written BEFORE this test**, same pattern as 1.2/1.3: moved module aside, confirmed module-not-found, restored, GREEN | ✅ 11/11 passed | ✅ 11 cases (honored, author/reviewActors/agentActors refusal, latest-add-wins, events-null, no-add-event, labels-null, absent-label, lite, regulated) | ➖ None needed |
| 1.6/1.7/2.4 | `run-check.test.mjs` (T2.1 + T7b block) | Unit | ✅ 148/148 pre-existing tests captured before editing `run-check.mjs` | ✅ Written first; 11 assertions failed against pre-2.4 `run-check.mjs` | ✅ 160/160 (148 pre-existing + 12 new/changed) passed after `runMemoryGateCheck` rewrite | ✅ 12 new cases across D3/D5/D6/D8/D9 + override honored/refused/lite/uncomputable-labels | ✅ Extracted `toActorList` to the shared `memory-gate-override.mjs` (was duplicated) |
| 1.8/3.1 | `providers.test.mjs` | Unit | ✅ 127/128 baseline (1 new case added, not yet passing) | ✅ `kind:'mr'` case failed against current `gitlab.mjs` | ✅ 128/128 passed after the `kind` param | ✅ 3 cases (mr, default, github-ignores) | ➖ None needed |
| 1.9/3.2 | `metrics-aggregate.test.mjs`, `brain-metrics.test.mjs` | Unit + integration (real git fixture repo) | ✅ 19/20 and 31/33 baseline | ✅ Both files' new assertions failed against raw-only code | ✅ 20/20 and 33/33 passed | ✅ raw-vs-honored, by-author, author-cannot-honor-self, `kind:'mr'` assertion | ✅ Defensive `?? 0` added to the markdown renderer after a fixture gap surfaced an `undefined` cell |
| 1.10/4.1/4.2 | `contributor-scaffold.test.mjs` | Unit + golden (on-disk byte compare) | ✅ 34/36 baseline (2 tests already failing against the OLD text once the new claim was decided — expected) | ✅ Failed against stale text/on-disk files | ✅ 36/36 passed after source + template regeneration | ➖ Single (one sentence, both providers) | ➖ None needed |
| 5.1/5.2/5.3 | Doctrine draft dry-run (not a `node --test` file — `runPromote()` invoked directly against a `makeFixtureRepo()` temp repo) | N/A (documentation, no runtime code) | N/A | N/A | ✅ `exitCode: 0`, all 6 anchors resolved exactly once (`free===1`), plan printed, no real write (see full output below) | N/A | N/A |
| — (regression fix) | `brain-check.test.mjs` | Unit | ✅ 9/9 baseline before the D3 lazy-union change | ❌ Discovered as a genuine regression via the FULL suite run, not TDD-first: `runMemoryGateCheck`'s new default-branch reader has no injected fake in `brain-check.mjs`'s existing fixture, so it reached the REAL git remote and flipped `memoryPresence fails → exitCode 1` to `0` | ✅ 9/9 restored after adding an injectable `readDefaultBranchRecords` param to `brain-check.mjs` and a hermetic fake in the test fixture | N/A | N/A |
| — (regression fix) | `workflow-auth.test.mjs` | Unit (source-scan/audit) | ✅ 44/45 baseline before the `SUBCOMMAND_PORT_REACH` flip | ❌ Discovered via the full suite: the T2 fixture used `memory-gate` as its illustrative "PR_NUMBER-gated, no unconditional VCS_TOKEN requirement" example — that premise stopped holding once `memory-gate`'s manifest entry legitimately became `true` (same as issue-link/base-branch) | ✅ 45/45 (44 + 1 new case) after swapping the fixture's second probe to `decision-gate` (the remaining `false`-manifest subcommand) and adding an explicit new test proving memory-gate's new unconditional-flag behavior | N/A | N/A |

### Test Summary
- **Total tests written/changed**: ~90 (new test files: 3; new test cases across existing files: ~55; existing assertions edited to accommodate new fields/behavior: ~15; two whole test blocks retargeted: T7b's 5 mutation tests)
- **Total tests passing**: 5900/5900 (full `npm test`), plus the standalone `runPromote()` dry-run (exit 0, not part of `npm test`)
- **Layers used**: Unit (majority), Integration (`default-branch-records.integration.test.mjs`, `brain-metrics.test.mjs`'s real-git-fixture cases), Golden/on-disk (contributor-scaffold templates)
- **Approval tests** (refactoring): None — no pure-refactor task in this change; `run-check.mjs`'s `runMemoryGateCheck` rewrite was covered by the pre-existing 148-test baseline (safety net) plus 12 new cases, not by a separate approval-test pass.
- **Pure functions created**: `readDefaultBranchRecords`, `unionRecordsById`, `dedupeJsonlRecords` (default-branch-records.mjs — the git-plumbing call is the only impure edge, isolated behind the injectable `git` dep); `decideMemoryGateOverride`, `toActorList` (memory-gate-override.mjs, fully pure)

### TDD deviations (flagged per the Strict TDD contract)

Two new production modules were written before their tests: `brain/scripts/governance/default-branch-records.mjs` and `brain/scripts/governance/memory-gate-override.mjs`. For both, RED was proven **retroactively and honestly**: the module file was moved out of the working tree (`mv <file> /tmp/...`), the corresponding test file was run and confirmed to fail with a module-not-found error (not a mistyped assertion — an actual missing-dependency failure), then the module was restored via `mv` back (never re-typed, so byte-identical), and the suite re-run to confirm GREEN. This is documented here rather than silently presented as RED-first. `default-branch-records.integration.test.mjs` was written directly against the already-implemented reader as an empirical/functional proof (per design.md's own note: "Empirical fetch check ... not run in this phase ... the integration test above is the check, and apply runs it first" — it was written and run, just not RED-first in the strict sense, since the unit-level contract was already GREEN by that point).

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `.github/workflows/governance.yml` | Modified | `memory-gate` job now declares `VCS_TOKEN`/`PR_NUMBER`/`PR_BODY` (task 2.1) |
| `brain/scripts/governance/default-branch-records.mjs` | Created | `readDefaultBranchRecords`, `unionRecordsById`, `dedupeJsonlRecords` (task 2.2) |
| `brain/scripts/governance/default-branch-records.test.mjs` | Created | Unit coverage, injected git runner (tasks 1.2/1.3) |
| `brain/scripts/governance/default-branch-records.integration.test.mjs` | Created | Real-git integration coverage, no network (task 1.4) |
| `brain/scripts/governance/memory-gate-override.mjs` | Created | `decideMemoryGateOverride`, `toActorList` (task 2.3) |
| `brain/scripts/governance/memory-gate-override.test.mjs` | Created | Unit coverage (task 1.5) |
| `brain/scripts/governance/run-check.mjs` | Modified | `runMemoryGateCheck` rewritten per Data Flow; `SUBCOMMAND_PORT_REACH['memory-gate']` → `true`; `main()` path-line print (task 2.4) |
| `brain/scripts/governance/run-check.test.mjs` | Modified | T2.1 block added; T7b mutation tests retargeted to `decision-gate`; `:175`/`#603` log-count assertions updated for the new path line (tasks 1.6/1.7) |
| `brain/scripts/governance/checks/memory-presence.mjs` | Modified | Stale header comment updated (design's File Changes table item) |
| `brain/scripts/vcs/ci-context-drift-guard.test.mjs` | Modified | New `#1024` wiring test (task 1.1) |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modified | `labelEvents` gained `kind: 'issue'\|'mr'` (task 3.1) |
| `brain/scripts/vcs/providers/github.mjs` | Modified | `labelEvents` accepts/ignores `kind` (task 3.1) |
| `brain/scripts/vcs/providers.test.mjs` | Modified | RED coverage for `kind` (task 1.8) — **not** `gitlab.test.mjs`/`github.test.mjs` as tasks.md named; those files do not exist, both providers are tested from this one file |
| `brain/scripts/vcs/governance-tiers.mjs` | Modified | Stale `honorSkipMemoryGate` comment updated to reflect it is now load-bearing |
| `brain/scripts/brain-metrics.mjs` | Modified | `prAuthor` destructured; `skipMemoryGateHonoredAuthor` resolved; `kind:'mr'` on the shared labelEvents fetch; markdown/JSON renderers updated; stale caveat rewritten (task 3.2) |
| `brain/scripts/brain-metrics.test.mjs` | Modified | RED→GREEN coverage for raw/honored + by-author (task 1.9) |
| `brain/scripts/lib/metrics-aggregate.mjs` | Modified | `bypass.skipMemoryGateHonored` + `skipMemoryGateByAuthor` added (task 3.2) |
| `brain/scripts/lib/metrics-aggregate.test.mjs` | Modified | RED→GREEN coverage (task 1.9) |
| `brain/scripts/vcs/contributor-scaffold.mjs` | Modified | `GATE_SUMMARY['memory-gate']` + checklist sentence updated (task 4.1) |
| `brain/scripts/vcs/contributor-scaffold.test.mjs` | Modified | Stale-claim assertions replaced/updated (task 1.10) |
| `.github/PULL_REQUEST_TEMPLATE.md` | Modified (regenerated) | Task 4.2 |
| `.gitlab/merge_request_templates/Default.md` | Modified (regenerated) | Task 4.2 |
| `CHANGELOG.md` | Modified | Unreleased entry (task 6.1) |
| `brain/scripts/brain-check.mjs` | Modified (unplanned, regression fix) | Added injectable `readDefaultBranchRecords` param so `brain:check`'s local invocation of `run-check.mjs`'s `memory-gate` case doesn't silently reach the real git remote in a hermetic test — see Risks |
| `brain/scripts/brain-check.test.mjs` | Modified (unplanned, regression fix) | Injected a hermetic fake for the above |
| `brain/scripts/vcs/lib/workflow-auth.test.mjs` | Modified (unplanned, regression fix) | T2 fixture's illustrative gate swapped from `memory-gate` to `decision-gate`; new explicit case added proving memory-gate's new unconditional-flag behavior — see Risks |
| `openspec/changes/issue-1024-memory-gate-pr-context/brain-drafts/workflow-governance-memory-gate.draft.md` | Created | Task 5.1 |
| `openspec/changes/issue-1024-memory-gate-pr-context/brain-drafts/README.md` | Created | Task 5.3 |
| `openspec/changes/issue-1024-memory-gate-pr-context/tasks.md` | Modified | All 25 tasks marked `[x]` with evidence notes |
| `openspec/changes/issue-1024-memory-gate-pr-context/apply-progress.md` | Created | This file |

## Justification for files not named in tasks.md

- **`brain/scripts/brain-check.mjs` / `brain-check.test.mjs`**: `runMemoryGateCheck`'s new D3 lazy-union behavior calls `readDefaultBranchRecords` (the REAL production default, reaching git) whenever the PR-tree records alone are not a clean hit. `brain-check.mjs`'s existing `runCheck` wrapper calls `runGovernanceCheck('memory-gate', ...)` without injecting a fake reader, and its own test suite (`brain-check.test.mjs`) is a hermetic unit-test fixture (injected `npmTestFn`/`repoCheckFn`/`fetchIssue`, no real I/O). Running the full suite surfaced this: `memoryPresence fails → exitCode 1` flipped to `0` because the empty-observations fixture's scoped miss fell through to a REAL `git fetch` against this actual repo's `origin/main`, which (in this sandbox) found real records and passed. This is a genuine regression `run-check.mjs`'s change caused in a sibling entry point; fixing it (an optional injectable param + a hermetic fake) was necessary to keep the existing test suite green and correct, not scope creep.
- **`brain/scripts/vcs/governance-tiers.mjs`**: comment-only accuracy fix, explicitly named in design.md's own File Changes table ("`governance-tiers.mjs:306-308` comment | Update stale text").
- **`brain/scripts/vcs/providers/github.mjs`**: explicitly named by task 3.1 ("In `brain/scripts/vcs/providers/github.mjs`, accept and ignore the parameter").
- **`brain/scripts/vcs/lib/workflow-auth.test.mjs`**: flipping `SUBCOMMAND_PORT_REACH['memory-gate']` to `true` (task 2.4, explicitly directed by design D9) is a genuine, correct change — memory-gate's handler now reaches `getVcs` for real, exactly like issue-link/base-branch already do. The pre-existing `T2` test's fixture used memory-gate specifically BECAUSE its manifest was `false`, to illustrate the "contextPort-only, PR_NUMBER governs whether VCS_TOKEN is required" asymmetric rule. That illustration stopped being true — memory-gate is now `directPort: true`, unconditionally requiring `VCS_TOKEN` regardless of `PR_NUMBER`, same treatment issue-link/base-branch already receive. The fixture was updated to use `decision-gate` (the one remaining `false`-manifest subcommand) for that illustration, and a new explicit test was added proving memory-gate's new behavior. This is a mandatory adaptation of an existing regression test whose premise the (correct, designed) production change invalidated — not scope creep.
- **`brain/scripts/vcs/providers.test.mjs`**: tasks.md named `brain/scripts/vcs/providers/gitlab.test.mjs`, which does not exist in this repo — both `gitlab.mjs` and `github.mjs` are tested from the single `brain/scripts/vcs/providers.test.mjs` file. Task 1.8's RED coverage was added there instead, at the correct real location.

## Native attempt

- Acquired: `request-id apply-1024-batch1`, `work-unit memory-gate-pr-context`, `max-attempts 2`, `max-changed-lines 4000`, `--untracked-scope exclude --expected-untracked-inventory sha256:4e3458fb0743d7b1ce586a9d29b6c59955fabf375c26c8c23fbd159b01e2482f` → `{"state":"proceed","token":"sha256:d3304685499378c31d405428b8fa15e06ed3dc22627a806678ff2a1dc495540b"}`.
- Settled at the end of this session — see the return summary for the exact `settle` command and JSON output.

## Risks / Deviations from design

1. **Governed diff size (corrected in Batch 3 — see the "Governed diff re-measured" section above)**: design.md estimated ~310 governed lines. Batch 1's own re-measurement (≈866) used an incorrect module-size figure. The CORRECTED, current total after Batch 3 is **1012 governed lines** (540 tracked + 472 across the two new non-test modules), which is now AT/OVER this repository's own `lite`-tier budget (1000) — not merely close to the default 400-line budget as Batch 1 reported, but over its OWN declared budget. This needs the maintainer's attention before merge: a chained/stacked-PR split, or an explicit `size:exception`, per this project's review-workload guard. Growth since Batch 1 is Batch 3's own fix (item 2's refactor added ~90 lines to `run-check.mjs` for `evaluateMemoryGateFallback`/`applyOverrideNote` and their JSDoc) plus the corrected module count.
2. **`brain:check`'s `npmTest` sub-check fails with `ENOBUFS`** — confirmed via direct reproduction (`spawnSync('npm', ['test'], {encoding:'utf8'})` throws `ENOBUFS` because `npm test`'s ~1.04 MB of TAP output exceeds Node's default 1 MB `spawnSync` maxBuffer). This is a **pre-existing tooling limitation** in `brain-check.mjs`'s `spawnCommand` helper, unrelated to #1024 — the test suite has simply grown past 1 MB of output over time. The authoritative signal is the direct `npm test` run (5900/5900 green, task 6.3). Not fixed here (out of scope for #1024; would need a `maxBuffer` override or streaming capture in `brain-check.mjs`).
3. **`brain:check`'s `issueLink` sub-check fails** — expected and harmless: no commit has been made (per the apply constraints), so the check reads the current HEAD commit message (`02896d69`'s own, unrelated to #1024) and correctly finds no issue reference. Will resolve itself once the work-unit commits below are made.
4. **PR-list drift during the session is external, not caused by this work**: three snapshots were taken across the session (session start, immediately before `npm test` in the lane-safety guard, and immediately after). Between the session-start snapshot and the pre-`npm test` snapshot, PR #1040 disappeared and #1043/#1044 appeared — unrelated activity on the real `csrinaldi/brain` repo by other agents/humans working on issue #882, not anything this apply session did. The snapshot pair that actually BRACKETS `npm test` (immediately before → immediately after) is byte-identical, which is the property task 6.3 requires.
5. **No `merge-walk.mjs` change was needed** (task 3.2 mentioned it): `fetchPrMeta` already returned `prAuthor`; only `brain-metrics.mjs`'s destructure needed updating.

## Commit Plan (unexecuted — no commit/stage/push per session constraints)

Work-unit commits, conventional, `(#1024)`, no attribution trailers — tests travel with the code they cover in every commit below (adjusted from tasks.md's phase-per-commit sketch to keep every commit self-testing):

1. `test(governance): pin the memory-gate job's missing PR-context env keys (#1024)` — `ci-context-drift-guard.test.mjs`'s new case only (RED on its own, harmless once 2 lands).
2. `feat(governance): wire memory-gate to the PR context, union the default branch into scoped evidence, and make skip:memory-gate real (#1024)` — `.github/workflows/governance.yml`, `default-branch-records.{mjs,test.mjs,integration.test.mjs}`, `memory-gate-override.{mjs,test.mjs}`, `run-check.{mjs,test.mjs}`, `checks/memory-presence.mjs` (comment), `governance-tiers.mjs` (comment).
3. `feat(vcs): read PR/MR label events for the memory-gate override, and report it raw/honored in brain:metrics (#1024)` — `providers/{gitlab,github}.mjs`, `providers.test.mjs`, `brain-metrics.{mjs,test.mjs}`, `lib/metrics-aggregate.{mjs,test.mjs}`.
4. `docs(vcs): drop the stale "no gate reads it" claim from the contributor scaffold (#1024)` — `contributor-scaffold.{mjs,test.mjs}`, both regenerated templates.
5. `fix(governance): keep brain:check and the workflow-auth audit correct under memory-gate's new port reach (#1024)` — `brain-check.{mjs,test.mjs}`, `vcs/lib/workflow-auth.test.mjs` (the three collateral regression fixes, isolated in their own commit so their rationale is easy to review independently).
6. `docs(governance): draft the workflow-governance amendment for memory-gate's tier-scoped override (#1024)` — `brain-drafts/**`.
7. `docs: note the memory-gate PR-context change in CHANGELOG (#1024)` — `CHANGELOG.md`.
