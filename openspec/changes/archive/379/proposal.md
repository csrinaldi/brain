---
status: draft
issue: 379
epic: 313
artifact_store: openspec
topic_key: sdd/issue-379-t21-memory-retrieval/proposal
---

# Proposal: Issue-Scoped memory-gate (T2.1 — Memory Retrieval)

Issue #379. Epic #313 (Tanda 2, T2.1). Change folder:
`openspec/changes/issue-379-t21-memory-retrieval/`.

## Intent

`memory-gate` (ADR-0015, REQ-L3-1) is currently a GLOBAL existence check implemented by
`memoryPresence()` in `brain/scripts/governance/checks/memory-presence.mjs`: it passes
if `.memory/records/` contains AT LEAST ONE `session_summary` observation ANYWHERE,
completely decoupled from which issue the current PR/change is about. A leftover
`session_summary` about issue #12 satisfies the gate for a PR closing issue #999.
ADR-0015's own header comment calls this "the promised-but-unbuilt memory-gate". T2.1
closes this gap by making the gate issue-scoped: it verifies a `session_summary`
specifically scoped to the CURRENT change's issue, not merely any session summary
anywhere.

## Scope

In scope:

- New pure evaluator `brain/scripts/governance/checks/memory-retrieval.mjs`
  (`memoryRetrieval(observations, issueNumber)`): filters `.memory/records/` down to
  `record.issue === issueNumber` and verifies a `session_summary` exists among the
  scoped set. Returns `{ pass, reason }` — FAIL on zero scoped records (MISS), `pass:
  true` with a warn-flavored reason on scoped-but-no-summary (PARTIAL), clean pass on a
  scoped `session_summary` (HIT).
- New wrapper `runMemoryGateCheck(ctx, records)` in
  `brain/scripts/governance/run-check.mjs`: resolves the issue number from `ctx.body`
  (reusing this file's own `extractIssueNumber`/`requiresClosingKeyword`, coerced
  permissively — no new extraction implementation), and either calls `memoryRetrieval`
  (issue resolved) or falls back to the pre-existing `memoryPresence()` global check
  (no issue detectable).
- `runCheck()`'s `memory-gate` branch now calls `runMemoryGateCheck(ctx, records)`
  instead of `memoryPresence(records)` directly — the existing try/catch around
  `readRecords(cwd)` (uncomputable path) is unchanged.
- ADR-0015 (L3 row) and `openspec/specs/governance-v3/spec.md` (new REQ-L3-4) updated to
  document issue-scoping.

Out of scope: any change to `memory-presence.mjs` itself (kept as the fallback,
unchanged and still fully tested), any change to the record schema (the optional
`issue` field already exists on every record via `format.mjs`'s `buildRecord`), and any
change to `resultToExit`/the 0/1/2 exit-code contract (the WARN case stays `pass: true`,
no fourth exit code).

## Approach

See `design.md` for the full rationale: why fallback-to-global (not fail-closed) when no
issue is detectable; why WARN (not FAIL) on partial coverage; why
`extractIssueNumber`/`requiresClosingKeyword` are reused rather than a third extraction
implementation.

## Success Criteria

- `memoryRetrieval()` covers HIT / MISS / PARTIAL / non-array-input / cross-issue
  exclusion / string-vs-number `issue` coercion — all TDD RED-first.
- `runMemoryGateCheck` wiring in `run-check.mjs` covers: ctx-less call still uses the
  global fallback (regression, all prior fixtures untouched); scoped hit passes clean;
  scoped miss fails; scoped partial warns; no-issue-detectable falls back; readRecords
  throwing still returns `uncomputable: true`.
- Zero regressions across the full suite (`npm test`).
- ADR-0015 and `governance-v3/spec.md` (REQ-L3-4) updated in the same change.

## Risks & Rollback

Additive and backward-compatible: every caller that does not pass a resolvable
`ctx.body` (all current fixtures, any local/manual invocation) gets byte-identical
behavior to before this change (global `memoryPresence()`). The only behavior change is
for callers that DO pass a `ctx.body` with a detectable issue reference — this is a
strict tightening (a global pass could previously mask a missing per-issue summary),
never a new false failure for compliant callers who capture a scoped session summary.

Rollback: single revert of the change commit(s). No production data (`.memory/
records/`) is touched or migrated; the schema's optional `issue` field was already
merged separately.
