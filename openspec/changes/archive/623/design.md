---
status: draft
issue: 623
---

# Design — installed-package-root (issue 623)

## D1 — `installer.mjs`, not a new module

It already holds `BRAIN_REPO_HTTPS` and the install-spec resolution. A new module
would be a second place to look for the same question, and `installer.mjs` is
already imported by all six callers.

## D2 — Variadic, so callers never re-join

`installedPackageRoot(root, 'brain', 'core', 'config-migrations.mjs')` rather
than returning a root the caller joins onto. A caller that joins is a caller
that can get the scope split wrong.

## D3 — Mirror the existing guard, do not invent one

`sdd-layout.test.mjs:221` already does exactly this job for `REQUIRED_ARTIFACTS`:
scan `brain/scripts/**/*.mjs`, exclude the owner and the tests, name the
offenders. A second shape for the same job is the #340 defect.

## Hot micro-decisions

- The guard was written and run **before** the extraction, red against the real
  tree: 7 offenders across 4 files (the 2 sites inside `installer.mjs` are
  excluded as the owner). That red is the proof it detects.
- Proven that the rename is now one line: setting `PACKAGE_NAME` to
  `@csrinaldi/brain` yields `/consumer/node_modules/@csrinaldi/brain` and
  `/consumer/node_modules/@csrinaldi/brain/brain/core/managed-paths.mjs`.
  Reverted byte-identical; the rename is **not** part of this change.
- An import landed inside a multi-line `import {` in `cli-entry.mjs` and broke
  the parse. Caught by `node --check` before anything ran — worth noting because
  a scripted edit that lands syntactically-invalid is the kind of thing a
  behaviour test would report as an unrelated failure.
