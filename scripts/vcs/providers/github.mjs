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
  return { number: r.number, title: r.title, labels: (r.labels ?? []).map(l => l.name), body: r.body };
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

export async function repoCloneUrl({ host, project, token }) {
  return `https://x-access-token:${token}@${host || 'github.com'}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://github.com/settings/tokens/new?description=${name}&scopes=${scopes.join(',')}`;
}
