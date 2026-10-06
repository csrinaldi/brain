// review-footer-render.test.mjs — #1312: the REAL app.js on the fake DOM draws the review footer on a lane card.
// What is asserted is what the page built: elements, text and the title attribute, never the model that fed it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot, reviewRows } from '../../status/snapshot.mjs';
import { testTmp } from '../../lib/test-tmp.mjs';
import { installDom, fire, find, findAll, byClass } from '../test-support/dom.mjs';
import { loadApp, settle } from '../test-support/load-app.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOUNT_IDS = ['status', 'modes', 'search', 'banners', 'governance-nav', 'canvas', 'drawer'];
const A = 'a1b2c3d'.padEnd(40, '0');
const B = 'e4f5a6b'.padEnd(40, '0');
const fence = (lines) => ['## What it is', '', '```brain-graph/1', ...lines, '```', ''].join('\n');
const EPIC = ['```brain-graph/1', 'track: UI', 'kind: epic', 'blocks: []', 'needs: []', 'files: []', '```'].join('\n');
const ISSUES = [
  { number: 881, title: 'feat(ui): a ticket with an open PR', labels: ['status:approved'], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 1230, title: 'feat(ui): awaiting approval', labels: [], body: fence(['track:    UI', 'blocks:   []', 'needs:    []']) },
  { number: 878, title: 'the epic', labels: ['status:approved'], body: EPIC },
  { number: 1001, title: 'slice of the epic', labels: ['status:approved'], body: 'Parent: #878 (the epic)' },
];
const ok = (value) => ({ ok: true, value });
const body = (sha, rev, word) => `Round ${rev}\n\n\`\`\`yaml\nprotocol: brain-review/2\nhead_sha: ${sha}\nrev: ${rev}\nverdict: ${word}\nfindings: []\n\`\`\`\n`;
const thread = (pr, ...v) => reviewRows(pr, v.map(([sha, rev, word]) => ({ body: body(sha, rev, word), author: 'bot' })));
const pr = (number, issue, branch) => ({ number, issue, title: `pr ${number}`, headBranch: branch });

async function boot({ prs, reviews, remoteChanges } = {}) {
  const root = testTmp('review-footer-render-');
  writeFileSync(join(root, 'brain.config.json'), readFileSync(join(REPO, 'brain.config.json'), 'utf8'));
  const vcs = {
    async issueList() { return ISSUES.map(({ number, title, labels, body: b }) => ({ number, title, labels, assignees: [], state: 'open', body: b })); },
    async issueView({ number }) { return { body: ISSUES.find((i) => i.number === number).body, assignees: [] }; },
    async mrList() { return []; },
    async prReviews() { return []; },
  };
  const snapshot = await buildSnapshot({ root, project: 'o/r', vcs, now: '2026-10-05T12:00:00.000Z', _run: () => { throw new Error('no git'); } });
  if (prs !== undefined) snapshot.prs = prs;
  if (reviews !== undefined) snapshot.reviews = reviews;
  if (remoteChanges !== undefined) snapshot.remoteChanges = remoteChanges;
  const dom = installDom({ mountIds: MOUNT_IDS, snapshot });
  const before = dom.posts.length;
  await loadApp();
  await settle();
  return { dom, before };
}

const cardOf = (dom, issue) => findAll(dom.mounts.canvas, byClass('node-card')).filter((c) => c.getAttribute('data-issue') === String(issue));
const footerOf = (dom, issue) => find(cardOf(dom, issue)[0], byClass('node-review'));
const all = (root) => findAll(root, () => true);
const remote = (entries) => ok({ base: 'origin/main', branches: entries, unjoined: [], hidden: { base: 0, lane: 0, merged: 0 }, prsApplied: true, deferred: 0 });
const branchEntry = (sha, prInfo) => ({
  branch: 'feat/issue-881-x', sha, tipAt: '2026-10-05T10:00:00.000Z', author: 'Ada Lovelace', kind: 'grammar', issue: 881, pr: prInfo,
  change: { ok: false, reason: 'no change dir' }, resume: null,
});

