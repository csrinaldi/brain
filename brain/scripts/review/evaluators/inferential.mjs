// inferential.mjs — the judgment half of the review (issue #682, slice 2).
// Read-only, additive, and INERT until a transport exists.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS SLICE SHIPS, AND WHAT IT DELIBERATELY DOES NOT.
//
// A producer of REASONED findings needs something to reason with, and brain has
// no outbound model machinery at all — measured on `main` @ `46fb991`, the only
// network call in the tree is `gitlabApiFetch` and the reviewer shells out to
// `git`. That transport is slice 3, behind its own ADR, because it is where
// #682's network, credential and determinism costs actually land.
//
// So this file ships the SHAPE: the evaluator triple, the additive wiring, the
// declaration, and the boundary constraint that keeps `same-model` from being
// self-attestation. With no generator it produces nothing and DOES NOT RUN.
//
// AND THAT IS NOT #552's DEFECT, which is the objection this file has to answer
// out loud. #552's defect was that "no runner" and "runner said nothing"
// rendered BYTE-IDENTICALLY. Here the two states are already distinguished on
// the wire, and they were distinguished before this file existed: `controls.mjs`
// derives the declaration from the evaluators that RAN, and #690's complement
// names the classes that did not. A review with no producer says `inferential`
// did not run. A review with one says it did. A reader can tell.
//
// The ordering is the guarantee, not a coincidence: #683 and #690 landed in
// phase 3 precisely so phase 5 could add a producer without re-creating the
// fold. Never wire this evaluator to run while returning nothing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one class this evaluator can establish. `controls.mjs` unions PRODUCES
 * over the evaluators that ran, so declaring `inferential` here is the whole of
 * REQ-682-3 — `controls.mjs`'s own header promises it: *"a judgment evaluator
 * declares `inferential`, and the day it runs the verdict says so by itself."*
 *
 * Declared beside the code it describes, like every other evaluator: this is
 * the file that would change if the answer changed.
 */
export const PRODUCES = Object.freeze(['inferential']);

/**
 * REQ-682-4 — the fields a reasoned finding may carry to the challenger.
 *
 * The challenger receives findings and never the producer's reasoning. That
 * boundary is only real if the finding object does not smuggle the reasoning
 * through its own fields, so the allowed set is ENUMERATED rather than left to
 * whatever a generator happens to return.
 *
 * `evidence` is the claim's support as a reader of the verdict sees it — not a
 * chain of thought. Anything a generator adds outside this set is dropped by
 * `sanitiseFinding` below, which is what makes REQ-682-4 testable instead of
 * aspirational.
 */
export const CARRIED_FIELDS = Object.freeze([
  'id', 'severity', 'evidence_class', 'title', 'evidence', 'cites', 'file', 'line',
]);

/**
 * sanitiseFinding() — PURE. Projects a generated finding onto `CARRIED_FIELDS`.
 *
 * The drop is silent on purpose and it is the safe direction: a field the
 * verdict would not render must not reach the challenger, and a generator that
 * grows a new field does not get to widen the boundary by existing. When a
 * field genuinely belongs on the wire, it is added HERE and to the renderer,
 * together — which is the review this file wants to force.
 *
 * @param {object} finding
 * @returns {object} a new object carrying only the enumerated fields present
 */
export function sanitiseFinding(finding = {}) {
  const out = {};
  for (const k of CARRIED_FIELDS) {
    if (finding[k] !== undefined) out[k] = finding[k];
  }
  return out;
}

/**
 * evaluateInferential() — PURE over an already-gathered generator result.
 *
 * Shape matches the other three evaluators (`{conclusion, gates, findings,
 * conditions, escalate}`) so `cli.mjs` merges it without a special case.
 *
 * Every emitted finding is forced to `evidence_class: 'inferential'`. A judgment
 * evaluator claiming `deterministic` would put a reasoned claim on the
 * deterministic side of #575 Ruling 3 and skip the refuter entirely — the one
 * mislabelling that would make the whole challenger unreachable.
 *
 * @param {{ generated?: Array<object>|null }} input
 * @returns {{conclusion: string|null, gates: {required: string[], detection: string[]}, findings: object[], conditions: string[], escalate: null}}
 */
export function evaluateInferential({ generated = null } = {}) {
  const findings = (generated ?? []).map(f => ({
    ...sanitiseFinding(f),
    evidence_class: 'inferential',
  }));

  return {
    conclusion: null,
    gates: { required: [], detection: [] },
    findings,
    conditions: [],
    // NEVER escalates on its own. Escalation for a reasoned finding is the
    // CHALLENGER's decision (`resolve-challenger.mjs`, REQ-682-6) — a producer
    // that escalated its own claims would be judging them, which is the
    // self-attestation ADR-0031 refuses.
    escalate: null,
  };
}

/**
 * gatherInferentialInputs() — the DI seam, matching the other evaluators.
 *
 * `deps.generate` is the transport. There is no production default and this
 * file will not invent one: slice 3's ADR decides whether it is an SDK call, a
 * spawned agent, or the harness, and that decision changes the reviewer's
 * network, credential and determinism surface.
 *
 * Returns `{ generated: null }` when no generator is supplied — and the CALLER
 * must then not run this evaluator at all, rather than run it and declare
 * `inferential` over an empty list. `shouldRun()` below is that decision, kept
 * next to this one so the two cannot drift.
 *
 * It passes COORDINATES, not a diff string: `worktreePath` + `baseSha` +
 * `headSha` + `changedFiles`. `cli.mjs` computes the changed-file list but never
 * materialises the diff text, so accepting a `diff` parameter here would mean
 * handing the generator an empty string while pretending it had the diff —
 * `evidence-reader-empty-on-failure` at the seam this whole ticket is about. The
 * generator reads the diff itself, from the cold worktree the reviewer already
 * cloned (protocol §8).
 *
 * @param {{ worktreePath?: string|null, baseSha?: string|null, headSha?: string|null,
 *           changedFiles?: string[], prBody?: string, deps?: {generate?: Function} }} args
 * @returns {Promise<{generated: Array<object>|null}>}
 */
export async function gatherInferentialInputs({
  worktreePath = null, baseSha = null, headSha = null,
  changedFiles = [], prBody = '', deps = {},
} = {}) {
  if (typeof deps.generate !== 'function') return { generated: null };
  const generated = await deps.generate({ worktreePath, baseSha, headSha, changedFiles, prBody });
  return { generated: Array.isArray(generated) ? generated : [] };
}

/**
 * shouldRun() — whether the judgment half runs at all on this review.
 *
 * TWO conditions, both required, and the second is the one that keeps this
 * honest: the tier/config must enable the producer, AND a generator must exist.
 * An enabled producer with no transport does not run, does not declare
 * `inferential`, and therefore cannot make the verdict claim a control it never
 * applied.
 *
 * @param {{ enabled?: boolean, generate?: unknown }} args
 * @returns {boolean}
 */
export function shouldRun({ enabled = false, generate = null } = {}) {
  return Boolean(enabled) && typeof generate === 'function';
}
