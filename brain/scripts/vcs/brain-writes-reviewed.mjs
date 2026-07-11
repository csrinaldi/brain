// brain-writes-reviewed.mjs — L6 brain-writes-reviewed evidence check: pure
// evaluator + gh/git I/O wrapper + CLI (design §6.1, REQ-L6-1 evidence path).
// Sibling to actor-check.mjs.
//
// Pure evaluator (evaluateBrainWritesReviewed) takes plain data — no gh, no
// git, no filesystem — so it is fully unit-testable with fixture reviews. The
// I/O wrapper computes the PR's changed files (`git diff --name-only`),
// fetches the PR's reviews via `gh api repos/{repo}/pulls/{n}/reviews`, and
// resolves adminOverride from the PR's labels (same allowlist discipline as
// actor-check). All I/O is dependency-injectable via `deps` (same
// CI-fragility discipline as actor-check.mjs / phase-order-check.mjs) — no
// test spawns a real gh or git process.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContext, gitlabApiConfig } from './ci-context.mjs';
import { getVcs } from './cli.mjs';

// ── Pure evaluator (design §6.1) ────────────────────────────────────────────

const BRAIN_MANAGED_PREFIXES = ['brain/core/', 'brain/project/'];

/**
 * Evaluates whether Tier-2 (`brain/core/**` or `brain/project/**`) changes in
 * a PR carry a human-approval review distinct from the PR author. Pure — no
 * gh, no git, no filesystem access (fully testable with fixtures).
 *
 * Decision order (design §6.1):
 *   1. No `brain/core/**` or `brain/project/**` file touched → pass (no
 *      Tier-2 requirement — REQ-L6-1 evidence path; avoids false positives on
 *      unrelated PRs).
 *   2. No reviews at all (missing/unsupported reviews API, or zero reviews
 *      yet) → warn + pass (cannot prove/disprove human review on missing
 *      evidence — never fail on missing evidence, mirrors actor-check's
 *      missing-labeled-event branch).
 *   3. `adminOverride` (an allow-listed `override:*` label is present) →
 *      pass, logged — bypasses the self-approval fail below, same as
 *      actor-check's adminOverride branch.
 *   4. Zero APPROVED reviews among the fetched reviews (e.g. only
 *      COMMENTED/CHANGES_REQUESTED) → warn + pass (no approval evidence yet).
 *   5. At least one deduped APPROVED reviewer whose login is NOT the author
 *      and NOT in `botAllowlist` → pass (a human other than the author
 *      reviewed the brain-writes).
 *   6. Otherwise → fail — the only APPROVED reviewer(s) are the author itself
 *      and/or bot-allow-listed identities; enforces Tier-2 "no agent writes
 *      to `brain/`" (`agent-authorities.md:35`).
 *
 * @param {object} input
 * @param {string[]} [input.changedFiles]  Paths from `git diff --name-only BASE...HEAD`.
 * @param {Array<{ state: string, author: string }>} [input.reviews]  Normalized
 *   PR reviews from the VCS adapter (`state` is GitHub's review state string;
 *   only `'APPROVED'` counts toward approvers).
 * @param {string} input.author  PR author login.
 * @param {string[]} [input.botAllowlist]  Allow-listed actor logins / override
 *   label strings (`config.governance.approvalActors`).
 * @param {boolean} [input.adminOverride]  Whether an allow-listed `override:*`
 *   label is present on the PR (resolved by the wrapper against
 *   `botAllowlist` — never a blanket bypass).
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function evaluateBrainWritesReviewed({
  changedFiles = [],
  reviews = [],
  author,
  botAllowlist = [],
  adminOverride = false,
} = {}) {
  const touchesBrain = changedFiles.some(f =>
    BRAIN_MANAGED_PREFIXES.some(prefix => f.startsWith(prefix))
  );

  if (!touchesBrain) {
    return {
      level: 'pass',
      reason: 'no brain/core/** or brain/project/** files touched — Tier-2 human review not required.',
    };
  }

  if (reviews.length === 0) {
    return {
      level: 'warn',
      reason:
        'no PR reviews found (missing/unsupported reviews API, or zero reviews yet) — cannot verify ' +
        'Tier-2 human review on brain/ changes; never failing on missing evidence (REQ-L6-1).',
    };
  }

  if (adminOverride) {
    return {
      level: 'pass',
      reason: 'admin override present (allow-listed override:* label) — brain-writes-reviewed check bypassed.',
    };
  }

  const approvers = [
    ...new Set(reviews.filter(r => r.state === 'APPROVED').map(r => r.author)),
  ];

  if (approvers.length === 0) {
    return {
      level: 'warn',
      reason:
        'no APPROVED reviews found yet (only COMMENTED/CHANGES_REQUESTED, or none) — cannot verify ' +
        'Tier-2 human review on brain/ changes; never failing on missing evidence (REQ-L6-1).',
    };
  }

  const humanApprover = approvers.find(a => a !== author && !botAllowlist.includes(a));

  if (humanApprover) {
    return {
      level: 'pass',
      reason: `brain/core or brain/project changes approved by "${humanApprover}", distinct from the PR author "${author}".`,
    };
  }

  return {
    level: 'fail',
    reason:
      `brain/core or brain/project changes were only self-approved by "${author}" (or approved solely by ` +
      'allow-listed automation) — Tier-2 requires human review distinct from the author (agent-authorities.md).',
  };
}

// ── gh/git I/O wrapper ───────────────────────────────────────────────────────

function defaultDiffNameOnly(cwd) {
  return (baseSha, headSha) => {
    const out = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
      cwd,
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  };
}

/**
 * Default `fetchReviews` dep: dispatches `getVcs({ provider }).prReviews(...)`
 * on the RUNTIME-detected `ctx.provider` (issue #239 A3 TASK2 — the
 * class-closure audit's 4th VIOLATION, the same defect class as
 * actor-check.mjs's pre-fix `defaultFetchLabeledEvents`/`defaultFetchIssue`
 * and finding #14). Pre-fix, this wrapper called the `gh` CLI (via
 * `execFileSync`) UNCONDITIONALLY regardless of provider — on GitLab CI (no
 * `gh` binary) it threw ENOENT, masking the L6 gate behind a permanent
 * `warn`. `getVcs` is injectable via `{ getVcs }` for tests, mirroring
 * actor-check.mjs's `defaultFetchLabeledEvents`/`defaultFetchIssue` shape.
 *
 * @param {string} repo
 * @param {string|undefined} provider
 * @param {{ getVcs?: Function }} [deps]
 * @returns {(prNumber: number) => Promise<Array<{ state: string, author: string|null }>>}
 */
