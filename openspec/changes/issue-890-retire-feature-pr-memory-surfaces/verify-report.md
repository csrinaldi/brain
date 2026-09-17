# Verify Report: issue-890-retire-feature-pr-memory-surfaces

**Date**: 2026-09-17
**Verdict**: PASS WITH WARNINGS
**Verified in**: `/home/gandalf/IA/brain-issue-890` (branch `feat/issue-890-featmemory-retire-the-feature-pr-memory`, base `0119c698`)
**Mode**: full artifact set (proposal + specs x2 + design + tasks + apply-progress), read-only verification, no source files modified.

## Summary

12/12 tasks complete with evidence in the tree. All spec scenarios in both deltas
(`feature-working-memory`, `governance`) map to implemented code and a passing
covering test. Design decisions are honoured: lane enabled without touching
migration defaults, `brain:save` deleted with zero executable callers and no
shim, pre-push is checkpoint-only, `brain-next` matches the REQ-S5-5 state
table, `memory-gate` (`memory-presence.mjs`) semantics are byte-for-byte
unchanged apart from a wording edit, and canonical `brain/core/**` /
`brain/project/**` are untouched (`git status --short` empty on both). Full
suite: 5587/5588 passing (1 known, documented, Tier-2-only gap). Governance
gates: `brain:repo:check` and `brain:nav` clean; `brain:check`'s own
`diffSize` check passes the lite tier's 1000-line budget (468 governed
lines). Lane-safety guard confirmed no new `memory/*` remote branch and no
new GitHub PR was created by this verification run's `npm test`.

