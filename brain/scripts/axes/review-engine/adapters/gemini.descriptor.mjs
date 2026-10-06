// The descriptor leaf for the `gemini` runtime (#1128, #1129). It imports NOTHING, so the
// registry and the validators can read it without loading the adapter's graph
// (the #682 cycle rule). Contract: brain/core/methodology/agent-platform-contract.md.
export const DESCRIPTOR = Object.freeze({
  name: 'gemini',
  capabilities: Object.freeze({ orchestrate: false, executeStage: true }),
  stage: Object.freeze({
    outputMode: 'final-message',
    model: Object.freeze({ policy: 'default', id: 'gemini-2.5-pro' }),
  }),
  readiness: true,
});
