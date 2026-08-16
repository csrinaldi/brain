---
status: draft
issue: 676
---

# Tasks — `test/adr-status-line-single.e2e.test.mjs` (issue 676, point 2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180-220, one new file |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | not specified — Low risk holds under any strategy |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

`**/*.test.mjs` is on `brain.config.json`'s `governance.ignoreList`. The
new file's name ends in `.test.mjs`, so this entire diff counts near zero
against this repo's own diffSize gate. No production code, no dependency.

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| 1 | Phases 1-4, one file | PR 1 | Arm C (Phase 5) excluded — human-gated |

## Phase 1: RED — fixture assertions first (Arm A + vacuity)

- [x] 1.1 Create the test file: `node:test`/`assert`/`fs`/`os`/`path`/`url` imports, `checkSingleStatusLine` from `amendment-draft.mjs`, `REPO_ROOT`/`DECISIONS_DIR` (D2). Stub `readSignedAdrs`, `auditAdrs`, `renderOffenders` to throw `'not implemented'`.
- [x] 1.2 Vacuity test() (REQ-676-3): `assert.throws(() => readSignedAdrs('test/fixtures'), /holds no ADR/)` against the existing empty `test/fixtures/`.
- [x] 1.3 Arm A test() (REQ-676-4, REQ-676-6 axis 3): `mkdtempSync` under `tmpdir()`; 4 fixtures (two-Status preamble, two-Status body, zero-Status, one-Status control); assert rendered output names each offender's path/count/lines, never the control.
- [x] 1.4 Run the file; confirm 1.2 and 1.3 fail on the stub (genuine RED — the one real red-green cycle here per spec Purpose).

## Phase 2: GREEN — implement the three functions

- [x] 2.1 `readSignedAdrs(dir = DECISIONS_DIR)` (D2/D3/D5): `resolve(REPO_ROOT, dir)`, `readdirSync`, filter to the anchored ADR name shape, throw `` `${dir} holds no ADR — the sweep cannot run` `` on empty enumeration, return `{name, path, text}[]`.
- [x] 2.2 `auditAdrs(adrs)`: map to `checkSingleStatusLine(text)`, return offenders only as `{path, count, lines}[]`.
- [x] 2.3 `renderOffenders(offenders)` (D4): path/count/lines per offender plus the remedy sentence (`applyStatusAct` refuses; hand repair; Tier 3) — REQ-676-4.
- [x] 2.4 Re-run; confirm 1.2 and 1.3 now pass (GREEN).

## Phase 3: Remaining test blocks (machinery already green)

- [x] 3.1 Count-floor test() (REQ-676-3): real `DECISIONS_DIR`, `assert.ok(adrs.length >= 25)`.
- [x] 3.2 Born-green main-sweep test() (REQ-676-1, -2, -5): every real ADR's `checkSingleStatusLine(text).ok === true`; no allowlist anywhere in file.
- [x] 3.3 Arm B test() (D5): read one real ADR read-only, splice a second `**Status**:` line into the in-memory string, assert it's flagged. No write to `brain/**`.

## Phase 4: Verification

- [x] 4.1 Run the full suite; all 5 test() blocks pass, 30 real ADRs green (PR #692 baseline).
- [x] 4.2 `git status --short`: only the new test file; nothing under `brain/project/**` or `brain/core/**` touched.
- [x] 4.3 Confirm no registry/allowlist/skip pattern exists in the new file (REQ-676-5).

## Phase 5: Arm C — REQ-676-6's tree-proof round (BLOCKED — human)

- [ ] 5.1 **BLOCKED — human required.** Tier 2 transient write to `brain/project/decisions/**`. `sdd-apply` lands Phases 1-4, then STOPS and asks the human to: commit/stash → mutate ONE real ADR to two `**Status**:` lines → run suite → confirm failure names that path/count → `git checkout -- <path>` → `git status --short` clean. Do not substitute Phases 1-4 for this.
