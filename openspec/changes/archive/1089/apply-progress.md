# Apply Progress: issue-1089-agents-regen-claim

**Mode**: Strict TDD
**Status**: 14/14 tasks complete (12 original + 2 remediation). Ready for verify.

## Completed Tasks

### Phase 1: `init()` Return Shape
- [x] 1.1 RED — extended test 2.1 to assert the happy-path resolved value
- [x] 1.2 RED — new test: `missingDocs` names the one unreadable path
- [x] 1.3 RED — new test: `agentsWritten: false` on write failure, never throws
- [x] 1.4 RED — new test: `geminiWritten: false` on gemini-settings write failure
- [x] 1.5 RED — new test: no `ok` property under any failure combination
- [x] 1.6 GREEN — `init()` accumulates `missingDocs`/`agentsWritten`/`geminiWritten` and returns them
- [x] 1.7 GREEN — `REGENERATE_HINT` exported
- [x] 1.8 — test 2.4 (end-to-end dispatch) extended to assert the resolved shape

### Phase 2: `brain-upgrade.mjs` Wording
- [x] 2.1 RED — new test: `brain/HOME.md` missing → message names it + `AGENT_PLATFORM=antigravity npm run brain:env:init`, no byte-identical line
- [x] 2.2 RED — existing happy-path test (REQ-397-4) extended with exact byte-identical success-line assertion
- [x] 2.3 GREEN — `brain-upgrade.mjs` imports `REGENERATE_HINT` (destructured from the existing dynamic `import()`), captures `antigravityInit()`'s report, and branches the printed message
- [x] 2.4 — full `npm test` green; `antigravity.drift.test.mjs` confirmed green (calls `compileAgentsMd` directly, unaffected)

