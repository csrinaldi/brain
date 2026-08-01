// governance-tiers.test.mjs — Unit tests for the doctrine-tier resolver (issue
// #358 Q5, design.md §8). Run with: npm test (node --test)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TIERS,
  NEVER_TIERED,
  GATE_MATRIX,
  resolveTier,
  resolveGatePolicy,
  resolveGateEvidence,
  tierParams,
  requiredJobs,
  printDiffBudget,
} from './governance-tiers.mjs';
import { GOVERNANCE_JOBS } from './governance-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// ── TIERS / NEVER_TIERED shape ──────────────────────────────────────────────

test('TIERS is exactly the three ordinal values, lite < standard < regulated', () => {
  assert.deepEqual(TIERS, ['lite', 'standard', 'regulated']);
  assert.ok(Object.isFrozen(TIERS));
});

test('NEVER_TIERED enumerates the six REQ-TIER-2 gates', () => {
  assert.deepEqual(
    [...NEVER_TIERED].sort(),
    ['actor-check', 'brain-writes-reviewed', 'decision-gate', 'diff-size', 'issue-link', 'local-checks'].sort()
  );
});

// ── REQ-TIER-1 — monotonicity ────────────────────────────────────────────────

test('REQ-TIER-1: no gate is required at a lower tier and detection at a higher one', () => {
  for (const gate of Object.keys(GATE_MATRIX)) {
    const litePolicy = resolveGatePolicy(gate, 'lite');
    const standardPolicy = resolveGatePolicy(gate, 'standard');
    const regulatedPolicy = resolveGatePolicy(gate, 'regulated');

    if (litePolicy === 'required') {
      assert.equal(standardPolicy, 'required', `${gate}: required at lite but not standard`);
    }
    if (standardPolicy === 'required') {
      assert.equal(regulatedPolicy, 'required', `${gate}: required at standard but not regulated`);
    }
  }
});

test('REQ-TIER-1: an unknown tier fails closed, never resolves to standard', () => {
  assert.throws(() => resolveTier({ governance: { tier: 'enterprise' } }), /lite, standard, regulated/);
  assert.throws(() => resolveTier({ governance: { tier: 'enterprise' } }), /governance\.tier/);
});

test('REQ-TIER-1: diffBudget is monotonically at-least-as-strict at every tier above N (lower budget = stricter)', () => {
  assert.ok(tierParams('lite').diffBudget > tierParams('standard').diffBudget);
  assert.ok(tierParams('standard').diffBudget > tierParams('regulated').diffBudget);
});

// ── REQ-TIER-2 — never-tiered core is required everywhere ──────────────────

test('REQ-TIER-2: every never-tiered gate resolves to required at every tier', () => {
  for (const gate of NEVER_TIERED) {
    for (const tier of TIERS) {
      assert.equal(
        resolveGatePolicy(gate, tier),
        'required',
        `${gate} must be required at ${tier} (REQ-TIER-2)`
      );
    }
  }
});

// ── REQ-TIER-3 — no policy outside {required, detection} ───────────────────

test('REQ-TIER-3: every gate cell is exactly "required" or "detection", never off/disabled/absent', () => {
  for (const gate of Object.keys(GATE_MATRIX)) {
    for (const tier of TIERS) {
      const policy = resolveGatePolicy(gate, tier);
      assert.ok(
        policy === 'required' || policy === 'detection',
        `${gate}@${tier}: policy "${policy}" is outside {required, detection}`
      );
    }
  }
});

// ── REQ-TIER-7 — position-tiered ∩ never-tiered = ∅ ─────────────────────────

test('REQ-TIER-7: any gate whose policy varies across tiers (position-tiered) is disjoint from NEVER_TIERED', () => {
  const positionTiered = Object.keys(GATE_MATRIX).filter(gate => {
    const policies = new Set(TIERS.map(tier => resolveGatePolicy(gate, tier)));
    return policies.size > 1;
  });

  assert.ok(positionTiered.length > 0, 'expected at least one position-tiered gate (memory-gate/phase-order)');
  for (const gate of positionTiered) {
    assert.ok(
      !NEVER_TIERED.includes(gate),
      `${gate} is position-tiered but also listed in NEVER_TIERED — proportionality must never reach the core`
    );
  }
});

// ── REQ-TIER-8 — the matrix is total (drift-guard, fail-closed) ────────────

test('REQ-TIER-8: every GOVERNANCE_JOBS name has a matrix row', () => {
  for (const job of GOVERNANCE_JOBS) {
    assert.ok(GATE_MATRIX[job], `GOVERNANCE_JOBS includes "${job}" but GATE_MATRIX has no row for it`);
  }
});

test('REQ-TIER-8: every matrix row names a job GOVERNANCE_JOBS defines', () => {
  for (const gate of Object.keys(GATE_MATRIX)) {
    assert.ok(GOVERNANCE_JOBS.includes(gate), `GATE_MATRIX has a row for "${gate}" but it is not in GOVERNANCE_JOBS`);
  }
});

test('REQ-TIER-8: every matrix row resolves both a policy and an evidence form for all three tiers', () => {
  for (const gate of Object.keys(GATE_MATRIX)) {
    for (const tier of TIERS) {
      assert.ok(typeof resolveGatePolicy(gate, tier) === 'string');
      assert.ok(typeof resolveGateEvidence(gate, tier) === 'string' && resolveGateEvidence(gate, tier).length > 0);
    }
  }
});

test('REQ-TIER-8: an unmapped gate fails closed naming the gate and the tiers it must be decided for', () => {
  assert.throws(() => resolveGatePolicy('made-up-gate', 'standard'), /made-up-gate/);
  assert.throws(() => resolveGatePolicy('made-up-gate', 'standard'), /GATE_MATRIX/);
});

