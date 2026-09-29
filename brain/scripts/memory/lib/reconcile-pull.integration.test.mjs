// reconcile-pull.integration.test.mjs — issue #1118, real git, no mocks of git.
//
// The contract: a byte-identical untracked `.memory/records/*.jsonl` whose blob
// is reachable from `@{u}` is deleted before `git pull` (so git can write its
// tracked copy) and, if the pull does not verifiably recreate it, rewritten
// from git's own object store. Nothing is stored outside the working tree and
// the object store.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { testTmp } from '../../lib/test-tmp.mjs';
import { removeTempTree } from '../../__fixtures__/tmp-tree.mjs';
import {
  buildDivergedPullFixture, buildPullFixture, git, withIsolatedGitEnv,
  FIXTURE_RECORD, RECORD_PATH, RECORD_CONTENT,
} from '../../__fixtures__/pull-fixture.mjs';
import { defaultGitPull } from './reconcile-pull.mjs';

const quiet = () => {};
const tracked = (dir) => git(dir, 'ls-files', '--', RECORD_PATH).trim();
const onDisk = (dir) => readFileSync(join(dir, RECORD_PATH), 'utf8');

test('(a) the #1081 F10 scenario: pull reconciles the byte-identical record and it ends tracked', (t) => {
  const { capturingDir } = buildPullFixture(t);
  const logs = [];
  defaultGitPull(capturingDir, { _log: (l) => logs.push(l) });
  assert.equal(tracked(capturingDir), RECORD_PATH);
  assert.equal(onDisk(capturingDir), RECORD_CONTENT);
  assert.equal(logs.length, 1, 'one log line per reconciled path');
  assert.match(logs[0], new RegExp(RECORD_PATH.replace(/[.]/g, '\\.')));
  assert.match(logs[0], /verified/i);
});

test('(b) no upstream: nothing is deleted and git pull runs as before', (t) => {
  const { capturingDir } = buildPullFixture(t);
  git(capturingDir, 'branch', '--unset-upstream');
  assert.throws(() => defaultGitPull(capturingDir, { _log: quiet }), /git pull|Command failed/i);
  assert.equal(onDisk(capturingDir), RECORD_CONTENT, 'file untouched');
  assert.equal(tracked(capturingDir), '', 'still untracked');
});

test('(c) @{u} lacks the path: that file is never deleted', (t) => {
  const { capturingDir } = buildPullFixture(t);
  const other = '.memory/records/2026-09-rec-00000000000000aa.jsonl';
  writeFileSync(join(capturingDir, other), 'not upstream\n', 'utf8');
  defaultGitPull(capturingDir, { _log: quiet });
  assert.equal(readFileSync(join(capturingDir, other), 'utf8'), 'not upstream\n');
  assert.equal(tracked(capturingDir), RECORD_PATH);
});

test('(d) different bytes: refused before pulling, naming the file, nothing touched', (t) => {
  const tampered = JSON.stringify({ ...FIXTURE_RECORD, content: 'a DIFFERENT body' }) + '\n';
  const { capturingDir } = buildPullFixture(t, { shipperContent: tampered });
  const headBefore = git(capturingDir, 'rev-parse', 'HEAD');
  assert.throws(
    () => defaultGitPull(capturingDir, { _log: quiet }),
    (err) => { assert.ok(err.message.includes(RECORD_PATH), err.message); return true; },
  );
  assert.equal(onDisk(capturingDir), RECORD_CONTENT);
  assert.equal(git(capturingDir, 'rev-parse', 'HEAD'), headBefore, 'the pull never ran');
});

test('(e1) diverged + pull.ff=only: the pull fails and the file is back byte-identical', (t) => {
  const { capturingDir } = buildDivergedPullFixture(t);
  git(capturingDir, 'config', 'pull.ff', 'only');
  const logs = [];
  assert.throws(() => defaultGitPull(capturingDir, { _log: (l) => logs.push(l) }), /git pull|Command failed/i);
  assert.equal(onDisk(capturingDir), RECORD_CONTENT);
  assert.ok(logs.some((l) => /restored/i.test(l)), `a restore must be reported, got ${JSON.stringify(logs)}`);
});

test('(e2) diverged + stock config: the pull fails and the file is back byte-identical', async (t) => {
  const { capturingDir } = buildDivergedPullFixture(t);
  await withIsolatedGitEnv(() => {
    assert.throws(() => defaultGitPull(capturingDir, { _log: quiet }), /git pull|Command failed/i);
  });
  assert.equal(onDisk(capturingDir), RECORD_CONTENT);
});

