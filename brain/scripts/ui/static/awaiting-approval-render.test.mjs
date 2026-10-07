// awaiting-approval-render.test.mjs — #1379 (D163): the state of an issue that lacks `status:approved` reads
// "Awaiting approval" on every surface — card chip, drawer head, legend and Roadmap row — in text AND in title
// attributes. The internal code `awaiting-review`, its class and tokens are unchanged on purpose.

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
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [{ number: 1230, title: 'feat(ui): not approved yet', labels: [], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) }];

async function boot() {
  const root = testTmp('awaiting-approval-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels, body }) => ({ number, title, labels, assignees: [], state: 'open', body })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
    async mrList() { return []; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-07T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  return dom;
}

// Every text node and every title attribute under the root, as one string.
const words = (root) => findAll(root, () => true).map((n) => `${n.textContent ?? ''} ${n.getAttribute?.('title') ?? ''}`).join('\n');
const STALE = /awaiting review/i;

test('#1379: the card chip, the drawer head and the legend say Awaiting approval, never Awaiting review', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const card = find(dom.mounts.canvas, (n) => n.getAttribute?.('data-issue') === '1230' && n.classList?.contains('node-card'));
  assert.match(find(card, byClass('node-state')).textContent, /◇Awaiting approval/);
  assert.match(find(dom.mounts.canvas, byClass('legend-states')).textContent, /Awaiting approval/);
  fire(card, 'click');
  await settle();
  assert.match(find(find(dom.mounts.drawer, byClass('drawer-head')), byClass('node-state')).textContent, /Awaiting approval/);
  assert.doesNotMatch(words(dom.mounts.canvas), STALE);
  assert.doesNotMatch(words(dom.mounts.drawer), STALE);
});

test('#1379: the Roadmap row of the node says Awaiting approval, in text and title', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  fire(find(dom.mounts.modes, (x) => x.tagName === 'BUTTON' && /governance/i.test(x.textContent)), 'click');
  await settle();
  fire(find(dom.mounts['governance-nav'], (x) => x.tagName === 'BUTTON' && /roadmap/i.test(x.textContent)), 'click');
  await settle();
  assert.equal(find(dom.mounts.canvas, byClass('roadmap-state')).textContent, '◇ Awaiting approval');
  assert.doesNotMatch(words(dom.mounts.canvas), STALE);
});
