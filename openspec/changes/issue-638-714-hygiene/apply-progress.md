# Apply progress — issue-638-714-hygiene

Strict TDD mode active. Test runner: `node --test` (focused), `npm test`
(full suite). All runs prefixed `GIT_CONFIG_GLOBAL=/dev/null`.

## #714 — both test-count runs (the trap check)

| Run | `BRAIN_MEMORY_UPSTREAM_REF` | Before fix | After fix |
|---|---|---|---|
| Full suite | unset | 5277/5277 pass | 5277/5277 pass |
| Full suite | `origin/leaked` | **5269/5277 pass, 8 fail** | 5277/5277 pass |

The issue reported 4 failures; measured 8 at HEAD of this branch — the suite
grew a new file (`cli.save-search.test.mjs`) and a new integration file
(`supersedes.integration.test.mjs`) since the issue was filed, both with the
same defect shape. Both directions are now proven equal, not just the
env-unset side (the trap the ticket names explicitly: "a test that neutralises
the variable by reading it and ignoring it is not the same as a test that
proves the code no longer depends on it"). This fix used real neutralisation
(`withoutEnv`, `env: {}`, spawn-env stripping), not a swallow — confirmed by
the mutation table below, which shows each fix's absence turns its own
test(s) red under the polluted env.

## TDD Cycle Evidence — #714

| Test file | RED (polluted env, before fix) | GREEN (after fix) | REFACTOR |
|---|---|---|---|
| `lib/upstream-records.integration.test.mjs` | 1 fail | pass | promoted `withoutEnv` import |
| `lib/supersedes.integration.test.mjs` | 3 fail | pass | 3× `withoutEnv(t, ...)` added |
| `staged-records-check.integration.test.mjs` | 3 fail | pass | 3× `env: {}` added |
| `cli.save-search.test.mjs` | 1 fail | pass | stripped var at spawn-env snapshot site |

`backends/engram.upstream-scope.test.mjs` — refactor only (import
`withoutEnv` from the new shared fixture instead of a local definition); no
behaviour change, 12/12 pass before and after.

## Mutation table — #714 (revert one file's fix, confirm exactly its own test(s) go red)

| Reverted | Result under polluted env | Expected |
|---|---|---|
| `lib/upstream-records.integration.test.mjs` | 0 pass / 1 fail (of 1) | matches |
| `lib/supersedes.integration.test.mjs` | 3 pass / 3 fail (of 6) | matches |
| `staged-records-check.integration.test.mjs` | 8 pass / 3 fail (of 11) | matches |
| `cli.save-search.test.mjs` | 11 pass / 1 fail (of 12) | matches |

1+3+3+1 = 8, matching the measured full-suite failure count. Each file's
fix independently accounts for exactly its own test(s) — no fix depends on
another to pass.

## Other ambient variables found (reported, not fixed — out of scope for #714)

Searched `process.env.*` reads and `env = process.env` default-param shapes
across `scripts/**/*.mjs` (excluding `.test.mjs`). The same defect SHAPE
(a production function defaults its whole `env` object to `process.env`,
deliberately, as an escape hatch) recurs at:

- `scripts/brain-check.mjs` — `getDefaultBranch`/`getTargetBranch`
  (`DEFAULT_BRANCH`, `CI_COMMIT_BRANCH`, `CI_DEFAULT_BRANCH`).
- `scripts/vcs/cli.mjs#resolveProviderName`, `scripts/vcs/substrate.mjs#detectSubstrate`
  (`VCS_TOKEN`, provider detection).
- `scripts/harness/cli.mjs` (`resolveEngine`/`resolveMemory`/`resolveHarness`)
  and `scripts/harness/platform.mjs#resolvePlatform`.
- `scripts/harness/backends/agent-runtime.mjs`, `scripts/harness/backends/claude.mjs`.
- `scripts/brain-governance-status.mjs`.
- `scripts/lib/env-read.mjs`.

None of these were verified test-by-test for whether their own suites already
neutralise the ambient variable (that would be its own audit) — flagged as a
candidate follow-up ticket, not fixed here. #714 itself only asked for a
report on this.

## #638 — TDD Cycle Evidence

| Step | RED | GREEN |
|---|---|---|
| Convert `formatDuplicateReport` to `async`, before updating callers/tests | `duplicates.test.mjs`: 7 pass / 11 fail (18 total) | — |
| Update `duplicates.test.mjs` to `await` | — | 18/18 pass |
| `cli.mjs#reportDuplicates` + 7 call sites to `async`/`await` | (would have silently truncated stderr output — see mutation table) | full suite green |

## Mutation table — #638

| Reverted | Result | Expected |
|---|---|---|
| `en.mjs` `memory.duplicates.*` keys removed | `duplicates.test.mjs`: 9 pass / 9 fail (of 18) | matches — every assertion touching translated prose breaks |
| `es.mjs` `memory.duplicates.*` keys removed | `coverage.test.mjs`: 46 pass / 1 fail (of 47) | matches — only the en/es parity test |
| `await` dropped at the `reindex` op's `reportDuplicates` call in `cli.mjs` | `cli.reindex-duplicates.test.mjs`: 5 pass / 2 fail (of 7) | matches — `process.exit(0)` fires before the async report resolves, truncating stderr |

## Spanish-rendering proof (acceptance criterion, not covered by existing regex assertions)

`duplicates.test.mjs` asserts against English regexes only (the default
locale). Verified the `es` path separately via `translate()` against both
catalogs:

```
en summary: ⚠ 1 duplicate record id(s) in .memory/records/ — 1 excess physical line(s) collapsed into the index.
es summary: ⚠ 1 id(s) de registro duplicado(s) en .memory/records/ — 1 línea(s) física(s) excedente(s) colapsada(s) en the index.
es divergent:   2 de ellos DISCREPAN fuera de los campos hasheados (`source` no está hasheado, ...) ...
```

English bytes match the pre-change literals exactly; Spanish is present and
distinct — no dropped translation.

## Commits (this apply batch)

1. `test(memory): npm test's verdict no longer depends on BRAIN_MEMORY_UPSTREAM_REF (#714)` —
   `scripts/memory/__fixtures__/env.mjs` (new), `backends/engram.upstream-scope.test.mjs`,
   `lib/upstream-records.integration.test.mjs`, `lib/supersedes.integration.test.mjs`,
   `staged-records-check.integration.test.mjs`, `cli.save-search.test.mjs`.
2. `fix(i18n): promote duplicates.mjs's operator strings to the memory.duplicates.* catalogs (#638)` —
   `i18n/en.mjs`, `i18n/es.mjs`, `memory/lib/duplicates.mjs`, `memory/lib/duplicates.test.mjs`, `memory/cli.mjs`.
3. `docs(sdd): issue-638-714-hygiene proposal/spec/design/tasks; tick epic 4.4/4.5` —
   `openspec/changes/issue-638-714-hygiene/**`, `openspec/changes/issue-864-memory-2-0/tasks.md`.
4. Record-first closing commit via `npm run memory:save` (id + files recorded once produced).

## Full suite, final state

`GIT_CONFIG_GLOBAL=/dev/null npm test` → 5277/5277, both with
`BRAIN_MEMORY_UPSTREAM_REF` unset and exported to `origin/leaked`.

## Not done / deferred

- The broader ambient-env audit above (candidate follow-up ticket, not filed here).
- #638's own "decide the inline-vs-catalog rule for the rest of the tree"
  question — explicitly deferred by the issue itself to a separate decision.
- No `openspec/changes/issue-557-openspec-archive-sweep/apply-progress.md`
  work touched — unrelated, pre-existing untracked file noted in git status
  at session start, left alone.
