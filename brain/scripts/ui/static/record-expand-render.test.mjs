// record-expand-render.test.mjs — the Memory ledger shows what a record says,
// and a click opens its full content inline (#1313). The REAL app.js on the
// fake DOM, over a snapshot built from real record files, so every assertion
// is made on what the page built, never on the model that fed it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { NO_TEXT, EMPTY_TEXT } from '../../memory/lib/record-summary.mjs';
import { RECORD_LOADING, recordFailure, recordTruncated } from '../lib/memory-model.mjs';
import { UNAVAILABLE_NOTICE, FAILED_NOTICE } from '../lib/render-budget.mjs';
import { MODES } from '../lib/view-model.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];

const A = 'rec-1111111111111111';
const B = 'rec-2222222222222222';
const C = 'rec-3333333333333333';
const D = 'rec-4444444444444444';
const FULL_A = '**Poller holds one timer**\n\n## What\n\n- arm() and disarm() keep one handle\n- a second `arm()` is a no-op\n\nplain tail';
const HOSTILE = '**Hostile**\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) and <img src=x onerror=alert(1)>';

const REC = {
  [A]: { ts: '2026-09-18T22:10:52Z', content: FULL_A },
  [B]: { ts: '2026-09-17T09:00:00Z' },
  [C]: { ts: '2026-09-16T09:00:00Z', content: '   \n  ' },
  [D]: { ts: '2026-09-15T09:00:00Z', content: HOSTILE },
};

function fixtureRoot() {
  const root = testTmp('record-expand-');
  const dir = join(root, '.memory', 'records');
  mkdirSync(dir, { recursive: true });
  for (const [id, rec] of Object.entries(REC)) {
    writeFileSync(join(dir, `${rec.ts.slice(0, 7)}-${id}.jsonl`),
      `${JSON.stringify({ id, actor: 'feat/x', actorKind: 'agent', type: 'architecture', project: 'brain', ...rec })}\n`);
  }
  return root;
}

async function boot({ records, worker } = {}) {
  const root = fixtureRoot();
  const vcs = { async issueList() { return []; }, async issueView() { return { body: '', assignees: [] }; } };
  const snapshot = await buildSnapshot({ root, project: 'csrinaldi/brain', vcs, now: '2026-09-19T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  const answers = records ?? {
    [A]: { ok: true, id: A, file: `.memory/records/2026-09-${A}.jsonl`, content: FULL_A, truncated: false, truncatedAt: null },
    [D]: { ok: true, id: D, file: `.memory/records/2026-09-${D}.jsonl`, content: HOSTILE, truncated: false, truncatedAt: null },
    [B]: { ok: false, reason: NO_TEXT },
    [C]: { ok: false, reason: EMPTY_TEXT },
  };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, records: answers, ...(worker === undefined ? {} : { worker }) });
  await loadApp();
  await settle();
  const label = MODES.find((m) => m.id === 'memory').label;
  fire(find(dom.mounts.modes, (n) => n.tagName === 'BUTTON' && n.textContent.includes(label)), 'click');
  await settle();
  return { dom, snapshot };
}

const dataRows = (dom) => findAll(dom.mounts.canvas, (n) => n.tagName === 'TR').slice(1).filter((tr) => !tr.classList.contains('memory-detail'));
const rowOf = (dom, id) => dataRows(dom).find((tr) => find(tr, byClass('memory-id'))?.textContent === id);
const toggleOf = (dom, id) => find(rowOf(dom, id), byClass('memory-toggle'));
const detailAfter = (row) => (row.nextSibling && row.nextSibling.classList.contains('memory-detail') ? row.nextSibling : null);
const open = async (dom, id) => { fire(toggleOf(dom, id), 'click'); await settle(); };

test('#1313 R1313-5 S1: the RECORD cell reads title, excerpt, then id; the source stamp cell is still there', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  const row = rowOf(dom, A);
  const title = find(row, byClass('memory-record-title'));
  const excerpt = find(row, byClass('memory-record-excerpt'));
  assert.equal(title.textContent, 'Poller holds one timer');
  assert.equal(excerpt.textContent, 'What arm() and disarm() keep one handle a second arm() is a no-op plain tail');
  assert.equal(find(row, byClass('memory-id')).textContent, A);
  assert.ok(find(row, byClass('memory-source')), 'the source stamp cell is kept');
  const cell = find(row, byClass('memory-record-cell'));
  const order = findAll(cell, (n) => ['memory-record-title', 'memory-record-excerpt', 'memory-id'].some((c) => n.classList?.contains(c))).map((n) => n.className);
  assert.deepEqual(order, ['memory-record-title', 'memory-record-excerpt', 'memory-id']);
  assert.equal(findAll(row, (n) => n.tagName === 'TD').length, 5, 'five cells, matching the five headers');
});

