// findings-artifact.mjs — the file contract between the cold-review STAGE and
// `brain:review` (issue #682 slice 3, ADR-0033).
//
// The stage's engine writes `openspec/reviews/pr-NNN/cold-review.md`; this
// module reads it. The engine never posts: it has no VCS credential and no
// connection to the forge. Everything that touches the forge stays in the
// poster, where reviewer-protocol.md §2's three structural locks already live.
//
// ── WHY THE TAG IS THE SELECTOR, AND NOT `protocol:` ─────────────────────────
//
// #495 D1, carried into ADR-0032, splits fenced blocks into two families: one
// POSTED to the VCS (```yaml + `protocol: <name>`), one a FILE READ BY A VERB
// (```<name>, where the tag itself selects). This is the second.
//
// The rule is load-bearing, not stylistic. `parse-verdict.mjs` accepts any block
// whose `protocol:` reads `brain-review/1|2`, and `cold-boot.mjs` derives `rev`
// and holds the anti-loop lock from the verdict blocks it finds. An artifact
// written in the first family's shape becomes, once committed, a verdict block
// living in the repo — corrupting a count that decides whether a review may run
// at all. So a block carrying that shape is REFUSED here by name.
//
// ── WHY THE PAYLOAD IS JSON, MEASURED RATHER THAN PREFERRED ──────────────────
//
// The obvious move is to reuse the verdict's own findings encoding. Measured on
// `main @ fb96485`, against `parse-verdict.mjs`'s list reader:
//
//   findings list at 2-space indent (what renderVerdict emits) → 1 entry
//   the same list at 0 indent (what `yaml.dump` emits by default) → 0 entries
//   the same list at 4-space indent                              → 0 entries
//
// Its entry regexes are anchored to the exact indentation of one emitter, and a
// list it cannot read comes back as EMPTY rather than as uncomputable. That is
// survivable for a block this repo's own renderer produced; it is not survivable
// for a file written by a model, where indentation is exactly the detail no one
// controls. A dropped finding must never be reachable by a whitespace choice.
//
// JSON has one spelling, escapes its own newlines, and `evidence` in a real cold
// review is paragraphs long.

import { fencedBlocks } from '../../lib/fenced-blocks.mjs';
import { CARRIED_FIELDS, sanitiseFinding } from '../evaluators/inferential.mjs';

/** The tag that selects this artifact's block. The tag IS the selector (#495 D1). */
export const ARTIFACT_TAG = 'brain-findings/1';

/** The shape this reader refuses out loud, and the reason it exists. */
const POSTED_FAMILY_RE = /^\s*protocol:\s*brain-review\//m;

/**
 * readFindingsArtifact() — PURE over the artifact's text.
 *
 * Four answers, and the first three are FAILURES rather than empty results
 * (REQ-S3-4). `cli.mjs` refuses to post on a failure: a verdict declaring the
 * inferential control applied over findings nobody produced is the
 * uncomputable-evidence APPROVE §10 forbids, and "the file was not there" and
 * "the reader found nothing" are different states that must not render alike.
 * That distinction is the whole of #552, one layer up.
 *
 * @param {string|null|undefined} text
 * @returns {{ok: true, findings: object[]} | {ok: false, reason: string}}
 */
export function readFindingsArtifact(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, reason: 'the artifact is missing or empty' };
  }

  // Checked BEFORE block selection: a file may carry the posted family's shape
  // without ever declaring our tag, and that file is still the hazard.
  if (POSTED_FAMILY_RE.test(text)) {
    return {
      ok: false,
      reason:
        'the artifact carries a `protocol: brain-review/...` line — that is the shape of a ' +
        'block POSTED to the VCS, and parse-verdict.mjs would read this file as a verdict, ' +
        `corrupting rev and the anti-loop lock. A repo file declares itself by its FENCE TAG: ` +
        `use a \`\`\`${ARTIFACT_TAG} block (#495 D1, ADR-0032).`,
    };
  }

  const { blocks } = fencedBlocks(text);
  const found = blocks.filter((b) => b.tag === ARTIFACT_TAG);

  if (found.length === 0) {
    return { ok: false, reason: `no \`\`\`${ARTIFACT_TAG} block in the artifact` };
  }
  // Two blocks are an authoring mistake with no safe resolution: picking the
  // first would silently drop findings, and merging would invent an order the
  // author did not write.
  if (found.length > 1) {
    return { ok: false, reason: `${found.length} \`\`\`${ARTIFACT_TAG} blocks — expected exactly 1` };
  }

  let payload;
  try {
    payload = JSON.parse(found[0].content);
  } catch (err) {
    return { ok: false, reason: `the ${ARTIFACT_TAG} block is not valid JSON: ${err.message}` };
  }

  const list = Array.isArray(payload) ? payload : payload?.findings;
  if (!Array.isArray(list)) {
    return {
      ok: false,
      reason: `the ${ARTIFACT_TAG} block must be a JSON array of findings, or an object with a "findings" array`,
    };
  }
  if (!list.every((f) => f !== null && typeof f === 'object' && !Array.isArray(f))) {
    return { ok: false, reason: `every entry of ${ARTIFACT_TAG} must be an object` };
  }

  // Projected onto CARRIED_FIELDS here, at the boundary, so a generator that
  // grows a field does not widen it by existing (REQ-682-4). The membership
  // oracle is not this list — see inferential.mjs.
  return { ok: true, findings: list.map(sanitiseFinding) };
}

/** The fields an artifact entry may carry. Re-exported so a writer has one import. */
export { CARRIED_FIELDS };
