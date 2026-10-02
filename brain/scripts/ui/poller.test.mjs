import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createForgeCache } from './forge-cache.mjs';
import { createPoller } from './poller.mjs';

// ── test doubles ─────────────────────────────────────────────────────────

function makeVcs({ callLog, issues = [{ number: 1, title: 't', labels: [], assignees: [], state: 'open', body: 'b' }], prs = [] }) {
  return {
    issueList: async () => { callLog.push('issueList'); return issues.map((i) => ({ ...i })); },
    mrList: async () => { callLog.push('mrList'); return prs.map((p) => ({ ...p })); },
    issueView: async ({ number }) => { callLog.push(`issueView:${number}`); return { number, body: 'b' }; },
    prReviews: async ({ number }) => { callLog.push(`prReviews:${number}`); return []; },
  };
}

/** Every write verb throws — the same proof `snapshot.test.mjs`'s `readOnlyPort()` gives buildSnapshot, applied here to the poller. */
function readOnlyWriteVerbs(reads) {
  const port = {};
  for (const w of ['mrCreate', 'mrAutoMerge', 'issueCreate', 'issueUpdate', 'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove', 'branchProtect']) {
    port[w] = async () => { throw new Error(`write verb ${w} called by the poller`); };
  }
  return Object.assign(port, reads);
}

/** A controllable `setTimeout`/`clearTimeout` pair with exactly one pending timer at a time. */
function fakeScheduler() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn) => { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    runNext: () => {
      const id = [...timers.keys()][0];
      const fn = timers.get(id);
      timers.delete(id);
      return fn();
    },
  };
}

// ── R881-4 S2: disable, manual poll, and the /once collapse ────────────────

test('#881: R881-4 S2 — disabling stops the timer; "poll now" still triggers exactly one poll; two /once calls inside 5s collapse', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 0 };
  const callLog = [];
  const vcs = makeVcs({ callLog });
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.start(); // cold start
  assert.equal(scheduler.pending(), 1, 'the regular interval is scheduled after a successful tick');

  const pausedState = poller.pause();
  assert.equal(pausedState.paused, true);
  assert.equal(scheduler.pending(), 0, 'pausing clears the scheduled tick — the timer stops firing');

  now.t += 10000;
  await poller.once(); // "poll now" still works while paused
  assert.equal(callLog.filter((c) => c === 'issueList').length, 2, 'cold start + exactly one manual poll');

  now.t += 1000; // inside the 5s collapse window
  const before = callLog.length;
  await poller.once();
  assert.equal(callLog.length, before, 'a second /once inside 5s collapses into the first result — no new call');

  now.t += 6000; // past the collapse window
  await poller.once();
  assert.equal(callLog.filter((c) => c === 'issueList').length, 3, 'past the collapse window, /once polls again');

  poller.close();
});

// ── R881-4 S3: last-polled state is visible ─────────────────────────────────

test('#881: R881-4 S3 — last-polled state is visible after success and after failure', async () => {
  const now = { t: 0 };
  let fail = false;
  const vcs = {
    issueList: async () => { if (fail) throw new Error('gh: rate limited'); return []; },
    mrList: async () => { if (fail) throw new Error('gh: rate limited'); return []; },
    issueView: async () => ({}),
    prReviews: async () => [],
  };
  const poller = createPoller({ vcs, cache: createForgeCache(), project: 'o/r', _now: () => new Date(now.t) });

  await poller.once();
  let s = poller.state();
  assert.equal(s.paused, false);
  assert.equal(s.lastPolledAt, new Date(now.t).toISOString());
  assert.equal(s.lastOkAt, new Date(now.t).toISOString());
  assert.equal(s.lastError, null);

  fail = true;
  now.t += 60000;
  await poller.once();
  s = poller.state();
  assert.equal(s.lastPolledAt, new Date(now.t).toISOString(), 'lastPolledAt updates on every attempt, success or failure');
  assert.equal(s.lastOkAt, new Date(now.t - 60000).toISOString(), 'lastOkAt only moves on a successful poll');
  assert.match(s.lastError, /gh: rate limited/);
  poller.close();
});

// ── R881-9 S2 / D2: a failed poll never empties a filled section ───────────

test('#881: R881-9 S2 — a failed poll keeps the previous cache and sets lastError with a time', async () => {
  const now = { t: 0 };
  let fail = false;
  const issues = [{ number: 1, title: 't1', labels: [], assignees: [] }];
  const vcs = {
    issueList: async () => { if (fail) throw new Error('gh: 502'); return issues; },
    mrList: async () => { if (fail) throw new Error('gh: 502'); return []; },
    issueView: async ({ number }) => ({ number, body: 'b' }),
    prReviews: async () => [],
  };
  const cache = createForgeCache();
  const poller = createPoller({ vcs, cache, project: 'o/r', _now: () => new Date(now.t) });

  await poller.once();
  assert.deepEqual(await cache.port.issueList(), issues);

  fail = true;
  now.t += 60000;
  await poller.once();
  assert.match(poller.state().lastError, /gh: 502/);
  assert.deepEqual(await cache.port.issueList(), issues, 'the cache still serves the last successful poll — nothing was emptied');
  poller.close();
});

// ── #881 judgment:cold-6: an `initialError` starts the poller paused, in band ──
//
// The real CLI entry never resolved a live forge port (server.mjs:394-397's
// own comment claimed this was deliberate) — `deps.forgeSource` was always
// `undefined`, so the poller's four verbs always threw
// "no forge port was supplied to the poller" and `prs`/`reviews`/issue
// bodies never left `{ok:false}` outside a test. `main()` now resolves a
// real port and, on failure, constructs the poller with `initialError` so
// the reason is visible on `state()` before any tick, and `start()` is a
// no-op — no tick ever runs against a port that would only throw.

