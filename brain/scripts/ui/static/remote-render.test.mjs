// remote-render.test.mjs — #1201: the REAL app.js on the fake DOM draws a
// teammate's branches. What is asserted is what the page built: elements, text
// and attributes, never the model that fed it.

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
const DIR = 'openspec/changes/issue-1198-reader';
const HEAD = 'abc1234'.padEnd(40, '0');
const TIP = 'def5678'.padEnd(40, '0');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const XSS_AUTHOR = '<img src=x onerror=alert(1)>';
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [
  { number: 1198, title: 'feat(ui): every SDD artifact is readable', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1199, title: 'feat(ui): a second ticket', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
];

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const entry = (over) => ({
  branch: 'feat/issue-1198-x', sha: TIP, tipAt: ago(2 * HOUR), author: 'Ada Lovelace', kind: 'grammar', issue: 1198, pr: null,
  change: { ok: true, value: { dir: DIR, artefacts: {} } }, resume: { state: 'present', path: `${DIR}/resume.md`, reason: null, fields: {} },
  ...over,
});
const unjoined = (branch, msAgo) => ({
  branch, sha: 'c'.repeat(40), tipAt: ago(msAgo), author: 'Linus T', kind: 'unjoined', issue: null, pr: null,
  change: { ok: false, reason: 'outside the branch grammar: no issue to look a change dir up by' }, resume: null,
});
const sectionOf = (branches, unjoinedList = [], deferred = 0) => ({
  ok: true, value: { base: 'origin/main', branches, unjoined: unjoinedList, hidden: { base: 2, lane: 1, merged: 1 }, prsApplied: true, deferred },
});

async function boot({ branches, unjoinedList = [], meta = null, deferred = 0, remotesRefresh } = {}) {
  const root = testTmp('remote-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  mkdirSync(join(root, DIR), { recursive: true });
  writeFileSync(join(root, DIR, 'proposal.md'), '# served\n');
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  snapshot.remoteChanges = sectionOf(branches, unjoinedList, deferred);
  const run = fakeGit({
    files: { [`${DIR}/proposal.md`]: '# served\n' }, head: HEAD, blame: '',
    branches: Object.fromEntries(branches.filter((b) => b.change.ok).map((b) => [`origin/${b.branch}`, { commit: b.sha, files: { [`${DIR}/proposal.md`]: `# remote of ${b.branch}\n`, [`${DIR}/resume.md`]: '---\ncurrent_slice: 2\nnext_action: ship it\nblockers:\n---\n' } }])),
  });
  const changes = { 1198: buildChangeView({ root, issue: 1198, snapshot, _run: run }) };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes, ...(remotesRefresh ? { remotesRefresh } : {}) });
  await loadApp();
  await settle();
  if (meta) { dom.emit('status', meta); await settle(); }
  return dom;
}

const cardOf = (dom, issue) => findAll(dom.mounts.canvas, byClass('node-card')).filter((c) => c.getAttribute('data-issue') === String(issue));
const all = (root) => findAll(root, () => true);
const textOf = (dom) => MOUNT_IDS.map((id) => dom.mounts[id].textContent).join('\n');

test('#1201 D42 R1201-2: a ticket card carries the remote branch line with the tip author, and an author name with markup is inert text', async (t) => {
  const dom = await boot({ branches: [entry({ author: XSS_AUTHOR })] });
  t.after(() => dom.restore());
  const [card] = cardOf(dom, 1198);
  assert.match(card.textContent, /on origin: feat\/issue-1198-x · last commit by <img src=x onerror=alert\(1\)> · \d+ h ago/);
  assert.equal(all(dom.mounts.canvas).filter((n) => n.tagName === 'IMG').length, 0, 'no element was created from the name');
  assert.equal(all(dom.mounts.canvas).filter((n) => Object.keys(n.attributes).includes('onerror')).length, 0);
});

