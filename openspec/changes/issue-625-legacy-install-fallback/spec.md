---
status: draft
issue: 625
---

# Spec — legacy-install fallback and a legible failure (issue 625)

## REQ-625-1 — A legacy install is found

`resolveInstalledPackageRoot` prefers the canonical path
(`node_modules/<packageName>`, split on `/` so a scope becomes two segments) and
falls back to `node_modules/brain` when the canonical one is absent.

## REQ-625-2 — The canonical path wins when both exist

The legacy location is a fallback, never a preference. A tree holding both is a
tree mid-migration, and the scoped install is the current one.

## REQ-625-3 — With neither present, the canonical path is returned

So the caller's error names the location a reader should create, rather than the
one that happens to be older.

## REQ-625-4 — Nothing changes before the rename

While `PACKAGE_NAME === LEGACY_PACKAGE_DIR` the two candidates coincide; the
resolver returns without probing and no message invents a second location.

## REQ-625-5 — A failure message names every place that was searched

`installedPackageSearchPaths` is built from the **same two constants** the
resolver probes, in the same order, so a message can never name a path the code
did not search. `describeInstalledPackageSearch` renders them, appending any
trailing segments to **every** named path.

## REQ-625-6 — The entry points cannot re-hardcode it

A guard reads `brain-upgrade.mjs` and `cli-entry.mjs` with comments stripped —
both carry prose about the legacy path deliberately — and fails on a
`node_modules/brain` literal in executable text.

## REQ-625-7 — The scoped behaviour is tested before the rename

`packageName` and `exists` are injectable. A fallback that does nothing until the
day it matters, and has never run, is how a safety net is discovered to be
missing while being used.

## REQ-625-8 — The guard cannot pass vacuously

The comment stripper throws rather than returning `[]` on a file it read as all
comments: "no offending lines" and "nothing scanned" must not share a verdict.
