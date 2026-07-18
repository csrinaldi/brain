// tranche.test.mjs — Unit tests for REQ-H1-8: the tranche evaluator (design.md
// §2, §4). No test spawns a real gh/git process — `evaluateTranche` is pure;
// `gatherTrancheInputs` injects `fetchRollup` / `diffNumstat` / `readIgnoreList`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTranche, gatherTrancheInputs } from './tranche.mjs';
import { REQUIRED_JOBS, DETECTION_JOBS } from '../../vcs/governance-checks.mjs';

function greenRollup() {
  return [
    ...REQUIRED_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    ...DETECTION_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
  ];
}

// ── evaluateTranche (pure core) ──────────────────────────────────────────────

test('evaluateTranche: all required gates green, budget within limit → APPROVE, no findings', () => {
  const result = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: ['brain/scripts/review/evaluators/tranche.mjs'],
    budget: { lines: 120, uncomputable: false, baseSha: 'BASE', headSha: 'HEAD' },
    prBody: 'Adds the tranche evaluator.',
  });
  assert.equal(result.conclusion, 'APPROVE');
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.gates.required, REQUIRED_JOBS);
});

test('evaluateTranche: a required gate is not success → blocker finding with evidence + cites', () => {
  const rollup = greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const result = evaluateTranche({ requiredGates: rollup, changedFiles: [], budget: { lines: 0, uncomputable: false } });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'gate:memory-gate');
  assert.ok(finding, 'expected a finding for the failing required gate');
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /memory-gate/);
  assert.match(finding.evidence, /FAILURE/);
  assert.ok(finding.cites, 'a blocker finding MUST carry cites (protocol §6)');
});

test('evaluateTranche: a required gate absent from the rollup entirely → blocker finding', () => {
  const rollup = greenRollup().filter(g => g.name !== 'decision-gate');
  const result = evaluateTranche({ requiredGates: rollup, changedFiles: [], budget: { lines: 0, uncomputable: false } });
  const finding = result.findings.find(f => f.id === 'gate:decision-gate');
  assert.ok(finding);
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /not present in rollup/);
});

test('evaluateTranche: null (uncomputable) rollup → REVISE, conditions include "evidence uncomputable", never APPROVE', () => {
  const result = evaluateTranche({ requiredGates: null, changedFiles: [], budget: { lines: 0, uncomputable: false } });
  assert.equal(result.conclusion, 'REVISE');
  assert.ok(result.conditions.includes('evidence uncomputable'));
  assert.deepEqual(result.findings, []);
});

test('evaluateTranche: budget uncomputable (no baseSha resolvable) → fail-closed REVISE, never APPROVE', () => {
  const result = evaluateTranche({ requiredGates: greenRollup(), changedFiles: [], budget: { uncomputable: true } });
  assert.equal(result.conclusion, 'REVISE');
  assert.ok(result.conditions.some(c => /evidence uncomputable/.test(c)));
});

test('evaluateTranche: budget re-derived over 400 lines → blocker finding quoting the diff command, even if a report would have claimed less', () => {
  const result = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: [],
    budget: { lines: 610, uncomputable: false, baseSha: 'BASE', headSha: 'HEAD' },
  });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'budget');
  assert.ok(finding);
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /git diff --numstat/);
  assert.match(finding.evidence, /610/);
});

test('evaluateTranche: a detection-job warn is surfaced verbatim as an editorial finding, never a blocker', () => {
  const rollup = greenRollup().map(g => (g.name === 'actor-check' ? { ...g, status: 'COMPLETED', conclusion: 'FAILURE' } : g));
  const result = evaluateTranche({ requiredGates: rollup, changedFiles: [], budget: { lines: 0, uncomputable: false } });
  const finding = result.findings.find(f => f.id === 'detection:actor-check');
  assert.ok(finding, 'expected the detection-job warn to be surfaced');
  assert.equal(finding.severity, 'editorial');
  assert.match(finding.evidence, /actor-check/);
  assert.match(finding.evidence, /FAILURE/);
  // still allowed to APPROVE overall — a detection warn is not a blocker.
  assert.equal(result.conclusion, 'APPROVE');
});

test('evaluateTranche: an agent-authored write to the Tier-2 frontier is flagged', () => {
  const result = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: ['brain/core/methodology/reviewer-protocol.md', 'brain/scripts/review/evaluators/tranche.mjs'],
    budget: { lines: 10, uncomputable: false },
  });
  const finding = result.findings.find(f => f.id === 'tier2-frontier');
  assert.ok(finding);
  assert.match(finding.evidence, /brain\/core\/methodology\/reviewer-protocol\.md/);
});

test('evaluateTranche: an AI-attribution trailer in the PR body is flagged', () => {
  const result = evaluateTranche({
    requiredGates: greenRollup(),
    changedFiles: [],
    budget: { lines: 10, uncomputable: false },
    prBody: 'Fixes the bug.\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
  });
  const finding = result.findings.find(f => f.id === 'ai-attribution');
  assert.ok(finding);
  assert.equal(finding.severity, 'editorial');
});

// ── gatherTrancheInputs (DI-seam) ────────────────────────────────────────────

test('gatherTrancheInputs: wires the rollup via the injected fetchRollup seam, never touches the network', async () => {
  let called = 0;
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: 'BASE',
    changedFiles: ['a.mjs'],
    prBody: 'x',
    deps: {
      fetchRollup: async () => { called++; return greenRollup(); },
      diffNumstat: () => '10\t5\ta.mjs\n',
      readIgnoreList: () => [],
    },
  });
  assert.equal(called, 1);
  assert.equal(inputs.budget.lines, 15);
  assert.equal(inputs.budget.uncomputable, false);
});

test('gatherTrancheInputs: absent baseSha → budget is uncomputable, diffNumstat is never invoked', async () => {
  let diffCalled = false;
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: null,
    changedFiles: [],
    deps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => { diffCalled = true; return ''; },
    },
  });
  assert.equal(inputs.budget.uncomputable, true);
  assert.equal(diffCalled, false);
});

test('gatherTrancheInputs: fetchRollup returning null propagates as the uncomputable rollup', async () => {
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: 'BASE',
    changedFiles: [],
    deps: {
      fetchRollup: async () => null,
      diffNumstat: () => '',
      readIgnoreList: () => [],
    },
  });
  assert.equal(inputs.requiredGates, null);
});

test('gatherTrancheInputs: ignoreList from readIgnoreList excludes matched paths from the budget count', async () => {
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: 'BASE',
    changedFiles: [],
    deps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => '100\t0\tfoo.test.mjs\n5\t0\tbar.mjs\n',
      readIgnoreList: () => ['**/*.test.mjs'],
    },
  });
  assert.equal(inputs.budget.lines, 5);
});
