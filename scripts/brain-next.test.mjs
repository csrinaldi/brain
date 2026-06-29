// brain-next.test.mjs — TDD tests for brain:next (REQ-S5-5)
//
// brain:next derives state from (git branch, open PRs, .memory/ status, config)
// and emits the correct next command. Tests each state independently.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Import safety regression ───────────────────────────────────────────────────

test('brain-next: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-next.mjs');
  assert.equal(typeof mod.deriveNext, 'function', 'deriveNext must be exported');
});

// ── deriveNext state tests (injected dependencies) ────────────────────────────

test('brain-next: state=no-branch → suggests brain:start <issue>', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext({
    branch: 'main',
    openPRsFn: async () => [],
    memoryStatusFn: async () => '',
    repoCheckFn: async () => ({ ok: true }),
  });
  assert.ok(result.nextCommand.includes('brain:start'),
    `expected "brain:start" suggestion, got: "${result.nextCommand}"`);
  assert.equal(result.state, 'no-branch');
});

test('brain-next: state=open-PR → emits status message with PR info', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext({
    branch: 'feature/42-my-feature',
    openPRsFn: async () => [{ number: 99, title: 'My PR', headBranch: 'feature/42-my-feature' }],
    memoryStatusFn: async () => '',
    repoCheckFn: async () => ({ ok: true }),
  });
  assert.equal(result.state, 'open-pr');
  assert.ok(result.nextCommand.includes('PR') || result.nextCommand.includes('99'),
    `expected PR info in message: "${result.nextCommand}"`);
});

test('brain-next: state=no-memory → suggests brain:save', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext({
    branch: 'feature/13-add-i18n',
    openPRsFn: async () => [],
    memoryStatusFn: async () => '',  // no .memory/ changes
    repoCheckFn: async () => ({ ok: true }),
  });
  assert.equal(result.state, 'no-memory');
  assert.ok(result.nextCommand.includes('brain:save'),
    `expected "brain:save" suggestion, got: "${result.nextCommand}"`);
});

test('brain-next: state=checks-failing → suggests brain:check', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext({
    branch: 'feature/7-fix-bug',
    openPRsFn: async () => [],
    memoryStatusFn: async () => '.memory/chunks/s.jsonl.gz',  // memory ok
    repoCheckFn: async () => ({ ok: false }),  // checks fail
  });
  assert.equal(result.state, 'checks-failing');
  assert.ok(result.nextCommand.includes('brain:check'),
    `expected "brain:check" suggestion, got: "${result.nextCommand}"`);
});

test('brain-next: state=ready → suggests brain:ship', async () => {
  const { deriveNext } = await import('./brain-next.mjs');
  const result = await deriveNext({
    branch: 'feature/5-implement-feature',
    openPRsFn: async () => [],
    memoryStatusFn: async () => '.memory/chunks/s.jsonl.gz',  // memory ok
    repoCheckFn: async () => ({ ok: true }),  // checks pass
  });
  assert.equal(result.state, 'ready');
  assert.ok(result.nextCommand.includes('brain:ship'),
    `expected "brain:ship" suggestion, got: "${result.nextCommand}"`);
});
