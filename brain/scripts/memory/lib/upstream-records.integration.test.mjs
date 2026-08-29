// upstream-records.integration.test.mjs — issue #701, requirement 5's other
// half no unit test can state: real git, a real trunk-present record, a real
// `dualWriteRecords()` run against it, and a real merge afterward.
//
// Mirrors records-merge.integration.test.mjs's pattern (temp repos, a `git()`
// helper, `t.after` cleanup) and dualWriteRecords()'s own "testable core
// independent of requireEngram()" seam discipline: only `_readObservations`/
// `_exportObservation` are stubbed (there is no real engram binary here);
// `_appendRecord`, `_readRecordIds`, `_rebuildIndex`, and — the point of this
// file — `_upstreamRecordIds` all run for REAL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { removeTempTree } from '../../__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildRecord, serializeRecord } from './format.mjs';
import { appendRecord, readRecords } from './store.mjs';
import { dualWriteRecords } from '../backends/engram.mjs';

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

test('issue #701: a record already merged to origin/main is not re-exported, and stays readable after sync', async (t) => {
  // A bare "remote" plus one working clone stands in for "the trunk".
  const remote = mkdtempSync(join(tmpdir(), 'brain-701-remote-'));
  const trunk = mkdtempSync(join(tmpdir(), 'brain-701-trunk-'));
  const worktree = mkdtempSync(join(tmpdir(), 'brain-701-worktree-'));
  t.after(() => {
    removeTempTree(remote);
    removeTempTree(trunk);
    removeTempTree(worktree);
  });

  git(remote, ['init', '-q', '--bare', '-b', 'main']);

  git(trunk, ['init', '-q', '-b', 'main']);
  git(trunk, ['config', 'user.email', 'test@example.invalid']);
  git(trunk, ['config', 'user.name', 'brain-test']);
  mkdirSync(join(trunk, '.memory', 'records'), { recursive: true });
  writeFileSync(join(trunk, '.gitignore'), '');
  git(trunk, ['add', '.gitignore']);
  git(trunk, ['commit', '-q', '-m', 'init']);
  git(trunk, ['remote', 'add', 'origin', remote]);
  git(trunk, ['push', '-q', '-u', 'origin', 'main']);

  // The worktree branches BEFORE the trunk record exists — the exact shape
  // this ticket is about: the branch point is not where the record lands.
  git(worktree, ['clone', '-q', remote, '.']);
  git(worktree, ['config', 'user.email', 'test@example.invalid']);
  git(worktree, ['config', 'user.name', 'brain-test']);
  git(worktree, ['checkout', '-q', '-b', 'feature/701']);

  // A record lands on the trunk's main AFTER the branch point.
  const trunkRecord = buildRecord({ ...BASE, content: 'Landed on main after the branch point.' });
  appendRecord(trunkRecord, { recordsDir: join(trunk, '.memory', 'records') });
  git(trunk, ['add', '.memory/records']);
  git(trunk, ['commit', '-q', '-m', 'trunk record']);
  git(trunk, ['push', '-q', 'origin', 'main']);

  // The worktree's local `origin/main` must actually see it — same as any
  // `git fetch` a real pre-push/day-start would run.
  git(worktree, ['fetch', '-q', 'origin']);

  // memory:share in the worktree re-materializes the SAME record (the bug):
  // its own engram DB holds it too, and pre-#701 nothing scoped the export.
  const worktreeRecordsDir = join(worktree, '.memory', 'records');
  const accounting = await dualWriteRecords(worktree, {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: trunkRecord, recovered: true }),
  });

  assert.equal(accounting.written, 0, 'the upstream-present candidate must be declined');
  assert.equal(accounting.dedupedUpstream, 1);
  assert.equal(accounting.upstreamScope.applied, true);

  // The load-bearing assertion (requirement 3): nothing untracked appears.
  const status = git(worktree, ['status', '--porcelain', '--untracked-files=all', '.memory/records']);
  assert.equal(status.stdout.trim(), '', `export must not leave an untracked/modified record:\n${status.stdout}`);

  // Requirement 5's other half: once the worktree is ON a commit containing
  // origin/main's copy, the record is present and readable — declining to
  // write it is not the same as losing it.
  git(worktree, ['merge', '--no-edit', 'origin/main']);
  const { records } = readRecords({ recordsDir: worktreeRecordsDir });
  assert.ok(
    records.some((r) => r.id === trunkRecord.id),
    'the declined record must be readable once the worktree holds the trunk copy',
  );

  // A second `share` after the merge offers the SAME candidate again (the
  // operator's engram DB still holds it) — this time it declines via the
  // OWN-records dedup, now that the merge put the file on disk. "Declined"
  // must never mean "deleted": the record already on disk from the merge
  // must survive a run that declines to re-write it.
  const secondRun = await dualWriteRecords(worktree, {
    _readObservations: () => ({ observations: [{ id: 1 }] }),
    _exportObservation: () => ({ record: trunkRecord, recovered: true }),
  });
  assert.equal(secondRun.written, 0);
  const afterSecondRun = readRecords({ recordsDir: worktreeRecordsDir });
  assert.ok(
    afterSecondRun.records.some((r) => r.id === trunkRecord.id),
    'a decline must never delete the merged-in copy that is already on disk',
  );
});
