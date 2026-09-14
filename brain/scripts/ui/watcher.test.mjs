import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';

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

/**
 * A `fs.watch`-shaped spy whose handles are REAL `EventEmitter`s, so a test
 * can fire an async `'error'` on a specific registered handle the way a live
 * `FSWatcher` does — late `ENOSPC`/`EPERM`/watched-path-removed, well after
 * registration succeeded. Shaped like `spyWatch()` above (`.calls`, `.fire`)
 * plus each call's `.handle` for direct emission.
 */
function spyWatchEmitter() {
  const calls = [];
  const fn = (path, _opts, listener) => {
    const handle = new EventEmitter();
    handle.close = () => { handle.closed = true; };
    calls.push({ path, listener, handle });
    return handle;
  };
  fn.calls = calls;
  fn.fire = (path) => { const c = calls.find((entry) => entry.path === path); if (c) c.listener('change', null); };
  return fn;
}

/**
 * A `fs.watch`-shaped spy that throws `ENOENT` the FIRST time it is asked to
 * register `throwOncePath`, then behaves like `spyWatch()` for every other
 * call — including later calls for `throwOncePath` itself. `.attempts`
 * counts every registration ATTEMPT for a path (successful or not), unlike
 * `.calls`, which only records attempts that returned a handle.
 */
function spyWatchThrowOnceFor(throwOncePath) {
  const calls = [];
  const attempts = new Map();
  const closesByPath = new Map();
  let thrown = false;
  const fn = (path, _opts, listener) => {
    attempts.set(path, (attempts.get(path) ?? 0) + 1);
    if (path === throwOncePath && !thrown) {
      thrown = true;
      const e = new Error('ENOENT: no such file or directory');
      e.code = 'ENOENT';
      throw e;
    }
    calls.push({ path, listener });
    return { close: () => closesByPath.set(path, (closesByPath.get(path) ?? 0) + 1) };
  };
  fn.calls = calls;
  fn.attempts = attempts;
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

// ── cold review of PR #971 rev 1 (judgment:cold-1), R881-3: a worktree whose
// watch failed is retried on the next rescan, never marked watched forever ──

test("#881: a worktree whose watch failed is retried on the next rescan, never left permanently unwatched", async () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const alphaPath = join(dirname(root), 'alpha');
  const betaPath = join(dirname(root), 'beta');
  const alphaLogs = join(gitCommonDir, 'worktrees', 'alpha', 'logs');
  const betaLogs = join(gitCommonDir, 'worktrees', 'beta', 'logs');
  let stanzas = `worktree ${root}\n\nworktree ${alphaPath}\n`;
  const _run = () => stanzas;
  const _watch = spyWatchThrowOnceFor(alphaLogs);
  const scheduler = fakeScheduler();
  const recomputes = [];
  const w = createWatcher({
    root, gitCommonDir, _watch, _run,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    onRecompute: async (evt) => { recomputes.push(evt); },
  });
  w.start();

  assert.equal(_watch.attempts.get(alphaLogs), 1, 'the first rescan attempted alpha/logs exactly once');
  assert.ok(
    w.state().failed.some((f) => f.path === '<git-common>/worktrees/alpha/logs/'),
    'the failed watch is recorded in state()',
  );

  // a second worktree appears -> a `<git-common>/worktrees/` event re-scans
  stanzas = `worktree ${root}\n\nworktree ${alphaPath}\n\nworktree ${betaPath}\n`;
  _watch.fire(join(gitCommonDir, 'worktrees'));

  assert.equal(
    _watch.attempts.get(alphaLogs), 2,
    'the rescan retried alpha/logs — a worktree that never got watched must not be skipped forever',
  );
  assert.ok(
    !w.state().failed.some((f) => f.path === '<git-common>/worktrees/alpha/logs/'),
    'the failure entry is cleared once the retry succeeds — state() stops lying about alpha',
  );
  assert.ok(_watch.calls.some((c) => c.path === betaLogs), 'the newly added worktree is watched too');

  // the retried handle is really open, not a bookkeeping-only success
  _watch.fire(alphaLogs);
  assert.equal(scheduler.pending(), 1, 'the retried alpha handle really fires the debounce');
  scheduler.runLatest();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(recomputes.length, 1, 'a commit in alpha is no longer silently invisible for the rest of the process');

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

// ── R881-9 / Q3 "when the watcher fails": a live handle's ASYNC error ──────

test("#881: a live watcher handle's async 'error' is a said state, not a crash — the OTHER handles stay open and a healthy one still fires", async () => {
  const root = makeWatcherFixture();
  const gitCommonDir = makeGitCommonFixture();
  const _run = () => `worktree ${root}\n`;
  const _watch = spyWatchEmitter();
  const scheduler = fakeScheduler();
  const recomputes = [];
  const w = createWatcher({
    root, gitCommonDir, _watch, _run,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
    onRecompute: async (evt) => { recomputes.push(evt); },
  });
  w.start();

  const failingPath = join(root, 'brain/project/anti-patterns');
  const failingEntry = _watch.calls.find((c) => c.path === failingPath);
  assert.ok(failingEntry, 'the fixture registers a watch for this directory');

  // A live handle emitting 'error' with no listener would throw synchronously
  // out of this very call (Node's EventEmitter special-cases 'error') and
  // crash the test/process — so simply reaching the assertions below proves
  // the process did not crash.
  failingEntry.handle.emit('error', new Error('ENOSPC: no space left'));

  const state = w.state();
  assert.equal(state.ok, false);
  assert.deepEqual(
    state.failed.find((f) => f.path === 'brain/project/anti-patterns/'),
    { path: 'brain/project/anti-patterns/', reason: 'ENOSPC: no space left' },
    'the failure is recorded in the same {path, reason} shape as a synchronous registration failure',
  );

  const otherEntries = _watch.calls.filter((c) => c.path !== failingPath);
  assert.ok(otherEntries.length > 0);
  assert.ok(otherEntries.every((c) => !c.handle.closed), 'every OTHER handle stays open — one handle\'s async error does not touch the rest');

  // a later event on a healthy handle still triggers the debounced callback
  const healthyPath = join(root, 'brain');
  _watch.fire(healthyPath);
  assert.equal(scheduler.pending(), 1);
  scheduler.runLatest();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(recomputes.length, 1, 'a healthy handle keeps firing after a sibling handle failed asynchronously');

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
