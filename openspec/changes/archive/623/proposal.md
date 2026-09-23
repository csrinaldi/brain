---
status: draft
issue: 623
---

# Proposal — installed-package-root (issue 623)

## What

One source for where an installed brain lives inside a consumer, plus a drift
guard. **The rename itself is not here.**

## Why

#435 schedules the scoped rename as a name field. Measured, `node_modules/brain`
was resolved by literal in **nine executable places across six production
modules**. A scoped name splits into two directory segments, so every one of
those nine had to change — and a missed one does not fail at rename time. It
fails on the release that first needs that path, inside `brain:upgrade`, the
verb a consumer runs to recover. #601's shape.

## Scope

- **In:** `PACKAGE_NAME` + `installedPackageRoot()` in `lib/installer.mjs`, the
  nine call sites, and a guard that fails when a second literal reappears.
- **Out:** the rename. `"name"` stays `brain`, `private` stays `true`. This is
  behaviour-preserving by construction.

Splitting it this way is the point: renaming and refactoring together would mean
nine changed call sites with no way to tell a refactor slip from a rename
consequence.
