---
status: draft
issue: 1124
---

# Design

## D1: new and existing are separated by WHO reads the default, not by a flag

`NEW_CONSUMER_DEFAULTS = { governance: { tier: 'lite' } }` is exported from
`brain/core/config-migrations.mjs`, after the `migrations` array and outside it.

- `buildDefaultConfig()` (`brain-config.mjs`) starts from `mergeDefaults({},
  NEW_CONSUMER_DEFAULTS)` and applies every migration on top. `mergeDefaults` never
  overwrites a present value, so the 0.9.0 entry's `standard` cannot replace `lite`. A fresh
  config is exactly "a consumer that declared `lite` before any migration ran", the same
  path a declared tier already takes through every upgrade.
- `migrateConfig` (`installer.mjs`), which `brain:upgrade` and `brain:config` run, walks only
  `migrations`. It has no path to `NEW_CONSUMER_DEFAULTS`.

Rejected alternatives:

- **Change the 0.9.0 default to `lite`.** This is the silent weakening the entry's note
  forbids: every pre-0.9.0 consumer would change tier on upgrade.
- **A new migration that sets `lite` when the key is absent.** Same defect; see D2.
- **Overwrite the tier after the migrations in `buildDefaultConfig()`.** It works, but it
  puts a second writer of the same key after the one that set it. Merging first uses the
  mechanism that already protects declared values.

The export sits after the array on purpose: `spliceMigrationEntry` (`migration-draft.mjs`)
anchors on the first `\n];` after `export const migrations = [`, and `release-debt.mjs`
scans the file for `version:` strings. The new export contains neither.

## D2: an existing config with no tier key keeps `standard`

This is the one case the ruling did not name. Evidence:

1. `resolveTier()` (`brain/scripts/vcs/governance-tiers.mjs`) returns `'standard'` when
   `governance.tier` is `undefined` or `null`. Every gate at such a consumer has always run
   at `standard`.
2. The 0.9.0 entry writes `standard` into exactly those configs. Its description says it is
   a no-op for every existing consumer for this reason, and REQ-TIER-10 requires `standard`
   to behave like pre-tier doctrine.
3. Writing `lite` there would change the effective tier of a repository whose maintainer
   never chose it. That is what the ruling forbids ("no migration may change it silently").

So the migration is unchanged, and `config-migrations.test.mjs` pins that
`resolveTier(before) === resolveTier(after)` across it. The notice (D3) reports an absent
key as `standard`, because that is what the gates run.

A config with `schemaVersion >= 0.9.0` and no key (hand-deleted) is not migrated at all; it
still resolves to `standard`, and `env:init` says so.

## D3: the notice is decided in one place and said in another

`brain/scripts/lib/tier-notice.mjs`:

- `tierNotice({ created, config })` is pure. It returns `{ tier, source }` with `source` in
  `new | declared | absent | invalid`. `invalid` is reported and never mapped to a tier,
  because `resolveTier()` throws on it and every gate fails closed.
- `renderTierNotice(notice, { locale })` turns it into lines through `t()`: the head line,
  a per-tier "why" (`config.tier.why.<tier>`), and how to change it.
- `printTierNotice({ created, configPath })` reads the file `ensure` just wrote and prints.
  The locale comes from that file's `docs.language`, explicitly, so the notice does not
  depend on `t()`'s ambient cache.

It runs from `brain-config.mjs`'s `ensure` entry point, the line `bootstrap.sh` already
executes, on every run and not only on creation. No `bootstrap.sh` change is needed, and the
strings live in the JS catalogs (`en.mjs`, `es.mjs`). `sh.mjs` emits every `en.mjs` key
anyway, but bash never prints these.

### The import cycle, measured

`tier-notice.mjs` imports `i18n/t.mjs` and `governance-tiers.mjs`, and both import
`brain-config.mjs`. A top-level `await import('./tier-notice.mjs')` inside `brain-config.mjs`'s
main guard deadlocked: Node printed "Detected unsettled top-level await" and exited 13, and
`bootstrap.sh` reported the ensure step as failed. The import is chained with `.then()`
instead, so it resolves after `brain-config.mjs` has finished evaluating and the cycle is
inert. A failure there sets `process.exitCode = 1` with a warning, so `bootstrap.sh`'s
existing "ensure step failed" report fires rather than the notice vanishing.

## D4: the "how to change it" names the verb and the follow-up

`npm run brain:config -- set governance.tier standard` is the one config write path (#823),
and `governance.tier` is a known path (the 0.9.0 defaults declare it). After a tier change,
`brain:protect` must be re-run, because it arms the platform review count from the tier
(ADR-0026 Amendment 6). Both scripts are merged into a consumer's `package.json` by
`brain init` (checked on the packed install).

## D5: the ADR-0036 check

There is no reusable fresh-consumer harness yet (#1136). The smallest honest check:
`npm pack`, install the tarball into a new git repository, apply it, run
`npm run brain:env:init </dev/null`, and read `brain.config.json` and the log.

`npx brain init` could not be used as the apply step. It spawns `brain-upgrade.mjs <tag>`,
which re-installed `@logikas/brain` from `github:csrinaldi/brain#v1.7.0` and rewrote the
consumer's dependency to that git URL, replacing the tarball under test with the published
1.7.0 code. The check applies the tarball with `brain-upgrade.mjs --no-install` instead,
which is what `init` delegates to minus the reinstall. The rewrite is a separate defect,
reported with this change and not fixed in it.

## Risks

| Risk | Mitigation |
|---|---|
| A new team repository starts at `lite` | The notice names `standard` and how to set it on the first `env:init` |
| A future migration re-adds a `lite` default | `config-migrations.test.mjs` refuses any migration defaulting the tier to `lite` |
| The notice fails and hides the tier | A failed notice sets exit 1, and `bootstrap.sh` reports the step as failed |
