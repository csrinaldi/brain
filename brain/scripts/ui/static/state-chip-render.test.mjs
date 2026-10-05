// state-chip-render.test.mjs — #1308 R1308-1, 2, 5, 6, 7, 10: the REAL app.js on the fake DOM draws a
// lifecycle chip and, separately, a track chip; an issue missing its brain-graph/1 configuration is a warning
// chip with a paste block in its drawer; the legend has a state group and a track group.

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
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [
  { number: 1198, title: 'declared with a worktree', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1199, title: 'declared, no work', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1263, title: 'undeclared with a worktree', labels: ['status:approved'], body: 'No block here.\n\nParent: #878\n' },
  { number: 1300, title: 'undeclared, no work', labels: ['status:approved'], body: 'No block here either.\n' },
];

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ok = (value) => ({ ok: true, value });
const pendingSection = (reason = 'loading from the forge…') => ({ ok: false, pending: true, reason });
const hierarchy = (states) => ok({ issues: Object.entries(states).map(([n, state]) => [Number(n), { state, children: [] }]), divergences: [], closedUnresolved: [], closedRead: { ok: true } });
const wt = (issue, over = {}) => ({ path: `/srv/wt-${issue}`, leaf: `wt-${issue}`, branch: `feat/issue-${issue}-x`, head: 'd'.repeat(40), issue, dir: null, dirState: 'present', reason: null, touchedAt: ago(HOUR), headCommitAt: null, fingerprint: 'f', capped: false, ...over });
const worktrees = (...entries) => ok({ entries, hidden: {}, tier: 'working-tree' });
const frame = (name, sectionBody) => ({ name, section: sectionBody, generatedAt: '2026-10-01T12:00:05.000Z', cause: 'test' });

async function boot(sections = {}) {
  const root = testTmp('state-chip-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, state: 'open', assignees: [] })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  Object.assign(snapshot, {
    changes: ok([]), localWorktrees: worktrees(wt(1198), wt(1263)), remoteChanges: ok({ base: 'origin/main', branches: [], unjoined: [], hidden: {}, prsApplied: true, deferred: 0 }),
    prs: ok([]), hierarchy: hierarchy({ 1198: 'open', 1199: 'open', 1263: 'open', 1300: 'open' }),
  }, sections);
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  return dom;
}

const card = (dom, issue) => find(dom.mounts.canvas, (n) => n.classList && (n.classList.contains('node-card') || n.classList.contains('batch-tile')) && n.getAttribute('data-issue') === String(issue));
const stateChip = (root) => find(root, byClass('node-state'));
const trackChip = (root) => find(root, byClass('track-chip'));
const expandHolding = async (dom) => {
  const toggle = find(dom.mounts.canvas, (n) => n.classList && n.classList.contains('lane-toggle') && n.textContent === 'show');
  if (toggle) { fire(toggle, 'click'); await settle(); }
};

test('R1308-1/S1/S4: a declared card has a lifecycle chip and, separately, a track chip', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const a = card(dom, 1198);
  assert.equal(stateChip(a).textContent, '◐In flight');
  assert.equal(trackChip(a).textContent, 'Track UI');
  assert.doesNotMatch(stateChip(a).textContent, /Track/, 'the state chip never carries track information');
  const b = card(dom, 1199);
  assert.equal(stateChip(b).textContent, '○Planned');
  assert.doesNotMatch(trackChip(b).textContent, /Planned|In flight/, 'the track chip never carries lifecycle');
});

test('R1308-2/R1308-3/S2: an undeclared issue with a worktree is In flight and carries the warning chip (the #1263 shape)', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  await expandHolding(dom);
  const c = card(dom, 1263);
  assert.ok(c, 'the undeclared card is drawn in the holding lane');
  assert.equal(stateChip(c).textContent, '◐In flight');
  const warn = trackChip(c);
  assert.ok(warn.classList.contains('track-undeclared'));
  assert.match(warn.textContent, /Configuration missing/);
  assert.match(warn.textContent, /⚠/);
  assert.equal(stateChip(card(dom, 1300)).textContent, '○Planned', 'S3: no work, every source ready');
});

test('R1308-5/S5: while prs is pending a node with no evidence is Not computed, then Planned when it arrives', async (t) => {
  const dom = await boot({ prs: pendingSection() });
  t.after(() => dom.restore());
  assert.equal(stateChip(card(dom, 1199)).textContent, '—Not computed');
  assert.equal(stateChip(card(dom, 1198)).textContent, '◐In flight', 'S6: a local worktree is enough while prs is pending');
  dom.emit('section', frame('prs', ok([])));
  await settle();
  assert.equal(stateChip(card(dom, 1199)).textContent, '○Planned');
});

test('R1308-7/S9: the legend has a state group and a track group, and Configuration missing is only in the track group', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const groups = findAll(dom.mounts.canvas, byClass('legend-group'));
  assert.equal(groups.length, 2);
  const [states, tracks] = groups;
  assert.match(states.textContent, /Planned/);
  assert.match(states.textContent, /In flight/);
  assert.doesNotMatch(states.textContent, /Configuration missing|Undeclared/);
  assert.match(tracks.textContent, /Configuration missing/);
  assert.match(tracks.textContent, /No track/);
});

test('R1308-1/R1308-10/S13: the drawer head shows both chips; an undeclared issue shows the paste block and no command', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  await expandHolding(dom);
  fire(card(dom, 1263), 'click');
  await settle();
  const head = find(dom.mounts.drawer, byClass('drawer-head'));
  assert.equal(stateChip(head).textContent, '◐In flight');
  assert.match(trackChip(head).textContent, /Configuration missing/);
  const block = find(dom.mounts.drawer, byClass('declare-block'));
  assert.ok(block, 'the paste block is in the drawer');
  assert.match(block.textContent, /```brain-graph\/1/);
  assert.match(block.textContent, /parent: 878/);
  assert.match(block.textContent, /keep the lines that are true/);
  assert.doesNotMatch(dom.mounts.drawer.textContent, /brain:ticket:declare/, 'a command that does not exist is never shown');
  fire(find(dom.mounts.drawer, byClass('close')), 'click');
  await settle();
  fire(card(dom, 1198), 'click');
  await settle();
  assert.equal(find(dom.mounts.drawer, byClass('declare-block')), null, 'a declared node shows no paste block');
  assert.equal(trackChip(find(dom.mounts.drawer, byClass('drawer-head'))).textContent, 'Track UI');
});
