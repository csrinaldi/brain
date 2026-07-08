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

## Decision 4 — the `memory.dualWrite=true` flip is runbook step 2 (committed state marker)

Immediately after the real migrate (step 1) populates `records/`, the human commits `memory.dualWrite=true`
(step 2) so subsequent shares dual-write. This is the committed cutover STATE MARKER from C2b-1 Decision 5
— auditable in git, not a merge, not a bypass switch. Ordering (migrate → flip → verified scrub) is the
safety property.

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
