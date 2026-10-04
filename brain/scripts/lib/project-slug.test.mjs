// project-slug.test.mjs — the ONE resolver of "which repository is this" (#1273).
// Red first: nothing exported `lib/project-slug.mjs` before; every reader resolved the slug itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { testTmp } from './test-tmp.mjs';
import {
  resolveProjectSlug,
  projectSlugOrNull,
  ProjectSlugError,
  PROJECT_SLUG_FIX,
  describeSlugRefusal,
} from './project-slug.mjs';

function repoWithOrigin(url) {
  const cwd = testTmp('project-slug-');
  const run = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  run('init', '-q');
  if (url) run('remote', 'add', 'origin', url);
  return cwd;
}

test('#1273: a configured project.slug wins and is reported as source "config"', () => {
  const r = resolveProjectSlug({ config: { project: { slug: 'acme/widgets' } }, cwd: repoWithOrigin('git@github.com:other/thing.git') });
  assert.deepEqual(r, { slug: 'acme/widgets', source: 'config' });
});

test('#1273: an empty tracked slug falls back to the origin remote (source "origin")', () => {
  const cwd = repoWithOrigin('https://github.com/acme/widgets.git');
  for (const config of [{}, { project: {} }, { project: { slug: '' } }]) {
    assert.deepEqual(resolveProjectSlug({ config, cwd }), { slug: 'acme/widgets', source: 'origin' });
  }
});

test('#1273: the git seam is honoured (no process spawned when injected)', () => {
  const git = { try: () => ({ status: 0, stdout: 'git@gitlab.com:grp/sub/repo.git\n' }) };
  assert.deepEqual(resolveProjectSlug({ config: {}, git }), { slug: 'grp/sub/repo', source: 'origin' });
});

test('#1273: no slug and no origin refuses, naming the fix', () => {
  const cwd = repoWithOrigin(null);
  assert.throws(() => resolveProjectSlug({ config: {}, cwd }), (e) => {
    assert.ok(e instanceof ProjectSlugError);
    assert.match(e.message, /npm run brain:config -- set project\.slug <owner\/repo>/);
    return true;
  });
  assert.equal(PROJECT_SLUG_FIX, 'npm run brain:config -- set project.slug <owner/repo>');
});

test('#1273: projectSlugOrNull never throws and never invents a slug', () => {
  assert.equal(projectSlugOrNull({ config: {}, cwd: repoWithOrigin(null) }), null);
  assert.equal(projectSlugOrNull({ config: { project: { slug: 'a/b' } } }), 'a/b');
});

test('#1273: the refusal is localised, en and es, both naming the same fix', async () => {
  const err = new ProjectSlugError();
  const en = await describeSlugRefusal(err, { locale: 'en' });
  const es = await describeSlugRefusal(err, { locale: 'es' });
  assert.match(en, /brain:config -- set project\.slug <owner\/repo>/);
  assert.match(es, /brain:config -- set project\.slug <owner\/repo>/);
  assert.notEqual(en, es);
});
