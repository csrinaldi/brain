# Proposal — THE CUTOVER (slice C2b-2)

> **Status:** planned · **Issue:** #222 (`status:approved`)
> **Depends on:** #221 C2b-1 (machinery), merged into `feature/v2.0.0`.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md) · [runbook.md](runbook.md).

## Context

C2b-1 shipped the records-as-write-truth machinery, DORMANT by config. C2-migrate shipped `runMigration`
(fixture-tested), with the CLI real path REFUSED. This slice pulls the trigger: it un-refuses the CLI so
`memory:migrate-v1` executes the real run as the runbook's step 1, ships the **cutover runbook** as a
committed artifact with a **rehearsed rollback**, and flips `memory.dualWrite=true` as a committed
runbook step.

## What this slice ships (CODE + artifacts — NO real mutation in the PR)

1. **Un-refuse the CLI** — the non-`--dry-run` `migrate-v1` path executes `runMigration()` (fixture-tested).
2. **A rollback command** (`memory:migrate-v1 --rollback` or equivalent) — restore chunks from `.memory/legacy/`, remove `records/`, reindex → pre-cutover state. Built TDD, **rehearsed in a fixture store**, its output captured as CP evidence.
3. **`runbook.md`** — the committed cutover runbook (numbered steps, exact commands, observable verification per step, the `memory.dualWrite=true` flip as step 2, rollback as its own rehearsed section).

## The human gate (ruling — non-negotiable)

The agent prepares everything, rehearses the rollback in fixture, and **STOPS at CP-C2b-2**. The external
review reads the FULL runbook at that checkpoint. **@csrinaldi triggers the real mutating cutover** — only
after the external APPROVE. Executing the first irreversible real-store mutation is a human act, the same
principle as promotion to `brain/`. Nothing in this PR mutates the real `.memory/`.

## Out of scope (deferred to C4)

- The round-trip **contract test** (both directions) · the `pull` → records-only switch (dropping the
  dual-write chunks + retiring `memory.dualWrite`).

## Acceptance criteria (CP-C2b-2 — prep only, no real run)

- [ ] CLI un-refused; `memory:migrate-v1` (no `--dry-run`) executes `runMigration` (fixture-proven).
- [ ] Rollback command restores a fixture store to byte-identical pre-cutover state; its rehearsal output is captured.
- [ ] `runbook.md` complete: numbered steps + exact commands + per-step verification + the dualWrite flip (step 2) + the rehearsed rollback section.
- [ ] Post-cutover success criteria written against the forecast (275/3/4/0).
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green; `.memory/` (real store) untouched by code, tests, and this PR.
