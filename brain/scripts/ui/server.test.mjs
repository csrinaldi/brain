import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../status/snapshot.mjs';
import { makeSnapshotFixture as makeFixture } from '../__fixtures__/snapshot-tree.mjs';
import { createForgeCache } from './forge-cache.mjs';
import { createUiServer, parseArgs, main } from './server.mjs';

const NOW = '2026-09-14T00:00:00Z';
const now = () => new Date(NOW);

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
  assert.deepEqual(parseArgs([]), { ok: true, port: 3000, root: process.cwd() });
  assert.deepEqual(parseArgs(['--port', '4500']), { ok: true, port: 4500, root: process.cwd() });
  assert.deepEqual(parseArgs(['--root', '/tmp/some-dir']), { ok: true, port: 3000, root: '/tmp/some-dir' });
  assert.equal(parseArgs(['--bogus']).ok, false);
  assert.equal(parseArgs(['--port', 'nope']).ok, false);
  assert.equal(parseArgs(['--port', '-1']).ok, false);
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

test('#881: main succeeds on a free (ephemeral) port and reports where it listens', async () => {
  const messages = [];
  const result = await main(['--port', '0', '--root', makeFixture()], { say: (m) => messages.push(m), error: () => {} });
  assert.notEqual(typeof result, 'number', 'success returns the started server, not an exit code');
  assert.match(messages.join('\n'), /brain:ui listening on http:\/\/127\.0\.0\.1:\d+/);
  await result.close();
});

// ── package.json: brain:ui verb and engines (D8, D16) ───────────────────────

test('#881: package.json exposes "brain:ui" and "engines.node" >= 22', () => {
  const pkgPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.equal(pkg.scripts['brain:ui'], 'node ./brain/scripts/ui/server.mjs');
  assert.equal(pkg.engines.node, '>=22');
});
