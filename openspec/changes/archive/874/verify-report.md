---
status: verified
issue: 874
verdict: PASS
---

# Verify Report: #874 — record first, backend after

Measured on branch `docs/issue-874-archive` at `56de7408` (origin/main), after
PR A (`8e1e8bc7`, #925) and PR B (`56de7408`, #926) both merged, issue #874 closed.

## Spec scenario compliance (all measured at runtime, `node --test`)

| Scenario | Evidence | Result |
|---|---|---|
| Durable before backend | `engram.mjs:1023` (`_appendRecord`) + `:1031` (`_rebuildIndex`) run BEFORE `:1046` (`_hydrate`); `hydrate()` never throws past D4 (`:1130-1198` probe/guard/try-catch all return `deferred`). `engram.save.test.mjs` 13/13, `engram.hydrate.test.mjs` 9/9 | PASS |
| Deferred never loses a capture | `save()` (`engram.mjs:1046-1057`) builds its return unconditionally from `hydrateResult`; a hydrate failure never propagates as a throw from `save()`. Same test evidence as above | PASS |
| Two captures, one topic | `save()` (`engram.mjs:921-1058`) has no topic-collapse/memo logic — every call unconditionally builds+appends a new record; structurally guaranteed, not dedup'd until `share`/hydration. `hydrate()`'s idempotence case (one record hydrated twice ⇒ one row) is covered by `engram.hydrate.test.mjs` 9/9 | PASS |
| A secret never reaches disk (both backends) | `engram.mjs:1014-1019` scans before `:1023` append; R10 pair in `engram.save.test.mjs` (part of the 13/13) | PASS |
| Cross-backend parity | `backends/save-parity.test.mjs` 5/5, drives one refusal/record-id table against both `plainfiles.mjs` and `engram.mjs` | PASS |
| `share()` commits what is true | `engram.mjs:168-183`: no `_export`, no `_readObservations`, no `requireEngram()` call (confirmed via `rg` — only `importMemory` at `:682` calls it); `_ensureSymlink(root)` still called at `:177` (R12). `engram.share.test.mjs` 5/5 (118 lines, down from 1069/1074), includes the source-guard test | PASS |
| Idempotent hydration | `hydrate()` keys `topic: recordId` (`engram.mjs:1192`); R7 probe (apply-progress.md) measured **UPSERT** against the real `engram 1.20.0` binary in an isolated temp store; `engram.hydrate.test.mjs` idempotence case green | PASS |
| `memory:save` unpin | `package.json:65`'s `MEMORY_BACKEND=plainfiles` pin absent (grep confirms no match); `cli.save-search.test.mjs` 12/12 under `MEMORY_BACKEND=engram` | PASS |

Focused runtime evidence (all green, 6 files run together = 49 tests, matching
per-file counts summed):

```
engram.save.test.mjs 13/13, engram.hydrate.test.mjs 9/9, engram.share.test.mjs 5/5,
save-parity.test.mjs 5/5, engram.dualwrite-hydrated-gate.test.mjs 2/2,
chunk-boundary.test.mjs 15/15
capture-provenance.test.mjs 29/29, cli.save-search.test.mjs 12/12,
capture-reachable.test.mjs 5/5, cli.backend-fallback.test.mjs 11/11,
backend-selection.test.mjs 15/15, engram.upstream-scope+duplicates.test.mjs 18/18
```

No full `npm test` run here (another full run was already in progress in this
clone per instructions) — evidence above is the maximal focused-suite proof
available without duplicating that run.

## Ledger rows (design.md's row list)

| Row | Status |
|---|---|
| 1 `_defaultShareExport` | Gone — only comment references remain |
| 2 `_defaultReadObservations` (chunk-backed) + `collectChunkObservations` import | Gone — only comment references remain |
| 3 `dualWriteRecords` | **Intact** (`engram.mjs:252-269`), WITH the #924 hydrated-topic gate (`SUPERSEDES_ID_RE`/`skippedHydrated`, `:310-315`) and its two direct-call tests (`engram.upstream-scope.test.mjs`, `engram.duplicates.test.mjs:46-65`) — 18/18 green. Matches ratified O1 (issue #874 comment, 2026-09-11): cleanup ends at epic task 2.4 |
| 4 `_defaultChangedChunkFiles`/`assertExportDestinationIsRead`/`scrubMaterializedChunks` | Gone — only comment references remain |
| 5 `engram.share.test.mjs` (1069/1074 lines) | Replaced by an 118-line plainfiles-mirror suite |
| 6/7 (manifest untracking, `.gitattributes`, `.engram` confinement, `.gitignore` chunk block, `secret-scrub.mjs` gunzip) | **Untouched** — `git log 8e1e8bc7..56de7408` shows zero commits touching `.gitattributes`, `.memory/manifest.json`, `.gitignore`, `secret-scrub.mjs` |

`chunk-boundary.test.mjs`'s allowlist (`:170-171`) carries exactly two rows
(`cli.mjs:615`, `lib/migrate-v1.test.mjs:13`) — no `backends/engram.mjs` row.
The file's own evidence-floor scan (`:276-278`) still NAMES `engram.mjs` as a
scan target — correct, not a leftover, per design.

## Doctrine drafts (R13)

Both `brain-drafts/` amendments exist under
`openspec/changes/issue-874-record-first/brain-drafts/` and anchor to the
**promoted** `brain/core/methodology/memory-backend-contract.md` (still reading
`unsupportedOp`/`plainfiles`-pinned "Today:" text at `:63` — confirms the
drafts are NOT yet applied). Amendment 2 (rule2.draft.md) explicitly states it
"never [touches] the `save` column (Amendment 1 owns that one)" — dependency
on Amendment 1 promoting first is documented, not enforced by tooling. Neither
draft touches `brain/core/**` directly (agents-never-edit rule honored).

## CRITICAL

None.

## WARNING

None.

## SUGGESTION (disclosed non-blockers, not re-litigated)

- Six orphaned `memory.share.*` i18n keys (`skippedHydrated`, `unprovenanced`,
  `upstreamConfigUnreadable`, `upstreamConfigUnreadableNoRef`,
  `upstreamUnavailable`, `upstreamUnnamed`, `dedupedUpstream`, `secretFound` —
  confirmed present in `i18n/en.mjs`) — no unused-key checker exists in this
  repo to force their removal.
- `memory.share.skippedHydrated` specifically is orphaned (its `cli.mjs` print
  site is gone) but still describes a live gate (`dualWriteRecords`'s
  `SUPERSEDES_ID_RE` check) — leaving it is reasonable.
- `_defaultResolveDir` (`engram.mjs:471`) exported with zero callers —
  confirmed via grep across `backends/*.test.mjs` and `*.mjs`/`lib/*.mjs`.

## Task completion

All 18 tasks (A0-A10, B1-B7) in `tasks.md` are checked `[x]` and match the
code state on this branch. `apply-progress.md`'s TDD-cycle tables, deviation
notes, and two review-fix batches (fresh + cold, both PRs) are consistent with
what is measured above.

## Verdict: **PASS**

No CRITICAL or WARNING issues. Ready to archive.
