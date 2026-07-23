// refuter.mjs — Refuter Role Evaluator (REQ-H2-1).
// Read-only, single-batch evaluator over inferential blocker findings.

/**
 * Evaluates inferential blocker findings in a single batch to eliminate false positives.
 * @param {{ findings: Array<object>, runner?: function }} options
 * @returns {Promise<{ outcomes: Array<object>, refutedCount: number, adjustedFindings: Array<object>, escalate: string|null }>}
 */
export async function evaluateRefuter({ findings = [], runner = null } = {}) {
  const inferentialBlockers = findings.filter(
    f => f.severity === 'blocker' && f.evidence_class === 'inferential'
  );

  if (inferentialBlockers.length === 0 || typeof runner !== 'function') {
    return {
      outcomes: [],
      refutedCount: 0,
      adjustedFindings: findings,
      escalate: null,
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
    adjustedFindings,
    escalate,
  };
}
