// review-timeline.test.mjs — #998 R998-5: the reviews timeline and the
// verdict queue.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReviewTimeline } from './review-timeline.mjs';

const prs = (value) => ({ ok: true, value });
const reviews = (value) => ({ ok: true, value });

const finding = (severity, over = {}) => ({ id: 'F-1', severity, evidenceExcerpt: 'because', cites: null, file: null, line: null, ...over });

const verdict = (rev, verdictWord, over = {}) => ({
  pr: over.pr ?? 1, head_sha: 'abcdef0123', rev, verdict: verdictWord, author: 'bot',
  findings: [], findingCount: 0, malformed: [], ...over,
});

test('#998 R998-5: two rounds (REVISE then APPROVE), findings grouped bySeverity, oldest round first', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 1, ok: true, verdicts: [
      verdict(1, 'REVISE', { findings: [finding('blocker'), finding('minor')] }),
      verdict(2, 'APPROVE'),
    ], latest: null }]),
    prs([{ number: 1, title: 'the PR', headBranch: 'feat/x', issue: 998 }]),
  );
  assert.equal(t.ok, true);
  assert.equal(t.value.threads.length, 1);
  const thread = t.value.threads[0];
  assert.equal(thread.pr, 1);
  assert.equal(thread.issue, 998);
  assert.equal(thread.rounds.length, 2);
  assert.equal(thread.rounds[0].verdict, 'REVISE');
  assert.deepEqual(thread.rounds[0].bySeverity, { blocker: 1, minor: 1 });
  assert.equal(thread.rounds[1].verdict, 'APPROVE');
  assert.equal(thread.latest.verdict, 'APPROVE');
  assert.equal(thread.noRound, false);
});

test('#998 R998-5: a thread with no round is distinct from an unreadable one', () => {
  const t = buildReviewTimeline(
    reviews([]),
    prs([{ number: 2, title: 'no round yet', headBranch: 'feat/y', issue: 999 }]),
  );
  assert.equal(t.value.threads[0].noRound, true);
  assert.deepEqual(t.value.threads[0].rounds, []);
  assert.equal(t.value.threads[0].unreadable, undefined);
});

test('#998 R998-5: a finding with file/line gets source:{path,line}; one without gets a null source, never dropped', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 6, ok: true, verdicts: [verdict(1, 'REVISE', { pr: 6, findings: [
      finding('blocker', { file: 'brain/scripts/governance/run-check.mjs', line: 556 }),
      finding('correction'),
    ] })], latest: null }]),
    prs([{ number: 6, title: 'anchored', headBranch: 'feat/anchor', issue: 6 }]),
  );
  const [anchored, unanchored] = t.value.threads[0].rounds[0].findings;
  assert.deepEqual(anchored.source, { path: 'brain/scripts/governance/run-check.mjs', line: 556 });
  assert.equal(unanchored.source, null, 'no file/line — the source is null, never dropped from the finding');
});

test('#998 R998-5: an unreadable thread is a row with its reason, never a skip', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 3, ok: false, reason: 'gh exploded' }]),
    prs([{ number: 3, title: 'broken', headBranch: 'feat/z', issue: 997 }]),
  );
  assert.equal(t.value.threads.length, 1);
  assert.deepEqual(t.value.threads[0].unreadable, { reason: 'gh exploded' });
  assert.deepEqual(t.value.threads[0].rounds, []);
  assert.equal(t.value.threads[0].noRound, false);
});

test('#998 R998-5: an unknown severity is kept verbatim in bySeverity, never dropped', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 4, ok: true, verdicts: [verdict(1, 'REVISE', { findings: [finding('galactic')] })], latest: null }]),
    prs([{ number: 4, title: 'weird severity', headBranch: 'feat/w', issue: 996 }]),
  );
  assert.deepEqual(t.value.threads[0].rounds[0].bySeverity, { galactic: 1 });
});

