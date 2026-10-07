// project-slug.test.mjs — the ONE resolver of "which repository is this" (#1273).
// Red first: nothing exported `lib/project-slug.mjs` before; every reader resolved the slug itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

test('#1273: the resolved slug is TRIMMED', () => {
  assert.deepEqual(resolveProjectSlug({ config: { project: { slug: ' acme/widgets ' } } }), { slug: 'acme/widgets', source: 'config' });
});

test('#1273: the origin lookup is memoised per (config, cwd) — N calls, one git spawn', () => {
  let spawns = 0;
  // the default seam is the memoised one; count real spawns through a PATH shim
  const dir = testTmp('git-shim-');
  const log = join(dir, 'calls.log');
  writeFileSync(join(dir, 'git'), `#!/bin/sh\necho x >> "${log}"\nPATH="${process.env.PATH}" exec git "$@"\n`);
  chmodSync(join(dir, 'git'), 0o755);
  const cwd = repoWithOrigin('git@github.com:acme/widgets.git');
  const config = {};
  const prev = process.env.PATH;
  process.env.PATH = `${dir}:${prev}`;
  try {
    for (let i = 0; i < 25; i++) assert.equal(resolveProjectSlug({ config, cwd }).slug, 'acme/widgets');
  } finally { process.env.PATH = prev; }
  spawns = readFileSync(log, 'utf8').trim().split('\n').length;
  assert.equal(spawns, 1);
});