test('#1313 R1313-6: the title and excerpt elements carry a title attribute equal to their own text', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  const row = rowOf(dom, A);
  for (const cls of ['memory-record-title', 'memory-record-excerpt']) {
    const node = find(row, byClass(cls));
    assert.equal(node.getAttribute('title'), node.textContent, `${cls}: one wording for one fact`);
  }
});

test('#1313 R1313-3/5 S4/S5: a record with nothing to show says why in the title slot, with no excerpt, and keeps its id', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  const absent = rowOf(dom, B);
  const t1 = find(absent, byClass('memory-record-title'));
  assert.equal(t1.textContent, NO_TEXT);
  assert.equal(t1.getAttribute('title'), NO_TEXT);
  assert.equal(find(absent, byClass('memory-record-excerpt')), null);
  assert.ok(find(absent, byClass('memory-source')));
  const empty = rowOf(dom, C);
  assert.equal(find(empty, byClass('memory-record-title')).textContent, EMPTY_TEXT);
  assert.notEqual(NO_TEXT, EMPTY_TEXT);
  assert.doesNotMatch(dom.mounts.canvas.textContent, /unreadable/i);
});

test('#1313 S6: markup in a record is shown as characters, and no element is created from it', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  const excerpt = find(rowOf(dom, D), byClass('memory-record-excerpt'));
  assert.match(excerpt.textContent, /<script>alert\(1\)<\/script>/);
  assert.equal(findAll(dom.mounts.canvas, (n) => n.tagName === 'SCRIPT' || n.tagName === 'IMG').length, 0);
});

test('#1313 R1313-7: drawing the ledger fetches nothing and spawns no worker', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  assert.deepEqual(dom.recordFetches, []);
  assert.equal(dom.workers.length, 0);
  assert.equal(dataRows(dom).length, 4, 'one row per record, no detail row while closed');
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'false');
});

test('#1313 R1313-9/10 S9: a click opens the content in a row under the clicked one: loading first, then markdown made by the worker', async (t) => {
  let release;
  const held = new Promise((r) => { release = r; });
  const { dom } = await boot({ records: { [A]: () => held.then(() => ({ ok: true, id: A, file: 'f', content: FULL_A, truncated: false, truncatedAt: null })) } });
  t.after(() => dom.restore());
  const toggle = toggleOf(dom, A);
  fire(toggle, 'click');
  await settle();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const detail = detailAfter(rowOf(dom, A));
  assert.ok(detail, 'the detail row sits directly after the clicked row');
  assert.equal(toggle.getAttribute('aria-controls'), find(detail, byClass('doc-body')).getAttribute('id'));
  assert.match(detail.textContent, new RegExp(RECORD_LOADING));
  assert.equal(dom.workers.length, 0, 'nothing is rendered before the record has arrived');

  release();
  await settle(12);
  assert.doesNotMatch(detail.textContent, new RegExp(RECORD_LOADING));
  const md = find(detail, byClass('md'));
  assert.ok(md, 'the content is drawn as markdown');
  assert.ok(findAll(md, (n) => /^H[1-6]$/.test(n.tagName)).some((h) => h.textContent === 'What'), 'a heading is a heading element');
  assert.equal(findAll(md, (n) => n.tagName === 'LI').length, 2);
  assert.equal(findAll(md, (n) => n.tagName === 'CODE').some((c) => c.textContent === 'arm()'), true);
  assert.equal(dom.workers.length, 1, 'the markdown was made in a worker');
  assert.equal(dom.workers[0].url, '/lib/markdown-worker.mjs');
  assert.deepEqual(dom.recordFetches, [`/api/record/${A}`]);

  fire(toggle, 'click');
  await settle();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(detailAfter(rowOf(dom, A)), null, 'collapsing removes the content');
});

test('#1313 R1313-10 S11: hostile content creates no script element and no javascript: link', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await open(dom, D);
  await settle(8);
  const detail = detailAfter(rowOf(dom, D));
  assert.ok(find(detail, byClass('md')));
  assert.equal(findAll(dom.mounts.canvas, (n) => n.tagName === 'SCRIPT' || n.tagName === 'IMG').length, 0);
  assert.equal(findAll(detail, (n) => n.tagName === 'A' && /^\s*javascript:/i.test(n.getAttribute('href') ?? '')).length, 0);
  assert.match(detail.textContent, /<script>alert\(1\)<\/script>/, 'shown as characters');
});

