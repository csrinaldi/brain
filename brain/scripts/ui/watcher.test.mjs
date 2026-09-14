import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { testTmp } from '../lib/test-tmp.mjs';
import { createWatcher, resolveGitCommonDir } from './watcher.mjs';

// ── fixtures ─────────────────────────────────────────────────────────────

function makeWatcherFixture() {
  const root = testTmp('watcher-');
  const mk = (p) => mkdirSync(join(root, p), { recursive: true });
  mk('brain/project/decisions');
  mk('brain/core/anti-patterns');
  mk('brain/project/anti-patterns');
  mk('.memory/records');
  mk('openspec/changes/issue-1-a');
  mk('openspec/changes/archive'); // NOT an `issue-<N>-*` dir — must be excluded
  return root;
}

function makeGitCommonFixture() {
  const gitCommonDir = testTmp('git-common-');
  const mk = (p) => mkdirSync(join(gitCommonDir, p), { recursive: true });
  mk('logs');
  mk('worktrees/alpha/logs');
  mk('worktrees/beta/logs');
  return gitCommonDir;
}

// ── test doubles ─────────────────────────────────────────────────────────

/** A `fs.watch`-shaped spy: records every registration, fires listeners on demand, counts `.close()` calls. */
function spyWatch() {
  const calls = [];
  const closesByPath = new Map();
  const fn = (path, _opts, listener) => {
    calls.push({ path, listener });
    return { close: () => closesByPath.set(path, (closesByPath.get(path) ?? 0) + 1) };
  };
  fn.calls = calls;
  fn.closesByPath = closesByPath;
  fn.fire = (path) => { const c = calls.find((entry) => entry.path === path); if (c) c.listener('change', null); };
  return fn;
}

/** A controllable `setTimeout`/`clearTimeout` pair: `runLatest()` fires only the most recently scheduled callback — the trailing-debounce shape. */
function fakeScheduler() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn) => { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    runLatest: () => {
      const id = [...timers.keys()].at(-1);
      const fn = timers.get(id);
      timers.delete(id);
      fn();
    },
  };
}

// ── R881-3 S1 / R881-10 S1: the watched set is exactly Q3's table ──────────

test('#881: the watcher registers watches only for the Q3 set — an edit anywhere else can never fire an event', () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const _run = () => `worktree ${root}\n`; // only the primary checkout — no linked worktrees this run
  const _watch = spyWatch();
  const w = createWatcher({ root, gitCommonDir, _watch, _run });
  w.start();
  const watched = _watch.calls.map((c) => c.path).sort();
  const expected = [
    root,
    join(root, 'brain'),
    join(root, 'brain/project/decisions'),
    join(root, 'brain/core/anti-patterns'),
    join(root, 'brain/project/anti-patterns'),
    join(root, '.memory/records'),
    join(root, 'openspec/changes'),
    join(root, 'openspec/changes/issue-1-a'),
    gitCommonDir,
    join(gitCommonDir, 'logs'),
    join(gitCommonDir, 'worktrees'),
  ].sort();
  assert.deepEqual(watched, expected);
  assert.equal(w.state().watched, expected.length);
  w.close();
});

// ── R881-3 S2 / A2: a commit in a linked worktree is seen ──────────────────

test('#881: a commit in a linked worktree fires exactly one debounced recompute naming that worktree', async () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const alphaPath = join(dirname(root), 'alpha');
  const _run = () => `worktree ${root}\n\nworktree ${alphaPath}\n`;
  const _watch = spyWatch();
  const scheduler = fakeScheduler();
  const recomputes = [];
  const w = createWatcher({
    root, gitCommonDir, _watch, _run,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    onRecompute: async (evt) => { recomputes.push(evt); },
  });
  w.start();
  const alphaLogs = join(gitCommonDir, 'worktrees', 'alpha', 'logs');
  _watch.fire(alphaLogs);
  assert.equal(scheduler.pending(), 1);
  scheduler.runLatest();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(recomputes.length, 1);
  assert.deepEqual(recomputes[0].causes, ['watch:<git-common>/worktrees/alpha/logs/']);
  assert.deepEqual(recomputes[0].refWorktrees, [alphaPath]);
  w.close();
});

// ── worktree add/remove triggers a re-scan ──────────────────────────────────