test('#881: judgment:cold-6 — createPoller({ initialError }) starts paused with lastError and lastPolledAt set, no tick runs even via start()', () => {
  const now = { t: 1726272000000 };
  const callLog = [];
  const vcs = makeVcs({ callLog });
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', _now: () => new Date(now.t),
    initialError: 'no VCS token',
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
  });

  const state = poller.state();
  assert.equal(state.paused, false, 'a forge halt is not the user\'s pause (R1243-3)');
  assert.equal(state.forgeHalted, true);
  assert.match(state.lastError, /no VCS token/);
  assert.equal(state.lastPolledAt, new Date(now.t).toISOString(), 'the reason carries a time, the same shape a real failed tick would leave');
  assert.equal(state.lastOkAt, null);

  poller.start(); // halted with no remotes lane: a no-op
  assert.equal(scheduler.pending(), 0, 'no timer was armed');
  assert.deepEqual(callLog, [], 'the port was never called — an initial resolution error means no tick, ever: Resume never lifts it (R2)');
  poller.close();
});

// ── A5: the poller only ever calls the four read verbs ─────────────────────

test('#881: A5 — composed with a write-throwing port, a full tick completes with no write verb invoked', async () => {
  const callLog = [];
  const vcs = readOnlyWriteVerbs(makeVcs({
    callLog,
    issues: [{ number: 1, title: 't', labels: [], assignees: [] }],
    prs: [{ number: 9, title: 'p', headBranch: 'x' }],
  }));
  const poller = createPoller({ vcs, cache: createForgeCache(), project: 'o/r' });
  const s = await poller.once();
  assert.equal(s.lastError, null);
  assert.deepEqual(callLog.sort(), ['issueList', 'issueView:1', 'mrList', 'prReviews:9'].sort());
  poller.close();
});

// ── hardening: close() during an in-flight tick must leave no timer, and must
// FAIL, not HANG, if that guarantee ever regresses ──────────────────────────
//
// Mutation-testing the fix in c2352550 found a gap: removing `closed = true`
// from `close()` did not turn any existing test red — it made `node --test`
// HANG instead, because those tests use the REAL setTimeout/clearTimeout, so
// the leaked scheduleNext() after close() arms a real, uncleared timer that
// keeps the process alive. A CI job with no per-test timeout would sit there,
// not report a failure. This test uses the injected fake scheduler so the
// same regression turns into a fast, deterministic assertion failure instead.

test('#881: poller.close() during an in-flight tick leaves no timer scheduled once that tick settles — fails fast, never hangs', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 0 };
  let resolveIssueList;
  const gate = new Promise((resolve) => { resolveIssueList = resolve; });
  const vcs = {
    issueList: async () => { await gate; return []; },
    mrList: async () => [],
    issueView: async () => ({}),
    prReviews: async () => [],
  };
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  const inFlight = poller.start(); // begins tick(), which awaits `gate` — still in flight
  poller.close(); // close() while that tick has not settled yet
  resolveIssueList();
  await inFlight; // let the in-flight tick's .finally() (which calls scheduleNext()) run to completion

  assert.equal(scheduler.pending(), 0, 'no timer remains scheduled once the in-flight tick settles after close()');
});

// ── #998 R998-6: state() carries intervalMs and nextAttemptAt ──────────────

test('#998 R998-6: state() carries intervalMs and a nextAttemptAt armed to now + interval right after a successful tick; paused clears it', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 1726272000000 };
  const vcs = makeVcs({ callLog: [] });
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.start();
  let s = poller.state();
  assert.equal(s.intervalMs, 60000);
  assert.equal(s.nextAttemptAt, new Date(now.t + 60000).toISOString(), 'armed from the injected clock, never Date.now()');

  poller.pause();
  s = poller.state();
  assert.equal(s.nextAttemptAt, null, 'a paused poller has nothing scheduled');
  assert.equal(s.intervalMs, 60000, 'intervalMs itself is a static fact, unaffected by pause');

  poller.resume();
  s = poller.state();
  assert.equal(s.nextAttemptAt, new Date(now.t + 60000).toISOString(), 'resuming re-arms the countdown from the same clock');

  poller.close();
});

test('#998 R998-6: createPoller({initialError}) starts with nextAttemptAt null — a halt with no remotes lane schedules nothing', () => {
  const scheduler = fakeScheduler();
  const now = { t: 0 };
  const vcs = makeVcs({ callLog: [] });
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000, initialError: 'no VCS token',
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });
  assert.equal(poller.state().nextAttemptAt, null);
  poller.close();
});

// ── cold review of #1008/PR6: once() DOES re-arm the countdown ─────────────
//
// The comment above `nextAttemptAt`'s declaration used to claim a manual
// once() "does not itself re-arm the interval" — false, measured here:
// once()'s own runTick() calls scheduleNext() in its .finally() on every
// completed tick, the same path a regular scheduled tick already takes.

test('#998 R998-6: a manual once() re-arms nextAttemptAt from the moment the tick settles, not the moment it was called', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 5000 };
  const vcs = makeVcs({ callLog: [] });
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.once();
  assert.equal(poller.state().nextAttemptAt, new Date(65000).toISOString(), 'once() at t=5000 with a 60000ms interval re-arms to 65000');
  poller.close();
});

// ── judgment:cold-1: the review lane is capped on the cold-start tick too ──
//
// The header comment (poller.mjs:6-8) promises "every tick, capped at 10
// PRs, round-robin beyond the cap" for the review lane, with no cold-start
// exception — unlike the body lane, which IS documented uncapped on cold
// start (poller.mjs:9-11). The steady-tick budget test above uses
// PR_COUNT=3, under REVIEW_CAP, so it cannot tell a capped cold tick from an
// uncapped one. This test uses 50 open PRs specifically to distinguish them.

