// poster.mjs — REQ-H1-9: THE security boundary. Posts a rendered `brain-review/1`
// verdict through the COMMENT-only port verbs (ADR-0020) and enforces the two
// §10 failure-mode locks BEFORE any write is attempted. Mirrors the vcs/
// DI-seam house style (D1): a thin async core, `deps.getVcs` / `deps.reResolveHead`
// as the only seams.
//
// R1 (protocol §1-§2, ADR-0020): there is NO APPROVE path on this module —
// structurally, because the port itself (`vcs/cli.mjs`'s VERBS) defines no
// approve verb. `postVerdict` only ever calls `prReviewComment` (PR verdicts,
// `mode !== 'ruling'`) or `issueComment` (issue rulings, `mode === 'ruling'`),
// plus `labelAdd` for `reviewed:stale` ONLY (never any other label — the
// general deny-set lands in H1-5, but this module never reaches for anything
// beyond that one tightening label).

import { getVcs } from '../vcs/cli.mjs';

const STALE_LABEL = 'reviewed:stale';

/**
 * @param {object} args
 * @param {string} args.headSha        The run's own anchor (bound at cold boot).
 * @param {string} args.project
 * @param {number} args.number
 * @param {string} [args.provider]
 * @param {'tranche'|'checkpoint'|'ruling'} args.mode  Selects the write verb (design.md §6).
 * @param {string} args.renderedBody   The rendered `brain-review/1` block (verdict.mjs's renderVerdict).
 * @param {string} args.reviewerHandle
 * @param {Array<{head_sha:string, verdict:string, author:string|null}>} [args.priorVerdicts]
 *   Prior `brain-review/1` blocks on the thread, oldest-first (cold-boot's `doctrine.priorVerdicts`).
 * @param {{ getVcs?: Function, reResolveHead?: Function }} [args.deps]
 * @returns {Promise<{ posted: true, result: object } | { posted: false, skipped: 'anti-loop'|'anti-stale' }>}
 */
export async function postVerdict({
  headSha,
  project,
  number,
  provider,
  mode,
  renderedBody,
  reviewerHandle,
  priorVerdicts = [],
  deps = {},
} = {}) {
  // Anti-loop FIRST (protocol §10, "comment loop"): purely computed from
  // already-loaded cold-boot data — actor lock AND sha lock, both. No vcs
  // call is made at all when it fires (cheapest check, and "skip" means
  // exactly that: not even a re-fetch).
  const lastVerdict = priorVerdicts.length > 0 ? priorVerdicts[priorVerdicts.length - 1] : null;
  if (lastVerdict && lastVerdict.author === reviewerHandle && lastVerdict.head_sha === headSha) {
    return { posted: false, skipped: 'anti-loop' };
  }

  const getVcsFn = deps.getVcs ?? getVcs;
  const vcs = await getVcsFn({ provider });

  // Anti-stale (protocol §10, "stale verdict"): re-resolve the head against
  // the server; if it moved since cold boot captured `headSha`, the verdict
  // is bound to a tree that no longer exists at the tip — post nothing, mark
  // the run `reviewed:stale` (the ONLY label this module ever applies).
  const reResolveHead = deps.reResolveHead ?? (async () => (await vcs.prView({ project, number })).headRefOid);
  const currentHead = await reResolveHead();
  if (currentHead !== headSha) {
    await vcs.labelAdd({ project, number, labels: [STALE_LABEL] });
    return { posted: false, skipped: 'anti-stale' };
  }

  // R1: mode === 'ruling' → issueComment (rulings post on the issue thread);
  // every other mode → prReviewComment. Neither verb has an APPROVE state —
  // `prReviewComment` hardcodes `event: 'COMMENT'` on both providers.
  const postFn = mode === 'ruling' ? vcs.issueComment : vcs.prReviewComment;
  const result = await postFn({ project, number, body: renderedBody });
  return { posted: true, result };
}