test('#881: a <git-common>/worktrees/ event re-scans and opens/closes watchers to match', () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const alphaPath = join(dirname(root), 'alpha');
  const betaPath = join(dirname(root), 'beta');
  let stanzas = `worktree ${root}\n\nworktree ${alphaPath}\n`;
  const _run = () => stanzas;
  const _watch = spyWatch();
  const w = createWatcher({ root, gitCommonDir, _watch, _run });
  w.start();
  const alphaLogs = join(gitCommonDir, 'worktrees', 'alpha', 'logs');
  const betaLogs = join(gitCommonDir, 'worktrees', 'beta', 'logs');
  assert.ok(_watch.calls.some((c) => c.path === alphaLogs));
  assert.ok(!_watch.calls.some((c) => c.path === betaLogs));

  stanzas = `worktree ${root}\n\nworktree ${alphaPath}\n\nworktree ${betaPath}\n`;
  _watch.fire(join(gitCommonDir, 'worktrees'));
  assert.ok(_watch.calls.some((c) => c.path === betaLogs), 'the newly added worktree gets watched on re-scan');

  stanzas = `worktree ${root}\n\nworktree ${betaPath}\n`;
  _watch.fire(join(gitCommonDir, 'worktrees'));
  assert.equal(_watch.closesByPath.get(alphaLogs), 1, 'the vanished worktree watcher is closed on re-scan');
  w.close();
});

// ── D5: a rebase-sized burst collapses to at most two recomputes ───────────

test('#881: a rebase-sized burst of HEAD moves collapses to at most two recomputes, never forty', async () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const _run = () => `worktree ${root}\n`;
  const _watch = spyWatch();
  const scheduler = fakeScheduler();
  let resolveFirst;
  const firstGate = new Promise((resolve) => { resolveFirst = resolve; });
  let recomputeCount = 0;
  const w = createWatcher({
    root, gitCommonDir, _watch, _run,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    onRecompute: async () => {
      recomputeCount += 1;
      if (recomputeCount === 1) await firstGate;
    },
  });
  w.start();
  const logsPath = join(gitCommonDir, 'logs');

  _watch.fire(logsPath);
  scheduler.runLatest(); // debounce fires -> dispatch() starts, recomputing = true, awaiting firstGate

  for (let i = 0; i < 40; i++) _watch.fire(logsPath); // the rest of the rebase's HEAD moves
  scheduler.runLatest(); // the trailing debounce from the burst fires while still recomputing -> queues ONE follow-up

  resolveFirst();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(recomputeCount, 2, 'the in-flight recompute plus exactly one queued follow-up — never forty');
  w.close();
});

// ── Q3 "when the watcher fails" ─────────────────────────────────────────────

test('#881: a caught fs.watch failure leaves the server running and shapes {ok:false, reason, watched, failed}', () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const _run = () => `worktree ${root}\n`;
  const failingPath = join(root, 'brain/project/anti-patterns');
  const _watch = (path) => {
    if (path === failingPath) { const e = new Error('ENOSPC: no space left'); e.code = 'ENOSPC'; throw e; }
    return { close() {} };
  };
  const w = createWatcher({ root, gitCommonDir, _watch, _run });
  w.start();
  const state = w.state();
  assert.equal(state.ok, false);
  assert.match(state.reason, /1 watch\(es\) failed/);
  assert.deepEqual(state.failed, [{ path: 'brain/project/anti-patterns/', reason: 'ENOSPC: no space left' }]);
  assert.ok(state.watched > 0, 'every OTHER directory is still watched — one failure does not stop the rest');
  w.close();
});

// ── gitCommonDir resolution failure degrades gracefully ─────────────────────

test('#881: an unresolvable git-common-dir degrades to tree-only watching, never throws', () => {
  const root = makeWatcherFixture();
  const _run = () => { throw new Error('fatal: not a git repository'); };
  const _watch = spyWatch();
  const w = createWatcher({ root, _watch, _run }); // no gitCommonDir injected
  assert.doesNotThrow(() => w.start());
  const state = w.state();
  assert.equal(state.ok, false);
  assert.ok(state.failed.some((f) => f.path === '<git-common>'));
  assert.ok(!_watch.calls.some((c) => String(c.path).includes('worktrees')), 'no git-tracking watch is attempted once git-common-dir cannot be resolved');
  w.close();
});

// ── resolveGitCommonDir ──────────────────────────────────────────────────

test('#881: resolveGitCommonDir resolves a relative "git rev-parse --git-common-dir" answer against root', () => {
  assert.equal(resolveGitCommonDir({ root: '/repo', _run: () => '.git\n' }), '/repo/.git');
});

test('#881: resolveGitCommonDir keeps an already-absolute answer as-is', () => {
  assert.equal(resolveGitCommonDir({ root: '/repo', _run: () => '/elsewhere/.git\n' }), '/elsewhere/.git');
});
