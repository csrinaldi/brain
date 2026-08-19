// resolve-challenger.mjs — ONE resolution of the judgment half (issue #682).
// REQ-682-1, REQ-682-2, REQ-682-3's axis value, REQ-682-6.
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
// WHEN #312 LANDS: delete the binding half and call the port instead. Keep the
// AXIS resolution — that is reviewer policy and belongs here either way.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY ONE FUNCTION AND NOT TWO — the correction the cold review forced.
//
// The first cut exported `resolveChallenger` and `resolveAxis` as near-copies,
// and they disagreed on two inputs. Worse, `cli.mjs` used `resolveAxis(...) !==
// null` as a PROXY for "is the producer enabled", which is a different question.
//
// And the producer's gate (`inferentialEnabled`) and the challenger's gate
// (`protocol === '/2'`) DISAGREED AT A SHIPPED TIER DEFAULT. At `standard`
// (`inferentialEnabled: true`, `reviewProtocol: 'brain-review/1'`) the producer
// ran and `applyCausalAdmission` was skipped entirely, so a reasoned blocker was
// produced, never challenged, never escalated — and the verdict declared
// `controls_not_applied: []`, i.e. the judgment control WAS applied. That is the
// exact state #552 ruled against, re-created by having a second gate.
//
// So there is now ONE resolution and one `run` flag that both halves read. They
// cannot disagree, because there is nothing left to disagree with.
//
// AND THE TIER DOES NOT APPEAR HERE — the second correction, and it undoes
// something this file's first cut got wrong at the doctrine level.
//
// The judgment half was originally resolved from `tierParams(tier)`. That
// violates ADR-0026's invariant 7 in the ADR's own words: *"position tiering
// applies only to ceremony, never to CORRECTNESS, traceability, agent
// containment, or internal consistency."* The judgment half is a control that
// FINDS DEFECTS. It is correctness, not ceremony, and it does not become more
// or less worth having because a team grew.
//
// The tier answers ONE question — can this team satisfy an approval
// requirement (#329, a solo maintainer cannot self-approve) — and a capability
// is not an answer to it. So the judgment half is a plain toggle: OFF unless a
// repo turns it on, at every tier, deliberately. The narrowing of the tier's
// scope across the rest of `tierParams` is #743.

import { ROUTED_HUMAN, UNCHALLENGED } from '../evaluators/refuter.mjs';

/** The axes #682 ruled on. A closed vocabulary — an unrecognised value refuses. */
export const AXES = Object.freeze(['human', 'same-model', 'cross-family', 'mechanical']);

/**
 * Axes this build implements. Separate from `AXES`: "not a real axis" (a typo
 * the operator fixes) and "real but unbuilt" (a property of the build) are
 * different facts and they are reported differently.
 */
export const IMPLEMENTED_AXES = Object.freeze(['human']);

/**
 * The protocol the judgment half requires, and it is not a preference.
 * `brain-review/1` renders neither `evidence_class` nor the refuter markers, so
 * at `/1` a reasoned finding is invisible AND unchallengeable — the producer
 * would be emitting claims into a format that cannot carry them.
 */
export const JUDGMENT_PROTOCOL = 'brain-review/2';

/**
 * humanRunner() — REQ-682-6, and the reason this is a runner rather than `null`.
 *
 * `null` already means something: `evaluateRefuter` reads it as "there is
 * nothing to challenge this with" and marks every reasoned blocker
 * `unchallenged`. "A human challenges this by design" is a DIFFERENT state, and
 * rendering the two identically re-folds the pair #552 unfolded.
 *
 * TOTAL over its input — one outcome per blocker, always. `evaluateRefuter` now
 * backstops a partial runner, but a runner shipped from here must not need it.
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
 * unbuiltRunner() — an axis this build does not implement.
 *
 * It reports every blocker `UNCHALLENGED` rather than throwing. The first cut
 * threw, and the cold review showed the throw is caught NOWHERE: it surfaced as
 * an unhandled rejection with no verdict posted, REPLACING #552's honest
 * `unchallenged` + `escalate: 'human'` + posted REVISE. Trading a posted
 * fail-closed verdict for a crash is a regression of #552's fix, not a louder
 * failure — the operator ends up with LESS information, not more.
 *
 * It still refuses to substitute a weaker axis: the rationale names the
 * configured axis, so a reader sees which challenge did not happen and why.
 * `evaluateRefuter` escalates on `UNCHALLENGED`, so the run fails closed and
 * says so on the wire instead of in a stack trace.
 */
