// The descriptor leaf for the `antigravity` runtime (#1128, #1129). It imports NOTHING, so the
// registry and the validators can read it without loading the adapter's graph
// (the #682 cycle rule). Contract: brain/core/methodology/agent-platform-contract.md.
export const DESCRIPTOR = Object.freeze({
  name: 'antigravity',
  rank: 2,
  capabilities: Object.freeze({ orchestrate: true, executeStage: false }),
  readiness: false,
});