test('#881: judgment:cold-1 — the review lane is capped at REVIEW_CAP on the very first (cold-start) tick, round-robin catches every PR within 5 ticks', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 0 };
  const callLog = [];
  const PR_COUNT = 50;
  const REVIEW_CAP = 10;
  const prs = Array.from({ length: PR_COUNT }, (_, i) => ({ number: 2000 + i, title: `pr ${i}`, headBranch: `feat/x-${i}` }));
  const vcs = {
    issueList: async () => { callLog.push('issueList'); return []; },
    mrList: async () => { callLog.push('mrList'); return prs.map((p) => ({ ...p })); },
    issueView: async ({ number }) => { callLog.push(`issueView:${number}`); return { number, body: 'b' }; },
    prReviews: async ({ number }) => { callLog.push(`prReviews:${number}`); return []; },
  };
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.start(); // tick 1 — cold start (previousIssues === null)
  const seen = new Set();
  let reviewedThisTick = 0;
  for (const c of callLog) {
    if (c.startsWith('prReviews:')) { reviewedThisTick += 1; seen.add(Number(c.split(':')[1])); }
  }
  assert.equal(reviewedThisTick, Math.min(PR_COUNT, REVIEW_CAP), 'the cold-start tick reviews min(P,10) PRs, not all 50');

  for (let i = 0; i < 4; i++) {
    now.t += 60000;
    await scheduler.runNext();
    for (const c of callLog) if (c.startsWith('prReviews:')) seen.add(Number(c.split(':')[1]));
  }
  assert.equal(seen.size, PR_COUNT, 'round-robin across 5 consecutive ticks (cold + 4 steady) reads every one of the 50 PRs at least once');

  poller.close();
});

test("#1015 cold review: close() clears the countdown — a poll that will never fire must not be reported as pending", async () => {
  const scheduler = fakeScheduler();
  const now = { t: 1726272000000 };
  const vcs = makeVcs({ callLog: [] });
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.start();
  assert.equal(poller.state().nextAttemptAt, new Date(now.t + 60000).toISOString(), 'a settled tick arms the next attempt from the injected clock');
  poller.close();
  assert.equal(poller.state().nextAttemptAt, null, 'after close() no tick will ever fire, so the countdown says nothing rather than a stale future time');
  assert.equal(scheduler.pending(), 0, 'and the timer it was counting down to is gone');
});

// ── #1201 D40: the remotes lane ──────────────────────────────────────────────

/** A `fetchRemotes` spy: records calls, can be made to fail, and can be held open to prove single flight. */
function fetchSpy({ events = [], fail = null, hold = false } = {}) {
  const spy = { calls: 0, release: null };
  spy.fn = async () => {
    spy.calls += 1;
    events.push('fetch:start');
    if (hold) await new Promise((resolve) => { spy.release = resolve; });
    events.push('fetch:end');
    if (spy.fail ?? fail) throw new Error(spy.fail ?? fail);
  };
  return spy;
}

function remotesPoller({ fetchRemotes, vcs, enabled = true, onTick, now = { t: 0 } } = {}) {
  const scheduler = fakeScheduler();
  const callLog = [];
  const poller = createPoller({
    vcs: vcs ?? makeVcs({ callLog }), cache: createForgeCache(), project: 'o/r', interval: 60000, enabled, fetchRemotes,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t), ...(onTick ? { onTick } : {}),
  });
  return { poller, scheduler, callLog, now };
}

const ONCE_COLLAPSE_MS = 5000;

test('#1201 R1201-9: a tick fetches once, and onTick fires only after BOTH lanes settle', async () => {
  const events = [];
  const spy = fetchSpy({ events });
  const { poller } = remotesPoller({ fetchRemotes: spy.fn, onTick: () => events.push('onTick') });
  await poller.start();
  assert.equal(spy.calls, 1);
  // #1257 D66: the open list's first landing recomputes at once, so a first tick reports twice;
  // the LAST report is still the one after both lanes settled.
  assert.deepEqual(events, ['fetch:start', 'fetch:end', 'onTick', 'onTick']);
  poller.close();
});

test('#1201 R1201-9: a paused poller does not fetch on its timer; refreshRemotes() fetches while paused', async () => {
  const spy = fetchSpy();
  const { poller, scheduler } = remotesPoller({ fetchRemotes: spy.fn, enabled: false });
  await poller.start();
  assert.equal(spy.calls, 0);
  assert.equal(scheduler.pending(), 0, 'no timer, so no tick can fetch');
  await poller.refreshRemotes();
  assert.equal(spy.calls, 1);
  poller.close();
});

test('#1201 R1201-9 W3: a forge-less poller (initialError) still fetches on its timer; the forge lane never runs', async () => {
  const spy = fetchSpy();
  const callLog = [];
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog }), cache: createForgeCache(), project: 'o/r', interval: 60000, fetchRemotes: spy.fn,
    initialError: 'no VCS token', _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  await poller.start();
  assert.equal(spy.calls, 1, 'the first tick fetched');
  assert.equal(scheduler.pending(), 1, 'the timer is armed');
  await scheduler.runNext();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(spy.calls, 2, 'the second tick fetched');
  assert.deepEqual(callLog, [], 'the forge port was never called');
  assert.match(poller.state().lastError, /no VCS token/);
  assert.equal(poller.state().paused, false, 'halted, not user-paused');
  assert.equal(poller.state().forgeHalted, true);
  poller.close();
});

