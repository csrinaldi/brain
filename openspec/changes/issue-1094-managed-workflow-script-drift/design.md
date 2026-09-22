---
status: draft
issue: 1094
---

# Design

`brain/scripts/lib/managed-workflow-script-drift.test.mjs` — new file, sibling of
`managed-script-keys-doctrine.test.mjs` (same "drift guard" pattern, different surface).

## Discovery: `discoverManagedWorkflowFiles()`

1. Iterate `managed` (imported from `brain/core/managed-paths.mjs`).
2. Literal entries (no `*`) are added to the candidate set as-is.
3. Glob entries (`brain/core/**`, `brain/scripts/**`) are expanded: `globWalkRoot()` computes the
   fixed filesystem prefix before the first `*` (e.g. `brain/scripts/**` → `brain/scripts`), the
   helper walks that directory recursively (skipping `node_modules`/`.git`), and each resulting
   relative path is tested against the pattern with `globToRegExp` (reused from
   `brain/scripts/lib/installer.mjs` — no second glob matcher).
4. The candidate set is filtered to paths ending in `.yml`/`.yaml` that exist on disk.

This reuses the SAME data the installer copies from — no second, hand-maintained file list. A
future managed workflow (new literal, or one landing under an already-managed glob) is picked up
automatically.

## Parsing: `findNpmInvocations(content)`

One regex, `NPM_INVOCATION_RE = /npm (?:run\s+([a-zA-Z0-9:_-]+)|(test)\b)/g`, applied
line-by-line (so failures can report a 1-indexed line number):

- Alternative 1 catches `npm run <script>` — GitHub's `run: npm run X` and GitLab's chained
  `- npm run X && npm run Y && …` are both plain text containing that substring; no YAML-shape
  branching is needed, the same way `#922`'s doctrine scan didn't need to know it was reading
  Markdown vs. `.mjs`.
- Alternative 2 catches the bare `npm test` shorthand (npm's own convention: `test`, `start`,
  `stop`, `restart` run without `run`). Capturing it explicitly — rather than leaving it
  unmatched — is what lets `ALLOWED_TEST_SCRIPT` be a real, checked allowance instead of an
  accidental blind spot nobody could point to.

## The `npm test` allowance

```js
const ALLOWED_TEST_SCRIPT = 'test';
```

Named and commented at its declaration (every npm project defines `test` by convention — not
evidence of drift), and checked in the assertion loop (`if (script === ALLOWED_TEST_SCRIPT)
continue;`) rather than the regex simply never producing a match for it.

## Verdict

For each discovered file, for each `{script, line, text}` found (skipping `ALLOWED_TEST_SCRIPT`):
`script` MUST be in `new Set(MANAGED_SCRIPT_KEYS)`. Violations accumulate as
`"{file}:{line} — \`npm run {script}\` (\"{text}\") is not in MANAGED_SCRIPT_KEYS"` and are
asserted empty in one `assert.deepEqual`, so a failing run lists every offending site at once —
both `#1094` call sites showed up in the first RED run, not just the one the issue named.

## RED proof (this change)

Before Part 1's fix, running the guard failed naming exactly:

```
.github/workflows/governance.yml:128 — `npm run repo:check` is not in MANAGED_SCRIPT_KEYS
brain/scripts/ci/gitlab-governance.yml:140 — `npm run repo:check` is not in MANAGED_SCRIPT_KEYS
```

Renaming both call sites to `brain:repo:check` (Part 1) turned it GREEN with no other change to
the guard — confirming the guard tests what it claims to, not a tautology.

## Not covered, and why

- `.github/workflows/m4-danger-paths.yml` — not a `managed` path (REQ-1094-8); its own
  `test:danger-paths` alias problem is real but outside `brain:upgrade`'s reach and outside this
  guard's job.
- A workflow step that builds an `npm run` invocation dynamically (string concatenation, matrix
  interpolation) is invisible to a text scan. None of the four managed workflow files does this
  today; if one starts, this guard degrades the same way #922's doctrine scan does for the same
  class of input — a known, asserted limitation, not a claimed one.
