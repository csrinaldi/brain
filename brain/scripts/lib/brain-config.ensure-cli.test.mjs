// brain-config.ensure-cli.test.mjs — the CLI-level pin for `brain-config.mjs ensure` (#1127).
//
// The unit test proves `ensureBrainConfig` RETURNS an error for an unparseable config; what
// bootstrap.sh reads is the PROCESS EXIT CODE. Without this, deleting the
// `process.exitCode = 1` line leaves every unit test green and env:init silently reads an
// empty config again. The module resolves its config path from its own location, so it is run
// from a COPY of the brain tree inside a temp repo — never against the real checkout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testTmp } from './test-tmp.mjs';
const git = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('#1127 ensure (CLI): an unparseable brain.config.json exits 1, says why, and leaves the file untouched', () => {
  const root = testTmp('ensure-cli-');
  const repo = join(root, 'repo');
  mkdirSync(join(repo, '.git'), { recursive: true });
  cpSync(join(REPO, 'brain'), join(repo, 'brain'), { recursive: true, filter: (s) => !s.includes('node_modules') });
  cpSync(join(REPO, 'package.json'), join(repo, 'package.json'));
  const config = join(repo, 'brain.config.json');
  writeFileSync(config, '{ not json');

  const r = spawnSync(process.execPath, [join(repo, 'brain', 'scripts', 'lib', 'brain-config.mjs'), 'ensure'], {
    cwd: repo,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: root, XDG_RUNTIME_DIR: root, DBUS_SESSION_BUS_ADDRESS: '' },
  });

  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /brain\.config\.json/);
  assert.equal(readFileSync(config, 'utf8'), '{ not json', 'the file must be untouched');
});

// ── the founding signal (#1263 slice 2): the creator says whether it created, nobody re-derives it ────────────────────
function copyRepo(name) {
  const root = testTmp(name);
  const repo = join(root, 'repo');
  mkdirSync(join(repo, '.git'), { recursive: true });
  cpSync(join(REPO, 'brain'), join(repo, 'brain'), { recursive: true, filter: (s) => !s.includes('node_modules') });
  cpSync(join(REPO, 'package.json'), join(repo, 'package.json'));
  return { root, repo };
}
const ensureWith = (root, repo, ...extra) => spawnSync(process.execPath, [join(repo, 'brain', 'scripts', 'lib', 'brain-config.mjs'), 'ensure', ...extra], {
  cwd: repo, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  env: { PATH: process.env.PATH, HOME: root, XDG_RUNTIME_DIR: root, DBUS_SESSION_BUS_ADDRESS: '', BRAIN_HOME: join(root, 'bh') },
});

test('#1263 ensure --founding-file: the run that CREATES brain.config.json reports "founding"', () => {
  const { root, repo } = copyRepo('ensure-founding-');
  const flag = join(root, 'founding');
  const r = ensureWith(root, repo, '--founding-file', flag);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.equal(readFileSync(flag, 'utf8').trim(), 'founding');
});

test('#1263 ensure --founding-file: a run on an EXISTING brain.config.json reports "existing" and leaves the file byte-identical', () => {
  const { root, repo } = copyRepo('ensure-existing-');
  const config = join(repo, 'brain.config.json');
  const body = `${JSON.stringify({ schemaVersion: '1.11.1', project: { gitHost: 'h', slug: 's' } }, null, 2)}\n`;
  writeFileSync(config, body);
  const flag = join(root, 'founding');
  const r = ensureWith(root, repo, '--founding-file', flag);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.equal(readFileSync(flag, 'utf8').trim(), 'existing');
  assert.equal(readFileSync(config, 'utf8'), body);
});

// ── identity backfill is a team write: never in an existing repo (#1263 slice 2, ruling on ADR-0040) ──────────────────
test('#1263 ensure: an EXISTING repo with an empty slug keeps brain.config.json BYTE-IDENTICAL and the gap is reported with a copy-paste fix', () => {
  const { root, repo } = copyRepo('ensure-nofill-');
  git(repo, 'init', '-q');
  git(repo, 'remote', 'add', 'origin', 'https://example.com/acme/widget.git');
  const config = join(repo, 'brain.config.json');
  const body = `${JSON.stringify({ schemaVersion: '1.11.1', project: { gitHost: '', slug: '' } }, null, 2)}\n`;
  writeFileSync(config, body);
  const r = ensureWith(root, repo);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.equal(readFileSync(config, 'utf8'), body);
  assert.match(r.stdout + r.stderr, /the team config has no project\.slug; propose it with `npm run brain:config -- set project\.slug acme\/widget` in a PR/);
});

test('#1263 ensure: the FOUNDING run still derives and writes gitHost and slug', () => {
  const { root, repo } = copyRepo('ensure-fill-');
  git(repo, 'init', '-q');
  git(repo, 'remote', 'add', 'origin', 'https://example.com/acme/widget.git');
  assert.equal(ensureWith(root, repo).status, 0);
  const cfg = JSON.parse(readFileSync(join(repo, 'brain.config.json'), 'utf8'));
  assert.equal(cfg.project.slug, 'acme/widget');
  assert.equal(cfg.project.gitHost, 'example.com');
});
