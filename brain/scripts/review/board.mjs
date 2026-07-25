// board.mjs — REQ-H1-13: rebuild seq:*/reviewed:* from the brain-review/1
// verdict blocks (protocol §9 — verdicts are truth, labels are the derived
// index; design.md §7). Composes `mrList` (open PRs) + per-PR `prReviews`
// (the verdict thread) + `prView` (current labels) → `parseVerdict` → the
// LATEST verdict on each thread determines the desired seq:*/reviewed:*
// label set → reconciled against the PR's current labels via
// `guardedLabelAdd`/`guardedLabelRemove` (deny-set.mjs), strictly within
// those two namespaces. A label desync is a rebuildable no-op — the board
// never trusts the label state, it recomputes it cold from the thread.
//
// `sequencing` (optional, protocol §6: "seq:* / reviewed:* only, never
// status:*") is read from the latest parsed verdict when present — no H1
// evaluator emits it yet (H1-2..H1-4 leave `sequencing` unset), so in
// today's tree this contributes nothing; the reconciliation path exists and
// is tested so the first evaluator that DOES set it needs no board change.

import { getVcs } from '../vcs/cli.mjs';
import { gitlabApiConfig } from '../vcs/ci-context.mjs';
import { parseVerdict } from './lib/parse-verdict.mjs';
import { guardedLabelAdd, guardedLabelRemove } from './deny-set.mjs';

const BOARD_PREFIXES = ['seq:', 'reviewed:'];

/**
 * Pure — denormalizes a verdict scalar (APPROVE|REVISE|STOP) to the
 * `reviewed:*` label it implies (spec.md REQ-H1-13's `reviewed:approved`
 * example, extended with the same past-tense convention for the other two
 * conclusions). An unrecognized/missing verdict yields `null` — nothing to
 * denormalize.
 * @param {string} [verdict]
 * @returns {string|null}
 */
export function reviewedLabelForVerdict(verdict) {
  switch (verdict) {
    case 'APPROVE': return 'reviewed:approved';
    case 'REVISE': return 'reviewed:revised';
    case 'STOP': return 'reviewed:stopped';
    default: return null;
  }
}

function inBoardNamespace(label) {
  return BOARD_PREFIXES.some(prefix => label.startsWith(prefix));
}

/**
 * Pure — given the latest parsed verdict on a thread and the PR's current
 * labels, computes what to add/remove to reconcile `seq:*`/`reviewed:*`
 * (protocol §9). Only labels within those two namespaces are ever touched;
 * anything else present on the PR (`decision`, `status:approved`, ...) is
 * left alone even when it is not part of the "desired" set.
 * @param {{ latestVerdict: object|null, currentLabels?: string[] }} [args]
 * @returns {{ toAdd: string[], toRemove: string[] }}
 */
export function reconcileBoardLabels({ latestVerdict, currentLabels = [] } = {}) {
  if (!latestVerdict) return { toAdd: [], toRemove: [] };

  const desired = new Set();
  const reviewedLabel = reviewedLabelForVerdict(latestVerdict.verdict);
  if (reviewedLabel) desired.add(reviewedLabel);
  for (const seqLabel of latestVerdict.sequencing ?? []) desired.add(seqLabel);

  const currentInNamespace = currentLabels.filter(inBoardNamespace);
  const toAdd = [...desired].filter(label => !currentInNamespace.includes(label));
  const toRemove = currentInNamespace.filter(label => !desired.has(label));

  return { toAdd, toRemove };
}

function defaultListOpenPrs({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, provider }) => (await getVcsFn({ provider })).mrList({ project, state: 'open' });
}

function defaultFetchPr({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => (await getVcsFn({ provider })).prView({ project, number });
}

// Mirrors cold-boot.mjs's defaultFetchReviews — same `prReviews` verb, same
// gitlab API-config wiring.
function defaultFetchReviews({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const reviews = await vcs.prReviews({ project, number, apiBase, token, proxyUrl });
    return reviews ?? [];
  };
}

/**
 * Reconciles ONE PR's `seq:*`/`reviewed:*` labels against its verdict
 * thread. Makes ZERO write calls when already in sync.
 * @param {{ project?: string, number: number, provider?: string, deps?: object }} args
 * @returns {Promise<{ number: number, toAdd: string[], toRemove: string[] }>}
 */
export async function reconcileOnePr({ project, number, provider, deps = {} } = {}) {
  const fetchPr = deps.fetchPr ?? defaultFetchPr(deps);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(deps);
  const getVcsFn = deps.getVcs ?? getVcs;

  const [prView, reviews] = await Promise.all([
    fetchPr({ project, number, provider }),
    fetchReviews({ project, number, provider }),
  ]);
  const verdicts = reviews.map(r => parseVerdict(r)).filter(Boolean);
  const latestVerdict = verdicts.length > 0 ? verdicts[verdicts.length - 1] : null;

  const { toAdd, toRemove } = reconcileBoardLabels({ latestVerdict, currentLabels: prView.labels ?? [] });
  if (toAdd.length === 0 && toRemove.length === 0) return { number, toAdd, toRemove };

  const vcs = await getVcsFn({ provider });
  if (toAdd.length > 0) await guardedLabelAdd(vcs, { project, number, labels: toAdd });
  if (toRemove.length > 0) await guardedLabelRemove(vcs, { project, number, labels: toRemove });
  return { number, toAdd, toRemove };
}

/**
 * Composes `mrList` (open PRs) + `reconcileOnePr` for each (REQ-H1-13).
 * @param {{ project?: string, provider?: string, deps?: object }} [args]
 * @returns {Promise<Array<{ number: number, toAdd: string[], toRemove: string[] }>>}
 */
export async function runBoard({ project, provider, deps = {} } = {}) {
  const listOpenPrs = deps.listOpenPrs ?? defaultListOpenPrs(deps);
  const prs = await listOpenPrs({ project, provider });

  const results = [];
  for (const pr of prs) {
    results.push(await reconcileOnePr({ project, number: pr.number, provider, deps }));
  }
  return results;
}
