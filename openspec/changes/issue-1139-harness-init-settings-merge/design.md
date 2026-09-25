---
status: draft
issue: 1139
---

# Design — one merge core, two file-IO callers, two backend callers

## The core: `mergeSettings(existingSettings, brainSettings)`

`brain/scripts/lib/installer.mjs` gains a new export:

```js
export function mergeSettings(existingSettings, brainSettings) {
  if (existingSettings == null) return { ...brainSettings };

  const merged = { ...existingSettings };
  const brainHooks = brainSettings.hooks ?? {};
  if (Object.keys(brainHooks).length > 0) {
    const mergedHooks = { ...existingSettings.hooks };
    for (const [event, brainEntries] of Object.entries(brainHooks)) {
      const consumerEntries = mergedHooks[event] ?? [];
      const seen = new Set(consumerEntries.map((e) => JSON.stringify(e)));
      const additions = brainEntries.filter((e) => !seen.has(JSON.stringify(e)));
      mergedHooks[event] = [...consumerEntries, ...additions];
    }
    merged.hooks = mergedHooks;
  }
  return merged;
}
```

This is exactly the body `mergeClaudeSettings` already had, minus the two `readFileSync`/
`writeFileSync` calls and the existence check — those become the wrapper's job. Pure, fs-free,
takes and returns plain objects.

## Why not change `mergeClaudeSettings`'s signature

`mergeClaudeSettings(existingPath, brainSettingsPath)` takes two **paths** because that is what
`brain-upgrade.mjs`'s `MERGE_TARGETS` map needs (`{'.claude/settings.json': mergeClaudeSettings}`)
— it is called generically alongside other path-based `specialMerge` functions
(`mergePackageJson`). `claude.mjs`'s `init()` does not have a brain-settings *file* to point at —
`compileSettingsHooksJson()` compiles the content in memory. Rather than write a temp file just to
satisfy a path-shaped API (or grow `mergeClaudeSettings` a second, object-shaped overload that
callers must discriminate), the object-shaped core is the shared unit and each caller supplies its
own IO:

- `mergeClaudeSettings` (upgrade path): reads both files, calls `mergeSettings`, writes the
  result. Unchanged behavior, unchanged tests.
- `claude.mjs init()` / `antigravity.mjs init()` (init path): read the existing file through their
  own injectable seams (already how these functions are tested — no path/fs-shaped API to satisfy
  since brain's side is already an in-memory object), call `mergeSettings`, write through their
  existing injectable write seams.

Three callers, one algorithm.

## Read seam shape

Both backends get a new injectable read seam, mirroring the existing write seam pattern:

```js
function _defaultReadFile(relPath, root) {
  const fullPath = join(root, relPath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf8');
}
```

Returns `null` for "no file" (merge input `null` → `mergeSettings` treats it as "write brain's
block as-is", matching REQ-1139-3) and raw text otherwise. `init()` does the `JSON.parse` itself,
inside a `try/catch`, so a malformed file is caught at the call site where the file path is known
— *not* inside the read seam, which stays a dumb IO primitive testable with an in-memory map.

## The malformed-file branch, and why it differs by backend

**`claude.mjs`**: on a JSON.parse failure, `init()` returns `{ ok: false, reason: '...' }` — the
same shape `runStage()` already uses elsewhere in this file, and the shape `harness/cli.mjs`'s
`dispatch()` already checks (`r.ok === false` → `process.exit(1)`, printing `reason`). `init()`
today returns `undefined` on every success path; adding an explicit failure return on this one new
branch is additive and does not touch the success contract (existing test at claude.test.mjs:28
still passes unmodified — see spec REQ-1139-3).

**`antigravity.mjs`**: `init()` already has a *pinned* test (`antigravity.test.mjs` 1.5)
asserting its resolved report has **no** `ok` property "under any read/write failure
combination", and a JSDoc'd design decision ("Additive report object, not `{ ok: false }`"). This
change respects that: the malformed-`.gemini/settings.json` case adds a new field —
`geminiSettingsError: string | null` — instead of an `ok` field, and sets `geminiWritten: false`
(accurate: the write did not happen). `console.warn` still names the file and the fix, so the
failure is visible on stderr even though it does not (today) fail the CLI's exit code — matching
the pre-existing, deliberate asymmetry between these two backends' report shapes. Making
antigravity's `init()` exit-code-failing too is `#1127`'s broader sweep, not this ticket's; this
change does not silently regress it either way (the file is still never overwritten).

## `dispatch()` / `cli.mjs` — no change

`harness/cli.mjs` already reads `r.ok === false` generically. `claude.mjs`'s new failure branch is
picked up with zero `cli.mjs` change. `antigravity.mjs`'s new field is inert to `dispatch()` by
design (see above).

## Files touched

- `brain/scripts/lib/installer.mjs` — add `mergeSettings`, refactor `mergeClaudeSettings` to call
  it.
- `brain/scripts/harness/backends/claude.mjs` — `init()` reads-merges-writes instead of
  writes-unconditionally.
- `brain/scripts/harness/backends/antigravity.mjs` — same, for `.gemini/settings.json`.
- Tests: `installer.test.mjs`, `claude.test.mjs`, `antigravity.test.mjs`.

No file moves. No change to `compileSettingsHooksJson()`, `brain-upgrade.mjs`'s call sites, or
`MERGE_TARGETS`.
