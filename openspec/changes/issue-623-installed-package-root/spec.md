---
status: draft
issue: 623
---

# Spec — installed-package-root (issue 623)

## REQ-623-1 — Exactly one module spells the path out

`lib/installer.mjs` owns `PACKAGE_NAME` and `installedPackageRoot(repoRoot, ...rest)`.
It already owns `BRAIN_REPO_HTTPS`, `installSpec` and `resolveInstallUrl` — the
module that answers "where does brain come from" — and is already imported by
every caller, so no new coupling and no cycle.

## REQ-623-2 — A scope resolves to two directory segments

npm splits `@scope/name` into two directories. `installedPackageRoot` splits on
`/` rather than passing the name as one `join` argument, so the rename cannot
produce a path with a literal `@scope/name` segment in it.

## REQ-623-3 — A second literal fails the suite

The guard scans `brain/scripts/**/*.mjs`, excluding `installer.mjs` and
`*.test.mjs`, and names every offending file with a count. It mirrors
`sdd-layout.test.mjs`'s A1 guard rather than inventing a second shape for the
same job (#340).

## REQ-623-4 — The guard cannot pass vacuously

It asserts it scanned a real tree, and throws rather than returning `[]` on an
unreadable one: "nothing found" and "nothing scanned" must not share a verdict.

## REQ-623-5 — Behaviour is unchanged

`npm test` green, and neither `test:danger-paths` nor `test:fresh-install`
changes: both exercise `node_modules/brain` end to end.
