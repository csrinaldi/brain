// board.test.mjs — Unit tests for REQ-H1-13: rebuild seq:*/reviewed:* from
// the brain-review/1 verdict blocks (protocol §9 — verdicts are truth,
// labels are the derived index). No test spawns a real gh/glab process —
// every I/O seam is injected. Reconciliation is proven to stay strictly
// within the seq:*/reviewed:* namespaces and to route every add/remove
// through the deny-set's guardedLabelAdd/guardedLabelRemove chokepoints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  reviewedLabelForVerdict,
  reconcileBoardLabels,
  reconcileOnePr,
  runBoard,
} from './board.mjs';

// ── reviewedLabelForVerdict (pure) ──────────────────────────────────────────

test('reviewedLabelForVerdict: APPROVE -> reviewed:approved (the spec.md REQ-H1-13 example)', () => {
  assert.equal(reviewedLabelForVerdict('APPROVE'), 'reviewed:approved');
});

test('reviewedLabelForVerdict: REVISE -> reviewed:revised, STOP -> reviewed:stopped', () => {
  assert.equal(reviewedLabelForVerdict('REVISE'), 'reviewed:revised');
  assert.equal(reviewedLabelForVerdict('STOP'), 'reviewed:stopped');
});

test('reviewedLabelForVerdict: an unrecognized verdict scalar returns null, never throws', () => {
  assert.equal(reviewedLabelForVerdict('BOGUS'), null);
  assert.equal(reviewedLabelForVerdict(undefined), null);
});

// ── reconcileBoardLabels (pure) — the desync-rebuild core ───────────────────

test('reconcileBoardLabels: a desynced label is rebuilt from the verdict (spec.md REQ-H1-13 scenario) — missing reviewed:approved is added', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({
    latestVerdict: { head_sha: 'a', verdict: 'APPROVE', rev: 1, author: 'brain-reviewer' },
    currentLabels: [],
  });
  assert.deepEqual(toAdd, ['reviewed:approved']);
  assert.deepEqual(toRemove, []);
});

test('reconcileBoardLabels: already in sync — no add, no remove', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({
    latestVerdict: { head_sha: 'a', verdict: 'APPROVE', rev: 1, author: 'brain-reviewer' },
    currentLabels: ['reviewed:approved'],
  });
  assert.deepEqual(toAdd, []);
  assert.deepEqual(toRemove, []);
});

test('reconcileBoardLabels: a STALE reviewed:* label (from an earlier verdict) is removed while the current one is added', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({
    latestVerdict: { head_sha: 'b', verdict: 'APPROVE', rev: 2, author: 'brain-reviewer' },
    currentLabels: ['reviewed:revised'],
  });
  assert.deepEqual(toAdd, ['reviewed:approved']);
  assert.deepEqual(toRemove, ['reviewed:revised']);
});

test('reconcileBoardLabels: labels OUTSIDE seq:*/reviewed:* are never touched, even when not "desired"', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({
    latestVerdict: { head_sha: 'a', verdict: 'APPROVE', rev: 0, author: 'brain-reviewer' },
    currentLabels: ['decision', 'status:approved', 'needs-ruling'],
  });
  assert.deepEqual(toAdd, ['reviewed:approved']);
  assert.deepEqual(toRemove, [], 'decision/status:approved/needs-ruling are outside the board namespace — never removed');
});

test('reconcileBoardLabels: no latest verdict (empty thread) -> no-op, never throws', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({ latestVerdict: null, currentLabels: ['reviewed:approved'] });
  assert.deepEqual(toAdd, []);
  assert.deepEqual(toRemove, []);
});

test('reconcileBoardLabels: sequencing (when the verdict block carries it) contributes seq:* labels to reconcile', () => {
  const { toAdd, toRemove } = reconcileBoardLabels({
    latestVerdict: { head_sha: 'a', verdict: 'APPROVE', rev: 0, author: 'x', sequencing: ['seq:merge-next'] },
    currentLabels: ['seq:blocked-by-#5'],
  });
  assert.deepEqual(toAdd.sort(), ['reviewed:approved', 'seq:merge-next'].sort());
  assert.deepEqual(toRemove, ['seq:blocked-by-#5']);
});

// ── reconcileOnePr: composes fetchPr + fetchReviews, reconciles via the deny-set ─

function fixtureReview(verdict, headSha = 'a', rev = 0) {
  return {
    state: 'COMMENTED',
    author: 'brain-reviewer',
    body: `\`\`\`yaml\nprotocol: brain-review/1\nverdict: ${verdict}\nhead_sha: ${headSha}\nrev: ${rev}\n\`\`\``,
  };
}

