---
status: applying
issue: 879
---

# Tasks — #879

```brain-slice-scope/1
{"slice": 1, "claims": ["R879-1", "R879-2", "R879-3", "R879-4", "R879-5", "R879-6", "R879-7", "R879-8"], "terminal_pr": "this PR -> main"}
```

- [x] T1. `adr-index.mjs`: `parseAdr`, `readAdrIndex`, `homeAdrList`, `adrDrift`;
      `ADR_LINE_RE` exported from `home-index.mjs`. Tests: an amended ADR, a
      superseded one, an unreadable one kept in place, drift both ways (R879-3, R879-7).
- [x] T2. `anti-patterns.mjs`: `parseAntiPattern`, `readAntiPatterns`. Tests: both
      scopes, README excluded, `#N`/`ISSUE-N` citations, absent project dir reported (R879-4).
- [x] T3. `snapshot.mjs`: `readChanges`, `roadmapState`, `aggregateActors`,
      `projectRecord`, `buildSnapshot`. Tests: every section's failure shape, the
      three roadmap states and the unreadable-PRs case, the actor aggregation,
      a change without `tasks.md`, a port whose writes throw (R879-1, R879-2,
      R879-5, R879-6, R879-8).
- [x] T4. `snapshot-cli.mjs` + `package.json` `brain:snapshot`. `--json`, text
      mode, `--now`. Parity test: spawned verb vs in-process module, deep-equal (R879-1).
- [x] T5. `brain:repo:check`, `brain:nav`, full suite, `brain:change:verify` green.

## Micro-decisions

- `MANAGED_SCRIPT_KEYS` untouched — #922 owns that audit (design, Contract impact).
- `issueRelations` not read in this slice — two calls per issue; #881's poller
  owns its budget (D4).
