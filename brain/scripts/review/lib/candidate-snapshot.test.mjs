import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, chmodSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { removeTempTree } from '../../__fixtures__/tmp-tree.mjs';
import { compareCandidateSnapshots, snapshotCandidate } from './candidate-snapshot.mjs';

test('candidate snapshots refuse an absent root and measure paths, bytes, and modes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'candidate-snapshot-'));
  t.after(() => removeTempTree(root));
  assert.throws(() => snapshotCandidate(join(root, 'missing')), /directory/);

  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested', 'file.txt'), 'before\n');
  const before = snapshotCandidate(root);
  writeFileSync(join(root, 'nested', 'file.txt'), 'after\n');
  assert.equal(compareCandidateSnapshots(before, snapshotCandidate(root)).equal, false, 'byte changes must invalidate a candidate');

  writeFileSync(join(root, 'added.txt'), 'new\n');
  const added = snapshotCandidate(root);
  chmodSync(join(root, 'added.txt'), 0o755);
  assert.equal(compareCandidateSnapshots(added, snapshotCandidate(root)).equal, false, 'mode changes must invalidate a candidate');
});

test('candidate snapshots classify additions, removals, renames, type changes, and hashes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'candidate-snapshot-diff-'));
  t.after(() => removeTempTree(root));
  writeFileSync(join(root, 'original.txt'), 'same\n');
  const before = snapshotCandidate(root);

  renameSync(join(root, 'original.txt'), join(root, 'renamed.txt'));
  writeFileSync(join(root, 'added.txt'), 'new\n');
  mkdirSync(join(root, 'directory-now'));
  const after = snapshotCandidate(root);
  const comparison = compareCandidateSnapshots(before, after);

  assert.equal(comparison.equal, false);
  assert.deepEqual(comparison.changes.added, ['added.txt', 'directory-now', 'renamed.txt']);
  assert.deepEqual(comparison.changes.removed, ['original.txt']);
  assert.deepEqual(comparison.changes.changed, []);

  rmSync(join(root, 'added.txt'));
  writeFileSync(join(root, 'renamed.txt'), 'changed\n');
  const changed = compareCandidateSnapshots(after, snapshotCandidate(root));
  assert.deepEqual(changed.changes.changed, ['renamed.txt']);
});
