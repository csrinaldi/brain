// github.mjs — GitHub provider (gh CLI). Implements brain/core/methodology/vcs-contract.md.
//
// All verbs return the NORMALIZED shapes from the contract (number, body,
// headBranch, username, canonical commit-status enum). Auth uses the gh session
// (ensured by day:start); the token is only needed by the URL-building verbs,
// which receive it from the caller.

import { run, runJson } from '../lib/exec.mjs';
import { normalizeCommitStatus, providerState, assigneeParams } from '../lib/normalize.mjs';
import { vcsToken } from '../lib/token.mjs';

export const PROVIDER = 'github';

const toQs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export async function authCheck({ host } = {}) {
  const args = host ? ['auth', 'status', '--hostname', host] : ['auth', 'status'];
  return run('gh', args).ok;
}

export async function authLogin({ host, token } = {}) {
  const tok = token ?? vcsToken(PROVIDER);
  return run('gh', ['auth', 'login', '--hostname', host || 'github.com', '--with-token'], { input: tok }).ok;
}

export async function whoami() {
  const resp = runJson('gh', ['api', '/user']);
  return { username: resp.login };
}

// GitHub addresses repos by the owner/repo slug directly — projectResolve is the identity.
export async function projectResolve({ project }) {
  return project;
}

export async function issueView({ project, number }) {
  const r = runJson('gh', ['api', `repos/${project}/issues/${number}`]);
  return {
    number: r.number,
    title: r.title,
    labels: (r.labels ?? []).map(l => l.name),
    body: r.body,
    // `author` (issue #239 A3 TASK1): actor-check.mjs's REQ-L5-1 compares the
    // approval actor against BOTH the PR author and the issue author — the
    // same API call already carries `user.login`, no extra round-trip.
    author: r.user?.login ?? null,
  };
}

export async function branchProtect({ project, branch = 'main', checks, requiredReviews = 1 }) {
  const payload = {
    required_status_checks: {
      strict: true,
      checks: checks.map(context => ({ context })),
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      required_approving_review_count: requiredReviews,
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const r = run(
    'gh',
    ['api', '-X', 'PUT', `repos/${project}/branches/${branch}/protection`, '--input', '-'],
    { input: JSON.stringify(payload) }
  );
  if (r.ok) return { enforced: true };
  // Tier / plan limitation — GitHub free plan blocks protection on private repos
  if (r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)) {
    return {
      enforced: false,
      reason: 'tier',
      remedy: 'GitHub Pro for private repos, or make the repo public',
    };
  }
  return {
    enforced: false,
    reason: 'unsupported',
    remedy: r.stderr.trim() || 'unknown error from gh api',
  };
}

/**
 * Optional, non-contract verb (github only — `brain:protect`'s arm-and-verify
 * step, issue #203). Returns the check-run names reported for the branch's
 * latest commit. Never throws: a fetch failure degrades to `[]`, which
 * `verifyArmedProtection` (brain-protect.mjs) treats as "unverifiable" rather
 * than a crash.
 *
 * @param {{ project: string, branch?: string }} opts
 * @returns {Promise<string[]>}
 */
export async function checkRuns({ project, branch = 'main' } = {}) {
  try {
    const resp = runJson('gh', ['api', `repos/${project}/commits/${branch}/check-runs`]);
    return (resp.check_runs ?? []).map(cr => cr.name);
  } catch {
    return [];
  }
}

// Capability cache — keyed by "project:branch" to avoid cross-test interference.
const _capabilityCache = new Map();

/**
 * Probe the GitHub API to determine whether branch protection APIs are accessible
 * for the given project+branch. Caches the result per project:branch for the
 * lifetime of the Node.js process.
 *
 * Returns: { hardEnforcement: 'available' | 'unavailable' | 'unknown', remedy?, detail? }
 */
export async function capabilities({ project = '', branch = 'main' } = {}) {
  const key = `${project}:${branch}`;
  if (_capabilityCache.has(key)) return _capabilityCache.get(key);

  const r = run('gh', ['api', `repos/${project}/branches/${branch}/protection`]);
  let result;
  if (r.ok) {
    result = { hardEnforcement: 'available' };
  } else if (r.stderr.includes('404')) {
    // No protection set yet — API is accessible, feature is available
    result = { hardEnforcement: 'available' };
  } else if (r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)) {
    result = {
      hardEnforcement: 'unavailable',
      remedy: 'GitHub Pro for private repos, or make the repo public',
    };
  } else {
    result = { hardEnforcement: 'unknown' };
  }

  _capabilityCache.set(key, result);
  return result;
}

