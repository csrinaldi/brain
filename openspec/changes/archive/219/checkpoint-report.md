# Checkpoint Report — CP-C2-migrate

> **Change:** `issue-219-migrate-v1` · **Slice:** C2-migrate (the `migrate-v1` tool as fixture-tested CODE) · **Branch:** `feat/issue-219-migrate-v1` (base `feature/v2.0.0` @ `2243b24`)
> **Issue:** #219 (`status:approved`). **Depends on:** #217 C2a (provenance pair + export lib), merged.
> **Status: STOPPED at CP-C2-migrate.** PR-as-review; nothing merged until the external verdict.
> **Verdict requested:** validate the CLI refusal (execution deferred to C2b), the report that names all non-migrated categories, `runMigration`'s fail-safe order, and the honest proposal.

## 0. Scope (human ruling)
C2-migrate = the COMPLETE `migrate-v1` tool as **CODE**, **fixture-tested** — the real EXECUTION against the true store does NOT happen here; it is the C2b cutover (ordered runbook). Reviewed against the 278 real observations via a read-only `--dry-run` + a real run against a synthetic fixture store.

## 1. What was built
- **`runMigration()`** (`migrate-v1.mjs`, injected seams) — idempotency abort FIRST (populated `records/` → throw, message contains `run the cutover runbook` + names the dir) → export each obs → `appendRecord` accepted (bucketed by `ts` month) → **persist a report naming all four non-migrated categories** → **move** chunks to `.memory/legacy/` (never delete) → `rebuildIndex`. Fail-safe order: records + report written before any chunk moves, so a mid-run failure strands nothing.
- **`cli.mjs`** — `--dry-run` unchanged; the non-`--dry-run` path **REFUSES**, routing to the C2b cutover runbook (Option 1 / Decision 5). `runMigration` ships reachable + tested, NOT CLI-fireable.
- **i18n** en+es — the cutover-deferred refusal (parity verified, 8 keys each).

## 2. Design decisions (design.md)
1. Real run is CODE here, EXECUTION is C2b's cutover. 2. Idempotency abort first, message → runbook. 3. No silent loss: **all four categories NAMED** in the persisted report, each present even when empty (a zero is counted-evidence, like the 0-recovered histogram). 4. Evidence = dry-run-vs-real-chunks + real-run-vs-fixture. **5 (this MR): the CLI REFUSES; execution gating lives in the runbook ORDER, not a bypass switch** — the `MIGRATE_V1_CONFIRM`-style flag was rejected with doctrine as the same class as the `--no-scrub` flag C1b prohibited.

## 3. Budget & baseline
**365 / 400** counted (`*.test.mjs` + `openspec/changes/**` excluded). `npm test` → **1001 pass, 0 fail** (strict TDD). `brain:repo:check` clean · `brain:nav` green. **`brain/core/` NOT touched** → `brain-writes-reviewed` **PASSES**.

## 4. Adversarial review (fresh context, opus) — data-safe; all findings resolved
Verdict: no path loses data (chunks always moved, never deleted, and only after all records are written — a moved chunk's data is provably already a record or named in the report). Findings:
- **MAJOR-1 (real-run CLI hid unparseable) — resolved by Decision 5:** the CLI no longer prints a real-run summary at all (it refuses); surfacing unparseable in the real path is C2b's when it wires execution. The report itself now names them (MAJOR-2).
- **MAJOR-2 (report omitted skips/unparseable) — FIXED:** the persisted report names `rejected` + `skipped` (scope:personal, id/title/type/reason) + `unparseableChunks` + `emptyObservationsChunks`, present even when empty. Guarded by the fixture test (a `scope:personal` obs is now NAMED in `report.skipped`).
- **MINOR-1 (unguarded live real run) — resolved by Decision 5:** the CLI refuses; the footgun (ad-hoc real run before C2b dual-write = delta-loss) is closed by ordering, not a flag.
- **NIT-1 (weak abort test) — FIXED:** the test now asserts ZERO fs effects before the throw (chunk not moved, no `legacy/`, no index).
- **Refuted with evidence:** #1 partial-failure loses no chunk (ordering proof); #4 tests are real-FS integration, not mocked; #6 proposal.md had no false claim *at review time* — but see §5.

## 5. proposal.md over-declaration — caught and corrected (ruling point 4)
After Option 1, the writer's `proposal.md` still claimed the CLI "calls `runMigration()`" / is "wired to `runMigration()`" — now FALSE (the CLI refuses). Corrected to the re-scoped reality (CLI refuses; execution deferred to the C2b runbook) so the proposal cannot seed a lying phase-order. This is exactly the over-declaration the ruling warned about.

## 6. Evidence (verbatim)
- **Star (dry-run over a temp COPY of the REAL `.memory/chunks/`, `.memory` untouched):**
  `records: 275 | provenance: {"recovered":0,"fallback":275} | rejected: 3 | emptyObservations: 4 | unparseable: 0`.
  Rejected NAMED: `obs-2a96b57742106649 type=manual "temp search"`; `obs-976ce2ce59f26e97 type=preference "Convention: chained PRs use a tracker/history branch…"`; `obs-f74beee30f67572d type=preference "Rule: comments in core AND scripts must be English…"`.
- **Real-run over a synthetic fixture store:** `writes accepted records, moves chunks to legacy, persists the rejection report (all four categories, skips NAMED), rebuilds the index`; `idempotency abort … throws BEFORE any work … zero fs effects`; `re-run over a just-migrated fixture aborts`.

## 7. Substrate
`brain:governance-status` → **RUNG 1**. 5 REQUIRED green; `brain-writes-reviewed` PASSES (no `brain/core`); `phase-order` PASSES; `actor-check` red = solo-maintainer L5 DETECTION (expected).

**phase-order incident (self-introduced, gate-caught, fixed):** the first push failed `phase-order` (DETECTION) — Rule A (artifact completeness) requires proposal+spec+design+tasks when impl code is present, and I had shipped this change dir WITHOUT `spec.md`. Added the missing `spec.md` (REQ-MIG-RUN-1..4); reproduced the check locally (`level: pass`) before re-pushing. The gate did exactly its job: caught an incomplete SDD phase set.

## 8. What this completes / next
- C2-migrate = the migration tool, provably correct against fixtures, NOT fired against the real store.
- **Next: C2b** — import (`renderProvenance`) + scrub re-point `chunks/`→`records/` + dual-write + **THE CUTOVER** (the real execution, ordered by the runbook: migrate → immediately dual-write → scrub re-pointed). C4 round-trip = id-equality (`sdd/memory-format/c4-roundtrip-equality`).

---

**Awaiting the external CP-C2-migrate verdict.** PR-as-review against `feature/v2.0.0`, `Part of #219`, nothing merged.