test('#1201 R1201-9 W3: a forge-less poller the USER paused (--no-poll) does not fetch on a timer', async () => {
  const spy = fetchSpy();
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog: [] }), cache: createForgeCache(), project: 'o/r', interval: 60000, fetchRemotes: spy.fn, enabled: false,
    initialError: 'no VCS token', _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  await poller.start();
  assert.equal(spy.calls, 0);
  assert.equal(scheduler.pending(), 0);
  await poller.refreshRemotes();
  assert.equal(spy.calls, 1, 'only the explicit refresh fetches');
  assert.equal(poller.state().paused, true, 'the user paused it');
  assert.equal(poller.state().forgeHalted, true, 'and the forge is still halted');
  poller.close();
});

test('#1201 R1201-9: two refreshes within ONCE_COLLAPSE_MS run one fetch; one after the window runs another', async () => {
  const spy = fetchSpy();
  const { poller, now } = remotesPoller({ fetchRemotes: spy.fn, enabled: false });
  await poller.refreshRemotes();
  now.t += 1000;
  await poller.refreshRemotes();
  assert.equal(spy.calls, 1);
  now.t += ONCE_COLLAPSE_MS;
  await poller.refreshRemotes();
  assert.equal(spy.calls, 2);
  poller.close();
});

test('#1201 D40: single flight — a tick and a second refresh during an in-flight fetch never start another', async () => {
  const spy = fetchSpy({ hold: true });
  const { poller, now } = remotesPoller({ fetchRemotes: spy.fn, enabled: false });
  const first = poller.refreshRemotes();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(poller.state().remotes.inFlight, true);
  now.t += ONCE_COLLAPSE_MS * 2;
  const second = poller.refreshRemotes();
  const once = poller.once(); // a whole tick: its remotes lane joins the one in flight
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(spy.calls, 1);
  spy.release();
  await Promise.all([first, second, once]);
  assert.equal(spy.calls, 1);
  assert.equal(poller.state().remotes.inFlight, false);
  poller.close();
});

test('#1201 D40: one failing lane never skips the other, in either direction', async () => {
  const log = [];
  const failingVcs = { ...makeVcs({ callLog: log }), issueList: async () => { log.push('issueList'); throw new Error('forge down'); } };
  const spy = fetchSpy();
  const a = remotesPoller({ fetchRemotes: spy.fn, vcs: failingVcs });
  await a.poller.start();
  assert.equal(spy.calls, 1, 'the forge failed, the fetch still ran');
  assert.equal(a.poller.state().lastError, 'forge down');
  assert.equal(a.poller.state().remotes.lastError, null);
  a.poller.close();

  const callLog = [];
  const bad = fetchSpy({ fail: 'fatal: Could not resolve host' });
  const b = remotesPoller({ fetchRemotes: bad.fn, vcs: makeVcs({ callLog }) });
  await b.poller.start();
  assert.ok(callLog.includes('issueList'), 'the fetch failed, the forge lane still ran');
  assert.equal(b.poller.state().lastError, null);
  b.poller.close();
});

test('#1201 R1201-11: a failed fetch sets lastError and keeps lastOkAt; a later success clears the error and moves lastOkAt', async () => {
  const spy = fetchSpy();
  const { poller, now } = remotesPoller({ fetchRemotes: spy.fn, enabled: false });
  assert.deepEqual(poller.state().remotes, { lastAttemptAt: null, lastOkAt: null, lastError: null, inFlight: false });
  now.t = Date.UTC(2026, 8, 1, 10, 0, 0);
  await poller.refreshRemotes();
  const ok = poller.state().remotes;
  assert.equal(ok.lastOkAt, '2026-09-01T10:00:00.000Z');
  assert.equal(ok.lastError, null);

  spy.fail = 'fatal: Could not resolve host';
  now.t += 60000;
  await poller.refreshRemotes();
  const failed = poller.state().remotes;
  assert.equal(failed.lastError, 'fatal: Could not resolve host');
  assert.equal(failed.lastOkAt, '2026-09-01T10:00:00.000Z', 'the last good time is kept');
  assert.equal(failed.lastAttemptAt, '2026-09-01T10:01:00.000Z');

  spy.fail = null;
  now.t += 60000;
  await poller.refreshRemotes();
  assert.equal(poller.state().remotes.lastError, null);
  assert.equal(poller.state().remotes.lastOkAt, '2026-09-01T10:02:00.000Z');
  poller.close();
});

test('#1201 D40: with no fetchRemotes the lane is a no-op and refreshRemotes() still answers', async () => {
  const { poller } = remotesPoller({});
  await poller.start();
  const state = await poller.refreshRemotes();
  assert.deepEqual(state.remotes, { lastAttemptAt: null, lastOkAt: null, lastError: null, inFlight: false });
  poller.close();
});

// ── #1201 D40: the lanes are independent in time, not only in failure ────────

