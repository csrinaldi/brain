// github.mjs — GitHub provider (gh CLI). Implements brain/core/methodology/vcs-contract.md.
//
// PR1: skeleton — defines the verb interface; bodies land in PR2.
// All verbs return the NORMALIZED shapes from the contract (number, body,
// headBranch, username, canonical commit-status enum).

const TODO = (verb) => { throw new Error(`github.${verb}: not implemented yet (vcs-adapter PR2)`); };

export const PROVIDER = 'github';

export async function authCheck(/* { host } */) { return TODO('authCheck'); }
export async function authLogin(/* { host, token } */) { return TODO('authLogin'); }
export async function whoami() { return TODO('whoami'); }
export async function issueView(/* { project, number } */) { return TODO('issueView'); }
export async function issueList(/* { project, state, assignee } */) { return TODO('issueList'); }
export async function mrList(/* { project, state } */) { return TODO('mrList'); }
export async function commitStatus(/* { project, sha } */) { return TODO('commitStatus'); }
export async function repoCloneUrl(/* { host, project, token } */) { return TODO('repoCloneUrl'); }
export async function patSetupUrl(/* { host, name, scopes } */) { return TODO('patSetupUrl'); }
// GitHub uses the owner/repo slug directly — projectResolve is the identity.
export async function projectResolve({ project }) { return project; }
