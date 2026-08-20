// resolve-challenger.test.mjs — issue #682 slice 1, REQ-682-1/REQ-682-2/REQ-682-6.
//
// The axis these tests vary is WHICH STATE A READER OF THE VERDICT ENDS UP IN,
// not which branch of `resolveChallenger` ran. #552's defect was invisible until
// it was rendered — two states that differed in the object and not on the wire —
// so the central case here (`human` vs no runner) asserts on rendered bytes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveChallenger, resolveAxis, AXES, IMPLEMENTED_AXES } from './resolve-challenger.mjs';
import { evaluateRefuter, UNCHALLENGED, ROUTED_HUMAN } from '../evaluators/refuter.mjs';
import { renderVerdict } from '../verdict.mjs';
import { parseVerdict } from './parse-verdict.mjs';
import { tierParams } from '../../vcs/governance-tiers.mjs';

const blocker = (id = 'F1') => ({
  id,
  severity: 'blocker',
  evidence_class: 'inferential',
  title: 'a reasoned claim',
  evidence: 'e',
  cites: 'reviewer-protocol.md §6.1',
});

const withHuman = { reviewer: { inferential: { enabled: true, challenger: { axis: 'human' } } } };

// ── REQ-682-2 — the producer is off at `lite`, and that protects #435 ─────────

test('REQ-682-2: `lite` resolves to no challenger, because it resolves to no producer', () => {
  assert.equal(resolveChallenger({ config: {}, tier: 'lite' }), null);
  assert.equal(resolveAxis({ config: {}, tier: 'lite' }), null);
});

test('REQ-682-2: the `lite` tier params say off — the mutation target, pinned directly', () => {
  // Task 1.7's mutation is flipping this value. It is asserted here rather than
  // only through `resolveChallenger` so the failure names the cause: turning the
  // producer on at `lite` requires a model credential in a fresh install, and
  // `test/fresh-install/in-container.sh` asserts installing and running brain
  // needs none (#435's exit criterion). Read that file before changing this.
  assert.equal(tierParams('lite').inferentialEnabled, false,
    'the producer must stay OFF at lite — a challenger on any axis but `human` needs a model ' +
    'credential, and test/fresh-install/in-container.sh enforces that a fresh install needs none.');
  assert.equal(tierParams('lite').challengerAxis, null,
    'and the axis is null at lite because the question does not arise there — not because a ' +
    'default was omitted.');
});

test('REQ-682-2: a repo may opt IN at lite, and then it gets a real challenger', () => {
  const runner = resolveChallenger({ config: withHuman, tier: 'lite' });
  assert.equal(typeof runner, 'function',
    'explicit config beats the tier default in both directions — off is a DEFAULT, not a ceiling');
});

// ── REQ-682-1 — resolution order, and the refusal ────────────────────────────

test('REQ-682-1: absent config resolves the axis from the tier', () => {
  assert.equal(resolveAxis({ config: {}, tier: 'standard' }), 'same-model');
  assert.equal(resolveAxis({ config: {}, tier: 'regulated' }), 'cross-family');
});

test('REQ-682-1: explicit config beats the tier default', () => {
  assert.equal(resolveAxis({ config: withHuman, tier: 'regulated' }), 'human');
});

test('REQ-682-1: an unrecognised axis REFUSES — never a silent fallback', () => {
  const config = { reviewer: { inferential: { enabled: true, challenger: { axis: 'same-modle' } } } };
  assert.throws(
    () => resolveChallenger({ config, tier: 'standard' }),
    /unrecognised challenger axis "same-modle"/,
    'a typo must not quietly resolve to a default: an unknown axis is an unknown evidentiary strength',
  );
});

test('REQ-682-1: the refusal names the axes it would have accepted', () => {
  const config = { reviewer: { inferential: { enabled: true, challenger: { axis: 'nope' } } } };
  assert.throws(() => resolveChallenger({ config, tier: 'standard' }), (err) => {
    for (const axis of AXES) {
      assert.ok(err.message.includes(axis), `the refusal must name ${axis}`);
    }
    return true;
  });
});

// ── An axis that is real but unbuilt fails CLOSED, and differently ───────────

test('an unbuilt axis returns a runner that refuses when invoked — never null, never a weaker axis', async () => {
  const runner = resolveChallenger({ config: {}, tier: 'regulated' });
  assert.equal(typeof runner, 'function',
    'null would render as `unchallenged` — "nothing was available" — which is not what happened');
  await assert.rejects(
    () => runner([blocker()]),
    /"cross-family" axis is not implemented/,
    'a tier that asked for stronger evidence must not silently receive weaker',
  );
});