function unbuiltRunner(axis) {
  return async (blockers = []) => ({
    outcomes: blockers.map(f => ({
      id: f.id,
      outcome: UNCHALLENGED,
      rationale:
        `The configured challenger axis "${axis}" is not implemented in this build ` +
        `(implemented: ${IMPLEMENTED_AXES.join(', ')}). Nothing challenged this finding. ` +
        'Refusing to substitute a weaker axis than the one configured.',
    })),
  });
}

/**
 * resolveJudgment() — the SINGLE gate for the judgment half.
 *
 * Returns `{ run, axis, challenger, reason }`:
 *   - `run`        — whether the judgment half runs AT ALL. Both the producer
 *                    and the challenger read this one flag.
 *   - `axis`       — the resolved axis as a VALUE, for the verdict's
 *                    declaration (REQ-682-3). `null` when the half does not run.
 *   - `challenger` — the runner, or `null` when the half does not run.
 *   - `reason`     — why it does not run. Never a silent `false`.
 *
 * Order (REQ-682-1):
 *   1. `reviewer.inferential.enabled` must be exactly `true`. No tier default
 *      and no truthy coercion — a capability that costs a credential is chosen.
 *   2. The protocol must be `brain-review/2` — see `JUDGMENT_PROTOCOL`.
 *   3. `reviewer.inferential.challenger.axis` must name one. No default.
 *   4. An axis outside `AXES`, or an enabled half naming none, THROWS. Both are
 *      operator-fixable config, and defaulting would choose an evidentiary
 *      strength on the operator's behalf.
 *
 * @param {{config?: object, protocol?: string}} args
 * @returns {{run: boolean, axis: string|null, challenger: Function|null, reason: string|null}}
 * @throws {Error} on an unrecognised axis, or an enabled half naming none
 */
export function resolveJudgment({ config, protocol = JUDGMENT_PROTOCOL } = {}) {
  const off = (reason) => ({ run: false, axis: null, challenger: null, reason });

  const inferential = config?.reviewer?.inferential ?? {};

  // OFF unless the repo says otherwise, at every tier. The default is a real
  // decision and not caution: the judgment half is the only control in brain
  // that needs an outbound model call, and a capability that costs a credential
  // must be chosen, never inherited. It is also what keeps a fresh install
  // credential-free (#435) — for a reason that is actually true, unlike the
  // tier-shaped story this file used to tell.
  if (inferential.enabled !== true) {
    return off(
      'the judgment half is off — set reviewer.inferential.enabled to true to turn it on. ' +
      'It is off by default at every tier because it is the one control that requires an ' +
      'outbound model call.'
    );
  }

  // The gate that used to live only at the challenger's call site. Reading it
  // HERE is what stops the two halves from disagreeing.
  if (protocol !== JUDGMENT_PROTOCOL) {
    return off(
      `the judgment half requires ${JUDGMENT_PROTOCOL} and this run is "${protocol}" — ` +
      `${protocol} renders neither evidence_class nor the refuter markers, so a reasoned ` +
      'finding would be neither visible nor challengeable. Set reviewer.protocol to ' +
      `${JUDGMENT_PROTOCOL} to enable the judgment half.`
    );
  }

  const axis = inferential.challenger?.axis;

  // Enabled with no axis REFUSES rather than defaulting. There is no tier to
  // inherit one from any more, and picking a default here would choose an
  // evidentiary strength on the operator's behalf — the thing #682 exists to
  // stop. Turning the half on is a decision; so is how it gets challenged.
  if (axis === null || axis === undefined) {
    throw new Error(
      'resolve-challenger: the judgment half is enabled but names no challenger axis. ' +
      `Set reviewer.inferential.challenger.axis to one of: ${AXES.join(', ')}. ` +
      'There is no default: an unchallenged reasoned blocker is what #552 ruled against.'
    );
  }

  if (!AXES.includes(axis)) {
    throw new Error(
      `resolve-challenger: unrecognised challenger axis ${JSON.stringify(axis)} — ` +
      `must be one of: ${AXES.join(', ')}. ` +
      'Refusing rather than defaulting: an unknown axis is an unknown evidentiary strength.'
    );
  }

  return {
    run: true,
    axis,
    challenger: axis === 'human' ? humanRunner : unbuiltRunner(axis),
    reason: null,
  };
}
