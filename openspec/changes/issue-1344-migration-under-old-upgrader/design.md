# Design — #1344

## Context source and root
The old upgrader does `const ROOT = process.cwd()` (v1.11.0 `brain-upgrade.mjs:26`) and its `migrateConfig` passes the migration
nothing else, so the migration reads `process.cwd()` for the `.env`. Both are injectable for tests (`helpers.env`, `helpers.root`,
`helpers.buildAxisContext`).

## Import across the package boundary
`brain/core/config-migrations.mjs` now statically imports `../scripts/lib/axis-migration-context.mjs`. Both ship in the package and the old
upgrader imports the config-migrations file from the INSTALLED (incoming) package, so the relative import resolves inside the same tree.
No cycle problem: the imported graph does not import config-migrations.

## undefined versus null
The old upgrader's call is indistinguishable from "caller has no opinion": it passes undefined. So undefined MUST self-build (that is the
bug), and the env-blind callers have to say so: `axisContext: null`. Callers that pass null: `buildDefaultConfig` (it hands an explicit
fresh context anyway), `brain-promote` proof (`migrateConfig({}, ..., null)`: must not read the maintainer's `.env` nor print), and
`planConfigWrite` (`axisContext = null` default: `engines-report` calls it with none, and `brain:config` passes its own env-blind
context). The new upgrader and `brain:config` still pass real contexts, so their behaviour is unchanged.

## 1.12.1
Same shaping, gated by "some axis is not shaped" so a deliberately edited shaped config (a removed `sdd.providers.brain`, say) is never
re-written. Under the new upgrader the context is handed in; under any other it self-builds.

## Residual
The upgrader still runs the installed code. Re-exec after install is a follow-up (KNOWN-LIMITATIONS).
