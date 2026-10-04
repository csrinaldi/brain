// team-config-reviewed.mjs — the owner gate over the TEAM config (#1263 slice 4, ADR-0040).
//
// Decides one thing: does a PR that touches `brain.config.json` (the project-owned team config at the repo
// root) carry an APPROVED review from a `governance.owners` login who is not the PR author?
//
//   · not touched                         → pass
//   · the base has no team config AND never had one, in a history that is not shallow (the ADOPTION PR, the founding
//     decision) → pass, labelled, tier `lite`. A base that once had it and lost it is a REMOVAL: the owners are those of
//     its LAST version (the commit before the deleting one) and the ordinary approval rule applies. A shallow history
//     cannot tell the two apart, so it is an evidence failure, never a founding.
//   · any touch of the root file counts — added, modified, deleted, renamed away or onto (the diff runs --no-renames)
//   · solo maintainer, tier lite (ADR-0037 mode A): exactly one owner, and that owner is the author → pass,
//     labelled the exception, never independent review
//   · an APPROVED review from an owner other than the author, ON THE CURRENT HEAD, and still that owner's latest
//     decisive review (a later CHANGES_REQUESTED/DISMISSED cancels it; an approval on an older commit is stale) → pass
//     — a `null` commitId (the forge cannot say) cannot be told from stale, so it fails closed
//   · otherwise → fail ("no owner declared" when the list is empty)
//
// `lite` is `detection` in GATE_MATRIX, so there a failure is a warning that names the tier; at standard and
// regulated it is required and a failure exits 1.
//
// OWNERS AND TIER ARE READ FROM THE BASE REF, never the PR head. If the head's config were trusted, a PR could
// add its own author to `governance.owners` (or demote `governance.tier` to lite) and approve itself in the same
// diff. `git show <baseSha>:brain.config.json` is the one source of both.
//
// Sibling to brain-writes-reviewed.mjs: a pure evaluator over plain data, a thin I/O wrapper with every effect
// injectable through `deps` (no test spawns git or reaches a forge), and a CLI entrypoint.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadContext, gitlabApiConfig } from './ci-context.mjs';
import { getVcs } from './cli.mjs';
import { resolveTier, resolveGatePolicy, TIERS } from './governance-tiers.mjs';

export const TEAM_CONFIG_PATH = 'brain.config.json';
const GATE = 'team-config-reviewed';

const lower = (v) => String(v).toLowerCase();

/** Bare, trimmed, de-duplicated logins: a leading `@` is dropped and anything that is not a string is ignored. */
function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  return [...new Set(owners.filter((o) => typeof o === 'string').map((o) => o.trim().replace(/^@/, '')).filter(Boolean))];
}

/**
 * Pure. @param {object} input
 * @param {string[]} [input.changedFiles]  `git diff --name-only BASE...HEAD`.
 * @param {Array<{state: string, author: string|null}>} [input.reviews]  Normalized PR reviews.
 * @param {string} [input.author]  PR author login.
 * @param {string[]|null} [input.owners]  `governance.owners` as declared on the BASE.
 * @param {'lite'|'standard'|'regulated'} [input.tier]
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string, soloMaintainer?: true }}
 */
