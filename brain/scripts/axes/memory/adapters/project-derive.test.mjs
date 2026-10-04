// project-derive.test.mjs — #1273: the memory adapters stamp a record with the repository, not the
// directory it happened to be checked out in. From an isolated worktree (#782) an empty tracked
// slug used to stamp the worktree dir name; the origin is the repository's real name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { testTmp } from '../../../lib/test-tmp.mjs';
import { deriveProject as engramDerive } from './engram.mjs';
import { deriveProject as plainDerive } from './plainfiles.mjs';

function worktreeNamed(name, origin) {
  const root = join(testTmp('derive-'), name);
  mkdirSync(root, { recursive: true });
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  if (origin) git('remote', 'add', 'origin', origin);
  return root;
}

for (const [label, derive] of [['engram', engramDerive], ['plainfiles', plainDerive]]) {
  test(`#1273 ${label}: empty slug + origin, run from a differently named dir, yields the origin repo name`, () => {
    const root = worktreeNamed('brain-issue-1273', 'git@github.com:acme/widgets.git');
    assert.equal(derive({ project: { slug: '', name: '' } }, root), 'widgets');
  });
  test(`#1273 ${label}: a tracked slug still wins over the origin`, () => {
    const root = worktreeNamed('anything', 'git@github.com:acme/widgets.git');
    assert.equal(derive({ project: { slug: 'org/tracked' } }, root), 'tracked');
  });
  test(`#1273 ${label}: no slug and no origin keeps the name, then the directory, fallback`, () => {
    const root = worktreeNamed('some-dir', null);
    assert.equal(derive({ project: { name: 'named' } }, root), 'named');
    assert.equal(derive({ project: {} }, root), 'some-dir');
  });
}

for (const [label, derive] of [['engram', engramDerive], ['plainfiles', plainDerive]]) {
  test(`#1273 ${label}: a declared project.name beats the origin (empty slug)`, () => {
    const root = worktreeNamed('brain-issue-1273', 'git@github.com:acme/widgets.git');
    assert.equal(derive({ project: { slug: '', name: 'my-team-name' } }, root), 'my-team-name');
  });
}
