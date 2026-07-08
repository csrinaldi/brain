# Design — records-as-write-truth machinery (slice C2b-1)

Ships import + scrub re-point + dual-write, fixture-tested. No real-store mutation (that is C2b-2).

## Decision 1 — scan-then-write over the RECORDS log; chunks keep the C1b post-scan (ruling point 1, adjusted for a mechanical constraint)

**Mechanical constraint discovered at design time:** `share` materializes chunks by invoking the
engram binary (`engram sync --export` in `_defaultShareExport`). The chunk `.jsonl.gz` files are
written by engram BEFORE our code can pre-scan anything — we do NOT control that write, so a
literal "gate both outputs before any write" is not achievable without re-architecting chunk
materialization (deferred; see below). What we DO control is the append to `records/`.

**Decision:** apply full **scan-then-write to the RECORDS log** — the ruling's explicit core ("nothing
secret ever touches the append-only records log"):
`export engram → read observations → transform to CANDIDATE records → scanTextForSecrets(candidate
record lines) → [clean?] append(records) → reindex`. A hit **aborts BEFORE the records append**, so
`records/` (append-only, undeletable) is never written with a secret. The **chunks** — materialized
by engram's export — retain C1b's **post-materialization scan** (`scrubMaterializedChunks`) as the
fail-closed backstop: a secret in a chunk still blocks the share (push refused), the chunk stays
local, never pushed. Both paths fail closed; a secret never reaches the remote.

**Why not scan-after-append for records:** `records/` is append-only; a post-append scan that failed
would leave the secret in a local records file (push blocked, but the leak is on disk). Scan the
candidates first, append nothing on a hit. **`scanTextForSecrets` is reused verbatim** — only WHAT
text (candidate record lines) and WHEN (pre-append) change.

**Deferred (not this slice):** re-architecting `share` to materialize chunks ourselves (from a
read-only engram observation dump) so a single pre-write scan gates BOTH outputs. That is a larger
change and depends on engram's read-only-dump capability — flagged for the checkpoint / a later
slice, not silently assumed away.

**Reorder (fix pass, issue #221, MINOR):** `share` now runs `scrubMaterializedChunks` (the chunk
backstop) BEFORE `dualWriteRecords` — the original order ran the records dual-write first, so a
chunk-only secret (e.g. a `scope:personal` observation materialized in a chunk but already excluded
from `dualWriteRecords`'s candidates) would abort the share AFTER `records/` had already been
appended. Chunks-first eliminates that: `dualWriteRecords` never even starts once the backstop
fails. **Accepted residual note:** `dualWriteRecords` can still append clean candidate records to
`records/` in a run whose backstop passed but a chunk-only secret is discovered by some later/manual
scan — accepted because the appended records were themselves scanned clean by `dualWriteRecords`'s
own pre-append scan, and Fix 1's id-dedup (`readRecordIds`) makes any retry idempotent; this reorder
narrows the residual risk to chunk-only secrets specifically, never a records-log secret.

## Decision 2 — import is the designed inverse of export; its contract is id-equality

`importRecord(record)` reverses `exportObservation`: `renderProvenance` puts the provenance fields
back as §4 prose in `content`, the R2 title fold is undone, and `ts` is mapped back toward engram's
naive form. Its acceptance is the **id-equality round-trip** (`sdd/memory-format/c4-roundtrip-equality`):
record → engram → record preserves `computeRecordId`. Byte equality is NOT required — the render
`source`/`issue` asymmetry is inert because `source` is hash-excluded (supersedes MINOR-5). The full
round-trip **contract test** (both directions, exhaustive fixtures) is C4; here we assert the
id-equality property to keep import C4-ready.

## Decision 3 — scrub re-point: new reader, same scanner (tested seam; NOT live-wired this slice)

A records-file reader (`scrubRecordsFile`, read `.jsonl`, split lines) replaces `scrubChunkFile`'s
gunzip step and feeds the same `scanTextForSecrets`. **Correction (fix pass, issue #221):**
`scrubRecordsFile` ships tested in isolation but is NOT wired into `share`'s live scrub seam in
C2b-1 — `share`'s actual records-protection is `dualWriteRecords`'s pre-write candidate scan
(Decision 1), which scans candidate record text held in memory BEFORE any `records/` append, never
a post-write file re-scan. `scrubRecordsFile` is the seam C2b-2 will cut over to (e.g. for a
full-store/post-hoc scan of the real `records/` directory during the real migration run).
Fail-closed + no bypass are preserved in both mechanisms; the config allowlist path (C1b) is
unchanged.

## Decision 4 — dual-write is transitional

Chunks continue to be materialized for the old cross-machine `pull` for one transition window;
`records/` is the new write-truth. Dropping the chunks (the `pull` → records-only switch) is
deferred to C4/later — NOT this slice.

## Decision 5 — dual-write is DORMANT by config; activation is a committed cutover STATE MARKER, not a merge or a bypass switch (human ruling)

`share()` calls `dualWriteRecords` ONLY when `memory.dualWrite === true` in `brain.config.json`
(default **false**, added by the additive `0.6.0` config migration). Absent/false → `share()` keeps
its C1b behavior (export + chunk scrub only); `records/` is never populated.

**Why config, not "activated by merging C2b-2".** "C2b-2 activates it" hides the same trap one level
up: if activation meant *merging* the wiring, then merging C2b-2 (which un-refuses the `migrate-v1`
CLI) would re-open the window where an ordinary `share`/push populates `records/` **before** the
cutover's `migrate-v1` real run — tripping its abort-if-populated guard and stranding the cutover.
A config flag decouples *shipping the machinery* from *activating it*: both C2b-1 and C2b-2 can merge
with the dual-write still OFF; the human flips `memory.dualWrite=true` as a **committed** runbook
step, IMMEDIATELY after the real migrate.

**Doctrinal distinction (explicit).** This is NOT the CLI bypass flag rejected in C2-migrate. That
was an ad-hoc switch to *trigger execution* on a single invocation. This is a **state marker of the
cutover** that lives committed in `brain.config.json` — auditable in git history, reviewable as a
diff. C1b's own doctrine says exactly this: gates live in auditable config, never in command
switches. The flag is **transitional**, like the dual-write itself — retired when the chunks are
(C3/C4 or a later cleanup).

**The incident that proved this (damage #2, empirically).** Wiring the dual-write LIVE into `share()`
was caught when a routine `memory:share` (the pre-push scrub gate) executed it against the real
store and wrote `.memory/records/` + `.memory/index.jsonl` — a real mutation, un-gated, ahead of any
cutover. Cleaned up (both were untracked, removed; store restored). The config gate makes that path
impossible by default. Category: **wiring-vs-shipping** (a sister of code-vs-execution) — shipping
reachable code is safe; wiring it into an auto-running path is a form of executing it.

## What C2b-1 explicitly does NOT do

No real-store mutation (fixtures only; the dual-write is dormant by config), no un-refusing the
`migrate-v1` CLI real path (that stays refused until C2b-2's runbook), no cutover, no round-trip
contract test (C4).
