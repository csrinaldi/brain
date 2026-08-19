// resolve-challenger.test.mjs — issue #682, REQ-682-1/REQ-682-2/REQ-682-6,
// rewritten after the cold review of PR #740/#741.
//
// The axis these tests vary is WHICH STATE A READER OF THE VERDICT ENDS UP IN.
// #552's defect was two states that differed in the object and not on the wire,
// so the central cases assert on rendered bytes and the parse back.
//
// The cold review's finding about the FIRST cut of this file is worth keeping in
// front of whoever edits it: every mutation it survived varied behaviour INSIDE
// this module, and none varied whether `cli.mjs` calls it. The composition is
// covered in `cli.judgment.test.mjs`; this file covers the resolution.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveJudgment, AXES, IMPLEMENTED_AXES, JUDGMENT_PROTOCOL } from './resolve-challenger.mjs';
import { evaluateRefuter, UNCHALLENGED, ROUTED_HUMAN } from '../evaluators/refuter.mjs';
import { renderVerdict } from '../verdict.mjs';
import { parseVerdict } from './parse-verdict.mjs';
import { tierParams } from '../../vcs/governance-tiers.mjs';

const blocker = (id = 'F1') => ({
  id, severity: 'blocker', evidence_class: 'inferential',
  evidence: 'e', cites: 'reviewer-protocol.md §6.1',
});

const cfg = (inferential) => ({ reviewer: { inferential } });
const human = cfg({ enabled: true, challenger: { axis: 'human' } });

// ── ONE gate — the correction the cold review forced ─────────────────────────

test('the producer and the challenger read ONE resolution — they cannot disagree', () => {
  // The defect: the producer gated on `inferentialEnabled` and the challenger on
  // `protocol === '/2'`, and at `standard` those disagree. The producer ran, the
  // refuter was skipped entirely, and the verdict declared the judgment control
  // applied with nothing challenged — #552's ruled-against state.
  const r = resolveJudgment({ config: {}, tier: 'standard', protocol: 'brain-review/1' });
  assert.equal(r.run, false, 'a half that cannot be challenged must not be produced either');
  assert.equal(r.challenger, null);
  assert.equal(r.axis, null);
  assert.match(r.reason, /requires brain-review\/2/);
});

test('the shipped tier defaults no longer contain a disagreeing pair', () => {
  // Pinned as DATA, so a future tier edit that re-creates the disagreement fails
  // here rather than in a posted verdict.
  for (const tier of ['lite', 'standard', 'regulated']) {
    const p = tierParams(tier);
    const r = resolveJudgment({ config: {}, tier, protocol: p.reviewProtocol });
    if (p.inferentialEnabled && p.reviewProtocol !== JUDGMENT_PROTOCOL) {
      assert.equal(r.run, false,
        `tier "${tier}" enables the producer at ${p.reviewProtocol}, which cannot carry or ` +
        'challenge a reasoned finding — the single gate must refuse to run it');
    }
  }
});

// ── REQ-682-2 — the producer is off at `lite` ────────────────────────────────

test('REQ-682-2: `lite` runs no judgment half', () => {
  const r = resolveJudgment({ config: {}, tier: 'lite', protocol: JUDGMENT_PROTOCOL });
  assert.equal(r.run, false);
  assert.match(r.reason, /disabled/);
  assert.equal(tierParams('lite').inferentialEnabled, false);
});

test('REQ-682-2: opting in at `lite` without naming an axis REFUSES, and says whose fault it is', () => {
  // Reachable today: brain's own config is `lite` + `brain-review/2`. The first
  // cut threw "unrecognised challenger axis null", blaming the operator for a
  // value the TIER supplied. The message now names the real gap.
  assert.throws(
    () => resolveJudgment({ config: cfg({ enabled: true }), tier: 'lite', protocol: JUDGMENT_PROTOCOL }),
    /tier "lite" supplies no default challenger axis/,
  );
});

test('REQ-682-2: opting in at `lite` WITH an axis works', () => {
  const r = resolveJudgment({ config: human, tier: 'lite', protocol: JUDGMENT_PROTOCOL });
  assert.equal(r.run, true);
  assert.equal(r.axis, 'human');
});

// ── REQ-682-1 — resolution order and the refusal ─────────────────────────────

test('REQ-682-1: absent config resolves the axis from the tier', () => {
  assert.equal(resolveJudgment({ config: {}, tier: 'regulated', protocol: JUDGMENT_PROTOCOL }).axis, 'cross-family');
});

test('REQ-682-1: explicit config beats the tier default', () => {
  assert.equal(resolveJudgment({ config: human, tier: 'regulated', protocol: JUDGMENT_PROTOCOL }).axis, 'human');
});

test('REQ-682-1: an unrecognised axis REFUSES, naming what it would have accepted', () => {
  assert.throws(
    () => resolveJudgment({
      config: cfg({ enabled: true, challenger: { axis: 'same-modle' } }),
      tier: 'standard', protocol: JUDGMENT_PROTOCOL,
    }),
    (err) => {
      assert.match(err.message, /unrecognised challenger axis "same-modle"/);
      for (const a of AXES) assert.ok(err.message.includes(a), `must name ${a}`);
      return true;
    },
  );
});

