import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createForgeCache } from './forge-cache.mjs';
import { createPoller } from './poller.mjs';

// ── test doubles ─────────────────────────────────────────────────────────

function makeVcs({ callLog, issues = [{ number: 1, title: 't', labels: [], assignees: [] }], prs = [] }) {
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

// ── R881-4 S1: unchanged issues cost nothing on the next poll ──────────────

test('#881: R881-4 S1 — unchanged issues cost nothing on the next poll', async () => {
  const now = { t: 0 };
  const callLog = [];
  const issues = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, title: `t${i + 1}`, labels: [], assignees: [] }));
  const vcs = makeVcs({ callLog, issues });
  const poller = createPoller({ vcs, cache: createForgeCache(), project: 'o/r', _now: () => new Date(now.t) });

  await poller.once(); // cold start — every issue's body is fetched once
  assert.equal(callLog.filter((c) => c.startsWith('issueView:')).length, 6);

  callLog.length = 0;
  now.t += 60000;
  await poller.once(); // nothing in issueList changed
  assert.equal(callLog.filter((c) => c.startsWith('issueView:')).length, 0, 'no per-issue issueView call for any of the unchanged issues');
  poller.close();
});

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

// ── Q1/D2: the call-count budget over 30 simulated ticks ───────────────────

test('#881: Q1/D2 — 30 simulated ticks hold the budget: cold start once, then 2 + min(P,10) + B per steady tick', async () => {
  const scheduler = fakeScheduler();
  const now = { t: 0 };
  const callLog = [];
  const ISSUE_COUNT = 90;
  const PR_COUNT = 3;
  let tick = 0;
  const baseIssues = Array.from({ length: ISSUE_COUNT }, (_, i) => ({ number: i + 1, title: `issue ${i + 1}`, labels: [], assignees: [] }));
  const prs = Array.from({ length: PR_COUNT }, (_, i) => ({ number: 1000 + i, title: `pr ${i}`, headBranch: `feat/x-${i}` }));
  const vcs = {
    issueList: async () => {
      callLog.push('issueList');
      tick += 1;
      const rows = baseIssues.map((r) => ({ ...r }));
      if (tick > 1) {
        // exactly one issue's label moves per steady tick, rotating through the set
        const idx = (tick - 2) % ISSUE_COUNT;
        rows[idx] = { ...rows[idx], labels: [`moved-on-tick-${tick}`] };
        baseIssues[idx] = rows[idx];
      }
      return rows;
    },
    mrList: async () => { callLog.push('mrList'); return prs.map((p) => ({ ...p })); },
    issueView: async ({ number }) => { callLog.push(`issueView:${number}`); return { number, body: 'b' }; },
    prReviews: async ({ number }) => { callLog.push(`prReviews:${number}`); return []; },
  };

  const poller = createPoller({
    vcs, cache: createForgeCache(), project: 'o/r', interval: 60000,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout, _now: () => new Date(now.t),
  });

  await poller.start(); // tick 1 — cold start
  assert.equal(callLog.length, 1 /* issueList */ + ISSUE_COUNT + 1 /* mrList */ + PR_COUNT, 'cold start: 1 + I + 1 + P');

  for (let i = 0; i < 29; i++) {
    const before = callLog.length;
    now.t += 60000;
    await scheduler.runNext();
    const spent = callLog.length - before;
    assert.equal(spent, 2 + Math.min(PR_COUNT, 10) + 5, `steady tick ${i + 2}: 2 + min(P,10) + B`);
  }

  poller.close();
});
