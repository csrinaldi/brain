# Design — #1114 S1

- Placement: `brain/scripts/axes/axis-port.guard.test.mjs` and `axis-port.allowlist.mjs`, beside `axes/layout.test.mjs` (the #1141 tree guard). It runs in `npm test`, so it gates CI with no new wiring.
- Method follows `test-spawn-hygiene.test.mjs`: mask first, match after. The literal is masked too, so each rule finds its CODE half in the masked text and reads the LITERAL half from the original at the same offset.
- Masker limits: `maskNonCode` ends a template at its first unescaped backtick, so a template nested in `${}` desyncs it (3 files today). Detection is a bracket-balance check; the fallback `maskNonCodeNested` is local to the guard and keeps `${}` content visible. Not detected: values hidden behind a variable, and literal-array membership.
- Axis values: union of adapter directory names, minus `plain` (it collides with non-axis meanings such as output format).
- Allowlist per file + rule with a frozen `max`, so debt can only shrink. Spawn rules are split by tool because the owners differ (day-start calls gentle-ai and engram).
- Population: measured from the guard's own output (`AXIS_PORT_DUMP`), reasons written per entry.
- Scope calls: provider branching in `vcs/substrate.mjs` and `vcs/lib/normalize.mjs` counts as debt (#1107): the adapter directory is `axes/vcs/adapters/`, and `vcs/` is outside it. `vcs/ci-context.mjs` is `legitimate` (the ADR-0016 seam). Resolver modules produce no hits, so they need no exclusion.
- Known gaps in S1 (not detectable by these rules): `session-start.mjs` calling the engram-only `import` op through a caller-picked allowlist, and `config.platform` being read but undeclared. S3 and #1115 own those.

# Design — S2 onward: ADR-0038 (maintainer rulings, 2026-10-02)

The target shape and the slice order are fixed by `brain-drafts/adr-0038-one-config-shape-per-axis-default-and-providers.md`. Summary for this change:
- Four axes, `vcs`, `memory`, `platform` and `sdd`, each `{ default, providers: { <name>: { version, … } }, …axis config }` in `brain.config.json`. `default` must be a key of `providers`.
- One `resolveAxis` over `lib/axis-selector.mjs`: process env > `.env` > `<axis>.default` > undeclared. Every axis refuses when undeclared, so the `claude` and `gentle-ai` code defaults go away. The refusal names `npm run brain:config -- set <axis>.default <name>`.
- `sdd.roles.<stage>` = `{ agent: "<sdd provider>:<role>", engine: "<platform provider>", model }`, cascading to `sdd.default`'s role, `platform.default` and the engine's own model. #1132 implements the `sdd.configs` + `sdd.map` reshape.
- Slice order changes: **S3 before S2.** S3 writes each existing consumer's effective value into the new keys (ADR-0026 Am8 pattern, with read-only aliases for one minor). S2's refusal then fires only where nothing was ever chosen.
- S5 is no longer "ADR-0024 Amendment 3" (that number is taken by #1165). It is ADR-0038 plus the amendments it names to ADR-0004, ADR-0008, ADR-0023, ADR-0024 and ADR-0033, each drafted separately and promoted after ADR-0038.
