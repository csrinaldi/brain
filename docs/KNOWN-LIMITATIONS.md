# Known Limitations

These are the defects known today on the **consumer path** — install, bootstrap, and
the first days of using brain in a repository you did not build brain in. Each one was
found live, most of them by the `#1081` consumer demonstration (a fresh, empty
repository installing the published `@logikas/brain` package). Every item links its
tracking issue and states the practical workaround, if one exists.

This is not a scorecard of brain's own test suite — brain's suite is green on all of
these, which is the point: none of them shows up in brain's own repository (see
[ADR-0036](../brain/project/decisions/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md)).
For the plan to close this class of gap, see the
[definition of done](definition-of-done.md) and epic
[#1121](https://github.com/csrinaldi/brain/issues/1121).

---

## Install and first adoption

- **A fresh consumer's `env:init` can publish a credential, and reports success over
  failures it saw.** ([#1112](https://github.com/csrinaldi/brain/issues/1112))
  - `.env` is not gitignored by `brain init` or `env:init` — the next `git add -A`
    commits your token. **Workaround:** add `.env` and `node_modules/` to
    `.gitignore` before running `env:init` (see `docs/adoption.md`).
  - `vcs.provider` is not validated — a typo at the provider prompt is written
    verbatim into the tracked `brain.config.json`. **Workaround:** type exactly
    `github` or `gitlab`.
  - `project.name` stays empty, which makes every `engram` doctrine-index write fail
    silently while the run reports success. **Workaround:** set `project.name` by
    hand in `brain.config.json` before your first `brain:memory:index`.
  - The adoption commit is refused by brain's own pre-commit hook, and no documented
    path exists yet for a new repository's first commit. **Workaround:**
    `git commit --no-verify`, after confirming `brain:repo:check` is green yourself.
    See `docs/adoption.md` — "The first commit".

- **The post-merge archive sweep crashes when `openspec/changes/` doesn't exist, and
  files a false alarm on every clean merge.**
  ([#1113](https://github.com/csrinaldi/brain/issues/1113)) Affects any consumer that
  hasn't started its first SDD change yet. **No workaround** besides creating an
  `openspec/changes/` directory (even empty) before your first post-merge run, or
  ignoring the filed alarm issue until this ships.

- **The archive sweep's automation identity has no provisioning verb.**
  ([#1107](https://github.com/csrinaldi/brain/issues/1107)) Setting up the GitHub App
  the sweep needs (`#1106`, shipped) is a manual, one-time admin task today, with no
  `brain:doctor`-style check that reports whether it's configured. **Workaround:**
  follow "The archive sweep's automation identity" in `docs/adoption.md`; without it
  the sweep still degrades safely (pushes the branch, files an alarm instead of
  crashing or reporting a false success).

## Memory (`#864` track)

- **`session:start` / `day:start` call engram's operations by name instead of the
  configured backend's lifecycle verb.**
  ([#1115](https://github.com/csrinaldi/brain/issues/1115)) On `MEMORY_BACKEND=plainfiles`,
  both report `backend 'plainfiles' does not implement op 'import'` and **no memory
  context reaches the agent** at session start. **Workaround:** none that restores the
  context; `brain:memory:pull` still works to sync records to disk.

- **A fresh `engram` 2.0 store rejects brain's import sessions.**
  ([#1116](https://github.com/csrinaldi/brain/issues/1116)) A record whose hydrate into
  engram was deferred (engram unavailable at save time) is durable in
  `.memory/records/` but can never reach a **new** engram store — both recovery paths
  (`memory/cli.mjs import`, `brain:memory:pull`) fail on a fresh store. Invisible in
  brain's own repository because its store already holds the import session row.
  **Workaround:** none yet; the record is safe on disk and reachable by reading
  `.memory/records/` directly.

- **`search` serves a superseded record next to its correction, both unmarked.**
  ([#1117](https://github.com/csrinaldi/brain/issues/1117)) The supersession link
  exists in the data (`supersedes`) but isn't surfaced to the reader, so a stale claim
  can be read as current. **Workaround:** when in doubt, check a record's
  `supersedes` field directly rather than trusting the newest-looking result.

- **The checkout that captured a memory record can't `pull` after its own lane merge.**
  ([#1118](https://github.com/csrinaldi/brain/issues/1118)) `git pull` refuses because
  the local, already-committed record files are untracked-but-identical to what just
  landed on `main`. **Workaround:** `git add .memory/records/ && git pull` (or
  `git stash -u && git pull && git stash pop`) once you hit the
  "untracked working tree files would be overwritten" error.

- **The `prLookupFailed` memory message claims a push that didn't happen.**
  ([#1119](https://github.com/csrinaldi/brain/issues/1119)) If the PR lookup during
  `brain:memory:ship` fails, the reported message says the records are durable on the
  remote; since `#936` the push runs *after* the lookup, so nothing was pushed.
  **Workaround:** if you see this message, verify with
  `git ls-remote --heads origin 'memory/*'` before assuming the records shipped.

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
