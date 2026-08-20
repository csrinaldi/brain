// resolve-challenger.mjs — constructs the refuter's runner from config and tier
// (issue #682, REQ-682-1/REQ-682-2/REQ-682-6).
//
// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONAL: THE AGENT/MODEL BINDING HERE BELONGS TO #312's ROLE PORT.
//
// `reviewer.inferential.challenger.{axis, agent, model}` binds a ROLE (the
// refuter) to an AGENT and a MODEL through `brain.config.json`. That is #312's
// port, #576's archetypes and #323's config map — three open, approved tickets
// whose entire subject is that binding.
//
// It lives here because M5 is at ZERO implementation and #682 could not wait:
// #599 measured it — `brain/roles/` does not exist and `harness/cli.mjs`'s
// `VALID_OPS` still routes one op — M8 depends on M5, and the chain has gone
// untouched across four handoff cuts.
//
// WHEN #312 LANDS: delete the binding half of this file and call the port
// instead. Keep only the AXIS resolution below — that is reviewer policy and
// belongs here either way. Written down rather than left implicit because #323
// exists precisely because the previous instance of this shape was not.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT THIS FILE IS NOT. It invents no port and no transport. `refuterRunner`
// has been an injection point since #552 (`cli.mjs`, the `applyCausalAdmission`
// call), so the seam already exists at the function level; this only supplies
// its constructor. The shape it must satisfy is fixed by `evaluateRefuter`:
//
//     runner(inferentialBlockers) -> { outcomes: [{ id, outcome, rationale }] }

import { tierParams } from '../../vcs/governance-tiers.mjs';
import { ROUTED_HUMAN } from '../evaluators/refuter.mjs';

/**
 * The axes #682 ruled on. A closed vocabulary: an unrecognised value is a
 * config typo, and REQ-682-1 refuses rather than silently defaulting — an
 * unknown axis is an unknown evidentiary strength, and #683's rule is that a
 * verdict whose self-description could be false is not posted at all.
 */
export const AXES = Object.freeze(['human', 'same-model', 'cross-family', 'mechanical']);

/**
 * Axes this build actually implements. Separate from `AXES` on purpose: "this
 * axis is not a real axis" and "this axis is real but unbuilt" are different
 * facts and they fail differently — the first at construction (a typo the
 * operator must fix), the second at call time (a build limitation the verdict
 * must state).
 *
 * `same-model` and `cross-family` join this list when their transport lands
 * (#682 slice 3, behind its own ADR). `mechanical` has no ticket yet.
 */
export const IMPLEMENTED_AXES = Object.freeze(['human']);

/**
 * humanRunner() — REQ-682-6, and the whole reason this is a runner rather than
 * a `null`.
 *
 * `null` already means something: `evaluateRefuter` reads it as "there is
 * nothing to challenge this with" and marks every reasoned blocker
 * `unchallenged`. "A human challenges this by design" is a DIFFERENT state, and
 * rendering the two identically re-folds exactly the pair #552 unfolded — one
 * layer up, and this time produced by a configuration option rather than by a
 * missing dependency.
 *
 * So the human axis returns a real runner that names its own outcome. The
 * finding keeps its severity: routing a claim to a person is not a judgment
 * about the claim.
 *
 * @param {Array<{id: string}>} blockers
 * @returns {Promise<{outcomes: Array<{id: string, outcome: string, rationale: string}>}>}
 */
async function humanRunner(blockers = []) {
  return {
    outcomes: blockers.map(f => ({
      id: f.id,
      outcome: ROUTED_HUMAN,
      rationale:
        'Routed to a human challenger by configuration (reviewer.inferential.challenger.axis = "human"). ' +
        'No automated challenge was attempted, and none was expected.',
    })),
  };
}

