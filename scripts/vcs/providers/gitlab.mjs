// gitlab.mjs — GitLab provider (glab CLI + /api/v4). Implements brain/core/methodology/vcs-contract.md.
//
// PR1: skeleton — defines the verb interface; bodies land in PR2.
// This provider must reproduce the CURRENT behavior of the harness scripts
// exactly (parity), so a revert to it leaves the GitLab flow intact.
// All verbs return the NORMALIZED shapes from the contract.

const TODO = (verb) => { throw new Error(`gitlab.${verb}: not implemented yet (vcs-adapter PR2)`); };

export const PROVIDER = 'gitlab';

export async function authCheck(/* { host } */) { return TODO('authCheck'); }
export async function authLogin(/* { host, token } */) { return TODO('authLogin'); }
export async function whoami() { return TODO('whoami'); }
export async function issueView(/* { project, number } */) { return TODO('issueView'); }
export async function issueList(/* { project, state, assignee } */) { return TODO('issueList'); }
export async function mrList(/* { project, state } */) { return TODO('mrList'); }
export async function commitStatus(/* { project, sha } */) { return TODO('commitStatus'); }
export async function repoCloneUrl(/* { host, project, token } */) { return TODO('repoCloneUrl'); }
export async function patSetupUrl(/* { host, name, scopes } */) { return TODO('patSetupUrl'); }
// GitLab needs the numeric project id — resolved via the API in PR2.
export async function projectResolve(/* { project } */) { return TODO('projectResolve'); }