test('#1201 R1201-9: a slow fetch never delays the forge lane — the next tick is armed and a forge change lands while the fetch is pending', async () => {
  const spy = fetchSpy({ hold: true });
  const ticks = [];
  const callLog = [];
  let issues = [{ number: 5, title: 'five', labels: [], assignees: [] }];
  const vcs = makeVcs({ callLog });
  vcs.issueList = async () => { callLog.push('issueList'); return issues.map((i) => ({ ...i })); };
  const { poller, scheduler } = remotesPoller({ fetchRemotes: spy.fn, vcs, onTick: () => ticks.push('onTick') });

  await poller.start(); // the fetch is held open and never released
  assert.equal(poller.state().remotes.inFlight, true, 'the fetch is still pending');
  assert.equal(scheduler.pending(), 1, 'the next forge tick is armed without waiting for the fetch');
  assert.deepEqual(ticks, ['onTick', 'onTick'], 'the first landing recomputes early (#1257 D66), then the tick reported on forge settle alone');

  issues = [{ number: 5, title: 'five', labels: ['status:approved'], assignees: [] }];
  await scheduler.runNext(); // the second tick: forge polls again, the in-flight fetch is joined, not re-run
  assert.equal(spy.calls, 1, 'single flight: an overlapping tick never starts a second fetch');
  assert.equal(callLog.filter((c) => c === 'issueList').length, 2, 'the forge lane polled again while the fetch was pending');
  assert.equal(scheduler.pending(), 1, 'and armed the tick after it');

  spy.release(); // the fetch finally settles
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(poller.state().remotes.inFlight, false);
  assert.equal(ticks.length, 4, 'its completion notifies once more so the section recomputes');
  poller.close();
});

test('#1201 R1201-9: a fetch that rejects after its tick ended lands in remotes.lastError and leaves no unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const spy = fetchSpy({ hold: true, fail: 'boom' });
    const { poller } = remotesPoller({ fetchRemotes: spy.fn });
    await poller.start();
    spy.release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(poller.state().remotes.lastError, 'boom');
    assert.equal(poller.state().remotes.inFlight, false);
    assert.deepEqual(unhandled, []);
    poller.close();
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

// ── #1243 R1243-1/2: the poller holds at most one armed handle ───────────────

/** A forge whose `issueList` is held until `release()`, so a tick can be paused mid-flight. */
function gatedVcs() {
  const gate = { release: null };
  const vcs = makeVcs({ callLog: [] });
  vcs.issueList = () => new Promise((resolve) => {
    gate.release = () => resolve([{ number: 1, title: 't', labels: [], assignees: [] }]);
  });
  return { vcs, gate };
}

function gatedPoller(extra = {}) {
  const scheduler = fakeScheduler();
  const { vcs, gate } = gatedVcs();
  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0), ...extra,
  });
  return { poller, scheduler, gate };
}

test('#1243 R1243-1/4: start, resume, resume on a forge-halted poller with a remotes lane holds ONE handle (resume is a no-op while not paused; this is a guard, arm()\'s clear is pinned below)', async () => {
  const spy = fetchSpy();
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog: [] }), cache: createForgeCache(), project: 'o/r', interval: 60000, fetchRemotes: spy.fn,
    initialError: 'no VCS token', _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  const t = poller.start();
  poller.resume();
  poller.resume();
  await t;
  assert.equal(scheduler.pending(), 1, 'one chain, whatever the order of start and resume');
  poller.close();
  assert.equal(scheduler.pending(), 0, 'close() stops every chain the poller started');
});

test('#1243 R1243-1: arm() clears a live handle before setting, so two settling ticks leave ONE handle', async () => {
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog: [] }), cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  // Two ticks in flight; each settles into scheduleNext() -> arm(), the second with a live handle.
  await Promise.all([poller.start(), poller.start()]);
  assert.equal(scheduler.pending(), 1, 'the second arm() cleared the first handle');
  poller.close();
  assert.equal(scheduler.pending(), 0);
});

test('#1243 R1243-1: pause clears the only chain', async () => {
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog: [] }), cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  await poller.start();
  assert.equal(scheduler.pending(), 1);
  poller.pause();
  assert.equal(scheduler.pending(), 0, 'no handle is armed after pause');
  assert.equal(poller.state().nextAttemptAt, null);
  poller.close();
});

test('#1243 R1243-1: pause during an in-flight tick, then resume before it settles, leaves ONE handle', async () => {
  const { poller, scheduler, gate } = gatedPoller();
  const t = poller.start();
  poller.pause();
  poller.resume();
  gate.release();
  await t;
  assert.equal(scheduler.pending(), 1);
  poller.pause();
  assert.equal(scheduler.pending(), 0, 'pause clears the only chain');
  poller.close();
});

test('#1243 R1243-1: a tick that settles while the user has paused arms nothing', async () => {
  const { poller, scheduler, gate } = gatedPoller();
  const t = poller.start();
  poller.pause();
  gate.release();
  await t;
  assert.equal(scheduler.pending(), 0);
  assert.equal(poller.state().nextAttemptAt, null);
  poller.close();
});

test('#1243 R1243-2: close() after pause-resume with a tick in flight arms nothing when the tick settles', async () => {
  const { poller, scheduler, gate } = gatedPoller();
  const t = poller.start();
  poller.pause();
  poller.resume();
  poller.close();
  gate.release();
  await t;
  assert.equal(scheduler.pending(), 0);
  assert.equal(poller.state().nextAttemptAt, null);
});

// ── #1243 R1243-3/4: `paused` is the user's pause; Resume never lifts a forge halt ──

function haltedPoller({ fetchRemotes = fetchSpy().fn, enabled = true, callLog = [] } = {}) {
  const scheduler = fakeScheduler();
  const poller = createPoller({
    vcs: makeVcs({ callLog }), cache: createForgeCache(), project: 'o/r', interval: 60000, fetchRemotes, enabled,
    initialError: 'no VCS token', _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(0),
  });
  return { poller, scheduler, callLog };
}

test('#1243 R1243-3: state() carries forgeHalted, forgeHaltReason and remotesLane; a user pause on a halt is a pause', () => {
  const { poller } = haltedPoller();
  let s = poller.state();
  assert.deepEqual([s.paused, s.forgeHalted, s.forgeHaltReason, s.remotesLane], [false, true, 'no VCS token', true]);
  assert.match(s.lastError, /no VCS token/);
  s = poller.pause();
  assert.deepEqual([s.paused, s.forgeHalted], [true, true]);
  poller.close();

  const plain = createPoller({ vcs: makeVcs({ callLog: [] }), cache: createForgeCache(), project: 'o/r' });
  s = plain.state();
  assert.deepEqual([s.paused, s.forgeHalted, s.forgeHaltReason, s.remotesLane], [false, false, null, false]);
  plain.close();
});

