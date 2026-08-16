// staged-records-check.integration.test.mjs — issue #701, the I/O half of
// the gate against a real git repo (mirrors
// lib/upstream-records.integration.test.mjs's pattern).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildRecord, serializeRecord } from './lib/format.mjs';
import { appendRecord } from './lib/store.mjs';
import { runStagedRecordsCheck, main } from './staged-records-check.mjs';

function git(cwd, args, { allowFailure = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}

const BASE = {
  ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

/**
 * A worktree, branched BEFORE the trunk record exists (`.gitignore`-only
 * init, matching `upstream-records.integration.test.mjs`'s shape — the
 * branch point is precisely NOT where the record lands), fetched AFTER the
 * trunk record is pushed so `origin/main` sees it locally.
 */
function worldWithTrunkRecord(t) {
  const remote = mkdtempSync(join(tmpdir(), 'brain-701-gate-remote-'));
  const trunk = mkdtempSync(join(tmpdir(), 'brain-701-gate-trunk-'));
  const worktree = mkdtempSync(join(tmpdir(), 'brain-701-gate-worktree-'));
  t.after(() => {
    rmSync(remote, { recursive: true, force: true });
    rmSync(trunk, { recursive: true, force: true });
    rmSync(worktree, { recursive: true, force: true });
  });

  git(remote, ['init', '-q', '--bare', '-b', 'main']);
  git(trunk, ['init', '-q', '-b', 'main']);
  git(trunk, ['config', 'user.email', 'test@example.invalid']);
  git(trunk, ['config', 'user.name', 'brain-test']);
  writeFileSync(join(trunk, '.gitignore'), '');
  git(trunk, ['add', '.gitignore']);
  git(trunk, ['commit', '-q', '-m', 'init']);
  git(trunk, ['remote', 'add', 'origin', remote]);
  git(trunk, ['push', '-q', '-u', 'origin', 'main']);

  git(worktree, ['clone', '-q', remote, '.']);
  git(worktree, ['config', 'user.email', 'test@example.invalid']);
  git(worktree, ['config', 'user.name', 'brain-test']);
  git(worktree, ['checkout', '-q', '-b', 'feature/701']);

  const record = buildRecord({ ...BASE, content: 'Already durable on the trunk.' });
  const recordsDir = join(trunk, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  appendRecord(record, { recordsDir });
  git(trunk, ['add', '.memory/records']);
  git(trunk, ['commit', '-q', '-m', 'trunk record']);
  git(trunk, ['push', '-q', 'origin', 'main']);
  git(worktree, ['fetch', '-q', 'origin']);

  return { worktree, record };
}

test('issue #701 gate: staging a byte-identical re-export of the trunk record REFUSES', (t) => {
  const { worktree, record } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const path = join(recordsDir, `2026-07-${record.id}.jsonl`);
  // The exact accident this ticket is about: `share` (pre-#701, or the fix's
  // own residual on an unavailable ref) materializes the SAME bytes as an
  // untracked file, and the operator `git add`s it.
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(path, serializeRecord(record) + '\n', 'utf8');
  git(worktree, ['add', '.memory/records']);

  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'fail');
  assert.deepEqual(result.offending, [`.memory/records/2026-07-${record.id}.jsonl`]);
});

test('issue #701 gate: a genuinely new staged record ALLOWS', (t) => {
  const { worktree } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const newRecord = buildRecord({ ...BASE, content: 'Brand new, never seen upstream.' });
  mkdirSync(recordsDir, { recursive: true });
  appendRecord(newRecord, { recordsDir });
  git(worktree, ['add', '.memory/records']);

  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'pass');
});

test('issue #701 gate: nothing staged under .memory/records/ ALLOWS', (t) => {
  const { worktree } = worldWithTrunkRecord(t);
  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'pass');
  assert.deepEqual(result.offending, []);
});

test('issue #701 gate main(): a refusal exits 1 and prints the lossless remedy', async (t) => {
  const { worktree, record } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const path = join(recordsDir, `2026-07-${record.id}.jsonl`);
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(path, serializeRecord(record) + '\n', 'utf8');
  git(worktree, ['add', '.memory/records']);

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  let code;
  try {
    code = await main({ root: worktree });
  } finally {
    console.log = originalLog;
  }
  assert.equal(code, 1);
  assert.ok(logs.some((l) => l.includes('git restore --staged')), `expected the remedy to be printed; got:\n${logs.join('\n')}`);
});
