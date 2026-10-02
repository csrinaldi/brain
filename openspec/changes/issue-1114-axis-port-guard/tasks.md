# Tasks — #1114

## S1 guard (this slice)
- [x] Guard test first: scanner unit tests, allowlist validation tests, tree scan (red with an empty allowlist)
- [x] Measure offenders with `AXIS_PORT_DUMP`, populate the allowlist with owner and reason per entry
- [x] Mutation: fake offender file and a new line in an allowlisted file fail the guard
- [x] Mutation: removed entry (uncovered) and added entry (stale) fail the guard
- [x] `npm test` and `npm run brain:repo:check`

## S3 schema and migrations (lands BEFORE S2, ADR-0038 §8)
- [x] S3.1 `lib/axis-config.mjs`: `readAxis` (shape, legacy alias, none) and `validateAxisConfig`; every existing reader routed through `readAxis` with no behaviour change; parity tests; no guard allowlist change needed
- [x] S3.2 Migrations to the ADR-0038 shape (1.11.1; legacy keys kept for the alias window, see design.md): `memory.backend` -> `memory.default` + `memory.providers`; `vcs.provider` -> `vcs.default` + `vcs.providers`; flat `platform`/`engine`/`harness` and `SDD_HARNESS` -> `platform.default` / `sdd.default` (resolves #643; coordinate #807)
- [x] S3.2 Existing consumers get the value they effectively run today (env or `.env`, else `claude` / `gentle-ai`); undeclared memory/vcs stay undeclared
- [ ] Read-only aliases for the old keys for one minor, then a refusal with a named fix
- [ ] `env:init` declares or asks for each axis default on a fresh consumer

## S2 one resolver and the refusal (after S3)
- [ ] `resolveAxis` over `lib/axis-selector.mjs` for vcs, memory, platform, sdd; one precedence; retire `resolvePlatform`, `resolveEngine/Harness`, `resolveProviderName` and the `bootstrap.sh` platform resolver
- [ ] Every axis refuses when undeclared or when the value is not a key of `providers`; the refusal names `brain:config -- set <axis>.default`

## sdd.roles (owned by #1132)
- [ ] `sdd.configs` + `sdd.map` -> `sdd.roles` with the ADR-0038 cascade and refusals

## S4 per-offender fixes (other tickets; each deletes its allowlist entry)
- [ ] #1115/#864 memory, day-start, session-start
- [ ] #833 cold-review engine branch and codex/gemini readiness
- [ ] #1107/#1109 VCS spawns and imports
- [ ] day-start engine section (no owner yet, #1114)

## S5 doctrine (ADR-0038)
- [x] Draft ADR-0038 in `brain-drafts/`
- [ ] A human promotes ADR-0038
- [ ] Draft the amendments it names (ADR-0004, ADR-0008, ADR-0023, ADR-0024, ADR-0033); promote after ADR-0038
