# Tasks — issue #1112

## Review Workload Forecast
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: item 4 was stopped and reported as a fork
  (see `proposal.md`); the maintainer ruled Option A on 2026-09-29 and
  phase 6 below implements it; a same-day cold review then found the
  first cut's exemption condition wrong (blocker 1, phase 7) and a
  fail-open credential path (blocker 2, phase 7).
- Estimated changed lines (gated: tests, openspec, `.memory` excluded from budget):
  `bootstrap.sh` ~110 (across all phases), `brain-to-engram.mjs` ~55,
  `engram.mjs` ~10, `i18n/en.mjs`+`i18n/es.mjs` ~16,
  `test-spawn-hygiene.test.mjs` allowlist ~14, `hooks/pre-commit` ~35
  (no-commit-at-all gate, corrected). Well under the `standard` tier's
  400-line budget.

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
      **Cold-review nit (7.4 below): `resolveProject` removed — it was a
      pure pass-through; `run()` now calls `deriveProject` directly.**
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

## Phase 6 — finding 4: unborn-HEAD exemption (maintainer ruling, Option A, 2026-09-29)

- [x] 6.1 `pre-commit.unborn-head.test.mjs`: a real `git init` fixture with
      `core.hooksPath` set to the real installed hooks (copying
      `brain/scripts`+`brain/core` in, like `bootstrap.tier-notice.test.mjs`'s
      `copyBrain`) — the first commit from the main checkout is accepted,
      even on `main`; detection is not by branch name (`trunk` too); the
      exemption is reported; a second commit from the main checkout is
      still refused by check 2; a direct commit to `main` on a born-HEAD
      repo is still refused by check 1, unchanged. RED (5/5 — the first
      commit itself failed without the fix).
- [x] 6.2 Add gate 0 to `brain/scripts/hooks/pre-commit`: `if ! git
      rev-parse --verify -q HEAD >/dev/null 2>&1` wraps checks 1 and 2,
      printing one line naming the reason on the unborn path. GREEN (5/5).
- [x] 6.3 Checked `pre-push`, `commit-msg`, `pre-receive` for the same
      class of refusal (branch-name / main-checkout / worktree check):
      none found (`rg` for the three tells across all four hook files
      matches only `pre-commit`). `pre-receive` is also not part of a
      fresh consumer's `env:init` path at all (installed separately, by a
      maintainer, into a bare repo). No fix needed beyond `pre-commit`.
      No GitLab counterpart exists or is needed: "which local checkout
      made this commit" is not observable server-side.
- [x] 6.4 `proposal.md`/`design.md`/`spec.md` updated: the ruling is
      recorded, the three original options are kept for the record with
      "taken"/"not taken" marked, the implementation and its tests are
      described (D5, D5.1, D5.2).
- [x] 6.5 `npm test` (full suite), `npm run brain:repo:check`, `npm run
      brain:nav`: all green/exit 0. Did not touch the real engram store
      or any real remote this run — the fixture in 6.1 has no `origin`
      remote at all.

## Phase 7 — cold review, 2026-09-29 (2 blockers, 1 should-fix, 1 nit)

- [x] 7.1 BLOCKER — corrected the gate-0 condition. Added an orphan-branch
      test to `pre-commit.unborn-head.test.mjs`: a repo WITH history,
      `git checkout --orphan`, commit attempted — must be REFUSED by
      check 2. RED against the `git rev-parse --verify -q HEAD` detector
      (the orphan commit landed: exit 0, `unborn` message printed) with
      the 5 pre-existing cases still green. Fixed: gate 0 now tests
      `[ -z "$(git rev-list -n 1 --all 2>/dev/null)" ]` (no commit
      reachable from ANY ref) instead of HEAD-only. GREEN (6/6). Updated
      the comment's "self-closing"/detection claims to match (D5.1).
      Also fixed the pre-existing MOCKED `pre-commit.test.mjs` suite,
      which broke as a side effect (the mock `git` answered every
      unmatched subcommand, including the new `rev-list`, with empty/exit
      0 — read by the corrected gate as "no commit anywhere", exempting
      every mocked scenario): added a `hasCommit` fixture flag (default
      `true`, matching what all 7 pre-existing tests already modeled) and
      one new mocked test for the `hasCommit: false` path. 55/55 hook
      tests green.
