// inferential.test.mjs — issue #682 slice 2, REQ-682-3 and REQ-682-4.
//
// The axis these tests vary is WHAT A READER OF THE VERDICT CAN TELL: whether
// the judgment half ran, and whether the challenger could see anything that
// reader could not. Both are properties of the wire, not of the object.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateInferential, gatherInferentialInputs, shouldRun, sanitiseFinding,
  PRODUCES, CARRIED_FIELDS,
} from './inferential.mjs';
import { PRODUCES as TRANCHE_PRODUCES } from './tranche.mjs';
import { unionControls, complementControls } from '../lib/controls.mjs';
import { evaluateRefuter } from './refuter.mjs';
import { resolveChallenger } from '../lib/resolve-challenger.mjs';

const generated = (extra = {}) => ([{
  id: 'J1', severity: 'blocker', title: 'a reasoned claim',
  evidence: 'the parser is correct; the semantics are inverted',
  cites: 'reviewer-protocol.md §6.1', file: 'a.mjs', line: 12,
  ...extra,
}]);

// ── REQ-682-3 — the declaration follows what RAN ─────────────────────────────

test('REQ-682-3: the evaluator declares `inferential`, and that is the whole of the declaration', () => {
  assert.deepEqual(PRODUCES, ['inferential']);
});

test('REQ-682-3: when the producer runs, the union grows and #690\'s complement empties itself', () => {
  // controls.test.mjs:114 asserts this as a hypothetical — "when #682 lands, the
  // complement empties itself, no edit required". This exercises it for real,
  // without touching that test's assertion.
  const before = unionControls([TRANCHE_PRODUCES]);
  const after = unionControls([TRANCHE_PRODUCES, PRODUCES]);

  assert.deepEqual(complementControls(before), ['inferential'],
    'without the producer, the verdict must say the inferential control did NOT run');
  assert.deepEqual(complementControls(after), [],
    'with it, the complement empties by itself — derived, never hand-maintained');
});

test('REQ-682-3: an unrun producer declares NOTHING — the honest half of the same rule', () => {
  // The defect this forbids: running the evaluator, producing zero findings, and
  // declaring `inferential` anyway. That claims a control the run never applied,
  // which is exactly what controls.mjs exists to remove.
  assert.equal(shouldRun({ enabled: true, generate: null }), false,
    'enabled but with no transport must NOT run — slice 3 supplies the transport');
  assert.equal(shouldRun({ enabled: false, generate: () => [] }), false);
  assert.equal(shouldRun({ enabled: true, generate: () => [] }), true);
});

test('with no generator, gather returns null and produces nothing to declare over', async () => {
  assert.deepEqual(await gatherInferentialInputs({ deps: {} }), { generated: null });
  assert.deepEqual(evaluateInferential({ generated: null }).findings, []);
});

// ── the class is forced, never trusted ───────────────────────────────────────

test('every emitted finding is forced to `evidence_class: inferential`', () => {
  const r = evaluateInferential({ generated: generated({ evidence_class: 'deterministic' }) });
  assert.equal(r.findings[0].evidence_class, 'inferential',
    'a judgment evaluator claiming `deterministic` would put a reasoned claim on the ' +
    'deterministic side of #575 Ruling 3 and skip the refuter entirely');
});

test('the producer never escalates on its own', () => {
  // Escalation for a reasoned finding is the CHALLENGER's decision. A producer
  // that escalated its own claims would be judging them — the self-attestation
  // ADR-0031 refuses.
  assert.equal(evaluateInferential({ generated: generated() }).escalate, null);
});

// ── REQ-682-4 — the challenger sees no more than the reader does ─────────────

test('REQ-682-4: reasoning fields are DROPPED before a finding leaves the producer', () => {
  const leaky = generated({
    reasoning: 'first I considered X, then rejected it because…',
    chain_of_thought: 'step 1…',
    _prompt: 'you are a reviewer…',
    model_scratchpad: 'hmm',
  })[0];

  const clean = sanitiseFinding(leaky);
  for (const k of ['reasoning', 'chain_of_thought', '_prompt', 'model_scratchpad']) {
    assert.equal(k in clean, false, `${k} must not survive — it is the producer's reasoning`);
  }
  assert.equal(clean.evidence, leaky.evidence, 'the claim\'s support survives; the thinking does not');
});

test('REQ-682-4: the carried set is enumerated, so a new generator field cannot widen the boundary', () => {
  const clean = sanitiseFinding(generated({ brand_new_field: 'anything' })[0]);
  for (const k of Object.keys(clean)) {
    assert.ok(CARRIED_FIELDS.includes(k), `${k} is not in CARRIED_FIELDS`);
  }
  assert.equal('brand_new_field' in clean, false,
    'a generator that grows a field does not get to widen the boundary by existing');
});

test('REQ-682-4: what the challenger receives is a SUBSET of what the verdict would render', async () => {
  // THE CENTRAL CASE. If the challenger can see something a reader of the verdict
  // cannot, the boundary has already leaked and `same-model` is self-attestation
  // with extra steps. Asserted on the arguments the runner actually receives —
  // a grep over the source would not have caught a value passed at runtime.
  const emitted = evaluateInferential({
    generated: generated({ reasoning: 'the producer\'s private chain' }),
  }).findings;

  let seenByChallenger = null;
  const spy = async (blockers) => {
    seenByChallenger = blockers;
    return { outcomes: blockers.map(f => ({ id: f.id, outcome: 'corroborated', rationale: 'r' })) };
  };

  await evaluateRefuter({ findings: emitted, runner: spy });

  assert.ok(seenByChallenger, 'the runner must have been called');
  for (const f of seenByChallenger) {
    for (const k of Object.keys(f)) {
      assert.ok(
        CARRIED_FIELDS.includes(k) || k === 'refuter_outcome' || k === 'refuter_rationale',
        `the challenger saw "${k}", which the verdict does not render — the boundary leaked`,
      );
    }
  }
});

test('REQ-682-4: there is no side channel — the runner receives findings and nothing else', async () => {
  const emitted = evaluateInferential({ generated: generated() }).findings;
  let argCount = null;
  const spy = async (...args) => {
    argCount = args.length;
    return { outcomes: [] };
  };
  await evaluateRefuter({ findings: emitted, runner: spy });
  assert.equal(argCount, 1,
    'a second argument would be a channel from producer to challenger that the verdict never shows');
});

// ── the two halves compose ───────────────────────────────────────────────────

test('a reasoned finding with the human axis is routed, not corroborated', async () => {
  const emitted = evaluateInferential({ generated: generated() }).findings;
  const runner = resolveChallenger({
    config: { reviewer: { inferential: { enabled: true, challenger: { axis: 'human' } } } },
    tier: 'standard',
  });
  const r = await evaluateRefuter({ findings: emitted, runner });
  assert.equal(r.adjustedFindings[0].refuter_outcome, 'routed:human');
  assert.equal(r.escalate, 'human');
});
