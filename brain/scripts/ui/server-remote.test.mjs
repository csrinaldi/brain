// server-remote.test.mjs — #1201 R1201-9/10/11/12: the server's half of the
// remote branches — the in-memory memo, the follow-up recompute while reads are
// deferred, the fetch lane and its route. Real git over a local bare remote;
// no test touches a network, and no real timer is left pending.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createUiServer } from './server.mjs';
import { REMOTE_FOLLOWUP_MS } from '../status/remote-changes.mjs';
import { gitRun } from './git-run.mjs';
import { makeRemoteFixture, RESUME_VALID } from './test-support/git-remote-fixture.mjs';
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
