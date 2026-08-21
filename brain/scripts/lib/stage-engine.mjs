// stage-engine.mjs — resolves `stage → { engine, model }` from `sdd.map`.
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

/** The stage the cold review runs as. Named here so callers stop spelling it. */
export const COLD_REVIEW_STAGE = 'cold-review';

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
