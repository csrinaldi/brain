// team-config-reviewed.git.test.mjs — the owner gate over the team config against REAL git (#1283).
//
// The unit suite asserts the arguments handed to git and never runs it. This suite builds temporary repos and drives the
// real gather path (`runTeamConfigReviewedCheck` with its DEFAULT git deps); only the forge's reviews are faked, because
// that is the one thing a temp repo cannot provide.
//
// Every spawn here reads stdin from a FILE through a bash redirect (never the `input` option) and carries a timeout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { testTmp } from '../lib/test-tmp.mjs';
import { runTeamConfigReviewedCheck, gatherTeamConfigReviewedInputs } from './team-config-reviewed.mjs';

// The production code under test inherits this env: no system config, a throwaway HOME, a fixed identity, and the
// BRAIN_HOME the repo's guards require.
const home = testTmp('tcr-git-home-');
process.env.HOME = home;
process.env.BRAIN_HOME = join(home, 'brain-home');
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CONFIG_GLOBAL = join(home, 'gitconfig');
for (const [k, v] of Object.entries({ NAME: 'Test', EMAIL: 'test@example.invalid' })) {
  process.env[`GIT_AUTHOR_${k}`] = v;
  process.env[`GIT_COMMITTER_${k}`] = v;
}
const emptyStdin = join(home, 'stdin');
writeFileSync(emptyStdin, '');

function git(cwd, ...args) {
  const r = spawnSync('bash', ['-c', 'exec git "$@" < "$0"', emptyStdin, ...args], { cwd, encoding: 'utf8', timeout: 30000, env: process.env });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

const CONFIG = 'brain.config.json';
const cfg = (owners) => `${JSON.stringify({ governance: { tier: 'standard', owners } }, null, 2)}\n`;

function newRepo(prefix = 'tcr-git-') {
  const dir = testTmp(prefix);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}
const put = (dir, file, text) => { mkdirSync(join(dir, file, '..'), { recursive: true }); writeFileSync(join(dir, file), text); };
function commit(dir, msg, files = {}) {
  for (const [f, t] of Object.entries(files)) put(dir, f, t);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', msg);
  return git(dir, 'rev-parse', 'HEAD');
}

const approval = (author, commitId) => async () => [{ state: 'APPROVED', author, commitId }];
const run = (dir, baseSha, headSha, fetchReviews = async () => []) =>
  runTeamConfigReviewedCheck({ baseSha, headSha, prNumber: 7, repo: 'o/r', author: 'alice', provider: 'github', cwd: dir, fetchReviews });

/** A PR branch off `base` whose head is made by `change`. Returns { base, head }. */
function pr(dir, change) {
  const base = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'pr');
  change();
  return { base, head: git(dir, 'rev-parse', 'HEAD') };
}

test('rename away: --no-renames lists BOTH paths, so the gate sees the team config leave', async () => {
  const dir = newRepo();
  commit(dir, 'base', { [CONFIG]: cfg(['alice', 'bob']), 'README.md': 'x\n' });
  const { base, head } = pr(dir, () => { git(dir, 'mv', CONFIG, 'team.json'); commit(dir, 'rename away'); });
  const inputs = await gatherTeamConfigReviewedInputs({ baseSha: base, headSha: head, prNumber: 7, repo: 'o/r', author: 'alice', provider: 'github', cwd: dir, deps: { fetchReviews: async () => [] } });
  assert.ok(inputs.changedFiles.includes(CONFIG), `changedFiles: ${inputs.changedFiles}`);
  assert.deepEqual(inputs.owners, ['alice', 'bob']);
  assert.equal((await run(dir, base, head)).level, 'fail');
  assert.equal((await run(dir, base, head, approval('bob', head))).level, 'pass');
});

test('delete: the owners come from the base, and an owner approval on the head passes', async () => {
  const dir = newRepo();
  commit(dir, 'base', { [CONFIG]: cfg(['alice', 'bob']) });
  const { base, head } = pr(dir, () => { git(dir, 'rm', '-q', CONFIG); commit(dir, 'delete'); });
  assert.equal((await run(dir, base, head)).level, 'fail');
  assert.equal((await run(dir, base, head, approval('bob', head))).level, 'pass');
});

