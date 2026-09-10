// ship.integration.test.mjs — shipLane() against a REAL temp repo, a REAL
// local bare remote as `origin`, and REAL git — proving the invariants a
// pure-fake unit suite cannot: the pushed ref actually lands on a remote
// object database, a divergence is refused by real git, and the main
// checkout's working tree is genuinely untouched. The VCS port is still a
// fake (no network) — see design.md's testing strategy row 3/3a.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { testTmp } from '../../lib/test-tmp.mjs';
import { shipLane } from './ship.mjs';
import { collectLane } from './collect.mjs';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'brain-test',
  GIT_AUTHOR_EMAIL: 'brain-test@example.com',
  GIT_COMMITTER_NAME: 'brain-test',
  GIT_COMMITTER_EMAIL: 'brain-test@example.com',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
  return r.stdout;
}

function recordJson(id, content) {
  return JSON.stringify({
    id, ts: '2026-09-09T00:00:00Z', actor: '@brain-test', actorKind: 'agent',
    type: 'discovery', project: 'brain', content,
  }) + '\n';
}

function addCandidate(mainDir, filename, content) {
  const dir = join(mainDir, '.memory', 'records');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, 'utf8');
}

/** A bare `origin` and a `main` checkout pushed to it — mirrors
 * collect.integration.test.mjs's fixture, scoped to what shipLane needs. */
function buildFixtureRepo() {
  const base = testTmp('brain-lane-ship-');
  const originDir = join(base, 'origin.git');
  const mainDir = join(base, 'main');
  git(base, 'init', '--bare', '-q', originDir);
  git(base, 'init', '-q', '-b', 'main', mainDir);
  git(mainDir, 'remote', 'add', 'origin', originDir);
  git(mainDir, 'config', 'user.email', 'test@example.invalid');
  git(mainDir, 'config', 'user.name', 'brain-test');
  git(mainDir, 'commit', '-q', '--allow-empty', '-m', 'root');
  git(mainDir, 'push', '-q', '-u', 'origin', 'main');
  git(mainDir, 'fetch', '-q', 'origin');
  return { base, originDir, mainDir };
}

/** A recording, in-memory, NO-NETWORK vcs port fake — never the real
 * providers. `mrList`/`mrCreate`/`mrAutoMerge` behave like a real forge only
 * in shape: idempotent find-by-headBranch, a monotonic PR number, an
 * unconditional arm. */
function recordingVcs() {
  const calls = { mrList: 0, mrCreate: 0, mrAutoMerge: 0 };
  const prs = [];
  let nextNumber = 100;
  const vcs = {
    mrList: async () => {
      calls.mrList++;
      return prs.map((p) => ({ number: p.number, title: p.title, headBranch: p.headBranch }));
    },
    mrCreate: async ({ head, title }) => {
      calls.mrCreate++;
      const number = nextNumber++;
      prs.push({ number, headBranch: head, title });
      return { url: `https://example.invalid/pull/${number}` };
    },
    mrAutoMerge: async () => {
      calls.mrAutoMerge++;
      return { enabled: true, url: null };
    },
  };
  return { vcs, calls, prs };
}

test('the pushed ref lands on the remote with the expected tree', async () => {
  const { mainDir, originDir } = buildFixtureRepo();
  addCandidate(mainDir, '2026-09-rec-1111111111111111.jsonl', recordJson('rec-1111111111111111', 'x'));
  const { vcs } = recordingVcs();

  const result = await shipLane({
    root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs,
  });

  assert.equal(result.pushed, true);
  assert.equal(result.pr.number, 100);
  const remoteSha = git(originDir, 'rev-parse', `refs/heads/${result.branch}`).trim();
  assert.equal(remoteSha, result.commit, 'the remote ref must land exactly on the collected commit');
  const remoteTree = git(originDir, 'ls-tree', '-r', '--name-only', remoteSha);
  assert.match(remoteTree, /2026-09-rec-1111111111111111\.jsonl/);
});