export function evaluateTeamConfigReviewed({ changedFiles = [], reviews = [], author, owners, tier = 'standard', headSha, founding = false } = {}) {
  if (!changedFiles.includes(TEAM_CONFIG_PATH)) {
    return { level: 'pass', reason: `the change does not touch ${TEAM_CONFIG_PATH} — no owner review required.` };
  }

  // The ADOPTION PR (ADR-0040 section 4): the base has no team config, so this PR founds it and no owner can exist yet.
  // Said as such, never as independent review.
  if (founding) {
    return {
      level: 'pass',
      founding: true,
      reason: `adoption PR — the founding decision; no owners can exist yet. ${TEAM_CONFIG_PATH} is created by this change, which is NOT independent review.`,
    };
  }

  const list = normalizeOwners(owners);
  const isAuthor = (login) => author != null && login != null && lower(login) === lower(author);

  // ADR-0037 mode A: a solo maintainer at lite owns the config and authored the change. Said as the exception.
  if (tier === 'lite' && list.length === 1 && isAuthor(list[0])) {
    return {
      level: 'pass',
      soloMaintainer: true,
      reason:
        `${TEAM_CONFIG_PATH} changed by its sole owner "${author}" at the "lite" tier — solo-maintainer exception ` +
        '(ADR-0037 mode A). This is NOT independent review.',
    };
  }

  const detect = (reason) => (resolveGatePolicy(GATE, tier) === 'detection'
    ? { level: 'warn', reason: `${reason} (detection at the "${tier}" tier — reported, not blocking.)` }
    : { level: 'fail', reason });

  if (list.length === 0) {
    return detect(`${TEAM_CONFIG_PATH} changed but no owner declared: governance.owners is empty or absent on the base branch, so nobody can approve it.`);
  }
  if (reviews === null) {
    return detect(`${TEAM_CONFIG_PATH} changed but review evidence could not be fetched — the owner approval cannot be verified.`);
  }

  // Only each owner's LATEST decisive review counts: a later CHANGES_REQUESTED or DISMISSED cancels an earlier APPROVED.
  // (A COMMENTED review decides nothing, on the forge too.) The array is chronological.
  const latest = new Map();
  for (const r of reviews) {
    if (!r?.author || !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) continue;
    latest.set(lower(r.author), r);
  }
  const approvals = [...latest.values()].filter((r) => r.state === 'APPROVED' && list.some((o) => lower(o) === lower(r.author)) && !isAuthor(r.author));

  // An approval counts only on the CURRENT head: a push after it makes it stale.
  const current = approvals.find((r) => r.commitId != null && headSha != null && lower(r.commitId) === lower(headSha));
  if (current) {
    return { level: 'pass', reason: `${TEAM_CONFIG_PATH} approved by owner "${current.author}" on the current head, distinct from the PR author "${author ?? 'unknown'}".` };
  }
  if (approvals.some((r) => r.commitId == null)) {
    return detect(
      `${TEAM_CONFIG_PATH} has an owner approval but the forge does not report which commit it was against (commitId is null — a GitLab limitation), ` +
      'so a current approval cannot be told from a stale one — failing closed.');
  }
  if (approvals.length > 0) {
    return detect(`${TEAM_CONFIG_PATH} was approved by owner "${approvals[0].author}" on an older commit, not the current head — the approval is stale; an owner must approve again.`);
  }
  return detect(
    `${TEAM_CONFIG_PATH} changed without a current APPROVED review from a governance.owners login (${list.join(', ')}) ` +
    `other than the PR author "${author ?? 'unknown'}" — the author, a non-owner, or an owner whose latest review is not an approval cannot approve the team config.`);
}

// ── I/O wrapper ──────────────────────────────────────────────────────────────

/**
 * Rename detection is OFF: with it on, `git mv brain.config.json team.json` lists only `team.json` and the gate would
 * never see the team config leave. With it off the rename is a deletion plus an addition, both listed.
 */
export function diffNameOnlyArgs(baseSha, headSha) {
  return ['diff', '--no-renames', '--name-only', `${baseSha}...${headSha}`];
}

function defaultDiffNameOnly(cwd) {
  return (baseSha, headSha) =>
    execFileSync('git', diffNameOnlyArgs(baseSha, headSha), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
      .split('\n').filter(Boolean);
}

/**
 * `git show <ref>:<path>` → the file text; `null` when the file does not exist at that ref (a repo with no team
 * config yet). Any other failure throws, so the caller fails closed instead of reading "no owners".
 */
function defaultGitShow(cwd) {
  return (ref, path) => {
    const opts = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 };
    const tree = execFileSync('git', ['ls-tree', ref, '--', path], opts);
    if (tree.trim() === '') return null;
    return execFileSync('git', ['show', `${ref}:${path}`], opts);
  };
}

const gitOpts = (cwd) => ({ cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });

