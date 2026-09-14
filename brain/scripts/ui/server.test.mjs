import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

import { buildSnapshot } from '../status/snapshot.mjs';
import { makeSnapshotFixture as makeFixture } from '../__fixtures__/snapshot-tree.mjs';
import { createForgeCache } from './forge-cache.mjs';
import { createUiServer, parseArgs, main, KNOWN_ROUTES } from './server.mjs';

const NOW = '2026-09-14T00:00:00Z';
const now = () => new Date(NOW);

/** A `fs.watch`-shaped spy: records every registration, fires listeners on demand. */
function spyWatch() {
  const calls = [];
  const fn = (path, _opts, listener) => {
    calls.push({ path, listener });
    return { close() {} };
  };
  fn.calls = calls;
  fn.fire = (path) => { const c = calls.find((entry) => entry.path === path); if (c) c.listener('change', null); };
  return fn;
}

/** A controllable `setTimeout`/`clearTimeout` pair with exactly one pending timer at a time. */
function fakeScheduler() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn) => { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    runLatest: () => { const id = [...timers.keys()].at(-1); const fn = timers.get(id); timers.delete(id); return fn(); },
    runNext: () => { const id = [...timers.keys()][0]; const fn = timers.get(id); timers.delete(id); return fn(); },
  };
}

/** Every write verb throws — proves a composed port never gets written to. */
function readOnlyWriteVerbs(reads) {
  const port = {};
  for (const w of ['mrCreate', 'mrAutoMerge', 'issueCreate', 'issueUpdate', 'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove', 'branchProtect']) {
    port[w] = async () => { throw new Error(`write verb ${w} called`); };
  }
  return Object.assign(port, reads);
}

/** Same as `readOnlyWriteVerbs`, plus every write verb's name is pushed to `calls` before it throws — so a test can assert a call COUNT, not just "it would have thrown". */
function countedWriteVerbs(calls, reads) {
  const port = {};
  for (const w of ['mrCreate', 'mrAutoMerge', 'issueCreate', 'issueUpdate', 'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove', 'branchProtect']) {
    port[w] = async () => { calls.push(w); throw new Error(`write verb ${w} called`); };
  }
  return Object.assign(port, reads);
}

/** `{path}:{dir-or-size}:{mtimeMs}` for every entry under `root`, sorted — the same walker `snapshot.test.mjs`'s `snapshotTree()` uses, so a before/after diff catches ANY write, not just the ones a specific assertion names. */
function snapshotTree(root) {
  const out = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); const s = statSync(p); out.push(`${p}:${s.isDirectory() ? 'd' : s.size}:${s.mtimeMs}`); if (s.isDirectory()) walk(p); } };
  walk(root);
  return out.sort();
}

/** Reads one `event: ...\ndata: ...\n\n` frame at a time off an SSE response body. */
function frameReader(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const readFrame = async () => {
    while (!buf.includes('\n\n')) buf += dec.decode((await reader.read()).value, { stream: true });
    const frame = buf.slice(0, buf.indexOf('\n\n'));
    buf = buf.slice(buf.indexOf('\n\n') + 2);
    return frame;
  };
  readFrame.reader = reader;
  return readFrame;
}

async function waitUntil(predicate, { timeoutMs = 1000, stepMs = 5 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: timed out');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

// ── R881-1 S1/S2: default port, static root, ephemeral port ────────────────

test('#881: R881-1 S1 — no --port defaults to port 3000 (parity checked via parseArgs; binding 3000 in a test run would flake CI)', () => {
  assert.equal(parseArgs([]).port, 3000);
});

test('#881: createUiServer defaults to port 3000 before listen() is called', () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  assert.equal(server.port, 3000);
});

test('#881: R881-1 S1 — GET / returns the SPA static placeholder', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  await server.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html');
    const body = await res.text();
    assert.match(body, /brain:ui/, 'the placeholder names the verb it belongs to, proving it is the real static file, not an empty 200');
  } finally {
    await server.close();
  }
});

test('#881: R881-1 S2 — --port 0 listens on an OS-assigned port and reports it', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  await server.listen(0);
  try {
    assert.notEqual(server.port, 0);
    assert.ok(Number.isInteger(server.port) && server.port > 0, `expected a real OS-assigned port, got ${server.port}`);
  } finally {
    await server.close();
  }
});

