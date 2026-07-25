---
status: draft
issue: 284
---

# Proposal — Reviewer v2: Refuter Role & Causal Admission (Issue #284)

## What

Upgrade the automated reviewer framework (`brain:review`) to version 2 (`brain-review/2`) by implementing:
1. **The Refuter Role**: A read-only, single-batch adversarial role to evaluate inferential blocker findings emitted by LLM reviewers and eliminate persuasive false positives.
2. **Causal Admission (`brain-review/2` schema)**: Adding `evidence_class` (`deterministic | inferential | insufficient`) and `causal_disposition` (`introduced | behavior-activated | worsened | pre-existing | base-only | unknown`) to findings, enforcing the hard rule that only findings caused by the candidate (`introduced`, `activated`, `worsened`) can block a PR.
3. **Local Subagent Cold Evaluation & Token-Saving Pipeline**:
   - Driving cold evaluation locally via subagents / local `pre-push` / `pre-pr` hooks using developer credentials (no central server CI token required).
   - Enforcing 4 token-saving filters: $0-token deterministic pre-checks (`npm test`, `repo:check`), risk-scaled lens selection (0/1/4), diff-only ignoreList, and lazy refuter execution.
   - Deterministic structural regex pre-checks ($0 tokens) for issue `## FORK` rulings.
4. **Genesis Scope & Preflight Preservation**: Incorporating Chapter 21's rules for locking genesis candidate paths and preserving raw payloads on execution failures.

## Why

Track H (#266) delivered `brain-review/1` infrastructure, cold-boot worktrees, read-only VCS port, deny-sets, and CLI flows. However, as identified in Chapter 21 (*"Verifiable Trust"*) and team workflow analysis:
- **False Positives**: LLM reviewers occasionally generate persuasive inferential blocker claims. Without a refuter role, these false positives either block valid PRs or force unnecessary manual intervention.
- **Scope Creep / Pre-existing Defects**: Without causal admission, pre-existing defects or flaky tests in the base branch are treated as candidate blockers, turning the review into an unbounded scope-expansion machine.
- **Real-World CI Credentials & Token Costs**: Central server API tokens are rare in individual developer workflows. Cold reviews must run locally via subagents over hooks using developer credentials, with aggressive deterministic pre-checks to minimize token consumption.

## Scope

### Included
- **Refuter Role (`brain/scripts/review/evaluators/refuter.mjs`)**: Read-only single-batch evaluator over inferential blocker findings. Emits `corroborated`, `refuted`, or `inconclusive`.
- **`brain-review/2` Schema**: Updated verdict schema supporting `evidence_class` and `causal_disposition`.
- **Emitter Hard Admission Gate**: Hard rule in `verdict.mjs` ensuring only candidate-causal findings (`introduced`, `activated`, `worsened`) can produce a `REVISE` or `STOP` verdict. `pre-existing` and `base-only` findings map to non-blocking follow-up records.
- **Local Subagent Cold Execution & Token Savings**: Integration with local subagents, `pre-push` hooks, $0-token test/check filters, diff-only ignoreList, and regex pre-checks for issue `## FORK` rulings.
- **Genesis Paths & Preflight Capture**: Enforcing frozen candidate path boundaries and raw payload safety.

### Excluded (Deferred with Explicit Opening Criteria per Issue #284)
- **Risk-Scaled Review Depth (0/1/4 Lens Selection Automation)**: Full automated risk classifier deferred until measured tranche cost data from real H1 runs demonstrates that a risk classifier would safely skip ≥30% of reviews.
- **Frozen Cumulative Correction Line Accounting**: Deferred until H1 evidence shows REVISE cycle thrashing not caught by the `rev >= 3` cap.
