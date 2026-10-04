// local-render.test.mjs — #883: the REAL app.js on the fake DOM draws the
// "on this machine" blocks, in the order R883-9 gives, as text only, and
// reloads the open drawer only for the selected issue's worktrees (R883-11).

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
const XSS_BRANCH = '<img src=x onerror=alert(1)>';
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [
  { number: 1198, title: 'feat(ui): every SDD artifact is readable', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1199, title: 'feat(ui): a second ticket', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
];

const doc = (over = {}) => ({
  path: `${DIR}/proposal.md`, ref: 'worktree wt-a', commit: null, blob: 'c'.repeat(40), state: 'present', text: '# LOCAL-BODY\n', bytes: 13, truncated: false, truncatedAt: null,
  reason: null, note: null, overlay: 'new', uncommitted: true, marker: `13 B · ${'c'.repeat(12)}`, ...over,
});
const block = (over = {}) => ({
  leaf: 'wt-a', branch: 'feat/issue-1198-x', head: 'd'.repeat(40), path: '/srv/wt-a', dir: DIR, label: 'worktree wt-a · feat/issue-1198-x', state: 'read',
  documents: { proposal: doc() }, absent: ['spec.md'], resume: { state: 'missing', reason: null, document: null, view: null }, progress: null, ...over,
});
const remoteBlock = () => ({
  branch: 'feat/issue-1198-r', sha: 'e'.repeat(40), label: `on origin/feat/issue-1198-r @ ${'e'.repeat(12)}`, pr: null, author: 'Ada Lovelace', tipAt: '2026-10-01T00:00:00Z',
  dir: null, documents: null, sameAsServed: false, state: 'capped', resume: { state: 'missing', reason: null, document: null, view: null },
});
const entryOf = (issue, over = {}) => ({ path: `/srv/wt-${issue}`, leaf: `wt-${issue}`, branch: `feat/issue-${issue}-x`, head: 'd'.repeat(40), issue, dir: DIR, dirState: 'present', reason: null, touchedAt: null, fingerprint: 'f1', capped: false, ...over });
const sectionOf = (...entries) => ({ ok: true, value: { entries, hidden: { served: 1 }, tier: 'working-tree' } });

async function boot({ local = [], remote = [], servedDir = true, section = sectionOf(entryOf(1198), entryOf(1199)), extra = {} } = {}) {
  const root = testTmp('local-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  if (servedDir) {
    mkdirSync(join(root, DIR), { recursive: true });
    writeFileSync(join(root, DIR, 'proposal.md'), '# served\n');
  }
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  snapshot.localWorktrees = section;
  const run = fakeGit({ files: servedDir ? { [`${DIR}/proposal.md`]: '# served\n' } : {}, head: HEAD, blame: '', branches: {} });
  const view = buildChangeView({ root, issue: 1198, snapshot, _run: run });
  view.value.local = local;
  view.value.remote = remote;
  view.value.localNote = null;
  Object.assign(view.value, extra);
  const changes = { 1198: view, 1199: buildChangeView({ root, issue: 1199, snapshot, _run: run }) };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes });
  const fetched = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetched.push(String(url)); return inner(url, init); };
  await loadApp();
  await settle();
  return Object.assign(dom, { fetched, changes, snapshot });
}

const cardOf = (dom, issue) => findAll(dom.mounts.canvas, byClass('node-card')).filter((c) => c.getAttribute('data-issue') === String(issue));
const open = async (dom, issue = 1198) => { fire(cardOf(dom, issue)[0], 'click'); await settle(); };
const all = (root) => findAll(root, () => true);
const positionOf = (dom, name) => Array.from(dom.mounts.drawer.childNodes).findIndex((n) => n.classList && n.classList.contains(name));
const changeFetches = (dom) => dom.fetched.filter((u) => /^\/api\/change\/\d+$/.test(u));

test('R883-9: with a served change dir the order is the tabs, then "on this machine", then "on origin"', async (t) => {
  const dom = await boot({ local: [block()], remote: [remoteBlock()] });
  t.after(() => dom.restore());
  await open(dom);
  const [tabs, local, remote] = ['tabs', 'local-blocks', 'remote-blocks'].map((n) => positionOf(dom, n));
  assert.ok(tabs >= 0 && local > tabs && remote > local, `tabs ${tabs}, local ${local}, remote ${remote}`);
  const section = find(dom.mounts.drawer, byClass('local-blocks'));
  assert.match(find(section, byClass('drawer-section-title')).textContent, /^on this machine$/);
  assert.match(find(section, byClass('local-block-label')).textContent, /^worktree wt-a · feat\/issue-1198-x$/);
  assert.match(section.textContent, /uncommitted: new/);
  assert.match(section.textContent, /not in this worktree: spec\.md/);
});