test('#1243 R1243-4: Resume never lifts the halt: the forge port is not called and the reason stays', async () => {
  const { poller, scheduler, callLog } = haltedPoller();
  poller.pause();
  poller.resume();
  assert.equal(scheduler.pending(), 1);
  await scheduler.runNext();
  await new Promise((resolve) => setImmediate(resolve));
  const s = poller.state();
  assert.equal(s.forgeHalted, true);
  assert.match(s.lastError, /no VCS token/);
  assert.deepEqual(callLog, []);
  poller.close();
});

test('#1243 R1243-4: resume after a user pause re-arms only the remotes timer; resume on an unpaused poller is a no-op', () => {
  const { poller, scheduler } = haltedPoller({ enabled: false });
  assert.equal(poller.state().paused, true);
  const s = poller.resume();
  assert.deepEqual([s.paused, s.forgeHalted, scheduler.pending()], [false, true, 1]);
  const due = poller.state().nextAttemptAt;
  poller.resume();
  assert.equal(scheduler.pending(), 1, 'the same single handle');
  assert.equal(poller.state().nextAttemptAt, due);
  poller.close();
});

test('#1243 R1243-4: a halted poller with no remotes lane arms nothing on resume', () => {
  const { poller, scheduler } = haltedPoller({ fetchRemotes: null, enabled: false });
  poller.resume();
  assert.equal(scheduler.pending(), 0);
  assert.equal(poller.state().remotesLane, false);
  poller.close();
});

// ── #1257 R1257-11: the open lane reads bodies from the list ─────────────────
//
// The list carries every body (R10), so an `issueView` is only the fallback for a
// row whose `body` is null, capped per tick. A row that carries a string body, the
// empty string included (R12), is never fetched again.

const BODY_CAP = 5;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const T = (ms) => new Date(ms).toISOString();

function rows(count, extra = {}) {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `t${i + 1}`, labels: [], assignees: [], state: 'open', body: 'b', ...extra }));
}

function simplePoller({ vcs, closedVcs, now = { t: 0 }, onTick, enabled = true, initialError = null, scheduler = fakeScheduler(), cache = createForgeCache() } = {}) {
  const poller = createPoller({
    vcs, cache, project: 'o/r', interval: 60000, enabled, initialError,
    ...(closedVcs ? { closedVcs } : {}),
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
    ...(onTick ? { onTick } : {}),
  });
  return { poller, scheduler, now, cache };
}

test('#1257 R1257-11: the open lane reads no body it already has', async () => {
  const callLog = [];
  const vcs = makeVcs({ callLog, issues: rows(133) });
  const { poller } = simplePoller({ vcs });
  await poller.start();
  assert.equal(callLog.filter((c) => c.startsWith('issueView:')).length, 0, 'every row carried a string body');
  poller.close();
});

test('#1257 R1257-11: the fallback is capped, ascending, and a cached number is not re-read', async () => {
  const callLog = [];
  const vcs = makeVcs({ callLog, issues: rows(8, { body: null }) });
  const { poller, scheduler, now } = simplePoller({ vcs });
  await poller.start();
  assert.deepEqual(callLog.filter((c) => c.startsWith('issueView:')), ['issueView:1', 'issueView:2', 'issueView:3', 'issueView:4', 'issueView:5']);

  callLog.length = 0;
  now.t += 60000;
  await scheduler.runNext();
  assert.deepEqual(callLog.filter((c) => c.startsWith('issueView:')), ['issueView:6', 'issueView:7', 'issueView:8'], 'the next tick reads only the numbers not yet cached');

  callLog.length = 0;
  now.t += 60000;
  await scheduler.runNext();
  assert.deepEqual(callLog.filter((c) => c.startsWith('issueView:')), [], 'a cached number is not re-read while its row body stays null');
  poller.close();
});

test('#1257 R1257-11: the cold start is capped too', async () => {
  const callLog = [];
  const vcs = makeVcs({ callLog, issues: rows(133, { body: null }) });
  const { poller } = simplePoller({ vcs });
  await poller.start();
  assert.equal(callLog.filter((c) => c.startsWith('issueView:')).length, BODY_CAP);
  poller.close();
});

test('#1257 R1257-11: an empty body is a body, not a reason to fetch', async () => {
  const callLog = [];
  const vcs = makeVcs({ callLog, issues: rows(3, { body: '' }) });
  const { poller } = simplePoller({ vcs });
  await poller.start();
  assert.equal(callLog.filter((c) => c.startsWith('issueView:')).length, 0);
  poller.close();
});

// ── #1257 R1257-8: forgeLoad, the open lane and the lane-independent cases ───

test('#1257 R1257-8: open pending while the first tick has not settled', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const vcs = { ...makeVcs({ callLog: [] }), issueList: async () => { await gate; return rows(1); } };
  const { poller } = simplePoller({ vcs });
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'pending', at: null }, 'before start');
  const started = poller.start();
  await flush();
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'pending', at: null }, 'a read in flight is pending, with no reason');
  release();
  await started;
  poller.close();
});

test('#1257 R1257-8: open complete once the list lands', async () => {
  const now = { t: 1000 };
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), now });
  await poller.start();
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'complete', at: T(1000) });
  poller.close();
});

