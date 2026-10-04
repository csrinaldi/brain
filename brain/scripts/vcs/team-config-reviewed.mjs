// team-config-reviewed.mjs — the owner gate over the TEAM config (#1263 slice 4, ADR-0040).
//
// Decides one thing: does a PR that touches `brain.config.json` (the project-owned team config at the repo
// root) carry an APPROVED review from a `governance.owners` login who is not the PR author?
//
//   · not touched                         → pass
//   · the base has no team config AND never had one (the ADOPTION PR, the founding decision) → pass, labelled, tier `lite`;
//     a base that once had it and lost it is a REMOVAL: re-adding it needs an owner (fail closed above lite)
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
export function evaluateTeamConfigReviewed({ changedFiles = [], reviews = [], author, owners, tier = 'standard', headSha, founding = false, removed = false } = {}) {
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
  const detectEarly = (reason) => (resolveGatePolicy(GATE, tier) === 'detection'
    ? { level: 'warn', reason: `${reason} (detection at the "${tier}" tier — reported, not blocking.)` }
    : { level: 'fail', reason });
  // The base once had a team config and lost it: re-adding it is NOT a founding, and nobody on the base can approve it.
  if (removed) return detectEarly(`${TEAM_CONFIG_PATH} changed but the team config was removed — re-adding it needs an owner.`);
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

/** Whether `brain.config.json` has any history at or before `ref`. A failure throws, so the caller fails closed. */
function defaultEverHadConfig(cwd) {
  return (ref) =>
    execFileSync('git', ['log', '--oneline', '-1', ref, '--', TEAM_CONFIG_PATH], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim() !== '';
}

function defaultFetchReviews(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async (prNumber) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    // `null` (could not fetch) stays distinct from `[]` (no reviews yet): it is not evidence of absence.
    return (await vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl })) ?? null;
  };
}

/**
 * Gathers the evaluator's inputs. Owners and tier come from `git show <baseSha>:brain.config.json`; reviews are
 * fetched only when the config is touched.
 * @returns {Promise<{changedFiles: string[], reviews: Array, author: string, owners: string[], tier: string, headSha: string, founding: boolean, removed: boolean}>}
 */
export async function gatherTeamConfigReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, cwd = process.cwd(), tier: tierOverride, deps = {} } = {}) {
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly(cwd);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(repo, provider, deps);
  const gitShow = deps.gitShow ?? defaultGitShow(cwd);

  const changedFiles = diffNameOnly(baseSha, headSha);
  const text = gitShow(baseSha, TEAM_CONFIG_PATH);
  // No team config on the base: this PR is the ADOPTION, the founding decision. Its tier is the new-consumer default
  // (ADR-0026 Am8), never one its own head declares.
  // FOUNDING only when the base has no team config AND has never had one: a base that lost it is a removal.
  const missing = text == null;
  const everHad = missing && changedFiles.includes(TEAM_CONFIG_PATH) ? (deps.everHadConfig ?? defaultEverHadConfig(cwd))(baseSha) : false;
  const founding = missing && !everHad;
  const removed = missing && everHad;
  const baseConfig = founding ? {} : JSON.parse(text);
  const owners = normalizeOwners(baseConfig?.governance?.owners);
  const tier = tierOverride ?? deps.tier ?? (founding ? 'lite' : resolveTier(baseConfig));
  const reviews = changedFiles.includes(TEAM_CONFIG_PATH) && !founding && !removed ? await fetchReviews(prNumber) : [];
  return { changedFiles, reviews, author, owners, tier, headSha, founding, removed };
}

/** Never throws. A failed read means the owner evidence CANNOT BE VERIFIED: fail where the gate is required. */
function tierForFailure(deps) {
  return deps.tier && TIERS.includes(deps.tier) ? deps.tier : 'standard';
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
  try {
    inputs = await gatherTeamConfigReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, cwd, deps });
  } catch (err) {
    const tier = tierForFailure(deps);
    const required = resolveGatePolicy(GATE, tier) === 'required';
    return {
      level: required ? 'fail' : 'warn',
      reason:
        `team-config-reviewed: could not gather inputs (git or brain.config.json failure) — ${err.message}` +
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
