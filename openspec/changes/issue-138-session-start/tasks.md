---
status: draft
issue: 138
---

# Tasks — session:start (issue 138)

## Review Workload Forecast

| Dimension | Estimate |
|---|---|
| Code (new libs + session-start.mjs + refactors) | ~280–340 lines |
| Tests (colocated `*.test.mjs`, strict TDD) | ~420–520 lines |
| i18n (en.mjs + es.mjs, `session.*` keys) | ~40–60 lines |
| Config (`package.json` + `.claude/settings.json`) | ~12–15 lines |
| **Total estimated changed lines** | **~750–930** |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

This change touches a brand-new script (`session-start.mjs`), two new shared
libs (`lib/git-branch.mjs`, `lib/memory-manifest.mjs`), a new pure resolver
(`deriveChangeFromBranch`), refactors of two existing files (`day-start.mjs`,
`memory/backends/engram.mjs`), full strict-TDD test coverage for every unit
(8+ test files), bilingual i18n additions, and two config edits. Even with
test code counted separately from production code, the production+test total
comfortably exceeds the 400-line single-PR budget. Splitting also isolates
risk: the day-start/engram refactor (behavior-preserving) should be reviewable
and mergeable independently of the new, more speculative session-start
surface.

### Suggested slice / PR split

- **PR1 — Shared libs + consumer refactors** (REQ-3, REQ-9): `lib/git-branch.mjs`,
  `lib/memory-manifest.mjs`, plus the `day-start.mjs` and `engram.mjs` refactors
  to consume them. Fully behavior-preserving, independently green (day:start
  test suite still passes), smallest blast radius, lowest risk — good first
  reviewable unit. Estimated ~150–190 lines (code + tests).
- **PR2 — session-start core + no-network guarantee** (REQ-2, REQ-5, REQ-6,
  REQ-7): `deriveChangeFromBranch`, the 5 step functions, `runSessionStart`
  orchestrator, `assertLocalArgv` gate, `renderContextBlock`, CLI entry, plus
  the import-graph and spy-spawn no-network tests. Depends on PR1's libs.
  Estimated ~350–420 lines (code + tests) — the largest, most novel slice.
- **PR3 — i18n + universal entry + adapter wiring** (REQ-1, REQ-8): `session.*`
  keys in `en.mjs`/`es.mjs`, `package.json` `session:start` script, merged
  `SessionStart` hook in `.claude/settings.json`. Depends on PR2. Estimated
  ~120–160 lines.

Each PR is independently green (its own passing test run) and stays under or
close to the 400-line budget. PR2 is the riskiest size-wise; if it still runs
high, it can be further split at the "step functions" vs "no-network
enforcement tests" boundary — flag this to the user before applying if PR2
alone approaches 400 lines once written.

---

## Slice 1 — Shared libs + consumer refactors (REQ-3, REQ-9)

- [x] 1.1 [RED] Write failing tests for `lib/git-branch.mjs` `currentBranch(cwd, {_spawn})`:
      named branch → name; detached HEAD (`"HEAD"` sentinel) → `null`;
      non-zero git status → `null`; spy throws (git absent) → `null`. Never throws.
- [x] 1.2 [GREEN] Implement `brain/scripts/lib/git-branch.mjs` (`currentBranch`) per design §1.2 to pass 1.1.
- [x] 1.3 [RED] Write failing tests for `lib/memory-manifest.mjs` `restoreManifestChurn(cwd, {_spawn})`:
      churn present → `restore` called, `{restored:true}`; clean → no restore call,
      `{restored:false}`; spy throws → `{restored:false}`. Never throws.
- [x] 1.4 [GREEN] Implement `brain/scripts/lib/memory-manifest.mjs` (`restoreManifestChurn`) per design §1.3 to pass 1.3.
- [x] 1.5 [RED] Write/extend a `memory/backends/engram.mjs` test asserting `_getGitBranch`
      still returns `'unknown'` on failure and the real branch name on success
      (de-dup proof — same observable contract, now backed by `currentBranch`).
- [x] 1.6 [GREEN] Refactor `_getGitBranch` (`brain/scripts/memory/backends/engram.mjs:296-306`)
      to a thin wrapper: `currentBranch(root) ?? 'unknown'`, importing from `lib/git-branch.mjs`.
