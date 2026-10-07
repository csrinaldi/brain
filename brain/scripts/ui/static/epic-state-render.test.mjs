// epic-state-render.test.mjs — #1309 R1309-1, 3, 7, 8: the REAL app.js on the fake DOM draws an epic's
// lifecycle chip from its children — in the cluster heading, the drawer header and the Roadmap row — and every
// model call site hands the models the `epics` sections, so the omission cannot ship silently (D135).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, fire, find, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const T = '2026-10-02T10:00:00.000Z';
const EPIC_BODY = ['```brain-graph/1', 'track: UI', 'kind: epic', 'blocks: []', 'needs: []', 'files: []', '```'].join('\n');
const ok = (value) => ({ ok: true, value });
const frame = (name, section) => ({ name, section, generatedAt: T, cause: 'test' });

async function boot({ closed = 0, open = 0, closedEntry = { state: 'complete', at: T } } = {}) {
  const root = testTmp('epic-state-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  let n = 1000;
  const rows = (count, state) => Array.from({ length: count }, () => { n += 1; return { number: n, title: `slice ${n}`, labels: ['status:approved'], assignees: [], state, body: 'Parent: #878 (the epic)' }; });
  const openRows = [{ number: 878, title: 'the epic', labels: ['status:approved'], assignees: [], state: 'open', body: EPIC_BODY }, ...rows(open, 'open')];
  const closedRows = rows(closed, 'closed');
  const vcs = {
    async issueList({ state }) { return state === 'closed' ? closedRows : openRows; },
    async mrList() { return []; },
    async issueView() { return { body: '', assignees: [] }; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: T, _run: () => { throw new Error('no git'); } });
  snapshot.forgeLoad = ok({ open: { state: 'complete', at: T }, closed: closedEntry });
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  return { dom, snapshot };
}

const clusters = async (dom) => {
  fire(find(dom.mounts.canvas, (x) => x.tagName === 'BUTTON' && x.textContent.includes('epic clusters')), 'click');
  await settle();
};
const headChip = (dom) => find(find(dom.mounts.canvas, byClass('epic-head')), byClass('node-state'));

test('R1309-3/S2: the #878 shape — 17 of 39 closed — is In flight in the cluster heading and the drawer, with its reason', async (t) => {
  const { dom } = await boot({ closed: 17, open: 22 });
  t.after(() => dom.restore());
  await clusters(dom);
  assert.equal(headChip(dom).textContent, '◐In flight');
  assert.equal(headChip(dom).getAttribute('title'), '17 / 39 children closed');
  fire(find(dom.mounts.canvas, byClass('epic-head')), 'click');
  await settle();
  const chip = find(find(dom.mounts.drawer, byClass('drawer-head')), byClass('node-state'));
  assert.equal(chip.textContent, '◐In flight');
  assert.equal(chip.getAttribute('title'), '17 / 39 children closed');
});

test('R1309-7/S6: an open epic with every child closed reads Ready to close, and the legend carries the state', async (t) => {
  const { dom } = await boot({ closed: 4 });
  t.after(() => dom.restore());
  await clusters(dom);
  assert.equal(headChip(dom).textContent, '◉Ready to close');
  assert.match(headChip(dom).getAttribute('title'), /all 4 children closed; the epic is still open/);
  assert.match(find(dom.mounts.canvas, byClass('legend-states')).textContent, /Ready to close/);
});

test('R1309-5/S3: while the closed lane is pending the epic is Not computed, and the next frame makes it In flight', async (t) => {
  const { dom } = await boot({ closed: 2, open: 3, closedEntry: { state: 'pending', at: null } });
  t.after(() => dom.restore());
  await clusters(dom);
  assert.equal(headChip(dom).textContent, '—Not computed');
  assert.match(headChip(dom).getAttribute('title'), /counting closed children/);
  dom.emit('section', frame('forgeLoad', ok({ open: { state: 'complete', at: T }, closed: { state: 'complete', at: T } })));
  await settle();
  assert.equal(headChip(dom).textContent, '◐In flight');
});

test('R1309-1/R1309-8: the Roadmap row of the epic reads the same state and shows the reason as its tooltip', async (t) => {
  const { dom } = await boot({ closed: 17, open: 22 });
  t.after(() => dom.restore());
  fire(find(dom.mounts.modes, (x) => x.tagName === 'BUTTON' && /governance/i.test(x.textContent)), 'click');
  await settle();
  fire(find(dom.mounts['governance-nav'], (x) => x.tagName === 'BUTTON' && /roadmap/i.test(x.textContent)), 'click');
  await settle();
  const chip = find(dom.mounts.canvas, byClass('roadmap-state'));
  assert.equal(chip.textContent, '◐ In flight');
  assert.equal(chip.getAttribute('title'), '17 / 39 children closed');
});

test('D135: every app.js model call site passes the `epics` sections next to `work`', () => {
  const src = readFileSync(join(HERE, 'app.js'), 'utf8');
  assert.match(src, /function currentEpics\(\)/);
  for (const fn of ['buildLaneModel', 'buildRoadmapModel', 'nodeSummaryFor', 'childrenOf']) {
    const calls = src.split('\n').filter((l) => new RegExp(`(?<![\\w.])${fn}\\(`).test(l) && !/^\s*(import|function)/.test(l) && !/^\s*(\*|\/\/)/.test(l));
    assert.ok(calls.length > 0, `${fn} has call sites`);
    for (const l of calls) assert.match(l, /epics: currentEpics\(\)/, `${fn} call without epics: ${l.trim()}`);
  }
});
