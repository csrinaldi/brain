// card-review-model.test.mjs — #1312: the footer a lane card carries for its joined open PR. Fixtures are built by
// the real `reviewRows`, so the verdict shapes are the ones the snapshot serves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { reviewRows } from '../../status/snapshot.mjs';
import { cardReviewIndex } from './card-review-model.mjs';

const A = 'a1b2c3d'.padEnd(40, '0');
const B = 'e4f5a6b'.padEnd(40, '0');
const BRANCH = 'feat/issue-881-x';
const ok = (value) => ({ ok: true, value });
const body = (sha, rev, word) => `Round ${rev}\n\n\`\`\`yaml\nprotocol: brain-review/2\nhead_sha: ${sha}\nrev: ${rev}\nverdict: ${word}\nfindings: []\n\`\`\`\n`;
const thread = (pr, ...verdicts) => reviewRows(pr, verdicts.map(([sha, rev, word]) => ({ body: body(sha, rev, word), author: 'bot' })));
const pr = (number, over = {}) => ({ number, issue: 881, title: `pr ${number}`, headBranch: BRANCH, ...over });
const remote = (branches) => ok({ branches, unjoined: [], deferred: 0 });
const branch = (sha, over = {}) => ({ branch: BRANCH, sha, issue: 881, pr: null, ...over });
const footer = (inputs, issue = 881) => cardReviewIndex(inputs).byIssue.get(issue);
const base = () => ({ prs: ok([pr(885)]), reviews: ok([thread(885, [A, 1, 'APPROVE'], [A, 2, 'REVISE'])]), remoteChanges: null });

test('#1312 S1: the footer names the PR, the verdict word and rev of the LAST verdict, and the head it judged', () => {
  const f = footer(base());
  assert.equal(f.text, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)}`);
  assert.equal(f.pr, 885);
  assert.equal(f.more, null);
  assert.doesNotMatch(f.text, /tasks/i, 'R1312-8: no tasks count');
});

test('#1312 S1: an issue with no joined PR has no footer, and show is true once prs is readable', () => {
  const idx = cardReviewIndex(base());
  assert.equal(idx.show, true);
  assert.equal(idx.byIssue.has(882), false);
  assert.equal(cardReviewIndex({ ...base(), prs: ok([pr(885, { issue: null })]) }).byIssue.size, 0);
});

test('#1312 S2: a readable thread with no verdict says so and shows no verdict word', () => {
  const f = footer({ ...base(), reviews: ok([thread(885)]) });
  assert.equal(f.text, 'PR #885 · no verdict posted');
  assert.equal(f.verdict, null);
});

test('#1312 S3: an unreadable thread says so, and the reason is the title', () => {
  const f = footer({ ...base(), reviews: ok([{ pr: 885, ok: false, reason: 'HTTP 502' }]) });
  assert.equal(f.text, 'PR #885 · review thread unreadable');
  assert.match(f.title, /HTTP 502/);
  assert.equal(f.verdict, null);
});

test('#1312 S4 / D142: no matching branch names only the verdict head; the same SHA says tip here; a different SHA names both and never says stale', () => {
  assert.equal(footer(base()).text, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)}`);
  assert.equal(footer({ ...base(), remoteChanges: remote([branch(A, { branch: 'other' })]) }).head.tip, null, 'a branch with another name is no comparison');
  const same = footer({ ...base(), remoteChanges: remote([branch(A)]) });
  assert.equal(same.text, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)} · tip here`);
  assert.equal(same.head.tip, 'same');
  const differs = footer({ ...base(), remoteChanges: remote([branch(B)]) });
  assert.equal(differs.text, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)} · origin tip here ${B.slice(0, 7)}`);
  assert.equal(differs.head.tip, 'differs');
  for (const f of [same, differs]) assert.doesNotMatch(f.text + f.title, /stale|current/i);
  assert.ok(differs.title.includes(A) && differs.title.includes(B), 'the title carries both full SHAs');
  assert.match(differs.title, /last fetch/, 'the title says the tip is as of the last fetch');
  assert.match(differs.title, /forge/, 'and that the forge may differ');
});