- [x] 7.2 BLOCKER — fail-closed credential write.
      `bootstrap.pat-secret-guard.test.mjs`: `.env` tracked → token not
      written, message names `git rm --cached`; ignore check failing for
      another reason → token not written; safe → written (regression).
      RED (missing `BEGIN/END env-secret-safe-gate` / `pat-write-gate`
      markers). Fixed: `ENV_SECRET_SAFE`/`ENV_SECRET_UNSAFE_REASON`
      computed once (`git ls-files --error-unmatch .env` for tracked,
      else `git check-ignore -q .env`), read by the one place `.env`
      gets a new token — `bootstrap.pat.trackedRefused`/`.gitignoreRefused`
      added to both i18n catalogs. GREEN (7/7). One of the test's fake PAT
      literals (`ghp_…`, in a `vcsToken:` JS object property) tripped
      `check-refs.mjs`'s `hardcoded-secret` rule (matches
      `token\s*[=:]\s*["']…{8,}["']` — not the PAT shape itself, the KEY
      NAME "token" next to a quoted literal); renamed the test's own
      parameter to `patValue` and the fake string to a non-PAT-shaped
      placeholder. `brain:repo:check` clean.
- [x] 7.3 SHOULD-FIX — `MEMORY_BACKEND` prompt validation.
      `bootstrap.memory-backend-validate.test.mjs`, reusing
      `vcs-provider-validate`'s exact loop shape. RED (missing markers).
      Fixed: `while :; do read … case … esac; done`, restricted to
      `engram|plainfiles|''`. Discovered and fixed a marker collision:
      the loop's own `case "$MEMORY_BACKEND" in` was textually identical
      to the real backend-dispatch `case` a few lines below, so
      `bootstrap.memory-backend-case.test.mjs`'s fragment extraction
      (exact-text match) grabbed the wrong block — 3 of its tests broke.
      Fixed by reading into a scratch variable (`_membackend_answer`)
      instead of `$MEMORY_BACKEND` directly, so the two `case` statements
      are textually distinct. GREEN (6/6 new + 4/4 restored).
- [x] 7.4 NIT — `brain-to-engram.mjs`'s `resolveProject(config, root)` was
      a one-line pass-through (`return deriveProject(config, root)`);
      removed, `run()` calls `deriveProject` (imported from
      `axes/memory/adapters/engram.mjs`) directly. Test file updated to
      import and exercise `deriveProject` directly. 6/6 green.
- [x] 7.5 `test-spawn-hygiene.test.mjs`: 6 new/shifted spawns flagged by
      REQ-SHIP-4 (one line-number shift in `brain-to-engram.test.mjs`
      from the new import; 3 new fragments in
      `bootstrap.memory-backend-validate.test.mjs`/
      `bootstrap.pat-secret-guard.test.mjs`). All `no-vcs-capability`.
- [x] 7.6 `proposal.md`/`spec.md`/`design.md` updated: the corrected
      no-commit-at-all condition (D5.1), the fail-closed credential gate
      (D6), the `MEMORY_BACKEND` validation reuse (D7), and the
      `resolveProject` removal (D3.1) are all recorded.
- [x] 7.7 Safety for this phase: no mutating git command
      (remote/config/stash/reset/checkout/worktree/fetch/push) run
      against `/home/gandalf/IA/*` or any `cp` copy of a worktree; every
      fixture is a fresh `git init` repo under the OS temp dir
      (`mkdtempSync`), never a copy of this worktree. No real engram
      store or real remote touched.
- [x] 7.8 `npm test` (full suite), `npm run brain:repo:check`, `npm run
      brain:nav`: all green/exit 0.

## Phase 8 — cold review round 3, 2026-09-29 (1 blocker, 1 should-fix, 1 nit)

