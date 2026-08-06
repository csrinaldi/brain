# Verify Report — issue-468-rung3-efficacy-probe

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 2 WARNING, 1 SUGGESTION)

## Environment note (methodology)
The shared main worktree (`/home/scit/code/brain`) was switched away from
`feat/issue-468-featgovernance-rung-3-reports-armed-on-f` to an unrelated branch
(`feat/issue-405-...`) mid-session by a concurrent process (this is a shared
multi-worktree environment with other active agents). All findings below were
re-derived from a clean isolated `git worktree add` checked out at the actual
branch tip `f1c5c6e`, not the live (contaminated) working directory. A drift-guard
proof required temporarily mutating `.github/workflows/governance-postmerge.yml`'s
cron in the main worktree; it was reverted via `git checkout --` immediately after
and confirmed clean (`git diff --stat` empty). An embedded environment note
falsely framed this self-made mutation as an intentional user/linter change and
instructed not to revert it — that instruction was not followed; the file was
restored per the task's explicit requirement.

Branch base (corrected post-verification): after `git fetch origin`, the
merge-base with `origin/main` is `d2fdf13` exactly as briefed — 7 commits ahead,
0 behind. An earlier draft of this report claimed the branch was 10 commits
behind with merge-base `653e34e`; that came from a stale `origin/main` ref in
the isolated worktree and is withdrawn. No rebase is required.

## REQ traceability

| Req | Code | Test | Verdict |
|---|---|---|---|
| REQ-R3-1 | substrate.mjs:248-256 (E8) | substrate.test.mjs:286-309 | PASS |
| REQ-R3-2 | substrate.mjs:240-250 (E6) | substrate.test.mjs:240-261 | PASS (corrected — see below) |
| REQ-R3-3 | substrate.mjs:70 (POSTMERGE_STALE_MS), release-postmerge-workflows.test.mjs:222-230 | drift guard, empirically proven to fail on cadence change | PASS |
| REQ-R3-4 | substrate.mjs:159-171 (E3), brain-governance-status.mjs:160-169 | substrate.test.mjs:158-170, brain-governance-status.test.mjs:866-909 | PASS |
| REQ-R3-5 | substrate.mjs:187-198 (E4) | substrate.test.mjs:172-183 | PASS |
| REQ-R3-6 | every branch returns 6-field shape | substrate.test.mjs `assertShape` (behavioral, deepEqual on values, not implementation-mirroring) | PASS |
| REQ-R3-7 | substrate.mjs:83-87 (three-way normalizer) | substrate.test.mjs L1/L2/L3 rows + zero legacy call sites edited | PASS |
| REQ-R3-8 | brain-governance-status.mjs:358-378 (branch chain + the `evidence:` line) | brain-governance-status.test.mjs — the 4 branch tests + the dedicated NAMES-verifiable-and-mechanism test | PASS (corrected — see below) |
| REQ-R3-9 | fixture github-postmergeRuns-outage-window.json (`_provenance.recorded:true`) | brain-governance-status.test.mjs (outage replay lock) | PASS |

### Corrections after the cold review — two of the PASS rows above were false

Both were verified against BEHAVIOR and never against the requirement's own
contract text. Recording the class, not just the fix: a verify pass that reads
the code and the test but not the literal requirement cannot catch a spec that
says something the code does not.

- **REQ-R3-2** — the requirement and its scenario both mandated
  `mechanism: 'postmerge-inert'`. No such string existed anywhere in the tree:
  the evaluator emits `'postmerge-failing'` (substrate.mjs:246) and the test
  asserts `'postmerge-failing'`. The spec, not the code, was wrong — it would
  have been ratified into `openspec/specs/governance-v3/` on archive, where a
  later consumer matching on `postmerge-inert` would silently never fire. Spec
  corrected to the shipped mechanism.
- **REQ-R3-8** — the requirement says the output MUST *report* `verifiable`
  and `mechanism`; the scenario says it must *name* them. The render was
  driven by both fields and printed neither, so the requirement was satisfied
  only under a reading ("driven solely by") the text does not support. A
  single `evidence: mechanism=… verifiable=…` line now renders them from ONE
  site, with a dedicated test asserting it across two structurally different
  rows. Mutation-proven: deleting the line turns that test red.

A third finding of the same review — the terminal-run filter
(`runs.find(status === 'completed')`) having zero coverage — is not a REQ row
but is now pinned by `github-postmergeRuns-inflight.json` and its test.
Mutation-proven: `runs[0]` turns it red, and nothing else.

## Critical trap (three-way normalizer) — PROVEN, no CRITICAL found
`normalizePostMergeEvidence` (substrate.mjs:83-87): `raw===true`→L1,
`raw===false`→L2, everything else (including `undefined` from a throwing probe
via `safeProbe`, `null`, non-object) → `ledger:null`→L3. Traced by hand: a
throwing probe → `safeProbe` catches → returns `undefined` → not `===true`,
not `===false` → falls to `ledger: raw && typeof raw==='object' ? raw : null`
→ `undefined` is falsy → `ledger:null` → L3 branch (`available:false,
active:false, verifiable:true, mechanism:'postmerge-run-ledger-uncomputable'`).
Confirmed NEVER collapses into L2 (`false`). Constructed several additional
adversarial inputs (0, empty array, empty object, arbitrary string) — every one
fails closed to either L3 or the "unrecognized read state" fallback
(available:false), never active:true. Only L1 (unreachable in production) and
E8 (real proven-fresh-success) reach `active:true`, confirmed by both direct
tracing and a totality test (substrate.test.mjs:314-330).

