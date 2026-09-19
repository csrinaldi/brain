// size-exception-parity.test.mjs — the gate and the reviewer answer the same
// question the same way (#1072).
//
// WHY THIS FILE EXISTS. Measured on PR #1067: the `diff-size` CI gate passed
// at 3,101 lines because `size:exception` was present and `lite` carries
// `honorSizeException: true`, and the cold reviewer emitted `budget /
// blocker` on the same number eight seconds later, because
// `review/evaluators/tranche.mjs` read `tierParams(tier).diffBudget` and never
// read the label. One field of a frozen params object used, its sibling
// ignored.
//
// The maintainer's ruling was that the reviewer honors the label as the gate
// does. Both now call `sizeExceptionRuling`, but calling the same function is
// not the same as AGREEING: either side could grow a branch that overrides it.
// This file drives BOTH authorities with the same inputs and fails if their
// answers diverge — which is the acceptance #1072 asked for, and the only
// test that would have caught the original defect.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runCheck } from './run-check.mjs';
import { evaluateTranche } from '../review/evaluators/tranche.mjs';
import { TIERS, tierParams } from '../vcs/governance-tiers.mjs';
import { REQUIRED_JOBS } from '../vcs/governance-checks.mjs';

const greenRollup = () => REQUIRED_JOBS.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

/** A numstat whose counted total is `lines`, in one file the ignore list never names. */
const numstatOf = (lines) => `${lines}\t0\tsrc/big.mjs`;

/** Does the CI gate let this through? */
async function gateBlocks({ labels, tier, lines }) {
  const result = await runCheck('diff-size', {
    ctx: { labels, baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => numstatOf(lines),
    readConfig: () => ({ governance: { tier } }),
  });
  return result.pass !== true;
}

/** Does the cold reviewer block on it? */
function reviewerBlocks({ labels, tier, lines }) {
  const result = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: ['src/big.mjs'],
    budget: { lines, uncomputable: false, baseSha: 'BASE', headSha: 'HEAD' },
    diffBudget: tierParams(tier).diffBudget,
    tier,
    labels,
  });
  return result.findings.some((f) => f.id === 'budget' && f.severity === 'blocker');
}

test('#1072: for every tier, with and without the label, the gate and the reviewer agree', async () => {
  for (const tier of TIERS) {
    const budget = tierParams(tier).diffBudget;
    const over = budget + 1;
    const under = budget - 1;

    for (const labels of [[], ['size:exception'], ['size:exception', 'type:feature']]) {
      for (const lines of [under, over]) {
        const gate = await gateBlocks({ labels, tier, lines });
        const reviewer = reviewerBlocks({ labels, tier, lines });
        assert.equal(reviewer, gate,
          `tier "${tier}", ${lines} lines against a budget of ${budget}, labels ${JSON.stringify(labels)}: ` +
          `the gate ${gate ? 'blocks' : 'passes'} and the reviewer ${reviewer ? 'blocks' : 'passes'} — ` +
          'a maintainer cannot act on two authorities that disagree about one number');
      }
    }
  }
});

test('#1072: the case that shipped — PR #1067, lite, 3101 lines, size:exception', async () => {
  const inputs = { labels: ['size:exception', 'type:feature'], tier: 'lite', lines: 3101 };
  assert.equal(await gateBlocks(inputs), false, 'the gate honored the label, as it did on #1067');
  assert.equal(reviewerBlocks(inputs), false, 'and the reviewer no longer contradicts it');
});

test('#1072: a tier that refuses the waiver refuses it on BOTH sides, and both say the tier refused', async () => {
  // `regulated` carries `honorSizeException: false`. The label being present
  // and refused is a different fact from no label at all (REQ-TIER-6), and
  // both authorities must produce that sentence rather than going quiet.
  assert.equal(tierParams('regulated').honorSizeException, false, 'the premise of this test');
  const inputs = { labels: ['size:exception'], tier: 'regulated', lines: tierParams('regulated').diffBudget + 1 };

  assert.equal(await gateBlocks(inputs), true);
  assert.equal(reviewerBlocks(inputs), true);

  const gate = await runCheck('diff-size', {
    ctx: { labels: inputs.labels, baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => numstatOf(inputs.lines),
    readConfig: () => ({ governance: { tier: 'regulated' } }),
  });
  const reviewer = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: [],
    budget: { lines: inputs.lines, uncomputable: false, baseSha: 'BASE', headSha: 'HEAD' },
    diffBudget: tierParams('regulated').diffBudget,
    tier: 'regulated',
    labels: inputs.labels,
  }).findings.find((f) => f.id === 'budget');

  assert.match(gate.reason, /not honored at the "regulated" tier/);
  assert.match(reviewer.evidence, /not honored at the "regulated" tier/,
    'the same sentence, so a reader is not left guessing why one authority said more than the other');
});
