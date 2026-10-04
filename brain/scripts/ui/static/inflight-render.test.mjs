// inflight-render.test.mjs — #1284 R1284-3, R1284-5..9: the REAL app.js on the fake DOM draws the
// in-flight section above the lanes, from whatever sections have arrived, as text only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const XSS_AUTHOR = '<img src=x onerror=alert(1)>';
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [
  { number: 1198, title: 'feat(ui): every SDD artifact is readable', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1199, title: 'feat(ui): a second ticket', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
];

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ok = (value) => ({ ok: true, value });
const pendingSection = (reason = 'loading from the forge…') => ({ ok: false, pending: true, reason });
const hierarchy = (states) => ok({ issues: Object.entries(states).map(([n, state]) => [Number(n), { state, children: [] }]), divergences: [], closedUnresolved: [], closedRead: { ok: true } });
const wt = (issue, over = {}) => ({ path: `/srv/wt-${issue}`, leaf: `wt-${issue}`, branch: `feat/issue-${issue}-x`, head: 'd'.repeat(40), issue, dir: null, dirState: 'present', reason: null, touchedAt: ago(HOUR), headCommitAt: null, fingerprint: 'f', capped: false, ...over });
const worktrees = (...entries) => ok({ entries, hidden: {}, tier: 'working-tree' });
const branch = (issue, over = {}) => ({ kind: 'grammar', issue, branch: `feat/issue-${issue}-r`, sha: 'e'.repeat(40), tipAt: ago(2 * HOUR), author: 'ana', pr: null, change: { ok: false, reason: 'x' }, resume: null, ...over });
const remote = (...branches) => ok({ base: 'origin/main', branches, unjoined: [], hidden: {}, prsApplied: true, deferred: 0 });

async function boot(sections = {}) {
  const root = testTmp('inflight-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  Object.assign(snapshot, { changes: ok([]), localWorktrees: worktrees(), remoteChanges: remote(), prs: ok([]), hierarchy: hierarchy({}) }, sections);
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  const fetched = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetched.push(String(url)); return inner(url, init); };
  await loadApp();
  await settle();
  return Object.assign(dom, { fetched });
}

const section = (dom) => find(dom.mounts.canvas, byClass('inflight'));
const rowOf = (dom, issue) => findAll(dom.mounts.canvas, byClass('inflight-row')).filter((r) => r.getAttribute('data-issue') === String(issue));
const text = (dom) => section(dom).textContent;
const frame = (name, sectionBody) => ({ name, section: sectionBody, generatedAt: '2026-10-01T12:00:05.000Z', cause: 'test' });

test('R1284-9: the section is the first child of the canvas, before the first lane, and the ? holding lane follows it', async (t) => {
  const dom = await boot({ localWorktrees: worktrees(wt(1198)), hierarchy: hierarchy({ 1198: 'open', 1199: 'open' }) });
  t.after(() => dom.restore());
  const kids = Array.from(dom.mounts.canvas.childNodes);
  assert.equal(kids[0], section(dom), 'the section is the first element of the canvas');
  const holding = kids.findIndex((n) => n.classList && n.classList.contains('batch'));
  assert.ok(holding > 0, 'the ? holding lane is drawn after the section');
  const lane = kids.findIndex((n) => n.classList && n.classList.contains('lane-row'));
  assert.ok(lane === -1 || lane > 0, 'no lane precedes the section');
  assert.equal(rowOf(dom, 1198).length, 1);
});

test('R1284-8: with hierarchy, remoteChanges and prs pending the section is present, names the three, and draws no unfiltered row', async (t) => {
  const dom = await boot({
    localWorktrees: worktrees(wt(1198)), changes: ok([]),
    hierarchy: pendingSection(), remoteChanges: pendingSection(), prs: pendingSection(),
  });
  t.after(() => dom.restore());
  const said = text(dom);
  assert.match(said, /hierarchy: still loading/);
  assert.match(said, /remoteChanges: still loading/);
  assert.match(said, /prs: still loading/);
  assert.match(said, /1 candidate issue\(s\); their open\/closed state is not read yet/);
  assert.equal(rowOf(dom, 1198).length, 0);
  assert.doesNotMatch(said, /nothing in flight|no open issue is in flight/);
});

test('R1284-6: a pending forge source is named beside the rows the ready sources give; failed is worded apart with its reason', async (t) => {
  const dom = await boot({
    localWorktrees: worktrees(wt(1198)), hierarchy: hierarchy({ 1198: 'open' }),
    remoteChanges: pendingSection(), prs: { ok: false, reason: 'rate limited' },
  });
  t.after(() => dom.restore());
  assert.equal(rowOf(dom, 1198).length, 1);
  assert.match(text(dom), /remoteChanges: still loading/);
  assert.match(text(dom), /prs: could not be read — rate limited/);
  assert.doesNotMatch(text(dom), /nothing in flight|no open issue is in flight/);
  assert.doesNotMatch(text(dom), /prs: still loading/, 'failed is not worded as pending');
});

test('R1284-8: a late hierarchy frame removes the closed row and stops naming hierarchy', async (t) => {
  const dom = await boot({ localWorktrees: worktrees(wt(1198), wt(1199)), hierarchy: pendingSection() });
  t.after(() => dom.restore());
  assert.match(text(dom), /hierarchy: still loading/);
  dom.emit('section', frame('hierarchy', hierarchy({ 1198: 'open', 1199: 'closed' })));
  await settle();
  assert.equal(rowOf(dom, 1198).length, 1);
  assert.equal(rowOf(dom, 1199).length, 0, 'a closed issue is no row');
  assert.doesNotMatch(text(dom), /hierarchy/);
});

test('R1284-7: complete and empty says so; the same text never appears with a missing source', async (t) => {
  const dom = await boot({ hierarchy: hierarchy({ 1198: 'closed' }), localWorktrees: worktrees(wt(1198)) });
  t.after(() => dom.restore());
  assert.match(text(dom), /no open issue is in flight/);
  assert.doesNotMatch(text(dom), /still loading|could not be read/);
  dom.emit('section', frame('prs', pendingSection()));
  await settle();
  assert.doesNotMatch(text(dom), /no open issue is in flight/);
  assert.match(text(dom), /prs: still loading/);
});

test('R1284-3: a null-state issue is a row marked "state unknown"; an unknown activity says "activity unknown"', async (t) => {
  const dom = await boot({
    localWorktrees: worktrees(wt(1198, { touchedAt: null, dirState: 'missing' })),
    hierarchy: ok({ issues: [[1198, { state: null, children: [] }]], divergences: [], closedUnresolved: [], closedRead: { ok: true } }),
  });
  t.after(() => dom.restore());
  const row = rowOf(dom, 1198)[0];
  assert.match(row.textContent, /state unknown/);
  assert.match(row.textContent, /activity unknown/);
  assert.match(row.textContent, /1 worktree on this machine/);
  assert.equal(find(dom.mounts.canvas, byClass('inflight-stale-toggle')), null, 'activity unknown is never in the stale group');
});

test('R1284-5: old rows sit in a collapsed group headed "stale (N)" and show on expanding', async (t) => {
  const dom = await boot({
    localWorktrees: worktrees(wt(1198, { touchedAt: ago(HOUR) }), wt(1199, { touchedAt: ago(30 * DAY) })),
    remoteChanges: remote(branch(900, { tipAt: ago(8 * DAY) })),
    hierarchy: hierarchy({ 1198: 'open', 1199: 'open', 900: 'open' }),
  });
  t.after(() => dom.restore());
  const toggle = find(dom.mounts.canvas, byClass('inflight-stale-toggle'));
  assert.equal(toggle.textContent, 'stale (2)');
  assert.equal(rowOf(dom, 1198).length, 1);
  assert.equal(rowOf(dom, 1199).length, 0, 'collapsed by default');
  fire(toggle, 'click');
  await settle();
  assert.equal(rowOf(dom, 1199).length, 1);
  assert.equal(rowOf(dom, 900).length, 1);
  assert.equal(find(dom.mounts.canvas, byClass('inflight-stale-toggle')).textContent, 'stale (2)');
});

test('R1284-9: clicking a row opens the same drawer as the card', async (t) => {
  const dom = await boot({ localWorktrees: worktrees(wt(1198)), hierarchy: hierarchy({ 1198: 'open' }) });
  t.after(() => dom.restore());
  fire(rowOf(dom, 1198)[0], 'click');
  await settle();
  assert.ok(dom.fetched.includes('/api/change/1198'), 'the drawer reads the change, as the card click does');
});

test('R1284-9: a hostile author name is text — the literal is in textContent and no img exists', async (t) => {
  const dom = await boot({ remoteChanges: remote(branch(1198, { author: XSS_AUTHOR })), hierarchy: hierarchy({ 1198: 'open' }) });
  t.after(() => dom.restore());
  assert.ok(rowOf(dom, 1198)[0].textContent.includes(XSS_AUTHOR));
  assert.equal(Array.from(findAll(section(dom), (n) => n.tagName === 'IMG')).length, 0);
});

test('R1284-14: the row shows a declared kind and tasks progress, and nothing for a default level or a branch-only row', async (t) => {
  const hier = ok({ issues: [
    [1198, { state: 'open', children: [], level: 'epic', levelSource: 'block' }],
    [1199, { state: 'open', children: [], level: 'ticket', levelSource: 'default' }],
  ], divergences: [], closedUnresolved: [], closedRead: { ok: true } });
  const dom = await boot({
    hierarchy: hier,
    changes: ok([{ issue: 1198, archived: false, id: 'issue-1198-x', lastCommit: { ok: false, reason: 'x' }, progress: { ok: true, value: { done: 3, total: 5 } } }]),
    remoteChanges: remote(branch(1199)),
  });
  t.after(() => dom.restore());
  const [a] = rowOf(dom, 1198);
  const [b] = rowOf(dom, 1199);
  assert.match(a.textContent, /epic/);
  assert.match(a.textContent, /tasks 3 \/ 5 · working tree/);
  const facts = find(b, byClass('inflight-facts')).textContent;
  assert.doesNotMatch(facts, /ticket/);
  assert.doesNotMatch(b.textContent, /tasks/);
});
