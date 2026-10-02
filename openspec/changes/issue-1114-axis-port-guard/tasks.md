# Tasks — #1114

## S1 guard (this slice)
- [x] Guard test first: scanner unit tests, allowlist validation tests, tree scan (red with an empty allowlist)
- [x] Measure offenders with `AXIS_PORT_DUMP`, populate the allowlist with owner and reason per entry
- [x] Mutation: fake offender file and a new line in an allowlisted file fail the guard
- [x] Mutation: removed entry (uncovered) and added entry (stale) fail the guard
- [x] `npm test` and `npm run brain:repo:check`

## S2 one resolver
- [ ] `lib/axis-registry.mjs` + `resolveAxis`; migrate platform, engine/harness, vcs resolvers; ruling on defaults first

## S3 schema
- [ ] Migration declaring `platform` and `sdd.engine`; resolve #643; coordinate #807

## S4 per-offender fixes (other tickets; each deletes its allowlist entry)
- [ ] #1115/#864 memory, day-start, session-start
- [ ] #833 cold-review engine branch and codex/gemini readiness
- [ ] #1107/#1109 VCS spawns and imports
- [ ] day-start engine section (no owner yet, #1114)

## S5 ADR-0024 Amendment 3
- [ ] Draft in `brain-drafts/`; a human promotes it
