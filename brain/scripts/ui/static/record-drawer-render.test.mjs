// record-drawer-render.test.mjs — the drawer's Records tab shows what each record says
// and a click opens its full content inline (#1373), and the two surfaces that open
// records (this tab and the Memory ledger) share one bounded read cache (#1377, D173).
// The REAL app.js on the fake DOM over a snapshot built from real record files and a
// change view built by the production route, so every assertion is on what the page drew.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { buildChangeView } from '../change-route.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { NO_TEXT, EMPTY_TEXT } from '../../memory/lib/record-summary.mjs';
import { RECORD_LOADING, SUMMARY_MISSING, recordFailure, recordTruncated, MEMORY_RECENT_CAP } from '../lib/memory-model.mjs';
import { MODES } from '../lib/view-model.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';
import { fakeGit } from '../test-support/fake-git.mjs';

const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const ISSUE = 1059;

const A = 'rec-aaaaaaaaaaaaaaaa'; // issue 1059, the oldest ledger-visible row
const B = 'rec-bbbbbbbbbbbbbbbb'; // issue 1059, table-led content
const C = 'rec-cccccccccccccccc'; // issue 1059, no content field
const D = 'rec-dddddddddddddddd'; // issue 1059, empty content
const OTHER = 'rec-eeeeeeeeeeeeeeee'; // another issue

const FULL_A = '**Poller holds one timer**\n\n## What\n\n- arm() and disarm() keep one handle\n\nplain tail';
const TABLE_B = '| Field | Value |\n|---|---|\n| Estimated change | 12 |';

const fence = (lines) => ['```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [
  { number: 878, title: 'epic(ui): the project state', labels: ['type:feature'], body: fence(['kind:     epic', 'track:    UI', 'tracker:  feature/brain-ui', 'blocks:   []', 'needs:    []']) },
  { number: ISSUE, title: 'feat(ui): the page is built from the design', labels: ['status:approved'], body: fence(['track:    UI', 'parent:   878', 'blocks:   []', 'needs:    []']) },
];
const VCS = {
  async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
  async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
};

const recordsDir = (root) => join(root, '.memory', 'records');
function put(root, id, ts, extra) {
  writeFileSync(join(recordsDir(root), `${ts.slice(0, 7)}-${id}.jsonl`),
    `${JSON.stringify({ id, ts, actor: 'feat/x', actorKind: 'agent', type: 'architecture', project: 'brain', ...extra })}\n`);
}

function fixtureRoot({ fillers = 0 } = {}) {
  const root = testTmp('record-drawer-');
  mkdirSync(recordsDir(root), { recursive: true });
  put(root, A, '2026-09-18T22:10:52Z', { issue: ISSUE, content: FULL_A });
  put(root, B, '2026-09-17T09:00:00Z', { issue: ISSUE, content: TABLE_B });
  put(root, C, '2026-09-16T09:00:00Z', { issue: ISSUE });
  put(root, D, '2026-09-15T09:00:00Z', { issue: ISSUE, content: '   ' });
  put(root, OTHER, '2026-09-14T09:00:00Z', { issue: 7, content: '**Not this issue**' });
  // Newer than A: `fillers` of them put A at rank fillers + 1 of the ledger.
  for (let i = 0; i < fillers; i += 1) put(root, `rec-f${String(i).padStart(15, '0')}`, `2026-09-19T10:${String(i).padStart(2, '0')}:00Z`, { content: `**Filler ${i}**` });
  return root;
}
const snapshotOf = (root) => buildSnapshot({ root, project: 'csrinaldi/brain', vcs: VCS, now: '2026-09-20T12:00:00.000Z', _run: () => { throw new Error('no git'); } });

const ANSWERS = () => ({
  [A]: { ok: true, id: A, file: `.memory/records/2026-09-${A}.jsonl`, content: FULL_A, truncated: false, truncatedAt: null },
  [B]: { ok: true, id: B, file: `.memory/records/2026-09-${B}.jsonl`, content: TABLE_B, truncated: false, truncatedAt: null },
  [C]: { ok: false, reason: NO_TEXT },
  [D]: { ok: false, reason: EMPTY_TEXT },
});

async function boot({ fillers = 0, records = ANSWERS(), worker } = {}) {
  const root = fixtureRoot({ fillers });
  const snapshot = await snapshotOf(root);
  const change = buildChangeView({ root, issue: ISSUE, snapshot, _run: fakeGit({ files: {}, head: 'abc1234'.padEnd(40, '0') }) });
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes: { [ISSUE]: change }, records, ...(worker === undefined ? {} : { worker }) });
  await loadApp();
  await settle();
  return { dom, snapshot, root };
}

const cardFor = (dom) => findAll(dom.mounts.canvas, byClass('node-card')).find((c) => c.getAttribute('data-issue') === String(ISSUE));
async function openRecordsTab(dom) {
  fire(cardFor(dom), 'click');
  await settle();
  const tabs = find(dom.mounts.drawer, byClass('tabs'));
  fire(Array.from(tabs.childNodes).find((b) => b.textContent.startsWith('Records')), 'click');
  await settle();
}
async function openMemoryView(dom) {
  const label = MODES.find((m) => m.id === 'memory').label;
  fire(find(dom.mounts.modes, (n) => n.tagName === 'BUTTON' && n.textContent.includes(label)), 'click');
  await settle();
}

