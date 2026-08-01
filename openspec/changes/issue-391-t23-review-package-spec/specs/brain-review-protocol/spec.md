### [issue-391] brain-review-protocol — 2026-07-31

# `brain-review/2` Schema Specification (Delta)

## Purpose

Formalizes the `brain-review/2` verdict schema as a documented, tiered protocol alongside `brain-review/1`. Version `/2` is fully implemented in production code (`schema-v2.mjs`, `verdict.mjs`) but was never promoted to formal doctrine, creating a specification-implementation gap that blocks M3 work.

## Scope

This delta spec documents:
- `evidence_class` field: `deterministic | inferential | insufficient`
- `causal_disposition` field: `introduced | behavior-activated | worsened | pre-existing | base-only | unknown`
- `follow_ups[]` field: findings routed out of the blocking set
- The hard admission rule: only `introduced | behavior-activated | worsened` findings block; `pre-existing | base-only` route to `follow_ups`
- The `unknown` disposition: forces `escalate: human` and `STOP`, never silently admitted

## Non-Goals

- This spec does not activate `/2` in production (`cli.mjs:204-216` still defaults to `/1`). Activation is design.md's responsibility.
- This spec does not change existing `/1` behavior or parsers — both protocols coexist.

## Requirements

| Req | Name |
|---|---|
| REQ-BRP2-1 | `evidence_class` MUST be one of: `deterministic`, `inferential`, `insufficient` |
| REQ-BRP2-2 | `causal_disposition` MUST be one of: `introduced`, `behavior-activated`, `worsened`, `pre-existing`, `base-only`, `unknown` |
| REQ-BRP2-3 | Findings with `causal_disposition: pre-existing \| base-only` are routed to `follow_ups[]`, never block |
| REQ-BRP2-4 | Findings with `causal_disposition: unknown` force `verdict: STOP` and `escalate: human`, regardless of conclusion |
| REQ-BRP2-5 | A `/2` verdict with `findings.length > 0` but all findings routed to `follow_ups` MAY render as `APPROVE` (soft admission) |
| REQ-BRP2-6 | `parse-verdict.mjs` accepts both `/1` and `/2` fenced blocks in the same verdict thread (backward-compatible) |

---

See `brain/core/methodology/reviewer-protocol.md` §6 for the full schema definition and rendering rules.
