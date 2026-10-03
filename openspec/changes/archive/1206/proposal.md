# Proposal (#1206)

`brain:ship` refuses an issue with no `type:*` label at the last step, after the work is done. Nothing earlier asks for it; `ticket:start` silently fell back to a `feat/` branch type. Measured on both phase-1 demo consumers (#1204).

Fix: `ticket:start` refuses (exit 1) before creating any branch or worktree, using the same `findTypeLabel` as `ship`, and names the fix.
