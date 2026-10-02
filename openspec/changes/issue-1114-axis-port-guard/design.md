# Design — #1114 S1

- Placement: `brain/scripts/axes/axis-port.guard.test.mjs` and `axis-port.allowlist.mjs`, beside `axes/layout.test.mjs` (the #1141 tree guard). It runs in `npm test`, so it gates CI with no new wiring.
- Method follows `test-spawn-hygiene.test.mjs`: mask first, match after. The literal is masked too, so each rule finds its CODE half in the masked text and reads the LITERAL half from the original at the same offset.
- Masker limits: `maskNonCode` ends a template at its first unescaped backtick, so a template nested in `${}` desyncs it (3 files today). Detection is a bracket-balance check; the fallback `maskNonCodeNested` is local to the guard and keeps `${}` content visible. Not detected: values hidden behind a variable, and literal-array membership.
- Axis values: union of adapter directory names, minus `plain` (it collides with non-axis meanings such as output format).
- Allowlist per file + rule with a frozen `max`, so debt can only shrink. Spawn rules are split by tool because the owners differ (day-start calls gentle-ai and engram).
- Population: measured from the guard's own output (`AXIS_PORT_DUMP`), reasons written per entry.
- Scope calls: provider branching in `vcs/substrate.mjs` and `vcs/lib/normalize.mjs` counts as debt (#1107): the adapter directory is `axes/vcs/adapters/`, and `vcs/` is outside it. `vcs/ci-context.mjs` is `legitimate` (the ADR-0016 seam). Resolver modules produce no hits, so they need no exclusion.
- Known gaps in S1 (not detectable by these rules): `session-start.mjs` calling the engram-only `import` op through a caller-picked allowlist, and `config.platform` being read but undeclared. S3 and #1115 own those.
