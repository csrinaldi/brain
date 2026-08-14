---
status: draft
issue: 655
---

# Spec — the publish slice (issue 655)

## REQ-655-1 — The package is scoped, and both declarations agree

`package.json`'s `name` matches `/^@[a-z0-9-]+\/[a-z0-9-]+$/`, and
`installer.mjs`'s `PACKAGE_NAME` equals it exactly.

## REQ-655-2 — A scoped package declares public access

`publishConfig.access === 'public'` **and** the workflow passes
`--access public`. Either alone leaves a path that publishes `restricted`, which
succeeds and burns the version.

## REQ-655-3 — `private` comes off only alongside the allowlist

`private !== true` and `files` is present with at least five entries. That
pairing is what #607 exists to hold.

## REQ-655-4 — The workflow rehearses before it publishes

It references `NPM_BRAIN_TOKEN` (not `NPM_TOKEN`), runs
`npm publish --dry-run` **before** the real publish, and runs the suite first —
the tarball's contents are decided by `publish-allowlist.e2e.test.mjs`.

## REQ-655-5 — A version may not name two different trees

If a tag `v<version>` exists and does not point at the publishing commit, the
workflow refuses and says to bump. The same rule runs in the suite, skipping
when no such tag exists.

## REQ-655-6 — The bootstrap alias is derived

`BOOTSTRAP_SCRIPT_VALUE` is built from `PACKAGE_NAME`, so a scope becomes two
directory segments exactly as npm lays them out.

## REQ-655-7 — A stale alias brain wrote is migrated; a consumer's is kept

A value byte-identical to an entry in `LEGACY_BOOTSTRAP_VALUES` is rewritten and
reported as `migrated`. Anything else is kept, and `alreadyPresent` still
reports it. The legacy list is **literals, not a pattern** — a pattern loose
enough to catch the next variant eventually overwrites something deliberate.

## REQ-655-8 — Brain's release machinery does not ship

`publish.yml` is not in `files`; the governance workflows still are.

## REQ-655-9 — A pre-rename literal that is NOT the package name stays

`brain-upgrade.mjs`'s clobber-awareness check tests `ownPkg.name === 'brain'`.
That is the fingerprint of a specific historical bug, not a reference to the
package name: the clobbered population still carries it. Swapping it for
`PACKAGE_NAME` would drop the warning for exactly the repositories it was
written for.

## REQ-655-10 — The documentation carries the migration

The README installs by name and keeps the git URL as a documented fallback; the
CHANGELOG carries the two-command migration and the explicit instruction not to
cross the rename with `brain:upgrade`.