function defaultFetchReviews(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async prNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const reviews = await vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl });
    return reviews ?? [];
  };
}

function defaultReadBotAllowlist(cwd) {
  return () => {
    try {
      const config = JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
      return Array.isArray(config?.governance?.approvalActors) ? config.governance.approvalActors : [];
    } catch {
      return [];
    }
  };
}

/**
 * Gathers evaluateBrainWritesReviewed()'s inputs from git + the gh API (or
 * from injected `deps` in tests). `adminOverride` is resolved here — an
 * override:* label is only honored when it is BOTH present on the PR AND
 * listed in `botAllowlist` (`config.governance.approvalActors`); an unlisted
 * override:* label grants nothing (no blanket bypass, same discipline as
 * actor-check's `gatherActorCheckInputs`).
 *
 * `provider` (github|gitlab, from `ctx.provider`) selects the VCS adapter
 * (`getVcs({ provider })`, issue #239 A3 TASK2) for the default
 * `fetchReviews` wrapper; an injected `deps.fetchReviews` bypasses
 * resolution entirely (as tests do). This function is async as of A3 TASK2
 * (the default wrapper awaits the `prReviews` CONTRACT verb, a
 * Promise-returning dispatch); an injected sync `deps.fetchReviews` still
 * works unchanged (`await` on a non-Promise resolves immediately).
 *
 * @param {{ baseSha: string, headSha: string, prNumber: number|string, repo: string, author: string, provider?: string, prLabels?: string[], cwd?: string, deps?: object }} args
 * @returns {Promise<{ changedFiles: string[], reviews: Array, author: string, botAllowlist: string[], adminOverride: boolean }>}
 */