/**
 * Fetch a PR's metadata (number, label names, body, author, and the head
 * commit sha) via `gh pr view`. Uses the current repo's git remote —
 * `project` is accepted for contract compatibility but not required by the
 * gh CLI when run from the repo root.
 *
 * `headRefOid` (ADR-0021 Decision 1) is the API's head sha for the PR — the
 * anchor a cold caller checks out **detached** at (never a branch name).
 * Widened additively: existing callers reading only `number`/`labels`/
 * `body`/`author` are unaffected.
 *
 * Never throws: returns { number, labels: null, body: null, author: null,
 * headRefOid: null } on ANY failure (ci-context.mjs's REQ-CIC-2 uncomputable
 * signal) — distinct from a genuinely empty `[]`/`''` on an otherwise-
 * successful response. Callers that need "no labels" vs "couldn't fetch
 * labels" distinguished (e.g. a REQUIRED gate) MUST treat `null` as
 * uncomputable, never collapse it to a fabricated empty default.
 *
 * @param {{ project?: string, number: number }} opts
 * @returns {Promise<{ number: number, labels: string[]|null, body: string|null, author: string|null, headRefOid: string|null }>}
 */
export async function prView({ project, number } = {}) {
  const r = run('gh', ['pr', 'view', String(number), '--json', 'number,labels,body,author,headRefOid']);
  if (!r.ok) return { number, labels: null, body: null, author: null, headRefOid: null };
  try {
    const data = JSON.parse(r.stdout);
    return {
      number: data.number,
      labels: (data.labels ?? []).map(l => l.name),
      body: data.body ?? '',
      author: data.author?.login ?? null,
      headRefOid: data.headRefOid ?? null,
    };
  } catch {
    return { number, labels: null, body: null, author: null, headRefOid: null };
  }
}

export async function issueList({ project, state = 'open', assignee } = {}) {
  let currentUser;
  if (assignee === 'me') currentUser = (await whoami()).username;
  const assigneePs = assigneeParams('github', assignee, currentUser);
  const extra = Object.keys(assigneePs).length > 0 ? '&' + toQs(assigneePs) : '';
  const endpoint = `repos/${project}/issues?state=${providerState('github', state)}&per_page=100${extra}`;
  const arr = runJson('gh', ['api', endpoint]);
  // GitHub /issues returns both issues and PRs — filter out PRs.
  return arr
    .filter(r => !r.pull_request)
    .map(r => ({ number: r.number, title: r.title, labels: (r.labels ?? []).map(l => l.name) }));
}

export async function mrList({ project, state = 'open' } = {}) {
  const arr = runJson('gh', ['api', `repos/${project}/pulls?state=${providerState('github', state)}&per_page=100`]);
  return arr.map(r => ({ number: r.number, title: r.title, headBranch: r.head.ref }));
}

export async function commitStatus({ project, sha }) {
  const resp = runJson('gh', ['api', `repos/${project}/commits/${sha}/check-runs`]);
  const cr = resp.check_runs?.[0];
  if (!cr) return null;
  // An unfinished check has conclusion=null; its live state lives in `status`
  // (queued/in_progress). Use status until completed, then the conclusion.
  const raw = cr.status === 'completed' ? cr.conclusion : cr.status;
  return normalizeCommitStatus('github', raw);
}

