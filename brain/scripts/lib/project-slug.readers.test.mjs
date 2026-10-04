// project-slug.readers.test.mjs — #1273: the verbs that used to break on an empty tracked
// slug now resolve it through lib/project-slug.mjs. A temp git repo supplies the origin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { testTmp } from './test-tmp.mjs';
import { activateProtection } from '../brain-protect.mjs';
import { fetchPrMeta } from './merge-walk.mjs';
import { ensureLabels } from './env-init-setup.mjs';
import { projectSlugOrNull } from './project-slug.mjs';

function repo(origin) {
  const cwd = testTmp('slug-readers-');
  const git = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  if (origin) git('remote', 'add', 'origin', origin);
  return cwd;
}

async function inDir(cwd, fn) {
  const prev = process.cwd();
  process.chdir(cwd);
  try { return await fn(); } finally { process.chdir(prev); }
}

const EMPTY = { project: { slug: '' }, vcs: { provider: 'github' }, governance: { tier: 'lite' } };

test('#1273 brain:protect: an empty tracked slug arms protection on the origin repository', async () => {
  const calls = [];
  const providerModule = { branchProtect: async (a) => { calls.push(a); return { enforced: false, reason: 'stub' }; } };
  const cwd = repo('git@github.com:acme/widgets.git');
  const log = console.log; console.log = () => {};
  try { await inDir(cwd, () => activateProtection({ _config: EMPTY, _providerModule: providerModule })); } finally { console.log = log; }
  assert.equal(calls[0].project, 'acme/widgets');
});

test('#1273 brain:protect: no slug and no origin refuses naming the fix, and exits 1', async () => {
  const cwd = repo(null);
  const errs = [];
  const err = console.error; console.error = (m) => errs.push(String(m));
  const exit = process.exit; process.exit = (c) => { throw Object.assign(new Error('exit'), { exitCode: c }); };
  try {
    await assert.rejects(inDir(cwd, () => activateProtection({ _config: EMPTY, _providerModule: { branchProtect: async () => ({}) } })), (e) => e.exitCode === 1);
  } finally { console.error = err; process.exit = exit; }
  assert.match(errs.join('\n'), /brain:config -- set project\.slug <owner\/repo>/);
});

test('#1273 merge-walk (brain:audit, brain:metrics): the PR lookup carries the origin slug when the tracked one is empty', async () => {
  const seen = [];
  const vcs = { prView: async (a) => { seen.push(a.project); return { absent: false, labels: [], body: '', author: 'x' }; }, prReviews: async () => [] };
  await inDir(repo('https://github.com/acme/widgets.git'), () => fetchPrMeta('Merge pull request #7 from a/b', vcs, EMPTY, 'abc'));
  assert.equal(seen[0], 'acme/widgets');
});

test('#1273 env:init labels: an empty tracked slug no longer reads as "nothing to label"', async () => {
  const cwd = repo('git@github.com:acme/widgets.git');
  const slug = await inDir(cwd, () => projectSlugOrNull({ config: EMPTY }));
  assert.equal(slug, 'acme/widgets');
  const r = await ensureLabels({ config: EMPTY, provider: 'github', project: slug, vcs: { labelList: async () => [], labelCreate: async () => ({}) } });
  assert.equal(r.pending?.reason?.includes('project.slug is empty'), false);
});

test('#1273 env:init labels: with neither slug nor origin the pending reason is the shared refusal text and fix', async () => {
  const r = await ensureLabels({ config: EMPTY, provider: 'github', project: null, vcs: {} });
  assert.match(r.pending.reason, /brain:config -- set project\.slug <owner\/repo>/);
  assert.match(r.pending.reason, /origin/);
});
