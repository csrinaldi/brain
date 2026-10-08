// drawer-polish-render.test.mjs — #1314: the REAL app.js on the fake DOM draws the five polish items.
// R1314-1 a blocker once; R1314-2 the drawer header and measured tab counts; R1314-3 the quiet drift line;
// R1314-4 a superseded ADR; R1314-5 the summary that matches the clustering. Every assertion reads text or
// a title attribute the page draws, so a value the page does not show cannot pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { buildChangeView } from '../change-route.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';
import { fakeGit } from '../test-support/fake-git.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const fence = (lines) => ['```brain-graph/1', ...lines, '```', ''].join('\n');

const issuesWith = (epicNeeds) => [
  { number: 878, title: 'the epic', labels: [], body: fence(['kind: epic', 'track: UI', 'blocks: []', `needs: [${epicNeeds.join(', ')}]`]) },
  { number: 881, title: 'the blocker', labels: [], body: fence(['track: UI', 'parent: 878', 'blocks: []', 'needs: []']) },
  { number: 882, title: 'the blocked slice', labels: [], body: fence(['track: UI', 'parent: 878', 'blocks: []', 'needs: [881]']) },
  { number: 907, title: 'declares nothing', labels: [], body: 'no block\n' },
];

const ADR = (number, status, extra = {}) => ({ ok: true, path: `brain/project/decisions/adr-${String(number).padStart(4, '0')}-x.md`, number, title: `ADR ${number}`, status, statusLine: `${status} (the file's own line)`, date: null, amendments: [], supersedes: [], supersededBy: null, issues: [], ...extra });

async function boot({ drift = { ok: true, value: { homeOnly: [], filesOnly: [], unreadable: [] } }, specPad = 0, epicNeeds = [] } = {}) {
  const ISSUES = issuesWith(epicNeeds);
  const root = testTmp('drawer-polish-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const changeDir = 'openspec/changes/issue-882-slice';
  mkdirSync(join(root, changeDir), { recursive: true });
  const files = {
    [`${changeDir}/proposal.md`]: '# P\n',
    [`${changeDir}/spec.md`]: ['# Spec', '', '### R882-1: one', '#### Scenario: s', '- **WHEN** a', '- **THEN** b', '', '### R882-2: two', '#### Scenario: t', '- **WHEN** c', '- **THEN** d', '', 'x'.repeat(specPad)].join('\n'),
    [`${changeDir}/design.md`]: '# D\n',
    [`${changeDir}/tasks.md`]: '# T\n\n- [x] a\n- [x] b\n- [ ] c\n',
  };
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [], state: 'open' })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-07T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  snapshot.adrs = { ok: true, value: [ADR(6, 'Accepted', { supersededBy: 30 }), ADR(30, 'Accepted', { supersedes: [6] }), ADR(31, 'Accepted')] };
  snapshot.drift = drift;
  const changes = { 882: buildChangeView({ root, issue: 882, snapshot, _run: fakeGit({ files, head: 'abc1234'.padEnd(40, '0') }) }) };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes });
  await loadApp();
  await settle();
  return dom;
}

const button = (root, text) => find(root, (n) => n.tagName === 'BUTTON' && n.textContent.includes(text));
const card = (dom, issue) => findAll(dom.mounts.canvas, byClass('node-card')).find((c) => c.getAttribute('data-issue') === String(issue));
const occurrences = (text, needle) => text.split(needle).length - 1;

test('R1314-1: a blocked card and its drawer print the blocker once', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  assert.equal(occurrences(card(dom, 882).textContent, 'blocked by #881'), 1, 'the card names the blocker once');
  fire(card(dom, 882), 'click');
  await settle();
  assert.equal(occurrences(dom.mounts.drawer.textContent, 'blocked by #881'), 1, 'and so does the drawer');
});

test('R1314-2: the drawer head names the change dir and branch; tabs carry measured counts with titles', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  fire(card(dom, 882), 'click');
  await settle();
  const head = find(dom.mounts.drawer, byClass('drawer-head'));
  assert.equal(find(head, byClass('drawer-change')).textContent, 'change dir: openspec/changes/issue-882-slice · served HEAD');
  assert.equal(findAll(dom.mounts.drawer, (n) => n.tagName === 'P' && n.textContent === 'change dir: openspec/changes/issue-882-slice · served HEAD').length, 1, 'said once, in the head');

  const tabs = find(head, byClass('tabs'));
  const tasks = button(tabs, 'Tasks');
  assert.equal(tasks.textContent, 'Tasks 2/3');
  assert.equal(tasks.getAttribute('title'), '2 / 3 tasks done · at HEAD');
  assert.equal(button(tabs, 'Spec').textContent, 'Spec 2');
  assert.equal(button(tabs, 'Spec').getAttribute('title'), '2 requirement(s) read');
  assert.match(button(tabs, 'Working memory').textContent, /^Working memory( !)?$/, 'nothing countable, nothing shown');
});

