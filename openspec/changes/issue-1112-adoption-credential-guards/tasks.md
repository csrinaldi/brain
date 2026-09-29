# Tasks — issue #1112

## Review Workload Forecast
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No (item 4 stopped, not decided — see `proposal.md`)
- Estimated changed lines (gated: tests, openspec, `.memory` excluded from budget):
  `bootstrap.sh` ~60, `brain-to-engram.mjs` ~60 (rewrite), `engram.mjs` ~10,
  `i18n/en.mjs`+`i18n/es.mjs` ~12, `test-spawn-hygiene.test.mjs` allowlist ~8.
  Well under the `standard` tier's 400-line budget.

## Phase 1 — finding 3: `brain-to-engram.mjs` project resolution + exit code

- [x] 1.1 `brain-to-engram.test.mjs`: `resolveProject` falls back to
      `slug`'s last segment when `project.name` is empty; `run()` calls
      `engramSave` with the resolved project; a per-file failure is
      counted and reported, never swallowed; importing the module performs
      no indexing (main-module guard); an end-to-end run against this
      repo's own (already `project.name === ""`) config never sends an
      empty `--project`. RED (module did not export `run`/`resolveProject`).
- [x] 1.2 Export `deriveProject` from `axes/memory/adapters/engram.mjs`;
      rewrite `brain-to-engram.mjs` with `resolveProject`, `run()`, and a
      `process.argv[1] === fileURLToPath(import.meta.url)` main-module
      guard that exits non-zero when `failed > 0`. GREEN.
- [x] 1.3 `npm test` on `axes/memory/adapters/engram*.test.mjs` +
      `memory/cli.backend-fallback.test.mjs`: still green (export-only
      change to a shared function).

## Phase 2 — finding 5: `bootstrap.sh` plainfiles memory-backend case

- [x] 2.1 `bootstrap.memory-backend-case.test.mjs`: plainfiles is never
      reported as unknown; setup+pull run, index does not; engram is
      unchanged; a genuinely unknown backend still warns. RED (3/4).
- [x] 2.2 Add a `plainfiles)` case arm in `bootstrap.sh`'s §7; add
      `bootstrap.memory.plainfiles.{ok,failed,noIndex}` to `i18n/en.mjs`
      and `i18n/es.mjs`. GREEN.

## Phase 3 — finding 2: `vcs.provider` enum validation

- [x] 3.1 `bootstrap.vcs-provider-validate.test.mjs`: an invalid answer is
      rejected and never persisted; the rejection is reported; a valid
      first answer still works; an empty answer keeps the derived default;
      re-prompting continues until a valid answer arrives. RED (missing
      `BEGIN/END vcs-provider-validate` markers).
- [x] 3.2 Wrap the interactive override's `read` in a `while :; do … done`
      loop, restricted to `github|gitlab|''`, delimited by sentinel
      comments for the test's extraction. GREEN.

## Phase 4 — finding 1: `.env` gitignore guard

- [x] 4.1 `bootstrap.env-gitignore.test.mjs`: fresh repo gets a
      `.gitignore` with `.env`; a `.gitignore` missing a trailing newline
      is appended to correctly; idempotent; a broader existing pattern is
      respected, not duplicated; structural guard that the step runs
      before the PAT write. RED (missing `BEGIN/END ensure-env-gitignored`
      markers).
- [x] 4.2 Add `ensure_env_gitignored()` at the top of §3, before any
      `env_set` call; add `bootstrap.gitignore.{ok,failed}` to both
      catalogs. GREEN.

## Phase 5 — test hygiene + full verification

- [x] 5.1 `npm test` flagged 4 new spawns as uncovered by
      `test-spawn-hygiene.test.mjs`'s allowlist (REQ-SHIP-4, #1012).
      Added 4 line-pinned `no-vcs-capability` entries (none of the new
      tests import or call a VCS/gh port).
- [x] 5.2 `npm test`: 6499 tests, 0 failing, 3 skipped (baseline).
- [x] 5.3 `npm run brain:repo:check`: exit 0.
- [x] 5.4 `npm run brain:nav`: exit 0.
- [x] 5.5 End-to-end demonstration against a throwaway consumer
      (`npm pack` of this worktree → `npm i -D` → `brain-upgrade.mjs
      --no-install`): see the worktree report for the transcript.

## Not done — item 4 (stopped on a product-decision fork)

- [ ] 6.1 (STOPPED) Hook refusal of the adoption commit /
      `docs/adoption.md`'s missing first-commit step. See `proposal.md`
      "Stopped: item 4" for the three options and their tradeoffs. No
      code or doc change shipped in this change for this item.
