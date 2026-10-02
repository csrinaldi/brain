// resume-path.test.mjs — #1201 R2 (D38): the reader finds the file the writer
// actually writes. The fixture is produced by the REAL `featureCheckpoint`, never
// typed by hand, so a reader that looks at the branch root fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildChangeView } from './change-route.mjs';
import { gitRun } from './git-run.mjs';
import { featureCheckpoint } from '../axes/memory/adapters/engram.mjs';
import { testTmp } from '../lib/test-tmp.mjs';

const ISSUE = 7;
const BRANCH = 'feat/issue-7-x';
const DIR = 'openspec/changes/issue-7-x';
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function repo({ changeDir = true } = {}) {
  const root = testTmp('resume-path-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'checkout', '-q', '-b', BRANCH);
  writeFileSync(join(root, 'README.md'), 'x\n');
  if (changeDir) {
    mkdirSync(join(root, DIR), { recursive: true });
    writeFileSync(join(root, DIR, 'proposal.md'), '# p\n');
  }
  return root;
}

const snapshotFor = (changeDir = true) => ({
  changes: { ok: true, value: changeDir ? [{ id: 'issue-7-x', issue: ISSUE, slug: 'x', dir: DIR }] : [] },
  prs: { ok: true, value: [] },
  reviews: { ok: true, value: [] },
  records: { ok: true, value: { records: [], duplicates: { ids: 0 } } },
});

function commitAll(root) {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'fixture');
}

test('#1201 R2: a resume.md written by the real featureCheckpoint is found at the change dir', async () => {
  const root = repo();
  const log = console.log;
  console.log = () => {};
  try {
    await featureCheckpoint('issue-7-x', {
      root, getTimestamp: () => '2026-10-01T00:00:00.000Z', getHostname: () => 'host', getBranch: () => BRANCH, _doEngramEnrich: () => {},
    });
  } finally { console.log = log; }
  commitAll(root);

  const view = buildChangeView({ root, issue: ISSUE, snapshot: snapshotFor(), _run: gitRun(root) });
  const { resume } = view.value.documents;
  assert.equal(resume.state, 'present', JSON.stringify(resume));
  assert.equal(resume.path, `${DIR}/resume.md`);
  assert.equal(view.value.workingMemory.ok, true, JSON.stringify(view.value.workingMemory));
  assert.equal(view.value.workingMemory.value.next_action.source.path, `${BRANCH}:${DIR}/resume.md`);
  for (const field of ['next_action', 'current_slice', 'blockers']) assert.equal(view.value.workingMemory.value[field].ok, true, field);
  for (const field of ['checkpointed_from', 'checkpointed_at', 'current_slice', 'next_action', 'blockers']) {
    assert.match(resume.text, new RegExp(`^${field}:`, 'm'), field);
  }
});

test('#1201 R2: a root-only resume.md is missing and its content is not shown', () => {
  const root = repo();
  writeFileSync(join(root, 'resume.md'), '---\nnext_action: SECRET-ROOT\ncurrent_slice: 1\nblockers:\n---\n');
  commitAll(root);
  const view = buildChangeView({ root, issue: ISSUE, snapshot: snapshotFor(), _run: gitRun(root) });
  assert.equal(view.value.documents.resume.state, 'missing');
  assert.equal(view.value.workingMemory.ok, false);
  assert.doesNotMatch(JSON.stringify(view.value), /SECRET-ROOT/);
});

test('#1201 R2: no change dir on the branch is missing and says which issue and branch', () => {
  const root = repo({ changeDir: false });
  commitAll(root);
  const view = buildChangeView({ root, issue: ISSUE, snapshot: snapshotFor(false), _run: gitRun(root) });
  const { resume } = view.value.documents;
  assert.equal(resume.state, 'missing');
  assert.equal(resume.reason, `no change dir for #7 on ${BRANCH}`);
});
