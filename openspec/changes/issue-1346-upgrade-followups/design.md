# Design — #1346

- Static drift scan over a hostile-env run: the migration only consults env when a shaping migration is pending, so a hostile run proves nothing about call sites it does not reach; the scan fails on the call shape itself. Hostile-env full-suite run is still reported as a cross-check.
- Exclusion via a negated `files` entry (`!brain/core/.brain-promote-proof-*`), verified on the real tarball; no `.npmignore` (it would be ignored when `files` is present for the root, and adds a second source of truth).
- `.gitignore` is not in `managed-paths.mjs`, so the entry is repo-only.
- Sweep is best effort and name-anchored (`^\.brain-promote-proof-.*\.mjs$`).
