# Tasks: engram.pull.test.mjs and the missing-root guard (#1026)

## Unit 1 — Measure first

- [x] 1.1 Confirm `.memory/index.jsonl` clean before running
      `engram.pull.test.mjs` alone; run it; confirm mtime changes after
      (content stays byte-identical — checked via `sha256sum`/`stat -c
      '%Y'` per isolated `--test-name-pattern` run, not just `git status`).
      Restore via `git checkout --`.
- [x] 1.2 Identify exactly which tests reach the real root by reading each
      test body (not the file's own header comment, which was unverified):
      (a) "pull → import in order" (line 45) — reaches it. (c) "failing
      git pull propagates error and skips import" (line 64) — does NOT
      (`_gitPull` throws before the `_rebuildIndex` step runs). (e)
      "default _import seam is importMemory" (line 147) — reaches it.
      (f)/(g) already inject `root`/`_rebuildIndex`. (d) never calls
      `pullMemory`/`importMemory`.

## Unit 2 — R1026-1: engram.pull.test.mjs never reaches the real root

- [x] 2.1 RED: add the `before`/`after` content+mtime snapshot guard around
      the whole file (without yet fixing (a)/(c)/(e)) — run the suite,
      confirm the `after` hook fails on the mtime assertion (content
      assertion stays silently green — this is the R1026-1 evidence that
      content alone is insufficient).
- [x] 2.2 GREEN: inject `root: '/fake/root'` + a no-op `_rebuildIndex` into
      (a), (c), (e) — suite passes, `.memory/index.jsonl` stays clean.
- [x] 2.3 Mutation: revert (a)'s injection — the `after` hook's mtime
      assertion fails again (content assertion stays silently green,
      confirming mtime is the load-bearing check); restore (a), back to
      green.

## Unit 3 — R1026-2: the hygiene guard covers root-defaulting exports

- [x] 3.1 Read `engram.mjs` fully; confirm by source (not the issue's
      candidate list alone) which exports default `root` to `repoRoot`:
      `ensureMemorySymlink`, `share`, `importMemory`, `pullMemory`,
      `setup`, `hydrate`, `save`, `featureCheckpoint`, `featureResume` (9
      total — more than the issue's candidate list of 5). Confirm
      `rebuildIndex` (store.mjs) is NOT one of them.
- [x] 3.2 RED: add the fixture tests (planted source under `testTmp()`)
      that call the not-yet-built `findMissingRootViolations` — run, confirm
      they fail with "not implemented yet" (function stubbed to throw).
- [x] 3.3 GREEN: implement `stripComments`, `blankStrings`,
      `engramRootFnAliases`, `findMissingRootViolations` — all 4 detection
      fixture tests pass (object-key violation, positional violation,
      aliased-import violation + aliased-import compliance, comment-mention
      non-violation).
- [x] 3.4 Run the real-codebase test; triage every finding: fix false
      positives from string-literal prose (add `blankStrings`, plus its own
      fixture test) rather than allowlisting them; allowlist the 10
      genuinely-safe indirect call sites (7 in `engram.import.test.mjs` —
      `_readRecords` always mocked; 3 in `save-parity.test.mjs` —
      `pinnedSeams(root)` helper) with per-entry reasoning. Real-codebase
      test passes, 10/10 tests in the file green.
- [x] 3.5 Mutation: drop `root` from a real, currently-compliant call site
      (`engram.pull.test.mjs`'s first test, post-Unit-2-fix) — the
      real-codebase guard test fails; revert, confirm green again and the
      file diffs clean against the Unit 2 commit.

## Finish

- [x] 4.1 Full suite: `GIT_CONFIG_GLOBAL=/dev/null npm test`.
- [x] 4.2 `git status --short .memory/index.jsonl` empty after the full run.
- [x] 4.3 `npm run brain:repo:check` passes before each commit and once
      more at the end.
- [x] 4.4 Record-first memory commit (title/content, `--issue 1026 --type
      bugfix`), staging only the generated record file +
      `.memory/index.jsonl`.
