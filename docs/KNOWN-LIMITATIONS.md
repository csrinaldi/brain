# Known Limitations

These are the defects known today on the **consumer path** — install, bootstrap, and
the first days of using brain in a repository you did not build brain in. Each one was
found live, most of them by the `#1081` consumer demonstration (a fresh, empty
repository installing the published `@logikas/brain` package). Every item links its
tracking issue, where one exists, and states the practical workaround, if one exists.
This list describes brain **1.11.0**.

This is not a scorecard of brain's own test suite — brain's suite is green on all of
these, which is the point: none of them shows up in brain's own repository (see
[ADR-0036](../brain/project/decisions/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md)).
For the plan to close this class of gap, see the
[definition of done](definition-of-done.md) and epic
[#1121](https://github.com/csrinaldi/brain/issues/1121).

---

## Install and first adoption

- **The archive sweep's automation identity has no provisioning verb.**
  ([#1107](https://github.com/csrinaldi/brain/issues/1107)) Setting up the GitHub App
  the sweep needs (`#1106`, shipped) is a manual, one-time admin task today, with no
  `brain:doctor`-style check that reports whether it's configured. **Workaround:**
  follow "The archive sweep's automation identity" in `docs/adoption.md`; without it
  the sweep still degrades safely (pushes the branch, files an alarm instead of
  crashing or reporting a false success).

## Memory (`#864` track)

- **`brain:memory:ship` does not print the lane PR it created or found.**
  ([#1167](https://github.com/csrinaldi/brain/issues/1167)) It never prints the PR URL, and
  when auto-merge is refused or the PR number cannot be derived it prints only that notice,
  not the number (when auto-merge is armed it prints `#N`). **Workaround:** look the PR up
  on your forge (`gh pr list --head memory/...`).

- **On `plainfiles`, the derived `.memory/index.jsonl` is tracked and saves and pulls
  dirty it; on `engram`, `.memory/` is left untracked.**
  ([#1168](https://github.com/csrinaldi/brain/issues/1168)) Observed on fresh consumers
  of each backend: the two leave the tree in different states after adoption, and the lane never ships the dirty index.
  **Workaround:** none needed for correctness (records are the truth, the index is
  derived); expect ` M .memory/index.jsonl` in `git status` on `plainfiles`.

- **`env:init` run from a linked worktree can declare the memory backend in the main
  checkout's `brain.config.json`, not the worktree's.**
  ([#1178](https://github.com/csrinaldi/brain/issues/1178)) The prompt's answer is
  written to the main checkout, while `memory/cli.mjs` reads the tree it runs from, so a
  later `brain:memory:pull` in the worktree can exit 3 until the backend is declared
  there. `brain:memory:audit` with no backend declared prints
  `undefined: no export reader for this backend`. **Workaround:** run
  `npm run brain:config -- set memory.backend <engram|plainfiles>` in the tree you commit
  from.

- **`session:start` / `day:start` call engram's operations by name instead of the
  configured backend's lifecycle verb.**
  ([#1115](https://github.com/csrinaldi/brain/issues/1115)) On `MEMORY_BACKEND=plainfiles`,
  both report `backend 'plainfiles' does not implement op 'import'` and **no memory
  context reaches the agent** at session start. **Workaround:** none that restores the
  context; `brain:memory:pull` still works to sync records to disk.

- **On `plainfiles`, `brain:memory:pull` and the `post-merge` hook print an `import` refusal.**
  ([#1189](https://github.com/csrinaldi/brain/issues/1189)) The `post-merge` git hook, which
  a `git pull` fires when it integrates commits (including the one inside `brain:memory:pull`),
  calls `memory/cli.mjs import`, which `plainfiles` does not implement, so those pulls print
  `memory/cli: backend 'plainfiles' does not implement op 'import'`. The hook is
  non-blocking and `brain:memory:pull` still exits 0 and verifies the records. The same call is
  behind the `session:start` / `day:start` entry below (#1115). **Workaround:** none needed for
  correctness; ignore the line.

- **`search` serves a superseded record next to its correction, both unmarked.**
  ([#1117](https://github.com/csrinaldi/brain/issues/1117)) The supersession link
  exists in the data (`supersedes`) but isn't surfaced to the reader, so a stale claim
  can be read as current. **Workaround:** when in doubt, check a record's
  `supersedes` field directly rather than trusting the newest-looking result.

- **The engram duplicate-heal probe is tested on 1.20.x only.** On engram 2.x, import and
  hydration work, but the probe refuses the duplicate-heal verb with "outside the tested
  1.20.x" (even in dry-run). **Workaround:** none needed for normal use; duplicates
  are not healed automatically on 2.x.

## Failures that are still reported softly

These are the follow-up slices left by the failure-reporting sweep
([#1127](https://github.com/csrinaldi/brain/issues/1127), closed: the sweep shipped, and
these five slices were left out of it on purpose; none has an open issue of its own that
we know of). Each
is a place where a failure is still not the exit code it should be. None shows up in a
healthy tree.

- **A failed `AGENTS.md` regeneration during `brain:upgrade` is a warning, then `Done.`.**
  The upgrade itself succeeded. **Workaround:** read the warning and run the printed hint.
- **An unreadable `.memory/records/` directory or record file reads as an empty store.**
  `brain:memory:audit` does not count it. **Workaround:** if memory looks empty, check
  the directory's permissions.
- **`brain:upgrade`'s installer does not fail closed on two unreadable-path cases.** An
  unreadable source directory lists as empty (a file could be skipped from the copy), and
  an unresolvable destination root reads as "does not escape". **Workaround:** none needed
  on a healthy tree.
- **`brain-config ensure` still degrades silently on an unwritable directory.**
  **Workaround:** make the repository root writable.
- **Failure reporting is not yet swept in `day:start`, `session:start`, `adopt`, the
  `vcs/**` adapters and the `hooks/*` scripts.** A swallowed failure there can read as a
  healthy session. **Workaround:** none; treat a session start that prints nothing about
  memory as unverified.

## Hooks and governance

- **`pre-receive` still refuses a new repository's ticket-less first push.**
  ([#1169](https://github.com/csrinaldi/brain/issues/1169)) The local `commit-msg` hook
  accepts the adoption commit without `#N`; the server-side hook, where
  `brain:protect-server` is installed before the first push, does not. **Workaround:**
  install `brain:protect-server` after the first push.

- **`git commit --amend` on the adoption commit is refused.**
  ([#1175](https://github.com/csrinaldi/brain/issues/1175)) The first-commit exemption
  holds only while no commit exists, and an amend is judged as a later commit.
  **Workaround:** add a `#N` to the amended message, or make a new commit.

- **When the post-merge cursor bootstrap cannot read run history, the alarm says only
  `unknown`.** ([#1176](https://github.com/csrinaldi/brain/issues/1176)) The port's own
  detail (for example an HTTP 403 from a missing `actions: read`) is dropped before the
  alarm. **Workaround:** run `gh run list --workflow governance-postmerge.yml --branch
  <default> --status success --limit 1` yourself to see the cause. Also from #1176: a
  workflow file deleted and re-added moves the bootstrap's start earlier (a wider audit),
  not later.

- **A crash of the `index-lag` step reads as a local pass.**
  ([#1194](https://github.com/csrinaldi/brain/issues/1194)) CI's `local-checks` job runs
  `node brain/scripts/memory/index-lag.mjs` and fails if the script itself throws (an unreadable
  or malformed `.memory`). `brain:check` never reads that step's exit status: it prints
  `[PASS] indexLag` with the error text as a `::warning::`. **Workaround:** when that line
  carries an error rather than a lag report, run `node brain/scripts/memory/index-lag.mjs`
  yourself and read its exit code.

- **`brain:check` and `brain:ship` read the default branch from two different places.**
  ([#1194](https://github.com/csrinaldi/brain/issues/1194)) `brain:ship` opens the PR against
  `project.defaultBranch` when that key is set; `brain:check` never reads it and measures the
  diff and the `issue-link` rule against the remote's default branch. If the two differ, the
  local verdict is about a different PR than the one `brain:ship` opens. **Workaround:** leave
  `project.defaultBranch` unset, or keep it equal to the remote's default branch.

- **A `skip:memory-gate` label honoured at `standard` is not replayed by the post-merge audit.**
  ([#1188](https://github.com/csrinaldi/brain/issues/1188), a residual its fix names) The audit
  has no label-event evidence, so a merge the gate let through on that label can still surface
  post-merge as a memory failure. **Workaround:** add a record scoped to the issue.

- **`env:init` replaces a `brain.actor` that is not a valid handle without saying so.**
  ([#1177](https://github.com/csrinaldi/brain/issues/1177)) A valid handle is kept; any
  other stored value is overwritten (when a VCS identity is available) and the output reads
  as if none existed.
  **Workaround:** `git config --local brain.actor @<handle>` after `env:init`, if the
  earlier value mattered.

## Platform axis

- **`day:start` always drives `gentle-ai`, regardless of your configured
  `SDD_ENGINE`.** ([#1114](https://github.com/csrinaldi/brain/issues/1114)) `claude`
  and `antigravity` are both supported agent platforms
  ([ADR-0024](../brain/project/decisions/adr-0024-three-axis-decoupling.md)), but the
  daily ecosystem-update step (`gentle-ai --version`/`update`/`upgrade`/
  `skill-registry refresh`) is hardcoded rather than reading the axis. **No
  workaround** beyond ignoring that step on a non-`gentle-ai` setup.

---

## Reporting a new one

If you hit something not listed here on a fresh install, it's worth an issue on
`csrinaldi/brain` with the exact commands and output — this list exists because
defects like these were found that way, one real adoption at a time.