/**
 * prStatusRollup — the provider-agnostic READ verb `prStatusRollup`
 * (ADR-0021 Decision 2). Returns the full status-check rollup for a PR's
 * head commit, normalized to `[{ name, status, conclusion }]` — one entry
 * per check. This is a READ: no write path exists on this verb, and it
 * carries no APPROVE/label-mutation code path (the reviewer's four
 * COMMENT-only write verbs from ADR-0020 are unaffected).
 *
 * Unlike `commitStatus` (which needs a sha as input and collapses to
 * `check_runs[0]`, a single check), `prStatusRollup` takes the PR number and
 * returns the FULL rollup via `gh pr view --json statusCheckRollup` — every
 * required check the tranche evaluator (H1-2c) re-derives cold, not a
 * collapsed single status.
 *
 * Never throws: a fetch failure, or a response with no computable rollup,
 * normalizes to `null` (uncomputable) — never a fabricated `[]`, matching
 * `prReviews`/`labelEvents`.
 *
 * @param {{ project?: string, number: number }} opts
 * @returns {Promise<Array<{ name: string, status: string|null, conclusion: string|null }>|null>}
 */
export async function prStatusRollup({ project, number } = {}) {
  let data;
  try {
    data = runJson('gh', ['pr', 'view', String(number), '--json', 'statusCheckRollup']);
  } catch {
    return null;
  }
  const rollup = data.statusCheckRollup;
  if (!Array.isArray(rollup)) return null;
  return rollup.map(c => ({
    name: c.name ?? c.context ?? null,
    status: c.status ?? c.state ?? null,
    conclusion: c.conclusion ?? null,
  }));
}

/**
 * prReviews — the provider-agnostic `prReviews` CONTRACT verb (issue #239
 * A3 TASK2/4th-violation fix, closing the L6 brain-writes-reviewed gate's
 * gh-CLI-hardcoded `defaultFetchReviews`). Wraps GitHub's Reviews API
 * (`pulls/N/reviews`), normalizing `state`/`user.login` to `{ state, author
 * }`. EXTRACTED from brain-writes-reviewed.mjs's inline
 * `defaultFetchReviews`, preserving the load-bearing `--paginate` VERBATIM:
 * `gh api` does not auto-paginate, and a long-lived PR with many re-review
 * cycles can exceed one page — an unpaginated fetch can silently drop the
 * one human APPROVED review that would flip a self-approval verdict.
 *
 * Never throws: a fetch failure is caught and normalized to `null`
 * (uncomputable) — never a fabricated `[]`, so callers (the DETECTION gate)
 * can distinguish "zero reviews" from "couldn't fetch".
 *
 * @param {{ project: string, number: number }} params
 * @returns {Promise<Array<{ state: string, author: string|null }>|null>}
 */
export async function prReviews({ project, number } = {}) {
  let reviews;
  try {
    reviews = runJson('gh', ['api', '--paginate', `repos/${project}/pulls/${number}/reviews`]);
  } catch {
    return null;
  }
  return reviews.map(r => ({ state: r.state, author: r.user?.login ?? null }));
}

/**
 * Create a pull request via `gh pr create`.
 * Returns { url: string } on success or { url: null, error: string } on failure.
 * Never throws.
 */
export async function mrCreate({
  project,
  title,
  body,
  head,
  base = 'main',
  labels = [],
} = {}) {
  // gh pr create resolves the repo from the git remote; project is validated
  // implicitly.  Pass title + body + branch refs explicitly.
  const args = [
    'pr', 'create',
    '--title', title,
    '--body', body,
    '--head', head,
    '--base', base,
  ];
  for (const label of labels) {
    args.push('--label', label);
  }

  const r = run('gh', args);
  if (r.ok) return { url: r.stdout.trim() };
  return { url: null, error: r.stderr.trim() || `gh pr create failed (status ${r.status})` };
}