Two WARNING-level documentation gaps exist (one in canonical doctrine,
already drafted for maintainer promotion; one in an in-scope-adjacent
script comment not covered by design.md's File Changes table), plus the one
pre-declared, unavoidable Tier-2 test failure. No CRITICAL findings against
the change's own implementation.

## Requirement -> Evidence Matrix

### specs/feature-working-memory/spec.md

| Requirement / Scenario | Evidence | Test | Status |
|---|---|---|---|
| REQ-S0-2: no `brain:memory:share` call, no `.memory/` inspection/block | `brain/scripts/hooks/pre-push:17-56` — no share/ship call, no `.memory/` read | `pre-push.test.mjs` (67 "checkpoint runs ... without share, ship, or brain:save"; 83, 115 similar) | PASS |
| REQ-S0-2 Scenario: feature push does not materialize records | same file, lines 31-37 (checkpoint only, no share) | `pre-push.test.mjs:67-90` | PASS |
| REQ-S0-2 Scenario: repo checks remain enforced | `pre-push:40` (`check-refs.mjs \|\| exit 1`) | `pre-push.test.mjs` (repo-check failure cases) | PASS |
| REQ-S4-1: checkpoint runs before repo checks, no share prerequisite | `pre-push:34-37` then `:40` | `pre-push.test.mjs:67` | PASS |
| REQ-S4-1 Scenario: checkpoint runs when feature dir exists | `pre-push:34-37` (`find $changes_dir ...`) | `pre-push.test.mjs` | PASS |
| REQ-S4-1 Scenario: missing feature dir adds no memory dependency | `pre-push:35` guard (`[ -d "$changes_dir" ]`) | `pre-push.test.mjs` | PASS |

### specs/governance/spec.md

| Requirement / Scenario | Evidence | Test | Status |
|---|---|---|---|
| REQ-S5-7: `memory.lane.enabled: true` | `brain.config.json:16-18` | `issue-890-retirement.test.mjs` | PASS |
| REQ-S5-7 Scenario: capture guidance uses the lane | `docs/workflow-guide.md`, `bootstrap.sh:345`, `plain.mjs:18` all rewritten to `brain:memory:save --issue <id>` | manual/doc (no test file for static docs; verified by diff read) | PASS (doc-only, acceptable per graceful-handling for non-executable prose) |
| REQ-S5-5: `brain:next` state machine (7 scenarios: no-branch, checks-failing, needs-memory, ready+lane-enabled, ready+lane-disabled, open-pr, never reads porcelain `.memory/`) | `brain/scripts/brain-next.mjs:35-69` | `brain-next.test.mjs` — 8 tests, all named to the scenario (`no branch recommends brain:start`, `failed checks take precedence`, `missing issue-scoped record`, `issue-scoped record plus enabled lane`, `issue-scoped record with disabled lane` [added Batch 2], `open PR reports status`, `never requests porcelain .memory/ input`) | PASS — all 8/8 green |
| REQ-S5-3 REMOVED: `brain:save` gate retired | `package.json` (no `brain:save` script), `brain/scripts/brain-save.{mjs,test.mjs}` deleted | `issue-890-retirement.test.mjs` (asserts script + files absent) | PASS |

No unmapped requirements or scenarios found in either delta.

## Task -> Evidence Table

| Task | Evidence | Verified |
|---|---|---|
| 1.1 pre-push RED cases | `pre-push.test.mjs` 7 relevant tests | PASS (part of 107/107 focused run) |
| 1.2 brain-next RED state tests | `brain-next.test.mjs` 8 tests | PASS |
| 1.3 memory-presence + plain-backend regression | `memory-presence.test.mjs`, `plain.test.mjs` | PASS |
| 2.1 `memory.lane.enabled: true` | `brain.config.json:16-18`; `brain/scripts/config/**` (migration defaults) unmodified — `git diff 0119c698 --stat -- brain/scripts/config/` empty | PASS |
| 2.2 pre-push retirement | `brain/scripts/hooks/pre-push` — checkpoint/checks/size-warning kept, transport removed (read in full) | PASS |
| 2.3 delete `brain:save` | files absent on disk; `package.json` has no `brain:save` key; caller scan below shows zero executable references | PASS |
| 2.4 `brain-next.mjs` rewrite | issue provenance (`issueFromBranch`), `readRecordObservations`, `loadBrainConfigOrThrow`, no porcelain `.memory/` read | PASS |
| 2.5 wording replacement | `memory-presence.mjs:44` (wording-only diff, verified), `commit-msg:94`, `bootstrap.sh:345`, i18n keys (see below) | PASS |
| 3.1 docs guidance | `docs/workflow-guide.md`, `docs/methodology-map/{DESIGN-BRIEF,README,index.html}`, `README.md`, `docs/KNOWN-LIMITATIONS.md` all diffed and read; consistent with retirement | PASS |
| 3.2 maintainer-only drafts | 3 files under `brain-drafts/`, read in full; none touch `brain/core/**`/`brain/project/**` (confirmed via `git status --short brain/core brain/project` = empty) | PASS |
| 4.1 focused test run | 107/107 (this session's own run, see below) | PASS |
| 4.2 caller scan + npm test + repo:check + diff measure | all re-run this session (see below) | PASS |

12/12 tasks confirmed complete with fresh evidence, independent of apply-progress's own claims.

## Test Evidence (this session, verbatim)

**Lane-safety guard, BEFORE `npm test`**:
```
memory/* remote refs: (none)
open PRs: 1015 feat/issue-998-pr6-door
          1013 fix/issue-1011-fixtest-session-end-ships-flag-false-tes
          1009 feat/issue-998-pr5-reviews
          1004 feature/issue-967
```

**Focused suite** (`node --test brain/scripts/hooks/pre-push.test.mjs brain/scripts/brain-next.test.mjs brain/scripts/governance/checks/memory-presence.test.mjs brain/scripts/harness/backends/plain.test.mjs brain/scripts/issue-890-retirement.test.mjs brain/scripts/hooks/hooks.stream-discipline.test.mjs brain/scripts/hooks/hooks.attribution-parity.test.mjs brain/scripts/i18n/coverage.test.mjs brain/scripts/memory/session-end-ship.test.mjs brain/scripts/day-start.test.mjs`):
```
1..107
# tests 107
# pass 107
# fail 0
```

**Full suite** (`npm test`):
```
1..5588
# tests 5588
# pass 5587
# fail 1
```
The one failure, isolated and confirmed:
```
node --test brain/scripts/lib/managed-script-keys-doctrine.test.mjs
# tests 2
# pass 1
# fail 1
```
`AssertionError`: `MANAGED_SCRIPT_KEYS` (in `brain/core/managed-paths.mjs`, Tier-2 canonical,
agent-prohibited) still lists `'brain:save'`. This is the sole expected/documented red per
this run's own brief and per apply-progress; a promotion draft
(`brain-drafts/harness-contract-managed-script-keys.draft.md`) already proposes the one-line
fix.

**Lane-safety guard, AFTER `npm test`**: identical to BEFORE — zero new `memory/*` remote refs,
zero new open PRs. The Batch-3 fix (byte-identical to open PR #1013, verified via `gh api`
content diff) held.

**`npm run brain:repo:check`**:
```
✓ No prohibited references found.
✓ Artifact structure is valid.
```

**`npm run brain:nav`**:
```
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
```

**`npm run brain:check`**:
```
[PASS] diffSize
[PASS] adrPresence
[FAIL] issueLink — no issue reference found ...   (expected: no commit/PR exists yet)
[PASS] memoryPresence
[FAIL] npmTest — ...                              (the same documented Tier-2 gap)
[PASS] repoCheck
```
`issueLink` fails only because no commit/PR body exists yet in this read-only verify pass —
not a defect. `npmTest` fails for the same single documented reason as above.

**Diff size** (governed, via the real `diffSize()` check function, against base `0119c698`,
ignoreList from `brain.config.json` applied: `**/*.golden.json`, `**/*.test.mjs`, `.memory/**`,
`AGENTS.md`, `openspec/changes/**`, `openspec/specs/**`, `openspec/changes/archive/**`, lockfiles):
```
diffSize(budget=1000) -> pass: true
diffSize(budget=400)  -> pass: false, "diff size 468 lines exceeds budget of 400"
```
Raw diff (`git diff 0119c698 --numstat`, excluding `.memory/index.jsonl`): 26 tracked files,
348 insertions(+), 720 deletions(-) = 1068 raw lines (plus 1 untracked test file,
`issue-890-retirement.test.mjs`, 19 lines, not countable by `git diff` until staged).
Governed (test files + openspec/changes/** excluded): 468 lines. Passes this repo's actual
`lite`-tier 1000-line budget (confirmed both by `brain:check`'s own `[PASS] diffSize` and by
direct invocation of the check function). Exceeds the classic 400-line PR-review soft budget
by 68 lines and tasks.md's own 360-400 forecast slightly — informational, not blocking under
this repo's tier.

## Lane Safety (before/after)

| Check | Before | After |
|---|---|---|
| `git ls-remote origin 'refs/heads/memory/*'` | empty | empty |
| `gh pr list --repo csrinaldi/brain --state open` | #1015, #1013, #1009, #1004 | identical (no new PR) |

The incident described in apply-progress (PR #1007 real auto-merge, 2026-09-17T16:12:18Z) is
historical and already merged into `main` before this verify session started; it is not
reproducible risk from this worktree's current test file (confirmed: the real-entrypoint test
now uses `_spawn`/`_tmpdir` seams exclusively — read in full at
`brain/scripts/memory/session-end-ship.test.mjs:408-452`).

## Caller Scan (`brain:save` / `brain-save`)

Re-run this session, classified:
- `brain/project/decisions/adr-0028-*.md`, `adr-0034-*.md` — historical/doctrine text (protected path)
- `brain/core/managed-paths.mjs:57` — the one documented Tier-2 gap (see above)
- `memory-presence.test.mjs:40`, `issue-890-retirement.test.mjs:14-18`, `pre-push.test.mjs:67`, `brain-next.test.mjs:40` — test assertions proving absence
- `brain/scripts/vcs/fixtures/github-issueView-happy.json:19` — quoted historical GitHub issue body, unrelated test fixture

Zero executable callers. No shim, alias, or wrapper found anywhere in the tree.

## Design Coherence

| Decision | Honoured? | Evidence |
|---|---|---|
| `memory.lane.enabled: true` local-only, migration defaults untouched | Yes | `brain.config.json:16-18`; `brain/scripts/config/**` diff empty |
| Delete `brain:save` with no shim | Yes | files absent; zero callers; no compat wrapper |
| `memory-gate` unchanged, only wording updated | Yes | `memory-presence.mjs` diff is a single string edit, `pass`/`fail` logic untouched |
| Detect pending capture by issue provenance, never dirty `.memory/` | Yes | `brain-next.mjs:60-64` uses `issueFromBranch` + `readRecordObservations`, no `git status`/porcelain read anywhere in the file |
| One atomic PR, reviewable commits | Partially — no commit exists yet (by this run's own read-only mandate); apply-progress proposes a 7-commit plan; governed diff (468) fits the lite budget | N/A to verify phase |
| Canonical `brain/**` doctrine drafted, not edited | Yes | 3 drafts under `brain-drafts/`; `git status --short brain/core brain/project` empty |

## Findings

### CRITICAL
None found in the change's own implementation, tests, or configuration.

### WARNING

1. **`brain/core/methodology/consolidation-protocol.md:194-200`** still describes the retired
   feature-push transport as current behaviour: "Until the memory lane (#862) exists, records
   still travel with the branch — before pushing: `npm run brain:memory:share && git add
   .memory/`..." and "The pre-push hook ... runs `brain:memory:share` and warns, never blocks."
   Both sentences are now false given the retired `pre-push` (no `share` call, no `.memory/`
   check at all). This is canonical doctrine — Tier 3, agent-prohibited to edit — and a
   promotion draft already exists at
   `openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/consolidation-protocol-memory-lane.draft.md`.
   Must be promoted at or before merge so `main` does not carry contradictory doctrine.

2. **`brain/scripts/memory/staged-records-check.mjs:13-18`** — stale comment: cites a dead
   line reference (`pre-push:114-119` — the retired hook is now only 57 lines) and states
   "`brain:memory:share` runs earlier in that same hook," which is no longer true. Comment-only
   (the file's actual logic targets `pre-commit`, not `pre-push`, so no behavioural bug), but
   the rationale text is now factually wrong and was not listed in design.md's File Changes
   table — a small scope gap. Should be corrected in a follow-up commit.

3. **`brain/scripts/lib/managed-script-keys-doctrine.test.mjs`** fails (the sole full-suite
   red, 5587/5588). Root cause: `MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` (Tier-2
   canonical) still lists `'brain:save'`. Per the verify hard rule "test command exits non-zero
   -> CRITICAL," this would normally block PASS; downgraded to WARNING here because (a) the fix
   requires editing `brain/core/**`, which this repo's own authority tiers (AGENTS.md Tier 3)
   forbid an agent from doing, (b) a one-line promotion draft is already prepared
   (`brain-drafts/harness-contract-managed-script-keys.draft.md`), and (c) this exact failure
   was pre-declared as the sole expected red in this verification's own brief. It IS a real
   blocker for `brain:ship`'s own `npmTest` gate (confirmed: `brain:check` -> `[FAIL] npmTest`)
   until a maintainer applies the one-line promotion — flag prominently at PR review, do not
   let it be mistaken for an agent oversight.

4. **Diff review budget**: governed diff is 468 lines — comfortably under this repo's actual
   1000-line lite-tier budget (`brain:check` `[PASS] diffSize`), but 68 lines over the classic
   400-line PR-review soft budget and slightly over tasks.md's own 360-400 forecast. Not
   blocking under this repo's configured tier; worth noting to reviewers.

### SUGGESTION

1. `brain/scripts/memory/session-end-ship.test.mjs`'s current content was copied from the
   external `#1011` fix (open PR #1013) rather than authored independently in this branch;
   verified byte-identical via `gh api` content comparison. When this branch rebases onto
   `main` after PR #1013 merges, re-diff to confirm it stays a no-op (the file remains
   unstaged here, matching this batch's stated convention).

2. `docs/inbox/workflow-governance-layer.md` and
   `docs/inbox/memory-audit-handoff-2026-09-10.md` still describe the retired `brain:save`
   / pre-push transport (per apply-progress's own Risks section). Left untouched as
   legitimately out-of-scope (inbox is an explicitly ungoverned capture zone, and design/tasks
   scoped only `docs/workflow-guide.md` + active `docs/methodology-map/**`), but a follow-up
   issue would prevent operators reading stale inbox notes from being misled.

## Verdict

**PASS WITH WARNINGS**

Rationale: all 12 tasks are complete with independently-verified evidence; every spec
requirement/scenario in both deltas maps to implementation and a passing test; the one
full-suite test failure is the sole pre-declared, doctrine-gated (Tier-2/agent-prohibited)
exception with a prepared promotion draft; governance gates (`brain:repo:check`, `brain:nav`,
`diffSize`) pass; canonical `brain/core/**`/`brain/project/**` are untouched; and the
prior live-auto-merge incident's root cause is fixed and re-confirmed safe in this session.
The two documentation WARNINGs (consolidation-protocol.md contradiction, stale
staged-records-check.mjs comment) should be resolved — the first via the already-prepared
maintainer promotion, the second via a small follow-up commit — before or shortly after this
change ships, but neither blocks the runtime correctness of the retirement itself.

## Native Attempt Settlement

Attempt runtime: `atomic-retirement-verify` (ordinal 2, objective generation 2, token
`sha256:197401dcc3f097bf5e18e2c89f1c025f02d0ce7b65fbd9873be8c69921585738`).

Settle call and result recorded below.


Settle command result:
```json
{
  "state": "complete",
  "exit": "this change's runtime objective (atomic-retirement-verify) is complete; to continue with the next ordered work unit, run `gentle-ai sdd-attempt acquire --cwd <repo> --change <change> --request-id \"<unique-request-id>\" --work-unit \"<a different label>\" --evidence-goal \"<stable-goal>\" --max-attempts <count> --max-changed-lines <count>`; rescope applies only to an objective that is not complete, and reset discards this scope instead of succeeding it",
  "detail": "this change's runtime objective (atomic-retirement-verify) is complete; to continue with the next ordered work unit, run `gentle-ai sdd-attempt acquire --cwd <repo> --change <change> --request-id \"<unique-request-id>\" --work-unit \"<a different label>\" --evidence-goal \"<stable-goal>\" --max-attempts <count> --max-changed-lines <count>`; rescope applies only to an objective that is not complete, and reset discards this scope instead of succeeding it"
}
```

Outcome: `passed`, `evidence_revision: sha256:763d29545a84115c22962a79d4728d5ebd17fc4df89c584746fcf6d7612caf55`,
`remediates_evidence_revision: sha256:91ccafd93d2186784db925017ab681244c57bc5bbf24a9c6b87f89a147d22adb`,
`harness_disposition: reused`. Attempt `atomic-retirement-verify` (ordinal 2) is now complete;
the change's runtime objective is fully settled.

## Next Recommended

`sdd-archive` — all artifacts present, all tasks verified complete, no CRITICAL findings.
Before archiving (or as part of it), the human/maintainer should: (1) promote
`consolidation-protocol-memory-lane.draft.md` and
`harness-contract-managed-script-keys.draft.md` to `brain/core/**` (Tier-2 action), which also
clears the one documented test red; (2) decide on the commit/PR plan proposed in
apply-progress.md (7 reviewable commits, governed diff 468 lines, well under the lite tier's
1000-line budget); (3) optionally fix the stale comment in
`brain/scripts/memory/staged-records-check.mjs:13-18` in the same or a follow-up commit.

## Skill Resolution

paths-injected — 5 paths were provided by the orchestrator and loaded in full:
`sdd-verify/SKILL.md`, `_shared/sdd-phase-common.md`, `_shared/persistence-contract.md`,
`_shared/openspec-convention.md`, and `AGENTS.md` lines 120-195 (authority tiers).
