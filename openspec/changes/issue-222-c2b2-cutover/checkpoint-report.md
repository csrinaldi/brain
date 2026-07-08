# Checkpoint Report — CP-C2b-2

> **Change:** `issue-222-c2b2-cutover` · **Slice:** C2b-2 (THE CUTOVER — code + runbook, NO real mutation) · **Branch:** `feat/issue-222-c2b2-cutover` (base `feature/v2.0.0`)
> **Issue:** #222 (`status:approved`). **Depends on:** #221 C2b-1 (machinery), merged.
> **Status: STOPPED at CP-C2b-2, BEFORE any real-store mutation.** PR-as-review.
> **Verdict requested (yours):** review the FULL `runbook.md`, the un-refused CLI, and the rehearsed rollback. **The real cutover keystroke is @csrinaldi's — only after your APPROVE.**

## 0. Scope
Pull-the-trigger machinery, as CODE + a committed runbook. Un-refuse the `migrate-v1` CLI, ship a rehearsed rollback, and the cutover runbook. **Nothing in this PR mutates the real `.memory/`** — the first real mutation is @csrinaldi's post-APPROVE keystroke, executed per the runbook.

## 1. What was built
- **CLI un-refused** (`cli.mjs`, REQ-C2B2-1) — `memory:migrate-v1` without `--dry-run` executes `runMigration` (was refused in C2-migrate). `--dry-run` unchanged. The abort-if-populated guard + its "run the cutover runbook" message are preserved.
- **`rollbackMigration()` + `--rollback`** (REQ-C2B2-2) — the inverse of the real run: restore chunks from `legacy/`, remove `records/` + the persisted report, reindex → **byte-identical** pre-cutover state.
- **`runbook.md`** (committed artifact, REQ-C2B2-3) — numbered steps (0 preflight+backup, 1 migrate real, 2 commit `dualWrite=true`, 3 verification share, 4 post-cutover criteria), each with an exact command + observable verification, the dual-write flip as step 2, and the rollback as its own section with **rehearsal evidence**.
- **`BRAIN_MIGRATE_V1_TEST_ROOT`** test seam — so no test ever runs against the real `.memory/`.
- **Design carry-over:** the scrub-asymmetry recategorization (ACCEPTED, not deferred; re-architecture REJECTED) folded into design.md Decision 5 + the stale "deferred" wording in issue-221's design.md corrected.

## 2. Design decisions (design.md)
1. Un-refuse; execution lives in the runbook, safe by construction while `memory.dualWrite` is false + abort-if-populated protects re-runs. 2. Rollback is a REHEARSABLE command (not prose) — an unrehearsed rollback is a hope. 3. **Human gate:** agent preps + rehearses + STOPS; @csrinaldi keystrokes the real run only with the external APPROVE (first irreversible mutation = human act). 4. The `dualWrite=true` flip is runbook step 2 (committed state marker). 5. The scrub enforcement asymmetry is ACCEPTED design; the full-gate re-architecture is REJECTED, not deferred. 6. Post-cutover criteria are exact (275/3/4/0) and abort-on-divergence.

## 3. Budget & baseline
**139 / 400** counted (`*.test.mjs` + `openspec/changes/**` excluded). `npm test` → **1042 pass, 0 fail** (strict TDD). `brain:repo:check` clean · `brain:nav` green. **`brain/core/` NOT touched** → `brain-writes-reviewed` **PASSES**.

## 4. Rehearsed rollback — byte-identical restore (the ruling's centerpiece)
Independently rehearsed (function-level, sha256 per chunk file):
```
PRE-CUTOVER   chunks/: c1.jsonl.gz:a9edb1eb5765 | c2.jsonl.gz:e9bccc90e203
AFTER MIGRATE records/ populated · legacy/: c1,c2,migration-rejected.json · chunks/: (empty)
AFTER ROLLBACK chunks/: c1.jsonl.gz:a9edb1eb5765 | c2.jsonl.gz:e9bccc90e203 · records/: removed · {restored:2, indexCount:0}
✓ BYTE-IDENTICAL RESTORE — chunks bit-for-bit, records/ gone
```
Automated: `rollbackMigration: ...byte-identical...` (lib) + `migrate-v1 --rollback restores a migrated fixture` (CLI subprocess). The runbook's rollback section carries the CLI-level rehearsal transcript.

## 5. Adversarial review — INLINE (fresh-context delegation blocked; documented)
The fresh-context review sub-agent **failed on an account session limit** mid-run (not a code issue). Per the incident rule (tool unavailability is not a waiver), I performed the closest audit inline; the **external review at this checkpoint is the fresh-context gate** (you read the full runbook + diff). Inline findings — **no blockers**:
- **Test seam airtight** — every `cli.migrate-v1.test.mjs` invocation passes `BRAIN_MIGRATE_V1_TEST_ROOT` to a fresh temp dir; `.memory/` is provably clean after `npm test` (verified). No path runs the real cutover.
- **Un-refuse safe** — abort-if-populated + the "run the cutover runbook" message preserved (tested); runnable-but-safe (dualWrite false → no delta-loss) and recoverable (`--rollback`). A premature/accidental real migrate is a recoverable split state, accepted per the ruling.
- **Rollback correct** — byte-identical restore verified; edges handled (absent `legacy/`, report cleanup, `legacy/`-dir removal, `records/` force-remove).
- i18n en/es parity holds (new keys `realRunSummary`, `rollbackSummary`); the runbook's `--rollback` command matches the implemented flag.

## 6. Substrate
`brain:governance-status` → **RUNG 1**. 5 REQUIRED must be green; `brain-writes-reviewed` PASSES (no `brain/core`); `actor-check` red = solo-maintainer L5 DETECTION (expected).

## 7. What happens after your APPROVE (NOT in this PR)
On CP-C2b-2 APPROVE + merge, **@csrinaldi runs the cutover runbook** against the real store: step 1 migrate (the real mutation), step 2 commit `dualWrite=true`, step 3 verification share, step 4 post-cutover criteria. The **real-run report must equal the forecast (275 fallback / 3 rejected named / 4 empty / 0 unparseable)** — any divergence STOPS the cutover. That real-run report is the evidence of the cutover itself (post-merge, human-executed), distinct from this prep PR.

## 8. Next
- After the cutover: **C4** — the round-trip contract test (both directions, id-equality) + the `pull` → records-only switch (dropping the dual-write chunks + retiring `memory.dualWrite`).

---

**Awaiting the external CP-C2b-2 verdict.** PR-as-review against `feature/v2.0.0`, `Part of #222`. Nothing merged; nothing mutated. The cutover keystroke is @csrinaldi's, only with the APPROVE.
