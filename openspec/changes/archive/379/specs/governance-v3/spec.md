### [issue-379] governance-v3 delta — T2.1 issue-scoped memory-gate

This is a delta over `openspec/specs/governance-v3/spec.md` — it adds one requirement
(REQ-L3-4) to the existing Level 3 section. See that file (post-merge) for the full,
merged spec; this delta documents only what T2.1 adds.

## Added Requirement: REQ-L3-4 — `memory-gate` Is Issue-Scoped

REQ-L3-1's `memory-gate` job MUST NOT stop at a global existence check once the current
change's issue number is detectable. `brain/scripts/governance/run-check.mjs` MUST
resolve the issue number the current PR/MR targets from `ctx.body` (reusing this file's
own existing `extractIssueNumber`/`requiresClosingKeyword` — no new extraction
implementation), then filter `.memory/records/` observations to `record.issue ===
issueNumber` (via `checks/memory-retrieval.mjs`'s `memoryRetrieval(observations,
issueNumber)`) before verifying coverage. The gate MUST:

- FAIL when no record at all is scoped to the issue (memory cache MISSING).
- PASS with a WARN-flavored reason (`pass: true`, non-blocking — this contract has no
  distinct warn exit code) when scoped records exist but none is a `session_summary`
  (PARTIAL coverage).
- PASS cleanly when a scoped `session_summary` exists (HIT).
- FALL BACK to the pre-existing global `memoryPresence()` check (REQ-L3-1's original
  behavior) when no issue number can be resolved from `ctx` — either `ctx.body` is
  absent (non-string) or `ctx.body` is present but carries no detectable issue
  reference.

[**unit-testable**: `memoryRetrieval` is a pure evaluator (fixture-testable, no I/O);
the wrapper (`runMemoryGateCheck`) and its fallback are covered by `run-check.test.mjs`]

#### Scenario: PR references an issue and a scoped session_summary exists

- GIVEN `ctx.body` contains a detectable issue reference (e.g. `Closes #379`) resolving to issue N
- AND `.memory/records/` contains a `session_summary` record with `issue === N`
- WHEN the `memory-gate` job runs
- THEN it passes cleanly

#### Scenario: PR references an issue but no record is scoped to it

- GIVEN `ctx.body` resolves to issue N
- AND no record in `.memory/records/` has `issue === N` (even if other issues' records exist)
- WHEN the `memory-gate` job runs
- THEN it fails, citing issue N by number

#### Scenario: PR references an issue with scoped records but no session_summary

- GIVEN `ctx.body` resolves to issue N
- AND `.memory/records/` has at least one record with `issue === N`, but none has `type === 'session_summary'`
- WHEN the `memory-gate` job runs
- THEN it passes (`pass: true`) but the reason flags partial/warn coverage — non-blocking

#### Scenario: No issue number is detectable — fallback to the global check

- GIVEN `ctx.body` is absent, or present but contains no closing keyword or "Part of #N" reference
- WHEN the `memory-gate` job runs
- THEN it degrades to the pre-T2.1 global `memoryPresence()` check (passes if ANY `session_summary` exists anywhere in `.memory/records/`)
