// deny-set.mjs — REQ-H1-14: the hardcoded label deny-set (protocol §9,
// design.md §7). A fail-closed ALLOW-LIST every `labelAdd` MUST pass
// through, hardcoded in the caller, not left to the model to remember.
//
// ALLOW (tightening, protocol §9): `decision`, `seq:*`, `reviewed:*`,
// `needs-ruling`. Everything else is DENIED — including the named
// loosen/unlock labels (`status:approved`, `size:exception`, `skip:*`,
// `override:*`) AND any unknown label not on the allow-list. The allow-list
// IS the fence; the named examples are illustrations of what it catches,
// not an exhaustive blacklist.
//
// `guardedLabelAdd` is the single chokepoint every reviewer write-path
// SHOULD share: `poster.mjs`'s anti-stale `reviewed:stale` label add is
// folded under it (standing condition 1, issue #266 comment 5004345710:
// "the constant is the seed, not the fence") and `board.mjs` (H1-5b) will
// pass through the same gate. The refusal happens BEFORE the provider is
// ever reached — `assertAllowed` throws synchronously, so `vcs.labelAdd`
// is never invoked for a denied label.

const ALLOWED_EXACT = new Set(['decision', 'needs-ruling']);
const ALLOWED_PREFIXES = ['seq:', 'reviewed:'];

/**
 * Pure predicate — no seams. `true` iff `label` is on the tightening
 * allow-list (§9). Fail-closed: anything not explicitly matched is denied.
 * @param {string} label
 * @returns {boolean}
 */
export function isAllowedLabel(label) {
  if (typeof label !== 'string' || label.length === 0) return false;
  if (ALLOWED_EXACT.has(label)) return true;
  return ALLOWED_PREFIXES.some(prefix => label.startsWith(prefix));
}

/**
 * Throws on the FIRST denied label in `labels`. Checking every label in the
 * batch means one denied label refuses the whole call — no partial apply.
 * @param {string[]} labels
 * @throws {Error} naming the refused label and the reason (protocol §9,
 *   REQ-H1-14)
 */
export function assertAllowed(labels) {
  for (const label of labels ?? []) {
    if (!isAllowedLabel(label)) {
      throw new Error(
        `deny-set: refused label "${label}" — the reviewer may only apply tightening labels ` +
          '(decision, seq:*, reviewed:*, needs-ruling); loosen/unlock labels ' +
          '(status:approved, size:exception, skip:*, override:*) and any label outside the ' +
          'allow-list are refused before labelAdd is invoked (protocol §9, REQ-H1-14).',
      );
    }
  }
}

/**
 * The single chokepoint every reviewer `labelAdd` call MUST pass through
 * (design.md §7). Checks `assertAllowed` BEFORE calling `vcs.labelAdd` — the
 * provider is never reached for a denied label.
 * @param {{ labelAdd: Function }} vcs
 * @param {{ project: string, number: number, labels: string[] }} args
 * @returns {Promise<object>} whatever `vcs.labelAdd` resolves to
 */
export async function guardedLabelAdd(vcs, { project, number, labels }) {
  assertAllowed(labels);
  return vcs.labelAdd({ project, number, labels });
}
