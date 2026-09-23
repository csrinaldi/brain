---
status: draft
issue: 655
---

# Proposal — the publish slice (issue 655)

## What

`@logikas/brain` becomes the package: the rename, `private: false`,
`publishConfig`, a publish workflow, the alias migration existing consumers need
(#628), and the documentation that tells them how to cross.

## Why one PR

Split, each half leaves a broken state: a scoped name with no publish points at
a package that does not exist; `private: false` with no workflow changes nothing;
and a rename without the migration leaves every installed consumer with a dead
alias and no way to learn that.

## What each piece is protecting against

- **`publishConfig.access: "public"`** — a scoped package publishes `restricted`
  by default. `npm publish` **succeeds**, the version is burned, and nobody can
  install it. It lives in the manifest *and* the workflow flag, because the flag
  alone leaves a manual publish from a laptop doing the wrong thing.
- **`PACKAGE_NAME` vs `package.json`'s `name`** — publishing adds a second
  authority for one fact. A drift means `installedPackageRoot()` resolves a
  directory npm never created.
- **The dry-run** — the token must be scoped to `@logikas/*`, not to a package;
  `@logikas/brain` does not exist until the first publish, so a granular token
  limited to selected packages cannot cover it. A rehearsal turns that into a red
  step instead of an auth error half-way through an irreversible act.
- **The version guard** — measured on this tree: tag `v1.0.0` points at
  `9d66221` and HEAD is `0d8d04d`. Publishing `1.0.0` from here would put these
  bytes behind a number that already means something else, and npm versions are
  immutable. Hence **1.1.0**.

## The migration, measured

There are installed consumers, and #625 established their break is unfixable by
construction. Measured, it is a **clean stop**: the death is 19 lines before any
managed path is written, and `die()` → `process.exit(1)` fires the handler that
releases the lock. Their tree is untouched; recovery is two commands, in the
CHANGELOG.

The alias is the half that does not self-heal — `writeBootstrapAlias` keeps a
consumer-set value, the right rule in general and exactly the wrong one for a
value brain itself wrote. So a value byte-identical to a known previous output
is migrated, and anything else is kept.

## Scope

- **In:** `package.json`, `PACKAGE_NAME`, `publish.yml`, #628's alias work,
  README, CHANGELOG, and the four tests these need.
- **Out:** `test/fresh-install` dropping `VCS_TOKEN` — ADR-0030's acceptance
  criterion, unverifiable against a package that does not exist yet. It lands in
  the commit after the first real publish.

## Stated rather than omitted

**`installSpec` still returns the git URL** until #644 (PR #646) merges, so
`brain:upgrade` will install from git even once the package is published. Not
broken — ADR-0030 Amendment 1 records the git URL as a supported, measured
byte-equivalent fallback resolving to the same directory — but the registry is
used only by the documented adoption line until #646 lands.