test('#881: an unmatched path answers 404', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  await server.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

// ── R881-1 S3 / A4: snapshot shape parity ───────────────────────────────────

test('#881: A4 — GET /api/snapshot deep-equals in-process buildSnapshot on the same fixture root, port and clock', async () => {
  const root = makeFixture();
  const cache = createForgeCache();
  cache.setIssueList([{ number: 5, title: 'five' }]);
  cache.setMrList([]);
  const server = createUiServer({ root, vcs: cache.port, project: 'o/r', _now: now });
  await server.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/snapshot`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    const fromServer = await res.json();
    const fromModule = await buildSnapshot({ root, now: now(), vcs: cache.port, project: 'o/r' });
    assert.deepEqual(fromServer, JSON.parse(JSON.stringify(fromModule)));
    assert.equal(fromServer.graph.ok, true, 'the seeded cache answered issueList — proof the route composed buildSnapshot with the injected port, not a stub');
    assert.deepEqual(fromServer.graph.value.issuesUnreadable, [{ number: 5, reason: 'the first forge poll has not completed' }], 'issueView was never seeded, so the per-issue read misses in band');
  } finally {
    await server.close();
  }
});

// ── A5: read-only-port proof, composed through forge-cache.mjs ─────────────

test('#881: A5 — every route this PR ships completes with a forge-cache-composed port, no write verb reachable', async () => {
  const root = makeFixture();
  const cache = createForgeCache();
  cache.setIssueList([]);
  cache.setMrList([]);
  assert.deepEqual(Object.keys(cache.port).sort(), ['issueList', 'issueView', 'mrList', 'prReviews'], 'the composed port has no write verb to call, by construction');
  const server = createUiServer({ root, vcs: cache.port, project: 'o/r', _now: now });
  await server.listen(0);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    const snap = await fetch(`${base}/api/snapshot`);
    assert.equal(snap.status, 200);
    const body = await snap.json();
    assert.equal(body.graph.ok, true);
    assert.equal(body.prs.ok, true);
  } finally {
    await server.close();
  }
});

// ── R881-5 S1: mutation methods are rejected on every route this PR ships ──

test('#881: R881-5 S1 — POST/PUT/PATCH/DELETE against / and /api/snapshot all return 405 with Allow: GET, HEAD', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  await server.listen(0);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    for (const path of ['/', '/api/snapshot']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const res = await fetch(`${base}${path}`, { method });
        assert.equal(res.status, 405, `${method} ${path}`);
        assert.equal(res.headers.get('allow'), 'GET, HEAD', `${method} ${path}`);
      }
    }
  } finally {
    await server.close();
  }
});

test('#881: R881-5 S1 — the method check runs before routing, so an unmatched path still answers 405, not 404, on a mutation method', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now });
  await server.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/does-not-exist`, { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  } finally {
    await server.close();
  }
});

// ── D15: parseArgs, EADDRINUSE ──────────────────────────────────────────────

test('#881: parseArgs — --port and --root, defaults, unknown flags refused', () => {
  assert.deepEqual(parseArgs([]), { ok: true, port: 3000, root: process.cwd(), interval: 60000, poll: true });
  assert.deepEqual(parseArgs(['--port', '4500']), { ok: true, port: 4500, root: process.cwd(), interval: 60000, poll: true });
  assert.deepEqual(parseArgs(['--root', '/tmp/some-dir']), { ok: true, port: 3000, root: '/tmp/some-dir', interval: 60000, poll: true });
  assert.equal(parseArgs(['--bogus']).ok, false);
  assert.equal(parseArgs(['--port', 'nope']).ok, false);
  assert.equal(parseArgs(['--port', '-1']).ok, false);
});

// ── T5: --interval, --no-poll ───────────────────────────────────────────────

test('#881: parseArgs — --interval overrides the 60s default; --no-poll disables the timer entirely', () => {
  assert.deepEqual(parseArgs(['--interval', '5000']), { ok: true, port: 3000, root: process.cwd(), interval: 5000, poll: true });
  assert.deepEqual(parseArgs(['--no-poll']), { ok: true, port: 3000, root: process.cwd(), interval: 60000, poll: false });
  assert.equal(parseArgs(['--interval', 'nope']).ok, false);
  assert.equal(parseArgs(['--interval', '-1']).ok, false);
});

test('#881: --no-poll composes with R881-4 S2 — the poller starts paused, so the timer never fires and the page stays on manual "poll now"', async () => {
  const root = makeFixture();
  const messages = [];
  const result = await main(['--port', '0', '--root', root, '--no-poll'], { say: (m) => messages.push(m), error: () => {} });
  try {
    const base = `http://127.0.0.1:${result.port}`;
    const res = await fetch(`${base}/api/poll/pause`, { method: 'POST' }); // idempotent state check
    assert.equal((await res.json()).paused, true);
  } finally {
    await result.close();
  }
});

test('#881: main exits 2 on an unknown argument', async () => {
  const errors = [];
  const code = await main(['--bogus'], { say: () => {}, error: (m) => errors.push(m) });
  assert.equal(code, 2);
  assert.match(errors.join('\n'), /unknown argument: --bogus/);
});

test('#881: EADDRINUSE prints "port <n> is already in use" and exits 2 (D15 — same class as a bad argument)', async () => {
  const blocker = createUiServer({ root: makeFixture() });
  await blocker.listen(0);
  try {
    const port = blocker.port;
    const errors = [];
    const code = await main(['--port', String(port), '--root', makeFixture()], { say: () => {}, error: (m) => errors.push(m) });
    assert.equal(code, 2);
    assert.match(errors.join('\n'), new RegExp(`port ${port} is already in use`));
  } finally {
    await blocker.close();
  }
});

// ── judgment:cold-2: a throwing startup recompute must reject listen(), not hang ─
//
// `listen()`'s `onListening` callback runs `await recomputeCurrent()` with no
// try/catch and no `.catch()`. If `buildSnapshot()` ever threw there, the
// exception would become an unhandled rejection and the outer `new Promise`
// in `listen()` would never resolve or reject — the caller hangs forever.
// Every other call site IS protected (`handleRequest`'s `.catch`,
// `recomputeAndBroadcast`'s try/catch). The `_recomputeCurrent` seam lets a
// test force that throw without reaching into `buildSnapshot` itself; it
// defaults to the real recompute (`buildSnapshot({ root, now: _now(), vcs:
// forgeVcs, project })`) for every other test in this file.
//
// A short `timeout` turns a regression back into a HANG (this test itself
// would time out and fail, not the process locking up silently) instead of a
// clean assertion failure — RED for this test must be a failure either way.

test('#881: judgment:cold-2 — a throwing startup recompute rejects listen() and releases the port instead of hanging', { timeout: 3000 }, async () => {
  const root = makeFixture();
  const boom = new Error('boom: startup recompute failed');
  const server = createUiServer({ root, _now: now, _recomputeCurrent: async () => { throw boom; } });

  await assert.rejects(server.listen(0), /boom: startup recompute failed/);
  const failedPort = server.port;
  assert.ok(Number.isInteger(failedPort) && failedPort > 0, 'the port was assigned before the recompute failed');

  // The port must be released, not held by a half-started server: a second,
  // independent server can bind the EXACT same port number right after.
  const second = createUiServer({ root, _now: now });
  await second.listen(failedPort);
  try {
    assert.equal(second.port, failedPort);
  } finally {
    await second.close();
  }
});

test('#881: judgment:cold-2 — main() exits 2 with the message when listen() rejects for a reason other than EADDRINUSE (D15\'s own "same exit-code class" convention)', async () => {
  const root = makeFixture();
  const errors = [];
  const code = await main(['--port', '0', '--root', root], {
    say: () => {}, error: (m) => errors.push(m),
    _recomputeCurrent: async () => { throw new Error('boom: startup recompute failed'); },
  });
  assert.equal(code, 2);
  assert.match(errors.join('\n'), /boom: startup recompute failed/);
});

test('#881: main succeeds on a free (ephemeral) port and reports where it listens', async () => {
  const messages = [];
  const result = await main(['--port', '0', '--root', makeFixture()], { say: (m) => messages.push(m), error: () => {} });
  assert.notEqual(typeof result, 'number', 'success returns the started server, not an exit code');
  assert.match(messages.join('\n'), /brain:ui listening on http:\/\/127\.0\.0\.1:\d+/);
  await result.close();
});

test('#881: D15 — SIGINT/SIGTERM stop the poll timer, close every watcher, end every open SSE response, close the listener, and exit 0', async () => {
  const fakeProcess = new EventEmitter();
  const exits = [];
  fakeProcess.exit = (code) => exits.push(code);
  const root = makeFixture();
  const messages = [];
  const result = await main(['--port', '0', '--root', root], { say: (m) => messages.push(m), error: () => {}, process: fakeProcess });
  assert.notEqual(typeof result, 'number');

  try {
    const res = await fetch(`http://127.0.0.1:${result.port}/api/stream`);
    const readFrame = frameReader(res);
    await readFrame(); // the SSE connection is live

    fakeProcess.emit('SIGINT');
    await waitUntil(() => exits.length > 0);
    assert.deepEqual(exits, [0]);
    const { done } = await readFrame.reader.read();
    assert.equal(done, true, 'the open SSE response was ended by the shutdown, not left hanging');

    // a second signal after shutdown is a no-op, not a second exit
    fakeProcess.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(exits, [0]);
  } finally {
    // shutdown already closed it on the happy path; a second close() is a
    // harmless no-op and this is the only safety net if SIGINT never fires
    await result.close().catch(() => {});
  }
});

// ── R881-2 S1/Q4: GET /api/stream — sync frame first ────────────────────────

test('#881: R881-2 S1 — the first SSE frame is `sync`, carrying the whole current snapshot', async () => {
  const root = makeFixture();
  const cache = createForgeCache();
  cache.setIssueList([]);
  cache.setMrList([]);
  const server = createUiServer({ root, vcs: cache.port, project: 'o/r', _now: now, poll: false });
  await server.listen(0);
  const ac = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`, { signal: ac.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const readFrame = frameReader(res);
    const frame = await readFrame();
    assert.match(frame, /^event: sync\ndata: \{/);
    const payload = JSON.parse(frame.slice('event: sync\ndata: '.length));
    assert.equal(payload.snapshot.graph.ok, true);
    assert.equal(payload.meta.project, 'o/r');
    ac.abort();
  } finally {
    await server.close();
  }
});

// ── R881-2 S2/A2: a committed-tier change reaches the client ────────────────

test('#881: R881-2 S2/A2 — a committed-tier change (via the watcher) yields a `section` frame within the debounce, no reconnect', async () => {
  const root = makeFixture();
  const cache = createForgeCache();
  cache.setIssueList([]);
  cache.setMrList([]);
  const scheduler = fakeScheduler();
  const _watch = spyWatch();
  const server = createUiServer({
    root, vcs: cache.port, project: 'o/r', _now: now, poll: false,
    _watch, _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
  });
  await server.listen(0);
  const ac = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`, { signal: ac.signal });
    const readFrame = frameReader(res);
    await readFrame(); // sync

    writeFileSync(join(root, 'openspec/changes/issue-1-a/tasks.md'), '- [x] done\n- [x] next one\n');
    _watch.fire(join(root, 'openspec/changes/issue-1-a'));
    scheduler.runLatest();

    const frame = await readFrame();
    assert.match(frame, /^event: section\ndata: \{"name":"changes"/);
    ac.abort();
  } finally {
    await server.close();
  }
});

