# Proposal: Heal the Engram Store's Pre-Guard Duplicate Rows (#1061, #864 task 1.2a)

## Intent

`MEMORY_BACKEND=engram npm run brain:memory:audit` reports the backend at `rows 2450 · distinct 2447 · duplicated 3`: one import ran twice before the #820 guard. The contract licenses the fix (`brain/core/methodology/memory-backend-contract.md:90-102`, "The adapter MAY delete its own rows for reconciliation"; conformance row `:109` points at this task). The path the task text allowed (`engram.mjs#dualWriteRecords`) was removed by #955/PR #977, so there is no tool to do it. Consumers that ran the same pre-guard import carry the same defect.

## Measured facts (orchestrator, 2026-09-18, engram 1.20.0, read-only)

| topic_key | kept (lowest id) | deleted | content length |
|---|---|---|---|
| `rec-35e09fc539447742` | 3089 `obs-9229525d73068f1b` | 3092 `obs-41d07c12dfe03bd1` | 3327 |
| `rec-4d99842973ef6c5b` | 3090 `obs-9ed0ba42b887011f` | 3093 `obs-93acd79f338334ba` | 2567 |
| `rec-d2ded214bc5d66c1` | 3091 `obs-24accc8cd4b8356c` | 3094 `obs-13a6bb5c7e7c3431` | 2261 |

Each pair: content, title and type identical, same `created_at` second. No exported row has `deleted_at`. `engram doctor --json` shows no pending sync mutation on the six rows.

## Scope

### In Scope
- A tested, reusable heal module: reads an `engram export`, groups by `topic_key`, keeps the lowest observation id, deletes the rest via `engram delete <obs_id>`.
- Dry-run by default; applying requires an explicit flag.
- Refusals (nothing deleted): copies of one key differ in content, title or type; a key has more than two rows; the export shape is unrecognized.
- CLI surface in `brain/scripts/memory/cli.mjs` plus an npm script (e.g. `brain:memory:heal-duplicates`).
- Unit tests over fixture exports (seams as in `audit-io.test.mjs`) and one integration test against a temp store (`ENGRAM_DATA_DIR`).

### Out of Scope
- `.memory/records/` — never read for mutation, never written.
- Record-layer excess (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`): ADR-0017, report, never collapse.
- The real run against `~/.engram` (post-merge maintainer step).
- A permanent self-healing `import`; editing the contract (Tier 2, cite only).

## Decision record (maintainer, 2026-09-18)

1. **Mechanism**: reusable module, not a hand query or one-off script; design decides `backends/engram.mjs` vs `lib/`.
2. **Delete mode**: soft by default IF the integration test proves a soft-deleted row disappears from `engram export` (audit reads `distinct = rows`); otherwise hard. The test decides; design records the result.
3. **Execution**: the maintainer runs it once on the real store (AGENTS.md Tier 2, confirm before executing), after re-checking `engram doctor --json` for pending mutations on the target rows; before/after audit backend lines are pasted on #1061.
4. **Record layer**: out of scope. Task 6.1 must state which layer its "distinct = rows" criterion measures (backend rows vs `.memory/records/`).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- No spec under `openspec/specs/` owns the backend contract or the audit (`rg` found none). The owner is the in-flight epic spec `openspec/changes/issue-864-memory-2-0/spec.md`, "hydration is idempotent by record id" / "measured on the live store" (`:66-74`), with the audit backend row in `issue-870-memory-audit/spec.md:36-44`. The spec phase adds a delta for the heal requirement (dry-run default, refusals, lowest-id-wins, records untouched).

## Approach

| Where | What changes |
|---|---|
| `brain/scripts/memory/{backends/engram.mjs or lib/}` | New heal module: pure plan (export rows → keep/delete/refuse) + thin executor behind `_exec` seam |
| `brain/scripts/memory/cli.mjs` | New `heal-duplicates` verb; `--apply` flag; prints the plan |
| `package.json` | New `brain:memory:heal-duplicates` script |
| tests | Fixture unit tests; temp-store integration test pinned to the tested engram version |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Soft delete not honored by `engram export` | Med | Integration test decides; fall back to hard |
| Shared store is mutated | Med | Dry-run default; Tier 2 confirmation; maintainer-only run |
| Cloud sync propagates or conflicts | Low | `engram doctor --json` re-check right before the run |
| engram 2.0.0 changes export/delete behaviour | Med | Pin the tested version in the test; refuse on unrecognized export shape |

## Rollback Plan

Code: revert the PR. Data: soft delete is reversible (restore the three rows); hard delete is not — the dry-run output and the kept rows (byte-identical) are the recovery reference.

## Success Criteria

- [ ] Dry-run on the real store lists exactly ids 3092, 3093, 3094 and deletes nothing.
- [ ] After the real run, the audit backend line reads `rows 2447 · distinct 2447`.
- [ ] A second run is a no-op.
- [ ] Refusal cases (divergent copies, more than two rows, unknown shape) delete nothing and exit non-zero.
- [ ] `.memory/records/` is byte-unchanged.
