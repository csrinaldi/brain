// run-check.test.mjs — Unit tests for the thin run-check.mjs runner (REQ-L3-1, REQ-L3-2)
//
// CI FRAGILITY: never let these tests read real git state or the real cwd's
// .memory/chunks/ — always inject readChunks / diffNameOnly fakes.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runCheck, main } from './run-check.mjs';

async function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return logs;
}

// ── memory-gate ──────────────────────────────────────────────────────────────

test('runCheck: memory-gate — injected chunks include session_summary → pass', () => {
  const result = runCheck('memory-gate', {
    readChunks: () => [{ type: 'session_summary', title: 'x' }],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: memory-gate — injected chunks have no session_summary → fail with reason', () => {
  const result = runCheck('memory-gate', { readChunks: () => [{ type: 'decision' }] });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: memory-gate — never calls readChunkObservations with a raw fs read (uses injected reader)', () => {
  let receivedCwd;
  runCheck('memory-gate', {
    cwd: '/fake/cwd',
    readChunks: (cwd) => {
      receivedCwd = cwd;
      return [{ type: 'session_summary' }];
    },
  });
  assert.equal(receivedCwd, '/fake/cwd');
});

// ── decision-gate ────────────────────────────────────────────────────────────

test('runCheck: decision-gate — injected diff has HOME.md but no ADR file → fail with reason', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => ['brain/HOME.md', 'src/other.mjs'],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: decision-gate — injected diff has ADR file and HOME.md → pass', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => ['brain/project/decisions/adr-0099-foo.md', 'brain/HOME.md'],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: decision-gate — injected diff touches neither ADR nor HOME.md → pass (non-architectural PR)', () => {
  const result = runCheck('decision-gate', { diffNameOnly: () => ['src/whatever.mjs'] });
  assert.deepEqual(result, { pass: true });
});

// ── unknown check ────────────────────────────────────────────────────────────

test('runCheck: unknown check name throws', () => {
  assert.throws(() => runCheck('not-a-real-check', {}), /unknown check/i);
});

// ── main() — exit-code + printed-reason smoke test ───────────────────────────

test('main: memory-gate passing → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('memory-gate', { readChunks: () => [{ type: 'session_summary' }] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});

test('main: memory-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('memory-gate', { readChunks: () => [] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('decision-gate', { diffNameOnly: () => ['brain/HOME.md'] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate passing (non-architectural PR) → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('decision-gate', { diffNameOnly: () => ['src/foo.mjs'] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});
