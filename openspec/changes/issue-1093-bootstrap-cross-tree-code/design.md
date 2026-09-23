---
status: draft
issue: 1093
---

# Design

## Two resolutions, not one

Before this change, `bootstrap.sh` computed exactly one root (`REPO_ROOT`, the main worktree via
`git rev-parse --git-common-dir`) and `cd`'d into it for the rest of the script — conflating
"where does `.env`/git config live" with "which code runs". This change adds a second, distinct
root computed FIRST, before the `cd`:

```sh
WORKTREE_ROOT="$(pwd)"
BRAIN_SCRIPTS="$WORKTREE_ROOT/brain/scripts"
```

`pwd` at this point is exactly the tree `npm run brain:env:init` was invoked from — npm always
runs a script with the invoking tree as `cwd`. `REPO_ROOT`'s computation, the `cd`, and every
`.env`/`brain.config.json`/git-config read or write are otherwise untouched (REQ-1093-8).

## Every code-resolution site, explicitly

| Call | Before | After |
|---|---|---|
| `brain-config.mjs ensure` | `node brain/scripts/lib/brain-config.mjs` | `node "$BRAIN_SCRIPTS/lib/brain-config.mjs"` |
| `home-scaffold.mjs ensure` | `node brain/scripts/lib/home-scaffold.mjs` | `node "$BRAIN_SCRIPTS/lib/home-scaffold.mjs"` |
| i18n catalog | `node brain/scripts/i18n/sh.mjs` | `node "$BRAIN_SCRIPTS/i18n/sh.mjs"` |
| PM detection | `node brain/scripts/lib/pm.mjs name` (cwd=REPO_ROOT) | `(cd "$WORKTREE_ROOT" && node "$BRAIN_SCRIPTS/lib/pm.mjs" name)` |
| Codex readiness | `node brain/scripts/harness/codex-readiness.mjs` | `node "$BRAIN_SCRIPTS/harness/codex-readiness.mjs"` |
| VCS PAT URL / auth-check / auth-login | `node brain/scripts/vcs/cli.mjs ...` | `node "$BRAIN_SCRIPTS/vcs/cli.mjs" ...` |
| Harness init | `node brain/scripts/harness/cli.mjs init` | `node "$BRAIN_SCRIPTS/harness/cli.mjs" init` |
| Memory setup | `node brain/scripts/memory/cli.mjs setup` | `node "$BRAIN_SCRIPTS/memory/cli.mjs" setup` |
| Memory pull/index | `$PM run --silent brain:memory:pull` (cwd=REPO_ROOT) | `(cd "$WORKTREE_ROOT" && $PM run --silent brain:memory:pull)` |
| Tracker board | `node brain/scripts/tracker-board.mjs` | `node "$BRAIN_SCRIPTS/tracker-board.mjs"` |

Two different mechanisms, matching two different resolution styles npm/node use:

- A direct `node <path>` call resolves the SCRIPT by the literal path given — pointing that path
  at `$BRAIN_SCRIPTS` is sufficient; `cwd` stays `$REPO_ROOT`, so any `process.cwd()`-relative
  data read inside that script (e.g. `brain.config.json`, `.env` read by the mapfile heredoc
  earlier in this file) is unaffected.
- `$PM run <script>` resolves the SCRIPT BODY from `cwd`'s `package.json` — there is no path to
  redirect, so the fix is a `(cd "$WORKTREE_ROOT" && ...)` subshell around the call, which
  restores `cwd=$REPO_ROOT` for every line after it.

`pm.mjs` itself gained no new CLI surface (still just `node pm.mjs name`, reading
`process.cwd()`); the subshell wrapper gives it the right `cwd` instead.

## The `import.meta.url` `.env` mismatch, and why it's an export, not a code change

`brain/scripts/harness/cli.mjs` and `brain/scripts/memory/cli.mjs` each compute their own
`repoRoot` as `dirname(fileURLToPath(import.meta.url))/../../..` — the tree containing the
RUNNING script file, not `process.cwd()`. Both then read `.env` from `join(repoRoot, '.env')`.

