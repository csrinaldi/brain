---
status: draft
issue: 1093
---

# Proposal — `bootstrap.sh` runs the MAIN worktree's scripts, not the caller's

## What was wrong

`brain:env:init` (`brain/scripts/bootstrap.sh`) resolves the MAIN checkout with
`git rev-parse --path-format=absolute --git-common-dir` and `cd`s there (issue #657), because
`.env` is gitignored and exists only in the main checkout. It then ran **everything** from that
directory — every `node brain/scripts/...` call and every `$PM run brain:*` verb — which all
resolve relative to `cwd`. When the calling worktree holds a newer brain than the main checkout
(every adoption, or an upgrade run on a branch), the bootstrap silently executed the OLD code
against the OLD tree while claiming success.

A real reproduction in `csrinaldi/synergy` (adopting brain 1.6.0 into a worktree whose main
checkout still carried a June-2026 copy of brain 0.7.0):

```
Error: Cannot find module '/home/gandalf/IA/synergy/brain/scripts/lib/home-scaffold.mjs'
Error: Cannot find module '/home/gandalf/IA/synergy/brain/scripts/harness/codex-readiness.mjs'
…
✓ merge driver engram-manifest registered
⚠ memory:pull failed (non-blocking)
⚠ memory:index failed (non-blocking)
== Environment ready ==
```

Both missing modules are 0.7.0's absence, not the worktree's. The merge driver line is the
sharpest evidence: `engram-manifest` was retired in 1.6.0 (#958), so the fact that it got
registered proves 0.7.0's `memory/cli.mjs setup` ran, not 1.6.0's. `env:init` still wrote
`brain.config.json`, `.env`, and git config into the main tree — that part is #657's correct,
unchanged behavior — but the CODE that ran to do it, and the CODE for every other step, was the
wrong tree's.

## Why this went undetected

`test/bootstrap-smoke/smoke.mjs` (#458) proves `brain:env:init` reaches its end and leaves a
complete tree — but its fixture is a single, flat consumer checkout with no worktree at all, so
"which tree's `brain/scripts/**` actually ran" was never a variable the suite could exercise.
`bootstrap.worktree.test.mjs` (#657) proves `REPO_ROOT`/the credential helper resolve to the main
tree from a worktree — the correct claim for *data* — but says nothing about which tree's *code*
executes, because at #657's time every worktree and the main tree held byte-identical
`brain/scripts/**`. Cross-tree version drift is exactly the adoption/upgrade-on-a-branch case,
which neither suite modeled.

## The fix

Separate the two questions `cd "$REPO_ROOT"` conflated:

- **Where `.env` and git config belong**: the main tree. #657's reasoning is correct and
  unchanged.
- **Which code runs**: the tree that invoked `bootstrap.sh` — captured as `WORKTREE_ROOT`
  (`pwd`, read before the `REPO_ROOT` `cd`) and `BRAIN_SCRIPTS="$WORKTREE_ROOT/brain/scripts"`.
  Every direct `node brain/scripts/...` call is repointed at `$BRAIN_SCRIPTS`; the two
  `$PM run brain:memory:*` verbs — which resolve their script body from `cwd`'s `package.json`,
  not from an explicit path — run inside a `(cd "$WORKTREE_ROOT" && …)` subshell instead of
  inheriting `cwd=$REPO_ROOT`.

Two secondary findings, both addressed in the same change:

1. **Claim vs. evidence.** Two steps (`brain-config.mjs ensure`, `home-scaffold.mjs ensure`)
   used a bare `|| true` — no warning, no entry in the `MISSING_OPTIONAL` summary printed at the
   end. Every OTHER degradable step in this file already warns and is tracked. These two now do
   too, using the exact same non-fatal pattern — this does not make them newly blocking, it makes
   their existing non-blocking failure visible instead of silent.
2. **A missing invoking-tree checkout.** If `$WORKTREE_ROOT/brain/scripts` does not exist at all
   (an incomplete or corrupted checkout), no amount of per-step warning is a meaningful
   degradation — every subsequent step would MODULE_NOT_FOUND in the same way the issue reports,
   just for a different reason. This one case is a new hard, blocking guard, checked first,
   immediately after `WORKTREE_ROOT`/`BRAIN_SCRIPTS` are computed.

Two `.env`-resolution risks were identified and mitigated, not left latent: `harness/cli.mjs` and
`memory/cli.mjs` each resolve their OWN `repoRoot` (and therefore their own `.env`) from their
module's `import.meta.url`, independent of `cwd`. Pointing bootstrap.sh's invocation of these
scripts at the worktree's copy means that resolution now targets the worktree too — where `.env`
does not exist (#657's invariant). Both modules already read `process.env.X ?? envVars.X` (shell
env wins), so `AGENT_PLATFORM`, `SDD_ENGINE`, and `MEMORY_BACKEND` are exported in bootstrap.sh
right after each is resolved from the main tree's `.env`, closing the gap without touching either
module.

## Out of scope, explicitly

- `git config core.hooksPath brain/scripts/hooks` (a relative path) is unchanged. Git resolves a
  relative `core.hooksPath` against each worktree's own top level at hook-invocation time, so a
  hook fired from a worktree already runs that worktree's own hook scripts — this is not the bug
  the issue reports, and no repro or symptom points at it.
- `node brain/scripts/vcs/cli.mjs` and `node brain/scripts/tracker-board.mjs` script PATHS are
  repointed at `$BRAIN_SCRIPTS` (same class of fix as the rest), but their own possible
  `import.meta.url`-based `.env` reads were not individually re-audited beyond the two modules
  named above — flagged here for the maintainer's awareness, not fixed speculatively.
- `bootstrap.sh` is a managed literal (`brain/core/managed-paths.mjs`, `managed` array,
  `brain/scripts/**`, `STRATEGY.COPY`), so this fix ships to every consumer on the next
  `brain:upgrade` (next release after this merges).
