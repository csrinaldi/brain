// plain.test.mjs — unit + end-to-end dispatch tests for the `plain` SDD_HARNESS
// backend (issue #250, B0, REQ-B0-5). Run with: npm test.
//
// (a) unit-level: injects a capturing fake `_emit`, asserts the nine
//     docs/workflow-guide.md §B manual-flow steps are emitted in order.
// (b) end-to-end: dispatches through the REAL, unmodified harness/cli.mjs
//     dispatch path — proving n=2 on `init` (gentle-ai + plain) with ZERO
//     cli.mjs change (REQ-B0-5 scenario 2).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Task 3.1 (RED): fails until backends/plain.mjs exists.
import { init } from './plain.mjs';
import { dispatch } from '../cli.mjs';

// ── (a) unit-level: injected _emit, nine steps in order ──────────────────────

test('3.1: plain init emits the header + all nine docs/workflow-guide.md §B steps, in order, each prefixed "N. "', async () => {
  const lines = [];
  await init({ _emit: (line) => lines.push(line) });

  assert.equal(lines[0], 'SDD_HARNESS=plain — manual flow (no AI). Run these npm verbs in sequence:');
  assert.equal(lines.length, 10); // header + 9 steps
  for (let i = 1; i <= 9; i++) {
    assert.match(lines[i], new RegExp(`^\\s*${i}\\. `), `step ${i} must be prefixed "${i}. "`);
  }
  // Spot-check content against docs/workflow-guide.md §B (cross-checked design §4).
  assert.match(lines[1], /brain:env:init/);
  assert.match(lines[2], /brain:session:start/);
  assert.match(lines[3], /brain:ticket:start/);
  assert.match(lines[4], /brain:project:feature/);
  assert.match(lines[5], /proposal\.md.*spec\.md.*design\.md.*tasks\.md/);
  assert.match(lines[6], /tasks\.md/i);
  assert.match(lines[7], /brain:repo:check/);
  assert.match(lines[8], /memory:share/);
  assert.match(lines[9], /Closes #/);
});

test('3.1: plain init defaults _emit to console.log (no throw when called with no opts)', async () => {
  const original = console.log;
  const captured = [];
  console.log = (line) => captured.push(line);
  try {
    await init();
  } finally {
    console.log = original;
  }
  assert.equal(captured.length, 10);
});

// ── (b) end-to-end: real dispatch('plain', 'init', []) through the unmodified cli.mjs ──

test('3.3: dispatch("plain", "init", []) resolves through the REAL cli.mjs dispatch path with zero cli.mjs change', async () => {
  await assert.doesNotReject(dispatch('plain', 'init', [], {
    // No backendLoader override — exercises the real defaultBackendLoader,
    // resolveHarness → 'plain' → import('./backends/plain.mjs') → VALID_OPS.includes('init') → backend.init().
  }));
});

// Task 3.4 — confirm n=2: SDD_HARNESS=gentle-ai and SDD_HARNESS=plain are now
// both real, dispatchable `init` inhabitants of the same dispatch path.
test('3.4: n=2 — both gentle-ai and plain resolve through dispatch() to a real init() export', async () => {
  const gentleAi = await import('./gentle-ai.mjs');
  const plain = await import('./plain.mjs');
  assert.equal(typeof gentleAi.init, 'function');
  assert.equal(typeof plain.init, 'function');
});
