// progress-render.test.mjs — #1199 R1199-3/R1199-4: the REAL app.js on the fake
// DOM says "working tree" on the card and the SDD view and "at HEAD" in the
// drawer, from the counts the snapshot and the drawer carry.

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
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const WORKING = '- [x] a\n- [ ] b\n  - [X] c\n- [ ] d\n- [x] e\n';
const COMMITTED = '- [x] a\n- [x] b\n- [ ] c\n- [ ] d\n- [ ] e\n';

async function boot({ working = WORKING, committed = COMMITTED } = {}) {
  const root = testTmp('progress-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  mkdirSync(join(root, DIR), { recursive: true });
  writeFileSync(join(root, DIR, 'proposal.md'), '# served\n');
  writeFileSync(join(root, DIR, 'tasks.md'), working);
  const vcs = {
    async issueList() { return [{ number: 1198, title: 'reader', labels: ['status:approved'], assignees: [], state: 'open', body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) }]; },
    async mrList() { return []; },
    async issueView() { return { body: '', assignees: [] }; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  const run = fakeGit({ files: { [`${DIR}/proposal.md`]: '# served\n', [`${DIR}/tasks.md`]: committed }, head: HEAD, blame: '' });
  const changes = { 1198: buildChangeView({ root, issue: 1198, snapshot, _run: run }) };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot, changes });
  await loadApp();
  await settle();
  return dom;
}

const card = (dom) => findAll(dom.mounts.canvas, byClass('node-card')).filter((c) => c.getAttribute('data-issue') === '1198')[0];

test('#1199 R1199-3/4: the card says 3 / 5 working tree, and the drawer says 2 / 5 at HEAD', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  assert.match(find(card(dom), byClass('node-sdd-tasks')).textContent, /^tasks 3 \/ 5 · working tree$/);
  fire(card(dom), 'click');
  await settle();
  const tabs = find(dom.mounts.drawer, byClass('tabs'));
  fire(Array.from(tabs.childNodes).find((b) => b.textContent.includes('Tasks')), 'click');
  await settle();
  assert.match(find(dom.mounts.drawer, byClass('tab-progress')).textContent, /^2 \/ 5 tasks done · at HEAD$/);
});

test('#1199 R1199-3: a tasks.md with no checkboxes says why on the card and never shows a number over a slash', async (t) => {
  const dom = await boot({ working: '# Tasks\nprose\n', committed: '# Tasks\nprose\n' });
  t.after(() => dom.restore());
  const text = find(card(dom), byClass('node-sdd-tasks')).textContent;
  assert.equal(text, 'tasks: tasks.md has no checklist items · working tree');
  assert.doesNotMatch(text, /\d\s*\//);
});