test('(f) race: path removed upstream between fetch and pull — restored from the blob and reported', (t) => {
  const { capturingDir, originDir, base } = buildRace(t);
  const logs = [];
  assert.throws(
    () => defaultGitPull(capturingDir, {
      _log: (l) => logs.push(l),
      _afterReconcile: () => {
        const shipper = join(base, 'shipper-b');
        git(base, 'clone', '-q', originDir, shipper);
        git(shipper, 'rm', '-q', RECORD_PATH);
        git(shipper, 'commit', '-q', '-m', 'lane: remove the fixture record');
        git(shipper, 'push', '-q', 'origin', 'main');
      },
    }),
    (err) => { assert.ok(err.message.includes(RECORD_PATH), err.message); return true; },
  );
  assert.equal(onDisk(capturingDir), RECORD_CONTENT, 'restored byte-identical from the blob');
  assert.equal(tracked(capturingDir), '', 'commit B removed it: untracked local state again');
  assert.ok(logs.some((l) => /restored/i.test(l) && l.includes(RECORD_PATH)));
});

test('(f2) restore never overwrites a file that exists with different content', (t) => {
  const { capturingDir, originDir, base } = buildRace(t);
  assert.throws(
    () => defaultGitPull(capturingDir, {
      _log: quiet,
      _afterReconcile: () => {
        const shipper = join(base, 'shipper-b');
        git(base, 'clone', '-q', originDir, shipper);
        git(shipper, 'rm', '-q', RECORD_PATH);
        git(shipper, 'commit', '-q', '-m', 'lane: remove the fixture record');
        git(shipper, 'push', '-q', 'origin', 'main');
        // A stranger writes different bytes at the path before the pull.
        mkdirSync(join(capturingDir, '.memory', 'records'), { recursive: true });
        writeFileSync(join(capturingDir, RECORD_PATH), 'someone else wrote this\n', 'utf8');
      },
    }),
    (err) => { assert.match(err.message, /different content|not overwrit/i); return true; },
  );
  assert.equal(onDisk(capturingDir), 'someone else wrote this\n');
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test('(g) nothing is stored outside the working tree and the object store — git worktree remove is irrelevant', (t) => {
  const { capturingDir } = buildPullFixture(t);
  const linked = join(dirname(capturingDir), 'linked');
  git(capturingDir, 'fetch', '-q');
  git(capturingDir, 'branch', '-f', 'tmp-root', 'origin/main~1');
  git(capturingDir, 'worktree', 'add', '-q', '-b', 'linked-branch', linked, 'tmp-root');
  git(linked, 'branch', '--set-upstream-to=origin/main');
  mkdirSync(join(linked, '.memory', 'records'), { recursive: true });
  writeFileSync(join(linked, RECORD_PATH), RECORD_CONTENT, 'utf8');

  defaultGitPull(linked, { _log: quiet });
  assert.equal(tracked(linked), RECORD_PATH);

  const gitCommon = join(capturingDir, '.git');
  const gitFiles = walk(gitCommon).filter((p) => !p.includes(`${join(gitCommon, 'objects')}/`));
  assert.deepEqual(gitFiles.filter((p) => /reconcile|aside/i.test(p)), [], 'no aside directory under the git dir');
  for (const p of gitFiles) {
    assert.ok(!readFileSync(p).includes(FIXTURE_RECORD.content), `plaintext copy of the record found in ${p}`);
  }

  git(capturingDir, 'worktree', 'remove', '--force', linked);
  git(capturingDir, 'cat-file', '-e', `origin/main:${RECORD_PATH}`); // still durable
  assert.ok(!existsSync(linked));
});

// A capturing clone whose origin/main already carries the record (commit A),
// plus the base dir so a test can land a second upstream change (commit B).
function buildRace(t) {
  const base = testTmp('brain-pull-race-1118-');
  t.after(() => removeTempTree(base));
  const originDir = join(base, 'origin.git');
  const seed = join(base, 'seed');
  const capturingDir = join(base, 'capturing');
  git(base, 'init', '--bare', '-q', '-b', 'main', originDir);
  git(base, 'init', '-q', '-b', 'main', seed);
  git(seed, 'remote', 'add', 'origin', originDir);
  mkdirSync(join(seed, '.memory', 'records'), { recursive: true });
  writeFileSync(join(seed, '.memory', '.gitkeep'), '', 'utf8');
  git(seed, 'add', '.memory');
  git(seed, 'commit', '-q', '-m', 'root');
  git(seed, 'push', '-q', '-u', 'origin', 'main');
  git(base, 'clone', '-q', originDir, capturingDir);
  mkdirSync(join(capturingDir, '.memory', 'records'), { recursive: true });
  writeFileSync(join(capturingDir, RECORD_PATH), RECORD_CONTENT, 'utf8');
  const a = join(base, 'shipper-a');
  git(base, 'clone', '-q', originDir, a);
  mkdirSync(join(a, '.memory', 'records'), { recursive: true });
  writeFileSync(join(a, RECORD_PATH), RECORD_CONTENT, 'utf8');
  git(a, 'add', RECORD_PATH);
  git(a, 'commit', '-q', '-m', 'lane: add the fixture record');
  git(a, 'push', '-q', 'origin', 'main');
  return { base, originDir, capturingDir };
}
