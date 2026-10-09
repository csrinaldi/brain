# Proposal (#1207)

On a branch never pushed, `brain:ship` passed every local gate and called `mrCreate`, which failed with a raw GraphQL error. Measured on both phase-1 demo consumers (#1204).

Decision: option (a), REFUSE. Before any forge call `ship` confirms the head exists on the remote and equals local HEAD; if not it exits 1 and names the push. `ship` never pushes: a push is Tier 2 (`agent-authorities.md`), and a push inside `ship` would be one more way around the `pre-push` hook's intent.
