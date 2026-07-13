# Tasks — Secret Scrub + Id-Integrity Hardening (slice C1b)

> Completes [issue-205-memory-format-lib/tasks.md](../issue-205-memory-format-lib/tasks.md)
> §"C1b" (tasks 6.1–8.2, now checked off there and consolidated here) plus id-integrity
> hardening, the `index.jsonl` rename, and the C0 doc-sync discovered while closing them.

## 1. Secret scrub (REQ-SCRUB-1, REQ-SCRUB-2)

- [x] 1.1 RED: `secret-scrub.test.mjs` — `compilePatterns`, `resolveSecretConfig` (additive
  merge), `scanTextForSecrets` (each default pattern + allowlist suppression + non-suppression of
  an unrelated line), `scrubChunkFile` (real gzip fixture, no engram dependency).
- [x] 1.2 GREEN: `brain/scripts/memory/lib/secret-scrub.mjs` — pure scanner + default patterns.
- [x] 1.3 RED: `engram.share.test.mjs` — `scrubMaterializedChunks` orchestration (no changed
  chunks, clean chunk, secret hit fails closed, default/consumer patterns reach `_scrubChunk`,
  scans every changed chunk) and `share()` end-to-end wiring (order of seams, fail-closed
  propagation, no `--no-scrub`-style bypass).
- [x] 1.4 GREEN: wire `scrubMaterializedChunks` into `backends/engram.mjs#share()` — after
  `engram sync --export`, scan `git status`-reported changed `.memory/chunks/*.jsonl.gz` files.
- [x] 1.5 i18n: `memory.share.secretFound` key in `en.mjs` + `es.mjs`, routed via `t()`.

## 2. Id-integrity hardening (REQ-ID-1)

- [x] 2.1 RED: `store.test.mjs` — a tampered `id` fails closed with `file:line`; a legitimate
  `buildRecord`-produced record (title folded, optional `issue`) never false-positives.
- [x] 2.2 GREEN: `store.mjs#rebuildIndex` recomputes `id` via `format.mjs#computeRecordId` and
  throws on mismatch, same `file:line` convention as the existing corrupt-line path.

## 3. Config migration + drift guard (REQ-CFG-1)

- [x] 3.1 `0.5.0` additive migration in `config-migrations.mjs`:
  `governance.memorySecretPatterns` (defaults) + `governance.memorySecretAllowPatterns` (empty
  default).
- [x] 3.2 Tests in `installer.test.mjs`: adds-when-missing, idempotent, preserves a consumer-set
  allowlist, and a drift guard asserting the migration defaults `deepEqual`
  `secret-scrub.mjs#DEFAULT_SECRET_PATTERNS`.
- [x] 3.3 Ripple fix: `brain-config.test.mjs`'s hardcoded latest-`schemaVersion` expectation
  (`0.4.0` → `0.5.0`), since `ensureBrainConfig` now migrates fresh configs to the new latest.

## 4. `.gitattributes` (REQ-GA-1)

- [x] 4.1 Append `/.memory/records/*.jsonl merge=union` to the repo's `.gitattributes` (appended,
  not recreated) — git's built-in `union` driver, no per-clone registration.
- [x] 4.2 Single-source the literal as `managed-paths.mjs#RECORDS_UNION_MERGE_GITATTRIBUTES_LINE`
  + a drift-guard test in `managed-paths.test.mjs` reading the real `.gitattributes` file.

## 5. `index.json` → `index.jsonl` rename (REQ-RENAME-1)

- [x] 5.1 `cli.mjs` — the actual generated path (`.memory/index.jsonl`).
- [x] 5.2 `store.mjs`, `format.mjs` — comments/docstrings.
- [x] 5.3 `store.test.mjs`, `records-merge.integration.test.mjs` — test-local path literals.
- [x] 5.4 `issue-205-memory-format-lib/spec.md` + `design.md` — C1a spec/design refs (+ a
  rename note in spec.md).
- [x] 5.5 C0 drafts (`brain-drafts/memory-format.md`, `brain-drafts/adr-0017-...md`) — every
  `index.json` mention.

## 6. C0 doc-sync — union-exclusion rationale correction

- [x] 6.1 `brain-drafts/memory-format.md` — corrected: the index is excluded from `merge=union`
  because reindex replaces/reorders its lines (not because it is "a single JSON object", which
  the R1 JSONL pin already contradicted).
- [x] 6.2 `brain-drafts/adr-0017-memory-format-owned-by-brain.md` — same correction, plus an
  amended date/status note recording the C1b amendment for the human promotion gate.

## 7. Verification

- [x] 7.1 `npm test` — 951/951 passing (including all new/modified suites).
- [x] 7.2 `npm run brain:repo:check` — green.
- [x] 7.3 `npm run brain:nav` — green.
- [x] 7.4 i18n coverage test (`coverage.test.mjs`) — green (es/en parity holds generically).
- [x] 7.5 Line-count check: see apply-progress for the counted diff and budget comparison.
