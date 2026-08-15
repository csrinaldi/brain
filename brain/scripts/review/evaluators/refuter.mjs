// refuter.mjs — Refuter Role Evaluator (REQ-H2-1).
// Read-only, single-batch evaluator over inferential blocker findings.
//
// IT FAILED OPEN, AND THAT IS THE FINDING #552 TURNS ON (measured, 2026-08-15).
//
// `cli.mjs` passes `runner: deps.refuterRunner ?? null`, and `refuterRunner` is
// a test-side injection — so in PRODUCTION the runner is always null. The old
// early return folded "nothing to challenge" and "no way to challenge it" into
// one silent state, so a reasoned blocker with no refuter came back byte-identical
// to one the refuter had examined and corroborated: same severity, same
// `escalate: null`, same empty `conditions`. Rendered, the two blocks did not
// differ by a character.
//
// That is `evidence-reader-empty-on-failure` inside the component whose entire
// job is to be the check on judgment — the worst possible place for it, because
// a reader of the verdict would take an unexamined claim for an examined one.
// It is unreachable today (no evaluator emits `inferential`), which is exactly
// why it had to be closed BEFORE a producer exists rather than after: #552's
// ruling is that judgment may not ship until its challenger is real.
//
// So the two states are now distinct, and the weaker one is LOUDER:
//
//   no inferential blockers      → silent. Correct: there is nothing to challenge.
//   inferential blockers, no runner → `refuter_outcome: 'unchallenged'` on each,
//                                     `escalate: 'human'`, and a condition from
//                                     `causal-admission.mjs`.
//
// `escalate: 'human'` rather than a bare annotation, by symmetry with the
// `inconclusive` branch below: "the challenge was inconclusive" already escalates,
// and "there was no challenge at all" is strictly weaker evidence than that. It
// cannot cause #394's escalation storm, because it fires only on a finding class
// nothing currently produces.

/** `refuter_outcome` for a reasoned blocker that no runner was available to challenge. */
export const UNCHALLENGED = 'unchallenged';

/**
 * Evaluates inferential blocker findings in a single batch to eliminate false positives.
 * @param {{ findings: Array<object>, runner?: function }} options
 * @returns {Promise<{ outcomes: Array<object>, refutedCount: number, unchallenged: number, adjustedFindings: Array<object>, escalate: string|null }>}
 */
export async function evaluateRefuter({ findings = [], runner = null } = {}) {
  const inferentialBlockers = findings.filter(
    f => f.severity === 'blocker' && f.evidence_class === 'inferential'
  );

  // Nothing to challenge. Silent, and correctly so — this is the state every
  // verdict brain posts today.
  if (inferentialBlockers.length === 0) {
    return { outcomes: [], refutedCount: 0, unchallenged: 0, adjustedFindings: findings, escalate: null };
  }

  // Something to challenge, and nothing to challenge it with. NOT the same state.
  if (typeof runner !== 'function') {
    const pending = new Set(inferentialBlockers.map(f => f.id));
    return {
      outcomes: [],
      refutedCount: 0,
      unchallenged: inferentialBlockers.length,
      adjustedFindings: findings.map(f => (pending.has(f.id) ? { ...f, refuter_outcome: UNCHALLENGED } : f)),
      escalate: 'human',
    };
  }

  const { outcomes = [] } = await runner(inferentialBlockers);
  const outcomeMap = new Map(outcomes.map(o => [o.id, o]));

  let refutedCount = 0;
  let escalate = null;

  const adjustedFindings = findings.map(f => {
    const res = outcomeMap.get(f.id);
    if (!res) return f;

    if (res.outcome === 'refuted') {
      refutedCount++;
      return { ...f, severity: 'correction', refuted: true, refuter_rationale: res.rationale };
    }

    if (res.outcome === 'inconclusive') {
      escalate = 'human';
      return { ...f, refuter_outcome: 'inconclusive', refuter_rationale: res.rationale };
    }

    return { ...f, refuter_outcome: 'corroborated', refuter_rationale: res.rationale };
  });

  return {
    outcomes,
    refutedCount,
    unchallenged: 0,
    adjustedFindings,
    escalate,
  };
}