test('#998 R998-5: the queue holds exactly the no-round and REVISE-latest threads, oldest-PR first', () => {
  const t = buildReviewTimeline(
    reviews([
      { pr: 20, ok: true, verdicts: [verdict(1, 'REVISE', { pr: 20 })], latest: null },
      { pr: 10, ok: true, verdicts: [verdict(1, 'APPROVE', { pr: 10 })], latest: null },
      { pr: 30, ok: false, reason: 'unreadable' },
    ]),
    prs([
      { number: 20, title: 'revise', headBranch: 'feat/r', issue: 1 },
      { number: 10, title: 'approve', headBranch: 'feat/a', issue: 2 },
      { number: 5, title: 'no round', headBranch: 'feat/n', issue: 3 },
      { number: 30, title: 'unreadable', headBranch: 'feat/u', issue: 4 },
    ]),
  );
  assert.deepEqual(t.value.queue.map((q) => q.pr), [5, 20]);
  assert.equal(t.value.queue.find((q) => q.pr === 5).wait, 'no round posted');
  assert.equal(t.value.queue.find((q) => q.pr === 20).wait, 'abcdef0');
});

test('#1009 cold review finding 2: a REVISE-latest thread with an unparseable head_sha still enters the queue, saying "head not readable" — never silently excluded', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 40, ok: true, verdicts: [verdict(1, 'REVISE', { pr: 40, head_sha: null })], latest: null }]),
    prs([{ number: 40, title: 'unparseable head', headBranch: 'feat/badhead', issue: 40 }]),
  );
  assert.deepEqual(t.value.queue.map((q) => q.pr), [40], 'a REVISE-latest thread must be in the queue even when its head cannot be parsed');
  assert.equal(t.value.queue.find((q) => q.pr === 40).wait, 'head not readable');
});

test('#998 R998-5: threads are sorted by PR number, deterministic under input shuffle', () => {
  const a = buildReviewTimeline(
    reviews([{ pr: 9, ok: true, verdicts: [verdict(1, 'APPROVE', { pr: 9 })], latest: null }, { pr: 1, ok: true, verdicts: [], latest: null }]),
    prs([{ number: 9, title: 'b', headBranch: 'x', issue: 1 }, { number: 1, title: 'a', headBranch: 'y', issue: 2 }]),
  );
  const b = buildReviewTimeline(
    reviews([{ pr: 1, ok: true, verdicts: [], latest: null }, { pr: 9, ok: true, verdicts: [verdict(1, 'APPROVE', { pr: 9 })], latest: null }]),
    prs([{ number: 1, title: 'a', headBranch: 'y', issue: 2 }, { number: 9, title: 'b', headBranch: 'x', issue: 1 }]),
  );
  assert.deepEqual(a, b);
  assert.deepEqual(a.value.threads.map((t) => t.pr), [1, 9]);
});

test('#998 R998-5: a failed prs or reviews section is the timeline\'s own reason, never an empty timeline', () => {
  const failedPrs = buildReviewTimeline(reviews([]), { ok: false, reason: 'the PR list could not be read' });
  assert.deepEqual(failedPrs, { ok: false, reason: 'the PR list could not be read' });
  const failedReviews = buildReviewTimeline({ ok: false, reason: 'gh exploded' }, prs([]));
  assert.deepEqual(failedReviews, { ok: false, reason: 'gh exploded' });
});

test('#1009 cold review finding 1: a malformed findings block keeps its malformed keys and null findingCount on the shaped round, never dropped to {findings: [], bySeverity: {}}', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 7, ok: true, verdicts: [verdict(1, 'REVISE', { pr: 7, findings: [], findingCount: null, malformed: ['findings'] })], latest: null }]),
    prs([{ number: 7, title: 'malformed', headBranch: 'feat/malformed', issue: 7 }]),
  );
  const round = t.value.threads[0].rounds[0];
  assert.deepEqual(round.malformed, ['findings'], 'shapeRound must carry the verdict\'s malformed keys forward');
  assert.equal(round.findingCount, null, 'uncomputable, distinct from a verdict that declared zero findings');
  assert.deepEqual(round.findings, []);
  assert.deepEqual(round.bySeverity, {});
});

test('#998 R998-5: totals count threads, the queue, and unreadable threads', () => {
  const t = buildReviewTimeline(
    reviews([{ pr: 1, ok: true, verdicts: [verdict(1, 'REVISE', { pr: 1 })], latest: null }, { pr: 2, ok: false, reason: 'x' }]),
    prs([{ number: 1, title: 'a', headBranch: 'x', issue: 1 }, { number: 2, title: 'b', headBranch: 'y', issue: 2 }]),
  );
  assert.deepEqual(t.value.totals, { threads: 2, queue: 1, unreadable: 1 });
});
