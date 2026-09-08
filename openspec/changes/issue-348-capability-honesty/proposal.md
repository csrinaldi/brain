---
issue: 348
phase: proposal
---

# Proposal — brain asks the platform what it can enforce, and says what it did not

## The ruling this implements

#348 asked: implement GitLab's approval-count enforcement, or ratify the gap?
**Ratify** — and stop reporting the gap as enforcement.

Implementing would call GitLab's approval-rules API, which is Premium. That
trades a PROVIDER asymmetry for a PLAN asymmetry: harder to explain, and
impossible to honour for Free users anyway. Ratifying silently is worse — the
function today returns `{ enforced: true }` over a parameter it ignored.

## Measured, per account type, against brain's own rung ladder

`substrate.mjs` already declares the ladder (1 merge · 2 release · 3
auto-correct · 4 floor), and `capabilities()` already probes the platform at
runtime rather than encoding a price list.

| platform / account | protected branch | approval count | rung |
|---|---|---|---|
| GitHub Free, public | yes | yes | 1 |
| GitHub Free, private | **no** (`capabilities()` says so, with a remedy) | no | **2** |
| GitHub paid | yes | yes | 1 |
| **GitLab Free** | **yes** — all plans | **no** — Premium | **1** |
| GitLab Premium/Ultimate | yes | yes | 1 |

The asymmetry is not where it looks: **GitLab Free is stronger than GitHub
Free-private for brain.** GitHub loses rung 1 entirely; GitLab keeps it and
loses only the count.

## Why ratifying does not degrade the agent–human premise

Measured across `actor-check.mjs`, `brain-writes-reviewed.mjs` and the gate
matrix: the human signature rests on `status:approved` + actor-check +
brain-writes-reviewed — CI gates, not platform features. `requiredReviews`
appears in NO path of that loop; only `brain:protect` consumes it, and
`tierParams` sets it to lite=0, standard=1, regulated=1.

The approval count is a belt over braces. Losing it on GitLab Free does not
touch the human-in-the-loop. Losing **rung 1** would — and GitLab Free does not.

## Scope

1. `capabilities()` answers for **`approvalCount`** the way it already answers
   for `hardEnforcement` — `available` / `unavailable` / `unknown` plus an
   actionable `remedy` — on BOTH providers, by probing rather than by encoding
   who pays for what.
2. `branchProtect` reports what it applied and what it did not, instead of a
   bare `{ enforced: true }` over an ignored parameter.
3. `brain:governance-status` surfaces the new axis beside the existing one.

## Non-goals

No approval-rules call. No pricing matrix in code — a platform's plans change
and a hardcoded table would be wrong on a schedule nobody controls. PR #346's
bidirectional source-scan lock stays and keeps forcing this decision open if
anyone adds the call.
