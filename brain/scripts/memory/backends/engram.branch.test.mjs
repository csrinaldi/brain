// engram.branch.test.mjs — de-dup proof for _getGitBranch (issue #138, PR1).
//
// _getGitBranch is the default `getBranch` dependency used by
// featureCheckpoint/featureResume (engram.mjs:296). After extracting the
// shared `lib/git-branch.mjs#currentBranch`, _getGitBranch becomes a thin
// wrapper: `currentBranch(root) ?? 'unknown'`. This asserts the wrapper
// preserves its existing observable contract — same 'unknown' fallback,
// same real-branch-name pass-through — now backed by the shared primitive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _getGitBranch } from './engram.mjs';

test('_getGitBranch: non-git directory → "unknown"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'engram-branch-'));
  try {
    assert.equal(_getGitBranch(dir), 'unknown');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('_getGitBranch: real git repo on a named branch → branch name', () => {
  // This repo itself is a real git repo on a real branch — exercise the
  // real spawnSync path (no spy) to prove the wrapper is wired correctly.
  const branch = _getGitBranch(process.cwd());
  assert.notEqual(branch, 'unknown');
  assert.equal(typeof branch, 'string');
  assert.ok(branch.length > 0);
});

test('_getGitBranch: never throws', () => {
  assert.doesNotThrow(() => _getGitBranch('/path/does/not/exist/at/all'));
});

test('_getGitBranch: detached HEAD → "unknown" (NOT the literal "HEAD")', () => {
  // Behavior-change guard: the old inline implementation returned the
  // literal 'HEAD' string on detached HEAD. The de-duplicated wrapper must
  // normalize it to 'unknown' like every other failure case.
  //
  // Uses process.cwd() (a real repo on a real named branch) as root, so an
  // un-threaded `_spawn` injection would fall through to the REAL git call
  // and return the actual branch name (not 'unknown') — proving this test
  // actually exercises the injection seam rather than coincidentally
  // passing because the cwd isn't a git repo.
  let calls = 0;
  const _spawn = () => {
    calls++;
    return { status: 0, stdout: 'HEAD\n' };
  };
  const branch = _getGitBranch(process.cwd(), { _spawn });
  assert.equal(calls, 1, 'the injected _spawn spy must be invoked');
  assert.equal(branch, 'unknown');
});