test('reconcileOnePr: takes the LATEST verdict on the thread (last review wins), applies via guardedLabelAdd', async () => {
  const labelAddCalls = [];
  const vcs = {
    labelAdd: async ({ labels }) => { labelAddCalls.push(labels); return { ok: true }; },
    labelRemove: async () => { throw new Error('must not be called — nothing to remove'); },
  };
  const result = await reconcileOnePr({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    deps: {
      fetchPr: async () => ({ number: 42, labels: [] }),
      fetchReviews: async () => [fixtureReview('REVISE', 'a', 0), fixtureReview('APPROVE', 'a', 1)],
      getVcs: async () => vcs,
    },
  });
  assert.deepEqual(labelAddCalls, [['reviewed:approved']]);
  assert.deepEqual(result, { number: 42, toAdd: ['reviewed:approved'], toRemove: [] });
});

test('reconcileOnePr: already-synced PR makes ZERO vcs calls (no add, no remove)', async () => {
  const vcs = {
    labelAdd: async () => { throw new Error('must not be called — already synced'); },
    labelRemove: async () => { throw new Error('must not be called — already synced'); },
  };
  const result = await reconcileOnePr({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    deps: {
      fetchPr: async () => ({ number: 42, labels: ['reviewed:approved'] }),
      fetchReviews: async () => [fixtureReview('APPROVE')],
      getVcs: async () => vcs,
    },
  });
  assert.deepEqual(result, { number: 42, toAdd: [], toRemove: [] });
});

test('reconcileOnePr: a desync calls BOTH guardedLabelAdd and guardedLabelRemove through the real deny-set (removal stays inside seq:*/reviewed:*)', async () => {
  const calls = { labelAdd: [], labelRemove: [] };
  const vcs = {
    labelAdd: async ({ labels }) => { calls.labelAdd.push(labels); return { ok: true }; },
    labelRemove: async ({ labels }) => { calls.labelRemove.push(labels); return { ok: true }; },
  };
  await reconcileOnePr({
    project: 'csrinaldi/brain',
    number: 7,
    provider: 'github',
    deps: {
      fetchPr: async () => ({ number: 7, labels: ['reviewed:revised', 'decision'] }),
      fetchReviews: async () => [fixtureReview('APPROVE')],
      getVcs: async () => vcs,
    },
  });
  assert.deepEqual(calls.labelAdd, [['reviewed:approved']]);
  assert.deepEqual(calls.labelRemove, [['reviewed:revised']], 'decision is outside the board namespace — never sent to labelRemove');
});

test('reconcileOnePr: a thread with no verdict blocks at all -> no-op, zero vcs calls', async () => {
  const vcs = {
    labelAdd: async () => { throw new Error('must not be called'); },
    labelRemove: async () => { throw new Error('must not be called'); },
  };
  const result = await reconcileOnePr({
    project: 'csrinaldi/brain',
    number: 9,
    provider: 'github',
    deps: {
      fetchPr: async () => ({ number: 9, labels: [] }),
      fetchReviews: async () => [{ state: 'COMMENTED', author: 'bob', body: 'just a plain human comment' }],
      getVcs: async () => vcs,
    },
  });
  assert.deepEqual(result, { number: 9, toAdd: [], toRemove: [] });
});

// ── runBoard: composes listOpenPrs + reconciles each PR ─────────────────────

test('runBoard: composes listOpenPrs (mrList) with reconcileOnePr for every open PR', async () => {
  const seenNumbers = [];
  const vcs = { labelAdd: async () => ({ ok: true }), labelRemove: async () => ({ ok: true }) };
  const results = await runBoard({
    project: 'csrinaldi/brain',
    provider: 'github',
    deps: {
      listOpenPrs: async () => [{ number: 3 }, { number: 11 }],
      fetchPr: async ({ number }) => { seenNumbers.push(number); return { number, labels: [] }; },
      fetchReviews: async () => [fixtureReview('APPROVE')],
      getVcs: async () => vcs,
    },
  });
  assert.deepEqual(seenNumbers, [3, 11]);
  assert.deepEqual(results.map(r => r.number), [3, 11]);
});

test('runBoard: an empty open-PR list returns an empty result, no per-PR fetch happens', async () => {
  const results = await runBoard({
    project: 'csrinaldi/brain',
    provider: 'github',
    deps: {
      listOpenPrs: async () => [],
      fetchPr: async () => { throw new Error('must not be called'); },
      fetchReviews: async () => { throw new Error('must not be called'); },
    },
  });
  assert.deepEqual(results, []);
});

// ── deny-set fold: board.mjs never calls vcs.labelAdd/labelRemove bare ──────

test('board.mjs source routes every add/remove through guardedLabelAdd/guardedLabelRemove, never a bare vcs.labelAdd/labelRemove', () => {
  const src = readFileSync(fileURLToPath(new URL('./board.mjs', import.meta.url)), 'utf8');
  assert.match(src, /guardedLabelAdd/);
  assert.match(src, /guardedLabelRemove/);
  assert.doesNotMatch(src, /\bvcs\.labelAdd\(/);
  assert.doesNotMatch(src, /\bvcs\.labelRemove\(/);
});
