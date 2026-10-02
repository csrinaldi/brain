// server-remote.test.mjs — #1201 R1201-9/10/11/12: the server's half of the
// remote branches — the in-memory memo, the follow-up recompute while reads are
// deferred, the fetch lane and its route. Real git over a local bare remote;
// no test touches a network, and no real timer is left pending.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createUiServer } from './server.mjs';
import { REMOTE_FOLLOWUP_MS } from '../status/remote-changes.mjs';
import { gitRun, gitRunAsync, FETCH_TIMEOUT_MS } from './git-run.mjs';
import { makeRemoteFixture, git, RESUME_VALID } from './test-support/git-remote-fixture.mjs';
import { recordingGit } from './test-support/recording-git.mjs';

const NOW = '2026-09-14T00:00:00Z';
const now = () => new Date(NOW);

/** A scheduler that records each delay and runs timers only when told: nothing real is ever pending. */
function recordingScheduler() {
  let seq = 0;
  const timers = new Map();
  const delays = [];
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, fn); delays.push(ms); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    delays,
    async runNext() { const [id, fn] = [...timers][0]; timers.delete(id); await fn(); },
  };
}

function branchesFixture(count) {
  const fx = makeRemoteFixture({ standard: false });
  for (let i = 1; i <= count; i += 1) {
    fx.addBranch(`feat/issue-${200 + i}-x`, { [`openspec/changes/issue-${200 + i}-x/proposal.md`]: 'p', [`openspec/changes/issue-${200 + i}-x/resume.md`]: RESUME_VALID }, { ageDays: i });
  }
  fx.refresh();
  return fx;
}

const sectionOf = async (server) => (await (await fetch(`http://127.0.0.1:${server.port}/api/snapshot`)).json()).remoteChanges;

// ── 4.5: the memo and the follow-up chain ───────────────────────────────────

test('#1201 R1201-12: while reads are deferred the server schedules ONE follow-up after REMOTE_FOLLOWUP_MS, and the chain stops at 0', async () => {
  const fx = branchesFixture(5);
  const scheduler = recordingScheduler();
  const server = createUiServer({
    root: fx.served, poll: false, _now: now, remoteBudget: 2,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _watch: () => ({ close() {} }),
  });
  await server.listen(0);
  try {
    assert.equal((await sectionOf(server)).value.deferred, 3, 'the first build read 2 of 5');
    assert.equal(scheduler.pending(), 1);
    assert.deepEqual(scheduler.delays, [REMOTE_FOLLOWUP_MS]);
    await scheduler.runNext();
    assert.equal((await sectionOf(server)).value.deferred, 1);
    assert.equal(scheduler.pending(), 1, 'one follow-up pending, never two');
    await scheduler.runNext();
    assert.equal((await sectionOf(server)).value.deferred, 0);
    assert.equal(scheduler.pending(), 0, 'the chain ends at 0');
  } finally {
    await server.close();
  }
});

test('#1201 R1201-12: a watch-triggered recompute reads from the server memo (2 spawns) and never fetches', async () => {
  const fx = branchesFixture(3);
  const scheduler = recordingScheduler();
  const snapshotRun = recordingGit(gitRun(fx.served));
  let watchListener = null;
  const server = createUiServer({
    root: fx.served, poll: false, _now: now, _snapshotRun: snapshotRun,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    _watch: (_path, _opts, listener) => { watchListener ??= listener; return { close() {} }; },
  });
  await server.listen(0);
  try {
    const coldSpawns = snapshotRun.spawns;
    assert.ok(coldSpawns >= 2 + 3 * 3, `the first build read all three branches (${coldSpawns} spawns)`);
    const before = snapshotRun.calls.length;
    watchListener('change', null);
    await scheduler.runNext(); // the watcher's debounce
    await new Promise((resolve) => setImmediate(resolve));
    const second = snapshotRun.calls.slice(before).filter((a) => a[0] === 'for-each-ref');
    assert.equal(second.length, 2, 'the recompute re-listed the refs once');
    assert.equal(snapshotRun.calls.slice(before).filter((a) => ['ls-tree', 'cat-file'].includes(a[0])).length, 0, 'every branch came from the memo');
    assert.ok(!snapshotRun.calls.some((a) => a[0] === 'fetch'), 'a recompute never fetches');
  } finally {
    await server.close();
  }
});

// ── 5.5: the fetch lane, the route, and AC4 (a refresh writes only remote-tracking refs) ──

const FETCH_ARGV = ['fetch', 'origin', '--no-tags', '--prune', '--no-write-fetch-head'];
const BOUND_POLL_MS = 5000; // sized for a CI runner: the first tick is a real git fetch on a local path
const post = (server, path) => fetch(`http://127.0.0.1:${server.port}${path}`, { method: 'POST' });
const pollerState = async (server) => (await post(server, '/api/poll/resume')).json(); // a no-op on an unpaused poller: the state probe
const names = (section) => section.value.branches.map((e) => e.branch);

