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
import { readFile } from 'node:fs/promises';

import { resolveJudgment, AXES, IMPLEMENTED_AXES, JUDGMENT_PROTOCOL } from './resolve-challenger.mjs';
import { evaluateRefuter, UNCHALLENGED, ROUTED_HUMAN } from '../evaluators/refuter.mjs';
import { renderVerdict } from '../verdict.mjs';
import { parseVerdict } from './parse-verdict.mjs';

const blocker = (id = 'F1') => ({
  id, severity: 'blocker', evidence_class: 'inferential',
  evidence: 'e', cites: 'reviewer-protocol.md §6.1',
});

const cfg = (inferential) => ({ reviewer: { inferential } });
const human = cfg({ enabled: true, challenger: { axis: 'human' } });

// ── ONE gate — the correction the cold review forced ─────────────────────────

test('the producer and the challenger read ONE resolution — they cannot disagree', () => {
  // The defect: the producer gated on a tier param and the challenger on
  // `protocol === '/2'`, and those disagreed at a shipped tier default. The
  // producer ran, the refuter was skipped entirely, and the verdict declared the
  // judgment control applied with nothing challenged — #552's ruled-against state.
  const r = resolveJudgment({ config: human, protocol: 'brain-review/1' });
  assert.equal(r.run, false, 'a half that cannot be challenged must not be produced either');
  assert.equal(r.challenger, null);
  assert.equal(r.axis, null);
  assert.match(r.reason, /requires brain-review\/2/);
});

test('the judgment half ignores the tier ENTIRELY — ADR-0026 invariant 7', () => {
  // The tier answers one question: can this team satisfy an approval requirement
  // (#329). A capability is not an answer to it, and invariant 7 excludes
  // CORRECTNESS from tiering by name.
  //
  // Pinned BEHAVIOURALLY, not by scanning the source. A `rg`-shaped assertion
  // fails against this file's own explanatory prose — and #569 is the recorded
  // lesson that a runtime probe beats a source-shape check. So: pass a tier in
  // every way a caller could, and prove none of them changes the answer.
  const base = resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL });
  for (const tier of ['lite', 'standard', 'regulated', 'nonsense', undefined]) {
    const r = resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL, tier });
    assert.equal(r.run, base.run, `tier "${tier}" changed whether the half runs`);
    assert.equal(r.axis, base.axis, `tier "${tier}" changed the axis`);
  }
  // And an unknown tier cannot even refuse the run, which it would if this
  // function still called tierParams().
  assert.doesNotThrow(() => resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL, tier: 'nonsense' }));
});
// ── REQ-682-2 — the producer is off at `lite` ────────────────────────────────

test('the judgment half is OFF unless the repo turns it on — at every tier', () => {
  // Replaces REQ-682-2's tier-shaped form. The old pin asserted a `lite` tier
  // value and justified it with a fresh-install story that measurement
  // falsified: `resolveTier({})` is `standard`, and `test/fresh-install/
  // in-container.sh` never invokes `brain:review`. The true protection is this
  // default, and it holds everywhere rather than at one tier.
  for (const config of [{}, { reviewer: {} }, { reviewer: { inferential: {} } }]) {
    const r = resolveJudgment({ config, protocol: JUDGMENT_PROTOCOL });
    assert.equal(r.run, false, 'absent config must never turn on an outbound model call');
    assert.match(r.reason, /off — set reviewer.inferential.enabled/);
  }
});

test('only an explicit `true` turns it on — no truthy coercion', () => {
  for (const enabled of ['true', 1, {}, 'yes']) {
    const r = resolveJudgment({ config: cfg({ enabled, challenger: { axis: 'human' } }), protocol: JUDGMENT_PROTOCOL });
    assert.equal(r.run, false, `${JSON.stringify(enabled)} is not true — a credential-costing capability is chosen, not coerced`);
  }
});

test('enabled with no axis REFUSES — there is no default evidentiary strength', () => {
  assert.throws(
    () => resolveJudgment({ config: cfg({ enabled: true }), protocol: JUDGMENT_PROTOCOL }),
    /enabled but names no challenger axis/,
  );
});

test('enabling it with an axis works', () => {
  const r = resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL });
  assert.equal(r.run, true);
  assert.equal(r.axis, 'human');
});

// ── REQ-682-1 — resolution order and the refusal ─────────────────────────────

test('REQ-682-1: the axis comes from config, and only from config', () => {
  assert.equal(resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL }).axis, 'human');
  assert.equal(resolveJudgment({ config: cfg({ enabled: true, challenger: { axis: 'cross-family' } }), protocol: JUDGMENT_PROTOCOL }).axis, 'cross-family');
});

test('REQ-682-1: an unrecognised axis REFUSES, naming what it would have accepted', () => {
  assert.throws(
    () => resolveJudgment({
      config: cfg({ enabled: true, challenger: { axis: 'same-modle' } }),
      protocol: JUDGMENT_PROTOCOL,
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
  const r = resolveJudgment({ config: cfg({ enabled: true, challenger: { axis: 'cross-family' } }), protocol: JUDGMENT_PROTOCOL });
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
  const r = resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL });
  const out = await evaluateRefuter({ findings: [blocker()], runner: r.challenger });
  assert.equal(out.adjustedFindings[0].refuter_outcome, ROUTED_HUMAN);
  assert.equal(out.adjustedFindings[0].severity, 'blocker');
  assert.equal(out.escalate, 'human');
  assert.equal(out.unchallenged, 0);
});

test('REQ-682-6: the human axis does NOT fall through to `corroborated`', async () => {
  const r = resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL });
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
  const routed = await render(resolveJudgment({ config: human, protocol: JUDGMENT_PROTOCOL }).challenger);
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
