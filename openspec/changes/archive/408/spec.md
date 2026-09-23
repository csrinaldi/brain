---
status: draft
issue: 408
---

# Spec

## REQ-408-1 — a producer exists
At least one evaluator path MUST be able to emit `causal_disposition: 'pre-existing'` from an
observation, making `verdict.mjs`'s routing branch reachable in production.

## REQ-408-2 — the claim is observed, never inferred
The disposition MUST come from re-deriving the check at base. A status recorded by someone
else MUST NOT be used where it cannot exist (measurement 1).

## REQ-408-3 — only honestly-comparable findings are classified
A finding whose subject is the diff or the PR MUST NOT be classified against base. The
base-reproducible set MUST be explicit data, not a branch.

## REQ-408-4 — the reproduction mirrors the gate
The commands run at base MUST be the commands the gate runs, including its conditions. Running
more or less than the gate ran makes the claim false.

## REQ-408-5 — lazy
The probe MUST NOT run unless a base-reproducible finding is already a blocker.

## REQ-408-6 — uncomputable keeps blocking, and is not `unknown`
A probe that cannot run MUST leave findings `introduced` and MUST report the inability as a
condition. It MUST NOT set `unknown` (escalation storm) and MUST NOT defer the finding.

## REQ-408-7 — evidence is extended, never replaced
A reclassified finding MUST keep its original evidence alongside the base observation.

## REQ-408-8 — isolation
The base run MUST happen in a detached throwaway worktree, never in the operator's cwd, and
MUST be torn down.

## REQ-408-9 — proven end-to-end
A real run over a PR whose defect exists unchanged at base MUST route it to `follow_ups[]`, and
the inverse (healthy base) MUST keep it blocking. Neither may hand-feed `causal_disposition`.

## REQ-408-10 — nothing invented
`base-only` and `evidence_class: 'inferential'` MUST NOT be produced without an honest
producer. Their absence MUST be stated and pinned.
