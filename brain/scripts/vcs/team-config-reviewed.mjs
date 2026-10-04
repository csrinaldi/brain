// team-config-reviewed.mjs — the owner gate over the TEAM config (#1263 slice 4, ADR-0040).
//
// Decides one thing: does a PR that touches `brain.config.json` (the project-owned team config at the repo
// root) carry an APPROVED review from a `governance.owners` login who is not the PR author?
//
//   · not touched                         → pass
//   · solo maintainer, tier lite (ADR-0037 mode A): exactly one owner, and that owner is the author → pass,
//     labelled the exception, never independent review
//   · an APPROVED review from an owner other than the author → pass
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
export function evaluateTeamConfigReviewed({ changedFiles = [], reviews = [], author, owners, tier = 'standard' } = {}) {
  if (!changedFiles.includes(TEAM_CONFIG_PATH)) {
    return { level: 'pass', reason: `the change does not touch ${TEAM_CONFIG_PATH} — no owner review required.` };
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

  let verdict;
  if (list.length === 0) {
    verdict = {
      level: 'fail',
      reason: `${TEAM_CONFIG_PATH} changed but no owner declared: governance.owners is empty or absent on the base branch, so nobody can approve it.`,
    };
  } else {
    const approvers = [...new Set(reviews.filter((r) => r?.state === 'APPROVED' && r.author).map((r) => r.author))];
    const owner = approvers.find((a) => list.some((o) => lower(o) === lower(a)) && !isAuthor(a));
    verdict = owner
      ? { level: 'pass', reason: `${TEAM_CONFIG_PATH} approved by owner "${owner}", distinct from the PR author "${author ?? 'unknown'}".` }
      : {
          level: 'fail',
          reason:
            `${TEAM_CONFIG_PATH} changed without an APPROVED review from a governance.owners login (${list.join(', ')}) ` +
            `other than the PR author "${author ?? 'unknown'}" — the author, or a non-owner, cannot approve the team config.`,
        };
  }

  if (verdict.level === 'fail' && resolveGatePolicy(GATE, tier) === 'detection') {
    return { level: 'warn', reason: `${verdict.reason} (detection at the "${tier}" tier — reported, not blocking.)` };
  }
  return verdict;
}

// ── I/O wrapper ──────────────────────────────────────────────────────────────

function defaultDiffNameOnly(cwd) {
  return (baseSha, headSha) =>
    execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
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

function defaultFetchReviews(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async (prNumber) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    return (await vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl })) ?? [];
  };
}

/**
 * Gathers the evaluator's inputs. Owners and tier come from `git show <baseSha>:brain.config.json`; reviews are
 * fetched only when the config is touched.
 * @returns {Promise<{changedFiles: string[], reviews: Array, author: string, owners: string[], tier: string}>}
 */
export async function gatherTeamConfigReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, cwd = process.cwd(), tier: tierOverride, deps = {} } = {}) {
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly(cwd);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(repo, provider, deps);
  const gitShow = deps.gitShow ?? defaultGitShow(cwd);

  const changedFiles = diffNameOnly(baseSha, headSha);
  const text = gitShow(baseSha, TEAM_CONFIG_PATH);
  const baseConfig = text == null ? {} : JSON.parse(text);
  const owners = normalizeOwners(baseConfig?.governance?.owners);
  const tier = tierOverride ?? deps.tier ?? resolveTier(baseConfig);
  const reviews = changedFiles.includes(TEAM_CONFIG_PATH) ? await fetchReviews(prNumber) : [];
  return { changedFiles, reviews, author, owners, tier };
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