test('#1313 R1313-11 S10: a route answer with ok:false shows its reason; absent and empty are never called unreadable', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await open(dom, B);
  await open(dom, C);
  assert.match(detailAfter(rowOf(dom, B)).textContent, new RegExp(NO_TEXT));
  assert.match(detailAfter(rowOf(dom, C)).textContent, new RegExp(EMPTY_TEXT));
  assert.doesNotMatch(dom.mounts.canvas.textContent, /unreadable/i);
  assert.equal(dom.workers.length, 0, 'a reason is not rendered');
});

test('#1313 R1313-11 S10: a non-OK status and a failed fetch say the record could not be loaded, with the detail', async (t) => {
  const { dom } = await boot({ records: { [A]: { status: 500, body: {} }, [D]: () => new Error('connection refused') } });
  t.after(() => dom.restore());
  await open(dom, A);
  assert.match(detailAfter(rowOf(dom, A)).textContent, new RegExp(recordFailure(A, 'answered 500').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await open(dom, D);
  assert.match(detailAfter(rowOf(dom, D)).textContent, new RegExp(recordFailure(D, 'connection refused')));
  assert.doesNotMatch(dom.mounts.canvas.textContent, /unreadable/i);
});

test('#1313 R1313-11: a failed record is fetched again after a collapse and a second click', async (t) => {
  const { dom } = await boot({ records: { [A]: { status: 500, body: {} } } });
  t.after(() => dom.restore());
  await open(dom, A);
  await open(dom, A);
  await open(dom, A);
  assert.equal(dom.recordFetches.length, 2, 'the explicit retry is collapse then expand');
});

test('#1313 R1313-10 S15: a cut record states where it was cut', async (t) => {
  const cut = { ok: true, id: A, file: 'f', content: FULL_A, truncated: true, truncatedAt: 262144 };
  const { dom } = await boot({ records: { [A]: cut } });
  t.after(() => dom.restore());
  await open(dom, A);
  await settle(8);
  assert.match(detailAfter(rowOf(dom, A)).textContent, new RegExp(recordTruncated(262144)));
});

test('#1313 R1313-10 S13: with no Worker the page says so and shows the content as plain text, never tokenizing it itself', async (t) => {
  const { dom } = await boot({ worker: null });
  t.after(() => dom.restore());
  await open(dom, A);
  await settle(8);
  const detail = detailAfter(rowOf(dom, A));
  assert.match(detail.textContent, new RegExp(UNAVAILABLE_NOTICE));
  assert.equal(find(detail, byClass('md')), null, 'no markdown was drawn');
  assert.equal(find(detail, byClass('md-plain')).textContent, FULL_A);
});

test('#1313 R1313-10: a worker that fails shows the shared notice and the plain text', async (t) => {
  const { dom } = await boot({ worker: 'error' });
  t.after(() => dom.restore());
  await open(dom, A);
  await settle(8);
  const detail = detailAfter(rowOf(dom, A));
  assert.match(detail.textContent, new RegExp(FAILED_NOTICE));
  assert.equal(find(detail, byClass('md-plain')).textContent, FULL_A);
});

test('#1313 R1313-9 S12: many rows may be open at once, and a stream frame that re-renders keeps them open with no new fetch', async (t) => {
  const { dom, snapshot } = await boot();
  t.after(() => dom.restore());
  await open(dom, A);
  await open(dom, D);
  await settle(8);
  assert.ok(detailAfter(rowOf(dom, A)) && detailAfter(rowOf(dom, D)), 'both are open');
  const fetched = dom.recordFetches.length;
  dom.emit('sync', { generatedAt: '2026-09-19T12:00:01.000Z', snapshot, meta: {} });
  await settle(8);
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'true');
  assert.ok(detailAfter(rowOf(dom, A)) && detailAfter(rowOf(dom, D)), 'both survive the re-render');
  assert.ok(find(detailAfter(rowOf(dom, A)), byClass('md')), 'the rendered content is back');
  assert.equal(dom.recordFetches.length, fetched, 'no new fetch');
  assert.equal(detailAfter(rowOf(dom, B)), null, 'a row nobody opened stays closed');
});

test('#1313 R1313-9: the toggle is a native button and the detail row spans the whole table', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  assert.equal(toggleOf(dom, A).tagName, 'BUTTON');
  await open(dom, A);
  const detail = detailAfter(rowOf(dom, A));
  const cells = findAll(detail, (n) => n.tagName === 'TD');
  assert.equal(cells.length, 1);
  assert.equal(cells[0].getAttribute('colspan'), '5');
});

test('#1313 R1313-9: a collapse evicts the record, so a reopen reads and renders it again and nothing accumulates', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await open(dom, A);
  await settle(8);
  await open(dom, A);
  await open(dom, A);
  await settle(8);
  assert.equal(dom.recordFetches.length, 2);
  assert.equal(dom.workers.length, 2);
  assert.ok(find(detailAfter(rowOf(dom, A)), byClass('md')));
});