test('R883-9: with no served change dir the local block comes first and the empty-state line says so', async (t) => {
  const dom = await boot({ local: [block()], servedDir: false });
  t.after(() => dom.restore());
  await open(dom);
  const local = positionOf(dom, 'local-blocks');
  assert.ok(local >= 0 && local < positionOf(dom, 'tabs'), 'the local blocks are drawn before the tabs');
  assert.match(dom.mounts.drawer.textContent, /the served HEAD has no change dir for this issue; this machine's worktrees follow/);
});

test('R883-2: with no local entry there is no block, no heading and no band for it; the empty-state line is the old one', async (t) => {
  const dom = await boot({ local: [], servedDir: false, section: sectionOf() });
  t.after(() => dom.restore());
  await open(dom);
  assert.equal(find(dom.mounts.drawer, byClass('local-block')), null);
  assert.equal(find(dom.mounts.drawer, (n) => n.classList?.contains('drawer-section-title') && n.textContent === 'on this machine'), null);
  assert.doesNotMatch(dom.mounts.drawer.textContent, /on this machine|this machine's worktrees/);
  assert.match(dom.mounts.drawer.textContent, /no change dir for this issue in the read model/);
});

test('R883-9: a branch named with markup is drawn as text, and a same-as-main row has no toggle', async (t) => {
  const hostile = block({
    branch: XSS_BRANCH, label: `worktree wt-a · ${XSS_BRANCH}`,
    documents: { proposal: doc({ overlay: 'same-as-main', uncommitted: false, text: null }), design: doc({ path: `${DIR}/design.md` }) },
  });
  const dom = await boot({ local: [hostile] });
  t.after(() => dom.restore());
  await open(dom);
  const section = find(dom.mounts.drawer, byClass('local-blocks'));
  assert.match(section.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(all(dom.mounts.drawer).filter((n) => n.tagName === 'IMG').length, 0);
  assert.equal(all(dom.mounts.drawer).filter((n) => Object.keys(n.attributes).includes('onerror')).length, 0);
  assert.match(section.textContent, /same as main/);
  assert.equal(findAll(section, byClass('doc-toggle')).length, 1, 'only the design has a body to open');
});

test('R883-6: a deleted document is drawn as text with no toggle', async (t) => {
  const gone = block({ documents: { tasks: doc({ path: `${DIR}/tasks.md`, state: 'deleted', overlay: 'deleted', uncommitted: true, text: null, blob: null, marker: null }) } });
  const dom = await boot({ local: [gone] });
  t.after(() => dom.restore());
  await open(dom);
  const section = find(dom.mounts.drawer, byClass('local-blocks'));
  assert.match(section.textContent, /uncommitted: deleted \(committed on feat\/issue-1198-x, missing from the working tree\)/);
  assert.equal(findAll(section, byClass('doc-toggle')).length, 0);
});

test('R883-12: a local document opens through the worker path and its stamp names the worktree and the content marker', async (t) => {
  const dom = await boot({ local: [block()] });
  t.after(() => dom.restore());
  await open(dom);
  const section = find(dom.mounts.drawer, byClass('local-blocks'));
  fire(find(section, byClass('doc-toggle')), 'click');
  await settle();
  assert.match(find(section, byClass('doc-stamp')).textContent, new RegExp(`${DIR}/proposal\\.md @ worktree wt-a · 13 B · ${'c'.repeat(12)}`));
  assert.match(section.textContent, /LOCAL-BODY/);
});

const frame = (section) => ({ name: 'localWorktrees', section, generatedAt: '2026-10-01T12:00:05.000Z', cause: 'watch:local:wt-1198/tasks.md' });

test('R883-11: a localWorktrees frame that changes the selected issue\'s fingerprint reloads the open drawer once; another issue\'s change does not', async (t) => {
  const dom = await boot({ local: [block()] });
  t.after(() => dom.restore());
  await open(dom);
  assert.equal(changeFetches(dom).length, 1);

  dom.emit('section', frame(sectionOf(entryOf(1198), entryOf(1199, { fingerprint: 'f2' }))));
  await settle();
  assert.equal(changeFetches(dom).length, 1, 'issue 1199 changed, the open drawer is 1198');

  dom.emit('section', frame(sectionOf(entryOf(1198, { fingerprint: 'f2' }), entryOf(1199, { fingerprint: 'f2' }))));
  await settle();
  assert.equal(changeFetches(dom).length, 2, 'issue 1198 changed: one more read');
  assert.equal(changeFetches(dom)[1], '/api/change/1198');

  dom.emit('section', frame(sectionOf(entryOf(1198, { fingerprint: 'f2' }), entryOf(1199, { fingerprint: 'f2' }))));
  await settle();
  assert.equal(changeFetches(dom).length, 2, 'an identical frame reads nothing');
});

test('R883-12: an edit reloads the drawer with a new stamp and starts a new render; the same bytes reuse the render', async (t) => {
  const dom = await boot({ local: [block()] });
  t.after(() => dom.restore());
  await open(dom);
  fire(find(find(dom.mounts.drawer, byClass('local-blocks')), byClass('doc-toggle')), 'click');
  await settle();
  const first = dom.workers.length;
  assert.equal(first, 1);

  const edited = block({ documents: { proposal: doc({ text: '# LOCAL-BODY\nONE MORE LINE\n', bytes: 27, marker: `27 B · ${'f'.repeat(12)}` }) } });
  dom.changes[1198].value.local = [edited];
  dom.emit('section', frame(sectionOf(entryOf(1198, { fingerprint: 'f9' }), entryOf(1199))));
  await settle();
  const section = find(dom.mounts.drawer, byClass('local-blocks'));
  assert.equal(dom.workers.length, 2, 'a new stamp starts a new render');
  assert.match(find(section, byClass('doc-stamp')).textContent, new RegExp(`27 B · ${'f'.repeat(12)}`));
  assert.match(section.textContent, /ONE MORE LINE/);

  dom.emit('section', frame(sectionOf(entryOf(1198, { fingerprint: 'fa' }), entryOf(1199))));
  await settle();
  assert.equal(dom.workers.length, 2, 'the same bytes under a new fingerprint reuse the settled render');
});

// ── #1276: the tabs name the worktree or the origin branch they were read from ──

const worktreeSource = (leaf) => ({ kind: 'worktree', leaf, branch: 'feat/issue-1198-x', dir: DIR, label: `worktree ${leaf}` });
const specFrom = (from) => ({ ok: true, value: [], from });

test('R1276-6: a from line is drawn first in the tab, as text', async (t) => {
  const dom = await boot({ servedDir: false, extra: { spec: specFrom('from worktree wt-a · uncommitted: new'), tabSource: worktreeSource('wt-a') } });
  t.after(() => dom.restore());
  await open(dom);
  const line = find(dom.mounts.drawer, byClass('tab-from'));
  assert.equal(line.textContent, 'from worktree wt-a · uncommitted: new');
  assert.equal(line.tagName, 'P');
});

test('R1276-6: a failed tab still draws its from line', async (t) => {
  const dom = await boot({ servedDir: false, extra: { spec: { ok: false, reason: 'spec.md is not in worktree wt-a', from: 'from worktree wt-a · not in this worktree' }, tabSource: worktreeSource('wt-a') } });
  t.after(() => dom.restore());
  await open(dom);
  assert.equal(find(dom.mounts.drawer, byClass('tab-from')).textContent, 'from worktree wt-a · not in this worktree');
  assert.match(dom.mounts.drawer.textContent, /spec\.md is not in worktree wt-a/);
});

test('R1276-6: a served-HEAD tab draws no from line', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  await open(dom);
  assert.equal(find(dom.mounts.drawer, byClass('tab-from')), null);
});

test('R1276-10: a hostile worktree leaf in the from line is text and makes no element', async (t) => {
  const leaf = 'wt-<img src=x onerror=alert(1)>';
  const dom = await boot({ servedDir: false, extra: { spec: specFrom(`from worktree ${leaf} · feat/issue-1198-x`), tabSource: worktreeSource(leaf) } });
  t.after(() => dom.restore());
  await open(dom);
  assert.equal(find(dom.mounts.drawer, byClass('tab-from')).textContent, `from worktree ${leaf} · feat/issue-1198-x`);
  assert.equal(Array.from(findAll(dom.mounts.drawer, (n) => n.tagName === 'IMG')).length, 0);
  assert.match(dom.mounts.drawer.textContent, /the tabs read worktree wt-<img src=x onerror=alert\(1\)>/);
});

test('R1276-6: with no change dir at the served HEAD, the empty-state line names the worktree the tabs read', async (t) => {
  const dom = await boot({ servedDir: false, extra: { tabSource: worktreeSource('wt-a') } });
  t.after(() => dom.restore());
  await open(dom);
  assert.match(dom.mounts.drawer.textContent, /the served HEAD has no change dir for this issue; the tabs read worktree wt-a/);
});

test('R1276-6: with no change dir at the served HEAD, the empty-state line names the origin branch the tabs read', async (t) => {
  const label = `origin/feat/issue-1198-r @ ${'e'.repeat(12)}`;
  const dom = await boot({ servedDir: false, extra: { tabSource: { kind: 'origin', branch: 'feat/issue-1198-r', sha12: 'e'.repeat(12), dir: DIR, label } } });
  t.after(() => dom.restore());
  await open(dom);
  assert.match(dom.mounts.drawer.textContent, new RegExp(`the served HEAD has no change dir for this issue; the tabs read ${label}`));
});
