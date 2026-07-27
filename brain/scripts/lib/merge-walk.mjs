// merge-walk.mjs — the shared first-parent merge walk (EVIDENCE + VERDICT
// layers only, design §"Technical Approach", issue #324/M9).
//
// EXTRACTED VERBATIM from brain-audit.mjs (issue #324 Phase 1): the walk that
// enumerates first-parent merges and re-derives each one's governance verdict
// is now the SAME code both `brain-audit` (enforcement) and `brain-metrics`
// (reporting) run — duplicating it would guarantee the exact drift between
// measurement and enforcement the metrics verb exists to prevent (design D1).
//
// This module is I/O-heavy (git subprocess calls, best-effort VCS fetches) but
// contains NO emission (no console.log) and NO process.exit — those stay in
// each CLI (brain-audit.mjs / brain-metrics.mjs), which set their own failure
// policy over this fail-closed core (design D2): brain-audit exits 2 on a
// throw, brain-metrics catches per-merge and counts an `uncomputable` row.
//
// Layer split (design table):
//   EVIDENCE  — listMerges, readMergeParent, readMergeDiff, fetchPrMeta.
//               Enumerate merges, window anchors, per-merge parents/numstat/
//               changed-files/body, one prView() per merge for labels+body.
//   VERDICT   — evaluateMerge, resolvedSkipLine. Runs the 4 checks,
//               shouldSkipSize, resolvedSkipLine, and the reverter exemption
//               (addedPathsAbsentAt + netAddFull).
//
// Emission ([PASS]/[FAIL]/[SKIP] lines, [FAIL-SHA] dedup + payloadSignature,
// crossCheckExit) stays in brain-audit.mjs — it is a judgment about how to
// REPORT a verdict, not part of computing the verdict itself.

import { getVcs } from '../vcs/cli.mjs';
import { parsePrNumber, shouldSkipSize, selectIssueLinkBody, auditedTip } from './audit-helpers.mjs';
import { gitOrThrow } from '../governance/postmerge/git-seam.mjs';
import { diffSize } from '../governance/checks/diff-size.mjs';
import { issueLink } from '../governance/checks/issue-link.mjs';
import { adrPresence } from '../governance/checks/adr-presence.mjs';
import { memoryPresence } from '../governance/checks/memory-presence.mjs';
// COMPOSE the frozen net-parity primitives (design §15, PR2b). NEVER import the
// retired direction-blind pairwise `isReverterOf` — a no-import drift-guard test
// (brain-audit.test.mjs) asserts it never reappears in this module.
import { isResolvedAt, netAddFull, addedPathsAbsentAt, revertResurrectsAt } from '../governance/postmerge/resolution.mjs';

/**
 * The subset of the four checks whose PASS/FAIL verdict is a pure function of
 * the commit's TREE (changed paths / the diff itself) — as opposed to its
 * commit/PR body (`issueLink`, free text) or repo-global state at HEAD
 * (`memoryPresence`). Only a tree-keyed check can be causally mirrored by a
 * commit's contribution being the net-inverse of an offender's, so ONLY these
 * classes are ever exempted by the reverter-skip and ONLY these emit the
 * `[FAIL-SHA]` auto-revert signal (design §15.5, REQ-D2-10a).
 */
export const TREE_KEYED_CHECKS = new Set(['adrPresence', 'diffSize']);

/**
 * Pre-evaluation resolved-skip (design §3.5/§15.3, REQ-D2-10): a merge whose own
 * first-parent contribution is NET-ABSENT at HEAD under exact-normDiff net-parity
 * accounting is skipped BEFORE any of the four checks run — including
 * memoryPresence. `isResolvedAt` is pure-read and fail-CLOSED: an offender whose
 * own contribution cannot be computed THROWS rather than returning a verdict.
 * This function deliberately does NOT try/catch that throw — swallowing it here
 * would be the ad-hoc silent skip design §5/REQ-D2-12 forbids. The one place the
 * throw is allowed to surface is the CLI's top-level fail-closed catch → exit 2.
 * Anchored at HEAD (§2.2 — every window ends at HEAD).
 */
export function resolvedSkipLine(sha, subject, { git, tip }) {
  // MINOR 1 (ruling rev 3) — the tip is REQUIRED, never defaulted to 'HEAD'.
  // `resolveRange` accepts an arbitrary range, so anchoring liveness at a
  // hardcoded 'HEAD' answers a question about a different commit than the one
  // being audited: an offender reverted PAST the audited tip would be exempted
  // out of a window that never contained the revert. A default would leave that
  // fail-open one careless caller away — and an exported guard whose soundness
  // depends on its caller is unsound by design. So: throw.
  if (!tip) {
    throw new Error('resolvedSkipLine: no audited tip supplied — refused fail-closed (design §2.2)');
  }
  const { resolved } = isResolvedAt(sha, tip, { git });
  return resolved ? `[SKIP] ${sha.slice(0, 7)} ${subject} — resolved by revert` : null;
}

