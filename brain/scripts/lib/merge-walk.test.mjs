// merge-walk.test.mjs — unit tests for lib/merge-walk.mjs's baseline-resolution
// helpers (issue #324 fix round — B2).
//
// `resolveBaseline`/`makeGitIsAncestor` moved here from brain-audit.mjs so
// brain-metrics can share the EXACT same baseline decision brain-audit makes
// (design D1: shared code prevents drift between measurement and enforcement).
// Before this fix, brain-metrics had no baseline awareness at all, so it
// reported gate failures on merges brain-audit itself never evaluated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveBaseline, makeGitIsAncestor } from './merge-walk.mjs';

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function commit(git, dir, message) {
  git('commit', '--allow-empty', '-m', message);
}

test('resolveBaseline: a valid ref resolves and carries no warning', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: initial');
  git('tag', 'v0.1.0');

  const { ref, warning } = resolveBaseline('v0.1.0', dir);
  assert.equal(ref, 'v0.1.0');
  assert.equal(warning, null);
});

test('resolveBaseline: a null/undefined baseline resolves to null, no warning', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-null-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(resolveBaseline(null, dir), { ref: null, warning: null });
  assert.deepEqual(resolveBaseline(undefined, dir), { ref: null, warning: null });
});

test('resolveBaseline: an unresolvable ref falls back to null WITH a warning message (caller decides where it goes)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-invalid-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: initial');

  const { ref, warning } = resolveBaseline('v99.0.0-nonexistent', dir);
  assert.equal(ref, null);
  assert.match(warning, /v99\.0\.0-nonexistent/);
  assert.match(warning, /does not resolve/i);
});

test('makeGitIsAncestor: true when baseline is an ancestor of sha', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-ancestor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: base');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  commit(git, dir, 'chore: after');
  const after = git('rev-parse', 'HEAD').stdout.trim();

  const isAncestor = makeGitIsAncestor(dir);
  assert.equal(isAncestor(base, after), true);
});

test('makeGitIsAncestor: false when baseline is NOT an ancestor of sha', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-ancestor-not-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: base');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  git('checkout', '-b', 'side');
  commit(git, dir, 'chore: side commit');
  const side = git('rev-parse', 'HEAD').stdout.trim();
  git('checkout', 'main');
  commit(git, dir, 'chore: unrelated main commit');
  const mainTip = git('rev-parse', 'HEAD').stdout.trim();

  const isAncestor = makeGitIsAncestor(dir);
  // `side` is NOT an ancestor of mainTip (diverged branch) — baseline is NOT before sha.
  assert.equal(isAncestor(side, mainTip), false);
});
