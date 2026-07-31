---
status: draft
issue: 379
epic: 313
artifact_store: openspec
topic_key: sdd/issue-379-t21-memory-retrieval/design
---

# Design: Issue-Scoped memory-gate (T2.1 — Memory Retrieval)

## Context

`memory-gate` is a REQUIRED L3 CI gate (ADR-0015, REQ-L3-1). Its current implementation,
`memoryPresence()`, treats `.memory/records/` as a single undifferentiated pool: ANY
`session_summary` record anywhere satisfies the gate for ANY PR. This is a real
governance hole — a stale `session_summary` from a long-closed issue keeps passing the
gate forever, for every subsequent PR, regardless of whether that PR's own issue was
ever written up. T2.1 closes this by scoping the check to the issue the current change
targets.

Preconditions already met per the epic sequencing: the record schema's optional `issue`
field is already merged (`brain/scripts/memory/lib/format.mjs`'s `buildRecord`), and
`store.mjs`'s `readRecordObservations` already surfaces `.issue` on every parsed record
— no schema or reader change needed here.

## Decision 1 — Fallback-to-global, not fail-closed, when no issue is detectable

**Options considered:**

(a) Fail closed (`pass: false`) whenever no issue number can be resolved from
`ctx.body`.
(b) Fall back to the existing global `memoryPresence()` check.

**Chosen: (b).**

**Rationale:** `memory-gate` is a REQUIRED gate that runs on every PR, including PRs
whose body carries no `Closes #N`/`Part of #N` reference at all — that condition is
ALREADY the job of `issue-link` (a separate, also-REQUIRED gate) to reject. Fail-closing
`memory-gate` on the same missing-reference condition would duplicate `issue-link`'s
job with a different failure message, and — more importantly — would introduce a NEW
blocking surface for every caller that invokes `run-check.mjs` WITHOUT a `ctx` at all
(every existing fixture in `run-check.test.mjs` prior to this change, and any
local/manual invocation of the check). That is explicitly out of scope for T2.1, whose
job is to make the gate issue-*aware* where an issue is resolvable, not to redesign what
happens when it is not. Falling back preserves the EXACT REQ-L3-1 behavior for that
class of caller, byte-for-byte — proven by the "ctx-less call still uses global
fallback" regression test.

**Consequence:** a PR with no resolvable issue reference gets the OLD (weaker) global
guarantee, same as today. This is intentional — `issue-link` is the correct place to
force a reference to exist at all; `memory-gate`'s marginal job here is to make USE of
that reference once `issue-link` has established it, not to re-enforce its presence.

## Decision 2 — WARN (not FAIL) on partial coverage

**Options considered:**

(a) FAIL when scoped records exist but none is a `session_summary`.
(b) PASS (`pass: true`) with an informative reason flagging partial coverage.

**Chosen: (b).**

**Rationale:** The shared `runCheck()` contract (`resultToExit`,
`brain/scripts/governance/postmerge/exit-codes.mjs`) has exactly three outcomes:
`uncomputable: true` → 2, `pass: false` → 1, `pass: true` → 0. There is no fourth "warn"
exit code, and adding one would touch `resultToExit` and every consumer of its contract
— explicitly out of scope (`resultToExit` is unchanged by this proposal). Scoped-but-
no-summary means SOME memory capture happened for this issue (e.g. a `decision` or
`bugfix` record) — partial evidence of engagement, not zero evidence. Treating that the
same as zero scoped records (MISS, which correctly fails) would be a strictly harsher
regression with no compensating signal quality gain, and would block PRs whose author
captured related decisions but has not yet run `mem_session_summary`. This mirrors the
existing precedent in this codebase for "pass with an informative non-blocking reason"
(`evaluateActor()`'s admin-override paths, `runDiffSizeCheck`'s `size:exception` label
path) — success-with-a-reason is an established pattern here, not a new one.

## Decision 3 — Reuse `extractIssueNumber`/`requiresClosingKeyword`, not a third implementation

**Options considered:**

(a) Import `actor-check.mjs`'s exported `extractIssueNumber(prBody, baseBranch)`.
(b) Write a new, memory-gate-specific extraction function.
(c) Reuse `run-check.mjs`'s own private `extractIssueNumber(body, closingRequired)` +
`requiresClosingKeyword(ctx)`.

**Chosen: (c).**

**Rationale:** Three issue-number extraction implementations already coexist in this
codebase for good, documented reasons (`issue-link.mjs`'s shared regexes,
`actor-check.mjs`'s permissive extractor, `run-check.mjs`'s own branch-conditional-
strict extractor mirroring GitHub bash exactly). Adding a FOURTH would be pure
duplication with no new requirement driving it — `memory-gate` does not need
`issue-link`'s default-branch-conditional strictness (which decides which reference
FORM is REQUIRED); it only needs to know the issue number IF one is detectable, which is
exactly what `run-check.mjs`'s existing local functions already compute for
`issue-link`'s own use one function away. Calling
`requiresClosingKeyword(ctx) === true` (coercing `null` — an indeterminate
target/default branch — to `false`) deliberately keeps `memory-gate` PERMISSIVE:
`issue-link`'s null-branch case is a fail-closed REQUIRED-gate concern specific to
deciding which reference form is mandatory; `memory-gate` merely wants the best-effort
issue number if one exists, so an indeterminate branch context degrades to "try the
permissive slice-target extraction order" rather than failing memory-gate on a
condition that is `issue-link`'s to police.

## Architecture

```
runCheck('memory-gate', deps)
  └─ readRecords(cwd)              (unchanged: throws → uncomputable:true, →2)
  └─ runMemoryGateCheck(ctx, records)      [NEW]
       ├─ ctx.body not a string  → memoryPresence(records)        (fallback)
       ├─ issueNumber == null    → memoryPresence(records)        (fallback)
       └─ else                  → memoryRetrieval(records, issueNumber)  [NEW pure evaluator]
                                     ├─ 0 scoped        → { pass: false, reason }   (MISS)
                                     ├─ scoped, no summary → { pass: true, reason: WARN }  (PARTIAL)
                                     └─ scoped summary  → { pass: true, reason }    (HIT)
```

`memory-retrieval.mjs` stays pure (no fs/gh) — same discipline as
`memory-presence.mjs`/`issue-link.mjs`. `run-check.mjs` remains the only file that
touches git/IO/ctx for this gate.

## Test Strategy

TDD RED-first throughout (strict TDD mode active for this project):

1. `memory-retrieval.test.mjs` — pure evaluator: HIT / MISS / PARTIAL / non-array inputs
   / cross-issue exclusion (record for #12 must not satisfy #999) / string-vs-number
   `issue` coercion.
2. `run-check.test.mjs` additions — wrapper: ctx-less fallback (regression), scoped
   hit/miss/partial, no-issue-detectable fallback, readRecords-throws-with-ctx
   regression.

## Rollout

Additive, single PR. No data migration. No new CI job — `memory-gate`'s existing job
registration in `governance.yml`/`GOVERNANCE_JOBS` is unchanged (REQ-L3-1/REQ-L3-3
untouched); this proposal only changes what the EXISTING job's underlying check
computes when it has a resolvable issue number.
