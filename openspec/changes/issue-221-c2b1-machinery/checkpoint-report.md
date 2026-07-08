# Checkpoint Report — CP-C2b-1

> **Change:** `issue-221-c2b1-machinery` · **Slice:** C2b-1 (records-as-write-truth machinery, fixture-tested) · **Branch:** `feat/issue-221-c2b1-machinery` (base `feature/v2.0.0` @ `8c01226`, the #220 merge)
> **Issue:** #221 (`status:approved`). **Depends on:** #217 C2a + #219 C2-migrate, merged. **Followed by:** C2b-2 (#222, the cutover).
> **Status: STOPPED at CP-C2b-1.** PR-as-review; nothing merged until the external verdict.
> **Verdict requested:** the id-equality import, the scan-then-write dual-write (idempotent + honestly accounted), the scrub re-point, and the mechanical-constraint decision (below).

## 0. Scope
Make `.memory/records/` a first-class, scrubbed, round-trippable write target — import + scrub re-point + dual-write in `share`. **Fixture-tested; the real store is NEVER mutated here** (that is C2b-2's human-gated cutover).

## 1. What was built
- **`importRecord()`** (`engram-import.mjs`) — the designed inverse of C2a's `exportObservation`: `renderProvenance` puts provenance back as §4 prose, the R2 title fold is undone, `ts` maps back to engram's naive form. **Contract = id-equality** (not byte equality).
- **`scrubRecordsFile()`** (`secret-scrub.mjs`) — a records-JSONL reader feeding the UNCHANGED `scanTextForSecrets`. **Tested seam for the C2b-2 cutover**; the live `share` records-protection is the pre-write candidate scan (Decision 3, corrected).
- **`dualWriteRecords()` in `share`** — scan-then-write over the records log: `export → scan chunks (C1b backstop) → read observations → transform to candidates → scan candidate lines → dedup by id → append NEW records → reindex`. **Idempotent** (dedup by content-addressed id, existing + within-batch) and **fully accounted** (every observation lands in exactly one bucket).

## 2. Design decisions (design.md)
1. **Scan-then-write over the RECORDS log** — the scan runs on candidates BEFORE any append; a hit aborts before the append-only log is touched. **Mechanical constraint (flagged):** engram's binary materializes chunks during export, so chunks CANNOT be pre-gated — they retain C1b's post-materialization scan as the fail-closed backstop. Gating BOTH outputs pre-write needs a `share` re-architecture (read-only engram dump) — **deferred, flagged for your verdict** (§4). 2. Import is the inverse; contract = id-equality (supersedes MINOR-5). 3. `scrubRecordsFile` is the tested cutover seam, NOT live-wired this slice (corrected). 4. Dual-write is transitional (chunks continue for old pull; pull→records-only is C4). **5. Dual-write is DORMANT by config** — `share` runs it only when `memory.dualWrite === true` (default false, `0.6.0` additive migration); activation is a committed cutover state marker (a runbook step), NOT a merge and NOT the ad-hoc CLI bypass switch rejected in C2-migrate (see §8b).

## 3. Budget & baseline
**~339 / 400** counted (`*.test.mjs` + `openspec/changes/**` excluded). `npm test` → **1036 pass, 0 fail** (strict TDD). `brain:repo:check` clean · `brain:nav` green. **`brain/core/` IS touched** — the additive `0.6.0` config migration (`memory.dualWrite`, config-migrations.mjs, per §9's incident fix) → **`brain-writes-reviewed` WARN expected** (DETECTION, non-blocking, human-reviewed at the PR — as in C1b).

## 4. Mechanical-constraint decision — needs your call at the verdict
The ruling's "gate BOTH writes pre-write" is not achievable as long as `share` materializes chunks via `engram sync --export` (engram writes the `.jsonl.gz` before our code runs). This slice: **records log fully protected** (scan-then-write, nothing secret ever appended); **chunks keep C1b's post-materialization scan** (fail-closed, blocks push — a secret never leaves the machine). Full pre-write gating of both requires re-architecting `share` to materialize chunks ourselves from a read-only engram observation dump — larger, engram-capability-dependent, **deferred and documented, not assumed away**. Accept this split, or pull the re-architecture forward?

## 5. Adversarial review (fresh context, opus) — a BLOCKER + a MAJOR, both fixed & re-verified
- **BLOCKER (FIXED, verified) — the dual-write duplicated the append-only log on every share.** No dedup → `2 obs × N shares = 2N physical lines`. Fixed: `readRecordIds` + dedup by content-addressed id (existing + within-batch). **Verified empirically: 2 obs × 2 shares → 2 lines** (`run2: written:0, deduped:2`) — idempotent.
- **MAJOR (FIXED, verified) — the dual-write silently dropped observations** (throwing export, `{rejected}`, `{skipped:personal}`, unparseable chunks) — the silent twin of `buildMigrationReport`. Violated the ratified epistemic-honesty standard. Fixed: returns `{written, deduped, errored, rejected, skippedPersonal, unparseableChunks, emptyObservationsChunks}`. **Verified: a mixed batch → every observation NAMED in a bucket, none silently gone.**
- **MINOR (fixed):** `share` reordered (chunk backstop BEFORE the records append) so no gate-failure mutates the append-only log; REQ-C2B1-2/Decision-3 wording corrected (`scrubRecordsFile` is the tested seam, not live-wired) + the residual-risk note added.
- **Refuted with evidence:** the R2 unfold mis-split is INERT for id-equality (re-fold is symmetric, id hashes the folded content); id-equality holds for all shapes (supersedes-no-source, marker-in-body, unicode); `serializeRecord` covers every secret vector; no `brain/core` write, i18n en/es parity holds, no fail-open.

## 6. Evidence (verbatim)
- id-equality round-trip: record → import → export → record' preserves `computeRecordId` for issue+source, **issue-WITHOUT-source**, and **@legacy** shapes.
- Idempotency: `a second identical share appends 0 new physical lines`; `two identical observations in the SAME batch collapse to a single physical line`.
- Accounting: `skipped/rejected/errored observations are ALL accounted for — nothing silently dropped`; `_defaultReadObservations surfaces unparseable + emptyObservations buckets`.

## 7. Substrate
`brain:governance-status` → **RUNG 1**. 5 REQUIRED must be green; `brain-writes-reviewed` **WARNs** (the `0.6.0` config migration touches `brain/core` — DETECTION, non-blocking, human-reviewed, as in C1b); `actor-check` red = solo-maintainer L5 DETECTION (expected).

## 8b. The live-wiring incident (self-caught, cleaned up, hardened) — evidence for the verdict
While running `memory:share` as the pre-push scrub gate, the (then live-wired) dual-write executed against the REAL store and wrote `.memory/records/` + `.memory/index.jsonl` — a real, un-gated mutation ahead of any cutover, violating C2b-1's core constraint. **STOPPED, cleaned up** (both untracked → removed; the store was restored). This was the empirical proof of the design flaw the human ruling then hardened: **dual-write must be DORMANT by config** (`memory.dualWrite`, default false), activated only by a committed runbook step, so neither merging C2b-1 nor merging C2b-2 (which un-refuses the CLI) can populate `records/` ahead of the migrate's abort-if-populated guard. **Evidence of the clean end-state:** `git status` of `.memory/` is clean (no `records/`, no `index.jsonl`); the PR diff contains no `.memory/` files; `share()` with `memory.dualWrite` absent proven to never enter the records path. Category recorded in memory: **wiring-vs-shipping** (shipping reachable code is safe; wiring it into an auto-running path is a form of executing it — sister of code-vs-execution).

## 8. What this completes / next
- C2b-1 = records are a scrubbed, idempotent, round-trippable write target — fixture-proven.
- **Next: C2b-2 (#222)** — THE CUTOVER (the real, human-triggered execution against the true store, via the committed runbook + rehearsed rollback). Approve #222 once C2b-1 merges.

---

**Awaiting the external CP-C2b-1 verdict.** PR-as-review against `feature/v2.0.0`, `Part of #221`, nothing merged.
