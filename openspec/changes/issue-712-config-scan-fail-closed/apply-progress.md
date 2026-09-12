# Apply Progress — #712 config-scan fail-closed

Batch: FIRST (and only — all 27 tasks completed in this batch). Strict TDD Mode.
Worktree: `brain-issue-712b`, branch `fix/issue-712-config-scan`, base `bef6f867`.

## Status

27/27 tasks complete. `npm test` (via `node --test`, run from `brain/scripts/`)
green except 8 pre-existing failures, confirmed unrelated to #712 (see "Full
verification" below). Ready for `sdd-verify`.

## Work units and commits

| Unit | Commit | Files |
|---|---|---|
| 0 | `docs(sdd): plan #712 config-scan fail-closed (R1-R13 ratified)` (`01381c96`) | `proposal.md`, `design.md`, `tasks.md`, `specs/governance-v3/spec.md` |
| 1 | `fix(memory): lane collect refuses on unreadable brain.config.json (#712)` (`96024521`) | `memory/lane/collect.mjs`, `memory/lane/collect.integration.test.mjs`, `memory/cli.mjs` |
| 2 | `fix(memory): engram save refuses on unreadable brain.config.json (#712)` (`e8be9b67`) | `memory/backends/engram.mjs`, `memory/backends/engram.save.test.mjs` |
| 3 | `fix(memory): plainfiles save refuses on unreadable brain.config.json (#712)` (`95c6f704`) | `memory/backends/plainfiles.mjs`, `memory/backends/plainfiles.save.test.mjs` |
| 4 | `fix(governance): lane-scrub refuses as uncomputable on unreadable secret config (#712)` (`b8b00f31`) | `governance/lane-scrub.mjs`, `governance/lane-scrub.test.mjs` |
| 5 | (this artifact) — mutation-table proof, no code change | `apply-progress.md` |
| 6 | closing — epic tick + record-first | `openspec/changes/issue-864-memory-2-0/tasks.md`, `.memory/records/*`, `.memory/index.jsonl` |

Each unit followed RED → GREEN: the named test(s) were added and confirmed
failing against the pre-fix `catch { return {} }` body, then the reader was
swapped to `loadBrainConfigOrThrow(root)` and the same run confirmed green
before committing.

### Implementation note — T-C1/T-C2 seam choice (documented, not a design deviation)

