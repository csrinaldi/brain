# Tasks — Versioned installer (Slice 6)

> Maps to the acceptance criteria in [proposal.md](proposal.md). All items
> implemented and unit-tested (`npm test`, 8 passing).

## Managed-paths manifest
- [x] Declare upstream (managed) vs local paths in `brain/core/managed-paths.mjs`.

## Versioned config migrations
- [x] Additive migration engine in `scripts/lib/installer.mjs` (`mergeDefaults`, `migrateConfig`).
- [x] Migration registry in `brain/core/config-migrations.mjs` (v0.1.0 baseline).
- [x] Guarantee: existing consumer values are never overwritten (test: *migrateConfig applies a new additive migration without clobbering*).

## `brain:upgrade` command
- [x] CLI `scripts/brain-upgrade.mjs` — `npm run brain:upgrade -- <tag>`.
- [x] Installs the tag (`npm i -D github:csrinaldi/brain#<tag>`) unless `--no-install`.
- [x] Copies only managed paths into the consumer (test: *copyManaged overwrites managed paths and never touches local ones*).
- [x] Self-host guard: refuses to run inside the brain repo without `--force`.
- [x] `--dry-run` previews the plan without writing.

## Check-and-notify in `day:start`
- [x] New step "Versión de brain (core)" compares installed vs latest git tag.
- [x] Notifies only — never auto-applies (respects `instaladores-autoactualizantes-no-inocuos.md`).
- [x] Degrades gracefully with no network / no tags.

## Versioning
- [x] `package.json` version aligned to `0.1.0` for the first release.
- [x] Tag `v0.1.0` created on the release commit (push to remote is a separate, explicit step).

## Documentation
- [x] README updated with adopt/update flow and the managed/local table.

## Tests
- [x] `scripts/lib/installer.test.mjs` (8 tests) + `npm test` script wired (`node --test`).
- [x] End-to-end upgrade verified against a fixture consumer (managed copied, local intact, config migrated additively).