Once these two scripts run via `$BRAIN_SCRIPTS` (harness) or a worktree-`cwd` subshell (memory),
their own `repoRoot` becomes `$WORKTREE_ROOT` — a tree where `.env` does not exist (#657's
invariant: `.env` lives in the main tree alone). Both modules already resolve their governing
variables as `process.env.X ?? envVars.X ?? config.X` (shell environment wins over the parsed
`.env` file) — `resolveEngine`/`resolvePlatform` in `harness/cli.mjs`/`platform.mjs`, and the
equivalent precedence comment in `memory/cli.mjs`. Exporting `AGENT_PLATFORM`, `SDD_ENGINE`, and
`MEMORY_BACKEND` in `bootstrap.sh` right after each is resolved from the main tree's `.env` (and
before the corresponding call) closes the gap using a seam these modules already have, with zero
changes to either module. `VCS_HOST` and `VCS_TOKEN` were already exported earlier in the file;
this extends the same pattern to the two variables that were previously data-file-only.

This was identified, not assumed: `harness/platform.mjs` and `harness/cli.mjs`'s own precedence
comments were read directly (`env.SDD_ENGINE ?? envVars.SDD_ENGINE ?? config.engine`,
`env.AGENT_PLATFORM ?? envVars.AGENT_PLATFORM ?? config.platform`) to confirm shell-env-wins
before relying on it.

## The hard guard: what it covers, and what it deliberately does not

```sh
if [ ! -d "$BRAIN_SCRIPTS" ]; then
  printf '  ✗ brain/scripts/ not found at %s — ...\n' "$WORKTREE_ROOT" >&2
  exit 1
fi
```

Placed immediately after `WORKTREE_ROOT`/`BRAIN_SCRIPTS`, before `REPO_ROOT` is even computed.
This is the ONE failure mode no per-step warning can meaningfully degrade past: without
`brain/scripts/` at all, every subsequent call would independently MODULE_NOT_FOUND, each
individually swallowed by its own (correct, existing) non-blocking design, adding up to exactly
the reported shape — a run that limps to `== Environment ready ==` having done nothing real. This
mirrors the existing hard-exit style already used for `git`/`python3`/package-manager absence in
§1, rather than inventing a new failure idiom.

What it deliberately does NOT do: it does not second-guess any of the EXISTING non-blocking
design for ecosystem tools, VCS auth, harness init, memory sync, or the tracker board — all of
those remain exactly as tested by `test/bootstrap-smoke/smoke.mjs`'s documented design intent
("all three verbs exit 0 offline, degrading with warnings"). Only the two previously-*silent*
(`|| true`) swallows gain visibility (REQ-1093-6), and only the one previously-*unrepresentable*
failure (no `brain/scripts/` at all) becomes hard (REQ-1093-4).

## Why `core.hooksPath` is untouched

`git config core.hooksPath brain/scripts/hooks` sets a RELATIVE path. Git resolves a relative
`core.hooksPath` against each worktree's own top level at hook-invocation time — the value is
shared (`git config --local` is one file for every worktree), but the RESOLUTION is per-worktree.
A hook firing from a worktree therefore already runs that worktree's own `brain/scripts/hooks/*`.
Nothing in the issue's repro or symptom points at hooks; changing this line without evidence
would be scope creep into an area with a different (already correct) resolution mechanism.

## Test approach

Same idiom as `bootstrap.worktree.test.mjs` (#657): expressions are LIFTED VERBATIM out of
`bootstrap.sh`'s source text and executed in isolated fixture trees (a real `git worktree add`),
never re-typed as a second copy that could drift from the file. New file:
`brain/scripts/bootstrap.cross-tree-code.test.mjs`, covering REQ-1093-1, -2 (home-scaffold, the
sharpest single-module reproduction), -3 (memory pull), -4, and -5. REQ-1093-6 is covered by a
second scenario in the same file (failing stub module, asserting the warning + tracking).
REQ-1093-7 and REQ-1093-8/9 are covered by static assertion (`rg`) and by the existing #657/#458
suites continuing to pass unmodified, respectively — a full interactive run of every branch
(VCS auth prompts, PAT entry) is out of proportion for a code-resolution fix and is already
exercised end-to-end by `test/bootstrap-smoke/smoke.mjs`.

## RED proof (this change)

Before the fix, all 6 new tests in `bootstrap.cross-tree-code.test.mjs` failed — 4 because
`WORKTREE_ROOT=`/`BRAIN_SCRIPTS=` do not exist yet in `bootstrap.sh` (the lifting helper itself
asserts the line is present), 2 for the same reason transitively (the guard and the
`(cd "$WORKTREE_ROOT" && ...)` invocation both depend on those assignments). Re-run after the fix:
all 6 pass; the pre-existing `bootstrap.worktree.test.mjs` (#657) suite passes unmodified (9/9).