test('#1257 R1257-8: open failed after complete keeps the cached list and says when it was last complete', async () => {
  const now = { t: 1000 };
  let fail = false;
  const vcs = { ...makeVcs({ callLog: [] }), issueList: async () => { if (fail) throw new Error('boom'); return rows(2); } };
  const { poller, scheduler, cache } = simplePoller({ vcs, now });
  await poller.start();
  fail = true;
  now.t = 2000;
  await scheduler.runNext();
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'failed', at: T(2000), reason: 'boom', lastCompleteAt: T(1000) });
  assert.equal((await cache.port.issueList({ state: 'open' })).length, 2, 'the T1 list is still served');
  poller.close();
});

test('#1257 R1257-8: open failed with no data has lastCompleteAt null', async () => {
  const now = { t: 1000 };
  const vcs = { ...makeVcs({ callLog: [] }), issueList: async () => { throw new Error('offline'); } };
  const { poller } = simplePoller({ vcs, now });
  await poller.start();
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'failed', at: T(1000), reason: 'offline', lastCompleteAt: null });
  poller.close();
});

test('#1257 R1257-8: a forge-halted poller reports both lanes failed with the halt reason', () => {
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), initialError: 'no git origin remote', now: { t: 500 } });
  const fl = poller.state().forgeLoad;
  assert.deepEqual(fl.open, { state: 'failed', at: T(500), reason: 'no git origin remote', lastCompleteAt: null });
  assert.deepEqual(fl.closed, { state: 'failed', at: T(500), reason: 'no git origin remote', lastCompleteAt: null });
  poller.close();
});

test('#1257 R1257-8: a poller paused before any load is pending with the reason "polling is paused"', () => {
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), enabled: false });
  assert.deepEqual(poller.state().forgeLoad.open, { state: 'pending', at: null, reason: 'polling is paused' });
  poller.close();
});

test('#1257 R1257-8: closed is disabled without a closed port', () => {
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }) });
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'disabled', at: null, reason: 'no closed-issue lane is configured' });
  poller.close();
});

// ── #1257 D66: the graph lands before the reviews ────────────────────────────

test('#1257 R1257-9: the graph lands before the reviews — onTick fires on the open list landing, before a held prReviews settles', async () => {
  let releaseReviews;
  const held = new Promise((resolve) => { releaseReviews = resolve; });
  const seen = [];
  const vcs = { ...makeVcs({ callLog: [], issues: rows(2), prs: [{ number: 9, title: 'p', headBranch: 'x' }] }), prReviews: async () => { await held; return []; } };
  const { poller } = simplePoller({ vcs, onTick: (s) => seen.push(s.forgeLoad.open.state) });
  const started = poller.start();
  await flush();
  assert.deepEqual(seen, ['complete'], 'one recompute, with the open list already complete, while the review is still held');
  releaseReviews();
  await started;
  assert.deepEqual(seen, ['complete', 'complete'], 'the tick keeps its own single onTick');
  poller.close();
});

test('#1257 R1257-9: only the first landing recomputes early; a steady tick has one onTick', async () => {
  const seen = [];
  const { poller, scheduler, now } = simplePoller({ vcs: makeVcs({ callLog: [] }), onTick: (s) => seen.push(s.forgeLoad.open.state) });
  await poller.start();
  seen.length = 0;
  now.t += 60000;
  await scheduler.runNext();
  assert.equal(seen.length, 1);
  poller.close();
});

// ── #1257 R1257-10: the closed lane ──────────────────────────────────────────

const CLOSED_SINCE_OVERLAP_MS = 600000;
const CLOSED_FULL_EVERY_RUNS = 60;

/** A `closedVcs` double: records every call, can be held, can fail, and answers from `answer(args, callNumber)`. */
function closedSpy({ answer = () => [], hold = false } = {}) {
  const spy = { calls: [], fail: null, release: null };
  const gate = new Promise((resolve) => { spy.release = resolve; });
  spy.port = {
    issueList: async (args) => {
      spy.calls.push(args);
      if (hold) await gate;
      if (spy.fail) throw new Error(spy.fail);
      return answer(args, spy.calls.length).map((r) => ({ ...r }));
    },
  };
  return spy;
}
const closedRow = (number, extra = {}) => ({ number, title: `c${number}`, labels: [], assignees: [], state: 'closed', body: 'b', ...extra });

test('#1257 R1257-10: the closed lane does not delay the open lane', async () => {
  const callLog = [];
  const closed = closedSpy({ hold: true });
  const { poller, scheduler, now } = simplePoller({ vcs: makeVcs({ callLog }), closedVcs: closed.port });
  await poller.start();
  for (let i = 0; i < 2; i++) { now.t += 60000; await scheduler.runNext(); }
  assert.equal(callLog.filter((c) => c === 'issueList').length, 3, 'the open issueList ran on each of the three ticks');
  assert.equal(closed.calls.length, 1, 'one flight: the held closed read is not started again');
  closed.release();
  await flush();
  poller.close();
});

test('#1257 R1257-10: first run full, second run incremental from the first run start minus the overlap', async () => {
  const closed = closedSpy({ answer: () => [closedRow(3)] });
  const { poller, scheduler, now } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, now: { t: 5000000 } });
  await poller.start();
  await flush();
  now.t = 6000000;
  await scheduler.runNext();
  await flush();
  assert.equal(closed.calls.length, 2);
  assert.deepEqual(closed.calls[0], { project: 'o/r', state: 'closed' }, 'the first run is full: no updatedSince');
  assert.equal(closed.calls[1].state, 'closed');
  assert.equal(closed.calls[1].updatedSince, T(5000000 - CLOSED_SINCE_OVERLAP_MS));
  poller.close();
});