test('a second same-day run fast-forwards and opens no second PR', async () => {
  const { mainDir } = buildFixtureRepo();
  addCandidate(mainDir, '2026-09-rec-1111111111111111.jsonl', recordJson('rec-1111111111111111', 'x'));
  const { vcs, calls } = recordingVcs();

  const first = await shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs });
  assert.equal(calls.mrCreate, 1);

  addCandidate(mainDir, '2026-09-rec-2222222222222222.jsonl', recordJson('rec-2222222222222222', 'y'));
  const second = await shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs });

  assert.equal(second.pushed, true);
  assert.notEqual(second.commit, first.commit);
  assert.equal(calls.mrCreate, 1, 'a same-day re-run must open no second PR');
  assert.equal(calls.mrAutoMerge, 2, 'the arm step is unconditional on every run (D2)');
});

test('a remote ref moved behind our back is refused as diverged, exit non-zero, the remote sha unchanged', async () => {
  const { mainDir, originDir } = buildFixtureRepo();
  addCandidate(mainDir, '2026-09-rec-1111111111111111.jsonl', recordJson('rec-1111111111111111', 'x'));
  const { vcs, calls } = recordingVcs();

  const first = await shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs });
  assert.equal(first.pushed, true);

  // A racing writer moves the remote ref out from under us: a sibling
  // commit sharing no history with `first.commit` (same technique as
  // collect.integration.test.mjs's B1.5 race simulation), pushed directly —
  // never through shipLane.
  const raceTree = git(mainDir, 'rev-parse', `${first.commit}^{tree}`).trim();
  const raceCommit = git(mainDir, 'commit-tree', raceTree, '-m', 'racing writer').trim();
  git(mainDir, 'push', '--force', 'origin', `${raceCommit}:refs/heads/${first.branch}`);

  await assert.rejects(
    () => shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs }),
    (err) => { assert.equal(err.diverged, true); return true; },
  );

  assert.equal(calls.mrCreate, 1, 'no PR call on the diverged run');
  const remoteSha = git(originDir, 'rev-parse', `refs/heads/${first.branch}`).trim();
  assert.equal(remoteSha, raceCommit, 'the racing writer\'s ref move must survive — nothing was forced');
});

test('a killed push (remote ref absent, local ref ahead) recovers on re-run — A1\'s recovery case', async () => {
  const { mainDir, originDir } = buildFixtureRepo();
  addCandidate(mainDir, '2026-09-rec-1111111111111111.jsonl', recordJson('rec-1111111111111111', 'x'));

  // Simulate a run whose push never landed: collect (mints the local ref)
  // runs directly, shipLane is never called, so origin never receives it.
  const collected = collectLane({ root: mainDir, host: 'test-host', date: '2026-09-09' });
  assert.ok(collected.commit);

  const { vcs } = recordingVcs();
  const result = await shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs });

  assert.equal(result.commit, null, 'this run collects nothing new — recovery from a stalled prior push');
  assert.equal(result.pushed, true, 'the recovery push must still happen because the local ref is ahead');
  const remoteSha = git(originDir, 'rev-parse', `refs/heads/${result.branch}`).trim();
  assert.equal(remoteSha, collected.commit);
});

test('the main checkout is untouched: git status and HEAD are byte-identical before and after', async () => {
  const { mainDir } = buildFixtureRepo();
  addCandidate(mainDir, '2026-09-rec-1111111111111111.jsonl', recordJson('rec-1111111111111111', 'x'));
  const before = {
    status: git(mainDir, 'status', '--porcelain', '-uall'),
    head: git(mainDir, 'rev-parse', 'HEAD'),
  };

  const { vcs } = recordingVcs();
  await shipLane({ root: mainDir, project: 'x/y', tier: 'lite', host: 'test-host', date: '2026-09-09', vcs });

  const after = {
    status: git(mainDir, 'status', '--porcelain', '-uall'),
    head: git(mainDir, 'rev-parse', 'HEAD'),
  };
  assert.deepEqual(after, before, 'the ship touches no working tree (D6\'s scope boundary)');
});
