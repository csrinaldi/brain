// refuter.test.mjs — Unit tests for Refuter Role Evaluator (REQ-H2-1).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateRefuter } from './refuter.mjs';

test('evaluateRefuter: returns corroborated when claim is valid', async () => {
  const finding = {
    id: 'R3-001',
    severity: 'blocker',
    evidence_class: 'inferential',
    causal_disposition: 'introduced',
    claim: 'Uncaught promise rejection in cold-boot.mjs',
    evidence: 'git diff inspection',
    cites: 'cold-boot.mjs:42',
  };

  // Mock runner returning corroborated
  const mockRunner = async () => ({
    outcomes: [{ id: 'R3-001', outcome: 'corroborated', rationale: 'Verified missing catch handler' }],
  });

  const result = await evaluateRefuter({ findings: [finding], runner: mockRunner });
  assert.equal(result.outcomes[0].outcome, 'corroborated');
  assert.equal(result.refutedCount, 0);
});

test('evaluateRefuter: refuted outcome marks finding as refuted and non-blocking', async () => {
  const finding = {
    id: 'R3-001',
    severity: 'blocker',
    evidence_class: 'inferential',
    causal_disposition: 'introduced',
    claim: 'Alleged unhandled mutex unlock',
    evidence: 'git diff inspection',
    cites: 'cold-boot.mjs:42',
  };

  const mockRunner = async () => ({
    outcomes: [{ id: 'R3-001', outcome: 'refuted', rationale: 'defer mu.Unlock() is present at line 20' }],
  });

  const result = await evaluateRefuter({ findings: [finding], runner: mockRunner });
  assert.equal(result.outcomes[0].outcome, 'refuted');
  assert.equal(result.refutedCount, 1);
  assert.equal(result.adjustedFindings[0].refuted, true);
});

test('evaluateRefuter: inconclusive outcome forces escalate: human', async () => {
  const finding = {
    id: 'R3-001',
    severity: 'blocker',
    evidence_class: 'inferential',
    causal_disposition: 'introduced',
    claim: 'Ambiguous race condition in async queue',
    evidence: 'git diff inspection',
    cites: 'queue.mjs:10',
  };

  const mockRunner = async () => ({
    outcomes: [{ id: 'R3-001', outcome: 'inconclusive', rationale: 'Cannot determine execution ordering without trace' }],
  });

  const result = await evaluateRefuter({ findings: [finding], runner: mockRunner });
  assert.equal(result.escalate, 'human');
});

test('evaluateRefuter: skips non-inferential or non-blocker findings (lazy execution)', async () => {
  const deterministicFinding = {
    id: 'R3-001',
    severity: 'blocker',
    evidence_class: 'deterministic',
    causal_disposition: 'introduced',
    claim: 'Failing unit test',
    evidence: 'npm test output',
    cites: 'test.mjs:1',
  };

  let runnerCalled = false;
  const mockRunner = async () => {
    runnerCalled = true;
    return { outcomes: [] };
  };

  const result = await evaluateRefuter({ findings: [deterministicFinding], runner: mockRunner });
  assert.equal(runnerCalled, false);
  assert.equal(result.refutedCount, 0);
});
