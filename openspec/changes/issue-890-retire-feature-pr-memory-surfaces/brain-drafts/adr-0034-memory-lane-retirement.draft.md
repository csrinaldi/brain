# Draft: ADR-0034 feature-memory retirement

**Target**: `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`  
**Issue**: #890  
**Promotion**: Tier-2 maintainer review is required; this draft is not canonical doctrine.

## Proposed amendment

The feature workflow no longer materializes or commits `.memory/` before a feature push.
`brain:memory:save --issue N` writes the durable record, and the enabled memory lane ships
that record independently. `pre-push` retains feature checkpointing, repository checks, and
the diff-size warning. The lane remains opt-in in the config schema; this repository enables
`memory.lane.enabled: true` as an explicit local decision. `memory-gate` evaluation and its
base-plus-head classification are unchanged.

The former `brain:save` command is removed rather than aliased. Operators use the issue-scoped
memory-save command and `brain:next` reports the missing-record state without materializing
memory or inspecting porcelain `.memory/` state.