test('the two failure classes are separated: a typo throws at construction, an unbuilt axis at call time', () => {
  // Different facts, different timing, on purpose. The operator fixes one by
  // editing config; the other is a property of the build.
  assert.throws(() => resolveChallenger({
    config: { reviewer: { inferential: { enabled: true, challenger: { axis: 'xx' } } } },
    tier: 'standard',
  }));
  assert.doesNotThrow(() => resolveChallenger({ config: {}, tier: 'standard' }),
    'a real-but-unbuilt axis must construct — nothing calls it while no producer exists');
});

test('IMPLEMENTED_AXES is a subset of AXES, and every implemented axis constructs', () => {
  for (const axis of IMPLEMENTED_AXES) {
    assert.ok(AXES.includes(axis), `${axis} must be a declared axis`);
    const config = { reviewer: { inferential: { enabled: true, challenger: { axis } } } };
    assert.equal(typeof resolveChallenger({ config, tier: 'lite' }), 'function');
  }
});

// ── REQ-682-6 — the requirement, asserted where #552's defect was invisible ──

test('REQ-682-6: the human axis marks `routed:human`, keeps the blocker, and escalates', async () => {
  const runner = resolveChallenger({ config: withHuman, tier: 'standard' });
  const r = await evaluateRefuter({ findings: [blocker()], runner });

  assert.equal(r.adjustedFindings[0].refuter_outcome, ROUTED_HUMAN);
  assert.equal(r.escalate, 'human');
  assert.equal(r.adjustedFindings[0].severity, 'blocker',
    'routing a claim to a person is not a judgment about the claim — severity is unchanged');
  assert.equal(r.unchallenged, 0,
    'it WAS challenged, by a person, by design — counting it as unchallenged is the fold this forbids');
});

test('REQ-682-6: the human axis does NOT fall through to `corroborated`', async () => {
  // The fall-through in evaluateRefuter marks anything it does not recognise
  // `corroborated` — "a challenge upheld this". For an outcome that means "no
  // challenge has happened yet" that is a false claim about the evidence, and it
  // is what a new outcome value silently inherits without its own branch.
  const runner = resolveChallenger({ config: withHuman, tier: 'standard' });
  const r = await evaluateRefuter({ findings: [blocker()], runner });
  assert.notEqual(r.adjustedFindings[0].refuter_outcome, 'corroborated');
});

test('REQ-682-6: `routed:human` and `unchallenged` differ ON THE WIRE, not merely in the object', async () => {
  // THE CENTRAL CASE. #552's defect was two states rendering byte-identically,
  // so this asserts on rendered bytes and on the parse back — an object-level
  // assertion would have passed for #552's defect too.
  const render = async (runner) => {
    const r = await evaluateRefuter({ findings: [blocker()], runner });
    return renderVerdict({
      protocol: 'brain-review/2', verdict: 'REVISE', head_sha: 'a'.repeat(40), rev: 1,
      gates: { required: ['issue-link'], detection: [] },
      findings: r.adjustedFindings, follow_ups: [], conditions: [], escalate: r.escalate,
    });
  };

  const routed = await render(resolveChallenger({ config: withHuman, tier: 'standard' }));
  const absent = await render(null);

  assert.notEqual(routed, absent,
    'a human challenger by design and no challenger at all must not render identically — that is ' +
    'the #552 fold, one layer up, produced by a configuration option');
  assert.match(routed, /refuter_outcome: routed:human/);
  assert.match(absent, /refuter_outcome: unchallenged/);

  // And both survive the round trip: a value that renders but does not parse
  // back is the render/parse asymmetry this field has shipped once before (#381).
  assert.equal(parseVerdict({ body: routed }).findings[0].refuter_outcome, ROUTED_HUMAN);
  assert.equal(parseVerdict({ body: absent }).findings[0].refuter_outcome, UNCHALLENGED);
});

test('REQ-682-6: with nothing reasoned to challenge, the human axis stays silent', async () => {
  // The state every verdict brain posts today, and it must not change: a
  // deterministic finding is not routed anywhere.
  const runner = resolveChallenger({ config: withHuman, tier: 'standard' });
  const deterministic = { ...blocker(), evidence_class: 'deterministic' };
  const r = await evaluateRefuter({ findings: [deterministic], runner });

  assert.equal(r.escalate, null);
  assert.equal(r.unchallenged, 0);
  assert.equal('refuter_outcome' in r.adjustedFindings[0], false);
});
