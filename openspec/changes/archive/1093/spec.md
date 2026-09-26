---
status: draft
issue: 1093
---

# Spec

## REQ-1093-1 — code resolution is captured before the data-tree `cd`

`bootstrap.sh` MUST assign `WORKTREE_ROOT` (the invoking tree, read via `pwd` before the
`REPO_ROOT` `cd`) and `BRAIN_SCRIPTS="$WORKTREE_ROOT/brain/scripts"`, both before the `REPO_ROOT`
assignment.
**Falsifiable by**: from a linked worktree, sourcing bootstrap.sh's own `WORKTREE_ROOT=`/
`BRAIN_SCRIPTS=` lines yields the MAIN tree's path instead of the worktree's, or either
assignment is missing/reordered after `cd "$REPO_ROOT"`.

## REQ-1093-2 — every direct script invocation uses the invoking tree's code

Every `node brain/scripts/...` invocation in `bootstrap.sh` MUST resolve the script path through
`$BRAIN_SCRIPTS`, not a bare `brain/scripts/...` relative path.
**Falsifiable by**: `rg 'node brain/scripts/' brain/scripts/bootstrap.sh` matches any line outside
a comment; or, from a worktree whose main tree lacks a given module and whose own copy exists and
is observable (e.g. writes a marker file), invoking that call resolves to the main tree's
(missing/differently-behaving) copy instead of the worktree's.

## REQ-1093-3 — `$PM run brain:memory:*` executes in the invoking tree

The `brain:memory:pull` and `brain:memory:index` invocations MUST run with `cwd` set to
`$WORKTREE_ROOT` (not inherited from `$REPO_ROOT`), so the package manager resolves the
INVOKING tree's `package.json` script body.
**Falsifiable by**: seeding the main tree and the worktree with `package.json` files whose
`brain:memory:pull` script bodies write distinguishable markers; running the guarded invocation
from the worktree produces the MAIN tree's marker (or no marker), instead of the worktree's.

## REQ-1093-4 — a missing invoking-tree checkout refuses to continue

If `$BRAIN_SCRIPTS` does not exist as a directory, `bootstrap.sh` MUST print an error to stderr
and `exit` non-zero before running anything else, rather than proceeding into a cascade of
per-step warnings.
**Falsifiable by**: running bootstrap.sh's `WORKTREE_ROOT`/`BRAIN_SCRIPTS`-assignment-plus-guard
snippet from a tree with no `brain/scripts/` directory exits 0, or executes any line placed after
the guard.

## REQ-1093-5 — the guard does not fire on a complete checkout

The `$BRAIN_SCRIPTS`-existence guard MUST NOT block or exit when `$WORKTREE_ROOT/brain/scripts`
exists.
**Falsifiable by**: running the same snippet from a tree where `brain/scripts/` exists (even
empty) exits non-zero or fails to reach a line placed after the guard.

## REQ-1093-6 — the two silent `|| true` swallows become visible and tracked

The `brain-config.mjs ensure` and `home-scaffold.mjs ensure` steps MUST print a warning to stderr
and append a descriptive entry to `MISSING_OPTIONAL` on failure, instead of a bare `|| true`.
Neither becomes blocking — the overall script MUST still be able to reach `== Environment ready
==` when only these two fail, consistent with every other already-non-fatal step in this file.
**Falsifiable by**: running either step's guarded line with a failing stub module produces no
`⚠` output on stderr, or leaves `MISSING_OPTIONAL` with the same length it had before the call.

## REQ-1093-7 — `.env`-dependent invocations still resolve `AGENT_PLATFORM` /
`SDD_ENGINE` / `MEMORY_BACKEND` correctly from a worktree

`bootstrap.sh` MUST `export AGENT_PLATFORM`, `SDD_ENGINE`, and `MEMORY_BACKEND` (after each is
resolved from the main tree's `.env`) before invoking `harness/cli.mjs init` and
`memory/cli.mjs setup` / the `brain:memory:*` verbs, so those modules' own independent
(`import.meta.url`-based) `.env` resolution cannot silently diverge from what bootstrap.sh just
wrote to the main tree's `.env`.
**Falsifiable by**: `rg 'export (AGENT_PLATFORM|SDD_ENGINE|MEMORY_BACKEND)' brain/scripts/bootstrap.sh`
finds no match, or a match that appears AFTER the corresponding `node "$BRAIN_SCRIPTS/...` call it
is meant to precede.

## REQ-1093-8 — the `.env`/git-config main-tree behavior is unchanged

`REPO_ROOT` resolution (`git rev-parse --path-format=absolute --git-common-dir`), the `cd
"$REPO_ROOT"`, and every `.env`/`brain.config.json`/git-config read or write MUST continue to
target the main tree exactly as before this change (issue #657's invariant).
**Falsifiable by**: `bootstrap.worktree.test.mjs`'s existing #657 tests (`REPO_ROOT` resolution,
credential helper token emission, missing-token failure) regress.

## REQ-1093-9 — existing behavior is unchanged for a non-worktree checkout

When `bootstrap.sh` runs from a plain checkout (not a linked worktree), `WORKTREE_ROOT` and
`REPO_ROOT` coincide, and every code-resolution change in this spec is a no-op relative to
pre-fix behavior.
**Falsifiable by**: `test/bootstrap-smoke/smoke.mjs` (a flat, non-worktree fixture) regresses
after this change.
