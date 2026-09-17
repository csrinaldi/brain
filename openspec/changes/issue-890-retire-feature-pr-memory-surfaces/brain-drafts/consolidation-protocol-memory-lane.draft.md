# Draft: consolidation protocol memory lane wording

**Target**: `brain/core/methodology/consolidation-protocol.md`  
**Issue**: #890  
**Promotion**: Tier-2 maintainer review is required; agents do not edit `brain/core/**`.

## Proposed amendment

Replace the feature-PR instruction that runs `brain:memory:share` in `pre-push` with the
record-first flow: capture `brain:memory:save --issue N`, then let the enabled memory lane
collect and ship the record. Keep explicit `brain:memory:share` references where they describe
the backend's standalone materialization verb rather than feature-push policy. State that
`memory-gate` remains the unchanged governance check and that feature checkpointing is separate
from durable memory transport.