test('re-add after a delete is NOT a founding: the owners are those of the version before the removal', async () => {
  const dir = newRepo();
  commit(dir, 'add', { [CONFIG]: cfg(['alice', 'bob']) });
  commit(dir, 'delete on main', { 'other.txt': 'x\n' });
  git(dir, 'rm', '-q', CONFIG);
  git(dir, 'commit', '-q', '-m', 'delete');
  const { base, head } = pr(dir, () => { commit(dir, 're-add', { [CONFIG]: cfg(['alice', 'mallory']) }); });
  const noReview = await run(dir, base, head);
  assert.equal(noReview.level, 'fail');
  assert.equal(noReview.founding, undefined);
  assert.equal((await run(dir, base, head, approval('mallory', head))).level, 'fail', 'the PR head\'s own owner list is never trusted');
  assert.equal((await run(dir, base, head, approval('bob', head))).level, 'pass');
});

/** main has the config; a side branch never had it; a merge into main drops it. Leaves the checkout on main at the merge. */
function removalThroughMerge(dir) {
  commit(dir, 'root', { 'README.md': 'x\n' });
  git(dir, 'checkout', '-q', '-b', 'side');
  commit(dir, 'side work', { 'side.txt': 's\n' });
  git(dir, 'checkout', '-q', 'main');
  commit(dir, 'add config', { [CONFIG]: cfg(['alice']) });
  commit(dir, 'config v2', { [CONFIG]: cfg(['alice', 'bob']) });
  git(dir, 'merge', '-q', '--no-commit', '--no-ff', 'side');
  git(dir, 'rm', '-q', CONFIG);
  git(dir, 'commit', '-q', '-m', 'merge side, dropping the config');
}

test('removal through a MERGE is seen by real git, and the owners come from the parent that had the file', async () => {
  const dir = newRepo();
  removalThroughMerge(dir);
  // The premise: default history simplification really does hide this deletion.
  assert.equal(git(dir, 'log', '-1', '--format=%H', 'main', '--', CONFIG), '', 'default simplification prints nothing');
  const { base, head } = pr(dir, () => { commit(dir, 're-add', { [CONFIG]: cfg(['alice', 'mallory']) }); });
  const noReview = await run(dir, base, head);
  assert.equal(noReview.level, 'fail', noReview.reason);
  assert.notEqual(noReview.founding, true);
  assert.equal((await run(dir, base, head, approval('bob', head))).level, 'pass');
});

test('removal through a merge whose FIRST parent never had the file: the owners come from the second parent', async () => {
  const dir = newRepo();
  commit(dir, 'root', { 'README.md': 'x\n' });
  git(dir, 'checkout', '-q', '-b', 'withconfig');
  commit(dir, 'add config', { [CONFIG]: cfg(['alice', 'bob']) });
  git(dir, 'checkout', '-q', 'main');
  commit(dir, 'main work', { 'main.txt': 'm\n' });
  git(dir, 'merge', '-q', '--no-commit', '--no-ff', 'withconfig');
  git(dir, 'rm', '-q', '-f', CONFIG);
  git(dir, 'commit', '-q', '-m', 'merge dropping the config');
  const { base, head } = pr(dir, () => { commit(dir, 're-add', { [CONFIG]: cfg(['alice', 'mallory']) }); });
  assert.equal((await run(dir, base, head)).level, 'fail');
  assert.equal((await run(dir, base, head, approval('bob', head))).level, 'pass');
});

test('a shallow clone cannot tell a deletion from a founding: it is an evidence failure, never a pass', async () => {
  const src = newRepo('tcr-git-src-');
  commit(src, 'add', { [CONFIG]: cfg(['alice', 'bob']) });
  git(src, 'rm', '-q', CONFIG);
  git(src, 'commit', '-q', '-m', 'delete');
  const { base, head } = pr(src, () => { commit(src, 're-add', { [CONFIG]: cfg(['alice']) }); });
  const clone = join(testTmp('tcr-git-clone-'), 'c');
  git(src, 'clone', '-q', '--depth', '2', '--branch', 'pr', `file://${src}`, clone);
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true');
  const r = await run(clone, base, head);
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /shallow/);
  assert.notEqual(r.founding, true);
});

test('a genuine founding: the base never had the file, in a full history, so it passes labelled', async () => {
  const dir = newRepo();
  commit(dir, 'base', { 'README.md': 'x\n' });
  const { base, head } = pr(dir, () => { commit(dir, 'adopt', { [CONFIG]: cfg(['alice']) }); });
  const r = await run(dir, base, head);
  assert.equal(r.level, 'pass');
  assert.equal(r.founding, true);
});

test.after(() => { try { rmSync(emptyStdin, { force: true }); } catch { /* best effort */ } });
