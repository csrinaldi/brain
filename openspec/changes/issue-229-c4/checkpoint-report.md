# Checkpoint Report — CP-C4

> **Change:** `issue-229-c4` · **Slice:** C4 (CLOSE THE TRANSITIONAL WINDOW) · **Branch:** `feat/issue-229-c4` (base `feature/v2.0.0` @ 79db2e0)
> **Issue:** #229 (`status:approved`). **Depends on:** C2b-2 (#222, the cutover — merged as #225).
> **Status: STOPPED at CP-C4, PRE-MERGE (not pre-push).** PR-as-review (protocol since #213). Nothing merged; `feature/v2.0.0` unchanged until your APPROVE.
> **Verdict requested:** review the full diff + this report from your clone. One item needs an explicit ruling — **MAJOR-1** (created_at re-stamp), §5.

## 0. Scope
Close the post-cutover transitional window: make `records/` the sole read+write truth. Retire `memory.dualWrite`, drop the transitional chunks path, switch pull/import to records-only, pin the round-trip contract on the real store, and END the embargo.

## 1. What was built (strict TDD, RED→GREEN per unit)
| Deliverable | Commit | Summary |
|---|---|---|
| **D4 + finding 7** | `f2ae1a8` | memory-gate goes records-only (`readChunks` dropped from run-check.mjs). Folds in cutover finding 7 (id:388): `_defaultChangedChunkFiles` now excludes porcelain deletions (+ `existsSync` guard in scrubChunkFile) → the live ENOENT is fixed. |
| **D3 dualWrite** | `abd8954` | Retire-by-deletion, 3 moves: delete the gate (`engram.mjs:176` → record-write UNCONDITIONAL); delete the key from root `brain.config.json`; remove the 0.6.0 migration entry from `brain/core/config-migrations.mjs`. |
| **D2 pull records-only** | `e18dad0` | `importMemory()` rewired: read `records/` → `importRecord()` → `engram save` per record with progress. IDEMPOTENT via `topic: record.id` (engram topic_key upsert, NOT the 15-min content-hash window). |
| **D1 round-trip contract** | `83e7f9e` | id/hashInput equality (source hash-excluded, C2a pin) over the REAL store — 275 records exercised. |
| **Review fixes** | `f7b5ae0` | `--scope` now passed (honors importRecord's declared scope); D1 empty-store uses real `t.skip()` (was a false-green `return`); created_at limitation disclosed in code. |

## 2. Budget & baseline
Counted diff (`*.test.mjs` + `openspec/changes/**` excluded) ≈ **195 / 400** — no `size:exception`. `npm test` → **1056 pass, 0 fail**.

## 3. dualWrite retire-by-deletion — the never-shipped verification (move-3 evidence)
Removing a migration entry is normally forbidden. It is honest HERE because the entry was **never shipped**:
```
$ git tag --contains 654e86c   # the commit (C2b-1, #223) that added the 0.6.0 memory.dualWrite entry
(empty — NO tag contains it)
654e86c is only on feature/v2.0.0, never on main, and NOT an ancestor of tag v0.6.0.
```
→ no released consumer ever ran this migration; deletion strands nobody. **Doctrine pinned:** never-shipped keys retire by deletion (pre-release is free); the FIRST post-release retirement will use tolerate-and-ignore+warning (not built speculatively now); destructive-migration+schemaVersion-bump rejected. C4 is the THIRD slice to touch `brain/core/config-migrations.mjs` (after #215, #223) — `brain-writes-reviewed` PASS+warn, no new ceremony.

## 4. Round-trip contract (D1) — real-store result
`computeRecordId(exportObservation(importRecord(r)).record) === r.id` holds for **all 275 real records** (135 in `2026-06.jsonl` + 140 in `2026-07.jsonl`, currently 100% `@legacy` actor). The `issue`-without-`source` edge (renders `**Fuente:** issue #N`, round-trips by id) is covered by the pre-existing synthetic pin (`engram-import.test.mjs:46-60`) — that exact shape does not occur in the real store, declared honestly (no faked coverage).

## 5. Fresh adversarial review (opus, clean context) — NO BLOCKERS
Confirmed sound: unconditional `share()` write (only call path; re-run protected by id-dedup); migration chain coherent post-removal (`schemaVersion` computed dynamically → 0.5.0; no dangling refs); idempotency mechanism correctly identified (topic_key upsert, verified against engram Go source); finding-7 filter excludes all deletion states without over-exclusion; D1 contract non-tautological. Two MINORs fixed (`f7b5ae0`). One item needs YOUR ruling:

**🔴 MAJOR-1 (ruling needed) — records-only pull re-stamps `created_at`.** `engram save` has no timestamp flag, so hydrated observations get engram's wall-clock insert time; `importRecord` computes `created_at` from `record.ts` but the verb discards it. The old `engram sync --import` preserved timestamps; records-only cannot. **NOT data loss** — `records/` keeps the correct `ts` (source of truth); engram is a rebuildable cache; idempotency unaffected. **IS** a fidelity regression: local recency-ordered engram search is skewed after each pull. Disclosed in code (`_defaultEngramSave` comment). **Recommendation: ACCEPT as documented + file a follow-up** for engram-side timestamp-preserving ingestion (a `--created-at` flag or a bulk records-import verb) — the real fix is engram-side, out of C4 scope. Alternative: block C4 until timestamps are preservable.

## 6. Open question (deferred, not decided here)
This repo's own `brain.config.json` is stale at `schemaVersion: 0.3.0` (three versions behind) — proof that `brain-upgrade` never ran against the repo itself (the dogfooder doesn't dogfood its upgrades). OUT OF SCOPE for C4 (a blind bump would skip the 0.4/0.5 additive defaults = worse than the drift). Candidate future fix is a guard (repo:check / day:start verifies schemaVersion == latest migration + warns), its own slice. C4 leaves it untouched.

## 7. END OF EMBARGO (declared)
**`memory:pull` is safe again on every clone — now records-based; the chunk path no longer exists, so nothing is left to go stale.** The transitional chunk-based pull embargo (active since the cutover merge) is LIFTED by this PR. Notify PCStaFe30-174. Cross-machine basis: the cutover's PCStaFe30-174 evidence — smoke grep 22/33 == histogram + `memory:reindex` byte-identical (R1 determinism cross-machine).

## 8. Next
On CP-C4 APPROVE + merge: the window is closed, the embargo is lifted, `records/` is the sole truth. Follow-ups (own slices): MAJOR-1 engram timestamp ingestion (if accepted), schemaVersion-drift guard, cutover finding 8 (`.engram→.memory` symlink), `skip:memory-gate` wiring.

---
**Awaiting the external CP-C4 verdict.** PR-as-review against `feature/v2.0.0`, `Part of #229`. Nothing merged. The merge keystroke is the human's, only with APPROVE.
