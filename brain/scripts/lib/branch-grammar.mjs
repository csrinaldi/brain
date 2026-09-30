// branch-grammar.mjs — the ONE reader of "which issue does this branch belong to" (#697).
//
// Two verbs compose branch names and used to have two readers that disagreed:
//   canonical  {type}/issue-{N}-{slug}  brain:ticket:start (documented in harness-contract.md)
//   legacy     {type}/{N}-{slug}        brain:start
// Pure, zero I/O. Returns null for anything else — never a fabricated number.

const CANONICAL = /^([a-z]+)\/issue-(\d+)-(.+)$/;
const LEGACY = /^([a-z]+)\/(\d+)-(.+)$/;

/**
 * @param {unknown} branch
 * @returns {{issueNumber: string, type: string, slug: string, shape: 'canonical'|'legacy'} | null}
 */
export function parseIssueBranch(branch) {
  const b = String(branch ?? '');
  let m = CANONICAL.exec(b);
  if (m) return { issueNumber: m[2], type: m[1], slug: m[3], shape: 'canonical' };
  m = LEGACY.exec(b);
  if (m) return { issueNumber: m[2], type: m[1], slug: m[3], shape: 'legacy' };
  return null;
}
