// metrics-aggregate.test.mjs — pure per-period aggregation for brain-metrics
// (issue #324/M9, design D3/D5/D6). Feeds already-evaluated merge descriptors
// (as brain-metrics.mjs builds them from lib/merge-walk.mjs's evaluateMerge())
// through the aggregator — no git/VCS I/O in this file, by construction.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMerge } from './merge-walk.mjs';
import {
  PER_PERIOD_GATES, foldMerge, finalizeRows, emptyRows,
} from './metrics-aggregate.mjs';

// A minimal fake `resolutionGit` — evaluateMerge only calls it when a
// tree-keyed failure survives AND needs the reverter-exemption predicates
// (addedPathsAbsentAt / netAddFull / revertResurrectsAt). These fixtures are
// testing AGGREGATION math, not exemption logic (already covered by
// brain-audit.test.mjs's fixture-based contract tests) — so the stub reports
// "the added path is still present at tip", which makes `addedPathsAbsentAt`
// return `false` and short-circuits `exempt` to `false` WITHOUT ever calling
// `netAddFull` (real git plumbing the stub does not need to emulate).
function fakeGit() {
  return {
    orThrow: (argv) => {
      if (argv.includes('--diff-filter=AM')) return 'src/big.mjs\0'; // addedPathsAbsentAt's added-paths query
      if (argv[0] === 'ls-tree') return 'src/big.mjs\0'; // present at tip → addedPathsAbsentAt() === false
      return ''; // revertResurrectsAt's AMD diff — empty → resurrects:false → nominable:true
    },
  };
}

function evalPass() {
  return evaluateMerge('deadbeef', {
    numstat: '1\t1\tsrc/small.mjs',
    changedFiles: ['src/small.mjs'],
    issueLinkBody: 'Closes #1',
    prLabels: [],
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: fakeGit(),
    windowFrom: 'deadbeef',
    windowTo: 'HEAD',
  });
}

function evalDiffSizeFail({ prLabels = [] } = {}) {
  const bigNumstat = Array.from({ length: 500 }, (_, i) => `${i}\t0\tf${i}.mjs`).join('\n');
  return evaluateMerge('deadbeef', {
    numstat: bigNumstat,
    changedFiles: ['src/big.mjs'],
    issueLinkBody: 'Closes #1',
    prLabels,
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: fakeGit(),
    windowFrom: 'deadbeef',
    windowTo: 'HEAD',
  });
}

function evalIssueLinkFail() {
  return evaluateMerge('deadbeef', {
    numstat: '1\t1\tsrc/small.mjs',
    changedFiles: ['src/small.mjs'],
    issueLinkBody: 'no issue reference here',
    prLabels: [],
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: fakeGit(),
    windowFrom: 'deadbeef',
    windowTo: 'HEAD',
  });
}

function evalAdrFail({ prLabels = [] } = {}) {
  return evaluateMerge('deadbeef', {
    numstat: '1\t1\tbrain/HOME.md',
    changedFiles: ['brain/HOME.md'],
    issueLinkBody: 'Closes #1',
    prLabels,
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: fakeGit(),
    windowFrom: 'deadbeef',
    windowTo: 'HEAD',
  });
}

test('PER_PERIOD_GATES excludes memory-gate (design D3 — repo-global, not a per-period column)', () => {
  assert.deepEqual(PER_PERIOD_GATES, ['diff-size', 'issue-link', 'decision-gate']);
});

test('foldMerge: counts every merge toward changesMerged regardless of skip/fail/uncomputable status', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'a', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'b', mergedAt: '2026-07-06T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'resolved-skip', evalRec: null, detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'c', mergedAt: '2026-07-07T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'uncomputable', evalRec: null, detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].changesMerged, 3);
  assert.equal(out[0].uncomputable, 1);
});

test('raw vs. enforced diverge when size:exception exists (spec scenario)', () => {
  let rows = emptyRows();
  // Offender WITHOUT size:exception — raw fail AND enforced fail.
  rows = foldMerge(rows, {
    sha: 'o1', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail(), detection: null, period: 'month',
  });
  // Offender WITH size:exception — raw fail but enforced excludes it.
  rows = foldMerge(rows, {
    sha: 'o2', mergedAt: '2026-07-06T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out[0].gates['diff-size'].raw, 2, 'raw includes BOTH failures, exception or not');
  assert.equal(out[0].gates['diff-size'].enforced, 1, 'enforced excludes the size:exception-labeled failure');
});

test('issue-link failures are never exempted — raw === enforced always', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'i1', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalIssueLinkFail(), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out[0].gates['issue-link'].raw, 1);
  assert.equal(out[0].gates['issue-link'].enforced, 1);
});

