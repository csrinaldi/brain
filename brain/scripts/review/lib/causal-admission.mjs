// causal-admission.mjs — issue #394 (M3), completing #284: bridges the three
// deterministic evaluators (tranche.mjs, checkpoint.mjs, ruling.mjs) into the
// brain-review/2 causal-admission pipeline (verdict.mjs, schema-v2.mjs) at
// cli.mjs's single buildVerdict convergence point — the same seam issue-391's
// T2.3 design.md §3 (Q3.1) identifies as "the single place any mode's
// evalResult ... converges before a verdict is constructed."
//
// WHY annotate here, not inside tranche/checkpoint/ruling: those three stay
// pure, tier-unaware evaluators (design.md §5 style) — they answer "what is
// wrong with this candidate", never "which protocol is this repo on". Every
// finding they produce comes from a mechanical check (a fetched gate-status
// rollup, `git diff --numstat`, a regex over the PR body, `existsSync`, a
// base-sha reversion + `node --test`) — never an LLM inference — so
// `evidence_class: 'deterministic'` is always correct for them. And because
// each check is RE-DERIVED fresh against THIS candidate's own state (the
// rollup fetched for THIS head_sha, the budget diffed for THIS base...head,
// the reversion's OWN base-sha checkout), a finding one of them emits
// describes something true of / introduced by the candidate under review —
// never a defect merely inherited unchanged from base — so the safe default
// causal_disposition is 'introduced', never 'unknown' (T2.3 design.md §7,
// §9: defaulting to `unknown` here would force every real finding to
// `escalate: human`, the "escalation storm" issue #394 explicitly guards
// against) and never 'pre-existing'/'base-only' (none of these checks
// compare against base closely enough to honestly claim that — inventing
// the claim would be worse than omitting it).
//
// The refuter (evaluators/refuter.mjs, issue #284, REQ-H2-1) runs AFTER
// annotation, lazily (design.md FORK 1: only when >=1 blocker carries
// `evidence_class: 'inferential'`) — a no-op today, since no evaluator yet
// produces an inferential finding, but genuinely WIRED into the execution
// path (not dead code) so a future inferential finding-producer needs no
// second integration point.

import { evaluateRefuter } from '../evaluators/refuter.mjs';

const DEFAULT_EVIDENCE_CLASS = 'deterministic';
const DEFAULT_CAUSAL_DISPOSITION = 'introduced';

/**
 * Fills `evidence_class`/`causal_disposition` on findings that don't already
 * carry them (a future finding-producer's own classification always wins).
 * Pure — never mutates its input.
 *
 * @param {Array<object>} findings
 * @returns {Array<object>}
 */
export function annotateDeterministicFindings(findings = []) {
  return findings.map((f) => ({
    evidence_class: DEFAULT_EVIDENCE_CLASS,
    causal_disposition: DEFAULT_CAUSAL_DISPOSITION,
    ...f,
  }));
}

/**
 * REQ-H2-1: annotates, then runs the refuter over the result — lazily
 * (FORK 1), a no-op unless >=1 blocker carries `evidence_class:
 * 'inferential'`. Merges the refuter's forced `escalate: 'human'` (an
 * `inconclusive` outcome, REQ-H2-1 Scenario 1.4) with whatever `escalate`
 * the calling evaluator (e.g. ruling.mjs) already set — the refuter's
 * escalation always wins when it fires, since it is strictly MORE
 * conservative than "no escalation yet decided".
 *
 * @param {{ findings?: Array<object>, escalate?: string|null, runner?: Function|null }} args
 * @returns {Promise<{ findings: Array<object>, escalate: string|null }>}
 */
export async function applyCausalAdmission({ findings = [], escalate = null, runner = null } = {}) {
  const annotated = annotateDeterministicFindings(findings);
  const refuterResult = await evaluateRefuter({ findings: annotated, runner });
  return {
    findings: refuterResult.adjustedFindings,
    escalate: refuterResult.escalate ?? escalate,
  };
}