async function until(predicate) {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > BOUND_POLL_MS) throw new Error('until: timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** A real async runner, recorded: the fetch is the one writer, and the recorder refuses every verb that is not it. */
function recordedFetch(root) {
  return recordingGit(gitRunAsync(root));
}

function serverFor(fx, extra = {}) {
  const scheduler = recordingScheduler();
  const server = createUiServer({
    root: fx.served, poll: false, _now: now, _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    _watch: () => ({ close() {} }), ...extra,
  });
  return { server, scheduler };
}

test('#1201 R1201-9: POST /api/remotes/refresh answers the poller state; GET is refused with Allow: POST', async () => {
  const fx = makeRemoteFixture();
  const { server } = serverFor(fx, { _fetchRun: recordedFetch(fx.served) });
  await server.listen(0);
  try {
    const refused = await fetch(`http://127.0.0.1:${server.port}/api/remotes/refresh`);
    assert.equal(refused.status, 405);
    assert.equal(refused.headers.get('allow'), 'POST');
    const res = await post(server, '/api/remotes/refresh');
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.remotes.inFlight, false);
    assert.equal(typeof state.remotes.lastOkAt, 'string');
  } finally {
    await server.close();
  }
});

test('#1201 R1201-9 AC6: refresh while paused fetches and the new branch appears in the next snapshot; two calls 1 s apart run one fetch', async () => {
  const fx = makeRemoteFixture();
  const fetchRun = recordedFetch(fx.served);
  let clock = Date.parse(NOW);
  const { server } = serverFor(fx, { _fetchRun: fetchRun, _now: () => new Date(clock) });
  await server.listen(0);
  try {
    assert.deepEqual(names(await sectionOf(server)), ['feat/issue-11-a', 'feat/issue-12-b']);
    fx.addBranch('feat/issue-50-new', { 'openspec/changes/issue-50-new/proposal.md': 'x' });
    assert.ok(!names(await sectionOf(server)).includes('feat/issue-50-new'), 'pushed, not fetched: absent');
    await post(server, '/api/remotes/refresh');
    clock += 1000;
    await post(server, '/api/remotes/refresh');
    assert.equal(fetchRun.calls.length, 1, 'collapsed');
    assert.deepEqual(fetchRun.calls[0], FETCH_ARGV);
    assert.ok(names(await sectionOf(server)).includes('feat/issue-50-new'), 'the snapshot was recomputed after the fetch');
  } finally {
    await server.close();
  }
});

test('#1201 R1201-9: a tick runs exactly one fetch with the pinned argv and the timeout, and the snapshot is recomputed after it', async () => {
  const fx = makeRemoteFixture();
  const fetchRun = recordedFetch(fx.served);
  fx.addBranch('feat/issue-51-tick', { 'openspec/changes/issue-51-tick/proposal.md': 'x' });
  const scheduler = recordingScheduler();
  const server = createUiServer({
    root: fx.served, poll: true, forgeSource: { issueList: async () => [], mrList: async () => [], issueView: async () => ({ body: '' }), prReviews: async () => [] },
    project: 'o/r', _now: now, _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _watch: () => ({ close() {} }), _fetchRun: fetchRun,
  });
  await server.listen(0);
  try {
    await until(async () => (await pollerState(server)).remotes.lastOkAt !== null);
    assert.equal(fetchRun.calls.length, 1);
    assert.deepEqual(fetchRun.calls[0], FETCH_ARGV);
    await until(async () => names(await sectionOf(server)).includes('feat/issue-51-tick'));
  } finally {
    await server.close();
  }
});

