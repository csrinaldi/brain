// header-render.test.mjs — #1284 R1284-10, R1284-11 (D99-D101): the REAL app.js on the fake DOM
// draws the status bar as ONE line; the long epic sentence moves to a title and a banner, and no
// fact the bar showed before is lost.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../../status/snapshot.mjs';
import { EPIC_JOIN_PENDING } from '../lib/header-model.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const CSS = readFileSync(join(HERE, 'app.css'), 'utf8');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const ISSUES = [{ number: 1198, title: 'feat(ui): a ticket', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) }];
const META = {
  servedBranch: { ok: true, branch: 'feature/issue-1284-x', source: { path: 'HEAD' } },
  watcher: { ok: true, watched: 1, failed: [] },
  poller: { paused: false, lastPolledAt: null, lastOkAt: new Date().toISOString(), lastError: null, intervalMs: 60000, nextAttemptAt: new Date(Date.now() + 30000).toISOString(), remotes: { lastAttemptAt: null, lastOkAt: null, lastError: null, inFlight: false } },
};

async function boot({ snapshot: patch = {} } = {}) {
  const root = testTmp('header-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels }) => ({ number, title, labels, assignees: [] })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-01T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  Object.assign(snapshot, patch);
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  await loadApp();
  await settle();
  dom.emit('status', META);
  await settle();
  return dom;
}

test('R1284-10: the epic reads "epic: not resolved" with the long sentence as its title, never as visible text', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const bar = dom.mounts.status;
  assert.equal(find(bar, byClass('status-epic-reason')), null, 'the wrapped sentence element is gone');
  const epic = find(bar, byClass('status-epic'));
  assert.equal(epic.textContent, 'epic: not resolved');
  assert.equal(epic.getAttribute('title'), EPIC_JOIN_PENDING);
  assert.ok(!bar.textContent.includes(EPIC_JOIN_PENDING));
});

test('R1284-11: the explanation moves, it is not deleted — #banners holds it', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  assert.ok(dom.mounts.banners.textContent.includes(EPIC_JOIN_PENDING));
});

test('R1284-11: a failed source\'s name and reason appear in #banners', async (t) => {
  const dom = await boot({ snapshot: { prs: { ok: false, reason: 'rate limited by the forge' } } });
  t.after(() => dom.restore());
  assert.match(dom.mounts.banners.textContent, /prs: rate limited by the forge/);
});

test('R1284-11: every fact the bar showed before is still in the DOM', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const bar = dom.mounts.status;
  for (const cls of ['title', 'served-branch', 'status-live', 'poll-indicator', 'poll-countdown', 'status-epic', 'status-counts', 'theme-choice', 'poll-toggle', 'poll-once', 'remotes-refresh']) {
    assert.ok(find(bar, byClass(cls)), `${cls} is drawn`);
  }
  assert.match(find(bar, byClass('served-branch')).textContent, /serving feature\/issue-1284-x/);
  assert.match(find(bar, byClass('status-counts')).textContent, /nodes/);
});

test('R1284-10: the spans that can grow long carry their full text in title', async (t) => {
  const dom = await boot();
  t.after(() => dom.restore());
  const bar = dom.mounts.status;
  for (const cls of ['served-branch', 'poll-indicator']) {
    const node = find(bar, byClass(cls));
    assert.equal(node.getAttribute('title'), node.textContent, `${cls} keeps its full text as title`);
  }
  const counts = find(bar, byClass('status-counts'));
  assert.equal(counts.getAttribute('title'), counts.textContent);
});

test('R1284-10: the bar never wraps — nowrap on .status-bar, ellipsis on the long spans, no status-epic-reason rule', () => {
  const rule = (selector) => CSS.match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{[^}]*\\}`))?.[0] ?? '';
  const bar = rule('.status-bar');
  assert.match(bar, /flex-wrap:\s*nowrap/);
  assert.match(bar, /overflow:\s*hidden/);
  assert.doesNotMatch(CSS, /status-epic-reason/);
  assert.match(CSS, /\.status-bar \.served-branch[^{]*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(CSS, /\.status-bar \.title[^{]*\{[^}]*flex:\s*none/);
});