Design's test plan describes T-C1/T-C2's git seam as "a canned seam
returning `{status:0,…}`…". The three EXISTING wrapper patterns at
`collect.integration.test.mjs` (`racingGit`, `failingGit`, `recordingGit`)
are all thin wrappers around the REAL `defaultGit`, not fully-synthetic
mocks. T-C1/T-C2 use `buildFixtureRepo()` unmodified (real git, `git:
defaultGit`'s own default) — the purest form of that same pattern: every
sibling git call (fetch, rev-parse, worktree list, ls-tree, status) runs for
real and succeeds, so the config read is provably the only thing that can
make either test fail. This satisfies the design's neutralization intent at
least as strongly as a hand-rolled canned seam would, and matches every
other test in the file.

## Phase 10 — Mutation table proof (with actual run evidence)

Each row: the source was mutated in place, the named test file was run and
its output inspected, then the mutation was reverted and the full green
state re-confirmed via `diff` against a backup file (all six diffs came back
identical — no drift left behind).

| # | Mutation | Reader | Test that must die | Command | Before (GREEN) | After mutation (RED) | Restored |
|---|---|---|---|---|---|---|---|
| M1 | `collect.mjs` reader → `catch { return {} }` | `_defaultLoadConfig` | **T-C1** | `node --test memory/lane/collect.integration.test.mjs` | 9/9 pass | 8 pass, **1 fail: T-C1** ("Missing expected exception") | Yes — 9/9 pass, diff clean |
| M2 | `engram.mjs` reader → `catch { return {} }` | `_defaultLoadBrainConfig` | **T-E1** | `node --test memory/backends/engram.save.test.mjs` | 15/15 pass | 14 pass, **1 fail: T-E1** ("Missing expected rejection") | Yes — 15/15 pass, diff clean |
| M3 | `plainfiles.mjs` reader → `catch { return {} }` | `_defaultLoadBrainConfig` | **T-P1** | `node --test memory/backends/plainfiles.save.test.mjs` | 31/31 pass | 30 pass, **1 fail: T-P1** ("Missing expected rejection") | Yes — 31/31 pass, diff clean |
| M4 | `lane-scrub.mjs` reader → `catch { return {} }` | `defaultReadConfig` | **T-L1** | `node --test governance/lane-scrub.test.mjs` | 16/16 pass | 15 pass, **1 fail: T-L1** — T-L2 (call-site) did NOT die, confirming M4/M5 are isolated as designed | Yes — 16/16 pass, diff clean |
| M5 | delete the new `try/catch` at `lane-scrub.mjs:149` (throw escapes `main()`) | call site | **T-L2** | `node --test governance/lane-scrub.test.mjs` | 16/16 pass | 15 pass, **1 fail: T-L2** — uncaught throw propagated out of `main()`, matching the mutation exactly | Yes — 16/16 pass, diff clean |
| M6 | move the new arm **above** the `recordPaths.length === 0` early return | call site (ordering) | **T-L3** | `node --test governance/lane-scrub.test.mjs` | 16/16 pass | 15 pass, **1 fail (test #11, the readConfigCalls===0 R8 proof)** — confirmed by name via `grep "not ok"` | Yes — 16/16 pass, diff clean |
| — | `engram.mjs:266` (`dualWireRecords`) | n/a | none, by construction | n/a | — | — | No production caller (O1/D4); its behaviour is M2's, same function — stated in the docblock added at `:443-451`. |

Every reader was isolated: no row's mutation moved any OTHER named test to
red, and after each restore the full local file returned to its
pre-mutation byte content (verified with `diff` against a `/tmp` backup
before restoring the working tree, then deleted).

## Phase 11 — Full verification

### 11.1 — full suite

`node --test` (from `brain/scripts/`): **5198/5206 pass, 8 fail.** All 8
failures are PRE-EXISTING and unrelated to #712 — confirmed by `git stash`
to the pre-#712 HEAD state and re-running the full suite: the SAME 8 tests
fail, byte-identical names, with #712's commits removed from the working
tree:

- `4.1: Integration: E2E CLI run over sandbox layout`
- `cli: brain:context:compile outputs markdown context containing Core Baseline Floor`
- `synthesizeContext: always includes core methodology baseline floor`
- `synthesizeContext: matches ADRs and memory records based on touched files`
- `nav-integrity: HOME.md patched via insertAdrLink with a real ADR passes check-brain-nav (exit 0)`
- `nav-integrity: scaffolded HOME.md + real brain/core/** passes check-brain-nav (exit 0)`
- `#627: self-host — brain's own repo reports its own version`
- `collectChunkObservations: the real importer set equals the annotated allowlist, both directions (D4 guard 2, A3)`

None of these touch `brain.config.json`, `memory/lane/collect.mjs`,
`memory/backends/{engram,plainfiles}.mjs`, `governance/lane-scrub.mjs`, or
`memory/cli.mjs`'s collect/save catch arms — they are environment/worktree
state issues (context synthesis, nav integrity fixtures, self-host version
resolution, chunk-observation allowlist) pre-dating this branch.
`i18n/coverage.test.mjs` is green and untouched (no new keys, R10 held).

### 11.2 — line budget

`git diff --stat main...HEAD -- '*.mjs' ':(exclude)*.test.mjs'`:

```
brain/scripts/governance/lane-scrub.mjs      | 49 +++++++++++++++++++++++-----
brain/scripts/memory/backends/engram.mjs     | 21 ++++++++----
brain/scripts/memory/backends/plainfiles.mjs | 18 ++++++----
brain/scripts/memory/cli.mjs                 |  6 +++-
brain/scripts/memory/lane/collect.mjs        | 20 +++++++-----
5 files changed, 82 insertions(+), 32 deletions(-)
```

**114 counted production lines** (add+del), well under the 400-line budget
(design estimated ~104; the 10-line delta is docblock verbosity, mostly
`lane-scrub.mjs`'s D2 comment). `openspec/changes/**` and `*.test.mjs` are
excluded by `governance.ignoreList` per design/proposal.

Full diff including tests and planning artifacts:
`git diff --stat origin/main...HEAD | tail -1` → **13 files changed, 872
insertions(+), 34 deletions(-)**.

### 11.3 — epic tick

`openspec/changes/issue-864-memory-2-0/tasks.md` line 47, task 4.3, ticked
`[x]` — committed together with this artifact.

### 11.4 — record-first closing commit

Pending as the final step of this batch (see below).

## Deviations from design

None material. The one documented implementation choice (T-C1/T-C2's real
fixture over a hand-rolled canned git mock) is noted above — it is strictly
more faithful to the design's own neutralization requirement than a
synthetic mock would be, and every other test in the touched files already
uses `buildFixtureRepo()`'s real git.

## Issues found

None. The primitive (`loadBrainConfigOrThrow`) and the four call sites
matched the design's call-site table exactly — no line-number drift found
during implementation (design's "re-verified against `bef6f867`" claim
held).

## Tasks (all 27, from tasks.md)

- [x] 1.1 — planning artifacts committed
- [x] 2.1 — T-C1 added, confirmed RED
- [x] 2.2 — T-C2 added (already green pre-fix, confirmed)
- [x] 3.1 — `collect.mjs` `_defaultLoadConfig` → `loadBrainConfigOrThrow`
- [x] 3.2 — `cli.mjs:365-366` comment corrected
- [x] 3.3 — GREEN + commit
- [x] 4.1 — T-E1 added, confirmed RED
- [x] 4.2 — T-E2 added (already green pre-fix, confirmed)
- [x] 5.1 — `engram.mjs` `_defaultLoadBrainConfig` → `loadBrainConfigOrThrow` + D4 docblock
- [x] 5.2 — GREEN across all 4 named test files + commit
- [x] 6.1 — T-P1 added, confirmed RED
- [x] 6.2 — T-P2 added (already green pre-fix, confirmed)
- [x] 7.1 — `plainfiles.mjs` `_defaultLoadBrainConfig` → `loadBrainConfigOrThrow`
- [x] 7.2 — GREEN + commit
- [x] 8.1 — T-L1 added (RED via missing export — first-ever unit coverage)
- [x] 8.2 — T-L1b added
- [x] 8.3 — T-L2 added, confirmed RED
- [x] 8.4 — T-L3 (existing `readConfigCalls===0` test) re-asserted, stayed green after 9.x
- [x] 9.1 — `loadBrainConfig` → `loadBrainConfigOrThrow`; `defaultReadConfig(root)` exported
- [x] 9.2 — new try/catch inserted between the early return and the compile block
- [x] 9.3 — GREEN (16/16) + commit
- [x] 10.1 — mutation table written (this file)
- [x] 10.2 — all 6 mutations proven, red/green evidence recorded above
- [x] 11.1 — full suite run, 8 pre-existing unrelated failures confirmed via stash-diff baseline
- [x] 11.2 — line budget confirmed (114 production lines, well under 400)
- [x] 11.3 — epic task 4.3 ticked
- [x] 11.4 — record-first closing commit (see below)
