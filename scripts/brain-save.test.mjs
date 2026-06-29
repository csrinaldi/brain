// brain-save.test.mjs — TDD tests for brain:save (REQ-S5-3)
//
// brain:save:
//   1. Calls memory:share (materialises .memory/)
//   2. Detects new uncommitted .memory/ changes via git status --porcelain
//   3. If none → exits 1 with prompt for session summary
//   4. Commits .memory/ with message `chore(memory): sync .memory [brain:save]`

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Import safety regression ───────────────────────────────────────────────────

test('brain-save: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-save.mjs');
  assert.equal(typeof mod.runSave, 'function', 'runSave must be exported');
});

// ── runSave unit tests (injected dependencies) ────────────────────────────────

/** Build a default save context stub. */
function makeCtx(overrides = {}) {
  return {
    memoryShareFn: async () => ({ ok: true }),
    memoryStatusFn: async () => '.memory/chunks/session.jsonl.gz',  // non-empty = changes exist
    gitAddFn: async () => ({ ok: true }),
    gitCommitFn: async (msg) => ({ ok: true, message: msg }),
    ...overrides,
  };
}

test('brain-save: new .memory/ changes exist → commits and exits 0', async () => {
  const { runSave } = await import('./brain-save.mjs');

  const commits = [];
  const result = await runSave(makeCtx({
    gitCommitFn: async (msg) => { commits.push(msg); return { ok: true }; },
  }));

  assert.equal(result.exitCode, 0,
    `expected exit 0, got ${result.exitCode}: ${result.message}`);
  assert.equal(commits.length, 1, 'exactly one commit should be created');
  assert.ok(commits[0].includes('[brain:save]'),
    `commit message should contain "[brain:save]": ${commits[0]}`);
  assert.ok(commits[0].startsWith('chore(memory):'),
    `commit message should follow conventional commit: ${commits[0]}`);
});

test('brain-save: no .memory/ changes after memory:share → exits 1 with prompt', async () => {
  const { runSave } = await import('./brain-save.mjs');

  const result = await runSave(makeCtx({
    memoryStatusFn: async () => '',  // empty = no changes
  }));

  assert.equal(result.exitCode, 1,
    `expected exit 1 (no memory changes), got ${result.exitCode}`);
  assert.ok(result.message.toLowerCase().includes('summary') || result.message.toLowerCase().includes('memory'),
    `message should prompt for session summary: ${result.message}`);
});

test('brain-save: memory:share failure → exits 1 with error message', async () => {
  const { runSave } = await import('./brain-save.mjs');

  const result = await runSave(makeCtx({
    memoryShareFn: async () => ({ ok: false, error: 'engram unavailable' }),
  }));

  assert.equal(result.exitCode, 1,
    `expected exit 1 on memory:share failure, got ${result.exitCode}`);
  assert.ok(result.message.toLowerCase().includes('share') || result.message.toLowerCase().includes('memory'),
    `message should mention the failure: ${result.message}`);
});

test('brain-save: commit message is exactly chore(memory): sync .memory [brain:save]', async () => {
  const { runSave } = await import('./brain-save.mjs');

  const commits = [];
  await runSave(makeCtx({
    gitCommitFn: async (msg) => { commits.push(msg); return { ok: true }; },
  }));

  assert.equal(commits[0], 'chore(memory): sync .memory [brain:save]');
});