/**
 * The newest commit that touched `brain.config.json` at or before `ref`, or `''` when it has no history. Throws on failure.
 *
 * `--full-history` is load-bearing (#1283): git's default simplification follows only the parent a merge is TREESAME to,
 * so a merge that DROPPED the file (its tree equal to a parent that never had it) hides the deletion and `git log` prints
 * nothing — a re-add would then read as a founding. `--full-history` follows every parent and lists the merge. Verified
 * on real git: `--diff-merges` only changes the patch output, never which commits are listed, so it is not needed here.
 */
function defaultLastTouchSha(cwd) {
  return (ref) => execFileSync('git', ['log', '-1', '--full-history', '--format=%H', ref, '--', TEAM_CONFIG_PATH], gitOpts(cwd)).trim();
}

/** The parent commits of `sha`, first parent first (empty for a root commit). Throws on failure. */
function defaultParentShas(cwd) {
  return (sha) => execFileSync('git', ['rev-list', '--parents', '-n', '1', sha], gitOpts(cwd)).trim().split(/\s+/).slice(1).filter(Boolean);
}

/** Whether the clone's history is truncated: a missing file cannot then be told from one that never existed. */
function defaultIsShallow(cwd) {
  return () => execFileSync('git', ['rev-parse', '--is-shallow-repository'], gitOpts(cwd)).trim() === 'true';
}

function defaultFetchReviews(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async (prNumber) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    // `null` (could not fetch) stays distinct from `[]` (no reviews yet): it is not evidence of absence.
    return (await vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl })) ?? null;
  };
}

/** A base config that could not be read or parsed: its tier (and owners) are unknown. */
class BaseConfigUnreadable extends Error {}

const parseConfig = (text) => {
  try { return JSON.parse(text); } catch (e) { throw new BaseConfigUnreadable(`brain.config.json is not valid JSON (${e.message})`); }
};

/**
 * Gathers the evaluator's inputs, in this order:
 *   1. the diff (rename detection off) — if the PR does not touch the root `brain.config.json` it passes at once and
 *      the base config is never read, so an unreadable base cannot block a PR that does not touch it;
 *   2. the BASE config (`git show <baseSha>:brain.config.json`) → owners and tier. Missing on the base: the ADOPTION
 *      (founding) only if it never existed and the history is not shallow; if it once existed (REMOVED) the owners and
 *      tier are those of its last version, the commit before the deleting one;
 *   3. reviews (including for a removed config).
 * `state.tier` is set the moment the tier is known so a later failure can be mapped through GATE_MATRIX.
 * @returns {Promise<{changedFiles: string[], reviews: Array, author: string, owners: string[], tier: string, headSha: string, founding: boolean, removed: boolean}>}
 */
export async function gatherTeamConfigReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, cwd = process.cwd(), tier: tierOverride, deps = {}, state = {} } = {}) {
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly(cwd);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(repo, provider, deps);
  const gitShow = deps.gitShow ?? defaultGitShow(cwd);
  const injected = [tierOverride, deps.tier].find((t) => t && TIERS.includes(t));
  if (injected) state.tier = injected;

  const changedFiles = diffNameOnly(baseSha, headSha);
  if (!changedFiles.includes(TEAM_CONFIG_PATH)) {
    return { changedFiles, reviews: [], author, owners: [], tier: state.tier ?? 'standard', headSha, founding: false, removed: false };
  }

  const text = gitShow(baseSha, TEAM_CONFIG_PATH);
  let baseConfig;
  let founding = false;
  let removed = false;
  if (text != null) {
    baseConfig = parseConfig(text);
  } else {
    // Missing on the base. A shallow history cannot say whether it ever existed: an evidence failure, never a founding.
    // With no config to read, the tier a failure maps through is the default one (`standard`), the fail-closed side.
    state.tier = state.tier ?? resolveTier({});
    if ((deps.isShallow ?? defaultIsShallow(cwd))()) {
      throw new Error('the clone history is shallow, so a missing brain.config.json cannot be told from one that was deleted — fetch the full history (GIT_DEPTH 0 / fetch-depth 0)');
    }
    const lastTouch = (deps.lastTouchSha ?? defaultLastTouchSha(cwd))(baseSha);
    if (lastTouch) {
      removed = true;
      // The version before the deleting commit. A merge has several parents and only some of them had the file (the one it
      // dropped it from): take the FIRST parent that has it, so the choice is deterministic and always a real last version.
      let prev = null;
      for (const parent of (deps.parentShas ?? defaultParentShas(cwd))(lastTouch)) {
        prev = gitShow(parent, TEAM_CONFIG_PATH);
        if (prev != null) break;
      }
      baseConfig = prev == null ? {} : parseConfig(prev);
    } else {
      // The ADOPTION PR: no owner can exist. Its tier is the new-consumer default (ADR-0026 Am8), never its own head's.
      founding = true;
      baseConfig = {};
    }
  }
  const owners = normalizeOwners(baseConfig?.governance?.owners);
  const tier = injected ?? (founding ? 'lite' : resolveTier(baseConfig));
  state.tier = tier;

  const reviews = founding ? [] : await fetchReviews(prNumber);
  return { changedFiles, reviews, author, owners, tier, headSha, founding, removed };
}