/**
 * Enumerate the first-parent merges in `range` plus the window anchors every
 * skip/exemption predicate shares (design "Data Flow").
 *
 * Range-load via the throwing seam (salvaged R-2 exit-2 site, re-derived
 * against git-seam.mjs — never cherry-picked; design §8): a throwing call
 * distinguishes "git could not compute the range" (infra → fail-closed) from
 * "the range genuinely has zero merges" (→ `merges: []`, a caller decision).
 *
 * @param {string} range
 * @param {string} cwd
 * @returns {{ merges: {sha: string, subject: string}[], windowFrom: string|null, windowTo: string }}
 */
export function listMerges(range, cwd) {
  const log = gitOrThrow(['log', '--first-parent', '--merges', '--format=%H%x09%s', range], { cwd }).trim();
  const windowTo = auditedTip(range);
  if (!log) return { merges: [], windowFrom: null, windowTo };

  const merges = log.split('\n').filter(Boolean).map(line => {
    const i = line.indexOf('\t');
    return { sha: line.slice(0, i), subject: line.slice(i + 1) };
  });

  // The reverter-skip is FULL-WINDOW (design §15.3): its signed count must see
  // an offender sitting at the window base BEHIND a tip-most cleanup revert.
  // `netAddFull` enumerates `${from}^1..${to}`, so `from` is the OLDEST merge in
  // the window (git log is newest-first) — a merge, so `from^1` always resolves,
  // and the inclusive window then covers every audited merge. `to` is always HEAD.
  const windowFrom = merges[merges.length - 1].sha;
  return { merges, windowFrom, windowTo };
}

/**
 * Resolve a merge's first parent — a `--merges`-qualified commit always has
 * ≥2 parents; reaching a missing parent1 means the local git state cannot
 * answer (never a silent skip, design §5). Fail-closed: throws with the exact
 * message brain-audit's top-level catch prints (byte-identical to pre-
 * extraction output — the catch prepends `[FAIL] governance:audit-uncomputable
 * — ` to `err.message`).
 *
 * @param {string} sha
 * @param {string} subject
 * @param {string} cwd
 * @returns {string} parent1 sha
 */
export function readMergeParent(sha, subject, cwd) {
  const parents = gitOrThrow(['log', '-1', '--format=%P', sha], { cwd })
    .trim().split(/\s+/).filter(Boolean);
  const parent1 = parents[0];
  if (!parent1) {
    throw new Error(`${sha.slice(0, 7)} ${subject}: no resolvable parent`);
  }
  return parent1;
}

/**
 * Read a merge's diff evidence (numstat, changed files, commit body).
 *
 * MINOR 2 (external ruling rev 3 on #297): there is deliberately NO
 * error-swallowing `git()` helper here. Every read goes through `gitOrThrow`,
 * so a transient git failure THROWS instead of returning an EMPTY diff that
 * would make diffSize and adrPresence PASS silently. Returning '' on failure
 * was a silent fail-open inside the one slice whose thesis is "never a silent
 * PASS". A source-scan test in brain-audit.test.mjs keeps the helper from
 * returning.
 *
 * @param {string} parent1
 * @param {string} sha
 * @param {string} cwd
 * @returns {{ numstat: string, changedFiles: string[], body: string }}
 */
export function readMergeDiff(parent1, sha, cwd) {
  const numstat = gitOrThrow(['diff', '--numstat', parent1, sha], { cwd }).trim();
  const changedFiles = gitOrThrow(['diff', '--name-only', parent1, sha], { cwd })
    .split('\n').filter(Boolean);
  const body = gitOrThrow(['log', '-1', '--format=%B', sha], { cwd }).trim();
  return { numstat, changedFiles, body };
}

/**
 * Best-effort PR metadata fetch (single call for labels + body). Parse the PR
 * number from the merge subject, then fetch the PR once for:
 *   • labels  → size:exception check (diffSize skip)
 *   • body    → issueLink check (PR description has Closes/Part of #N;
 *               merge commit body is typically "Merge pull request #N")
 *
 * Any failure (VCS unconfigured, adapter error, no PR number found) leaves
 * both null (uncomputable — REQ-CIC-2) and falls back to commit-body
 * behavior. NEVER crash, and NEVER collapse a fetched-but-null value back
 * into a fabricated [] / '' default — `shouldSkipSize()`/`selectIssueLinkBody()`
 * already treat null as "no evidence" correctly; re-fabricating an empty
 * default here would re-introduce the exact fail-open the seam removes, just
 * on a parallel path (prView fix-at-source disposition).
 *
 * @param {string} subject
 * @param {object|null} vcs
 * @param {object} config
 * @returns {Promise<{ prNum: number|null, prLabels: string[]|null, prBody: string|null }>}
 */
