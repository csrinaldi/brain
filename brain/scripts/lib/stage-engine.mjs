// stage-engine.mjs — resolves `stage → { engine, model }` from `sdd.map`.
//
// SDD_LIFECYCLE_STAGES is a RE-EXPORT of sdd-layout.mjs's LIFECYCLE_STAGES
// (issue #456 slice A, design D2): this file used to hold its own bare-name
// literal, one of the THREE declarations of the set §1's measurement found.
// The value is byte-identical — same four, same order, same Object.freeze —
// so assertRoutableStage below needs no change, and its tests stay green
// UNMODIFIED (ADR-0019 Amendment 1 condition 4's load-bearing constraint).
//
// This is M8's router (#323) in embryo, and it is deliberately not called the
// reviewer's anything: the cold review is a STAGE, and the question "which
// engine produces this stage's artifact, with which model" is the same question
// for every stage. #682's `cold-review` is its first inhabitant, not a special
// case (ADR-0033).
//
// WHAT THIS DOES NOT DO, and both are rulings rather than omissions:
//
//   - It does not interpret `model`. #323 ruled the field an opaque
//     pass-through: brain never validates it against a catalogue, maps it to a
//     tier, or infers a default from it. Model ids change monthly; a contract
//     should not.
//   - It does not decide whether a stage MAY be routed. That is the doctrine
//     question ADR-0024 predicted (a stage producing one of the four SDD
//     artifacts is M8's problem, and Compuerta 1 is still open on it).
//     `cold-review` produces none of them, which is why ADR-0033 could land
//     without answering it.

import { LIFECYCLE_STAGES } from './sdd-layout.mjs';

/** The stage the cold review runs as. Named here so callers stop spelling it. */
export const COLD_REVIEW_STAGE = 'cold-review';

/**
 * The four stages of the SDD artifact lifecycle — the ones ADR-0019 protects.
 *
 * Their artifacts live in a change dir, are walked by `phase-order`'s Rules A
 * and C, and are consolidated by `change:archive`. ADR-0019's FIRST rejected
 * alternative is that routing them per-backend would fork that lifecycle:
 *
 *   > "Expand `VALID_OPS` to route scaffold/verify/archive per-backend.
 *   >  REJECTED: … the SDD artifact lifecycle would fork per harness instead of
 *   >  staying one evidence contract."
 *
 * Re-exported from `sdd-layout.mjs`'s `LIFECYCLE_STAGES` (issue #456 slice A) —
 * the name survives here because callers already import it from this module;
 * the literal does not, because `sdd-layout.mjs` is now THE ONE declaration.
 * `assertRoutableStage` below refuses against this constant, never against a
 * consumer's resolved (config-dependent) set — additive-only guarantees the
 * four are always present here, so the refusal cannot be relaxed by a
 * consumer's `sdd.stages` declaration.
 */
export const SDD_LIFECYCLE_STAGES = LIFECYCLE_STAGES;

/**
 * assertRoutableStage() — ADR-0019's boundary, made executable.
 *
 * ADR-0033 could land without resolving Compuerta 1 (whether M8's router needs a
 * supersede) for one reason: `cold-review` produces none of the four. That is an
 * argument about which stages are routed, and an argument is only as good as the
 * thing that keeps it true. So the code refuses the case the argument excludes,
 * instead of a comment promising nobody will write it.
 *
 * When M8 decides that a lifecycle stage MAY be routed, this function is where
 * that decision lands — visibly, in a diff, with an ADR beside it.
 *
 * @throws {Error} when the stage is one of the four
 */
export function assertRoutableStage(stage) {
  // A NON-STAGE IS REFUSED FIRST, and it used to pass (#682, found while
  // measuring judgment:cold-5). This guard is the executable form of ADR-0019's
  // boundary — the comment above `VALID_OPS` says so in as many words — and it
  // only ever compared against the lifecycle list, so `undefined`, `null` and
  // `''` were all "not a lifecycle stage" and sailed through.
  //
  // That is how the argv path got as far as it did: `runStage('cold-review', p)`
  // destructures a STRING, every field lands `undefined`, and the one thing that
  // should have refused an unnamed stage waved it past. What refused it instead
  // was the prompt check, two lines later, reporting `stage "undefined"` — a
  // true message about the wrong problem.
  //
  // "Not a lifecycle stage" and "not a stage at all" are different facts, and a
  // guard that answers the same thing to both reports a check it never made.
  if (typeof stage !== 'string' || stage.trim() === '') {
    throw new Error(
      `stage-engine: ${JSON.stringify(stage)} is not a stage name. Refusing rather than ` +
      'treating it as routable: an unnamed stage is not a stage outside the lifecycle, it is ' +
      'a caller that lost its argument, and passing it here sends an engine to run nothing.'
    );
  }

  if (SDD_LIFECYCLE_STAGES.includes(stage)) {
    throw new Error(
      `stage-engine: "${stage}" is an SDD lifecycle stage and may not be routed to an engine. ` +
      'ADR-0019 rejected per-backend routing of the artifact lifecycle: it would fork one ' +
      'evidence contract into one per harness. Routing it is M8\'s decision (#323) and needs ' +
      'its own doctrine — see ADR-0024 lines 53-55.'
    );
  }
}

/**
 * resolveStageEngine() — PURE.
 *
 * @param {{sdd?: {map?: Record<string, {engine?: string, model?: string}>}}} config
 * @param {string} stage
 * @returns {{engine: string, model: string|null}|null} `null` when unrouted
 * @throws {Error} when the entry exists and cannot be read
 */
export function resolveStageEngine(config, stage) {
  if (typeof stage !== 'string' || stage === '') {
    throw new Error('stage-engine: a stage name is required.');
  }

  const map = config?.sdd?.map;
  if (map === undefined || map === null) return null;
  if (typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('stage-engine: sdd.map must be an object of stage → { engine, model }.');
  }

  const entry = map[stage];
  // UNROUTED IS NOT AN ERROR. A repo that has not routed a stage has not
  // misconfigured anything, and the caller renders that as "no transport" rather
  // than as a refusal — the distinction slice A already holds one layer down.
  if (entry === undefined || entry === null) return null;

  if (typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(
      `stage-engine: sdd.map["${stage}"] must be an object with an "engine" — got ${Array.isArray(entry) ? 'an array' : typeof entry}.`
    );
  }

  // FAIL CLOSED ON A ROUTED-BUT-UNREADABLE ENTRY. An operator who wrote the key
  // asked for something; giving them silence instead would be the shape #382/#413
  // refuse at boot. `{}` is not "no opinion" once the key exists.
  if (typeof entry.engine !== 'string' || entry.engine.trim() === '') {
    throw new Error(
      `stage-engine: sdd.map["${stage}"] names no engine. Routing a stage to nothing is not a route — ` +
      'remove the entry to leave the stage unrouted.'
    );
  }
  if (entry.model !== undefined && entry.model !== null && typeof entry.model !== 'string') {
    throw new Error(
      `stage-engine: sdd.map["${stage}"].model must be a string id or absent — brain passes it ` +
      'through opaquely and never interprets it (#323).'
    );
  }

  return { engine: entry.engine, model: entry.model ?? null };
}
