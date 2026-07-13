# Design — THE CUTOVER (slice C2b-2)

Un-refuse the CLI, ship the runbook + a rehearsed rollback. NO real mutation in this PR; the real run is
@csrinaldi's post-APPROVE keystroke.

## Decision 1 — un-refuse the CLI; execution now lives in the runbook, safely

The non-`--dry-run` `migrate-v1` path executes `runMigration()` (C2-migrate Decision 5 deferred the
execution here). The window between this merge and the human keystroke is safe by construction:
`memory.dualWrite` is still **false** (C2b-1), so even a premature migrate cannot strand shares as
chunks-only (the delta-loss vector is closed at the config gate, not the CLI); and `runMigration`'s
abort-if-populated still protects re-runs. The CLI being runnable IS the runbook's intended step 1 — the
control is the runbook order + the human keystroke, not a CLI switch (the `--no-scrub` class stays
rejected).

## Decision 2 — the rollback is a REHEARSABLE command, not prose

Restore chunks from `.memory/legacy/`, remove `records/`, reindex → pre-cutover state. Shipped as a
command (fixture-testable) so the runbook references an exact command AND the rollback is **rehearsed in a
fixture with its output captured as evidence** before the real run. An unrehearsed rollback is a hope, not
a rollback (ruling). The rehearsal asserts byte-identical restoration against a pre-migration snapshot.

## Decision 3 — the human gate: agent preps + STOPS; @csrinaldi keystrokes only with the external APPROVE

The agent ships the un-refused CLI, the rollback command, and the runbook; rehearses the rollback in
fixture; verifies every non-mutating precondition; and STOPS at CP-C2b-2. The external review reads the
FULL runbook there. **@csrinaldi executes the real mutating cutover** — the first irreversible real-store
mutation — only after the external APPROVE. Same principle as promotion to `brain/`: executing the
irreversible is a human act. No code/test/artifact in this PR touches the real `.memory/`.

## Decision 4 — the cutover materializes through git: one atomic commit + a PR (CP-C2b-2 REVISE gap 1)

The cutover is NOT a direct push. Steps run on a branch `cutover/records-v1`; **ONE atomic commit
carries the migrated store AND `brain.config.json` `memory.dualWrite=true` together** (the flip is not a
separate commit — it lands with the migrated store so there is never a window with one but not the
other). The cutover **completes when the PR to `feature/v2.0.0` merges** — that is when the shared world
changes. This preserves rung-1 (no direct-push/bypass), the gates pass by design, and the merge is the
single auditable event. The `memory.dualWrite` marker is still the committed C2b-1 Decision 5 state
marker — now materialized inside the atomic cutover commit.

**Measured gap 2 (CP-C2b-2 REVISE):** the first post-cutover `share` does NOT re-materialize the migrated
chunks — engram's export is manifest-tracked and writes only the delta. The manifest becomes stale
relative to `chunks/` (migrated chunks are in `legacy/`), so the old chunk-based cross-machine `pull` is
degraded for the transitional window (NOT data loss — `records/` is the committed truth, retired at C4).
Measured against a copy of the real store; evidence + the adjusted step-3 verification are in
runbook.md + checkpoint-report.md §5b.

## Decision 5 — the scrub enforcement asymmetry is ACCEPTED design, the full-gate re-architecture is REJECTED (not deferred)

Records get full pre-write scan-then-write; chunks get C1b's post-materialization backstop. This asymmetry
is CORRECT, not a gap to close later (recategorized from C2b-1's earlier "deferred" wording, per the
CP-C2b-1 ruling):
- **Enforcement mirrors ownership:** brain writes records → can pre-scan; engram writes chunks (its binary
  materializes them) → only backstop, without reaching across the adapter boundary.
- **Failure costs are asymmetric in the same direction:** a secret in the committed, unerasable records log
  is catastrophic; a secret in a local chunk with the push blocked is contained.
- **Transitional by construction:** dies with the chunks (post-C3/C4).
Re-architecting `share` to materialize chunks ourselves (to gate both pre-write) is **REJECTED — no future
agent builds it** (`sdd/memory-format/scrub-asymmetry-accepted`). This slice also corrects issue-221's
design.md Decision 1 wording from "deferred" to this.

## Decision 6 — post-cutover success criteria are exact and abort-on-divergence

The real report MUST equal the dry-run forecast: **275 fallback, 3 rejected NAMED (manual×1, preference×2),
4 emptyObservations, 0 unparseable**, `legacy/` populated, index rebuilt. **Any divergence STOPS the
cutover and is explained before proceeding** — a mismatch means reality diverged from the fixture model and
must be understood, not pushed through. Plus: re-run aborts (idempotency), `memory:pull`/import works
against the new world, and a smoke `git clone + grep` over `records/` answers a real project question
(ADR-0002's promise made command).
