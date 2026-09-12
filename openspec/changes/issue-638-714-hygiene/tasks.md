# Tasks — issue-638-714-hygiene

## #714 — env-independent suite verdict

- [x] 1.1 Reproduce RED under `BRAIN_MEMORY_UPSTREAM_REF=origin/leaked npm test` (measured 8 failures, up from the issue's 4 — repo grew tests since filing).
- [x] 1.2 Promote `withoutEnv` from `engram.upstream-scope.test.mjs` into shared fixture `scripts/memory/__fixtures__/env.mjs`.
- [x] 1.3 `lib/upstream-records.integration.test.mjs` — add `withoutEnv(t, 'BRAIN_MEMORY_UPSTREAM_REF')`.
- [x] 1.4 `lib/supersedes.integration.test.mjs` — add `withoutEnv` to the 3 tests exercising the real `_upstreamRecordEntries` predicate via `--supersedes`.
- [x] 1.5 `staged-records-check.integration.test.mjs` — add `env: {}` to the 3 call sites lacking it (consistent with the file's own later pattern).
- [x] 1.6 `cli.save-search.test.mjs` — strip `BRAIN_MEMORY_UPSTREAM_REF` at the same destructuring site that already strips `AI_AGENT` for spawned CLI children.
- [x] 1.7 Prove both directions: focused run + full `npm test`, env unset and env exported. Both 5277/5277.
- [x] 1.8 Mutation-test each of the 4 fixed files independently (revert one, confirm only its own test(s) go red).
- [x] 1.9 Sweep for other ambient env vars with the same shape (`env = process.env` default) — reported in apply-progress, not fixed.

## #638 — i18n catalog promotion

- [x] 2.1 Design `memory.duplicates.*` keys reproducing the exact English bytes (summary / summaryWithIndex / why / divergent / brief / group / groupDivergent / moreOccurrences / moreGroups / unknownId).
- [x] 2.2 Add keys to `en.mjs` and `es.mjs`.
- [x] 2.3 Rewrite `duplicates.mjs#formatDuplicateReport` as `async`, using `t()`.
- [x] 2.4 Update `cli.mjs#reportDuplicates` and its 7 call sites to `async`/`await`.
- [x] 2.5 Update `duplicates.test.mjs` (18 tests) to `await formatDuplicateReport(...)`.
- [x] 2.6 Verify: `es` locale renders Spanish (manual `translate()` probe against both catalogs), `en` output unchanged byte-for-byte, `coverage.test.mjs` parity stays green.
- [x] 2.7 Mutation-test: removing the `en.mjs` keys breaks `duplicates.test.mjs` (9/18 red); removing the `es.mjs` keys breaks only the parity test (1/47 red); dropping `await` at a `cli.mjs` call site breaks only `cli.reindex-duplicates.test.mjs` (2/7 red).

## Closing

- [x] 3.1 Full `npm test` green (5277/5277) after all fixes, both env states for #714.
- [x] 3.2 Tick epic tasks 4.4/4.5 in `openspec/changes/issue-864-memory-2-0/tasks.md`.
- [x] 3.3 `apply-progress.md` with commit list, mutation table, both #714 count runs.
- [x] 3.4 Engram save (`sdd/issue-638-714-hygiene/apply-progress`).
- [x] 3.5 Record-first closing commit (`npm run memory:save`), stage exactly the new record + `.memory/index.jsonl`.