test('R1314-3: "adr drift: none" is a quiet line, not the alert band; drift keeps the band', async (t) => {
  const quiet = await boot();
  t.after(() => quiet.restore());
  fire(button(quiet.mounts.modes, 'Governance'), 'click');
  await settle();
  fire(button(quiet.mounts['governance-nav'], 'Decisions'), 'click');
  await settle();
  assert.ok(find(quiet.mounts.canvas, byClass('decision-drift')) === null, 'no band when nothing drifts');
  assert.match(find(quiet.mounts.canvas, byClass('decision-drift-none')).textContent, /^adr drift: none/);
  quiet.restore();

  const drifting = await boot({ drift: { ok: true, value: { homeOnly: [{ number: 9, path: 'x.md' }], filesOnly: [], unreadable: [] } } });
  t.after(() => drifting.restore());
  fire(button(drifting.mounts.modes, 'Governance'), 'click');
  await settle();
  fire(button(drifting.mounts['governance-nav'], 'Decisions'), 'click');
  await settle();
  assert.match(find(drifting.mounts.canvas, byClass('decision-drift')).textContent, /adr drift — 1 disagreement/);
  assert.ok(find(drifting.mounts.canvas, byClass('decision-drift-none')) === null);
});

test('R1314-4: a superseded ADR reads Superseded (by ADR-NNNN) in its status column, once', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  fire(button(dom.mounts.modes, 'Governance'), 'click');
  await settle();
  fire(button(dom.mounts['governance-nav'], 'Decisions'), 'click');
  await settle();
  const rows = findAll(dom.mounts.canvas, byClass('decision-row'));
  const status = (n) => find(rows.find((r) => find(r, byClass('decision-number')).textContent === String(n).padStart(4, '0')), byClass('decision-status'));
  assert.equal(status(6).textContent, 'Superseded (by ADR-0030)');
  assert.match(status(6).className, /status-superseded/);
  assert.equal(status(6).getAttribute('title'), "Accepted (the file's own line)", 'the file\'s own status line is the title');
  assert.equal(status(30).textContent, 'Accepted');
  assert.equal(occurrences(rows.map((r) => r.textContent).join('|'), 'ADR-0030'), 1, 'the supersession is worded once, in the status column');
  assert.ok(find(dom.mounts.canvas, byClass('decision-superseded-by')) === null, 'the file column no longer repeats it');
});

test('R1314-5: epic clustering prints the epic summary, never the track-lane line; track clustering keeps it', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const summaries = () => findAll(dom.mounts.canvas, byClass('canvas-summary')).map((n) => n.textContent);
  assert.ok(summaries().some((s) => /track lane\(s\), \d+ in the `\?` holding lane/.test(s)), 'track clustering keeps its line');
  fire(button(dom.mounts.canvas, 'epic clusters'), 'click');
  await settle();
  const epic = summaries();
  assert.equal(epic.filter((s) => /^1 declared epic\(s\)/.test(s)).length, 1, 'one epic summary');
  assert.ok(!epic.some((s) => /^\d+ track lane\(s\), /.test(s)), 'the track-lane line is gone');
  assert.match(epic.find((s) => /declared epic/.test(s)), /1 declared epic\(s\), 0 track lane\(s\) of nodes no epic claimed, 1 in the `\?` holding lane/);
});

test('R1314-2: a truncated spec.md prints no count, because the cards cover only the read part', async (t) => {
  const dom = await boot({ specPad: 300000 });
  t.after(() => dom.restore());
  fire(card(dom, 882), 'click');
  await settle();
  const tabs = find(find(dom.mounts.drawer, byClass('drawer-head')), byClass('tabs'));
  assert.equal(button(tabs, 'Spec').textContent, 'Spec', 'no total was measured, so no number');
  assert.equal(button(tabs, 'Spec').getAttribute('title') ?? '', '', 'and no title claims one');
  fire(button(tabs, 'Spec'), 'click');
  await settle();
  assert.match(dom.mounts.drawer.textContent, /truncated at 262144 bytes; cards cover the read part/, 'the tab still says it is cut');
});

test('R1314-1: a blocked epic names its blocker once, on its cluster head', async (t) => {
  const dom = await boot({ epicNeeds: [907] });
  t.after(() => dom.restore());
  fire(button(dom.mounts.canvas, 'epic clusters'), 'click');
  await settle();
  const cluster = find(dom.mounts.canvas, byClass('epic-cluster'));
  assert.equal(occurrences(cluster.textContent, 'blocked by #907'), 1, 'the cluster names the epic\'s blocker exactly once');
  assert.equal(find(cluster, byClass('node-blocked')).textContent, 'blocked by #907', 'in the line a card uses');
});
