---
status: draft
issue: 1124
---

# Spec

## REQ-1124-1: a new consumer's config declares `lite`

When `ensureBrainConfig` creates `brain.config.json` (no file existed), the written config
MUST declare `governance.tier: "lite"`.
**Falsifiable by**: `ensureBrainConfig` on a directory with no `brain.config.json` writes any
other value, or no `governance.tier` key (`brain-config.test.mjs`, "creates config when
missing with github identity").

## REQ-1124-2: no migration defaults the tier to `lite`

No entry in `migrations` MAY carry `defaults.governance.tier === 'lite'`, and the 0.9.0
entry MUST keep `standard`. The new-consumer default MUST live outside `migrations`
(`NEW_CONSUMER_DEFAULTS`), and `migrateConfig` MUST NOT read it.
**Falsifiable by**: any migration entry defaulting the tier to `lite`; or `migrateConfig({},
migrations, '99.0.0')` producing `lite` (`config-migrations.test.mjs`).

## REQ-1124-3: a declared tier survives every upgrade

A config declaring `lite`, `standard` or `regulated` MUST keep that value through
`migrateConfig` from any earlier `schemaVersion`, and through `ensureBrainConfig` on an
existing file.
**Falsifiable by**: `migrateConfig({ schemaVersion: v, governance: { tier } }, migrations,
'99.0.0')` for v in {0.1.0, 0.8.0, 1.5.0} changing the tier; or `ensureBrainConfig` changing
`governance` on an existing file (`config-migrations.test.mjs`, `brain-config.test.mjs`).

## REQ-1124-4: a missing tier key migrates to the tier it already resolved to

An existing config with no `governance.tier` MUST migrate to `standard`, and
`resolveTier()` of the config MUST be the same before and after the migration.
**Falsifiable by**: `migrateConfig` of a pre-0.9.0 config without the key yielding a tier
other than `standard`, or `resolveTier(before) !== resolveTier(after)`.

## REQ-1124-5: env:init states the tier on every run

`node "$BRAIN_SCRIPTS/lib/brain-config.mjs" ensure`, the line `bootstrap.sh` runs, MUST
print a line `governance tier: <tier>`:

- on a config it created: the tier it set, a sentence on why, and how to change it (the
  alternatives `standard` and `regulated`, the key `governance.tier`, the file
  `brain.config.json`, and `brain:config -- set governance.tier`);
- on an existing config declaring a tier: that tier, stated as unchanged, and the file left
  byte-identical;
- on an existing config with no key: `standard`, stated as resolved from an absent key;
- on an unknown value: the value named as not a tier, with the valid tiers.

**Falsifiable by**: `bootstrap.tier-notice.test.mjs` (the line lifted from `bootstrap.sh` and
run in a consumer-shaped tree) or `tier-notice.test.mjs` finding the line, the reason or the
alternatives missing, or the existing file rewritten.

## REQ-1124-6: the notice goes through the catalogs

Every string of the notice MUST be a key in `brain/scripts/i18n/en.mjs`, with a Spanish entry
in `es.mjs`.
**Falsifiable by**: rendering the notice with locale `es` yields the English text
(`tier-notice.test.mjs`), or `coverage.test.mjs`'s parity check fails.

## REQ-1124-7: shown on a consumer built from the packed tarball (ADR-0036)

On a fresh directory with the `npm pack` tarball installed and applied, `brain:env:init` MUST
write `lite` and print the tier line; consumers declaring `standard` or `regulated` MUST keep
them through `brain:upgrade` and `brain:env:init`.
**Falsifiable by**: the procedure recorded in `tasks.md` T9 producing any other tier or no
tier line.
