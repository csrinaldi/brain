---
status: draft
issue: 1139
---

# Proposal — `env:init` merges native settings.json instead of overwriting it

## What was wrong

`brain/scripts/harness/backends/claude.mjs`'s `init()` writes `.claude/settings.json`
**without reading it first** — it imports only `writeFileSync`/`mkdirSync` and calls
`writeClaudeSettings(CLAUDE_SETTINGS_EMIT_PATH, settingsContent)` with brain's compiled
content, unconditionally. Every entry a consumer had in that file — `permissions.allow`,
their own hooks — is gone after `brain:env:init`. `brain/scripts/harness/backends/antigravity.mjs`
does the identical thing to `.gemini/settings.json`.

Meanwhile `brain:upgrade` **merges** the same file: `mergeClaudeSettings(existingPath,
brainSettingsPath)` in `brain/scripts/lib/installer.mjs` spreads the consumer's object and
additively appends brain's hook entries per event, leaving `permissions.allow` and every other
consumer key untouched. One file, two writers, opposite rules.

Reproduced in #1125's packed-tarball check (consumer C): `brain:upgrade` preserves a consumer's
`permissions.allow` entry; `brain:env:init` with platform `claude` erases it.

## Why now

#1125 makes `claude` the default platform, putting every fresh consumer on the destructive path.
ADR-0036 (the fresh-consumer check) means a change is not done until it works, at a cost one
person can pay, on a fresh consumer install — a default path that destroys consumer data on
first run fails that bar. #1125 is blocked on this.

## What changes

`init()` on both backends reads the existing settings file (if any) and merges through the
**same** merge code `brain:upgrade` uses, instead of writing brain's content unconditionally.
The merge logic itself moves into a pure, fs-free core (`mergeSettings(existingSettings,
brainSettings) → merged`) inside `brain/scripts/lib/installer.mjs`; `mergeClaudeSettings` becomes
a thin file-IO wrapper around that core, and both `claude.mjs` and `antigravity.mjs` call the
same core directly (no second implementation). `brain:upgrade`'s existing behavior and tests are
unchanged — that is the proof the refactor did not change what it already guaranteed.

A consumer settings file that exists but cannot be parsed as JSON is left untouched; `init()`
refuses to overwrite it and reports which file and why (no silent overwrite, no
report-success-over-a-failure — see #1127's broader naming of this defect class).

## What does not change

- No files move between directories in this change.
- `compileSettingsHooksJson()` (the brain-owned hooks payload) is unchanged.
- `brain:upgrade`'s `mergeClaudeSettings(existingPath, brainSettingsPath)` keeps its exact
  signature, exported name, and observable behavior — existing callers (`brain-upgrade.mjs`) and
  tests are untouched.
- AGENTS.md compilation in `antigravity.mjs` (the `missingDocs`/`agentsWritten` behavior) is out
  of scope; this change only touches the `.gemini/settings.json` write path.

## Rollback

Revert the commits touching `claude.mjs`, `antigravity.mjs`, and the new
`mergeSettings`/`mergeClaudeSettings` split in `installer.mjs`. `brain:upgrade`'s behavior is
unaffected either way, since its wrapper call site (`brain-upgrade.mjs`) does not change.
