// rollup-render.test.mjs — #1199 R1199-8: the REAL app.js on the fake DOM shows an
// epic's rollup on its cluster heading and in its drawer, as text only. The
// hierarchy is built by the real snapshot; only `forgeLoad` is staged per case.

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
const T = '2026-10-02T10:00:00.000Z';
const EPIC_BODY = ['```brain-graph/1', 'track: UI', 'kind: epic', 'blocks: []', 'needs: []', 'files: []', '```'].join('\n');
const SLICE_BODY = 'Parent: #878 (the epic)';

async function boot({ closed = 0, open = 0, unknown = 0, closedEntry = { state: 'complete', at: T } } = {}) {
  const root = testTmp('rollup-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  let n = 1000;
  const rows = (count, state) => Array.from({ length: count }, () => { n += 1; return { number: n, title: `slice ${n}`, labels: ['status:approved'], assignees: [], state, body: SLICE_BODY }; });
  const openRows = [{ number: 878, title: 'the epic', labels: ['status:approved'], assignees: [], state: 'open', body: EPIC_BODY }, ...rows(open, 'open'), ...rows(unknown, null)];
  const closedRows = rows(closed, 'closed');
  const vcs = {
    async issueList({ state }) { return state === 'closed' ? closedRows : openRows; },
    async mrList() { return []; },
    async issueView() { return { body: '', assignees: [] }; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: T, _run: () => { throw new Error('no git'); } });
  snapshot.forgeLoad = { ok: true, value: { open: { state: 'complete', at: T }, closed: closedEntry } };
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  fire(find(dom.mounts.canvas, (x) => x.tagName === 'BUTTON' && x.textContent.includes('epic clusters')), 'click');
  await settle();
  return { dom, snapshot };
}

const heading = (dom) => find(dom.mounts.canvas, byClass('epic-count')).textContent;

test('#1199 R1199-8: the heading reads "12 / 29 children closed · 1 state unknown"', async (t) => {
  const { dom } = await boot({ closed: 12, open: 16, unknown: 1 });
  t.after(() => dom.restore());
  assert.equal(heading(dom), '12 / 29 children closed · 1 state unknown');
});

test('#1199 R1199-8: the heading reads "counting closed children… · 4 open" while the closed lane is pending', async (t) => {
  const { dom } = await boot({ open: 4, closedEntry: { state: 'pending', at: null } });
  t.after(() => dom.restore());
  assert.equal(heading(dom), 'counting closed children… · 4 open');
});

test('#1199 R1199-8: the epic drawer shows the same label above the list, and says what the list holds', async (t) => {
  const { dom } = await boot({ closed: 2, open: 3 });
  t.after(() => dom.restore());
  fire(find(dom.mounts.canvas, byClass('epic-head')), 'click');
  await settle();
  const block = find(dom.mounts.drawer, byClass('drawer-children'));
  assert.match(find(block, byClass('epic-rollup')).textContent, /^2 \/ 5 children closed$/);
  assert.match(block.textContent, /the list shows open children; closed children are counted above/);
  assert.equal(findAll(block, byClass('child-row')).length, 3, 'the open children are listed, the closed ones are not');
});

test('#1199 R1199-8: a ticket that is not an epic gets no rollup in its drawer', async (t) => {
  const { dom } = await boot({ open: 2 });
  t.after(() => dom.restore());
  const card = findAll(dom.mounts.canvas, byClass('node-card')).find((c) => c.getAttribute('data-issue') === '1001');
  fire(card, 'click');
  await settle();
  assert.equal(find(dom.mounts.drawer, byClass('epic-rollup')), null);
});

test('#1199 R1199-8: markup in a lane reason is inert text, never an element', async (t) => {
  const xss = '<img src=x onerror=alert(1)>';
  const { dom } = await boot({ open: 4, closedEntry: { state: 'failed', at: T, reason: xss, lastCompleteAt: null } });
  t.after(() => dom.restore());
  assert.equal(heading(dom), `closed children unknown (${xss}) · 4 open`);
  const all = (root) => findAll(root, () => true);
  assert.equal(all(dom.mounts.canvas).filter((x) => x.tagName === 'IMG').length, 0);
});
