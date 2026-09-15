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

## Cold review response (F1/F2/F3, branch `fix/issue-638-714-hygiene`)

A fresh adversarial review of this branch returned SHIP with two MEDIUM
findings and one LOW. Answered without touching `brain/core/**` or
`brain/project/**`, without any push/PR/`gh` write, and without staging
`.memory/index.jsonl`/`.memory/manifest.json` (commit `6df58c8f` — the
record commit — is untouched).

### F1 (MEDIUM) — three of the four unguarded `await reportDuplicates` sites, honestly

The review named four unguarded call sites in `cli.mjs`: `:224`
(resolve-index), `:297` (split-records), `:362` (collect), `:938` (the
generic backend dispatch, e.g. `import`/`share`/`pull`).

- **`:297` (split-records) and `:362` (collect) — genuinely raced, now
  guarded.** Both call `process.exit(0)` immediately after
  `await reportDuplicates(...)`; dropping the `await` there races the exit
  and drops every report line. Added one CLI-level test per site
  (`cli.split-records-duplicates.test.mjs`, a new duplicate-candidate
  fixture in `cli.collect.test.mjs`). Both are RED with the `await`
  dropped and GREEN restored — see the mutation table below.
- **`:224` (resolve-index) — genuinely NOT drivable at the CLI level
  without inventing a seam.** `resolveIndex({ repoRoot })` itself takes an
  injectable `repoRoot` (that is how `resolve-index.integration.test.mjs`
  already drives it, at the function level). But `cli.mjs`'s own
  `resolve-index` dispatch hardcodes `repoRoot` to the CLI script's own
  real checkout location — unlike `reindex`/`split-records`/`collect`/
  `save`/`search`, it never reads `BRAIN_MEMORY_TEST_ROOT`. Spawning
  `cli.mjs resolve-index` in any test would therefore run against THIS
  repo's real `.memory/index.jsonl`, which the task's own hard constraints
  forbid. Wiring a test-root seam into that dispatch would fix the
  testability gap, but it is a production behavior change to a
  doctrine-fixed, merge-conflict-resolution code path (adr-0017), not a
  test — out of scope to invent under review pressure, and not attempted.
  The file's own `split-records` comment already flags this exact gap as
  `#633/T11`. The race is still real in principle (`process.exit(0)` at
  cli.mjs:225 follows the same shape as the two guarded sites) — left
  unguarded, documented, and reported rather than silently claimed fixed.
- **`:938` (generic dispatch) — MEASURED to not race at all.** This block
  (covers `share`, `pull`, `import`, `setup`, etc.) never calls
  `process.exit(0)` on success — only `process.exit(1)` in its `catch`.
  Dropping the `await` there and running the full suite (both directly and
  via `cli.reindex-duplicates.test.mjs`'s existing `share` duplicate-report
  test, which already exercises this exact line) left everything green:
  Node's event loop stays alive until the unawaited promise settles,
  because nothing calls `process.exit()` afterward. Verified empirically
  before writing anything — a test asserting a defect that measurably does
  not exist here would have been exactly the kind of paper-over F1 warns
  against. No test added for this site; no fix needed.

**Mutation table — F1 (drop the `await`, confirm RED; restore, confirm GREEN):**

| Site | Test file | Before fix existed | RED (await dropped) | GREEN (restored) |
|---|---|---|---|---|
| `:297` split-records | `cli.split-records-duplicates.test.mjs` | n/a (new test) | 0/1 pass | 1/1 pass |
| `:362` collect | `cli.collect.test.mjs` | 8/9 pass (new test not yet added) | 8/9 pass, new test fails | 9/9 pass |
| `:224` resolve-index | — | — | not drivable at CLI level (see above) | — |
| `:938` generic dispatch | `cli.reindex-duplicates.test.mjs` (existing `share` test) | 7/7 pass | 7/7 pass — no regression, confirms no race | 7/7 pass |

### F2 (MEDIUM) — Spanish content for `memory.duplicates.*`, now pinned

Added `scripts/memory/lib/duplicates.i18n.test.mjs`: one `translate()`-based
test per rendering family (`summary`/`summaryWithIndex`, `why`,
`divergent`, `brief`, `moreOccurrences`/`moreGroups`, `unknownId`) —
matched on a distinctive Spanish phrase, not twelve brittle full-string
equalities, mirroring `cli.ship.test.mjs` / `plainfiles.save-index-
failure.test.mjs` / `coverage.test.mjs`'s own `translate()` precedent.

`group`/`groupDivergent` are the one pair left without a content
assertion: `es.mjs` and `en.mjs` are byte-identical there by design (only
`{id}`/`{count}`/`{locations}` placeholders and the untranslated
`[divergent]` marker — no prose to mistranslate). Asserted instead as a
documented exception plus interpolation correctness.

**Mutation proof:** corrupted `es.mjs`'s `memory.duplicates.why` value to
`'TOTALLY WRONG TEXT'` → 6 pass / 1 fail (of 7, this file only) → restored
→ 7/7 pass again.

### F3 (LOW) — the closing record names only #714; the format cannot carry two

`rec-3550472a1b62c33b` (commit `6df58c8f`, untouched — no rewrite, no
second record added) carries `"issue":714` only, though the branch also
closes #638. Checked `format.mjs`'s own schema (W2): `issue` MUST be a
single finite integer `number`, and it is part of `computeRecordId`'s hash
input — there is no array/list form. **The record format cannot carry two
issues at all.** This is a format limitation worth stating as its own
finding, not a defect in this specific record or something to silently
work around (e.g. by picking one of the two arbitrarily, or splicing a
second number into the string) — a real fix would be a schema change
(multi-issue support, or a second `record`) affecting the hash and every
existing consumer, well beyond this hygiene batch's scope.

## Not done / deferred

- The broader ambient-env audit above (candidate follow-up ticket, not filed here).
- #638's own "decide the inline-vs-catalog rule for the rest of the tree"
  question — explicitly deferred by the issue itself to a separate decision.
- No `openspec/changes/issue-557-openspec-archive-sweep/apply-progress.md`
  work touched — unrelated, pre-existing untracked file noted in git status
  at session start, left alone.
