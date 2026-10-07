// approval-label.mjs — the label that says an issue is approved, declared once (#1342).
// Pure and dependency-free: `status/epic-graph.mjs` (the server) and `ui/lib/state-vocab.mjs` (the browser
// and node:test, D9) both import it, so the rule that classifies a node and the rule that colours it cannot drift.

export const APPROVED_LABEL = 'status:approved';
