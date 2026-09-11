# Tasks: #874 — record first, backend after

## Review Workload Forecast

| Field | Value |
|---|---|
| PR A estimated changed lines | ~900–950 (production ~250, tests ~700) |
| PR B estimated changed lines | ~-1250 to -1560 net (pure deletion) |
| 400-line budget risk | High (both) |
| Chained PRs recommended | Yes |
| Chain strategy | stacked-to-main |
| Delivery strategy | ask-on-risk → resolved to chained, `size:exception` each (R14) |
| Decision needed before apply | Yes — scoped to **O1** only (`dualWriteRecords` disposition); chain shape and size:exception are already ratified |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | PR | Notes |
|---|---|---|---|
| A | Producer path: `save()` mirror + `hydrate()` + unpin | PR A (new sub-ticket, `Part of #874`) | base = `main`; `size:exception` on test volume |
| B | Exporter removal: `share()` reshape + ledger rows 1–5 | PR B (`Closes #874`) | base = A's merge commit on `main` (stacked); `size:exception` as pure deletion |

Each PR ends with exactly one `npm run memory:save -- … --issue <N>` record + one index line; nothing else under `.memory/` is staged (no `manifest.json`, no extra index hydration).

## PR A — sub-ticket, `Part of #874` (create sub-ticket first; commits reference `#<sub-ticket>`)

