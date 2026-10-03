# Verify Report — issue-557-openspec-archive-sweep — Slice 1 (PR1)

**Branch**: `feat/issue-557-s1-archive-sweep-selector` (verified as-is, not switched, not modified)
**Scope**: tasks.md Phases 1-5 only (VCS issueView widening, selector `lib/archive-sweep.mjs`,
`archive-logic.mjs`/`archive.mjs` rewire, phase-order allowlist fix, tests). Phases 6-9 (backfill
execution, governance-postmerge.yml sweep step, doctrine fixes) are out of scope — incompleteness
there is expected, not a finding.

**Verdict: FAIL** (1 CRITICAL, 1 WARNING, 2 SUGGESTIONS)

## Executive summary

PR1's code is well-structured, faithfully implements the design's decision table, and 3173/3173
tests pass. However, `runBackfill` does not honor design decision D3 / the
`archive-closed-issue-selection` spec's fail-closed requirement: when `selectSweep` returns
`complete: false` (some issue read failed), the implementation still archives every OTHER folder
that resolved successfully instead of archiving nothing, contradicting the design's explicit,
reasoned "abort rather than continue on the readable subset" decision. This is a CRITICAL,
reproduced defect, not a documented deviation, and it matters because PR2 executes this exact path
against ~50 real folders over the network, where partial read failures (rate limiting, auth) are a
realistic operational case the design specifically warns about.

## Test results

- `npm test` (full suite, repo root): **3173/3173 pass, 0 fail** (duration 15.7s).
- `node --test brain/scripts/lib/archive-sweep.test.mjs`: **15/15 pass**.
- `node --test brain/scripts/archive.test.mjs`: **17/17 pass**.
- `node --test brain/scripts/vcs/phase-order-check.test.mjs`: **42/42 pass**.

All green. Static + runtime evidence agree — the finding below is a design-conformance gap the
existing test suite does not exercise (see CRIT-1 for the reproduction).

## Diff scope check

`git diff main...HEAD --stat`: 18 files, all within PR1 scope + openspec planning docs
(`proposal.md`, `design.md`, `tasks.md`, 3 `specs/**/spec.md`). No leakage into PR2/PR3/PR4
territory (no `openspec/changes/archive/**` renames, no `governance-postmerge.yml`, no
`openspec/README.md`/`harness-contract.md`). Confirmed clean.

## Requirement coverage — `archive-closed-issue-selection` spec (in scope, PR1)

