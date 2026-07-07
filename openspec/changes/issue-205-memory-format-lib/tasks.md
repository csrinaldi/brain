# Tasks — Durable Memory Format Library (slice C1)

## C1a — format lib + reindex + degenerate states (delivered, this apply)

- [x] 1.1 RED: `format.test.mjs` — `canonicalJson`, `computeRecordId`, `buildRecord`,
  `validateRecord`, `serializeRecord`/`parseRecordLine`, `buildIndexEntry`, `serializeIndex`.
- [x] 1.2 GREEN: `brain/scripts/memory/lib/format.mjs` — pure record builder/validator
  (R1/R2/R3 code-pins).
- [x] 2.1 RED: `store.test.mjs` — `appendRecord`, `rebuildIndex` incl. degenerate states
  (absent/empty `records/`, corrupt-line fail-closed, legacy-chunks non-interference) and the
  delete-index-reindex property test.
- [x] 2.2 GREEN: `brain/scripts/memory/lib/store.mjs` — thin I/O over `format.mjs`.
- [x] 3.1 `memory:reindex` CLI subcommand in `brain/scripts/memory/cli.mjs` (backend-agnostic
  dispatch) + `memory:reindex` npm script.
- [x] 3.2 i18n: `memory.reindex.done` / `memory.reindex.failed` keys in `en.mjs` + `es.mjs`,
  routed via `t()`.
- [x] 4.1 RED→GREEN: `records-merge.integration.test.mjs` — real temp git repo, two branches,
  distinct records, real `git merge`, asserts conflict-free union + clean reindex (REQ-MF-3 CP-C1
  evidence).
- [x] 5.1 Verify `npm test`, `npm run brain:repo:check`, `npm run brain:nav` all green.
- [x] 5.2 Line-count check: ~325 counted lines (format.mjs 211 + store.mjs 73 + cli.mjs diff 32 +
  i18n 8 + package.json 1), under the 400 budget — no further split needed within C1a.

## C1b — secret-scrub + config + `.gitattributes` (deferred, follow-up apply)

- [ ] 6.1 RED: secret-scrub unit tests — fails closed on each default pattern (PAT, `glpat-`,
  AWS key, private-key header) + a configured custom pattern; the allowlist suppresses a
  documented false positive; clean input passes.
- [ ] 6.2 GREEN: fail-closed secret scan wired into `memory:share`'s newly-materialized records
  only (never the whole store); error message names the matched pattern + location.
- [ ] 7.1 `0.5.0` additive migration in `brain/core/config-migrations.mjs` for
  `governance.memorySecretPatterns` (defaults) and `governance.memorySecretAllowPatterns`
  (empty default); drift-guard test if a constant elsewhere mirrors the same pattern list.
- [ ] 8.1 Append `.memory/records/*.jsonl merge=union` to the repo's `.gitattributes` (append,
  do not recreate the file).
- [ ] 8.2 Confirm `brain/core/managed-paths.mjs` already lists `.gitattributes` as managed (it
  does — verified during C1a; no change required there).
