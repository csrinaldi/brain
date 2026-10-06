// The descriptor leaf for the `codex` runtime (#1128, #1129). It imports NOTHING, so the
// registry and the validators can read it without loading the adapter's graph
// (the #682 cycle rule). Contract: brain/core/methodology/agent-platform-contract.md.
export const DESCRIPTOR = Object.freeze({
  name: 'codex',
  capabilities: Object.freeze({ orchestrate: false, executeStage: true }),
  stage: Object.freeze({
    outputMode: 'final-message', // the runner materialises the artifact from the final message
    model: Object.freeze({ policy: 'pinned', id: 'gpt-5.5' }),
  }),
  readiness: true,
});
