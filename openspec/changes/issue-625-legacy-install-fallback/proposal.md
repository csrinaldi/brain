---
status: draft
issue: 625
---

# Proposal — legacy-install fallback and a legible failure (issue 625)

## What

`installedPackageRoot` falls back to a pre-rename `node_modules/brain` when the
canonical path is absent, and the two places that die when brain is not
installed name **every** location that was searched. **The rename itself is not
here.**

## Why

An existing consumer installed by git tag has `node_modules/brain`. On the
release that carries the scoped name, their **vendored, old** `brain-upgrade.mjs`
resolves `node_modules/brain`; `installSpec` returns the git URL; npm reads the
**new** `package.json` and lands the tree in `node_modules/@csrinaldi/brain`; the
old code finds nothing and `die()`s. The upgrade that carries the rename kills
itself, and the verb a consumer runs to recover is the one that died.

That half is **unfixable by construction** — the failing code is already in their
tree and nothing written now reaches it. The mirror half is fixable: **new** code
finding an **old** install, which is real after any recovery and today reads as
"not installed".

And the failure has to be legible. `brain-upgrade.mjs:419` hardcoded
`node_modules/brain`; after the rename that names a path the code never
searched — the worst kind of error text, because it is confidently wrong.

## Scope

- **In:** `resolveInstalledPackageRoot` with the legacy fallback;
  `installedPackageSearchPaths` / `describeInstalledPackageSearch`; the two
  hardcoded messages in `brain-upgrade.mjs` and `cli-entry.mjs`; a guard that
  fails when either re-hardcodes the path.
- **Out:** the rename. `"name"` stays `brain`, `PACKAGE_NAME` is unchanged, and
  the fallback is inert until the day it is not — which is why it is tested with
  an injected scoped name rather than left to run for the first time in
  production.

## Known, named, and deliberately not fixed here

`lib/init.mjs`'s `BOOTSTRAP_SCRIPT_VALUE` writes
`node node_modules/brain/brain/scripts/brain-upgrade.mjs` into the **consumer's**
`package.json`. It is a third site of the same defect. Changing it changes what
is written to someone else's file, so it travels with the rename, not with this.
The guard's failure message names it so it cannot be forgotten quietly.