test('#1201 R1201-10 AC4: a refresh on a dirty clone changes only refs/remotes/origin/* — heads, HEAD, worktrees, status and FETCH_HEAD are untouched', async () => {
  const fx = makeRemoteFixture();
  git(fx.served, ['branch', 'local-only']);
  writeFileSync(join(fx.served, 'README.md'), 'dirty\n');
  writeFileSync(join(fx.served, 'untracked.txt'), 'u\n');
  const inspect = () => ({
    heads: git(fx.served, ['for-each-ref', 'refs/heads', 'refs/tags']),
    head: git(fx.served, ['rev-parse', 'HEAD', '--symbolic-full-name', 'HEAD']),
    worktrees: git(fx.served, ['worktree', 'list', '--porcelain']),
    status: git(fx.served, ['status', '--porcelain']),
    remotes: git(fx.served, ['for-each-ref', 'refs/remotes']),
    fetchHead: existsSync(join(fx.served, '.git', 'FETCH_HEAD')),
  });
  fx.addBranch('feat/issue-52-ac4', { 'a.txt': 'x' });
  const before = inspect();
  const fetchRun = recordedFetch(fx.served);
  const snapshotRun = recordingGit(gitRun(fx.served));
  const { server } = serverFor(fx, { _fetchRun: fetchRun, _snapshotRun: snapshotRun });
  await server.listen(0);
  try {
    await post(server, '/api/remotes/refresh');
  } finally {
    await server.close();
  }
  const after = inspect();
  for (const key of ['heads', 'head', 'worktrees', 'status', 'fetchHead']) assert.deepEqual(after[key], before[key], key);
  assert.notEqual(after.remotes, before.remotes, 'only the remote-tracking refs moved');
  assert.match(after.remotes, /refs\/remotes\/origin\/feat\/issue-52-ac4/);
  assert.equal(after.fetchHead, false, 'no FETCH_HEAD');
  const verbs = [...fetchRun.calls, ...snapshotRun.calls].map((a) => a[0]);
  assert.deepEqual(verbs.filter((v) => ['checkout', 'switch', 'merge', 'rebase', 'reset', 'pull', 'stash', 'push'].includes(v)), []);
});

test('#1201 R1201-10 R5: prune removes only the stale remote-tracking ref; the same-named local branch and the live branch stay', async () => {
  const fx = makeRemoteFixture();
  git(fx.served, ['branch', 'feat/issue-11-a', 'origin/feat/issue-11-a']); // a local branch of the same name
  fx.deleteRemoteBranch('feat/issue-11-a');
  const { server } = serverFor(fx, { _fetchRun: recordedFetch(fx.served) });
  await server.listen(0);
  try {
    await post(server, '/api/remotes/refresh');
  } finally {
    await server.close();
  }
  const remotes = git(fx.served, ['for-each-ref', '--format=%(refname)', 'refs/remotes/origin']);
  assert.ok(!remotes.includes('refs/remotes/origin/feat/issue-11-a\n'), 'the stale remote-tracking ref is gone');
  assert.ok(remotes.includes('refs/remotes/origin/feat/issue-12-b'), 'the live remote branch remains');
  assert.ok(git(fx.served, ['for-each-ref', '--format=%(refname)', 'refs/heads']).includes('refs/heads/feat/issue-11-a'), 'the local branch remains');
});

test('#1201 R1201-11: a failed fetch keeps the last list; meta.poller carries the cause and lastOkAt; recovery clears the error', async () => {
  const fx = makeRemoteFixture();
  let failWith = null;
  const real = gitRunAsync(fx.served);
  const flaky = async (file, args, opts) => {
    if (failWith) throw Object.assign(new Error('Command failed: git fetch'), { stderr: `fatal: unable to access 'https://example.com/r.git/': ${failWith}\n` });
    return real(file, args, opts);
  };
  let clock = Date.parse(NOW);
  const { server } = serverFor(fx, { _fetchRun: flaky, _now: () => new Date(clock) });
  await server.listen(0);
  try {
    await post(server, '/api/remotes/refresh');
    const ok = await pollerState(server);
    assert.equal(ok.remotes.lastError, null);
    const listed = names(await sectionOf(server));

    failWith = 'Could not resolve host: example.com';
    clock += 60000;
    await post(server, '/api/remotes/refresh');
    const failed = await pollerState(server);
    assert.match(failed.remotes.lastError, /Could not resolve host/);
    assert.equal(failed.remotes.lastOkAt, ok.remotes.lastOkAt);
    assert.deepEqual(names(await sectionOf(server)), listed, 'the last known list is kept');
    assert.doesNotMatch(JSON.stringify(await sectionOf(server)), /Could not resolve host|lastError/, 'fetch state never enters the section');

    failWith = null;
    clock += 60000;
    await post(server, '/api/remotes/refresh');
    const recovered = await pollerState(server);
    assert.equal(recovered.remotes.lastError, null);
    assert.notEqual(recovered.remotes.lastOkAt, ok.remotes.lastOkAt);
  } finally {
    await server.close();
  }
});

test('#1201 D39: a fetch killed at its timeout is reported as "fetch timed out after 20000 ms"', async () => {
  const fx = makeRemoteFixture({ standard: false });
  const killed = async () => { throw Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGKILL', stderr: '' }); };
  const { server } = serverFor(fx, { _fetchRun: killed });
  await server.listen(0);
  try {
    await post(server, '/api/remotes/refresh');
    assert.equal((await pollerState(server)).remotes.lastError, `fetch timed out after ${FETCH_TIMEOUT_MS} ms`);
  } finally {
    await server.close();
  }
});
