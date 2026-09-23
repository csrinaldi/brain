---
status: draft
issue: 623
---

# Tasks — installed-package-root (issue 623)

- [x] Measure: 9 executable literals across 6 production modules, no constant
- [x] Confirm the precedent to mirror (`sdd-layout.test.mjs:221`)
- [x] RED FIRST: the guard, red against the current tree — 7 offenders in 4 files
- [x] `PACKAGE_NAME` + `installedPackageRoot()` in `lib/installer.mjs`
- [x] Migrate all 9 sites; wire the imports
- [x] Guard green; `npm test` 3454/3455
- [x] Mutation proof: reintroduce a literal in `brain-upgrade.mjs` and in
      `adopt.mjs` — each red, each naming the file, each reverted byte-identical
- [x] Prove the rename is one constant, then revert it

## Out of scope

The rename, `private: false`, the install spec moving to a package name, the
publish workflow — all #435.