export async function fetchPrMeta(subject, vcs, config) {
  let prLabels = null;
  let prBody = null;
  const prNum = parsePrNumber(subject);
  if (prNum !== null && vcs) {
    try {
      const pr = await vcs.prView({
        project: config?.project?.slug,
        number: prNum,
      });
      prLabels = pr.labels;
      prBody = pr.body;
    } catch {
      // VCS call failed — proceed without PR metadata (audit normally)
    }
  }
  return { prNum, prLabels, prBody };
}

/**
 * VCS adapter resolution for the size:exception label check (best-effort). If
 * the adapter is unavailable or misconfigured, callers proceed without the
 * size:exception bypass — never crash on a missing VCS config.
 *
 * @param {object} config
 * @returns {Promise<object|null>}
 */
export async function resolveVcs(config) {
  try {
    return await getVcs({ config });
  } catch {
    return null;
  }
}

/**
 * Evaluate a single merge's governance verdict — the VERDICT layer (design
 * table). Runs the 4 checks, applies the size:exception skip, then the
 * reverter exemption (tree-keyed only), and finally decides whether a
 * surviving tree-keyed failure is auto-revert-nominable.
 *
 * Returns BOTH `realResults` (the four checks evaluated UNCONDITIONALLY,
 * ignoring the size:exception label — the "raw" signal brain-metrics' D5
 * raw/enforced split needs) and `results` (the label-adjusted view
 * brain-audit's own emission uses, where `diffSize` is force-passed when
 * `size:exception` is present).
 *
 * @param {string} sha
 * @param {object} ctx
 * @param {string} ctx.numstat
 * @param {string[]} ctx.changedFiles
 * @param {string} ctx.issueLinkBody
 * @param {string[]|null} ctx.prLabels
 * @param {string[]} ctx.ignoreList
 * @param {Array} ctx.allObservations
 * @param {{orThrow: Function}} ctx.resolutionGit
 * @param {string} ctx.windowFrom
 * @param {string} ctx.windowTo
 * @returns {{
 *   kind: 'pass'|'reverter-skip'|'fail',
 *   results: object,
 *   realResults: object,
 *   sizeSkipped: boolean,
 *   failures?: [string, object][],
 *   surviving?: [string, object][],
 *   exempt?: boolean,
 *   survivesTreeKeyed?: boolean,
 *   nominable?: boolean,
 * }}
 */
export function evaluateMerge(sha, ctx) {
  const {
    numstat, changedFiles, issueLinkBody, prLabels, ignoreList,
    allObservations, resolutionGit, windowFrom, windowTo,
  } = ctx;

  const sizeSkipped = shouldSkipSize(prLabels);

  // `realResults` is the UNCONDITIONAL check — always run, regardless of the
  // size:exception label. brain-audit's own `results` (below) is the
  // label-adjusted view it emits from; brain-metrics' raw/enforced split
  // (design D5) needs BOTH views simultaneously.
  const realResults = {
    diffSize: diffSize(numstat, ignoreList),
    issueLink: issueLink(issueLinkBody),
    adrPresence: adrPresence(changedFiles),
    memoryPresence: memoryPresence(allObservations),
  };

  const results = {
    ...realResults,
    diffSize: sizeSkipped
      ? { pass: true, note: 'size:exception label present — diffSize skipped' }
      : realResults.diffSize,
  };

  const failures = Object.entries(results).filter(([, r]) => !r.pass);

  if (failures.length === 0) {
    return { kind: 'pass', results, realResults, sizeSkipped };
  }

  // ── Reverter-skip (design §15.3, REQ-D2-10a; guard (c′) per the external
  // ruling rev 4 on #297) — evaluated ONLY for a merge that already failed, so
  // the happy path pays zero extra cost. See brain-audit.mjs's history for the
  // full rationale (verbatim, unchanged by extraction).
  const failingNames = failures.map(([name]) => name);
  const hasTreeKeyed = failingNames.some((name) => TREE_KEYED_CHECKS.has(name));
  const exempt = hasTreeKeyed
    && addedPathsAbsentAt(sha, windowTo, { git: resolutionGit })
    && netAddFull(sha, { git: resolutionGit, from: windowFrom, to: windowTo }) <= 0;

  const surviving = failures.filter(([name]) => !(exempt && TREE_KEYED_CHECKS.has(name)));

  if (surviving.length === 0) {
    return { kind: 'reverter-skip', results, realResults, failures, sizeSkipped, exempt };
  }

  const survivingNames = surviving.map(([name]) => name);
  const survivesTreeKeyed = survivingNames.some((name) => TREE_KEYED_CHECKS.has(name));
  // `revertResurrectsAt` is only ever consulted when a tree-keyed failure
  // survives (short-circuit) — mirrors the original one-git-call-only-when-
  // needed shape verbatim.
  const nominable = survivesTreeKeyed && !revertResurrectsAt(sha, windowTo, { git: resolutionGit });

  return {
    kind: 'fail', results, realResults, failures, surviving, sizeSkipped, exempt, survivesTreeKeyed, nominable,
  };
}
