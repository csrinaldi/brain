# Known Limitations

These are the defects known today on the **consumer path** — install, bootstrap, and
the first days of using brain in a repository you did not build brain in. Each one was
found live, most of them by the `#1081` consumer demonstration (a fresh, empty
repository installing the published `@logikas/brain` package). Every item links its
tracking issue, where one exists, and states the practical workaround, if one exists.
This list describes brain **1.9.0**.

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

- **`session:start` / `day:start` call engram's operations by name instead of the
  configured backend's lifecycle verb.**
  ([#1115](https://github.com/csrinaldi/brain/issues/1115)) On `MEMORY_BACKEND=plainfiles`,
  both report `backend 'plainfiles' does not implement op 'import'` and **no memory
  context reaches the agent** at session start. **Workaround:** none that restores the
  context; `brain:memory:pull` still works to sync records to disk.

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
([#1127](https://github.com/csrinaldi/brain/issues/1127)). Each is a place where a
failure is still not the exit code it should be. None shows up in a healthy tree.

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