test('#1312 S4: a remoteChanges section that is not readable makes no comparison', () => {
  const f = footer({ ...base(), remoteChanges: { ok: false, pending: true, reason: 'loading' } });
  assert.equal(f.head.tip, null);
  assert.equal(f.text, `PR #885 · rev 2 · REVISE · head ${A.slice(0, 7)}`);
});

test('#1312: a verdict whose head_sha is unreadable says the head is not readable', () => {
  const row = thread(885, [A, 1, 'REVISE']);
  row.verdicts[0].head_sha = null;
  assert.equal(footer({ ...base(), reviews: ok([row]) }).text, 'PR #885 · rev 1 · REVISE · head not readable');
});

test('#1312 S5 / R1312-6: while prs is pending, idle or failed no card has a footer', () => {
  for (const prs of [{ ok: false, pending: true, reason: 'loading' }, { ok: false, pending: true, idle: true, reason: 'paused' }, { ok: false, reason: 'offline' }, undefined]) {
    const idx = cardReviewIndex({ ...base(), prs });
    assert.equal(idx.show, false);
    assert.equal(idx.byIssue.size, 0);
  }
});

test('#1312 S6 / D145: prs read and reviews pending, idle or failed — the PR is named and no verdict is shown', () => {
  for (const reviews of [{ ok: false, pending: true, reason: 'loading' }, { ok: false, pending: true, idle: true, reason: 'paused' }]) {
    const f = footer({ ...base(), reviews });
    assert.equal(f.text, 'PR #885 · verdict not read yet');
    assert.equal(f.verdict, null);
  }
  const failed = footer({ ...base(), reviews: { ok: false, reason: 'HTTP 500' } });
  assert.equal(failed.text, 'PR #885 · verdicts could not be read');
  assert.match(failed.title, /HTTP 500/);
});

test('#1312 S7 / D143: several open PRs — the highest number is named and the rest are counted', () => {
  const inputs = { prs: ok([pr(910), pr(900), pr(905)]), reviews: ok([thread(900, [A, 1, 'APPROVE']), thread(910, [B, 3, 'REVISE']), thread(905)]), remoteChanges: null };
  const f = footer(inputs);
  assert.equal(f.pr, 910);
  assert.equal(f.text, `PR #910 · rev 3 · REVISE · head ${B.slice(0, 7)} · +2 open PRs`);
  assert.match(f.title, /#900/);
  assert.match(f.title, /#905/);
  assert.equal(footer({ ...inputs, prs: ok([pr(900), pr(910)]) }).text.endsWith('+1 open PR'), true);
});

test('#1312 S9: a verdict word outside the protocol enum is shown verbatim and marked unrecognised', () => {
  const f = footer({ ...base(), reviews: ok([thread(885, [A, 1, 'MAYBE'])]) });
  assert.equal(f.verdict.word, 'MAYBE');
  assert.equal(f.verdict.unknown, true);
  assert.match(f.text, /MAYBE \(unrecognised verdict\)/);
  assert.equal(footer(base()).verdict.unknown, false);
});

test('#1312 R1312-7 / D140: the verdict comes from buildReviewTimeline — this module reads no verdict list itself', () => {
  const src = readFileSync(fileURLToPath(new URL('./card-review-model.mjs', import.meta.url)), 'utf8');
  assert.match(src, /buildReviewTimeline\(/);
  assert.doesNotMatch(src, /\.verdicts\b|\.at\(-1\)|head_sha|parseVerdict|reviews\??\.value/, 'a second derivation of the latest verdict');
});

test('#1312 R1312-6 / D150: a thread never fetched (queued) reads "verdict not read yet", never unreadable, reason in the title', () => {
  const f = footer({ ...base(), reviews: ok([{ pr: 885, ok: false, pending: true, reason: "this PR's reviews have not been fetched yet (queued)" }]) });
  assert.equal(f.text, 'PR #885 · verdict not read yet');
  assert.doesNotMatch(f.text, /unreadable/);
  assert.match(f.title, /not been fetched yet \(queued\)/);
  assert.equal(f.verdict, null);
});