const drawerCards = (dom) => findAll(find(dom.mounts.drawer, byClass('tab-panel')), byClass('card')).filter((c) => find(c, byClass('memory-id')));
const cardOf = (dom, id) => drawerCards(dom).find((c) => find(c, byClass('memory-id')).textContent === id);
const toggleOf = (dom, id) => find(cardOf(dom, id), byClass('memory-toggle'));
const bodyOf = (dom, id) => find(cardOf(dom, id), byClass('doc-body'));
const openIn = async (dom, id) => { fire(toggleOf(dom, id), 'click'); await settle(8); };

test('#1373 R1373-1: each row of the Records tab reads title, excerpt and id; text and title attributes agree', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  assert.deepEqual(drawerCards(dom).map((c) => find(c, byClass('memory-id')).textContent), [A, B, C, D], 'this issue\'s records only, newest first');
  const a = cardOf(dom, A);
  const title = find(a, byClass('memory-record-title'));
  const excerpt = find(a, byClass('memory-record-excerpt'));
  assert.equal(title.textContent, 'Poller holds one timer');
  assert.equal(excerpt.textContent, 'What arm() and disarm() keep one handle plain tail');
  assert.equal(title.getAttribute('title'), title.textContent);
  assert.equal(excerpt.getAttribute('title'), excerpt.textContent);
  assert.match(a.textContent, /feat\/x \(agent\)/, 'who wrote it is still said');
  assert.match(a.textContent, /\.memory\/records\//, 'and the source stamp');
  assert.deepEqual(dom.recordFetches, [], 'drawing the tab reads no record');
  assert.equal(dom.workers.length, 0);
});

test('#1373 R1373-1: the excerpt is the ledger\'s derivation, so a table-led record shows no pipe', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  const b = cardOf(dom, B);
  assert.equal(find(b, byClass('memory-record-title')).textContent, 'Field · Value');
  assert.equal(find(b, byClass('memory-record-excerpt')).textContent, 'Estimated change · 12');
  assert.equal(b.textContent.includes('|'), false);
});

test('#1373 R1373-1: a record with nothing to show says why in the title slot, with the ledger\'s wording and no excerpt', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  const absent = find(cardOf(dom, C), byClass('memory-record-title'));
  assert.equal(absent.textContent, NO_TEXT);
  assert.equal(absent.getAttribute('title'), NO_TEXT);
  assert.equal(find(cardOf(dom, C), byClass('memory-record-excerpt')), null);
  assert.equal(find(cardOf(dom, D), byClass('memory-record-title')).textContent, EMPTY_TEXT);
  assert.doesNotMatch(dom.mounts.drawer.textContent, /unreadable/i);
  assert.notEqual(SUMMARY_MISSING, NO_TEXT);
});

test('#1373 R1373-2/3: a click opens the content under the row: loading, then markdown from the worker; a second click closes it', async (t) => {
  let release;
  const held = new Promise((r) => { release = r; });
  const { dom } = await boot({ records: { [A]: () => held.then(() => ANSWERS()[A]) } });
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  const toggle = toggleOf(dom, A);
  fire(toggle, 'click');
  await settle();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const section = bodyOf(dom, A);
  assert.ok(section, 'the body sits inside the clicked row\'s card');
  assert.equal(toggle.getAttribute('aria-controls'), section.getAttribute('id'));
  assert.match(section.textContent, new RegExp(RECORD_LOADING));
  assert.equal(dom.workers.length, 0);
  release();
  await settle(12);
  assert.doesNotMatch(section.textContent, new RegExp(RECORD_LOADING));
  const md = find(section, byClass('md'));
  assert.ok(md, 'drawn as markdown');
  assert.ok(findAll(md, (n) => /^H[1-6]$/.test(n.tagName)).some((h) => h.textContent === 'What'));
  assert.equal(dom.workers[0].url, '/lib/markdown-worker.mjs');
  assert.deepEqual(dom.recordFetches, [`/api/record/${A}`]);
  fire(toggle, 'click');
  await settle();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(bodyOf(dom, A), null);
});

test('#1373 R1373-3: the ledger\'s pending, failure, reason and truncation wording appears in the drawer', async (t) => {
  const cut = { ...ANSWERS()[A], truncated: true, truncatedAt: 262144 };
  const { dom } = await boot({ records: { ...ANSWERS(), [A]: cut, [B]: { status: 500, body: {} } } });
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  await openIn(dom, A);
  assert.match(bodyOf(dom, A).textContent, new RegExp(recordTruncated(262144)));
  await openIn(dom, B);
  assert.ok(bodyOf(dom, B).textContent.includes(recordFailure(B, 'answered 500')));
  await openIn(dom, C);
  assert.ok(bodyOf(dom, C).textContent.includes(NO_TEXT));
  assert.doesNotMatch(dom.mounts.drawer.textContent, /unreadable/i);
});