### Phase 3: Sweep Confirmation
- [x] 3.1 — re-read `brain-upgrade.mjs` end to end; the other `catch` blocks (`acquireLock`, `copyManaged`'s snapshot/rollback catch, config-read `catch { return [] / null }`, the outer regen `catch (err)`) are not the swallow-then-claim-success shape. Only the one instance at the old `:680` existed.
- [x] 3.2 — grepped all `*.test.mjs` for the literal byte-identical success line; only the two new assertions in `brain-upgrade.test.mjs` reference it (one asserting presence, one asserting absence) — no pre-existing test pinned it as the only possible output.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.5, 1.8 | `antigravity.test.mjs` | Unit | ✅ 23/23 (baseline) | ✅ Written (6 failing) | ✅ Passed (27/27) | ✅ 4 distinct failure-combination cases | ✅ None needed |
| 1.6, 1.7 | `antigravity.mjs` | Unit (impl) | N/A (impl file) | — | ✅ | — | ✅ Clean — reused existing catch blocks, added 3 local accumulators |
| 2.1, 2.2 | `brain-upgrade.test.mjs` | Unit (subprocess/E2E-style) | ✅ 20/20 (baseline) | ✅ Written (1 failing) | ✅ Passed (21/21) | ✅ 2 cases (missing-doc / byte-identical) | ✅ None needed |
| 2.3 | `brain-upgrade.mjs` | Unit (impl) | N/A (impl file) | — | ✅ | — | ✅ Clean — write-failure checked first per spec's "regardless of missingDocs" |

### Test Summary
- **Total tests written**: 6 new test cases (4 in `antigravity.test.mjs`, 1 new + 1 extended in `brain-upgrade.test.mjs`, plus 2 existing tests extended with additional assertions)
- **Total tests passing**: 27/27 (`antigravity.test.mjs`), 21/21 (`brain-upgrade.test.mjs`), 6342/6342 (full `npm test`)
- **Layers used**: Unit (all)
- **Approval tests** (refactoring): None — no refactoring tasks
- **Pure functions created**: 0 (widened an existing function's return value; no new pure helpers needed)

## Exact New Message Strings

- Byte-identical (unchanged): `Regenerated AGENTS.md from YOUR brain/HOME.md (it is compiled, not shipped — see #397).`
- `brain/HOME.md` missing:
  - warn: `brain/HOME.md is missing — AGENTS.md was compiled from the methodology docs only, not from anything of yours.`
  - info: `` Run `AGENT_PLATFORM=antigravity npm run brain:env:init` to create brain/HOME.md and regenerate AGENTS.md from it. ``
- Other doc(s) missing:
  - warn: `` AGENTS.md was compiled without {N} missing source doc(s): {comma-joined paths} ``
  - info: `` Run `AGENT_PLATFORM=antigravity npm run brain:env:init` to rebuild it once they exist. ``
- Write failed (checked first, regardless of `missingDocs`):
  - warn: `Could not write AGENTS.md — the regeneration did not complete.`
  - info: `` Run `AGENT_PLATFORM=antigravity npm run brain:env:init` to rebuild it. ``

## Deviations from Design

1. **Import mechanism for `REGENERATE_HINT`**: the design/tasks said "import `REGENERATE_HINT` from `./harness/backends/antigravity.mjs`". The existing code already loads `antigravity.mjs` via a lazy dynamic `import(new URL(...))` inside the `try` block (not a static top-level import) — presumably to keep it out of the module graph until this code path runs. Rather than adding a second, static top-level import (which would load the module twice under two different specifiers and diverge from the existing lazy-load pattern), `REGENERATE_HINT` is destructured from the same dynamic import call alongside `init`. Functionally equivalent; smaller diff; preserves the existing lazy-load intent.
2. **Branch order / priority**: tasks.md 2.3 lists the four messages in the order "byte-identical, HOME.md-naming, generic-missing, write-failed", which read literally as a simple if/else-if chain would make write-failure reporting lose to a HOME.md/missing-docs message when both occur together. The spec's own requirement text says the write-failure scenario applies "regardless of `missingDocs`". Implemented the write-failure check FIRST (`if (!report.agentsWritten) ... else if (missingDocs.length === 0) ... else if (missingDocs.includes('brain/HOME.md')) ... else ...`) so a write failure is always reported, never masked by a missing-doc message. This satisfies all four spec scenarios; the tasks.md enumeration order was descriptive, not a literal if/else-if instruction, and this reading was necessary to satisfy the spec's explicit "regardless of missingDocs" clause.
3. **`captureWarn` test helper signature change**: `antigravity.test.mjs`'s existing `captureWarn(fn)` helper only returned the captured `warnings` array, discarding `fn()`'s resolved value. The new RED tests need both the warnings AND `init()`'s resolved report, so `captureWarn` now returns `{ warnings, result }`. The two pre-existing call sites (test `2.3` x2) were updated to destructure `{ warnings }` — no assertion behavior changed, this is a non-behavioral signature refactor of a private test helper.
4. **Test 2.1's happy-path fixture**: extending test `2.1` to assert `geminiWritten: true` exposed that the test did not inject `_writeGeminiSettings`, so the real default writer ran against the fake `/fake/repo` root and threw (ENOENT/EACCES-class failure), which would have made `geminiWritten` false — not a bug in `init()`, but a gap in the test's existing fixture that only surfaced once the resolved value was actually asserted. Added `_writeGeminiSettings: () => {}` to the test to keep it a true happy-path fixture, consistent with how `writeAgents` was already faked in the same test.

## Governed Diff (vs origin/main, excluding `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`)

```
 brain/scripts/brain-upgrade.mjs                | 23 ++++++++++++++++++++---
 brain/scripts/harness/backends/antigravity.mjs | 16 ++++++++++++++--
 2 files changed, 34 insertions(+), 5 deletions(-)
```

Full diff including tests (for reference, not part of the governed budget):

```
 brain/scripts/brain-upgrade.mjs                    | 23 ++++-
 brain/scripts/brain-upgrade.test.mjs               | 39 ++++++++-
 brain/scripts/harness/backends/antigravity.mjs     | 16 ++-
 .../scripts/harness/backends/antigravity.test.mjs  | 77 ++++++++++++++++++--
 4 files changed, 140 insertions(+), 15 deletions(-)
```

400-line budget risk: Low (as forecast). No chained PRs needed — single PR, both work units.

## Commits

- `997b3fa6` — feat(harness): antigravity init() reports missing docs and write outcomes (#1089)
- `c9997af2` — fix(scripts): brain-upgrade words its AGENTS.md regen claim from init()'s report (#1089)

## Test Results

- `node --test brain/scripts/harness/backends/antigravity.test.mjs`: 27/27 pass
- `node --test brain/scripts/brain-upgrade.test.mjs`: 21/21 pass
- `node --test brain/scripts/harness/backends/antigravity.drift.test.mjs`: 5/5 pass (confirmed unaffected)
- `npm test` (full suite): 6342/6342 pass

## Remaining Tasks

None — all 12 tasks complete.

## Risks

None identified. The additive report shape does not change `harness/cli.mjs`'s exit-code behavior (`r.ok === false` never matches an object with no `ok` key), and both existing callers of `init()` (the CLI dispatch path and `brain-upgrade.mjs`) that ignore or now inspect the return value behave as designed.

## Remediation (verify FAIL)

A fresh-context verify pass (see `openspec/changes/issue-1089-agents-regen-claim/verify-report.md`) returned FAIL: one CRITICAL — spec.md's "A different source doc is missing" scenario (Requirement: "brain-upgrade's Regen Claim Matches the Report") had zero covering test anywhere in the repo, because `tasks.md`'s Phase 2 only planned tests for the `brain/HOME.md`-missing and byte-identical-happy-path branches. This batch closes that gap and one SUGGESTION. No production code changed — only test files and this change's own artifacts.

### Completed Tasks (Phase 4)

- [x] 4.1 RED/GREEN — new `brain-upgrade.test.mjs` case for a methodology doc missing while `brain/HOME.md` is present
- [x] 4.2 — hardened `antigravity.test.mjs` tests `1.2`/`1.3` to inject `_writeGeminiSettings: () => {}`

### 4.1 — Closing the CRITICAL

**Fixture change**: `makeUpgradableConsumer(prefix, { geminiSettings, homeMd, missingMethodologyDocs = [] })` gained the `missingMethodologyDocs` param — a list of methodology doc slugs (e.g. `'sdd-layout'`) to leave unwritten on disk. Previously the fixture wrote all four methodology docs unconditionally, so no test could reach the generic "compiled without N missing source doc(s)" branch (`brain-upgrade.mjs:695`) via a non-`brain/HOME.md` path — omitting `homeMd` only ever exercises the `brain/HOME.md`-specific branch.

**New test**: `brain:upgrade: a different source doc is missing — names it as compiled-without, not the HOME.md message, not the byte-identical success line` — builds a consumer with `homeMd` present and `missingMethodologyDocs: ['sdd-layout']`, runs `runBrainUpgrade`, and asserts:
1. the output matches `/AGENTS\.md was compiled without 1 missing source doc\(s\): brain\/core\/methodology\/sdd-layout\.md/`
2. the byte-identical success line (`"Regenerated AGENTS.md from YOUR brain/HOME.md (it is compiled, not shipped — see #397)."`) is absent
3. the `brain/HOME.md`-specific message (`"brain/HOME.md is missing"`) is absent — proving the generic branch fired, not the HOME.md branch, on a `missingDocs` array that does not contain `brain/HOME.md`

**RED evidence**: this is a wording/branching assertion against code that already exists in the working tree from the prior batch (commit `c9997af2`), so "RED against the current tree" would trivially be GREEN. Per the remediation instructions, I proved RED against the **pre-change code path** instead: temporarily replaced `brain/scripts/brain-upgrade.mjs` with `git show c9997af2^:brain/scripts/brain-upgrade.mjs` (the version with the old unconditional `ok('Regenerated AGENTS.md from YOUR brain/HOME.md ...')` call and no branching at all), ran `node --test --test-name-pattern="a different source doc is missing" brain/scripts/brain-upgrade.test.mjs`, and confirmed failure:

```
failureType: 'testCodeFailure'
error: the message must name the missing methodology doc and say it was compiled without it:
  ✓ Regenerated AGENTS.md from YOUR brain/HOME.md (it is compiled, not shipped — see #397).
  ...
  harness: antigravity could not read brain/core/methodology/sdd-layout.md — ENOENT: ...
# tests 1 / # pass 0 / # fail 1
```

The old code printed the byte-identical success line unconditionally even though `sdd-layout.md` could not be read — exactly the defect class #1089 exists to fix, and exactly what this new test now catches. Restored the current `brain-upgrade.mjs` from a backup copy immediately after (`git diff --stat brain/scripts/brain-upgrade.mjs` showed no diff afterward, confirming a clean restore), then re-ran the full `brain-upgrade.test.mjs` file: 22/22 pass (was 21/21 — the +1 is the new test, now GREEN against the real, current implementation).

**GREEN**: `node --test brain/scripts/brain-upgrade.test.mjs` → 22/22 pass.

### 4.2 — Closing the SUGGESTION

`antigravity.test.mjs` tests `1.2` and `1.3` did not inject `_writeGeminiSettings`, so `init()`'s real default writer ran against `/fake/repo/.gemini` on every run of those two tests, failing safely only because of ambient filesystem permissions (no `/fake` directory exists and this user cannot write to `/`) — not because the tests were hermetic by construction. Added `_writeGeminiSettings: () => {}` to both, matching test `2.1`'s existing fix (apply-progress deviation 4 from the original batch).

**Remaining non-hermetic instances**: two pre-existing `2.3`-named tests in the same file (`init() never throws when _readDoc throws on one path`, `init() never throws when _writeAgents throws`) still call `init({ ..., _repoRoot: '/fake/repo' })` without injecting `_writeGeminiSettings`. These were named in the verify report's SUGGESTION as the same pre-existing pattern but were NOT the two instances (`1.2`/`1.3`) the remediation prompt asked me to close — I did not touch them, to keep this batch scoped to the named findings. They remain a candidate for a future follow-up.

**GREEN**: `node --test brain/scripts/harness/backends/antigravity.test.mjs` → 27/27 pass (same count as before — hardening the two tests changed their internals, not their pass/fail or count).

### Full Suite

`npm test` → 6343/6343 pass (was 6342/6342 before this batch; +1 is the new `brain-upgrade.test.mjs` case).

### Governed Diff (Remediation Batch)

Test-only changes; the governed diff (excluding `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`) is **unchanged** from the original batch:

```
$ git diff --numstat origin/main...HEAD -- . ':(exclude)**/*.test.mjs' ':(exclude).memory/**' ':(exclude)openspec/**' ':(exclude)AGENTS.md'
20      3       brain/scripts/brain-upgrade.mjs
14      2       brain/scripts/harness/backends/antigravity.mjs
```
2 files, 34 insertions(+), 5 deletions(-) — 39 governed changed lines, identical to the pre-remediation figure. No production code was touched in this batch.

Full test-file diff for this batch:
```
 brain/scripts/brain-upgrade.test.mjs               | 33 +++++++++++++++++++++-
 brain/scripts/harness/backends/antigravity.test.mjs | 11 ++++++--
 2 files changed, 41 insertions(+), 3 deletions(-)
```

### TDD Cycle Evidence (Remediation)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `brain-upgrade.test.mjs` | Unit (subprocess) | ✅ 21/21 (baseline) | ✅ Written; proven failing against pre-change `brain-upgrade.mjs` (1/1 fail) | ✅ Passed against current code (22/22) | ➖ Single scenario (spec defines exactly this one case) | ➖ None needed |
| 4.2 | `antigravity.test.mjs` | Unit | ✅ 27/27 (baseline, tests already existed) | N/A — hermetic hardening of existing tests, not new behavior | ✅ 27/27 after change | ➖ N/A | ➖ None needed |

### Remediation Commit

- `test(harness): cover the generic missing-source-doc wording and make the fixtures hermetic (#1089)` — modifies `brain/scripts/brain-upgrade.test.mjs` and `brain/scripts/harness/backends/antigravity.test.mjs` only.