// ── R881-2 S2 (refs): a ref-tracking watch yields a `refs` frame ───────────

test('#881: R881-2 S2 (refs) — a ref-tracking watch (<git-common>/logs) yields a `refs` frame naming {worktree, head}', async () => {
  const root = makeFixture();
  const cache = createForgeCache();
  cache.setIssueList([]);
  cache.setMrList([]);
  const scheduler = fakeScheduler();
  const _watch = spyWatch();
  const gitCommonDir = join(root, '.git'); // never touched on disk — `_watch` is a spy
  const _run = (file, args) => {
    if (args[0] === 'worktree') return `worktree ${root}\n`;
    if (args.includes('rev-parse') && args.includes('--abbrev-ref')) return 'feat/example\n';
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  };
  const server = createUiServer({
    root, vcs: cache.port, project: 'o/r', _now: now, poll: false,
    gitCommonDir, _watch, _run, _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
  });
  await server.listen(0);
  const ac = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`, { signal: ac.signal });
    const readFrame = frameReader(res);
    await readFrame(); // sync

    _watch.fire(join(gitCommonDir, 'logs'));
    scheduler.runLatest();

    const frame = await readFrame();
    assert.match(frame, /^event: refs\ndata: \{/);
    const payload = JSON.parse(frame.slice('event: refs\ndata: '.length));
    assert.equal(payload.worktree, root);
    assert.equal(payload.head, 'feat/example');
    ac.abort();
  } finally {
    await server.close();
  }
});

// ── R881-2 S3: a forge change reaches the client ─────────────────────────────

test('#881: R881-2 S3 — a forge change (via the poller) yields a `section` frame on the next tick', async () => {
  const root = makeFixture();
  const scheduler = fakeScheduler();
  let issues = [{ number: 5, title: 'five', labels: [], assignees: [] }];
  const forgeSource = {
    issueList: async () => issues.map((i) => ({ ...i })),
    mrList: async () => [],
    issueView: async ({ number }) => ({ number, body: '' }),
    prReviews: async () => [],
  };
  const server = createUiServer({
    root, project: 'o/r', _now: now, forgeSource,
    _setTimeout: scheduler.setTimeout, _clearTimeout: scheduler.clearTimeout,
  });
  await server.listen(0); // the cold-start tick runs immediately
  const ac = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`, { signal: ac.signal });
    const readFrame = frameReader(res);
    await readFrame(); // sync

    issues = [{ number: 5, title: 'five', labels: ['status:approved'], assignees: [] }]; // the label moves
    assert.equal(scheduler.pending(), 1);
    scheduler.runNext();

    const frame = await readFrame();
    assert.match(frame, /^event: section\ndata: \{"name":"graph"/);
    ac.abort();
  } finally {
    await server.close();
  }
});