test('REQ-TIER-8 (regression): GOVERNANCE_JOBS and GATE_MATRIX keys are the SAME set, not just overlapping', () => {
  assert.deepEqual([...GOVERNANCE_JOBS].sort(), Object.keys(GATE_MATRIX).sort());
});

// ── REQ-TIER-9 — requiredJobs(tier) reproduces today's shipped split at standard ──

test("REQ-TIER-9/REQ-TIER-10: requiredJobs('standard') equals the pre-tiering REQUIRED_JOBS exactly, same order", () => {
  assert.deepEqual(requiredJobs('standard'), [
    'issue-link',
    'diff-size',
    'local-checks',
    'memory-gate',
    'decision-gate',
  ]);
});

test("requiredJobs('lite') demotes memory-gate only (design §5's measured cost)", () => {
  assert.deepEqual(requiredJobs('lite'), ['issue-link', 'diff-size', 'local-checks', 'decision-gate']);
});

test("requiredJobs('regulated') is a superset of requiredJobs('standard') today (memory-gate stays required)", () => {
  const standard = requiredJobs('standard');
  const regulated = requiredJobs('regulated');
  for (const gate of standard) {
    assert.ok(regulated.includes(gate), `regulated must still require "${gate}"`);
  }
});

test('requiredJobs never includes a PENDING_PROMOTION gate at any tier, even though GATE_MATRIX declares it required (staged rollout safety)', () => {
  for (const tier of TIERS) {
    const required = requiredJobs(tier);
    assert.ok(!required.includes('actor-check'), `actor-check must not be required at ${tier} yet (Phase 4 blocked on #328)`);
    assert.ok(!required.includes('brain-writes-reviewed'), `brain-writes-reviewed must not be required at ${tier} yet (Phase 4 blocked on #328)`);
    assert.ok(!required.includes('phase-order'), `phase-order must not be required at ${tier} yet (Phase 5 precondition unmet)`);
  }
});

// ── REQ-TIER-10 — governance.tier defaults to standard ──────────────────────

test('REQ-TIER-10: resolveTier defaults to "standard" when governance.tier is absent', () => {
  assert.equal(resolveTier({}), 'standard');
  assert.equal(resolveTier(undefined), 'standard');
  assert.equal(resolveTier({ governance: {} }), 'standard');
});

test('REQ-TIER-10: a default of "lite" is forbidden — absence never resolves to lite', () => {
  assert.notEqual(resolveTier({}), 'lite');
});

// ── tierParams — §2.C doctrine parameters ───────────────────────────────────

test('tierParams: diffBudget matches design §2.C (1000/400/200)', () => {
  assert.equal(tierParams('lite').diffBudget, 1000);
  assert.equal(tierParams('standard').diffBudget, 400);
  assert.equal(tierParams('regulated').diffBudget, 200);
});

test('tierParams: size:exception honored at lite/standard, refused at regulated (REQ-TIER-6)', () => {
  assert.equal(tierParams('lite').honorSizeException, true);
  assert.equal(tierParams('standard').honorSizeException, true);
  assert.equal(tierParams('regulated').honorSizeException, false);
});

test('tierParams: override:* honored at lite/standard, refused at regulated (REQ-TIER-6)', () => {
  assert.equal(tierParams('lite').honorOverride, true);
  assert.equal(tierParams('standard').honorOverride, true);
  assert.equal(tierParams('regulated').honorOverride, false);
});

test('tierParams: standard keeps all four artefacts; regulated adds a recorded verification artefact (design §3 ratified)', () => {
  assert.deepEqual(tierParams('standard').artefacts, ['proposal', 'spec', 'design', 'tasks']);
  assert.deepEqual(tierParams('regulated').artefacts, ['proposal', 'spec', 'design', 'tasks', 'verification']);
  assert.deepEqual(tierParams('lite').artefacts, ['spec']);
});

test('tierParams: unknown tier throws', () => {
  assert.throws(() => tierParams('enterprise'), /unknown tier/);
});

// ── resolveGatePolicy / resolveGateEvidence — unknown tier fails closed ─────

test('resolveGatePolicy/resolveGateEvidence throw on an unknown tier for a known gate', () => {
  assert.throws(() => resolveGatePolicy('issue-link', 'enterprise'), /issue-link/);
  assert.throws(() => resolveGateEvidence('issue-link', 'enterprise'), /issue-link/);
});

// ── CLI printer — REQ-TIER-9 (no second budget literal) ─────────────────────

test('printDiffBudget prints the tier-resolved budget as a string', () => {
  assert.equal(printDiffBudget(() => ({ governance: { tier: 'lite' } })), '1000');
  assert.equal(printDiffBudget(() => ({ governance: { tier: 'regulated' } })), '200');
  assert.equal(printDiffBudget(() => ({})), '400');
});

test('printDiffBudget propagates the fail-closed throw on an unknown tier', () => {
  assert.throws(() => printDiffBudget(() => ({ governance: { tier: 'enterprise' } })), /governance\.tier/);
});

// ── Drift-guard against the real governance.yml (mirrors governance-checks.test.mjs) ──

test('drift-guard: GATE_MATRIX keys match governance.yml job names exactly', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.deepEqual(
    [...new Set(yamlJobNames)].sort(),
    [...new Set(Object.keys(GATE_MATRIX))].sort(),
    `Drift detected: GATE_MATRIX keys=${JSON.stringify(Object.keys(GATE_MATRIX))} ` +
    `but governance.yml job names=${JSON.stringify(yamlJobNames)}`
  );
});