- [x] 1.7 [GREEN] Refactor `day-start.mjs:150` (`capture('git', ['branch','--show-current'])`)
      to use `currentBranch(ROOT)`; confirm the existing `currentBranch === 'main'`
      check still behaves correctly when `currentBranch` is `null` (treated as
      "not main" → safe degradation per design note in §1.2).
- [x] 1.8 [GREEN] Refactor `day-start.mjs:117-129` (inline manifest-restore block) to
      call `restoreManifestChurn(ROOT)` from `lib/memory-manifest.mjs`; keep the
      `info(...)` log on `{restored: true}`.
- [x] 1.9 Run full existing `day:start` test suite (non-regression, REQ-9): confirm
      all prior tests pass unchanged after 1.6–1.8. Add/adjust day-start tests only
      if they directly asserted the old inline implementation details (assert
      behavior, not mechanism).

## Slice 2 — session-start core + no-network guarantee (REQ-2, REQ-5, REQ-6, REQ-7)

- [ ] 2.1 [RED] Write failing tests for `deriveChangeFromBranch(branchName, changesDir, {_readdir})`:
      token + 1 matching dir → 1 match; token + 2 matching dirs → 2 matches,
      sorted; no `issue-<N>` token → `{token:null, matches:[]}`; `null` branch →
      `{token:null, matches:[]}`; missing `changesDir` → `[]`; `archive` dir
      excluded even if it matches; never throws (fuzz a couple of odd inputs).
- [ ] 2.2 [GREEN] Implement `deriveChangeFromBranch` in `brain/scripts/session-start.mjs`
      per design §1.4 to pass 2.1.
- [ ] 2.3 [RED] Write failing tests for `assertLocalArgv(cmd, args)`: allowlisted
      argvs (`git status|restore|rev-parse`, `node .../memory/cli.mjs import`,
      `node .../memory/cli.mjs feature-resume`) pass through; non-allowlisted
      argvs (`git fetch`, `git pull`, `git merge`, `git clone`, `git ls-remote`,
      `git push`, `memory/cli.mjs pull`, `engram sync --export`) throw synchronously.
- [ ] 2.4 [GREEN] Implement `assertLocalArgv` gate in `session-start.mjs` per design §1.5(b).
- [ ] 2.5 [RED] Write failing tests for `renderContextBlock(model)` (pure/sync):
      exact-string snapshots for resolved change, no change, ambiguous N (2+),
      engram-skipped, no-ticket, and full-success cases; determinism (same
      input → same output, no clock/random).
- [ ] 2.6 [GREEN] Implement `renderContextBlock` in `session-start.mjs` per design §1.7
      to pass 2.5 (consumes pre-resolved i18n strings, stays sync).
- [ ] 2.7 [RED] Write failing tests for the 5 step functions (`step1RestoreManifest`,
      `step2HydrateEngram`, `step3ResolveChange`, `step4LoadTicketMemory`) with
      injected `deps` spies: each isolates failure into its return shape and
      never throws.
- [ ] 2.8 [GREEN] Implement the 4 step functions in `session-start.mjs` per design §1.1,
      wiring `step1` to `restoreManifestChurn`, `step2` to `assertLocalArgv`-gated
      `memory/cli.mjs import`, `step3` to `currentBranch` + `deriveChangeFromBranch`,
      `step4` to `tryFeatureResume`.
- [ ] 2.9 [RED] Write failing tests for `runSessionStart(cwd, deps)`: returns
      `{exitCode:0, output}` even when every step's spy fails; asserts step
      execution order (manifest → engram → branch/change → ticket → render);
      asserts output composition matches `renderContextBlock` for given step results.
- [ ] 2.10 [GREEN] Implement `runSessionStart` orchestrator in `session-start.mjs` per
      design §1.1 to pass 2.9. ALWAYS resolves `exitCode: 0`.
- [ ] 2.11 [RED] Write the import-graph allowlist test: statically inspect
      `session-start.mjs`'s import specifiers and assert they are a subset of
      `{node:* builtins, lib/git-branch.mjs, lib/memory-manifest.mjs,
      memory/lib/auto-resume.mjs, i18n/t.mjs}` — explicitly assert `day-start.mjs`,
      `vcs/*`, `lib/installer.mjs` are NOT imported.
- [ ] 2.12 [RED] Write the spy-spawn behavioral no-network test: inject a `_spawn` spy
      into `runSessionStart` over a fixture repo, run the full loop, and assert
      (a) every captured argv matches the allowlist, (b) NO argv contains
      `pull|fetch|merge|clone|ls-remote|push|--export`.
