// recording-git.test.mjs — the shim's refusals are themselves pinned (#1201 S1):
// a refusal list nobody tests is a guard that can silently stop guarding.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recordingGit } from './recording-git.mjs';

const run = () => 'ok';

test('#1201 S1: the shim refuses a write verb behind git global options that take a value', () => {
  for (const args of [
    ['-C', 'x', 'checkout', 'y'],
    ['-c', 'a=b', 'worktree', 'add', 'p'],
    ['--git-dir=x', 'reset'],
    ['--git-dir', 'x', 'reset'],
    ['--work-tree', 'w', 'stash'],
    ['--namespace', 'n', 'merge', 'z'],
  ]) {
    assert.throws(() => recordingGit(run)('git', args), /forbidden command/, `refuses git ${args.join(' ')}`);
  }
});

test('#1201 S1: the shim still allows fetch and reads, with or without global options', () => {
  const git = recordingGit(run);
  for (const args of [['-C', 'x', 'fetch', 'origin'], ['fetch', 'origin'], ['-C', 'x', 'for-each-ref'], ['branch', '--list']]) {
    assert.equal(git('git', args), 'ok');
  }
});

test('#1201 S1: the plain forbidden verbs are still refused', () => {
  for (const verb of ['checkout', 'switch', 'reset', 'merge', 'pull', 'push', 'update-ref', 'rebase', 'stash', 'restore', 'clean']) {
    assert.throws(() => recordingGit(run)('git', [verb]), /forbidden command/);
  }
  assert.throws(() => recordingGit(run)('git', ['branch', 'x']), /forbidden command/);
});
