---
status: draft
issue: 874
---

# Design: #874 — record first, backend after (epic #864 task 3.2)

Designed inside R1–R14, ratified 2026-09-10 (engram `sdd/issue-874-record-first/ruling`). No ruling
is reopened here. One point the rulings do not reach — the fate of `dualWriteRecords` once its only
caller is gone — is raised as **O1**, not decided.

## Technical approach

Two splits, stacked (R14). **A adds the producer; B removes the exporter.**

A makes `engram.save()` a mirror of `plainfiles.save()` (R1) and appends one new terminal step,
`hydrate({root, recordId})`, which shells the single `_defaultEngramSave` primitive with
`--topic <record id>` under the #820 guard (R3, R4) and **defers instead of throwing** when the
backend cannot be reached (R5). The unpin of `package.json:65` is A's last commit (R8). B reshapes
`share()` into the `plainfiles.share()` mirror (R11, R12) and deletes ledger rows 1–5, row 4 last
(R10).

## Architecture decisions

| # | Decision | Alternatives rejected | Rationale |
|---|----------|----------------------|-----------|
| D1 | `hydrate` builds its payload with `importRecord()` (`lib/engram-import.mjs`) — the same pure record→observation transform `importMemory` uses. | A second inline mapping inside `hydrate`; passing raw record fields to `engram save`. | One transform, two paths. `importRecord` renders `actor`/`issue`/`supersedes`/`source` into the §4 provenance prose and is the half of #404's id round-trip property; a second mapping would drift silently and strip provenance from the row. |
| D2 | `hydrate({root, recordId, record?})` — `record` is an optional already-materialized record; absent, `hydrate` reads the store through `_readRecords` and finds the id. | Always read the store (a full `.memory/records/` read on every `save`); require the record (breaks the contract's standalone `hydrate({root, recordId})` signature). | The producer path pays zero extra IO; a standalone caller still gets the contract's signature. Both converge on ONE `_engramSave` call, so R3 is satisfied either way. |
| D3 | Binary presence is measured with `probeBinary(ENGRAM_BIN)`, never `requireEngram()`. | `requireEngram()` inside `hydrate`. | `requireEngram` throws; `hydrate` must **defer** (R5). A `probe.available !== true` is a `deferred` reason, not an exception. |
| D4 | An unknown `recordId` with no `record` passed **throws**; it is not `deferred`. | Deferring it. | `deferred` means "the backend could not be reached"; a caller naming a record that does not exist is a caller mistake, and folding the two would make `deferred` unreadable (the `evidence-reader-empty-on-failure` class the contract names). |
| D5 | `engram.save()` reuses `plainfiles.save()`'s **seam names verbatim** (`_appendRecord`, `_rebuildIndex`, `_loadConfig`, `_readRecordIds`, `_upstreamRecordEntries`, `getBranch`, `getTimestamp`, `getHostname`, `getGitConfig`, `getEnv`) and adds `_hydrate`. | Fresh seam names on the engram side. | R2's parity test drives BOTH backends through ONE table; identical seam names are what makes that table possible instead of two near-copies. |
| D6 | `share()` (B) drops `_requireEngram`, `_export`, `_readObservations`, `_changedChunkFiles`, `_scrubChunk`, `_resolveDir`; keeps `_ensureSymlink` (R12) and `_rebuildIndex`. | Confining `_ensureSymlink` to `setup()` here. | R11/R12 as ratified: rule 3 says `share` must complete with the backend's binary and private files absent; the symlink's retirement is 2.4's named deliverable. |
| D7 | The catalog key `memory.save.engramUnsupported` retires **with its only call site** in A; `memory.search.engramUnsupported` stays. | Leaving the key orphaned. | `search` stays unsupported (R14 scope); a refusal string for a verb that now works is a signpost pointing at the past. `i18n/coverage.test.mjs` is the arbiter for both catalogs. |
| D8 | A also rewrites `capture-reachable.test.mjs` and `cli.backend-fallback.test.mjs:131-145`. | Leaving them; discovering the breakage at apply time. | **Measured, not in the ledger**: `capture-reachable.test.mjs:29-35` asserts the `MEMORY_BACKEND=plainfiles` pin the unpin removes, `:37-60` asserts the refusal D7 retires, and `cli.backend-fallback.test.mjs:141` asserts `save` exits non-zero under engram with no binary — which becomes exit 0 + `deferred`. Each invariant SURVIVES in a stronger form (see Testing) and is re-stated, never dropped. |
| D9 | The R7 probe is **isolation-first**: if isolation of a temp store cannot be proven, the probe is NOT run and is recorded as `not measured — <reason>`. | Running it against the ambient store; assuming upsert. | The one thing worse than an unmeasured claim is a measurement that wrote into the real store. Fail-closed on the evidence, exactly as `importMemory` does on an unreadable state. |

## Data flow (split A)

    npm run memory:save -- "t" "c" --type … [--issue N] [--supersedes rec-…]
      │  cli.mjs save parser (unchanged — arity, --supersedes fan-in, no --actor/--ts)
      ▼
    engram.save(title, content, opts, seams)
      ├─ type / --issue shape        ─┐
      ├─ resolveActor (#738)          │ refusals: throw, ZERO IO,
      ├─ resolveActorKind / deriveIssue│ order identical to plainfiles (R2)
      ├─ classifySupersedes (#805)   ─┘
      ├─ buildRecord  →  scanTextForSecrets(serializeRecord(candidate))   ← #469 chokepoint
      │     └─ hit ⇒ throw; _appendRecord / _rebuildIndex / _engramSave NEVER called (R10)
      ├─ _appendRecord  ──► .memory/records/<yyyy-mm>.jsonl        [DURABLE — the capture is safe here]
      ├─ _rebuildIndex  ──► .memory/index.jsonl                    [#637 annotated rethrow preserved]
      ▼
    hydrate({root, recordId: candidate.id, record: candidate})
      ├─ probeBinary ≠ available  ──────────────┐
      ├─ guard(#820) not held     ──────────────┤ deferred: stderr + {written:0, deferred:true[, contended:true], reason}
      ├─ importRecord(record) → _engramSave(title, content, {type, project, scope, topic: id})
      │     └─ throws (exit ≠ 0) ───────────────┘
      └─ ok ⇒ {written: 1, skipped: 0}
      ▼
    save returns {id, file, written:true, hydrated, deferred?, reason?, indexCount, duplicates} → exit 0

`share()` after B: `_ensureSymlink(root)` → `_rebuildIndex` → `{indexCount, duplicates}`. Nothing else.

## Module map

### Split A — `openspec/changes/issue-874-record-first` slice 1 (sub-ticket, `Part of #874`)

| File | Action | Detail |
|------|--------|--------|
| `backends/engram.mjs:1121` | Replace | `save()` — the `unsupportedOp` stub becomes the `plainfiles.save()` mirror + the `_hydrate` step. ~110 lines + ~50 of doc comment pointing at `plainfiles.mjs:82` as the parity twin. |
| `backends/engram.mjs` (new export) | Add | `hydrate({root, recordId, record}, {_engramSave, _guard, _probe, _readRecords, _importRecord, _warn})` — ~70 lines. |
| `backends/engram.mjs:1113-1118` | Modify | The header note keeps `search`'s half of the Q1 asymmetry; `save`'s half is deleted, not edited to lie. |
| `lib/backend-selection.mjs:54, 67-71` | Modify | The comment stating `save` is "a deliberate refusal" is now false. `FALLBACK_OPS` is UNCHANGED (`["share","pull"]`): `save` still never fails on the binary — it defers — so there is still nothing for a fallback to replace. ~8 lines. |
| `i18n/en.mjs`, `i18n/es.mjs` | Modify | `+memory.save.hydrateDeferred`, `+memory.save.hydrateContended`, `+memory.hydrate.recordNotFound`; `−memory.save.engramUnsupported` (D7). Both catalogs, `coverage.test.mjs` enforces parity. |
| `package.json:65` | Modify | Drop `MEMORY_BACKEND=plainfiles`. **Last commit of A** (R8). |
| `brain-drafts/memory-backend-contract.save.draft.md` | New | R13 draft 1 — see Doctrine below. |

### Split B — `Closes #874`

Deletion order is load-bearing (R10): **rows 1 → 2 → 3 → 5, then row 4 LAST**, citing A's two #469 tests as the reason row 4 is safe to remove.

| Order | File / surface | Action | Measured |
|-------|----------------|--------|----------|
| — | `engram.mjs:194-259` `share()` | Rewrite to the `plainfiles.share()` mirror (D6) | ~65 → ~15 |
| row 1 | `_defaultShareExport` `:486-493` | Delete | ~8 |
| row 2 | `_defaultReadObservations` `:273-275` + the `collectChunkObservations` import `:61` | Delete | ~5 + 1 import |
| row 2' | `chunk-boundary.test.mjs:171` allowlist row | Delete — **same commit as row 2**, the guard is bidirectional | 1 |
| row 3 | `dualWriteRecords` `:333-~485` `_readObservations` seam | Reshape — see **O1** | ~150 at stake |
| row 5 | `backends/engram.share.test.mjs` | Delete; replace with a ~90-line `engram.share.test.mjs` modelled on `plainfiles.share.test.mjs` (82 lines) | −1069 / +90 |
| row 4 | `_defaultChangedChunkFiles` `:578-609`, `assertExportDestinationIsRead` `:653-670`, `scrubMaterializedChunks` `:686-710` | Delete LAST | ~75 |
| — | `brain-drafts/memory-backend-contract.rule2.draft.md` | New | R13 draft 2 |

## Interfaces

```js
// backends/engram.mjs
export async function save(title, content,
  { type, project, issue, supersedes, scope, topic } = {}, seams = {})
  // → { id, file, written: true, hydrated: boolean, deferred?: true, contended?: true,
  //     reason?: string, indexCount?: number, duplicates }

export async function hydrate({ root, recordId, record } = {}, seams = {})
  // → { written: 0|1, skipped: number, deferred?: true, contended?: true, reason?: string }
  //   contract: memory-backend-contract.md:62
```

## The R7 probe (one-off, split A, recorded in `apply-progress.md`)

R7 forbids assuming `engram save --topic` upserts. Apply runs this ONCE, in an **isolated** store —
never the repo's `.memory`/`.engram`, never the real engram DB:

1. Resolve the store-location override from `engram --help` (env var or flag). If none can be
   identified, run the whole probe with `HOME=<tmp>` so the default store path resolves inside the
   temp tree. **If neither can be shown to isolate the store, STOP** — record
   `R7 probe: not measured — isolation could not be proven` and continue (D9).
2. Record the real store file's path, size and mtime BEFORE.
3. `engram save "probe" "body-v1" --type discovery --project brain-probe-874 --topic rec-probe-0000000000000000`
4. Repeat verbatim with `body-v2`.
5. `engram export <tmp>/state.json`; count rows whose `topic_key` is the probe topic.
6. **Verdict**: 1 row carrying `body-v2` ⇒ upsert. 2 rows ⇒ INSERT.
7. Assert the real store's path/size/mtime are UNCHANGED (the isolation proof, recorded too);
   remove the temp tree.
8. Write the verbatim commands, stdout and verdict into `apply-progress.md` under `R7 probe`.

**Fallback if the verdict is INSERT**: no design change in this slice (R7). A duplicated row is
visible to `memory:audit` (`rec-` rows vs distinct keys) and reconcilable adapter-side, which the
contract's *Deletion* section already permits; the #820 guard (R4) already narrows the window. The
unit tests drive the `_engramSave` seam, so they stay valid either way. The verdict is carried into
the epic's 6.1 exit as measured evidence.

## Testing strategy — STRICT TDD, `node --test`, temp dirs + fake seams only

No test in either split may invoke the real `engram` binary against a real store, or touch this
repo's `.memory/`. CLI-level tests run the child with `PATH` pointed at an empty temp dir (so the
binary is *measurably* absent, which makes the `deferred` branch deterministic), plus
`BRAIN_MEMORY_TEST_ROOT`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1` — the isolation
fixture `cli.save-search.test.mjs` and `capture-reachable.test.mjs` already use.

### Split A

| File | Cases |
|------|-------|
| `backends/engram.save.test.mjs` (new, ~260) | happy path (record + index + `hydrated:true`); `type` missing; `--issue` non-integer; actor unset/malformed/reserved **before any store read** (`_readRecordIds` never called); derived-issue notice; malformed `--supersedes` touches no IO; `scope`/`topic` warn loudly; `_rebuildIndex` throws ⇒ `indexFailed`/`recordId`/`recordFile` annotated rethrow (#637). |
| `backends/engram.save.test.mjs` — **R10 pair** | (i) a secret in `content` ⇒ throws AND `_appendRecord`, `_rebuildIndex`, `_engramSave` are never called; (ii) a shared call-order log asserts **scan → append → hydrate**. The file header states the invariant verbatim: *a secret in `content` never reaches disk — neither `.memory/records/*.jsonl` nor the engram store.* B's row-4 deletion commit cites these two by name. |
| `backends/engram.hydrate.test.mjs` (new, ~180) | one `_engramSave` call with `topic === recordId` and a payload byte-equal to `importRecord(record)`; **idempotence** — two hydrations of one record against a topic-keyed fake store leave one row (R6); binary absent ⇒ `deferred` + stderr, no throw; `_engramSave` throws ⇒ `deferred` with the reason, no throw; guard contended ⇒ `{deferred:true, contended:true}` and `_engramSave` never called; the guard is released even when `_engramSave` throws; unknown `recordId` ⇒ throws (D4). |
| `backends/save-parity.test.mjs` (new, ~120) — **R2** | One table, both backends: every refusal input produces the same refusal in the same order, and one clean input under pinned seams (fixed `ts`/actor/host) produces the **same record id** from both. engram's `_hydrate` is stubbed to a no-op so only the record shape is compared. |
| `backends/engram.save-search-unsupported.test.mjs` | Trimmed to `search` only (renamed `engram.search-unsupported.test.mjs`); the two `save` cases go. |
| `capture-reachable.test.mjs` (D8) | `:29-35` inverts and **strengthens**: the verb must NOT pin, and capture must stay reachable with no engram installed *because `save` defers rather than refuses* — #530's guarantee proved end-to-end instead of by a pin. `:37-60` retargets to `memory.search.engramUnsupported`. |
| `cli.backend-fallback.test.mjs:131-145` (D8) | Same subject, new observable: `save` is still NOT substituted (`SUBSTITUTED` absent from stderr), but now exits 0 with a record on disk and `deferred` on stderr. |
| `cli.save-search.test.mjs` (extend, ~60) | **The required CLI-level test**: `MEMORY_BACKEND=engram`, empty `PATH`, temp root ⇒ exit 0, **exactly one** record line under `<root>/.memory/records/*.jsonl`, **exactly one** line in `<root>/.memory/index.jsonl`, the id on stdout, `deferred` on stderr. |

### Split B

| File | Cases |
|------|-------|
| `backends/engram.share.test.mjs` (replacement, ~90) | `share` calls `_rebuildIndex` once and returns `{indexCount, duplicates}`; `_ensureSymlink` is still called (R12); share completes with the engram binary absent (rule 3) — and a source guard: `share.toString()` matches none of `requireEngram`, `_export`, `_readObservations`, `dualWriteRecords`. |
| `chunk-boundary.test.mjs` | Unchanged tests, one allowlist row fewer; the existing bidirectional pair is the proof. |
| full suite | Green under `MEMORY_BACKEND=plainfiles` and `MEMORY_BACKEND=engram`. |

## Line budget vs. the 400-line review budget (R14)

| Split | Production | Tests / catalogs | Net changed | Verdict |
|-------|-----------|------------------|-------------|---------|
| A | ~240 added, ~10 modified, −4 | ~700 added, ~40 rewritten | **≈ 900–950** | **`size:exception` required** — R14 anticipated this ("only if the tests push it over"); they do, by ~2×. Production alone is ~250. Mitigation is commit shape, not a second PR: commits ordered `parity test → save gates → #469 pair → hydrate → deferred paths → collateral tests → unpin`, so the reviewer reads A as six small units. Splitting A further would ship a half-producer, which R8/R14 refuse. |
| B | ~300 deleted, ~15 added | −1069 / +90, −295 if **O1** resolves to delete | **≈ −1250 (O1 keep) to −1560 (O1 delete)** | `size:exception`, justified as pure deletion (R14). |

## Record-first delivery (R14)

Each PR ends with **exactly one** `npm run memory:save -- … --issue 874` invocation producing one
record file line and one index line; the record id is parsed from the `memory/cli:` stdout line and
quoted in the PR body. Nothing else under `.memory/` is staged — hydration writes into engram's own
DB, never the tree, and `staged-records-check` is the guard. A's closing record is written **after**
the unpin commit, so it runs through the new path and is the first end-to-end proof of the slice.

## Doctrine (R13) — drafts only, never `brain/core/**`

Two `brain-amendment` drafts under `openspec/changes/issue-874-record-first/brain-drafts/`, against
the **promoted** `brain/core/methodology/memory-backend-contract.md`, promoted by the maintainer via
`brain:promote` after the matching PR merges:

1. **A's draft** — conformance table `:102` `save` column `unsupportedOp today; closes with 3.2` →
   `yes`; the `save` verb row `:63` "**Today:**" note and the `hydrate` row `:62` note updated to
   state that `hydrate({recordId})` exists; the producers table `:82` hydration cell
   `next hydration today; hydrate({recordId}) with #874` → `hydrate({recordId})`.
2. **B's draft** — conformance table `:102` rule 2 `not yet` → `yes`; the `share` verb row `:61`
   moves from future to present tense. **Rule 3 stays `not yet`** (2.4).

## Risks and failure modes

| Situation | Detected by | Outcome | Proved by |
|-----------|-------------|---------|-----------|
| engram binary absent | `probeBinary` (never a caught message) | record durable, `hydrated:false, deferred:true, reason`, stderr, **exit 0** | `engram.hydrate.test.mjs`, `cli.save-search.test.mjs` |
| `engram save` exits non-zero | `_engramSave` throws → `explainEngramFailure` | same, with engram's stderr as the reason | `engram.hydrate.test.mjs` |
| #820 guard contended | `acquireHydrationGuard().held === false` | `{deferred:true, contended:true}`, `_engramSave` never called, pid/age on stderr, **never waits** | `engram.hydrate.test.mjs` |
| Secret in `content` | `scanTextForSecrets` before `_appendRecord` | throw; nothing on disk, nothing in engram | **R10 pair** |
| Malformed `--supersedes` | `classifySupersedes` grammar check | throw with zero IO | `engram.save.test.mjs` |
| Index rebuild fails | `_rebuildIndex` throws | #637 annotated rethrow (`indexFailed`, `recordId`, `recordFile`), cli says "the record is on disk" | `engram.save.test.mjs` |
| `engram save --topic` INSERTs | R7 probe / `memory:audit` | duplicate row, reconcilable adapter-side; no design change this slice | probe record in `apply-progress.md` |
| Drift between the two `save` bodies | R2 parity test | refusal order and record id must match | `save-parity.test.mjs` |
| B lands without A | stacked PRs; B's body names A's merge commit | — | — |
| An older checkout still runs `engram sync --export` | — | harmless: local chunks nobody reads back; stated in the PR body | — |

## Open question

**O1 — `dualWriteRecords`'s disposition (ledger gap, needs the maintainer's word before B applies).**
Ledger row 3 says "seam removed, function reshaped", written when something was still expected to
call it. Measured: after R11's `share`, `dualWriteRecords` (`engram.mjs:333-~485`, ~150 lines) has
**no production caller** — its only input source was the export — and it carries #701's upstream-base
dedup, exercised by `engram.upstream-scope.test.mjs` (295 lines, entirely built on it), one test in
`engram.duplicates.test.mjs:46-65`, and part of `cli.upstream-config.test.mjs` (317 lines, extent to
be audited at apply time). Options: **(a)** delete it with rows 1–3 — honest, but retires #701's
observation→record direction and 300+ test lines the ledger never named; **(b)** keep it exported
with the seam removed — dead production code with a live suite, the exact shape the explore flagged
on `scrubRecordsFile()`; **(c)** keep it in B, hand its disposition to 2.4 alongside the rest of the
chunk estate. Design recommendation: **(c)** — it keeps B's blast radius equal to the ratified ledger
and does not retire a shipped behaviour inside a slice whose subject is the producer path. B's
`share` stops calling it either way, which is what R11 requires.
