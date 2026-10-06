import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkReadiness } from './codex.readiness.mjs';

// The route `harness/readiness.mjs` resolves for a codex cold-review (its resolution is tested in harness/readiness.test.mjs).
const route = { required: true, stage: 'cold-review', engine: 'codex', model: 'gpt-5.5', identity: 'cold-review:codex/gpt-5.5' };

test('reports bounded actionable diagnostics for absent, old, and unauthenticated routed Codex', () => {
  assert.match(checkReadiness(route, { commandExists: () => false }).diagnostic, /npm install -g @openai\/codex/);
  assert.match(checkReadiness(route, {
    commandExists: () => true,
    run: () => ({ status: 0, stdout: 'codex-cli 0.153.0' }),
  }).diagnostic, /0\.154\.0 or newer/);
  assert.match(checkReadiness(route, {
    commandExists: () => true,
    run: (bin, args) => args[0] === '--version'
      ? { status: 0, stdout: 'codex-cli 0.154.0' }
      : { status: 1, stderr: 'not logged in' },
  }).diagnostic, /codex login/);
});

test('accepts a supported authenticated CLI and names remaining runtime checks without exposing credentials', () => {
  const result = checkReadiness(route, {
    commandExists: () => true,
    run: (bin, args) => args[0] === '--version'
      ? { status: 0, stdout: 'codex-cli 0.154.0' }
      : { status: 0, stdout: 'Logged in' },
  });
  assert.deepEqual(result, {
    ready: true,
    required: true,
    diagnostic: 'Codex 0.154.0 is authenticated for cold-review:codex/gpt-5.5; the review run verifies model access, network, writable isolated state, and the read-only sandbox.',
  });
});