/**
 * unbuiltRunner() — an axis this build does not implement fails CLOSED when
 * invoked, and says which axis and why.
 *
 * It must not return `null`: `null` renders as `unchallenged`, whose meaning is
 * "nothing was available to challenge this". That is not what happened. What
 * happened is that the repo asked for an axis this build does not have — a
 * stronger statement, and one the operator can act on.
 *
 * It must not degrade to a weaker axis either. A tier that asked for stronger
 * evidence and silently received weaker is the defect #682 exists to remove;
 * `regulated` resolving to `cross-family` and quietly getting `same-model`
 * would be that defect wearing this ticket's own name.
 *
 * Unreachable today: nothing emits `evidence_class: 'inferential'`, so
 * `evaluateRefuter` returns before any runner is called. It is written now, and
 * fails closed, so that the day a producer lands this cannot be the branch
 * nobody thought about.
 *
 * @param {string} axis
 * @returns {(blockers: Array<object>) => Promise<never>}
 */
function unbuiltRunner(axis) {
  return async () => {
    throw new Error(
      `resolve-challenger: the "${axis}" axis is not implemented in this build. ` +
      `Implemented axes: ${IMPLEMENTED_AXES.join(', ')}. ` +
      'Refusing rather than challenging with a weaker axis than the one configured.'
    );
  };
}

/**
 * resolveChallenger() — PURE apart from the runner it returns.
 *
 * Resolution order (REQ-682-1):
 *   1. `reviewer.inferential.enabled` — `null`/absent resolves from the tier's
 *      `inferentialEnabled`. Off means there is no judgment half at all, so
 *      there is nothing to challenge: returns `null`, and that `null` is
 *      truthful rather than a fallback.
 *   2. `reviewer.inferential.challenger.axis` — `null`/absent resolves from the
 *      tier's `challengerAxis`.
 *   3. An axis outside `AXES` THROWS. Never a silent default (REQ-682-1).
 *
 * The axis is resolved ONCE, here, and the returned runner carries it. The
 * runner never re-reads config, because the verdict must declare the axis that
 * actually ran (REQ-682-3) — if the runner could resolve its own axis per call,
 * the declared value and the used value could diverge, and a verdict whose
 * self-description is false must not be posted (#683).
 *
 * @param {object} args
 * @param {object} [args.config]  a brain.config.json-shaped object
 * @param {'lite'|'standard'|'regulated'} args.tier  the already-resolved tier
 * @returns {((blockers: Array<object>) => Promise<{outcomes: Array<object>}>) | null}
 * @throws {Error} on an unrecognised axis, or an unknown tier (via tierParams)
 */
export function resolveChallenger({ config, tier } = {}) {
  const params = tierParams(tier);
  const inferential = config?.reviewer?.inferential ?? {};

  const enabled = inferential.enabled ?? params.inferentialEnabled;
  if (!enabled) return null;

  const axis = inferential.challenger?.axis ?? params.challengerAxis;

  if (!AXES.includes(axis)) {
    throw new Error(
      `resolve-challenger: unrecognised challenger axis ${JSON.stringify(axis)} — ` +
      `must be one of: ${AXES.join(', ')}. ` +
      'Refusing rather than defaulting: an unknown axis is an unknown evidentiary strength.'
    );
  }

  if (axis === 'human') return humanRunner;

  return unbuiltRunner(axis);
}

/**
 * resolveAxis() — the axis alone, for the verdict's declaration (REQ-682-3,
 * slice 2). Exported beside the constructor so the declared value and the used
 * value come from ONE resolution rather than two independently-typed notions of
 * "which axis is configured".
 *
 * @param {object} args
 * @param {object} [args.config]
 * @param {'lite'|'standard'|'regulated'} args.tier
 * @returns {string|null} the resolved axis, or `null` when no producer runs
 */
export function resolveAxis({ config, tier } = {}) {
  const params = tierParams(tier);
  const inferential = config?.reviewer?.inferential ?? {};
  const enabled = inferential.enabled ?? params.inferentialEnabled;
  if (!enabled) return null;
  return inferential.challenger?.axis ?? params.challengerAxis;
}
