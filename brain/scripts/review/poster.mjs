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
// plus `labelAdd` for `reviewed:stale` (anti-stale) and `needs-decision`
// (escalation inbox, H1-5b, only when `escalate: 'human'` and the post
// actually landed) — both through `guardedLabelAdd`, never bare.
//
// Standing condition 1 (issue #266 comment 5004345710, "the constant is the
// seed, not the fence"): the `reviewed:stale` labelAdd is folded through
// `deny-set.mjs`'s `guardedLabelAdd` — the SAME hardcoded chokepoint every
// reviewer label add (this module's and `board.mjs`'s, H1-5b) passes
// through. Behavior is unchanged (`reviewed:stale` matches `reviewed:*` —
// allowed), but the label now clears the same fence, not a bare provider call.
//
// Escalation inbox, post half (H1-5b, candidate 4993202904, decided IN by
// plan 5011584432): when the verdict being posted carries
// `escalate: 'human'` (rulings always do — REQ-H1-11; `rev >= 3` also forces
// it — REQ-H1-6) AND the post actually lands (not skipped by anti-stale or
// anti-loop — an unposted verdict never touched this head, so nothing to
// escalate), the caller applies `needs-decision` through the same
// `guardedLabelAdd` chokepoint. This is what makes an escalation visible in
// `brain:review:queue`'s pending-escalations section (queue.mjs, REQ-H1-12).
// Removing `needs-decision` once the human decides is OUT OF SCOPE for H1 —
// a human/manual keystroke, not automated here.

import { getVcs } from '../vcs/cli.mjs';
import { guardedLabelAdd } from './deny-set.mjs';

const STALE_LABEL = 'reviewed:stale';
const ESCALATION_LABEL = 'needs-decision';

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
 * @param {'human'|null} [args.escalate]
 *   The verdict's own `escalate` field (`buildVerdict`'s output, verdict.mjs). When `'human'` AND the
 *   post actually lands, `needs-decision` is applied (escalation inbox, H1-5b).
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
  escalate = null,
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
    await guardedLabelAdd(vcs, { project, number, labels: [STALE_LABEL] });
    return { posted: false, skipped: 'anti-stale' };
  }

  // R1: mode === 'ruling' → issueComment (rulings post on the issue thread);
  // every other mode → prReviewComment. Neither verb has an APPROVE state —
  // `prReviewComment` hardcodes `event: 'COMMENT'` on both providers.
  const postFn = mode === 'ruling' ? vcs.issueComment : vcs.prReviewComment;
  const result = await postFn({ project, number, body: renderedBody });

  // Escalation inbox, post half: only reachable once the verdict actually
  // landed at this head (past both anti-stale and anti-loop) — an unposted
  // verdict never bound to the current tree, so nothing to escalate yet.
  if (escalate === 'human') {
    await guardedLabelAdd(vcs, { project, number, labels: [ESCALATION_LABEL] });
  }

  return { posted: true, result };
}
