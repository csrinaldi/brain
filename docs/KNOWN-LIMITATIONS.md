# Known Limitations

These are the defects known today on the **consumer path** — install, bootstrap, and
the first days of using brain in a repository you did not build brain in. Each one was
found live, most of them by the `#1081` consumer demonstration (a fresh, empty
repository installing the published `@logikas/brain` package). Every item links its
tracking issue, where one exists, and states the practical workaround, if one exists.
This list describes brain **1.13.0**.

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

- **`search` serves a superseded record next to its correction, both unmarked.**
  ([#1117](https://github.com/csrinaldi/brain/issues/1117)) The supersession link
  exists in the data (`supersedes`) but isn't surfaced to the reader, so a stale claim
  can be read as current. **Workaround:** when in doubt, check a record's
  `supersedes` field directly rather than trusting the newest-looking result.

- **On `engram`, repeated `hydrate` runs can import a record again when engram detects a different
  project than brain uses.** ([#1353](https://github.com/csrinaldi/brain/issues/1353)) `engram export`
  is scoped to the project engram detects from the current directory. When that name differs from the
  one brain imports under, the import reads an empty key set and imports again: one record became four
  rows in the issue's e2e on engram 2.0.0. **Workaround:** none; records stay durable and the extra
  rows are in the derived engram store only.

- **`session:start`'s subprocess gate would allow a bare `hydrate`.**
  ([#1355](https://github.com/csrinaldi/brain/issues/1355)) `session:start` is read-only on `plainfiles`
  because it spawns `hydrate --verify`. The gate that restricts what it may spawn also accepts the bare
  `hydrate`, which writes `.memory/index.jsonl` there. Nothing spawns the bare form today; the gap is a
  guard that would not catch a regression. **Workaround:** none needed.

- **`heal` and `audit` still reach the `engram` adapter directly instead of the backend port.**
  ([#1352](https://github.com/csrinaldi/brain/issues/1352)) `heal` refuses unless the backend is
  `engram`, and `audit` picks its export reader by backend name. Four entries stay in the axis-port
  allowlist for it. **Workaround:** none needed; both behave as before on each backend.

- **`agent-authorities.md` and `harness-contract.md` still describe `brain:memory:save` as it was
  before #874.** ([#1362](https://github.com/csrinaldi/brain/issues/1362)) They say the backend picks a
  saved record up on its next hydration and that `save` is pinned to `plainfiles`. Today `save` writes
  the record, then calls `hydrate({recordId})` on the declared backend, and falls back to `plainfiles`
  only when none is declared. **Workaround:** read `memory-backend-contract.md`, which states it.

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

## Team config, owners and the user layer (1.12.0)

- **On GitLab at `standard` and `regulated`, `team-config-reviewed` cannot pass by approval.**
  ([#1281](https://github.com/csrinaldi/brain/issues/1281)) GitLab's approvals API does not say
  which commit an approval was given on, so `prReviews` returns `commitId: null` and the gate fails
  closed rather than accept a possibly stale approval (ADR-0040 Amendment 1). A change to
  `brain.config.json` is blocked at those tiers, and brain offers no way through. At `lite` the gate
  only warns. An MR pipeline also does not re-run when an approval lands. **Workaround:** re-run the
  pipeline after approving; on GitLab at `standard` or `regulated` there is none for the gate itself.

- **`brain:config user-set` can write a value the resolver then refuses.**
  ([#1339](https://github.com/csrinaldi/brain/issues/1339)) It checks only that the name is
  provider-shaped. `user-set platform.default codex` succeeds and saves to your user layer, and the
  next `brain:config -- resolve platform` exits 4 (`platform "codex" ... is not a platform brain
  ships (claude|antigravity|plain)`). **Workaround:** use a name the axis ships, and correct or
  remove the line in `${BRAIN_HOME:-~/.brain}/config.json`.

- **`brain-writes-reviewed` skips when the PR author cannot be resolved.**
  ([#1334](https://github.com/csrinaldi/brain/issues/1334)) If the forge call that reads the author
  fails, the gate returns a warning and reads no diff, so a change to `brain/core/**` or
  `brain/project/**` passes a gate that is required at every tier. `team-config-reviewed` was fixed
  for the same defect (#1333); this one was not. **Workaround:** re-run the check when the forge is
  reachable.

- **The memory refusal still tells you to run `env:init`.** (#1341) The text of the
  `brain:memory:*` refusal ends "Or run `npm run brain:env:init`, which asks once and writes it".
  In a repository that already has a `brain.config.json`, `env:init` asks nothing and writes
  nothing (1.12.0). **Workaround:** `npm run brain:config -- set memory.default <engram|plainfiles>`
  in a PR.

## Release safety

- **`test:upgrade` and the `upgrade-smoke` workflow test published releases only.**
  ([#1325](https://github.com/csrinaldi/brain/issues/1325), closed) FROM is installed from the
  registry and TO is the newest git tag, so an upgrade cannot be measured on the registry before it
  is published, and nothing in a pull request's own tree reaches the run. Before a publish, run the
  upgrade by hand against `npm pack` of the release commit; `brain:upgrade -- <tag> --no-install`
  then cannot tell a file you edited from one brain changed (it says so).

- **`brain:upgrade` runs the upgrader you already have, against the incoming migrations.**
  ([#1344](https://github.com/csrinaldi/brain/issues/1344)) `npm i` replaces the package after the
  script is loaded, so the old script calls its own `migrateConfig` over the new migration list. 1.12.0
  broke on this (a migration that needs a context got none); 1.12.1 makes the axis-shape migration build its
  own and adds a repair migration, but the contract trap remains for any future migration that needs
  something new from its caller. **Follow-up:** the upgrader should re-exec the incoming
  `brain-upgrade.mjs` after install. **Workaround:** after any upgrade, check that what the CHANGELOG says
  was written is in `brain.config.json`.

## Platform axis

- **`harness/readiness.mjs` can call a cold-review route to an unknown engine "ready".**
  ([#1374](https://github.com/csrinaldi/brain/issues/1374)) With `sdd.map['cold-review'].engine` set
  to a name brain ships no descriptor for, the readiness check answers ready (`cold-review is routed
  to <engine>; it declares no readiness probe`), while the review runner refuses the same route.
  **Workaround:** route the cold review to `claude`, `codex` or `gemini`; a typo shows up only when
  the review runs.

- **`day:start` always drives `gentle-ai`, regardless of your configured
  `SDD_ENGINE`.** ([#1114](https://github.com/csrinaldi/brain/issues/1114)) `claude`
  and `antigravity` are both supported agent platforms
  ([ADR-0024](../brain/project/decisions/adr-0024-three-axis-decoupling.md)), but the
  daily ecosystem step (`gentle-ai --version`/`skill-registry refresh`) and the
  `brain:tools:update` verb (`gentle-ai update`/`upgrade`, #1386) are hardcoded
  rather than reading the axis. **No
  workaround** beyond ignoring that step on a non-`gentle-ai` setup.

---

## Reporting a new one

If you hit something not listed here on a fresh install, it's worth an issue on
`csrinaldi/brain` with the exact commands and output — this list exists because
defects like these were found that way, one real adoption at a time.
