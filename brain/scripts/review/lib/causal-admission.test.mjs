// causal-admission.test.mjs — Unit tests for the #394/#284 causal-admission
// bridge (annotateDeterministicFindings, applyCausalAdmission).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { annotateDeterministicFindings, applyCausalAdmission } from './causal-admission.mjs';

// ── annotateDeterministicFindings ───────────────────────────────────────────

test('annotateDeterministicFindings: fills evidence_class:deterministic and causal_disposition:introduced on a bare finding', () => {
  const [f] = annotateDeterministicFindings([{ id: 'gate:memory-gate', severity: 'blocker', evidence: 'FAILURE', cites: 'x' }]);
  assert.equal(f.evidence_class, 'deterministic');
  assert.equal(f.causal_disposition, 'introduced');
  assert.equal(f.id, 'gate:memory-gate');
});

test('annotateDeterministicFindings: never overwrites a finding that already carries its own classification', () => {
  const [f] = annotateDeterministicFindings([
    { id: 'r1', severity: 'blocker', evidence_class: 'inferential', causal_disposition: 'unknown' },
  ]);
  assert.equal(f.evidence_class, 'inferential');
  assert.equal(f.causal_disposition, 'unknown');
});

test('annotateDeterministicFindings: pure — does not mutate the input array/objects', () => {
  const input = [{ id: 'a' }];
  const out = annotateDeterministicFindings(input);
  assert.equal(input[0].evidence_class, undefined);
  assert.notEqual(out, input);
});

test('annotateDeterministicFindings: empty input → empty output', () => {
  assert.deepEqual(annotateDeterministicFindings([]), []);
  assert.deepEqual(annotateDeterministicFindings(), []);
});

// ── applyCausalAdmission ─────────────────────────────────────────────────────

test('applyCausalAdmission: no runner injected → annotates but never calls the refuter (no inferential blockers, no-op today)', async () => {
  const findings = [{ id: 'gate:x', severity: 'blocker', evidence: 'e', cites: 'c' }];
  const result = await applyCausalAdmission({ findings });
  assert.equal(result.findings[0].causal_disposition, 'introduced');
  assert.equal(result.findings[0].evidence_class, 'deterministic');
  assert.equal(result.escalate, null);
});

test('applyCausalAdmission: preserves a pre-set escalate when the refuter never fires', async () => {
  const findings = [{ id: 'fork-escalate', severity: 'editorial', evidence: 'e' }];
  const result = await applyCausalAdmission({ findings, escalate: 'human' });
  assert.equal(result.escalate, 'human');
});

test('applyCausalAdmission: an inferential blocker finding triggers the refuter; a "refuted" outcome demotes severity', async () => {
  const findings = [
    { id: 'r1', severity: 'blocker', evidence_class: 'inferential', causal_disposition: 'introduced', evidence: 'e', cites: 'c' },
  ];
  const runner = async (batch) => ({
    outcomes: batch.map((f) => ({ id: f.id, outcome: 'refuted', rationale: 'false positive' })),
  });
  const result = await applyCausalAdmission({ findings, runner });
  assert.equal(result.findings[0].severity, 'correction');
  assert.equal(result.findings[0].refuted, true);
});

test('applyCausalAdmission: an "inconclusive" refuter outcome forces escalate:human, overriding a null pre-set escalate', async () => {
  const findings = [
    { id: 'r1', severity: 'blocker', evidence_class: 'inferential', causal_disposition: 'introduced', evidence: 'e', cites: 'c' },
  ];
  const runner = async (batch) => ({
    outcomes: batch.map((f) => ({ id: f.id, outcome: 'inconclusive', rationale: 'cannot determine' })),
  });
  const result = await applyCausalAdmission({ findings, runner, escalate: null });
  assert.equal(result.escalate, 'human');
});