// ── an unbuilt axis fails CLOSED on the wire, not in a stack trace ────────────

test('an unbuilt axis reports UNCHALLENGED and escalates — it does not throw', async () => {
  // The first cut threw at call time, and nothing catches it: it surfaced as an
  // unhandled rejection with NO verdict posted, replacing #552's honest
  // `unchallenged` + escalate + posted REVISE. Trading a posted fail-closed
  // verdict for a crash leaves the operator with less, not more.
  const r = resolveJudgment({ config: {}, tier: 'regulated', protocol: JUDGMENT_PROTOCOL });
  assert.equal(r.axis, 'cross-family');
  assert.ok(!IMPLEMENTED_AXES.includes(r.axis));

  const out = await evaluateRefuter({ findings: [blocker()], runner: r.challenger });
  assert.equal(out.adjustedFindings[0].refuter_outcome, UNCHALLENGED);
  assert.equal(out.escalate, 'human');
  assert.match(out.adjustedFindings[0].refuter_rationale, /axis "cross-family" is not implemented/);
  assert.match(out.adjustedFindings[0].refuter_rationale, /Refusing to substitute a weaker axis/);
});

// ── REQ-682-6 — routed:human is a state of its own ───────────────────────────

test('REQ-682-6: the human axis marks `routed:human`, keeps the blocker, escalates', async () => {
  const r = resolveJudgment({ config: human, tier: 'standard', protocol: JUDGMENT_PROTOCOL });
  const out = await evaluateRefuter({ findings: [blocker()], runner: r.challenger });
  assert.equal(out.adjustedFindings[0].refuter_outcome, ROUTED_HUMAN);
  assert.equal(out.adjustedFindings[0].severity, 'blocker');
  assert.equal(out.escalate, 'human');
  assert.equal(out.unchallenged, 0);
});

test('REQ-682-6: the human axis does NOT fall through to `corroborated`', async () => {
  const r = resolveJudgment({ config: human, tier: 'standard', protocol: JUDGMENT_PROTOCOL });
  const out = await evaluateRefuter({ findings: [blocker()], runner: r.challenger });
  assert.notEqual(out.adjustedFindings[0].refuter_outcome, 'corroborated');
});

test('REQ-682-6: `routed:human` and `unchallenged` differ ON THE WIRE and both round-trip', async () => {
  const render = async (runner) => {
    const out = await evaluateRefuter({ findings: [blocker()], runner });
    return renderVerdict({
      protocol: 'brain-review/2', verdict: 'REVISE', head_sha: 'a'.repeat(40), rev: 1,
      gates: { required: ['issue-link'], detection: [] },
      findings: out.adjustedFindings, follow_ups: [], conditions: [], escalate: out.escalate,
    });
  };
  const routed = await render(resolveJudgment({ config: human, tier: 'standard', protocol: JUDGMENT_PROTOCOL }).challenger);
  const absent = await render(null);

  assert.notEqual(routed, absent);
  assert.match(routed, /refuter_outcome: routed:human/);
  assert.match(absent, /refuter_outcome: unchallenged/);
  assert.equal(parseVerdict({ body: routed }).findings[0].refuter_outcome, ROUTED_HUMAN);
  assert.equal(parseVerdict({ body: absent }).findings[0].refuter_outcome, UNCHALLENGED);
});

// ── the partial-runner backstop ──────────────────────────────────────────────

test('a runner that answers for SOME blockers leaves none unmarked and none uncounted', async () => {
  // Every test in the first cut used exactly one blocker, so multiplicity was
  // never varied — and a model handed 5 blockers returning 4 outcomes is the
  // most likely failure mode of the transport slice 3 introduces.
  const partial = async (blockers) => ({
    outcomes: blockers.slice(0, 1).map(f => ({ id: f.id, outcome: 'corroborated', rationale: 'r' })),
  });
  const out = await evaluateRefuter({ findings: [blocker('A'), blocker('B'), blocker('C')], runner: partial });

  assert.equal(out.unchallenged, 2, 'the two unanswered blockers must be COUNTED');
  assert.equal(out.escalate, 'human');
  assert.equal(out.adjustedFindings[1].refuter_outcome, UNCHALLENGED);
  assert.equal(out.adjustedFindings[2].refuter_outcome, UNCHALLENGED);
  assert.equal(out.adjustedFindings[0].refuter_outcome, 'corroborated');
});

test('the backstop does not touch findings the refuter was never asked about', async () => {
  const deterministic = { id: 'gate:x', severity: 'blocker', evidence_class: 'deterministic', evidence: 'e' };
  const out = await evaluateRefuter({
    findings: [deterministic, blocker('A')],
    runner: async () => ({ outcomes: [] }),
  });
  assert.equal('refuter_outcome' in out.adjustedFindings[0], false,
    'a deterministic finding is not an unanswered reasoned one');
  assert.equal(out.adjustedFindings[1].refuter_outcome, UNCHALLENGED);
  assert.equal(out.unchallenged, 1);
});