- [x] A0. Commit the epic tracker's existing uncommitted edits (6.1 rewrite, 4.3–4.10) in `openspec/changes/issue-864-memory-2-0/tasks.md` as PR A's first commit. No test. Commit: `docs(sdd): commit epic tracker edits (6.1, 4.3-4.10)`. Verify: `git diff --stat` (docs only). Rollback: revert commit alone.
- [x] A1. RED: `backends/save-parity.test.mjs` (new, ~120) — one table, both backends, refusal order + record-id parity (R2), engram `_hydrate` stubbed no-op. Commit: `test(memory): add cross-backend save parity table (R2)`. Verify: `node --test brain/scripts/memory/backends/save-parity.test.mjs`. Rollback: delete file.
- [x] A2. GREEN: `backends/engram.mjs` `save()` mirrors `plainfiles.save()` gate order (no hydrate yet); `backends/engram.save.test.mjs` (new, ~260) — happy path, type/issue/actor/supersedes refusals, `_rebuildIndex` throw (#637 rethrow). Test-first: A2 test written before the implementation. Commit: `feat(memory): mirror plainfiles.save() gate order in engram adapter (R1)`. Verify: `node --test brain/scripts/memory/backends/engram.save.test.mjs brain/scripts/memory/backends/save-parity.test.mjs`. Rollback: revert `save()` to `unsupportedOp` stub.
- [x] A3. RED→GREEN: extend `engram.save.test.mjs` with the R10 pair — secret in `content` throws before `_appendRecord`/`_rebuildIndex`/`_engramSave`; call-order log asserts scan→append→hydrate. Commit: `test(memory): re-prove #469 on engram — secret never reaches disk (R10)`. Verify: `node --test brain/scripts/memory/backends/engram.save.test.mjs`. Rollback: revert test additions.
- [x] A4. RED→GREEN: `backends/engram.hydrate.test.mjs` (new, ~180) then `hydrate({root, recordId, record})` in `engram.mjs` — `_engramSave` call shape via `importRecord` (D1), idempotence (R6), binary-absent deferred (D3), guard-contended, unknown-id throws (D4). Commit: `feat(memory): add hydrate({recordId}) single-record upsert (R3/R4/D1/D2/D9)`. Verify: `node --test brain/scripts/memory/backends/engram.hydrate.test.mjs`. Rollback: remove `hydrate` export.
- [x] A5. RED→GREEN: extend `cli.save-search.test.mjs` (~60) first — `MEMORY_BACKEND=engram`, empty `PATH`, exit 0, one record line, one index line, id on stdout, `deferred` on stderr; then wire `save()` to call `hydrate()` as terminal step; add `i18n/en.mjs`/`i18n/es.mjs` `+memory.save.hydrateDeferred`, `+memory.save.hydrateContended`, `+memory.hydrate.recordNotFound`; update `lib/backend-selection.mjs` comment (`FALLBACK_OPS` unchanged). Commit: `feat(memory): call hydrate from save(); surface deferred/contended (R5/D3)`. Verify: `node --test brain/scripts/memory/cli.save-search.test.mjs brain/scripts/memory/backends/engram.save.test.mjs`. Rollback: revert `save()`'s hydrate call and catalog additions together.
- [x] A6. Retire `memory.save.engramUnsupported` (D7): rename+trim `engram.save-search-unsupported.test.mjs` → `engram.search-unsupported.test.mjs` (search-only) first, then delete the key from both catalogs. Commit: `refactor(memory): retire memory.save.engramUnsupported with its call site (D7)`. Verify: `node --test brain/scripts/memory/backends/engram.search-unsupported.test.mjs brain/scripts/memory/i18n/coverage.test.mjs`. Rollback: restore filename + key.
- [x] A7. D8: rewrite `capture-reachable.test.mjs` (:29-60) and `cli.backend-fallback.test.mjs` (:131-145) first (RED) to assert deferred-not-refused/not-pinned, then confirm GREEN against A2–A5. Commit: `test(memory): retarget capture-reachable & backend-fallback to deferred save (D8)`. Verify: `node --test brain/scripts/memory/capture-reachable.test.mjs brain/scripts/memory/cli.backend-fallback.test.mjs`. Rollback: revert both files.
- [x] A8. R7 probe (isolated temp store only, one-off; D9 fail-closed if isolation unprovable). No code change. Record transcript + verdict in `apply-progress.md`. Commit: `docs(sdd): record R7 probe verdict in apply-progress`. Verify: manual — real store path/size/mtime unchanged before/after. Rollback: n/a.
- [x] A9. `brain-drafts/memory-backend-contract.save.draft.md` (new) — R13 draft 1, `save` column + notes. Commit: `docs(sdd): draft contract amendment — save column flip (R13)`. Verify: manual diff against `memory-backend-contract.md:99-105`. Rollback: delete draft.
- [x] A10. LAST: unpin `package.json:65`. Full-suite gate, then write PR A's closing record. Commit: `chore(memory): unpin MEMORY_BACKEND=plainfiles default (R8)`. Verify: `npm test` (both backends green); `npm run memory:save -- "<title>" "<content>" --issue <sub-ticket>` once — parse id from `memory/cli:` stdout, quote in PR body. Rollback: restore `package.json:65` pin.

## PR B — `Closes #874` (base = PR A's merge commit, stacked)

- [ ] B1. Reshape `share()` to the `plainfiles.share()` mirror (D6) and delete row 1 (`_defaultShareExport`, :486-493). Test-first: adjust `engram.share.test.mjs` assertions toward the new shape. **Same commit**: remove the fresh-review F1 `skippedHydrated` gate (`dualWriteRecords`'s `SUPERSEDES_ID_RE`/`topic_key` check, added #924) together with the exporter it protects — once `dualWriteRecords` has no observation source, the gate has nothing left to guard, and the `engram.dualwrite-hydrated-gate.test.mjs` file (#924) retires with it. Commit: `feat(memory): reshape share() to plainfiles mirror; delete row 1 (R11/D6)`. Verify: `node --test brain/scripts/memory/backends/engram.share.test.mjs`. Rollback: revert `share()` body + row 1 restore.
- [ ] B2. Delete row 2 — `_defaultReadObservations` (:273-275) + `collectChunkObservations` import (:61) — **same commit** removes `chunk-boundary.test.mjs:171` allowlist row (bidirectional guard; `cli.mjs:615` and `migrate-v1.test.mjs:13` rows stay). Commit: `refactor(memory): delete row 2 — _defaultReadObservations; retire chunk-boundary allowlist row`. Verify: `node --test brain/scripts/memory/chunk-boundary.test.mjs`. Rollback: restore import + allowlist row together.
- [ ] B3. Row 3 — `dualWriteRecords` (:333-~485) disposition per design's O1 default **(c)**: no deletion, seam already unused by `share()` after B1; audit `engram.upstream-scope.test.mjs`, `engram.duplicates.test.mjs:46-65`, `cli.upstream-config.test.mjs` stay green untouched. **[maintainer decision pending — O1; if ruled (a) delete or (b) keep-with-seam-removed, apply redirects this task.]** Commit: `docs(sdd): record O1 disposition — dualWriteRecords kept, handed to 2.4`. Verify: `node --test brain/scripts/memory/backends/engram.upstream-scope.test.mjs brain/scripts/memory/backends/engram.duplicates.test.mjs brain/scripts/memory/cli.upstream-config.test.mjs`. Rollback: n/a (no production change).
- [ ] B4. Row 5 — delete the 1069-line `engram.share.test.mjs`; add the ~90-line replacement modelled on `plainfiles.share.test.mjs`, with a source guard (`share.toString()` matches none of `requireEngram`, `_export`, `_readObservations`, `dualWriteRecords`) and `_ensureSymlink` retained (R12). Commit: `test(memory): replace engram.share.test.mjs with plainfiles-mirror assertions (R11/R12, row 5)`. Verify: `node --test brain/scripts/memory/backends/engram.share.test.mjs`. Rollback: restore prior file.
- [ ] B5. Row 4 LAST: re-run A's R10 (#469) pair as the pre-flight proof, then delete `_defaultChangedChunkFiles` (:578-609), `assertExportDestinationIsRead` (:653-670), `scrubMaterializedChunks` (:686-710). Commit: `refactor(memory): delete row 4 — chunk scrub subsystem, citing A's #469 pair (R10)`. Verify: `node --test brain/scripts/memory/backends/engram.save.test.mjs` (A's R10 pair, re-run) then `npm test`. Rollback: restore the three functions.
- [ ] B6. `brain-drafts/memory-backend-contract.rule2.draft.md` (new) — R13 draft 2, rule 2 `not yet` → `yes`; rule 3 stays `not yet`. Commit: `docs(sdd): draft contract amendment — rule 2 flip (R13)`. Verify: manual diff against contract `:99-105, :61`. Rollback: delete draft.
- [ ] B7. Full-suite gate under `MEMORY_BACKEND=plainfiles` and `=engram`; write PR B's closing record. Commit: none (verification + record only). Verify: `npm test` both backends; `npm run memory:save -- "<title>" "<content>" --issue 874` once — parse id, quote in PR body naming A's merge commit. Rollback: n/a.
- [ ] B8. fresh-review F6 (#924, cold review of PR A): `composeSource()` (`lib/capture-provenance.mjs:130`) hardcodes `"plainfiles save on {host}"` as a record's `source` prefix regardless of which backend actually ran — an engram-backed capture's `source` field misleadingly reads "plainfiles save on `<host>`". Harmless today (`source` is excluded from `computeRecordId`'s hash, format.mjs), but B already touches the engram adapter, so fix it here rather than leave a signpost pointing at the wrong backend. Thread the backend name into `composeSource()` (or its caller in each backend's `save()`) so the string names the backend that ran. Test-first: a `composeSource`/`save()` unit test asserting the engram path's `source` says "engram", not "plainfiles". Commit: `fix(memory): composeSource() names the backend that actually ran (F6)`. Verify: `node --test brain/scripts/memory/lib/capture-provenance.test.mjs brain/scripts/memory/backends/engram.save.test.mjs brain/scripts/memory/backends/plainfiles.save.test.mjs`. Rollback: revert `composeSource()` + call sites.

## Rules honored

- Agents never edit `brain/core/**` — R13 drafts live under `brain-drafts/` only, promoted later by the maintainer via `brain:promote`.
- No test invokes the real `engram` binary against a real store (temp dirs + fake seams only), except A8's isolated one-off probe.
- Each PR stages exactly one new record + one index line; `.memory/manifest.json` is never staged.
