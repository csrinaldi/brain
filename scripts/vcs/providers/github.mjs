// github.mjs — GitHub provider (gh CLI). Implements brain/core/methodology/vcs-contract.md.
//
// All verbs return the NORMALIZED shapes from the contract (number, body,
// headBranch, username, canonical commit-status enum). Auth uses the gh session
// (ensured by day:start); the token is only needed by the URL-building verbs,
// which receive it from the caller.

import { run, runJson } from '../lib/exec.mjs';
import { normalizeCommitStatus, providerState, assigneeParams } from '../lib/normalize.mjs';

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

export async function authLogin({ host, token }) {
  return run('gh', ['auth', 'login', '--hostname', host || 'github.com', '--with-token'], { input: token }).ok;
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

export async function repoCloneUrl({ host, project, token }) {
  return `https://x-access-token:${token}@${host || 'github.com'}/${project}.git`;
}

export async function patSetupUrl({ host, name, scopes }) {
  return `https://github.com/settings/tokens/new?description=${name}&scopes=${scopes.join(',')}`;
}
