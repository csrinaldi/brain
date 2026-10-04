// git-worktree-fixture.mjs — a REAL git repo with linked worktrees, for the
// local-overlay tests (#883). `main` is the served root; every worktree is a
// sibling dir made by `git worktree add -b`, so it shares main's object store
// exactly like a real `brain:ticket:start` worktree does. Dates, names and
// emails are pinned through the environment of each call (never the global
// config). There is no remote: nothing here can reach the network.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { testTmp } from '../../lib/test-tmp.mjs';

export const WORKTREE_EPOCH = Date.UTC(2026, 9, 1, 12, 0, 0);

const fixtureEnv = () => ({
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.com',
  GIT_AUTHOR_DATE: new Date(WORKTREE_EPOCH).toISOString(), GIT_COMMITTER_DATE: new Date(WORKTREE_EPOCH).toISOString(),
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0',
});

export function git(cwd, args) {
  return execFileSync('git', args, { cwd, env: fixtureEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeFiles(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

/**
 * `makeWorktreeRepo({mainFiles})` -> {base, root, addWorktree, dispose}
 * `addWorktree(branch, files, {commit})` -> {path, head, branch}: a linked worktree on a new
 * branch off main's HEAD; `files` are written into it and, with `commit`, committed on that branch.
 * `dispose()` removes the linked worktrees through git, prunes, then deletes the tree.
 */
export function makeWorktreeRepo({ mainFiles = {} } = {}) {
  const base = testTmp('worktree-fixture-');
  const root = join(base, 'main');
  mkdirSync(root, { recursive: true });
  git(root, ['-c', 'init.defaultBranch=main', 'init', '-q']);
  writeFiles(root, { 'README.md': 'fixture\n', ...mainFiles });
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'init']);

  const added = [];
  function addWorktree(branch, files = {}, { commit = false } = {}) {
    const path = join(base, `wt-${added.length + 1}-${branch.replace(/\W+/g, '-')}`);
    git(root, ['worktree', 'add', '-q', '-b', branch, path]);
    writeFiles(path, files);
    if (commit) {
      git(path, ['add', '-A']);
      git(path, ['commit', '-q', '-m', `work on ${branch}`]);
    }
    added.push(path);
    return { path, branch, head: git(path, ['rev-parse', 'HEAD']).trim() };
  }

  function dispose() {
    for (const path of added) {
      try { git(root, ['worktree', 'remove', '--force', path]); } catch { /* already gone */ }
    }
    try { git(root, ['worktree', 'prune']); } catch { /* the repo may be gone */ }
    rmSync(base, { recursive: true, force: true });
  }

  return { base, root, addWorktree, dispose };
}
