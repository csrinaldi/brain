// gitlab.mjs — GitLab provider (glab CLI + /api/v4). Implements brain/core/methodology/vcs-contract.md.
//
// Reproduces the CURRENT behavior of the harness scripts (parity), so a revert
// leaves the GitLab flow intact. Auth uses the glab session (ensured by day:start);
// the token is only needed by the URL-building verbs, which receive it from the
// caller. All verbs return the NORMALIZED shapes from the contract. GitLab's REST
// API accepts the URL-encoded project path everywhere, so the slug is used directly.

import { run, runJson } from '../lib/exec.mjs';
import { normalizeCommitStatus, providerState, assigneeParams } from '../lib/normalize.mjs';
import { vcsToken } from '../lib/token.mjs';

export const PROVIDER = 'gitlab';

const toQs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export async function authCheck({ host }) {
  return run('glab', ['auth', 'status', '--hostname', host]).ok;
}

export async function authLogin({ host, token } = {}) {
  const tok = token ?? vcsToken(PROVIDER);
  return run('glab', ['auth', 'login', '--hostname', host, '--git-protocol', 'https', '--stdin'], { input: tok }).ok;
}

export async function whoami() {
  const resp = runJson('glab', ['api', '/user']);
  return { username: resp.username };
}

// GitLab's API accepts the URL-encoded path everywhere, so the slug is the
// project identifier — projectResolve is the identity, like GitHub.
export async function projectResolve({ project }) {
  return project;
}

export async function issueView({ project, number }) {
  const encoded = encodeURIComponent(project);
  const r = runJson('glab', ['api', `projects/${encoded}/issues/${number}`]);
  return { number: r.iid, title: r.title, labels: r.labels ?? [], body: r.description };
}

export async function issueList({ project, state = 'open', assignee } = {}) {
  let currentUser;
  if (assignee === 'me') currentUser = (await whoami()).username;
  const encoded = encodeURIComponent(project);
  const assigneePs = assigneeParams('gitlab', assignee, currentUser);
  const extra = Object.keys(assigneePs).length > 0 ? '&' + toQs(assigneePs) : '';
  const endpoint = `projects/${encoded}/issues?state=${providerState('gitlab', state)}&per_page=50${extra}`;
  const arr = runJson('glab', ['api', endpoint]);
  return arr.map(r => ({ number: r.iid, title: r.title, labels: r.labels ?? [] }));
}

export async function mrList({ project, state = 'open' } = {}) {
  const encoded = encodeURIComponent(project);
  const arr = runJson('glab', ['api', `projects/${encoded}/merge_requests?state=${providerState('gitlab', state)}&per_page=50`]);
  return arr.map(r => ({ number: r.iid, title: r.title, headBranch: r.source_branch }));
}

export async function commitStatus({ project, sha }) {
  const encoded = encodeURIComponent(project);
  const arr = runJson('glab', ['api', `projects/${encoded}/commits/${sha}/statuses?per_page=1`]);
  return normalizeCommitStatus('gitlab', arr[0]?.status);
}

export async function repoCloneUrl({ host, project, token }) {
  return `https://oauth2:${token}@${host}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://${host}/-/user_settings/personal_access_tokens?name=${name}&scopes=${scopes.join(',')}`;
}

// branchProtect is not yet implemented for GitLab (Phase 3).
// The verb is in the contract so the door is open; classic-protection vs rulesets
// will be resolved in the Phase 3 spike.
// eslint-disable-next-line no-unused-vars
export async function branchProtect({ project, branch = 'main', checks, requiredReviews = 1 } = {}) {
  throw new Error('gitlab.branchProtect: not yet implemented (Phase 3)');
}

/**
 * GitLab capability probe — stub for Phase 3.
 * Returns 'unknown' rather than throwing so brain:governance-status can still render.
 */
export async function capabilities() {
  return { hardEnforcement: 'unknown', detail: 'gitlab not yet implemented (Phase 3)' };
}