export async function gatherBrainWritesReviewedInputs({
  baseSha,
  headSha,
  prNumber,
  repo,
  author,
  provider,
  prLabels = [],
  cwd = process.cwd(),
  deps = {},
} = {}) {
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly(cwd);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(repo, provider, deps);
  const readBotAllowlist = deps.readBotAllowlist ?? defaultReadBotAllowlist(cwd);

  const botAllowlist = readBotAllowlist();
  const changedFiles = diffNameOnly(baseSha, headSha);
  const reviews = await fetchReviews(prNumber);
  const adminOverride = prLabels.some(l => l.startsWith('override:') && botAllowlist.includes(l));

  return { changedFiles, reviews, author, botAllowlist, adminOverride };
}

/**
 * Runs the full L6 brain-writes-reviewed check: gathers inputs (git + gh API),
 * evaluates the pure rule. Never throws — a gh/git failure, or missing
 * PR/diff context, degrades to `warn` rather than `fail`, keeping the
 * zero-false-positive detection goal intact while this job is
 * detection-only (DETECTION_JOBS).
 *
 * baseSha/headSha/prNumber/repo/author/prLabels source from the normalized
 * ci-context (`ctx.*`, ADR-0016) — never from process.env directly (a
 * drift-guard test enforces this). `ctx.labels` is already an array, so it
 * replaces the former `PR_LABELS` space-separated env parsing outright.
 *
 * This function is async as of issue #239 A3 TASK2 — `gatherBrainWritesReviewedInputs`
 * dispatches the `prReviews` CONTRACT verb via `getVcs({ provider })`, a
 * Promise-returning call.
 *
 * @param {{ baseSha?: string, headSha?: string, prNumber?: number|string, repo?: string, author?: string, prLabels?: string[], cwd?: string, ctx?: object } & object} [deps]
 * @returns {Promise<{ level: 'pass'|'warn'|'fail', reason: string }>}
 */
export async function runBrainWritesReviewedCheck(deps = {}) {
  const ctx = deps.ctx ?? {};
  const baseSha = deps.baseSha ?? ctx.baseSha ?? undefined;
  const headSha = deps.headSha ?? ctx.headSha ?? undefined;
  const prNumber = deps.prNumber ?? ctx.prNumber ?? undefined;
  const repo = deps.repo ?? ctx.repo ?? undefined;
  const author = deps.author ?? ctx.author ?? undefined;
  const provider = deps.provider ?? ctx.provider ?? undefined;
  // ctx.labels may be null (uncomputable fetch); collapsing to [] here is the SAFE
  // direction for this DETECTION gate — no labels ⇒ no admin-override applies ⇒
  // stricter enforcement, never a fail-open (unlike the empty-on-failure anti-pattern).
  const prLabels = deps.prLabels ?? ctx.labels ?? [];
  const cwd = deps.cwd ?? process.cwd();

  if (!baseSha || !headSha || !prNumber || !repo || !author) {
    return {
      level: 'warn',
      reason:
        'BASE_SHA/HEAD_SHA/PR_NUMBER/GITHUB_REPOSITORY/PR_AUTHOR not set — cannot verify brain-writes ' +
        'review; skipping brain-writes-reviewed check.',
    };
  }

  let inputs;
  try {
    inputs = await gatherBrainWritesReviewedInputs({ baseSha, headSha, prNumber, repo, author, provider, prLabels, cwd, deps });
  } catch (err) {
    return {
      level: 'warn',
      reason: `brain-writes-reviewed: could not gather inputs (gh api or git failure?) — ${err.message}`,
    };
  }

  return evaluateBrainWritesReviewed(inputs);
}

/**
 * Runs the check, prints the verdict + reason, and returns the process exit
 * code — kept separate from `process.exit()` itself so it stays testable
 * (mirrors actor-check.mjs's main()). Exit 0 on pass/warn, 1 on fail. Async
 * as of A3 TASK2 (awaits `runBrainWritesReviewedCheck`).
 *
 * @param {object} [deps]
 * @returns {Promise<0|1>}
 */
export async function main(deps = {}) {
  const result = await runBrainWritesReviewedCheck(deps);
  console.log(`brain-writes-reviewed: ${result.level}`);
  if (result.reason) console.log(`  ${result.reason}`);
  return result.level === 'fail' ? 1 : 0;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(await main({ ctx }));
}