test('#1373 R1373-2: an open row survives a re-render of the drawer with no new fetch', async (t) => {
  const { dom, snapshot } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  await openIn(dom, A);
  const fetched = dom.recordFetches.length;
  dom.emit('sync', { generatedAt: '2026-09-20T12:00:01.000Z', snapshot, meta: {} });
  await settle(8);
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'true');
  assert.ok(find(bodyOf(dom, A), byClass('md')), 'the rendered content is back');
  assert.equal(dom.recordFetches.length, fetched);
});

// ── #1377: what is held is bounded by what is open AND can still be shown ──

const ledgerRows = (dom) => findAll(dom.mounts.canvas, (n) => n.tagName === 'TR').slice(1).filter((tr) => !tr.classList.contains('memory-detail'));
const ledgerRow = (dom, id) => ledgerRows(dom).find((tr) => find(tr, byClass('memory-id'))?.textContent === id);
const ledgerToggle = (dom, id) => find(ledgerRow(dom, id), byClass('memory-toggle'));

async function pushOut(dom, root, n) {
  for (let i = 0; i < n; i += 1) put(root, `rec-n${String(i).padStart(15, '0')}`, `2026-09-19T11:${String(i).padStart(2, '0')}:00Z`, { content: `**Newer ${i}**` });
  const newer = await snapshotOf(root);
  dom.emit('sync', { generatedAt: '2026-09-20T12:00:02.000Z', snapshot: newer, meta: {} });
  await settle(8);
  return newer;
}

test('#1377 R1377-2: an opened ledger row pushed out of the window is evicted: it comes back closed and is read again', async (t) => {
  const { dom, root, snapshot } = await boot({ fillers: MEMORY_RECENT_CAP - 1 });
  t.after(() => dom.restore());
  await openMemoryView(dom);
  assert.ok(ledgerRow(dom, A), 'A is the last row of the window');
  fire(ledgerToggle(dom, A), 'click');
  await settle(8);
  assert.equal(dom.recordFetches.length, 1);

  await pushOut(dom, root, 2);
  assert.equal(ledgerRow(dom, A), undefined, 'A left the window');

  dom.emit('sync', { generatedAt: '2026-09-20T12:00:03.000Z', snapshot, meta: {} });
  await settle(8);
  assert.ok(ledgerRow(dom, A), 'A is back in the window');
  assert.equal(ledgerToggle(dom, A).getAttribute('aria-expanded'), 'false', 'what left the window is no longer held open');
  fire(ledgerToggle(dom, A), 'click');
  await settle(8);
  assert.equal(dom.recordFetches.length, 2, 'its read was evicted too');
});

test('#1377 R1377-2: a row still inside the window stays open across a re-render', async (t) => {
  const { dom, root } = await boot({ fillers: 10 });
  t.after(() => dom.restore());
  await openMemoryView(dom);
  fire(ledgerToggle(dom, A), 'click');
  await settle(8);
  await pushOut(dom, root, 2);
  assert.equal(ledgerToggle(dom, A).getAttribute('aria-expanded'), 'true');
  assert.equal(dom.recordFetches.length, 1);
});

test('#1377 R1373-4: an id open in the drawer is not evicted because it left the ledger window', async (t) => {
  const { dom, root } = await boot({ fillers: MEMORY_RECENT_CAP - 1 });
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  await openIn(dom, A);
  await openMemoryView(dom);
  fire(ledgerToggle(dom, A), 'click'); // the same id, open on both surfaces
  await settle(8);
  assert.equal(dom.recordFetches.length, 1, 'one read feeds both surfaces');

  await pushOut(dom, root, 2);
  assert.equal(ledgerRow(dom, A), undefined, 'A left the ledger window');
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'true', 'the drawer still has it open');
  assert.ok(find(bodyOf(dom, A), byClass('md')), 'and still shows it');
  assert.equal(dom.recordFetches.length, 1, 'with no new read');
});

test('#1377 R1373-4: a collapse on one surface keeps the read the other surface still shows', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  await openIn(dom, A);
  await openMemoryView(dom);
  fire(ledgerToggle(dom, A), 'click');
  await settle(8);
  fire(ledgerToggle(dom, A), 'click'); // collapse in the ledger
  await settle(8);
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'true');
  assert.ok(find(bodyOf(dom, A), byClass('md')));
  assert.equal(dom.recordFetches.length, 1, 'the drawer\'s read was not thrown away');
});

test('#1377 R1373-4: closing the drawer releases what it held', async (t) => {
  const { dom } = await boot();
  t.after(() => dom.restore());
  await openRecordsTab(dom);
  await openIn(dom, A);
  fire(find(dom.mounts.drawer, byClass('close')), 'click');
  await settle();
  await openRecordsTab(dom);
  assert.equal(toggleOf(dom, A).getAttribute('aria-expanded'), 'false', 'a reopened drawer starts closed');
  await openIn(dom, A);
  assert.equal(dom.recordFetches.length, 2);
});
