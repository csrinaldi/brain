---
status: draft
issue: 247
---

# Explore — chunk retirement (issue 247)

## Headline finding

**#247's remaining scope is narrower than its title suggests, and the exact boundary is
disputed by the repo's own artifacts.** PR #258 (merged, `0e079805`) already did the reader
migration and deleted `chunk-reader.mjs` — `brain-audit.mjs:53,226` and `brain-check.mjs:28,237`
both call `readRecordObservations` today; `readChunkObservations` has zero remaining importers
(grep, measured). The issue stayed open because item 2 of its own body — "retire chunk
materialization in `memory:share`" — was explicitly excluded from PR #258's scope
(`openspec/changes/archive/247/proposal.md`: "Does Not Include: Modifying `engram.mjs`'s
`share()`... untracking `.memory/manifest.json` or `.memory/chunks/`").

But `openspec/changes/issue-863-backend-contract/proposal.md:91-101` (D3, the ruling this
ticket must follow) labels #247 **"chunk read-back"** and states plainly: *"manifest, chunks and
symlink exist only because `share` calls `engram sync --export`. Once `share` no longer exports
the backend [at 3.2, record-first], all three lose their only writer **at once**."* That sentence
places the actual retirement of `engram sync --export` at task 3.2 (#874), not here. See
**Open question 1** — it decides everything else in this doc.

## Current state (measured)

**Writers.** `engram.mjs#share()` (`brain/scripts/memory/backends/engram.mjs:181-246`) calls
`_defaultShareExport` (`:473-480`), which runs `engram sync --export` — engram's *only* local
sync command (`engram sync --help`: "Local sync exports project-scoped chunks to `.engram/` by
default"; no flag suppresses the file writes). That writes `.memory/chunks/*.jsonl.gz` under the
`.engram → .memory` symlink `share()` itself ensures (`:208`). `.memory/chunks/` is gitignored
(`.gitignore:84`) — chunks are already never committed; "materialization" here means local,
ephemeral disk files, not a VCS artifact.

**Readers.** `dualWriteRecords()` (`:320-471`) reads those same chunks back via
`_defaultReadObservations` → `collectChunkObservations` (`brain/scripts/memory/lib/migrate-v1.mjs:41-60`,
gunzip + JSON.parse), transforms each observation through `exportObservation`
(`lib/engram-export.mjs`), scans for secrets, dedups against `.memory/records/`, and appends new
records. This is the **only** path today that turns a native engram `mem_save` capture into a
durable record (memory-backend-contract.md's conformance table: engram rule 2 "**not
yet**... closes with #864 task 3.2"). Two independent scrubs also read chunk bytes:
`scrubMaterializedChunks()`/`_defaultChangedChunkFiles` (`:565-596`, secret-scrub before
`records/` is ever touched — the #469 hardening, now fixed: it no longer "scans zero chunks").

**Other consumers, already migrated or never chunk-based:**
- `run-check.mjs` (the CI `memory-gate` evaluator) — records-only since C4/D4
  (`run-check.mjs:13-16`, explicit comment "chunk reader is no longer imported").
- `brain-audit.mjs`, `brain-check.mjs` — migrated by PR #258 (above).
- `chunk-reader.mjs` — **deleted** by PR #258, along with its test. Repo-wide grep for
  `readChunkObservations` returns zero code hits (two comments only, in `store.mjs` and
  `store.test.mjs`, both documenting the historical mirror).
- `secret-scrub.mjs` still imports `gunzipSync` (used by `scrubChunkFile`, called from both
  `scrubMaterializedChunks` and — separately — the legacy-restore/rollback path in
  `migrate-v1.mjs`).

**Transport role (the crux).** Under `MEMORY_BACKEND=engram`, a `mem_save` capture on host A
reaches host B **only** via: `share` → `engram sync --export` (chunks) → `dualWriteRecords`
reads chunks → records appended → `pre-push` materializes `.memory/` → the record rides the
feature branch (today) or the memory lane (#887/#888, landed). Nothing today substitutes for
this — #874 (record-first `save`, task 3.2) is what makes `mem_save`-equivalent captures produce
a record *directly*, at which point `share` "exports nothing from the backend" per the contract's
`share` verb row. **Until #874 ships, this chunk round-trip is the only producer path engram has**
(`save()` in `engram.mjs:1108-1110` is `unsupportedOp` today).

**Legacy files.** `.memory/legacy/*.jsonl.gz` — 48 tracked files, zero readers in `brain/`
outside `migrate-v1.mjs`'s `--rollback` path (`cli.mjs:559`, restores chunks *from* `legacy/`,
never reads *into* anything else) and one doc reference (`adr-0017:448`, describing what they
are). This is task **2.4**'s inventory, explicitly NOT this slice's boundary (see below).

**The 2.4 boundary (NOT this slice).** `openspec/changes/issue-864-memory-2-0/tasks.md:38` (task
2.4) owns: untracking `.memory/manifest.json`, deleting `.memory/legacy/*` (48 files), removing
`.gitattributes:5`, `merge-engram-manifest.mjs`, `bootstrap.sh`'s driver registration, confining
the `.engram` symlink to `engram.mjs#setup`, and rewriting the `.gitignore` memory block. It is
explicitly sequenced **after** 3.2 (D3, `issue-863-backend-contract/proposal.md:97`) — "retiring
the manifest while `share` still writes it would re-create #803's churn on every push." #247 does
not touch the manifest, symlink, or driver.

## Migration remainder — checklist

- [ ] **Resolve Open Question 1** (below) before any code moves — it determines whether this
      slice touches `_defaultShareExport`/`dualWriteRecords` at all, or only the read-transform
      shape inside `dualWriteRecords`.
- [x] Readers migrated to `readRecordObservations` (PR #258 — `brain-audit.mjs`, `brain-check.mjs`).
- [x] `chunk-reader.mjs` retirement verdict — **deleted** (PR #258), not deprecated. Epic task
      2.3's "gets its retirement verdict" is already satisfied.
- [ ] Grep-guard test asserting zero `readChunkObservations` consumers — **does not exist**
      today as an enforced test (only prose comments say so). A regression-guard test is new
      work even though the current state already satisfies it.
- [ ] Whatever Q1 resolves to: either (a) stop chunk *reading* in `dualWriteRecords` while
      `share` still exports chunks for other reasons, or (b) leave the round-trip intact and
      close #247 as "already done, re-scope the remainder into #874."
- [ ] Tests updated/added to pin the new behavior red-then-green.

## Approaches — tradeoffs

**A. Close #247 now as "reader migration done"; defer the rest to #874 (record-first).**
D3's own language ("chunks lose their only writer at 3.2") supports this. Risk: contradicts the
issue's own acceptance bar ("`memory:share` no longer writes `.memory/chunks/`") and leaves task
2.3 checked prematurely against its own epic wording. Smallest possible diff (a grep-guard test
+ closing note); lowest risk of breaking the only working sync path.

**B. Retire the chunk *read-back* only — `dualWriteRecords` stops depending on
`collectChunkObservations`/gunzip, `share` still calls `engram sync --export`.** Matches D3's
literal label ("chunk read-back"). Requires a replacement source of observations for
`dualWriteRecords` before #874 lands — candidate: engram's plain `export [file]` JSON command
(distinct from `sync --export`'s gz chunks) has not been evaluated for parity (project scoping,
schema) and is an unmeasured unknown. Medium risk: could silently narrow what gets captured if
the substitute source diverges from what chunks currently carry.

**C. Retire chunk *writing* entirely now (stop calling `engram sync --export` from `share`).**
Matches the issue body's literal ask and the epic's "`share` reads no chunk file" line most
directly. Contradicts D3's explicit sequencing and would leave engram with **no working
producer path** until #874 ships (`save()` is `unsupportedOp`) — a regression to rule 2 of the
backend contract ("the backend is never the first home of a capture") in the wrong direction:
captures would stop reaching `records/` at all. Highest risk; likely wrong given D3.

**Legacy `.jsonl.gz` (48 files) — out of scope either way**, per the 2.4 boundary above. Keep vs.
delete is task 2.4's call, made after #874, with "the reader story" stated then (today: zero
readers, historical value only).

## Open questions for the proposal

1. **Does #247 touch `share()`/`_defaultShareExport` at all, or only `dualWriteRecords`'s
   read-transform?** D3 (`issue-863-backend-contract/proposal.md:91-101`) reads as: #247 = "chunk
   read-back" (approach B or A), 3.2 = the actual export retirement. The issue body and epic task
   2.3's own wording read as approach C. These are the SAME ticket number described two
   incompatible ways by two documents this ticket is told to treat as ruling context. The
   proposal phase must pick one explicitly and say why, citing both sources.
2. If approach B: what replaces `collectChunkObservations` as `dualWriteRecords`'s observation
   source before #874 lands? Has `engram export [file]` (plain JSON) been measured for parity
   with `engram sync --export` (chunks) — project scoping, schema, completeness?
3. Does the ~15-test chunk-secret-scrub subsystem (`scrubMaterializedChunks`,
   `_defaultChangedChunkFiles`, `assertExportDestinationIsRead` — `engram.share.test.mjs`, ~1069
   lines, most of it chunk-scrub coverage from #469) get deleted, kept as dead-but-tested code, or
   repointed at whatever replaces chunk reads? This is the largest single line-count risk in the
   slice regardless of which approach wins.
4. Is a grep-guard test (zero `readChunkObservations` importers) worth adding on its own, even if
   Q1 resolves to "close now, defer the rest" — it is cheap, already true, and prevents silent
   regression before #874.
5. Should #247 be re-titled/re-scoped in its own issue body to match whichever of A/B/C the
   proposal picks, given the current title ("retire chunk materialisation") only matches C?

## Split candidates

- **Slice 1 (small, ~any approach):** grep-guard test for zero `readChunkObservations`
  consumers + doc/issue reconciliation of the A vs B vs C question. Near-zero line count,
  resolves the ambiguity for whoever does the next slice.
- **Slice 2 (approach B, if chosen):** swap `dualWriteRecords`'s observation source, touching
  `engram.mjs` (`_defaultReadObservations` and its call sites), `migrate-v1.mjs` (whether
  `collectChunkObservations` stays for `--rollback`/`migrate-v1` use or is duplicated), and the
  ~15 chunk-scrub tests in `engram.share.test.mjs` that assert against the old shape.
- **Approach C is not recommended as a standalone slice** — it depends on #874 landing first per
  D3; sequencing it here would be the #803-churn mistake D3 warns against, one layer up (breaking
  the only capture path instead of the manifest).

## Files with tests first (if code changes at all this slice)

- `brain/scripts/memory/backends/engram.share.test.mjs` (1069 lines) — the chunk-scrub and
  `dualWriteRecords` behavior tests; whichever approach wins, red-then-green starts here.
- `brain/scripts/memory/lib/migrate-v1.test.mjs` / `cli.migrate-v1.test.mjs` — pin
  `collectChunkObservations`'s continued (or retired) role in `--rollback`.
- A new grep-guard test (location TBD by proposal — likely beside
  `governance/run-check.test.mjs` or a repo-check script) asserting zero `readChunkObservations`
  importers repo-wide.

## Risks

- **A host on an old brain version still pushing chunks** — not applicable: chunks were never
  committed (gitignored today, unlike the pre-#258 world); this risk is void.
- **`secret-scrub` coverage gap** if the read-transform changes source without carrying the
  scrub step along — the #469 fail-closed guarantee ("nothing reaches `records/` unscanned")
  must survive whichever approach is picked.
- **Breaking the only producer path** if approach C is taken before #874 — see approach C above.
- **The 48 legacy files' history value** is explicitly out of scope (2.4), but any approach that
  touches `migrate-v1.mjs`'s `--rollback` should not silently break legacy-restore without
  updating the 2.4 ticket's stated inventory.
