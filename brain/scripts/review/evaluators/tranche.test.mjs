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

test('evaluateTranche: actor-check (promoted to required in issue #358 Q5 Phase 5) failing is a BLOCKER, never editorial', () => {
  const rollup = greenRollup().map(g => (g.name === 'actor-check' ? { ...g, status: 'COMPLETED', conclusion: 'FAILURE' } : g));
  const result = evaluateTranche({ requiredGates: rollup, changedFiles: [], budget: { lines: 0, uncomputable: false } });
  const finding = result.findings.find(f => f.id === 'gate:actor-check');
  assert.ok(finding, 'expected a blocker finding for the now-required actor-check gate');
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /actor-check/);
  assert.match(finding.evidence, /FAILURE/);
  assert.equal(result.conclusion, 'REVISE');
});

// NOTE (issue #358 Q5 Phase 5): DETECTION_JOBS (governance-checks.mjs, derived
// from requiredJobs('standard')) is currently EMPTY — Phase 5 promoted
// phase-order/actor-check/brain-writes-reviewed, so every GOVERNANCE_JOBS
// gate is now required at the default 'standard' tier. The editorial-finding
// branch below (`detection:${name}`) is therefore presently unreachable via
// real gate data; it stays correct dead code for the day a future gate is
// staged through PENDING_PROMOTION again (governance-tiers.mjs).
test("evaluateTranche: DETECTION_JOBS is currently empty (Q5 Phase 5 promoted every gate to required at 'standard') — no editorial findings are produced", () => {
  assert.deepEqual(DETECTION_JOBS, []);
  const result = evaluateTranche({ requiredGates: greenRollup(), changedFiles: [], budget: { lines: 0, uncomputable: false } });
  assert.deepEqual(result.gates.detection, []);
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

// ── gatherTrancheInputs: tier-scoped job sets (issue #358 Q5 Phase 5 review finding 2) ──
//
// REQUIRED_JOBS/DETECTION_JOBS (governance-checks.mjs) are a 'standard'-tier
// snapshot — stale for any repo declaring a different tier. gatherTrancheInputs
// must resolve requiredJobs/detectionJobs from the repo's OWN declared tier,
// never fall back to the stale snapshot silently.

test('gatherTrancheInputs: deps.tier="lite" resolves requiredJobs/detectionJobs from the tier matrix — actor-check/brain-writes-reviewed stay required, memory-gate/phase-order demote to detection', async () => {
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: 'BASE',
    changedFiles: [],
    deps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => '',
      readIgnoreList: () => [],
      tier: 'lite',
    },
  });
  assert.equal(inputs.tier, 'lite');
  assert.deepEqual(inputs.detectionJobs, ['memory-gate', 'phase-order']);
  assert.ok(inputs.requiredJobs.includes('actor-check'));
  assert.ok(inputs.requiredJobs.includes('brain-writes-reviewed'));
  assert.ok(!inputs.requiredJobs.includes('phase-order'));
});

test('gatherTrancheInputs: deps.readConfig overrides the tier source (no deps.tier) — resolves through resolveTier', async () => {
  const inputs = await gatherTrancheInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    baseSha: 'BASE',
    changedFiles: [],
    deps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => '',
      readIgnoreList: () => [],
      readConfig: () => ({ governance: { tier: 'regulated' } }),
    },
  });
  assert.equal(inputs.tier, 'regulated');
  assert.deepEqual(inputs.detectionJobs, []);
});

test('evaluateTranche: fed lite-tier job sets, a red memory-gate is editorial (detection), never a blocker', () => {
  const rollup = greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const result = evaluateTranche({
    requiredGates: rollup,
    changedFiles: [],
    budget: { lines: 0, uncomputable: false },
    requiredJobs: ['issue-link', 'diff-size', 'local-checks', 'decision-gate', 'actor-check', 'brain-writes-reviewed'],
    detectionJobs: ['memory-gate', 'phase-order'],
  });
  const finding = result.findings.find(f => f.id === 'detection:memory-gate');
  assert.ok(finding, 'expected an editorial finding for memory-gate at the lite-tier detection policy');
  assert.equal(finding.severity, 'editorial');
  assert.equal(result.findings.some(f => f.id === 'gate:memory-gate'), false, 'memory-gate must not ALSO be counted as a blocker');
});