`pre-commit` and its docs explicitly OUT OF SCOPE this round — a third
finding (the first-commit exemption's rationale) is back with the
maintainer.

- [x] 8.1 BLOCKER — symlinked `.env`. Extended
      `bootstrap.pat-secret-guard.test.mjs`: safe-gate symlink case
      (unsafe, reason=symlink, even with a covering `.gitignore`) and
      non-regular-file case (a directory in `.env`'s place); write-gate
      symlink case (token never written to the target, message names the
      target) and non-regular-file case. RED (4/4 new cases). Fixed:
      `[ -L .env ]` checked first (before `-f`, which follows symlinks),
      then `-e && ! -f` for any other non-regular file;
      `ENV_SYMLINK_TARGET` captured via `readlink`. Write-gate `case`
      extended with `symlink`/`notRegularFile` arms;
      `bootstrap.pat.symlinkRefused`/`.notRegularFileRefused` added to
      both i18n catalogs. GREEN (11/11). NIT also folded into this same
      edit: the gate's rationale comment now notes `.git/info/exclude`/
      global `core.excludesFile` count as ignored for THIS CLONE ONLY,
      and that the gate runs once, before the prompts.
- [x] 8.2 SHOULD-FIX (class C) — a refused write was a clean exit.
      `bootstrap.required-failure.test.mjs`: the write-gate records
      exactly one `REQUIRED_FAILURES` entry per refusal reason (4 cases),
      none for a safe write or a skipped/empty prompt (2 cases); the
      summary fragment exits non-zero and names the failure when
      non-empty, falls through untouched when empty (2 cases). RED
      (missing `BEGIN/END required-failure-summary` marker). Fixed:
      `REQUIRED_FAILURES=()` declared beside `MISSING_OPTIONAL` (a
      distinct list, on purpose — see design D9); write-gate appends to
      it on every refusal where `VCS_TOKEN` was non-empty; §9's
      `required-failure-summary` prints the list and `exit 1`s when
      non-empty. `bootstrap.done.requiredFailed` added to both catalogs.
      GREEN (8/8).
- [x] 8.3 End-to-end proof (should-fix 2's own ask): a real interactive
      run, not just fragments. Added `brain/scripts/__fixtures__/pty-drive.py`
      (python3 — already a required base dependency; Node has no built-in
      pty) and `bootstrap.pat-refusal-e2e.test.mjs`: seeds a consumer
      fixture with a TRACKED `.env`, drives the REAL `bootstrap.sh` under
      a real pty, answers its two PAT prompts (open-browser: no;
      paste-PAT: a fake token), asserts exit non-zero, the token nowhere
      on disk in the fixture, and the summary naming the refusal. HOME/
      ENGRAM_DATA_DIR redirected into the fixture's own temp tree;
      GH_CONFIG_DIR pointed at a nonexistent path, GH_TOKEN/GITHUB_TOKEN
      cleared. (The original "pty leaks the ambient gh login" residual
      was a misdiagnosis; see 9.1.)
- [x] 8.4 `test-spawn-hygiene.test.mjs`: one shifted spawn
      (`bootstrap.pat-secret-guard.test.mjs`, 113→156, from the new
      symlink tests) plus two new (`bootstrap.required-failure.test.mjs`,
      lines 66/102). All `no-vcs-capability`. The e2e test's own `python3`
      spawn is NOT a hit at all — `python3` isn't in the scanner's tracked
      runtime list (`process.execPath`/`node`/`npm`/`bash`/`sh`), so no
      allowlist entry was needed for it.
- [x] 8.5 `proposal.md`/`spec.md`/`design.md` updated: D8 (symlink/
      non-regular-file gate) and D9 (REQUIRED_FAILURES + e2e proof)
      recorded; new spec requirements and scenarios (including the two
      new symlink scenarios and the required-failure ones).
- [x] 8.6 Safety: no mutating git command
      (remote/config/stash/reset/checkout/worktree/fetch/push) or file
      write against `/home/gandalf/IA/*` outside this worktree's own
      commits; every fixture is a fresh `git init` under the OS temp dir.
      No real engram store touched (`ENGRAM_DATA_DIR` redirected; the
      fixture uses `MEMORY_BACKEND=plainfiles`, so no real `engram`
      binary is even invoked). No real remote — the fixture has no
      `origin`.
- [x] 8.7 `npm test` (full suite: 6532 tests, 6529 pass, 0 fail, 3
      skipped), `npm run brain:repo:check`, `npm run brain:nav`: all
      green/exit 0.

## 9. Final cold review fixes

- [x] 9.1 SHOULD-FIX — `bootstrap.pat-refusal-e2e.test.mjs` made
      hermetic: fake `gh`/`gentle-ai` first on PATH (argv logged),
      `DBUS_SESSION_BUS_ADDRESS=` empty, `XDG_RUNTIME_DIR=<tmp>`, python3
      kept for the pty. Header diagnosis corrected (gh exits 0 on an
      invalid `GH_TOKEN`; the leak was `gentle-ai doctor` -> `gh auth
      token` -> keyring). Asserts shims resolve first and never received
      `auth token`. All other `bootstrap.*.test.mjs` checked: fragment-only,
      none can reach gh/gentle-ai.
- [x] 9.2 SHOULD-FIX — false "cannot return to zero commits / false
      FOREVER" claim reworded (hook comment, design D5.1, proposal,
      unborn-head test header, spec) to "applies while no ref reaches any
      commit"; new test deletes every ref and proves the exemption fires.
- [x] 9.3 NIT — hardlinked `.env` refused (`hardlinked`, red then green;
      `stat -c %h` / `stat -f %l`), en/es message.
- [x] 9.4 NIT — chose to keep writing non-secret settings and say so in
      every refusal (design D8.2); `bootstrap.pat.settingsNote` en/es.