test('#1201 R1201-4: a branch and its open PR are ONE node showing both; a branch with no PR stands alone', async (t) => {
  const dom = await boot({ branches: [entry({ pr: { number: 5, title: 'x' } }), entry({ branch: 'feat/issue-1199-y', issue: 1199, sha: 'e'.repeat(40), author: 'Grace Hopper' })] });
  t.after(() => dom.restore());
  assert.equal(cardOf(dom, 1198).length, 1, 'one node, not one for the branch and one for the PR');
  assert.match(cardOf(dom, 1198)[0].textContent, /on origin: feat\/issue-1198-x · PR #5 · last commit by/);
  assert.equal(cardOf(dom, 1199).length, 1);
  assert.doesNotMatch(cardOf(dom, 1199)[0].textContent, /PR #/);
});

test('#1201 R1201-8: the card says the resume state in its own words when the resume is not present', async (t) => {
  const dom = await boot({ branches: [entry({ resume: { state: 'invalid', path: null, reason: 'resume.md frontmatter missing required field: \'next_action\'', fields: null } })] });
  t.after(() => dom.restore());
  assert.match(cardOf(dom, 1198)[0].textContent, /resume\.md is not valid: .*next_action/);
});

test('#1201 R1201-5: the Remote work panel lists a branch whose ticket is not on the board; the unjoined group is collapsed with its count and expands on click', async (t) => {
  const dom = await boot({
    branches: [entry({ branch: 'feat/issue-4000-z', issue: 4000, sha: 'd'.repeat(40) })],
    unjoinedList: [unjoined('spike/new', 2 * HOUR), unjoined('wip/old', 30 * DAY), unjoined('wip/stale', 400 * DAY)],
  });
  t.after(() => dom.restore());
  const panel = find(dom.mounts.canvas, byClass('remote-panel'));
  assert.ok(panel, 'the panel is drawn');
  assert.match(panel.textContent, /Remote work/);
  assert.match(panel.textContent, /feat\/issue-4000-z/);
  assert.match(panel.textContent, /#4000 is not an open ticket on the board/);

  const toggle = find(panel, byClass('remote-unjoined-toggle'));
  assert.match(toggle.textContent, /unjoined branches \(3\)/);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(find(panel, byClass('remote-unjoined-list')), null, 'collapsed: no rows yet');
  assert.doesNotMatch(panel.textContent, /spike\/new/);

  fire(toggle, 'click');
  const list = find(dom.mounts.canvas, byClass('remote-unjoined-list'));
  assert.ok(list, 'expanded');
  const rows = findAll(list, byClass('remote-unjoined-row')).map((r) => r.textContent);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /spike\/new · last commit by Linus T · \d+ h ago/);
  assert.match(rows[1], /wip\/old .* 30 d ago/);
  assert.match(rows[2], /wip\/stale .* 400 d ago/, 'a stale branch is listed, not filtered');
});

test('#1201 R1201-3: the section carries no lane or merged branch, so the page names none and counts none of them', async (t) => {
  const dom = await boot({ branches: [entry()], unjoinedList: [unjoined('spike/x', DAY)] });
  t.after(() => dom.restore());
  const text = textOf(dom);
  assert.doesNotMatch(text, /memory\/h-|auto-archive\/20|hidden/);
  assert.match(find(dom.mounts.canvas, byClass('remote-panel')).textContent, /unjoined branches \(1\)/);
});

test('#1201 R1201-6: the drawer shows the served change, then one block per remote entry with its provenance; a document expands through the same worker path', async (t) => {
  const dom = await boot({ branches: [entry({ author: XSS_AUTHOR })] });
  t.after(() => dom.restore());
  fire(cardOf(dom, 1198)[0], 'click');
  await settle();
  const tabs = find(dom.mounts.drawer, byClass('tabs'));
  fire(Array.from(tabs.childNodes).find((b) => b.textContent.includes('SDD')), 'click');
  await settle();
  const block = find(dom.mounts.drawer, byClass('remote-block'));
  assert.ok(block, 'a remote block is drawn');
  assert.match(block.textContent, new RegExp(`on origin/feat/issue-1198-x @ ${TIP.slice(0, 12)}`));
  assert.match(block.textContent, /last commit by <img src=x onerror=alert\(1\)>/);
  assert.equal(all(dom.mounts.drawer).filter((n) => n.tagName === 'IMG').length, 0);
  assert.match(block.textContent, /origin\/feat\/issue-1198-x/, 'the ref');
  assert.match(block.textContent, /next_action/, 'the resume fields');
  const served = find(dom.mounts.drawer, byClass('card')).textContent;
  assert.doesNotMatch(served, /remote of/, 'the served change is above and not replaced');
  const toggle = find(block, byClass('doc-toggle'));
  fire(toggle, 'click');
  await settle();
  assert.match(block.textContent, /remote of feat\/issue-1198-x/, 'the remote document rendered');
  assert.match(find(block, byClass('doc-stamp')).textContent, new RegExp(`${DIR}/proposal\\.md @ ${TIP.slice(0, 12)}`), 'provenance stamp: path @ sha12');
});

test('#1201 R1201-11: the refresh button POSTs /api/remotes/refresh and adopts the poller state it answers', async (t) => {
  const dom = await boot({ branches: [entry()] });
  t.after(() => dom.restore());
  const button = find(dom.mounts.status, byClass('remotes-refresh'));
  assert.ok(button, 'a refresh button sits beside the poll controls');
  fire(button, 'click');
  await settle();
  assert.deepEqual(dom.posts, ['/api/remotes/refresh']);
});

test('#1201 R1201-11: a failed fetch is a band naming the cause and the last good time, while the branch list stays', async (t) => {
  const meta = { project: 'o/r', watcher: { ok: true, watched: 1, failed: [] }, poller: { paused: false, lastPolledAt: null, lastOkAt: null, lastError: null, remotes: { lastAttemptAt: '2026-10-01T10:05:00.000Z', lastOkAt: '2026-10-01T10:00:00.000Z', lastError: 'fatal: Could not resolve host: example.com', inFlight: false } } };
  const dom = await boot({ branches: [entry()], meta });
  t.after(() => dom.restore());
  assert.match(dom.mounts.banners.textContent, /remote branches as of 2026-10-01T10:00:00\.000Z — last fetch failed: fatal: Could not resolve host/);
  assert.equal(cardOf(dom, 1198).length, 1);
  assert.match(cardOf(dom, 1198)[0].textContent, /on origin: feat\/issue-1198-x/, 'the last known list is kept');
});

test('#1201 AC3 D43: no rendered text, attribute or label on the page names a session', async (t) => {
  const meta = { poller: { paused: false, lastError: null, remotes: { lastAttemptAt: null, lastOkAt: null, lastError: 'fatal: no', inFlight: false } } };
  const dom = await boot({ branches: [entry({ pr: { number: 5, title: 'x' } })], unjoinedList: [unjoined('spike/x', DAY)], meta, deferred: 2 });
  t.after(() => dom.restore());
  fire(find(dom.mounts.canvas, byClass('remote-unjoined-toggle')), 'click');
  fire(cardOf(dom, 1198)[0], 'click');
  await settle();
  const everything = MOUNT_IDS.flatMap((id) => all(dom.mounts[id])).flatMap((n) => [n.textContent, ...Object.entries(n.attributes).flat(), n.className]).join('\n');
  assert.doesNotMatch(everything, /session/i);
  assert.match(find(dom.mounts.canvas, byClass('remote-panel')).textContent, /2 branches not read yet/);
});
