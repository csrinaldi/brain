// brain-check.test.mjs — TDD tests for brain:check (REQ-S5-2)
//
// brain:check runs the 4 governance checks + npm test + repo:check against the
// current branch's diff vs base.  Returns a non-zero exit code if any fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Import safety regression ───────────────────────────────────────────────────

test('brain-check: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-check.mjs');
  assert.equal(typeof mod.runCheck, 'function', 'runCheck must be exported');
});

// ── runCheck unit tests (injected dependencies) ───────────────────────────────

/** Build a passing check context stub. */
function makeCtx(overrides = {}) {
  return {
    numstat: '1\t0\tsrc/feature.mjs\n',
    changedFiles: ['src/feature.mjs', '.memory/chunks/session.jsonl.gz'],
    prBody: 'Closes #42',
    ignoreList: [],
    npmTestFn: async () => ({ ok: true }),
    repoCheckFn: async () => ({ ok: true }),
    ...overrides,
  };
}

test('brain-check: all checks pass → exitCode 0', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  const result = await runCheck(makeCtx());
  assert.equal(result.exitCode, 0,
    `expected exit 0 — all pass. Failures: ${JSON.stringify(result.failures)}`);
});

test('brain-check: diffSize fails → exitCode 1', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  // Generate a numstat with 401 added + 0 deleted lines
  const bigNumstat = '401\t0\tsrc/huge.mjs\n';
  const result = await runCheck(makeCtx({ numstat: bigNumstat }));
  assert.equal(result.exitCode, 1, 'expected exit 1 when diffSize fails');
  assert.ok(result.failures.some(f => f.check === 'diffSize'),
    `expected diffSize in failures: ${JSON.stringify(result.failures)}`);
});

test('brain-check: issueLink fails → exitCode 1', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  const result = await runCheck(makeCtx({ prBody: 'no issue reference here' }));
  assert.equal(result.exitCode, 1);
  assert.ok(result.failures.some(f => f.check === 'issueLink'),
    `expected issueLink in failures: ${JSON.stringify(result.failures)}`);
});

test('brain-check: memoryPresence fails → exitCode 1', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  const result = await runCheck(makeCtx({ changedFiles: ['src/only-code.mjs'] }));
  assert.equal(result.exitCode, 1);
  assert.ok(result.failures.some(f => f.check === 'memoryPresence'),
    `expected memoryPresence in failures: ${JSON.stringify(result.failures)}`);
});

test('brain-check: npm test fails → exitCode 1', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  const result = await runCheck(makeCtx({
    npmTestFn: async () => ({ ok: false, output: '1 test failed' }),
  }));
  assert.equal(result.exitCode, 1);
  assert.ok(result.failures.some(f => f.check === 'npmTest'),
    `expected npmTest in failures: ${JSON.stringify(result.failures)}`);
});

test('brain-check: repo:check fails → exitCode 1', async () => {
  const { runCheck } = await import('./brain-check.mjs');
  const result = await runCheck(makeCtx({
    repoCheckFn: async () => ({ ok: false, output: '1 prohibited reference' }),
  }));
  assert.equal(result.exitCode, 1);
  assert.ok(result.failures.some(f => f.check === 'repoCheck'),
    `expected repoCheck in failures: ${JSON.stringify(result.failures)}`);
});