test('decision-gate (adrPresence) counts are label-conditional — only PRs labeled "decision" contribute', () => {
  let rows = emptyRows();
  // Fails adrPresence, but the PR carries NO "decision" label — excluded.
  rows = foldMerge(rows, {
    sha: 'd1', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalAdrFail(), detection: null, period: 'month',
  });
  // Fails adrPresence AND carries the "decision" label — included.
  rows = foldMerge(rows, {
    sha: 'd2', mergedAt: '2026-07-06T00:00:00Z', prLabels: ['decision'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalAdrFail({ prLabels: ['decision'] }), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out[0].gates['decision-gate'].raw, 1, 'only the "decision"-labeled PR counts');
  assert.equal(out[0].gates['decision-gate'].enforced, 1);
});

test('median lead time is computed per period; "N/A" (null) when no merge in the period has a lead time', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'l1', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: 2,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'l2', mergedAt: '2026-07-06T00:00:00Z', prLabels: [], leadTimeDays: 4,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'l3', mergedAt: '2026-07-07T00:00:00Z', prLabels: [], leadTimeDays: 6,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out[0].medianLeadTimeDays, 4);

  let emptyLeadRows = emptyRows();
  emptyLeadRows = foldMerge(emptyLeadRows, {
    sha: 'l4', mergedAt: '2026-08-01T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  const out2 = finalizeRows(emptyLeadRows);
  assert.equal(out2[0].medianLeadTimeDays, null);
});

test('bypass usage counts size:exception and skip:memory-gate as RAW label usage, never subtracted from each other', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'b1', mergedAt: '2026-07-05T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'b2', mergedAt: '2026-07-06T00:00:00Z', prLabels: ['skip:memory-gate'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.equal(out[0].bypass.sizeException, 1);
  assert.equal(out[0].bypass.skipMemoryGate, 1);
});

test('bypass usage is visible across weekly buckets (H3 — a rising trend must be observable)', () => {
  let rows = emptyRows();
  const weeks = ['2026-07-06T00:00:00Z', '2026-07-06T00:00:00Z', '2026-07-13T00:00:00Z'];
  weeks.forEach((mergedAt, i) => {
    rows = foldMerge(rows, {
      sha: `w${i}`, mergedAt, prLabels: ['size:exception'], leadTimeDays: null,
      kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'week',
    });
  });
  const out = finalizeRows(rows);
  assert.equal(out.length, 2, 'two distinct weekly buckets');
  const byPeriod = Object.fromEntries(out.map((r) => [r.period, r.bypass.sizeException]));
  assert.equal(byPeriod['2026-W28'], 2);
  assert.equal(byPeriod['2026-W29'], 1);
});

test('bypass usage tracks size:exception usage by author, per period (spec "by author" breakdown)', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'a1', mergedAt: '2026-07-05T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: 'alice',
  });
  rows = foldMerge(rows, {
    sha: 'a2', mergedAt: '2026-07-06T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: 'alice',
  });
  rows = foldMerge(rows, {
    sha: 'a3', mergedAt: '2026-07-10T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: 'bob',
  });
  const out = finalizeRows(rows);
  assert.deepEqual(out[0].bypassByAuthor, { alice: 2, bob: 1 });
});

test('bypass usage by author falls back to "unknown" when the exception author cannot be resolved (never dropped)', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'u1', mergedAt: '2026-07-05T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: null,
  });
  const out = finalizeRows(rows);
  assert.deepEqual(out[0].bypassByAuthor, { unknown: 1 });
});

test('bypass usage by author is per-period, distinct from the overall sizeException count', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'p1', mergedAt: '2026-07-05T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: 'alice',
  });
  rows = foldMerge(rows, {
    sha: 'p2', mergedAt: '2026-08-05T00:00:00Z', prLabels: ['size:exception'], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalDiffSizeFail({ prLabels: ['size:exception'] }), detection: null, period: 'month',
    exceptionAuthor: 'alice',
  });
  const out = finalizeRows(rows);
  const julyRow = out.find((r) => r.period === '2026-07');
  const augRow = out.find((r) => r.period === '2026-08');
  assert.deepEqual(julyRow.bypassByAuthor, { alice: 1 });
  assert.deepEqual(augRow.bypassByAuthor, { alice: 1 });
  assert.equal(julyRow.bypass.sizeException, 1);
  assert.equal(augRow.bypass.sizeException, 1);
});

test('detection jobs render as a single pass/fail count column, no raw/enforced split (D6)', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'p1', mergedAt: '2026-07-05T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(),
    detection: { 'phase-order': 'pass', 'actor-check': 'fail', 'brain-writes-reviewed': null },
    period: 'month',
  });
  const out = finalizeRows(rows);
  assert.deepEqual(out[0].detection['phase-order'], { pass: 1, fail: 0 });
  assert.deepEqual(out[0].detection['actor-check'], { pass: 0, fail: 1 });
  assert.deepEqual(out[0].detection['brain-writes-reviewed'], { pass: 0, fail: 0 });
});

test('rows are sorted chronologically by period key', () => {
  let rows = emptyRows();
  rows = foldMerge(rows, {
    sha: 'z', mergedAt: '2026-09-01T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  rows = foldMerge(rows, {
    sha: 'a', mergedAt: '2026-07-01T00:00:00Z', prLabels: [], leadTimeDays: null,
    kind: 'evaluated', evalRec: evalPass(), detection: null, period: 'month',
  });
  const out = finalizeRows(rows);
  assert.deepEqual(out.map((r) => r.period), ['2026-07', '2026-09']);
});
