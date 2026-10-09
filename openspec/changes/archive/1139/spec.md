---
status: draft
issue: 1139
---

# Spec

## REQ-1139-1 — `init()` merges into an existing `.claude/settings.json` instead of overwriting it

When `.claude/settings.json` already exists and parses as JSON, `claude.mjs`'s `init()` MUST
preserve every consumer-owned top-level key (e.g. `permissions.allow`) and every consumer hook
entry, while ensuring brain's current hook entries (from `compileSettingsHooksJson()`) are
present under their respective hook events.
**Falsifiable by**: seeding a fake existing settings file with a `permissions.allow` array and a
custom hook entry, then calling `init()` with injected read/write seams — the written content is
missing any original `permissions.allow` entry, or is missing any original custom hook entry, or
is missing a current brain hook entry.

## REQ-1139-2 — `init()` is idempotent

Calling `init()` twice in sequence against the same existing settings content (the first call's
output feeding the second call's "existing" input) MUST produce byte-identical written content
both times, with no duplicate hook entries.
**Falsifiable by**: capturing the written content of a first `init()` call, feeding it back as the
existing file for a second `init()` call, and comparing the two written strings — they differ, or
any hook array's length changes between the two.

## REQ-1139-3 — no existing file behaves exactly as before

When `.claude/settings.json` does not exist, `init()` MUST write brain's compiled settings content
unchanged — byte-identical to `compileSettingsHooksJson()`'s output.
**Falsifiable by**: calling `init()` with no existing file (default `_repoRoot` pointing at a path
with nothing there) and observing the written content differs from `compileSettingsHooksJson()`.

## REQ-1139-4 — a malformed existing settings file is never silently overwritten

When `.claude/settings.json` exists but is not valid JSON, `init()` MUST NOT write to it (the
write seam is never invoked), and MUST return a value that names the offending file path and
states how to fix it (parse or remove the file, then re-run `brain:env:init`).
**Falsifiable by**: seeding a malformed (unparseable) existing settings file, calling `init()`, and
observing either that the write seam was invoked, or that the resolved value gives no indication
of the failure (e.g. resolves the same as the success case, or omits the file path from the
message).

## REQ-1139-5 — `.gemini/settings.json` gets the same merge and the same refusal

`antigravity.mjs`'s `init()` MUST apply REQ-1139-1 through REQ-1139-4 to `.gemini/settings.json`
using the same underlying merge core as `claude.mjs`, reported through its existing additive
report shape (`missingDocs`/`agentsWritten`/`geminiWritten` plus a field describing a settings
parse failure) — it MUST NOT gain an `ok` property (REQ-B2's pinned "no `ok` property under any
combination" contract for this backend's `init()` stays true).
**Falsifiable by**: the same four fixtures as REQ-1139-1/2/3/4 run against `antigravity.mjs`'s
`init()`, or the resolved report gaining an `ok` key under any of them.

## REQ-1139-6 — one merge implementation, shared

The merge logic MUST exist as exactly one pure, fs-free function (`mergeSettings` in
`brain/scripts/lib/installer.mjs`), imported and called by `claude.mjs`, `antigravity.mjs`, and
the existing `mergeClaudeSettings` file-IO wrapper. No second copy of the merge algorithm may
exist in either backend file.
**Falsifiable by**: `rg` for hook-merging logic (iterating hook events, deduping by
`JSON.stringify`) appearing anywhere in `claude.mjs` or `antigravity.mjs` outside a call to the
shared function; or `mergeSettings` not being imported by both backend files.

## REQ-1139-7 — `brain:upgrade`'s observable behavior is unchanged

`mergeClaudeSettings(existingPath, brainSettingsPath)` MUST keep its exact exported name,
parameter shape (two absolute file paths), and observable behavior, including its existing error
message format on a malformed consumer file (`mergeClaudeSettings: could not parse consumer
settings at ${existingPath}: ${message}`).
**Falsifiable by**: `installer.test.mjs`'s existing S1 `mergeClaudeSettings` tests failing after
the refactor, or the error message format changing.

## REQ-1139-8 — upgrade and init compose without drift

Running `brain:upgrade` then `brain:env:init` then `brain:upgrade` again against the same
consumer settings file MUST leave the file stable after the second upgrade (no further change)
and MUST preserve the consumer's own keys throughout every step.
**Falsifiable by**: a fixture consumer settings file with a custom key, run through
`mergeClaudeSettings` → `claude.mjs init()` → `mergeClaudeSettings` again — the custom key is
missing at any step, or the file content differs between the second and third steps' relevant
parts (hook set).