/**
 * labelEvents — the provider-agnostic `labelEvents` CONTRACT verb (issue
 * #239 A3, D1). Wraps GitHub's Events API (`issues/N/events`), normalizing
 * `event:'labeled'|'unlabeled'` + `actor.login`/`label.name`/`created_at` to
 * the shared shape `{ actor: { login }, action: 'add'|'remove', label, at }`,
 * ascending by `at`. Non-label events (e.g. `commented`) are dropped.
 *
 * EXTRACTED from actor-check.mjs's inline `defaultFetchLabeledEvents` (the
 * A2 `m3` finding close) — preserves the load-bearing `--paginate`
 * VERBATIM: `gh api` does not auto-paginate, and the Events API is
 * oldest-first, so an unpaginated fetch silently drops page-2+ events
 * (including a late self-applied approved label), which would wrongly PASS
 * the actor-check (fail-open).
 *
 * Never throws: a fetch failure (no `gh` binary, rate limit, non-zero exit)
 * is caught and normalized to `null` (uncomputable) — never a fabricated
 * `[]`, so callers (the actor-check DETECTION gate) can distinguish "no
 * events" from "couldn't fetch".
 *
 * @param {{ project: string, number: number }} params
 * @returns {Promise<Array<{ actor: { login: string|undefined }, action: 'add'|'remove', label: string|undefined, at: string|undefined }>|null>}
 */
export async function labelEvents({ project, number } = {}) {
  let events;
  try {
    events = runJson('gh', ['api', '--paginate', `repos/${project}/issues/${number}/events`]);
  } catch {
    return null;
  }
  return events
    .filter(e => e.event === 'labeled' || e.event === 'unlabeled')
    .map(e => ({
      actor: { login: e.actor?.login },
      action: e.event === 'labeled' ? 'add' : 'remove',
      label: e.label?.name,
      at: e.created_at,
    }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * Posts a COMMENT-state pull request review (issue #266, REQ-266-2). `event`
 * is HARDCODED to `'COMMENT'` — no parameter, flag, or branch selects a
 * different review event (lock 2, REQ-266-3). Never throws.
 *
 * @param {{ project: string, number: number, body: string }} opts
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function prReviewComment({ project, number, body } = {}) {
  const r = run(
    'gh',
    ['api', '-X', 'POST', `repos/${project}/pulls/${number}/reviews`, '--input', '-'],
    { input: JSON.stringify({ body, event: 'COMMENT' }) },
  );
  if (!r.ok) return { url: null, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
  try {
    return { url: JSON.parse(r.stdout).html_url };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Posts a plain issue comment — rulings on issues (issue #266, REQ-266-2).
 * Never throws.
 *
 * @param {{ project: string, number: number, body: string }} opts
 * @returns {Promise<{ url: string } | { url: null, error: string }>}
 */
export async function issueComment({ project, number, body } = {}) {
  const r = run(
    'gh',
    ['api', '-X', 'POST', `repos/${project}/issues/${number}/comments`, '--input', '-'],
    { input: JSON.stringify({ body }) },
  );
  if (!r.ok) return { url: null, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
  try {
    return { url: JSON.parse(r.stdout).html_url };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Adds labels to an issue or PR (issue #266, REQ-266-2). The CALLER enforces
 * the deny-set (REQ-266-9, monotonic label tightening) — this verb performs
 * the label API call only, no policy. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[] }} opts
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelAdd({ project, number, labels } = {}) {
  const r = run(
    'gh',
    ['api', '-X', 'POST', `repos/${project}/issues/${number}/labels`, '--input', '-'],
    { input: JSON.stringify({ labels }) },
  );
  if (r.ok) return { ok: true };
  return { ok: false, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
}

/**
 * Removes labels from an issue or PR — monotonic-tightening removals only
 * (issue #266, REQ-266-9); the caller enforces the deny-set. GitHub has no
 * bulk-remove endpoint — each label is deleted individually, stopping at the
 * first failure. Never throws.
 *
 * @param {{ project: string, number: number, labels: string[] }} opts
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function labelRemove({ project, number, labels } = {}) {
  for (const label of labels) {
    const r = run('gh', ['api', '-X', 'DELETE', `repos/${project}/issues/${number}/labels/${encodeURIComponent(label)}`]);
    if (!r.ok) return { ok: false, error: r.stderr.trim() || `gh api failed (status ${r.status})` };
  }
  return { ok: true };
}

export async function repoCloneUrl({ host, project, token }) {
  return `https://x-access-token:${token}@${host || 'github.com'}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://github.com/settings/tokens/new?description=${name}&scopes=${scopes.join(',')}`;
}
