# Claim sweep (#1344)

Each behavioural sentence of the 1.12.1 CHANGELOG entry, against the code on this branch. Paths are in the repo root. "Run" means observed on a scratch consumer
installed from the registry (1.11.0 / 1.12.0) and upgraded with `npm pack` of this tree (`logikas-brain-1.12.1.tgz`).

| # | Claim | Proof | OK |
|---|---|---|---|
| 1 | `brain:upgrade` runs the already-installed upgrader, which imports the incoming migrations and calls its own `migrateConfig` | `git show v1.11.0:brain/scripts/brain-upgrade.mjs` lines 21 (imports `migrateConfig` from its own `./lib/installer.mjs`) and the `await import(join(pkgRoot,'brain','core','config-migrations.mjs'))`; run: the consumer's managed `brain-upgrade.mjs` was byte-identical to 1.11.0's when started | YES |
| 2 | The 1.11.0 `migrateConfig` hands a migration no context | `git show v1.11.0:brain/scripts/lib/installer.mjs` `m.migrate(result, { mergeDefaults })` | YES |
| 3 | Migration 1.11.1 did nothing without a context, and the old upgrader still stamped 1.12.0 | `git show v1.12.0:brain/core/config-migrations.mjs` (`if (!ctx) return config;`); run: 1.11.0 consumer upgraded to the 1.12.0 tarball: schemaVersion 1.12.0, `Applied config migration(s): 1.11.1`, axes unshaped | YES |
| 4 | The output printed none of the per-value lines | run (same): no `ℹ` lines after `Applied` | YES |
| 5 | Affected: 1.11.0-or-earlier to 1.12.0 through `brain:upgrade`; a 1.12.0 upgrader is not | the 1.12.0 `brain-upgrade.mjs:674-675` builds and passes `resolveAxisMigrationContext`; run: scenario B's 1.12.0 to 1.12.1 used it and printed the lines | YES |
| 6 | A fresh 1.12.0 install is not affected | `lib/brain-config.mjs` `buildDefaultConfig` passes an explicit context | YES |
| 7 | Consequence: with no `.env`, `resolve platform` and `resolve sdd` exit 3 | run: scenario B after 1.12.0: rc=3 for both, rc=0 for vcs/memory (their legacy keys) | YES |
| 8 | `diagnose` does not flag it | stated in #1344 (measured there); not re-measured here | NOT RE-RUN (issue's own measurement) |
| 9 | 1.12.1 shapes any axis that lacks `{default, providers}`, same shaping as 1.11.1, and prints each value and source | `brain/core/config-migrations.mjs` `repairAxisShape` -> `migrateToAxisShape`; run: scenario B printed the six lines quoted | YES |
| 10 | On a correctly migrated config 1.12.1 changes nothing and prints nothing | `brain/scripts/lib/axis-shape-old-upgrader.test.mjs` "1.12.1 is a no-op on a correctly shaped config"; run: second 1.12.1 upgrade printed `Config already up to date` | YES |
| 11 | An axis declared nowhere is left `default: ""` and the line names the `brain:config set` command | `toShape` in `config-migrations.mjs` (`say(\`${axis}.default = "" (undeclared: ...; declare it with: npm run brain:config -- set ...)\``); `axis-migration-context.mjs` `effective` | YES |
| 12 | 1.11.1 builds its own context when none is given, from process env and `.env` via `axis-migration-context.mjs`, reading `.env` from the upgrader's cwd | `config-migrations.mjs` `migrateToAxisShape` (`helpers.root ?? process.cwd()`); old upgrader `const ROOT = process.cwd()` (`git show v1.11.0:brain/scripts/brain-upgrade.mjs:26`); run scenario A | YES |
| 13 | It prints each value it writes when no one collects notices | `printingSink`; test "NO sink prints each value"; run scenario A output | YES |
| 14 | Callers that must not read env pass `axisContext: null`: `brain:promote`'s proof and the `planConfigWrite` default; `buildDefaultConfig` hands an explicit fresh-install context | `brain-config.mjs:248` passes an explicit fresh context (never undefined); `brain-promote.mjs` `migrateConfig({}, mod.migrations, version, null)`; `config-verb.mjs` `axisContext = null`. The CHANGELOG states the `buildDefaultConfig` distinction | YES |
| 15 | `test:upgrade` asserts shape and four-axis resolve with `.env` aside, only when TO ships 1.11.1 | `test/upgrade/in-container.sh` step 4b (`HAS_SHAPE_MIGRATION`); harness run of the block: green on scenarios A and B, red on a config with platform and sdd emptied | YES (block run in isolation; the container itself needs a token and registry-published 1.12.1) |
| 16 | The upgrader still runs the installed version; re-exec is not fixed here | `brain-upgrade.mjs` unchanged by this change; KNOWN-LIMITATIONS entry | YES |
| 17 | 1.12.0 entry's "applies the migration and prints every value it writes" is false for 1.11.0-or-earlier upgrades | rows 3 and 4 | YES |

## Pre-publish upgrade check

Scenario A: registry 1.11.0 consumer, saved old `brain-upgrade.mjs` run with `v1.12.1 --no-install` after `npm i` of the tarball: `Applied config migration(s): 1.11.1, 1.12.1 (schemaVersion -> 1.12.1)`, four axes shaped, all four `resolve` rc=0 with `.env` aside.
Scenario B: the same consumer taken to 1.12.0 (defect reproduced: unshaped, `resolve platform|sdd` rc=3), then 1.12.1 with the 1.12.0 upgrader: `Applied config migration(s): 1.12.1`, shaped, all four rc=0; a second run: `Config already up to date`.