test('#1257 R1257-10: a delta upserts by number and the cache serves the merged set in descending order', async () => {
  const closed = closedSpy({ answer: (_a, n) => (n === 1 ? [closedRow(3), closedRow(5)] : [closedRow(3, { title: 'edited' }), closedRow(9)]) });
  const { poller, scheduler, now, cache } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port });
  await poller.start();
  await flush();
  now.t += 60000;
  await scheduler.runNext();
  await flush();
  const rowsNow = await cache.port.issueList({ state: 'closed' });
  assert.deepEqual(rowsNow.map((r) => r.number), [9, 5, 3]);
  assert.equal(rowsNow.find((r) => r.number === 3).title, 'edited');
  poller.close();
});

test('#1257 R1257-10: a reopened issue leaves the closed set, whichever lane settles first', async () => {
  let openRows = rows(2);
  const vcs = { ...makeVcs({ callLog: [] }), issueList: async () => openRows.map((r) => ({ ...r })) };
  const closed = closedSpy({ answer: (_a, n) => (n === 1 ? [closedRow(7), closedRow(3)] : []) });
  const { poller, scheduler, now, cache } = simplePoller({ vcs, closedVcs: closed.port });
  await poller.start();
  await flush();
  assert.deepEqual((await cache.port.issueList({ state: 'closed' })).map((r) => r.number), [7, 3]);
  openRows = [...rows(2), { ...rows(1)[0], number: 7 }];
  now.t += 60000;
  await scheduler.runNext();
  await flush();
  assert.deepEqual((await cache.port.issueList({ state: 'closed' })).map((r) => r.number), [3], '#7 is open again, so it is no longer closed');
  poller.close();
});

test('#1257 R1257-10: every 60th run is a full re-list that replaces the held set', async () => {
  const closed = closedSpy({ answer: (_args, n) => (n === CLOSED_FULL_EVERY_RUNS ? [closedRow(500)] : [closedRow(n + 100)]) });
  const { poller, scheduler, now, cache } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port });
  await poller.start();
  await flush();
  for (let run = 2; run <= CLOSED_FULL_EVERY_RUNS; run++) { now.t += 60000; await scheduler.runNext(); await flush(); }
  assert.equal(closed.calls.length, CLOSED_FULL_EVERY_RUNS);
  assert.equal(closed.calls[CLOSED_FULL_EVERY_RUNS - 1].updatedSince, undefined, 'run 60 is full');
  assert.ok(closed.calls.slice(1, CLOSED_FULL_EVERY_RUNS - 1).every((c) => typeof c.updatedSince === 'string'), 'runs 2 to 59 are deltas');
  assert.deepEqual((await cache.port.issueList({ state: 'closed' })).map((r) => r.number), [500], 'the full list replaced the held set');
  poller.close();
});

test('#1257 R1257-10: a closed-lane failure is contained and retries from the same anchor', async () => {
  const closed = closedSpy({ answer: () => [closedRow(3)] });
  const now = { t: 1000000 };
  const { poller, scheduler, cache } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, now });
  await poller.start();
  await flush();
  closed.fail = 'rate limited';
  now.t = 2000000;
  await scheduler.runNext();
  await flush();
  const s = poller.state();
  assert.equal(s.lastError, null, 'the open lane is untouched');
  assert.equal(s.forgeLoad.open.state, 'complete');
  assert.deepEqual((await cache.port.issueList({ state: 'closed' })).map((r) => r.number), [3], 'the held closed list is still served');
  assert.deepEqual(s.forgeLoad.closed, { state: 'failed', at: T(2000000), reason: 'rate limited', lastCompleteAt: T(1000000) });
  closed.fail = null;
  now.t = 3000000;
  await scheduler.runNext();
  await flush();
  assert.equal(closed.calls[2].updatedSince, T(1000000 - CLOSED_SINCE_OVERLAP_MS), 'the retry uses the anchor of the last SUCCESSFUL run');
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'complete', at: T(3000000) });
  poller.close();
});

test('#1257 R1257-8: closed pending, complete after a full list, and a delta keeps it complete', async () => {
  const closed = closedSpy({ hold: true, answer: () => [closedRow(3)] });
  const now = { t: 1000000 };
  const { poller, scheduler } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, now });
  await poller.start();
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'pending', at: null }, 'a full list is in flight');
  closed.release();
  await flush();
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'complete', at: T(1000000) });
  now.t = 2000000;
  await scheduler.runNext();
  await flush();
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'complete', at: T(2000000) }, 'a delta keeps it complete with a new at');
  poller.close();
});

test('#1257 R1257-8: closed failed with no data has lastCompleteAt null', async () => {
  const closed = closedSpy();
  closed.fail = 'boom';
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, now: { t: 1000000 } });
  await poller.start();
  await flush();
  assert.deepEqual(poller.state().forgeLoad.closed, { state: 'failed', at: T(1000000), reason: 'boom', lastCompleteAt: null });
  assert.equal(poller.state().lastError, null);
  poller.close();
});

test('#1257 R1257-10: a closed read that settles outside a tick calls onTick itself', async () => {
  const closed = closedSpy({ hold: true });
  const seen = [];
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, onTick: (s) => seen.push(s.forgeLoad.closed.state) });
  await poller.start();
  const before = seen.length;
  closed.release();
  await flush();
  assert.equal(seen.length, before + 1);
  assert.equal(seen.at(-1), 'complete');
  poller.close();
});

test('#1257 R1257-10: a halted forge never starts the closed lane', async () => {
  const closed = closedSpy();
  const { poller } = simplePoller({ vcs: makeVcs({ callLog: [] }), closedVcs: closed.port, initialError: 'no git origin remote' });
  await poller.start();
  await poller.once();
  assert.equal(closed.calls.length, 0);
  poller.close();
});
