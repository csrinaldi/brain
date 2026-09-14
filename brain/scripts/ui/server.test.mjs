import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshot } from '../status/snapshot.mjs';
import { makeSnapshotFixture as makeFixture } from '../__fixtures__/snapshot-tree.mjs';
import { createForgeCache } from './forge-cache.mjs';
import { createUiServer, parseArgs } from './server.mjs';

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
