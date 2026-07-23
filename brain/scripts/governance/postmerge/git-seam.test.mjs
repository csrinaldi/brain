// git-seam.test.mjs — the ONE git primitive the platform-neutral core is
// built on MUST return status, never throw on a non-zero exit (design §4).
// A throw-only boolean seam cannot distinguish e.g. `ls-remote --exit-code`
// status 2 ("no matching ref — proved absent") from status 128
// ("unreachable remote") — that collapse is what produced the F2 bug.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { gitTry, gitOrThrow } from './git-seam.mjs';

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

test('gitTry: status 0 on a successful command, stdout captured', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-seam-ok-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  git('commit', '--allow-empty', '-m', 'init');

  const r = gitTry(['rev-parse', 'HEAD'], { cwd: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^[0-9a-f]{40}$/);
  assert.equal(r.stderr, '');
});

test('gitTry: never throws on a documented non-zero exit (ls-remote --exit-code, no matching ref → 2)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-seam-absent-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  makeRepo(dir);

  assert.doesNotThrow(() => {
    const r = gitTry(['ls-remote', '--exit-code', dir, 'refs/does-not-exist'], { cwd: dir });
    assert.equal(r.status, 2);
  });
});

test('gitTry: never throws on an unrelated failure (unreachable remote → non-zero, non-2)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-seam-unreachable-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  makeRepo(dir);

  const bogus = join(dir, 'does', 'not', 'exist', 'at', 'all');
  const r = gitTry(['ls-remote', '--exit-code', bogus, 'refs/heads/main'], { cwd: dir });
  assert.notEqual(r.status, 0);
  assert.notEqual(r.status, 2);
});

test('gitOrThrow: returns stdout on status 0', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-seam-orthrow-ok-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  git('commit', '--allow-empty', '-m', 'init');

  const out = gitOrThrow(['rev-parse', 'HEAD'], { cwd: dir });
  assert.match(out.trim(), /^[0-9a-f]{40}$/);
});

test('gitOrThrow: throws an Error carrying .status on a non-zero exit', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-seam-orthrow-fail-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  makeRepo(dir);

  assert.throws(
    () => gitOrThrow(['ls-remote', '--exit-code', dir, 'refs/does-not-exist'], { cwd: dir }),
    (err) => {
      assert.equal(err.status, 2);
      return true;
    },
  );
});
