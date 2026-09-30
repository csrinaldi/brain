---
status: draft
issue: 1141
---

# Tasks — one directory per axis (issue #1141)

Strict TDD. The move is a refactor, so its discipline is: the suite is green before, the same
suite is green after, and a new guard proves the old locations are gone. The guard failed
before the move and passes after.

## Review Workload Forecast

- Tier `lite`, budget 1000 changed lines, `governance.ignoreList` excluded.
- Renames count only their edited lines. Measured gated size: see 4.3.
- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Low

## 1. Baseline

- [x] 1.1 `npm test` on `fcd94acd`: exit 0, 6462 tests, 6459 pass, 0 fail, 3 skipped.
- [x] 1.2 `npm run brain:repo:check` on `fcd94acd`: exit 0.
- [x] 1.3 `node brain/scripts/check-brain-nav.mjs` on `fcd94acd`: exit 0.

## 2. The move (commit `0f6a5ddd`)

- [x] 2.1 RED: `brain/scripts/axes/layout.test.mjs` written first. It ran 8 tests, 0 pass and
      8 fail: the three old directories existed, and no `axes/<axis>/adapters/` existed.
- [x] 2.2 Map every file to its axis from its exports and importers (design.md).
- [x] 2.3 `git mv` the 53 files. Add the two re-exports: `platform/adapters/plain.mjs` and
      `review-engine/adapters/claude.mjs`.
- [x] 2.4 Rewrite every reference: relative imports, `new URL(…, import.meta.url)`, the
      repo-root depth in the five adapters that compute it, repo-relative path strings, the
      template loaders (`harness/cli.mjs`, `agent-runtime.mjs`, `role-port.mjs`,
      `memory/cli.mjs`, `vcs/cli.mjs`, the five `vcs/providers/${provider}` importers),
      comments, `brain/project/check-refs-rules.mjs` and `openspec/specs/**`.
- [x] 2.5 `axes/lib/harness-adapter-url.mjs` keeps the three name-based loaders resolving
      every name to the same module (REQ-1141-5).
- [x] 2.6 Every moved file keeps its history: a loop over the 53 new paths ran
      `git log --follow` and printed `checked 53 short 0`.
- [x] 2.7 The guards follow the move instead of going vacuous (REQ-1141-6). Mutation check:
      appending `import { init } from '../axes/sdd-engine/adapters/plain.mjs';` to
      `vcs/actor-check.mjs` made the new `engine-blind-gates.test.mjs` fail (1 of 7). The
      pre-change version of the same test stayed green (7 of 7). The file was restored.
- [x] 2.8 GREEN: `axes/layout.test.mjs` 8/8. Full suite: 6470 tests, 6464 pass, 3 fail. The
      3 failures are the doctrine citations in 4.1, not code.

## 3. The upgrade removes what a release stops shipping (commit `8a476557`)

- [x] 3.1 Confirmed the defect by reading the code: `copyManaged` lists only
      `listFiles(srcRoot)`. `brain-upgrade.mjs` removes nothing, and `readOutgoing` snapshots
      only the literal rows, not `brain/scripts/**`.
- [x] 3.2 RED: `lib/installer.retired.test.mjs` (7 tests) and one CLI test in
      `brain-upgrade.test.mjs`. Seven failed. "A consumer-owned file in the same directory is
      NOT removed" passed vacuously, because nothing was removed at all.
- [x] 3.3 GREEN: `lib/retired-paths.mjs` (53 paths), `copyManaged({ retired })` with
      `removed` in its result, and `brain-upgrade.mjs` reading the list from the incoming
      package. `installer.retired`, `brain-upgrade` and `installer` tests: 119 pass, 0 fail.
- [x] 3.4 Full suite: 6478 tests, 6472 pass, 3 fail (the same three as 2.8).
- [x] 3.5 ADR-0036 proof on a fresh consumer, in a scratch directory:
      1. `git init`, `npm init -y`, `npm install @logikas/brain@1.7.0` (the published package).
      2. `node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs 1.7.0 --no-install`
         exited 0 and copied 752 files. The old directories held 19, 26 and 4 files
         (`harness/backends`, `memory/backends`, `vcs/providers`).
      3. Added a consumer file, `brain/scripts/harness/backends/my-own-backend.mjs`, and
         committed.
      4. `npm pack` of this branch, then `npm install <tgz>` in the consumer.
      5. `node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs 1.7.0 --no-install`
         exited 0: "Copied 762", "Removed 53 file(s) brain no longer ships".
      6. Afterwards `memory/backends/`, `vcs/providers/` and `roles/fixtures/` no longer
         exist, and `harness/backends/` holds only `my-own-backend.mjs`.
      7. `npm run brain:env:init` exited 0. The harness step read "gentle-ai (claude)",
         `.claude/settings.json` and `AGENTS.md` were rewritten, and the engram backend was
         configured. Every adapter and the role port import cleanly in the consumer, and
         `MEMORY_BACKEND=plainfiles node brain/scripts/memory/cli.mjs search zzz` exited 0.

## 4. Doctrine and closure

- [x] 4.1 Seven promote drafts in `brain-drafts/`, each validated with `planAmendment`.
      Applying all of them to a scratch copy of `brain/` made `brain:nav` exit 0.
      A second transient check applied only the six nav-breaking fixes: `brain:nav` exited 0
      and the three red tests passed (27/27). Both edits were reverted with `git checkout`.
- [x] 4.2 ADR citations that `brain:nav` does not check are listed in `brain-drafts/README.md`
      for a ruling.
- [ ] 4.3 The maintainer promotes the seven drafts on this branch. After that, `npm test` and
      `brain:nav` are fully green.

## Remaining old-path mentions in brain/scripts (intentional)

- `lib/retired-paths.mjs`: the retirement list itself.
- `axes/layout.test.mjs`, `axes/lib/harness-adapter-url.mjs`, and three test comments
  ("the old `backends/` directory, split by axis in #1141"): these name what was retired.
- Fixture strings that are not paths to real files, whose assertions were not edited:
  `vcs/engine-blind-gates.test.mjs:142` (a synthetic `harness/backends/plain.mjs` import),
  `harness/cli.test.mjs:187` and `axes/lib/agent-runtime.test.mjs:240` (fake loader error
  text), and `memory/chunk-boundary.test.mjs:194` (a row that must not exist).
