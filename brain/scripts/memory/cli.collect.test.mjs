// cli.collect.test.mjs — `memory:collect` through the real CLI (#887 Slice B),
// against a fixture repo under BRAIN_MEMORY_TEST_ROOT, mirroring
// cli.audit.test.mjs's real-CLI pattern (#870).
//
// The deep git-plumbing invariants (no-mutation, no-secret-in-object-db, the
// ref lifecycle, the CAS) are `lane/collect.integration.test.mjs`'s job —
// this file is scoped to the `collect` OP: argument handling, the text/JSON
// rendering, the exit codes, and the dispatch boundary (never a backend).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { testTmp } from '../lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'cli.mjs');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (cwd=${cwd}): ${r.stderr}`);
  return r.stdout;
}

/** A bare origin, a `main` checkout pushed to it, and (by default) one
 * untracked, clean, off-main record in `main`'s own `.memory/records/` —
 * the main checkout counts as a worktree like any other. */
function fixtureRepo({ withCandidate = true } = {}) {
  const base = testTmp('cli-collect-');
  const originDir = join(base, 'origin.git');
  const mainDir = join(base, 'main');
  git(base, 'init', '--bare', '-q', originDir);
  git(base, 'init', '-q', '-b', 'main', mainDir);
  git(mainDir, 'remote', 'add', 'origin', originDir);
  git(mainDir, 'commit', '-q', '--allow-empty', '-m', 'root');
  git(mainDir, 'push', '-q', '-u', 'origin', 'main');
  git(mainDir, 'fetch', '-q', 'origin');
  if (withCandidate) {
    const dir = join(mainDir, '.memory', 'records');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-09-rec-1111111111111111.jsonl'),
      JSON.stringify({
        id: 'rec-1111111111111111', ts: '2026-09-09T00:00:00Z', actor: '@t',
        actorKind: 'agent', type: 'discovery', project: 'brain', content: 'x',
      }) + '\n',
      'utf8',
    );
  }
  return mainDir;
}

/** `MEMORY_BACKEND` deliberately points at a backend that cannot be
 * imported — if `collect` ever fell through to backend dispatch, every one
 * of these runs would fail with "backend 'no-such-backend' not found". */
function runCli(root, ...args) {
  return spawnSync(process.execPath, [CLI, 'collect', ...args], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: root, MEMORY_BACKEND: 'no-such-backend' },
  });
}

test('memory:collect prints memory.collect.done and exits 0 with candidates present', () => {
  const run = runCli(fixtureRepo());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /memory\/cli:.*collected 1 record/i);
});

test('memory:collect prints memory.collect.nothing and exits 0 once the lane already carries everything', () => {
  const root = fixtureRepo();
  const first = runCli(root);
  assert.equal(first.status, 0, first.stderr);
  const second = runCli(root);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /memory\/cli:.*nothing new/i);
});

test('memory:collect --json carries the full shape on stdout only', () => {
  const run = runCli(fixtureRepo(), '--json');
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.match(parsed.ref, /^refs\/heads\/memory\//);
  assert.ok(parsed.commit, 'a run with a candidate must carry a commit sha');
  assert.equal(parsed.collected, 1);
  assert.ok(Array.isArray(parsed.skipped));
  assert.ok(parsed.duplicates && typeof parsed.duplicates === 'object');
});

test('memory:collect never invokes a backend, regardless of MEMORY_BACKEND', () => {
  const run = runCli(fixtureRepo());
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /backend 'no-such-backend' not found/);
});

test('memory:collect fails loudly with memory.collect.failed and exits 1 on a genuine git failure', () => {
  const root = testTmp('cli-collect-nogit-'); // not a git repository at all
  mkdirSync(root, { recursive: true });
  const run = runCli(root);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /memory\/cli:/);
});

test('memory:collect resolves from package.json, beside the other memory:* scripts', () => {
  const pkg = JSON.parse(readFileSync(join(HERE, '../../../package.json'), 'utf8'));
  assert.equal(pkg.scripts['memory:collect'], 'node ./brain/scripts/memory/cli.mjs collect');
});