/** Best effort: the tier the base config declares, or `undefined` when it cannot be read or parsed. Never throws. */
function readableBaseTier(baseSha, deps, cwd) {
  try {
    const text = (deps.gitShow ?? defaultGitShow(cwd))(baseSha, TEAM_CONFIG_PATH);
    return text == null ? resolveTier({}) : resolveTier(JSON.parse(text));
  } catch {
    return undefined;
  }
}

export async function runTeamConfigReviewedCheck(deps = {}) {
  const ctx = deps.ctx ?? {};
  const baseSha = deps.baseSha ?? ctx.baseSha ?? undefined;
  const headSha = deps.headSha ?? ctx.headSha ?? undefined;
  const prNumber = deps.prNumber ?? ctx.prNumber ?? undefined;
  const repo = deps.repo ?? ctx.repo ?? undefined;
  const author = deps.author ?? ctx.author ?? undefined;
  const provider = deps.provider ?? ctx.provider ?? undefined;
  const cwd = deps.cwd ?? process.cwd();

  if (!baseSha || !headSha || !prNumber || !repo || !author) {
    return {
      level: 'warn',
      reason: 'BASE_SHA/HEAD_SHA/PR_NUMBER/GITHUB_REPOSITORY/PR_AUTHOR not set — cannot verify team-config review; skipping team-config-reviewed check.',
    };
  }

  let inputs;
  const state = {};
  try {
    inputs = await gatherTeamConfigReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, cwd, deps, state });
  } catch (err) {
    // The tier is whatever gather already learned, or the base's own when it can still be read. If it cannot be known
    // the team config is unreadable and a PR that touches it deserves a closed door — there is no `standard` fallback.
    let tier = err instanceof BaseConfigUnreadable ? undefined : state.tier;
    if (tier === undefined && !(err instanceof BaseConfigUnreadable)) tier = readableBaseTier(baseSha, deps, cwd);
    if (err instanceof BaseConfigUnreadable && deps.tier && TIERS.includes(deps.tier)) tier = deps.tier;
    if (tier === undefined) {
      return { level: 'fail', reason: `team-config-reviewed: team config on base unreadable — ${err.message} — failing closed: a change that touches ${TEAM_CONFIG_PATH} cannot be verified.` };
    }
    const required = resolveGatePolicy(GATE, tier) === 'required';
    return {
      level: required ? 'fail' : 'warn',
      reason:
        `team-config-reviewed: could not gather inputs — ${err.message}` +
        (required ? ` — failing closed: this gate is required at the "${tier}" tier.` : ` (detection at the "${tier}" tier).`),
    };
  }
  return evaluateTeamConfigReviewed(inputs);
}

export async function main(deps = {}) {
  const result = await runTeamConfigReviewedCheck(deps);
  console.log(`team-config-reviewed: ${result.level}`);
  if (result.reason) console.log(`  ${result.reason}`);
  return result.level === 'fail' ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(await main({ ctx }));
}