| Requirement | Status | Evidence |
|---|---|---|
| Closed-Issue Detector Keyed on Issue State | PASS | `archive-sweep.mjs:122-130` (rows 8/10); tests 1, 2 |
| Backfill Filters by Closed State, Drops `260` Hardcode | PASS | `archive.mjs` routes `--backfill`/`--all` through `selectSweep`; no `'260'` literal (`archive.test.mjs:287-290`); tests 5.1/5.2 |
| Not-Planned Closures Excluded and Reported | PASS | `archive-sweep.mjs:126-129` (row 9); test 3 |
| Destination Collisions Are Visible, Non-Silent | PASS | `archive-sweep.mjs:60-78` (row 4, grouped, order-independent); `BLOCKED_OUTCOMES` (`archive.mjs:81`); tests 7, 5.3 |
| Selection Is a Snapshot; Convergence Handles the Race | PASS (structural) | No locking/retry code exists; matches the "no handling, next run converges" design. Not directly unit-tested (not required by the spec's own Testing list) |
| **Selector Reads Are Fail-Closed** | **FAIL** | See CRIT-1 below |
| Selector and Collision Behavior Covered by Automated Tests | PASS | `archive-sweep.test.mjs` covers closed/open/not-planned/VCS-failure/collision per the spec's required list |

`governance-postmerge-sweep` and `harness-doctrine-archive-policy` specs: all requirements are
Phase 7/9 (PR3/PR4) — correctly out of scope for this slice, no findings raised against them.

## Findings

### CRITICAL-1 — `runBackfill` archives the readable subset even when `selection.complete === false`, contradicting design D3 and the spec's fail-closed requirement

**File**: `brain/scripts/archive.mjs:122-144` (specifically the unconditional
`for (const name of selection.archivable)` loop at line 129, which runs regardless of
`selection.complete`).

**Spec violated**: `archive-closed-issue-selection` → "Requirement: Selector Reads Are Fail-Closed" —
"If a read fails... the selector MUST abort sweep-set computation rather than proceeding as if zero
folders were eligible; **the caller MUST surface the failure**." Scenario: "it aborts computation and
the caller reports failure, **not an empty-but-successful result**."

**Design violated**: `design.md` D3 — "**both callers refuse to act on the partial set**: the sweep
archives nothing and files an alarm; **the backfill archives nothing** and exits 1 listing the
unreadable iids... Why abort rather than continue on the readable subset. ... A partial run is a
quieter version of the same lie: a rate-limited window would produce a PR that archives 3 folders and
says nothing about the 43 it could not evaluate."

**Reproduction** (fake-fs harness, no real filesystem touched, verifying `runBackfill` imported
directly from `brain/scripts/archive.mjs`):

```
entries: ['issue-100-ok', 'issue-900-unreadable']
readIssueState('100') -> {state:'closed', stateReason:'completed'}   (archivable)
readIssueState('900') -> null                                        (unreadable)

result.selection.complete   === false
result.selection.archivable === ['issue-100-ok']
result.archivedCount        === 1
result.renames               === [{src:'openspec/changes/issue-100-ok', dest:'openspec/changes/archive/100'}]
result.exitCode              === 1
```

`issue-100-ok` is renamed into `archive/100` and its spec is merged into `openspec/specs/**` **before**
the process reports failure — the exact "quieter version of the same lie" design D3 names and rejects.
The process does exit 1, so a human running the backfill locally will see an error, but by then the
filesystem mutation for the readable subset has already happened; a CI-driven sweep (PR3, though out
of scope here) inherits the same `selectSweep`/caller contract.

**Why the existing test suite did not catch this**: `archive.test.mjs`'s only unreadable-path test
(5.4, `archive.test.mjs:367-380`) uses a **single-folder** batch (`['issue-900-unreadable']`), so
`archivable` is empty by construction — `archivedCount === 0` passes trivially, not because the code
refuses to act on a partial set. The selector's own test (`archive-sweep.test.mjs:207-224`, "fail-closed:
complete is false when ANY folder in the batch is unreadable") explicitly documents the split
responsibility in its own comment: *"The readable folder still reports its OWN correct outcome — the
caller (not the selector) decides whether to act on a partial `folders` list."* That is a correct
description of what `selectSweep` does — but `archive.mjs`, the caller, was never written to make that
decision the way D3 requires. No test exercises a **mixed** batch (some readable-archivable, some
unreadable) through `runBackfill`.

**Impact**: PR2 is the first real-world run of this exact path against ~50 live folders over the
network (per apply-progress.md's own "Risks / follow-ups for PR2"). A rate-limited or partially-failing
run there would silently archive part of the tree while reporting `exitCode: 1`, producing precisely
the undocumented partial state design D3 was written to prevent.

**Fix shape** (for the record, not applied — verify does not fix): gate the archive loop on
`selection.complete` — when `false`, skip the `for (const name of selection.archivable)` block
entirely, report `readFailures`, and exit 1 with **zero** renames/writes, matching D3's stated
contract for the backfill caller.

### WARNING-1 — `BLOCKED_OUTCOMES` scope is an undisclosed-in-spec judgment call, but internally consistent and pre-flagged by the implementer

**File**: `brain/scripts/archive.mjs:73-81`, `apply-progress.md` deviation #2.

The design/spec require collision and destination-exists to be reported distinctly and never claimed
as success, but do not pin the exact CLI exit-code contract. The implementer chose
`BLOCKED_OUTCOMES = {collision, destination-exists}` (exit 1) while `open`/`not-planned`/
`no-issue-key`/`not-a-change` exit 0 as expected steady-state. This is a reasonable, self-consistent
reading of the spec language ("MUST report the collision distinctly from both a success and a benign
skip") and was explicitly flagged by the implementer in apply-progress.md as "worth a design-note
follow-up when PR2 runs for real." Not a defect — downgraded from CRITICAL because it does not
contradict any MUST in the spec, only fills a genuine gap the spec leaves open. Recommend closing the
loop with the maintainer before PR2, as apply-progress.md itself suggests.

### SUGGESTION-1 — Task 1.4's "provider fixtures" wording vs. inline literals (documented deviation #1)

**File**: `brain/scripts/vcs/providers/vcs.contract.test.mjs` (+30 lines), fixture files unchanged.

Task 1.4 said "extend provider fixtures"; the implementer instead added `state`/`stateReason` coverage
as inline fixture literals in the contract test, citing the file's own established precedent for
`prView.headRefOid` (mutating a `"recorded": true` fixture to inject a fabricated field would
misrepresent what was actually recorded from the live API). This is sound reasoning consistent with
the repo's own stated fixture-provenance discipline. Acceptable as-is; no action needed.

### SUGGESTION-2 — CLI entrypoint guard refactor (documented deviation #3)

**File**: `brain/scripts/archive.mjs:195` (`process.argv[1] === fileURLToPath(import.meta.url)`).

Not called out in tasks.md but necessary for testability (mirrors the existing pattern in
`phase-order-check.mjs`); the single-changeId path's behavior is unchanged, verified by the
pre-existing integration test still passing byte-for-byte. Acceptable as-is; no action needed.

## Maintainer-constraint checklist (from the verify request)

| Constraint | Result |
|---|---|
| Selector fail-closed on unreadable issue state | **Partially met** — the selector itself (`selectSweep`) correctly marks the specific folder `unreadable` and sets `complete: false` (row 6/7). The design mandates the run **abort entirely** ("archives nothing"); the caller (`archive.mjs`'s `runBackfill`) does not enforce that — see CRITICAL-1. |
| Collision handling is loud, not console.error-and-continue | PASS — collisions are classified via `OUTCOME.COLLISION`, grouped (`archive-sweep.mjs:60-78`), reported through the structured `reportGroup`/`BLOCKED_OUTCOMES` path (`archive.mjs:149,165-167`), never via `console.error` inside a continuing loop. No `console.error`/`console.warn` calls exist in `archive-sweep.mjs` or `archive-logic.mjs`'s classification paths. |
| `iid === '260'` hardcode removed | PASS — `archive.test.mjs:287-290` asserts no quoted `'260'` literal remains; test 5.2 confirms iid 260 gets standard row-8/10 treatment. |
| Closed-issue filter on `--backfill` | PASS — `runBackfill` archives only `selection.archivable` (closed + not not-planned); open/not-planned left in place and reported. |
| Open issues #267/#284 would be skipped | PASS by construction — any open issue hits row 8 (`OUTCOME.OPEN`), never entering `archivable`; no test names #267/#284 specifically (not required — the design only cites them as *examples* of the class of open changes the old `--all` would have swept), but the general open-issue-exclusion behavior is directly tested (test 2, test 5.5's `issue-200-inflight`). |
| Allowlist fix: `openspec/specs/` no longer trips phase-order Rules A/C | PASS — `phase-order-check.mjs:39-54`; regression test `phase-order-check.test.mjs:350-398` (passes), teeth test `:400-...` (uses an alternate path `openspec/other-specs/` not covered by the allowlist to prove the pass is attributable to the `openspec/specs/` prefix specifically — a reasonable equivalent to literally deleting the allowlist line, not a defect). |

## Apply-progress deviations — verdict

1. Inline fixture literals instead of mutating provenance-tracked fixtures — **Acceptable** (SUGGESTION-1).
2. `BLOCKED_OUTCOMES` scope as an implementer judgment call — **Acceptable, flag for maintainer sign-off** (WARNING-1).
3. CLI entrypoint guard refactor for testability — **Acceptable** (SUGGESTION-2).

None of the 3 disclosed deviations rise to CRITICAL. The CRITICAL finding in this report (fail-closed
partial-archive gap) was **not** one of the disclosed deviations — it is a newly identified,
reproduced defect against an explicit design decision (D3).

## Recommendation

Route back to `sdd-apply` to fix CRITICAL-1 before this slice is considered mergeable: gate
`runBackfill`'s archive loop on `selection.complete`, add a mixed-batch (`archivable` + `unreadable`
in the same run) regression test to `archive.test.mjs`, and re-verify. WARNING-1 should be raised with
the maintainer for an explicit sign-off (or left as a tracked follow-up) but does not block merge on
its own. Do not proceed to `sdd-archive` until CRITICAL-1 is resolved.

---

## Re-verification — CRITICAL-1 fix (commit `043e482`)

**Fix commit**: `043e482` "fix(archive): refuse to archive on an incomplete selector read (issue #557)"
**Branch**: `feat/issue-557-s1-archive-sweep-selector` (verified as-is, not switched, not modified)

### Verdict: PASS WITH WARNINGS

CRITICAL-1 is **CLOSED**. WARNING-1 remains **OPEN** (unchanged, does not block PR1).

### 1. Diff review — does the gate close the failure mode?

`brain/scripts/archive.mjs:143` wraps the archive loop in `if (selection.complete) { ... }`. When
`selection.complete === false`, the loop that previously ran unconditionally over
`selection.archivable` (the exact code path CRITICAL-1 identified) **does not execute at all** —
`archivedCount`/`consolidatedCount`/`unconsolidatedCount` stay `0`, `archiveErrors` stays empty, and
no `fs.rename`/`fs.writeFile` call happens for any folder, including ones the selector already
classified `ARCHIVABLE`. The report section below the loop (`nonArchived` groups, the `readFailures`
log line, the exit-code computation) is unchanged in shape — only its input values differ, since
nothing was archived. This matches design D3 ("the backfill archives nothing... exits 1 listing the
unreadable iids") and the spec's fail-closed requirement verbatim.

**Independent re-reproduction** (fake-fs harness, no real filesystem touched, same scenario as the
original CRITICAL-1 finding — imported `runBackfill` directly from the fixed `archive.mjs`):

```
entries: ['issue-100-ok', 'issue-900-unreadable']
readIssueState('100') -> {state:'closed', stateReason:'completed'}   (archivable)
readIssueState('900') -> null                                        (unreadable)

result.selection.complete   === false
result.selection.archivable === ['issue-100-ok']   (selector still classifies it correctly)
result.archivedCount        === 0                  (was 1 before the fix)
result.renames               === []                (was 1 rename before the fix)
result.exitCode              === 1
```

The selector (`selectSweep`) is unchanged and still correctly reports `issue-100-ok` as
`ARCHIVABLE` in `selection.folders` — fail-closed is enforced at the caller (`runBackfill`), exactly
where design D3 places the responsibility ("fail-closed is a caller responsibility, not the
selector's" — commit message). This is architecturally correct: the selector stays a pure,
total classifier; the caller decides whether to act on an incomplete classification.

**Verdict**: the gate closes the failure mode. Confirmed by direct code reading and independent
reproduction.

### 2. Does test 5.4b genuinely cover the class?

Yes. `brain/scripts/archive.test.mjs:382-423` ("5.4b: mixed batch — one archivable folder alongside
one unreadable folder...") uses a **two-folder batch**: `issue-901-readable-closed` (closed,
archivable) and `issue-902-unreadable` (`readIssueState` resolves `null`). This is materially
different from the pre-existing test 5.4 (`archive.test.mjs:367-380`), which uses a **single-folder**
batch where `selection.archivable` is empty regardless of whether the gate exists — that test would
pass identically with or without the fix, so it never exercised the bug.

5.4b's assertions are non-trivial and specifically target the fixed code path:
- `result.selection.complete === false`, `readFailures === ['902']` (setup sanity)
- `folders.find(f => f.name === 'issue-901-readable-closed').outcome === OUTCOME.ARCHIVABLE` —
  proves the selector still correctly classifies 901 (the fix must not achieve fail-closed by
  miscategorizing the readable folder)
- `archivedCount === 0`, `consolidatedCount === 0`, `unconsolidatedCount === 0`
- `fixture.renames.length === 0` — no rename call for **any** folder
- `fixture.fs.exists('openspec/changes/issue-901-readable-closed') === true` — the readable folder
  is still physically present, not moved
- `exitCode === 1`

I confirmed by reading the commit message that reverting the `if (selection.complete)` gate locally
reproduces the CRITICAL finding against this exact test (stated by the implementer; consistent with
my own independent reproduction against the pre-fix code in the original verify pass, which used
the same shape of fixture). This is the correct regression test for the class, not another trivially
passing case.

### 3. Test results (re-run against the fix)

- `node --test brain/scripts/archive.test.mjs`: **18/18 pass** (was 17; +1 for test 5.4b).
- `npm test` (full suite, repo root): **3174/3174 pass, 0 fail** (was 3173; +1). Duration ~15.5s.

Both match the apply agent's claim exactly.

### 4. New-violation check

- **Single-changeId path (`runSingle`) unchanged**: the diff touches only `runBackfill` (lines
  140-160) and adds test 5.4b. `runSingle` (`archive.mjs:181-...`) is untouched. Test 5.8
  ("runSingle never touches the VCS — it accepts no readIssueState parameter at all") still passes,
  confirming no regression on the human-override path.
- **Report shape unchanged on a complete run**: the `reportGroup` calls, the
  "Backfill complete. archived: N..." log line, and the `blocked`/exit-code computation are
  byte-identical in structure to the pre-fix version — only reachable with different input values.
  Tests 5.5-5.8 (clean-run, unconsolidated-count, `--all` deprecation notice, `runSingle` isolation)
  all still pass unmodified, confirming no behavior change on a `complete: true` run.
- **Diff scope**: `git diff main...HEAD --stat` still shows only PR1 files (18 files: the fix touches
  `archive.mjs` and `archive.test.mjs` only, both already in scope) + openspec planning docs. No
  leakage into PR2/PR3/PR4 territory.
- **Minor observation, not a spec/design violation**: on an incomplete run, a folder that was
  classified `ARCHIVABLE` but held back by the gate (e.g. `issue-901-readable-closed` in the test) is
  not named in any of the per-outcome `reportGroup` sections (those only list `nonArchived`, i.e.
  non-`ARCHIVABLE`, outcomes) — a reader sees the unreadable iid via the `readFailures` line but not
  an explicit "held back, would have archived" note for 901. This does not violate any MUST in the
  spec (the failure is surfaced, exit code is 1, nothing was silently dropped) and does not block PR1;
  noting it here only as a **SUGGESTION-3** for a future polish pass (e.g., PR2 walkthrough), not a
  blocking finding.

### Findings summary after re-verification

| ID | Status |
|---|---|
| CRITICAL-1 (fail-closed partial archive) | **CLOSED** — fixed in `043e482`, verified by re-reading the diff, independent reproduction, and confirming test 5.4b covers the mixed-batch class |
| WARNING-1 (`BLOCKED_OUTCOMES` scope, undisclosed-in-spec judgment call) | **OPEN, non-blocking** — carry forward for explicit maintainer sign-off before PR2, as originally recommended |
| SUGGESTION-1, SUGGESTION-2 (documented deviations #1, #3) | Unchanged, acceptable |
| SUGGESTION-3 (new, minor) | Held-back-archivable folders aren't individually named in the report on an incomplete run — cosmetic, not spec-violating, not blocking |

### Updated recommendation

PR1 is now mergeable from a spec/design-compliance standpoint. WARNING-1 should still be raised with
the maintainer for explicit sign-off (or filed as a tracked follow-up) before PR2 runs the backfill
for real against ~50 live folders, since `BLOCKED_OUTCOMES`'s exit-1 scope directly shapes what PR2's
first real report will look like. This does not block PR1 merge. Proceed to `sdd-archive` for this
slice once the maintainer has had a chance to review, or continue the chain to PR2 per
`chain_strategy: stacked-to-main`.

## Maintainer sign-off addendum (post re-verification)

WARNING-1 (`BLOCKED_OUTCOMES` scope) was raised with the maintainer in the post-split decision
round and is **SIGNED OFF as implemented**: `collision` and `destination-exists` block the
backfill with exit 1 (they require a human decision); `open`, `not-planned`, `no-issue-key`,
and `not-a-change` are expected steady-state outcomes and exit 0. No further action needed.

Findings status after sign-off: CRITICAL-1 CLOSED, WARNING-1 CLOSED (signed off),
SUGGESTION-1/2/3 open as non-blocking polish notes. **Effective verdict for PR1: PASS.**