test('#1312 S1: a card whose issue joins an open PR carries the footer: text, and a title that repeats it', async (t) => {
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([thread(885, [A, 1, 'APPROVE'], [A, 2, 'REVISE'])]) });
  t.after(() => dom.restore());
  assert.equal(cardOf(dom, 881).length, 1);
  const footer = footerOf(dom, 881);
  assert.ok(footer, 'the footer is drawn');
  assert.equal(footer.textContent, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)}`);
  assert.ok(footer.getAttribute('title').startsWith(footer.textContent), 'the title carries the same words, then the detail');
  assert.ok(footer.getAttribute('title').includes(A), 'and the full head');
});

test('#1312 S4: a verdict head that differs from the origin tip held here names both SHAs, in text AND in the title, and never says stale', async (t) => {
  const { dom } = await boot({
    prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([thread(885, [A, 1, 'REVISE'])]), remoteChanges: remote([branchEntry(B, { number: 885, title: 't' })]),
  });
  t.after(() => dom.restore());
  const footer = footerOf(dom, 881);
  assert.match(footer.textContent, new RegExp(`head ${A.slice(0, 7)} · origin tip here ${B.slice(0, 7)}$`));
  assert.ok(footer.getAttribute('title').includes(B) && footer.getAttribute('title').includes('last fetch'));
  assert.doesNotMatch(footer.textContent + footer.getAttribute('title'), /stale/i);
});

test('#1312 S10 / R1312-9: the card names PR #885 exactly once — the remote line drops its PR part', async (t) => {
  const { dom } = await boot({
    prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([thread(885, [A, 1, 'REVISE'])]), remoteChanges: remote([branchEntry(A, { number: 885, title: 't' })]),
  });
  t.after(() => dom.restore());
  const card = cardOf(dom, 881)[0];
  assert.equal(card.textContent.split('PR #885').length - 1, 1);
  assert.match(card.textContent, /on origin: feat\/issue-881-x · last commit by Ada Lovelace/);
  const line = find(card, byClass('node-remote-line'));
  assert.equal(line.getAttribute('title') ?? '', '', 'no hidden second mention in a tooltip');
});

test('#1312 S5 / R1312-6: while prs is pending no card has a footer, and the render reached for no forge', async (t) => {
  const { dom, before } = await boot({ prs: { ok: false, pending: true, reason: 'loading the pull requests' }, reviews: { ok: false, pending: true, reason: 'loading' } });
  t.after(() => dom.restore());
  assert.ok(cardOf(dom, 881).length === 1, 'the card still renders');
  assert.equal(all(dom.mounts.canvas).filter((n) => n.classList?.contains('node-review')).length, 0);
  assert.equal(dom.posts.length, before, 'no POST was made to draw the footer');
});

test('#1312 S6: prs read and reviews pending — the PR is named and says the verdict is not read yet', async (t) => {
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: { ok: false, pending: true, reason: 'loading the review threads' } });
  t.after(() => dom.restore());
  const footer = footerOf(dom, 881);
  assert.equal(footer.textContent, 'PR #885 · verdict not read yet');
  assert.match(footer.getAttribute('title'), /loading the review threads/);
});

test('#1312 S3: an unreadable thread carries its reason in the title', async (t) => {
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([{ pr: 885, ok: false, reason: 'HTTP 502' }]) });
  t.after(() => dom.restore());
  const footer = footerOf(dom, 881);
  assert.equal(footer.textContent, 'PR #885 · review thread unreadable');
  assert.match(footer.getAttribute('title'), /HTTP 502/);
});

test('#1312 S8 / R1312-1: an issue no open PR joins has no footer, whatever its chip', async (t) => {
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([thread(885, [A, 1, 'REVISE'])]) });
  t.after(() => dom.restore());
  assert.equal(cardOf(dom, 1230).length, 1);
  assert.match(cardOf(dom, 1230)[0].textContent, /Awaiting review/);
  assert.equal(footerOf(dom, 1230), null);
});

test('#1312 S9: a hostile verdict word is inert text, marked unrecognised', async (t) => {
  const word = '<img src=x onerror=alert(1)>';
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([thread(885, [A, 1, word])]) });
  t.after(() => dom.restore());
  assert.ok(footerOf(dom, 881).textContent.includes(`${word} (unrecognised verdict)`));
  assert.equal(all(dom.mounts.canvas).filter((n) => n.tagName === 'IMG').length, 0);
  assert.equal(all(dom.mounts.canvas).filter((n) => Object.keys(n.attributes).includes('onerror')).length, 0);
});

test('#1312: an epic-cluster child card carries the footer too', async (t) => {
  const { dom } = await boot({ prs: ok([pr(990, 1001, 'feat/issue-1001-y')]), reviews: ok([thread(990, [B, 1, 'APPROVE'])]) });
  t.after(() => dom.restore());
  fire(find(dom.mounts.canvas, (x) => x.tagName === 'BUTTON' && x.textContent.includes('epic clusters')), 'click');
  await settle();
  assert.equal(footerOf(dom, 1001).textContent, `PR #990 · rev 1 · APPROVE · head ${B.slice(0, 7)}`);
});

test('#1312 R1312-6 / D150: a queued review thread (first landing, or beyond REVIEW_CAP) draws "verdict not read yet" with the reason in the title', async (t) => {
  const reason = "this PR's reviews have not been fetched yet (queued)";
  const { dom } = await boot({ prs: ok([pr(885, 881, 'feat/issue-881-x')]), reviews: ok([{ pr: 885, ok: false, pending: true, reason }]) });
  t.after(() => dom.restore());
  const footer = footerOf(dom, 881);
  assert.equal(footer.textContent, 'PR #885 · verdict not read yet');
  assert.ok(footer.getAttribute('title').includes(reason));
  assert.doesNotMatch(footer.textContent + footer.getAttribute('title'), /unreadable/);
});

test('#1312 D150: the Reviews view calls a queued thread "not read yet", and counts it apart from the unreadable', async (t) => {
  const { dom } = await boot({
    prs: ok([pr(885, 881, 'feat/issue-881-x'), pr(886, 1001, 'feat/issue-1001-y')]),
    reviews: ok([{ pr: 885, ok: false, pending: true, reason: 'queued' }, { pr: 886, ok: false, reason: 'HTTP 502' }]),
  });
  t.after(() => dom.restore());
  fire(find(dom.mounts.modes, (x) => x.tagName === 'BUTTON' && /governance/i.test(x.textContent)), 'click');
  await settle();
  fire(find(dom.mounts['governance-nav'], (x) => x.tagName === 'BUTTON' && /verdict queue/i.test(x.textContent)), 'click');
  await settle();
  const text = all(dom.mounts.canvas).map((n) => n.textContent ?? '').join('\n');
  assert.match(text, /1 not read yet, 1 unreadable/);
  assert.match(text, /not read yet: queued/);
  assert.match(text, /could not be read: HTTP 502/);
});
