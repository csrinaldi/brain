// stranded.test.mjs — issue #323 S5 (#713): health and silence stop being the
// same reading. PURE core: lists in, verdict out — the CLI half reads git and
// the VCS adapter, never a bare gh call (ADR-0008).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { strandedTrackers, gatherStranded } from './stranded.mjs';

test('#713: a feature/* branch ahead with no open PR carrying it is STRANDED', () => {
  const out = strandedTrackers({
    branches: [
      { name: 'feature/issue-701', aheadOfDefault: 11 },
      { name: 'feature/issue-682', aheadOfDefault: 3 },
    ],
    openPrHeads: ['feature/issue-682'],
  });
  assert.deepEqual(out, [{ name: 'feature/issue-701', aheadOfDefault: 11 }],
    'eleven commits, every gate green, and until now nothing anywhere said the chain did not land');
});

test('#713: only feature/* trackers count — the maintainer\'s ruling; WIP task branches are not chains', () => {
  const out = strandedTrackers({
    branches: [
      { name: 'fix/issue-999-wip', aheadOfDefault: 2 },
      { name: 'feature/issue-1', aheadOfDefault: 1 },
    ],
    openPrHeads: [],
  });
  assert.deepEqual(out.map((b) => b.name), ['feature/issue-1']);
});

test('#713: zero ahead is not stranded — a merged tracker at rest is health, not silence', () => {
  const out = strandedTrackers({ branches: [{ name: 'feature/done', aheadOfDefault: 0 }], openPrHeads: [] });
  assert.deepEqual(out, []);
});

test('#713: the answer REPORTS, never throws — refusing would fail closed on chains in flight', () => {
  assert.deepEqual(strandedTrackers({}), []);
  assert.deepEqual(strandedTrackers({ branches: null, openPrHeads: null }), []);
});

test('#713: gatherStranded degrades IN BAND — a dead adapter takes the section, never the report', async () => {
  const out = await gatherStranded({ vcs: { mrList: async () => { throw new Error('forge down'); } }, project: 'o/r',
    _run: () => "'feature/issue-701'\n" });
  assert.deepEqual(out.stranded, []);
  assert.match(out.reason, /forge down/);
});

test('#713: end to end with seams — the #701 shape reports, the in-flight chain does not', async () => {
  const out = await gatherStranded({
    vcs: { mrList: async () => [{ headRefName: 'feature/issue-682' }] }, project: 'o/r',
    _run: (cmd) => cmd.includes('for-each-ref') ? "'feature/issue-701'\n'feature/issue-682'\n" : '11\n',
  });
  assert.deepEqual(out.stranded.map((b) => b.name), ['feature/issue-701']);
  assert.equal(out.reason, null);
});