- [ ] 2.13 [GREEN] Fix any gaps surfaced by 2.11/2.12 (these tests should pass against
      the 2.2–2.10 implementation with no production changes if the design was
      followed correctly; treat any failure here as a structural bug to fix, not
      a test to weaken).
- [ ] 2.14 [RED] Write branch→change fixture integration tests: temp
      `openspec/changes/{issue-138-session-start, issue-99-other}` dirs;
      assert resolution from a `feature/138-...`-style branch and ambiguity
      detection from two `issue-138-*` dirs.
- [ ] 2.15 [GREEN] Confirm 2.14 passes against the existing implementation (no new
      production code expected; this is an integration-level regression net
      over 2.2 + 2.8).
- [ ] 2.16 [GREEN] Add the import-pure CLI entry point at the bottom of
      `session-start.mjs`: `if (process.argv[1] === fileURLToPath(import.meta.url))`
      guard, calls `runSessionStart(process.cwd())`, `console.log(output)`, never
      `process.exit(1)` (exits 0 implicitly).

## Slice 3 — i18n + universal entry + adapter wiring (REQ-1, REQ-8)

- [ ] 3.1 [GREEN] Add canonical `session.*` keys to `brain/scripts/i18n/en.mjs` per
      design §1.8: `session.header`, `session.branch`, `session.change.one`,
      `session.change.none`, `session.change.ambiguous`, `session.memory.ok`,
      `session.memory.skip`, `session.manifest.restored`, `session.ticket.label`,
      `session.ticket.none`.
- [ ] 3.2 [GREEN] Mirror the same `session.*` keys (translated) in `brain/scripts/i18n/es.mjs`.
- [ ] 3.3 Run the existing i18n key-coverage test suite; confirm it passes with
      every `en.mjs` `session.*` key present (and translated) in `es.mjs`, and
      that no `session:start` user-facing string is hardcoded outside the i18n
      layer (REQ-8). Add a targeted coverage assertion if the existing suite
      doesn't already enumerate by prefix.
- [ ] 3.4 [GREEN] Update the CLI entry in `session-start.mjs` to resolve all
      `session.*` strings ONCE via `t()` before calling `renderContextBlock`,
      per design §1.8 (renderer stays sync).
- [ ] 3.5 [GREEN] Add `"session:start": "node ./brain/scripts/session-start.mjs"` to
      `package.json` `scripts` (REQ-1 — universal invocation, agent-agnostic).
- [ ] 3.6 [GREEN] Smoke-run `npm run session:start` from a clean checkout; confirm
      exit code 0 and a printed context block (manual verification step, not a
      unit test — covers the REQ-1 "any shell context" scenario at a basic level).
- [ ] 3.7 [GREEN] Merge a `SessionStart` hook into `/home/gandalf/IA/brain/.claude/settings.json`
      beside the existing `PreToolUse` array per design §1.6 — command is exactly
      `"npm run session:start"`, zero logic in the JSON. Do NOT remove or alter
      the existing `PreToolUse` `--no-verify` blocker.
- [ ] 3.8 Verify `.claude/settings.json` is still valid JSON and both hook keys
      (`PreToolUse`, `SessionStart`) are present and independently structured.

---

## Micro-decisions

- `currentBranch` standardizes on `rev-parse --abbrev-ref HEAD` (not
  `--show-current`); `"HEAD"`/empty/throw all normalize to `null`. Both
  `day-start.mjs` and `engram.mjs` callers adapt to the `null` contract instead
  of inventing a second branch-detection primitive.
- `deriveChangeFromBranch` lives inside `session-start.mjs` (not split into its
  own `lib/` file) per design §1.4 — revisit only if a second consumer appears.
- `runSessionStart` never calls `process.exit`; the CLI entry relies on the
  natural Node exit code 0 after `console.log`. Any future non-zero-exit need
  must NOT be added to this script (would violate REQ-1/REQ-7's "always
  succeeds" contract) — push such logic to a separate diagnostic verb instead.
- No new test-runner config needed: `node --test "brain/scripts/**/*.test.mjs"`
  already globs all new colocated `*.test.mjs` files automatically.
- PR2 is flagged as the size-risk slice in the forecast above; if its actual
  diff approaches 400 lines during apply, re-split before opening the PR
  (e.g. separate "step functions + orchestrator" from "no-network enforcement
  tests") rather than shipping over budget.
