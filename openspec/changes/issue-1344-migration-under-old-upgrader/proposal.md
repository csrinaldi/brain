# Proposal — migration 1.11.1 is a no-op under the 1.11.0 upgrader (#1344)

Parent: #1121. Release blocker for 1.12.0. Fixed in 1.12.1.

## Problem

`brain:upgrade -- v1.12.0` on a 1.11.0 consumer runs the installed 1.11.0 `brain-upgrade.mjs`. It imports the incoming
`brain/core/config-migrations.mjs` and calls its own `migrateConfig`, which hands a migration `{ mergeDefaults }` and no
`axisContext`. Migration 1.11.1 returned the config unchanged without one, and the upgrader still stamped
`schemaVersion: "1.12.0"`. Measured on registry 1.11.0 to 1.12.0: the config changes by exactly one line, no axis is shaped,
nothing is printed, and `resolve platform|sdd` exit 3 in any checkout without a `.env`.

## Intent

The migration is correct under ANY upgrader, and consumers already stamped 1.12.0 without the shape are repaired by the
next upgrade.

## Scope

1. `migrateToAxisShape` builds its own context when `helpers.axisContext` is absent (undefined), with the same module and
   rules as the new upgrader, and prints each value it writes when no notice sink is given.
2. Explicit `axisContext: null` is the env-blind opt-out; the callers that must not read env pass it.
3. New migration 1.12.1: applies the same shaping when any axis lacks the shape; no-op on a shaped config.
4. `test:upgrade` asserts the outcome. CHANGELOG 1.12.1 first in "Read before upgrading"; 1.12.0 entry corrected in place.
5. Release 1.12.1 in the same PR.

## Non-goals

Re-executing the incoming upgrader after install (recorded in KNOWN-LIMITATIONS). `npm deprecate @logikas/brain@1.12.0` is the
maintainer's call.