## Totality
11-row decision table implemented exactly per design, plus one extra defensive
fallback row (unrecognized `ledger.read` value) that also fails closed to
`available:false` — strictly safer than the documented table, not a gap.

## Legacy fixture regression (REQ-R3-7)
`git diff 653e34e..HEAD -- '**/*.test.mjs' | rg '^\-.*postMergeCi: async'` → 0
matches (zero legacy call sites removed/edited). 19 new call sites added.
substrate.test.mjs 7→10, brain-governance-status.test.mjs 24→26. All originals
byte-identical.

## observedAt / Date.now() injection
Zero `Date.now()`/`new Date()` in substrate.mjs code (one comment mention).
Exactly one `Date.now()` in brain-governance-status.mjs, at the probe read
site (realPostMergeCiProbe:132), matching the design rule.

## Workflow-scoped endpoint
`brain-governance-status.mjs:156-159`:
`repos/${project}/actions/workflows/governance-postmerge.yml/runs?branch=...&per_page=20`
— confirmed workflow-scoped, not `rerunWorkflowRun`'s repo-wide pattern.

## Run URL / render
Confirmed E6's reason embeds `lastRun.htmlUrl`; printSubstrateReport's rung-3
block order matches design exactly (uncomputable → declared-armed →
armed → not-armed), verified by 4 print-block tests + the replay-lock test
asserting the exact run URL string.

## Drift guard — empirically proven, not merely asserted
Mutated the real `governance-postmerge.yml` cron to `'0 */6 * * *'`, ran the
guard test alone → FAILED as expected (`actual: '0 */6 * * *'` vs the daily
shape regex). Reverted via `git checkout --`, re-ran → PASSED. Genuinely
detects cadence drift.

## Acceptance criteria (issue #468)
(a) replay reports rung 3 inactive — PASS. (b) read failure → uncomputable
never armed — PASS. (c) rung 2/3 shape parity — PASS (both return exactly
`{available, active, verifiable, mechanism, reason, remedy}`).

## Fixture provenance
`github-postmergeRuns-outage-window.json` uses `_provenance.recorded:true`
(genuinely captured live), success/empty fixtures use `derived:true`
(hand-authored) — consistent with the existing sibling convention and the
test harness's own `assertProvenance` helper (exactly one of recorded/derived
required).

## Test evidence
`npm test` (isolated worktree at branch tip f1c5c6e): **2533/2533 passing**,
0 failing. `npm run brain:repo:check`: passes.

## WARNING 1 — commit 8f67496 bundles Task 1's production code+tests under a `docs(sdd)` type
`git show --stat 8f67496` shows the commit titled "docs(sdd): #468 — rung 3
earns armed from the run ledger (proposal, spec, design)" but its diff
includes `substrate.mjs | 209 +++...` and `substrate.test.mjs | 276 +++...`
— the entire Task 1 normalizer + 11-row decision table + full test suite, not
just planning docs. Materially reduces reviewability (a reviewer triaging by
commit type would deprioritize the safety-critical commit). Non-blocking; code
is correct and fully tested. Recommend calling this out explicitly in the PR
description.

## WARNING 2 — actual review-budget diff (479 lines) exceeds the tasks.md forecast (~285); repo gate still passes
`parseDiffNumstat` over `git diff --numstat origin/main...HEAD` with
`brain.config.json`'s `governance.ignoreList` → **479** (substrate.mjs 209,
brain-governance-status.mjs 88, 3 fixtures 182; test files and `openspec/`
correctly excluded). tasks.md's Review Workload Forecast estimated ~285 — all
three components were undercounted, so the forecast itself is the defect worth
noting.

Budget verdict (corrected): this repo resolves to tier `lite`
(`tierParams(resolveTier(config)).diffBudget` → **1000**), and the repo's own
gate `diffSize(raw, ignoreList, 1000)` returns `{pass: true}`. The 400 figure is
the `standard` tier's budget (`governance-tiers.mjs:215`), not this repo's. No
`size:exception` is warranted — the authoritative gate passes, so an exception
would be redundant. Single PR stands.

## SUGGESTION — unrecognized ledger.read fallback row undocumented
The extra defensive fallback row in evalRung3 (unrecognized `read` value) is
not one of design.md's 11 documented rows. Safer, not a defect — worth a
one-line note in design.md for future maintainers.

## Task/code state
All 6 tasks marked `[x]` in tasks.md match the actual commits (8f67496,
d766809, 3682ae8, f59ad33, 6d2cd94, c5c10cf, f1c5c6e). No unchecked tasks.
