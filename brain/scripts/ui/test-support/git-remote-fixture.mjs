// git-remote-fixture.mjs — a REAL git topology for the remote-changes tests
// (#1201): a bare `origin.git`, a `pusher` clone that publishes the branches,
// and a `served` clone whose `refs/remotes/origin/*` are what the code reads.
// Dates and author names are pinned, so every sha-independent field is
// deterministic. No test fetches from the real network: origin is a local path.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { testTmp } from '../../lib/test-tmp.mjs';

export const FIXTURE_EPOCH = Date.UTC(2026, 8, 1, 12, 0, 0);
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RESUME_VALID = '---\nfeature: issue-11-a\ncurrent_slice: 2\nnext_action: ship the reader\nblockers:\ncheckpointed_at: 2026-09-30T00:00:00.000Z\ncheckpointed_from: host/feat/issue-11-a\n---\nbody\n';
export const RESUME_INVALID = '---\nfeature: issue-12-b\ncurrent_slice: 1\nblockers:\n---\nno next_action\n';

const baseEnv = (author, when) => ({
  ...process.env,
  GIT_AUTHOR_NAME: author, GIT_AUTHOR_EMAIL: `${author.toLowerCase().replace(/\W+/g, '.')}@example.com`,
  GIT_COMMITTER_NAME: author, GIT_COMMITTER_EMAIL: `${author.toLowerCase().replace(/\W+/g, '.')}@example.com`,
  GIT_AUTHOR_DATE: new Date(when).toISOString(), GIT_COMMITTER_DATE: new Date(when).toISOString(),
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0',
});

export function git(cwd, args, { author = 'Fixture', when = FIXTURE_EPOCH } = {}) {
  return execFileSync('git', args, { cwd, env: baseEnv(author, when), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * `makeRemoteFixture()` -> {origin, pusher, served, addBranch, deleteRemoteBranch, refresh, shas}
 * `addBranch(name, files, {author, ageDays, from, exact})` publishes one branch off `from` (default main); `exact` drops the per-call second offset so two tips can share one date.
 * `refresh()` makes `served` see the remote again (a plain fetch — fixture plumbing, never code under test).
 */
export function makeRemoteFixture({ standard = true } = {}) {
  const root = testTmp('remote-fixture-');
  const origin = join(root, 'origin.git');
  const pusher = join(root, 'pusher');
  const served = join(root, 'served');
  mkdirSync(pusher, { recursive: true });
  git(root, ['init', '-q', '--bare', '-b', 'main', origin]);
  git(pusher, ['init', '-q', '-b', 'main']);
  git(pusher, ['remote', 'add', 'origin', origin]);
  writeFileSync(join(pusher, 'README.md'), 'fixture\n');
  git(pusher, ['add', '-A']);
  git(pusher, ['commit', '-q', '-m', 'init']);
  git(pusher, ['push', '-q', 'origin', 'main']);

  const shas = {};
  let tick = 0;
  function addBranch(name, files = {}, { author = 'Ada Lovelace', ageDays = 1, from = 'main', exact = false } = {}) {
    tick += 1;
    git(pusher, ['checkout', '-q', '-B', name, from]);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(pusher, dirname(path)), { recursive: true });
      writeFileSync(join(pusher, path), text);
    }
    if (Object.keys(files).length === 0) writeFileSync(join(pusher, `marker-${tick}.txt`), `${name}\n`);
    git(pusher, ['add', '-A'], { author });
    git(pusher, ['commit', '-q', '-m', `work on ${name}`], { author, when: FIXTURE_EPOCH - ageDays * DAY_MS + (exact ? 0 : tick * 1000) });
    git(pusher, ['push', '-q', '-f', 'origin', name]);
    shas[name] = git(pusher, ['rev-parse', 'HEAD']).trim();
    git(pusher, ['checkout', '-q', 'main']);
    return shas[name];
  }
  const deleteRemoteBranch = (name) => git(pusher, ['push', '-q', 'origin', '--delete', name]);

  if (standard) {
    shas['feat/issue-13-c'] = git(pusher, ['rev-parse', 'main']).trim();
    git(pusher, ['push', '-q', 'origin', 'main:refs/heads/feat/issue-13-c']);
    addBranch('feat/issue-11-a', { 'openspec/changes/issue-11-a/proposal.md': '# A\nPROPOSAL-BODY-A\n', 'openspec/changes/issue-11-a/spec.md': '# spec A\nSPEC-BODY-A\n', 'openspec/changes/issue-11-a/resume.md': RESUME_VALID }, { author: 'Ada Lovelace', ageDays: 2 });
    addBranch('feat/issue-12-b', { 'openspec/changes/issue-12-b/proposal.md': '# B\nPROPOSAL-BODY-B\n', 'openspec/changes/issue-12-b/resume.md': RESUME_INVALID }, { author: 'Grace Hopper', ageDays: 3 });
    addBranch('memory/h-2026-10-01', { '.memory/records/r.jsonl': '{}\n' }, { ageDays: 1 });
    addBranch('auto-archive/2026-10-01', { 'openspec/changes/archive/x.md': 'x\n' }, { ageDays: 1 });
    addBranch('spike/x', { 'spike.txt': 'x\n' }, { author: 'Linus T', ageDays: 10 });
    // A branch whose work main already took: merged by definition (tip is an ancestor).
    addBranch('feat/issue-15-m', { 'openspec/changes/issue-15-m/proposal.md': '# M\n' }, { ageDays: 5 });
    git(pusher, ['merge', '-q', '--ff-only', 'feat/issue-15-m']);
    git(pusher, ['push', '-q', 'origin', 'main']);
  }

  git(root, ['clone', '-q', origin, served]);
  const refresh = () => git(served, ['fetch', '-q', '--prune', 'origin']);
  return { root, origin, pusher, served, shas, addBranch, deleteRemoteBranch, refresh };
}
