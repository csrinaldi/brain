// The descriptor leaf for the `claude` runtime (#1128, #1129). It imports NOTHING, so the
// registry and the validators can read it without loading the adapter's graph
// (the #682 cycle rule). Contract: brain/core/methodology/agent-platform-contract.md.
export const DESCRIPTOR = Object.freeze({
  name: 'claude',
  rank: 1,
  capabilities: Object.freeze({ orchestrate: true, executeStage: true }),
  stage: Object.freeze({
    outputMode: 'file', // the engine writes the artifact itself
    model: Object.freeze({ policy: 'opaque' }), // the route's model passes through unchanged
  }),
  readiness: false,
});
