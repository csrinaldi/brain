// first-party/index.mjs — issue #814 T4: brain's first-party role content,
// keyed by stage. `null` for a stage brain claims no content for — this is a
// shelf of authored roles, not a registry obliged to answer everything (that
// obligation is an INHABITANT's, imposed by `role-port.mjs`).

import { ADVERSARY_COLD_REVIEW } from './adversary-cold-review.mjs';

const BY_STAGE = Object.freeze({
  [ADVERSARY_COLD_REVIEW.stage]: ADVERSARY_COLD_REVIEW,
});

/**
 * @param {string} stage
 * @returns {{stage: string, archetype: string, text: string, _provenance: object}|null}
 */
export function firstPartyRole(stage) {
  return BY_STAGE[stage] ?? null;
}
