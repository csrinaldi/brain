// brain-ship.test.mjs — TDD tests for brain:ship (REQ-S5-4)
//
// brain:ship:
//   1. Runs brain:check (via subprocess or injected fn)
//   2. Exits non-zero if any check fails
//   3. Calls mrCreate via VCS adapter with template + `Closes #<issue>` + labels
//   4. Prints PR URL on success

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Import safety regression ───────────────────────────────────────────────────

test('brain-ship: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-ship.mjs');
  assert.equal(typeof mod.runShip, 'function', 'runShip must be exported');
});

// ── runShip unit tests (injected dependencies) ────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    issueNumber: '42',
    project: 'o/r',
    branchName: 'feature/42-my-feature',
    base: 'main',
    checkFn: async () => ({ ok: true }),  // brain:check passes
    mrCreateFn: async ({ title, body, head, base, labels }) => ({
      url: 'https://github.com/o/r/pull/99',
    }),
    ...overrides,
  };
}

test('brain-ship: checks pass + PR created → exitCode 0, prints URL', async () => {
  const { runShip } = await import('./brain-ship.mjs');
  const result = await runShip(makeCtx());

  assert.equal(result.exitCode, 0,
    `expected exit 0, got ${result.exitCode}: ${result.message}`);
  assert.ok(result.url, 'should have a URL');
  assert.ok(result.url.includes('github.com'), `unexpected URL: ${result.url}`);
});

test('brain-ship: brain:check fails → exits 1, no PR created', async () => {
  const { runShip } = await import('./brain-ship.mjs');

  let prCreated = false;
  const result = await runShip(makeCtx({
    checkFn: async () => ({ ok: false, output: '1 check failed' }),
    mrCreateFn: async () => { prCreated = true; return { url: 'X' }; },
  }));

  assert.equal(result.exitCode, 1, `expected exit 1, got ${result.exitCode}`);
  assert.equal(prCreated, false, 'PR must not be created when checks fail');
});

test('brain-ship: PR body contains Closes #<issue>', async () => {
  const { runShip } = await import('./brain-ship.mjs');

  let capturedBody = '';
  await runShip(makeCtx({
    mrCreateFn: async ({ body }) => { capturedBody = body; return { url: 'https://github.com/o/r/pull/1' }; },
  }));

  assert.ok(/closes\s+#42/i.test(capturedBody),
    `PR body must contain "Closes #42": "${capturedBody}"`);
});

test('brain-ship: mrCreate failure → exits 1 with error message', async () => {
  const { runShip } = await import('./brain-ship.mjs');

  const result = await runShip(makeCtx({
    mrCreateFn: async () => ({ url: null, error: 'HTTP 422: Validation failed' }),
  }));

  assert.equal(result.exitCode, 1, `expected exit 1 on mrCreate failure`);
  assert.ok(result.message.includes('422') || result.message.toLowerCase().includes('failed'),
    `message should include error: ${result.message}`);
});