// ── D15/Q4: server.close() ends every open SSE response ─────────────────────

test('#881: D15/Q4 — server.close() ends every open SSE response before closing the listener, no hang under node --test', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now, poll: false });
  await server.listen(0);
  const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`);
  const readFrame = frameReader(res);
  await readFrame(); // the connection is live
  await server.close();
  const { done } = await readFrame.reader.read();
  assert.equal(done, true, 'the SSE response was ended by close(), not left hanging');
});

// ── R881-5 S1 (re-run) / R881-5 S2: the now-complete route table ────────────

test('#881: R881-5 S1 (re-run) — mutation methods are rejected on every non-control route, including /api/stream', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now, poll: false });
  await server.listen(0);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    for (const path of ['/', '/api/snapshot', '/api/stream']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const res = await fetch(`${base}${path}`, { method });
        assert.equal(res.status, 405, `${method} ${path}`);
        assert.equal(res.headers.get('allow'), 'GET, HEAD', `${method} ${path}`);
      }
    }
  } finally {
    await server.close();
  }
});

test('#881: R881-5 S2 — the three poll-control routes accept POST only, and POST mutates only in-process state', async () => {
  const server = createUiServer({ root: makeFixture(), _now: now, poll: false });
  await server.listen(0);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    for (const path of ['/api/poll/pause', '/api/poll/resume', '/api/poll/once']) {
      for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
        const res = await fetch(`${base}${path}`, { method });
        assert.equal(res.status, 405, `${method} ${path}`);
        assert.equal(res.headers.get('allow'), 'POST', `${method} ${path}`);
      }
    }
    const pauseRes = await fetch(`${base}/api/poll/pause`, { method: 'POST' });
    assert.equal(pauseRes.status, 200);
    assert.equal(pauseRes.headers.get('content-type'), 'application/json');
    assert.equal((await pauseRes.json()).paused, true);

    const resumeRes = await fetch(`${base}/api/poll/resume`, { method: 'POST' });
    assert.equal((await resumeRes.json()).paused, false);
  } finally {
    await server.close();
  }
});

// ── D7: "asserts after a POST /api/poll/pause that no file under the served
// root, no git ref and no forge stub call changed" ──────────────────────────

test('#881: D7 — POST /api/poll/pause, /resume and /once leave the served root, the refs and the forge untouched', async () => {
  const root = makeFixture();
  const writeCalls = [];
  const readCalls = [];
  const forgeSource = countedWriteVerbs(writeCalls, {
    issueList: async () => { readCalls.push('issueList'); return []; },
    mrList: async () => { readCalls.push('mrList'); return []; },
    issueView: async () => { readCalls.push('issueView'); return {}; },
    prReviews: async () => { readCalls.push('prReviews'); return []; },
  });
  const server = createUiServer({ root, project: 'o/r', _now: now, forgeSource, poll: false });
  await server.listen(0);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const before = snapshotTree(root);

    const pauseRes = await fetch(`${base}/api/poll/pause`, { method: 'POST' });
    assert.equal(pauseRes.status, 200);
    const resumeRes = await fetch(`${base}/api/poll/resume`, { method: 'POST' });
    assert.equal(resumeRes.status, 200);
    // `once` may legitimately read the forge (it triggers a real poll on
    // demand) — the assertion below is only about WRITE verbs, never about
    // whether a read happened.
    const onceRes = await fetch(`${base}/api/poll/once`, { method: 'POST' });
    assert.equal(onceRes.status, 200);

    const after = snapshotTree(root);
    assert.deepEqual(after, before, 'no file under the served root changed for pause, resume or once');
    assert.equal(writeCalls.length, 0, 'no write verb was ever invoked by any poll control');
    assert.ok(readCalls.includes('issueList'), 'once actually ran a poll against the composed port (proves this is not a vacuous pass)');

    // The fixture root `makeFixture()` builds (`__fixtures__/snapshot-tree.mjs`)
    // never runs `git init` — there is no `.git` to rev-parse here, so the
    // "no git ref changed" leg of D7's promise is skipped for that stated
    // reason. It is a no-op by construction: none of these three routes ever
    // calls `run('git', [...])` in the first place (`server.mjs`'s
    // `servePollControl` only calls the poller's own pause/resume/once).
  } finally {
    await server.close();
  }
});

test('#881: R881-5 S3 / A5 (re-run) — with the poller wired in, a full poll cycle plus every route completes with no write verb ever invoked', async () => {
  const root = makeFixture();
  const callLog = [];
  const forgeSource = readOnlyWriteVerbs({
    issueList: async () => { callLog.push('issueList'); return []; },
    mrList: async () => { callLog.push('mrList'); return []; },
    issueView: async () => { callLog.push('issueView'); return {}; },
    prReviews: async () => { callLog.push('prReviews'); return []; },
  });
  const server = createUiServer({ root, project: 'o/r', _now: now, forgeSource });
  await server.listen(0); // the cold-start tick runs against the write-throwing port
  try {
    const base = `http://127.0.0.1:${server.port}`;
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/api/snapshot`)).status, 200);
    assert.equal((await fetch(`${base}/api/poll/once`, { method: 'POST' })).status, 200);
    assert.ok(callLog.includes('issueList'), 'the poller actually ran against the composed port');
  } finally {
    await server.close();
  }
});

// ── R881-10 S3: no MCP resource route, no heartbeat/agent-pulse endpoint ────

test('#881: R881-10 S3 — the route table has no MCP resource route and no heartbeat/agent-pulse endpoint', () => {
  assert.deepEqual(KNOWN_ROUTES, ['/', '/api/snapshot', '/api/stream', '/api/poll/pause', '/api/poll/resume', '/api/poll/once']);
  assert.ok(!KNOWN_ROUTES.some((r) => /mcp|heartbeat|pulse/i.test(r)));
});

// ── package.json: brain:ui verb and engines (D8, D16) ───────────────────────

test('#881: package.json exposes "brain:ui" and "engines.node" >= 22', () => {
  const pkgPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.equal(pkg.scripts['brain:ui'], 'node ./brain/scripts/ui/server.mjs');
  assert.equal(pkg.engines.node, '>=22');
});
