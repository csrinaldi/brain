# Spec: local gates equal CI gates (#1186, #1187)

- REQ-1 (#1186): `brain:check` resolves the project slug from `brain.config.json` `project.slug`, else the origin remote, and passes it as `ctx.repo`. The port is never asked about `undefined`.
- REQ-2 (#1186): the default branch resolves from `DEFAULT_BRANCH`, then recorded `origin/HEAD`, then `ls-remote --symref origin HEAD`, with no `git remote set-head`. The resolver never writes to the repo. Unresolvable is `null`, reported UNVERIFIED; never `main`. The diff base and `brain:ship`'s PR base use the same answer.
- REQ-3 (#1187): every check that has a CI gate reaches the verdict CI's `main()` reaches for the same inputs, at every tier: `run-check.mjs#runCheckWithPolicy` is the single composition. At `lite`, `memory-gate` is a `::warning::` pass naming the tier; at `standard`/`regulated` the same evidence blocks.
- REQ-4 (#1187): `npm test` runs locally only where CI runs it (`.brain-source` present) and a `test` script exists. Otherwise the output says `[N/A] npmTest — <reason>` and exit is unaffected.
- REQ-5: every local check names its CI counterpart in `CI_COUNTERPART`; `null` means "no CI counterpart" and is printed as such. All entries are members of `GOVERNANCE_JOBS`.
- REQ-6: on a fresh consumer (`lite`, no records, `origin/HEAD` unset, `npm init` test script), `brain:ship` from a `{type}/issue-{N}-{slug}` branch passes its local gates and calls `mrCreate`.

## Scenarios
- Fresh consumer, `lite`: `[PASS] issueLink`, `[PASS] memoryPresence — ::warning::... (tier: lite)`, `[N/A] npmTest`, PR opened.
- Same consumer at `standard`: `[FAIL] memoryPresence`, zero remote writes.
- No remote reachable and no `origin/HEAD`: `issueLink` UNVERIFIED with its own reason; exit 0 from `brain:check`, as before (#340).

## Addendum (PR #1192 review)
- REQ-7: `brain:check` runs every `run:` step of each CI job it claims to front-run: for `local-checks`, `brain:repo:check`, `brain:nav`, `memory/index-lag.mjs` (warning-only, never fails) and the conditional `npm test`. `CI_STEPS_COVERED` lists them and `local-ci-parity.test.mjs` derives each mapped job's steps from `governance.yml`, so a new CI step fails the test until `brain:check` runs it.
