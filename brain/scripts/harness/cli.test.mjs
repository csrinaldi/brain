// scripts/harness/cli.test.mjs — unit tests for the SDD harness dispatcher.
//
// Acceptance criteria:
//   (a) resolveHarness: env var (SDD_HARNESS) wins over .env file value.
//   (b) resolveHarness: .env value used when env var absent.
//   (c) resolveHarness: defaults to 'gentle-ai' when both absent.
//   (d) dispatch: calls 'init' on the resolved backend (injectable fake).
//   (e) dispatch: unknown harness → throws a clear error.
//   (f) dispatch: unknown op → throws a clear error.
//   (g) dispatch: backend missing 'init' export → throws a clear error.
//
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

// RED: these imports fail until cli.mjs exports resolveHarness + dispatch.
import { resolveHarness, dispatch, VALID_OPS } from './cli.mjs';

// ── (a) resolveHarness: env var wins ─────────────────────────────────────────

test('resolveHarness: env SDD_HARNESS wins over envVars', () => {
  const result = resolveHarness({
    env: { SDD_HARNESS: 'from-env' },
    envVars: { SDD_HARNESS: 'from-file' },
  });
  assert.equal(result, 'from-env');
});

// ── (b) resolveHarness: .env value used when env var absent ──────────────────

test('resolveHarness: envVars used when env var absent', () => {
  const result = resolveHarness({ env: {}, envVars: { SDD_HARNESS: 'from-file' } });
  assert.equal(result, 'from-file');
});

// ── (c) resolveHarness: defaults to gentle-ai ────────────────────────────────

test('resolveHarness: defaults to gentle-ai when both absent', () => {
  const result = resolveHarness({ env: {}, envVars: {} });
  assert.equal(result, 'gentle-ai');
});

test('resolveHarness: defaults to gentle-ai when env is empty object and no envVars', () => {
  const result = resolveHarness({ env: {} });
  assert.equal(result, 'gentle-ai');
});

// ── (d) dispatch: calls init on the resolved backend ─────────────────────────

test('dispatch: calls init on the resolved backend', async () => {
  const calls = [];
  const fakeBackendLoader = async () => ({
    init: async () => { calls.push('init'); },
  });
  await dispatch('gentle-ai', 'init', [], { backendLoader: fakeBackendLoader });
  assert.deepEqual(calls, ['init']);
});

test('dispatch: forwards extra args to the backend function', async () => {
  const received = [];
  const fakeBackendLoader = async () => ({
    init: async (...args) => { received.push(...args); },
  });
  await dispatch('gentle-ai', 'init', ['extra-arg'], { backendLoader: fakeBackendLoader });
  assert.deepEqual(received, ['extra-arg']);
});

// ── (e) dispatch: unknown harness → error ────────────────────────────────────

test('dispatch: unknown harness (backend not found) → rejects with clear message', async () => {
  const failLoader = async (harness) => {
    throw new Error(`Cannot find module ./backends/${harness}.mjs`);
  };
  await assert.rejects(
    dispatch('nonexistent', 'init', [], { backendLoader: failLoader }),
    /nonexistent/,
  );
});

// ── (f) dispatch: unknown op → error ─────────────────────────────────────────

test('dispatch: unknown op → rejects with clear message', async () => {
  await assert.rejects(
    dispatch('gentle-ai', 'foo', [], { backendLoader: async () => ({}) }),
    /unknown op 'foo'/,
  );
});

// ── (g) dispatch: backend missing the op → error ─────────────────────────────

test('dispatch: backend missing init export → rejects with clear message', async () => {
  const emptyBackend = async () => ({});   // no 'init' exported
  await assert.rejects(
    dispatch('gentle-ai', 'init', [], { backendLoader: emptyBackend }),
    /does not implement op 'init'/,
  );
});

// ── VALID_OPS export ──────────────────────────────────────────────────────────

test('VALID_OPS includes init', () => {
  assert.ok(Array.isArray(VALID_OPS));
  assert.ok(VALID_OPS.includes('init'));
});
