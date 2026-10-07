# Spec — delta requirements (#1344)

- **REQ-1344-1** WHEN migration 1.11.1 runs with `helpers.axisContext` undefined THEN it builds the context from `helpers.env`
  (default `process.env`) and `helpers.root` (default `process.cwd()`) using `resolveAxisMigrationContext`, and shapes all four axes.
- **REQ-1344-2** WHEN no `helpers.notice` sink is given THEN each value written is printed with its source; WHEN a sink is given
  THEN nothing is printed to stdout.
- **REQ-1344-3** WHEN `helpers.axisContext === null` THEN migrations 1.11.1 and 1.12.1 return the config unchanged and read no env.
- **REQ-1344-4** `buildDefaultConfig`, `brain:promote`'s proof import and `planConfigWrite` (default) pass `null`.
- **REQ-1344-5** Migration 1.12.1 shapes only if some of `vcs`, `memory`, `platform`, `sdd` lacks `default`/`providers`; on a shaped
  config it returns it unchanged and prints nothing. Idempotent.
- **REQ-1344-6** The v1.11.0 `migrateConfig` loop run over the shipped migrations leaves every axis shaped (regression test).
- **REQ-1344-7** `test:upgrade` fails when, after the upgrade to a TO that ships 1.11.1, an axis lacks the shape or does not resolve with no `.env`.
