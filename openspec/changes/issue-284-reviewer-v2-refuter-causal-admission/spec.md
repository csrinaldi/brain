---
status: draft
issue: 284
---

# Delta Specification — Reviewer v2: Refuter Role & Causal Admission (Issue #284)

## Requirements

### REQ-H2-1: Refuter Role Execution
The refuter MUST run as a single-batch, read-only process evaluating all inferential blocker findings in a candidate review.
- **Scenario 1.1**: If 1 or more findings are marked with `evidence_class: inferential` and `severity: blocker`, the refuter is invoked in a single batch.
- **Scenario 1.2**: For each finding, the refuter evaluates the claim and returns an outcome of `corroborated`, `refuted`, or `inconclusive`.
- **Scenario 1.3**: Findings with outcome `refuted` remain recorded in the verdict payload but MUST NOT contribute to a blocking `REVISE` condition.
- **Scenario 1.4**: Findings with outcome `inconclusive` MUST force `escalate: human`.

### REQ-H2-2: `brain-review/2` Schema Definition
The verdict emitter MUST support `protocol: brain-review/2` with mandatory `evidence_class` and `causal_disposition` fields per finding.
- **`evidence_class` enum**: `deterministic | inferential | insufficient`
- **`causal_disposition` enum**: `introduced | behavior-activated | worsened | pre-existing | base-only | unknown`

### REQ-H2-3: Emitter Causal Admission Rules
The verdict emitter MUST enforce admission gates before assigning blocking status to a finding.
- **Scenario 3.1**: A finding with `causal_disposition` equal to `introduced`, `behavior-activated`, or `worsened` IS ADMISSIBLE as a potential blocker.
- **Scenario 3.2**: A finding with `causal_disposition` equal to `pre-existing` or `base-only` MUST NOT trigger a `REVISE` or `STOP` verdict. It MUST be emitted as a non-blocking `follow_up`.
- **Scenario 3.3**: A finding with `causal_disposition` equal to `unknown` MUST force `escalate: human`.

### REQ-H2-4: Schema Parser Backwards Compatibility
The parser (`lib/parse-verdict.mjs`) MUST parse both `brain-review/1` and `brain-review/2` blocks cleanly without error.

### REQ-H2-5: Genesis Scope & Preflight Preservation
The cold-boot runner MUST record the snapshot of initial candidate paths (`genesis_paths`).
- **Scenario 5.1**: Fixes or corrections MUST NOT introduce untracked paths outside `genesis_paths`.
- **Scenario 5.2**: Preflight checks MUST validate capture readiness before invoking reviewer or refuter roles.

### REQ-H2-6: Subagent Local Cold Evaluation Runtime
The reviewer CLI (`brain:review`) MUST support execution driven by local subagents using the developer's local environment credentials without requiring a central server API token.
- **Scenario 6.1**: Local cold evaluation MUST create the detached worktree at `/tmp/brain-review-<sha>` and execute deterministic pre-checks first ($0 tokens for failing tests).
- **Scenario 6.2**: On success of pre-checks, the subagent evaluates only the candidate diff in isolation and posts the `brain-review/2` verdict comment to the VCS PR or issue.

### REQ-H2-7: Deterministic Issue FORK Pre-checks (Token Savings)
The issue ruling evaluator (`ruling.mjs`) MUST perform deterministic regex validation on the issue `## FORK` structure before making any LLM API call.
- **Scenario 7.1**: If the `## FORK` section is absent, carries fewer than 2 options, misses `cost:` / `consequence:` fields, or has multiple/zero `Recommendation:` lines, it MUST abort immediately with $0 LLM token cost.
- **Scenario 7.2**: On valid structure, only the isolated `## FORK` section payload (~300 tokens) is passed to the evaluation prompt.
