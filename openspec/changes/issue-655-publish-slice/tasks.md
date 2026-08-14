---
status: draft
issue: 655
---

# Tasks — the publish slice (issue 655)

- [x] RED FIRST ×2: `publish-contract.e2e.test.mjs` (4 of 5 red) and
      `bootstrap-alias.test.mjs` (missing-export import error)
- [x] `package.json`: `@logikas/brain`, `private: false`, `publishConfig`
- [x] `PACKAGE_NAME`
- [x] `BOOTSTRAP_SCRIPT_VALUE` derived + `LEGACY_BOOTSTRAP_VALUES` + the
      migration in `writeBootstrapAlias` (#628)
- [x] `.github/workflows/publish.yml` — dispatch-only, suite, rehearsal, publish
- [x] README (install line, mirror fallback, pre-1.1 block, pnpm) and CHANGELOG
      (the migration section)
- [x] Real `npm pack`: `logikas-brain-1.1.0.tgz`, manifest correct
- [x] `npm test` **0 fail**; `brain:repo:check`, `brain:nav` clean
- [x] Mutation proof ×6, each diffed, re-read from disk, reverted byte-identical

## The four tests the rename turned red, and what each one was really saying

Not "update the expected strings". Each was a different fact:

| test | what it turned out to mean |
|---|---|
| `brain-upgrade`: `--force` bypasses the marker guard | pinned the literal `node_modules/brain not found`. #625 made that message **derived**, so it now names both searched paths. The test now derives it too. |
| `brain-upgrade`: name `"brain"` is a soft warning | same literal, same fix. **The `'brain'` in the guard itself stays** — see below. |
| `#625`: unscoped today, nothing changes yet | it said in its own text *"should be revisited with the rename"*. This is that revision: it now asserts the fallback is **live**, with the real constants. |
| `#625`: before the rename it names ONE path | replaced by the post-rename assertion that the message names **both**. |

**The literal that must NOT become `PACKAGE_NAME`:** `brain-upgrade.mjs`'s
clobber check reads `ownPkg.name === 'brain'`. That is the fingerprint of a
pre-v0.8.0 bug that already happened — its victims still carry `"name": "brain"`
on disk. Swapping it for the current package name would silently drop the
recovery warning for exactly that population. A comment now says so in place.

## Mutation proofs

| # | mutation | expected red | observed |
|---|---|---|---|
| M1 | remove `publishConfig` | publishes-private guard | **1 red** |
| M2 | `PACKAGE_NAME` back to `'brain'` | the two-declarations guard | **1 red** |
| M3 | drop the `--dry-run` rehearsal | the workflow contract | **1 red** |
| M4 | `BOOTSTRAP_SCRIPT_VALUE` back to a literal | derivation, scope split, migration, legacy list | **4 red** |
| M5 | stale alias preserved instead of migrated | the migration | **1 red** |
| M6 | version back to `1.0.0` | the version guard | **1 red**, naming both SHAs |

`diff -q` after each revert: byte-identical.

## What I got wrong, and it is the session's own lesson

The version guard's first version called `require()` inside an ES module. It
threw `ReferenceError` — and **I read that red as the guard catching the tag
mismatch** and said so. It caught nothing; it died before the comparison. The
mismatch is real, but *I* had established it by hand with `git rev-parse`, not
the test.

Fixed with a top-level import, and then proven the right way: setting the version
back to `1.0.0` produces a failure whose message names both SHAs —
`tag v1.0.0 points at 9d66221a while HEAD is 0d8d04d6`. A red is only evidence
once you have read why it is red.

## Out of scope

`test/fresh-install` dropping `VCS_TOKEN` — ADR-0030's acceptance criterion,
unverifiable until something is published. Its stated reason (*"the brain repo
is private"*) is already stale on its own.
