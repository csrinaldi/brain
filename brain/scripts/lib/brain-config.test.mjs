// brain-config.test.mjs — Unit tests for brain-config.mjs.
// Run with: npm test  (node --test, no dependencies)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureProjectIdentity, providerFromHost, ensureBrainConfig } from './brain-config.mjs';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a temp dir containing brain.config.json with given project overrides.
 * Returns the dir path.
 */
function makeTmpConfig(projectFields = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-cfg-'));
  const cfg = {
    project: {
      name: 'brain',
      slug: '',
      gitHost: '',
      gitProjectId: '',
      owner: '',
      ...projectFields,
    },
    docs: { language: 'en' },
    vcs: { provider: 'github' },
    schemaVersion: '0.3.0',
  };
  writeFileSync(join(dir, 'brain.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  return dir;
}

function readCfg(dir) {
  return JSON.parse(readFileSync(join(dir, 'brain.config.json'), 'utf8'));
}

const IDENTITY = { host: 'github.com', project: 'csrinaldi/brain' };

// ── tests ─────────────────────────────────────────────────────────────────────

test('ensureProjectIdentity: fills empty gitHost and slug', () => {
  const dir = makeTmpConfig();
  try {
    const result = ensureProjectIdentity(dir, { identity: IDENTITY });
    assert.deepEqual(result.filled.sort(), ['gitHost', 'slug']);
    const cfg = readCfg(dir);
    assert.equal(cfg.project.gitHost, 'github.com');
    assert.equal(cfg.project.slug, 'csrinaldi/brain');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureProjectIdentity: does NOT overwrite non-empty gitHost', () => {
  const dir = makeTmpConfig({ gitHost: 'gitlab.com' });
  try {
    const result = ensureProjectIdentity(dir, { identity: IDENTITY });
    assert.ok(!result.filled.includes('gitHost'), 'gitHost must not be in filled[]');
    const cfg = readCfg(dir);
    assert.equal(cfg.project.gitHost, 'gitlab.com');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureProjectIdentity: does NOT overwrite non-empty slug', () => {
  const dir = makeTmpConfig({ slug: 'myorg/myrepo' });
  try {
    const result = ensureProjectIdentity(dir, { identity: IDENTITY });
    assert.ok(!result.filled.includes('slug'), 'slug must not be in filled[]');
    const cfg = readCfg(dir);
    assert.equal(cfg.project.slug, 'myorg/myrepo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureProjectIdentity: idempotent — second call returns filled=[]', () => {
  const dir = makeTmpConfig();
  try {
    const first = ensureProjectIdentity(dir, { identity: IDENTITY });
    assert.ok(first.filled.length > 0, 'first call should fill at least one field');
    const second = ensureProjectIdentity(dir, { identity: IDENTITY });
    assert.deepEqual(second.filled, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureProjectIdentity: empty origin ({host: null}) → no-op, config unchanged', () => {
  const dir = makeTmpConfig();
  try {
    const result = ensureProjectIdentity(dir, { identity: { host: null, project: null } });
    assert.deepEqual(result.filled, []);
    const cfg = readCfg(dir);
    assert.equal(cfg.project.gitHost, '', 'gitHost must remain empty');
    assert.equal(cfg.project.slug, '',   'slug must remain empty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureProjectIdentity: preserves other config keys and trailing newline', () => {
  const dir = makeTmpConfig({ gitProjectId: '999', owner: 'csr' });
  try {
    ensureProjectIdentity(dir, { identity: IDENTITY });
    const raw = readFileSync(join(dir, 'brain.config.json'), 'utf8');
    assert.ok(raw.endsWith('\n'), 'written file must end with a newline');
    const cfg = JSON.parse(raw);
    // Filled fields
    assert.equal(cfg.project.gitHost, 'github.com');
    assert.equal(cfg.project.slug, 'csrinaldi/brain');
    // Untouched fields preserved
    assert.equal(cfg.project.name,        'brain');
    assert.equal(cfg.project.gitProjectId, '999');
    assert.equal(cfg.project.owner,        'csr');
    assert.deepEqual(cfg.docs,        { language: 'en' });
    assert.deepEqual(cfg.vcs,         { provider: 'github' });
    assert.equal(cfg.schemaVersion, '0.3.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── providerFromHost ───────────────────────────────────────────────────────────

test('providerFromHost: github.com → "github"', () => {
  assert.equal(providerFromHost('github.com'), 'github');
});

test('providerFromHost: gitlab.com → "gitlab"', () => {
  assert.equal(providerFromHost('gitlab.com'), 'gitlab');
});

test('providerFromHost: self-hosted gitlab subdomain → "gitlab"', () => {
  assert.equal(providerFromHost('gitlab.example.com'), 'gitlab');
});

test('providerFromHost: unknown host → ""', () => {
  assert.equal(providerFromHost('bitbucket.org'), '');
});

// ── ensureBrainConfig ─────────────────────────────────────────────────────────

test('ensureBrainConfig: creates config when missing with github identity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ensure-'));
  try {
    const result = ensureBrainConfig(dir, { identity: { host: 'github.com', project: 'owner/repo' } });
    assert.equal(result.created, true);
    assert.equal(result.provider, 'github');

    const raw = readFileSync(join(dir, 'brain.config.json'), 'utf8');
    assert.ok(raw.endsWith('\n'), 'written file must end with a newline');
    const cfg = JSON.parse(raw);
    assert.equal(cfg.vcs.provider, 'github');
    assert.equal(cfg.project.gitHost, 'github.com');
    assert.equal(cfg.project.slug, 'owner/repo');
    assert.equal(cfg.schemaVersion, '0.5.0');
    // Full schema must exist
    assert.ok('project' in cfg, 'project key must exist');
    assert.ok('docs' in cfg, 'docs key must exist');
    assert.ok('vcs' in cfg, 'vcs key must exist');
    assert.ok('governance' in cfg, 'governance key must exist');
    assert.ok(Array.isArray(cfg.governance.ignoreList), 'governance.ignoreList must be an array');
    assert.ok('gitHost' in cfg.project, 'project.gitHost must exist');
    assert.ok('name' in cfg.project, 'project.name must exist');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureBrainConfig: creates config when missing with gitlab identity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ensure-'));
  try {
    const result = ensureBrainConfig(dir, { identity: { host: 'gitlab.com', project: 'group/repo' } });
    assert.equal(result.created, true);
    assert.equal(result.provider, 'gitlab');

    const cfg = JSON.parse(readFileSync(join(dir, 'brain.config.json'), 'utf8'));
    assert.equal(cfg.vcs.provider, 'gitlab');
    assert.equal(cfg.project.gitHost, 'gitlab.com');
    assert.equal(cfg.project.slug, 'group/repo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureBrainConfig: existing config → fills empty gitHost/slug, does NOT overwrite provider', () => {
  const dir = makeTmpConfig(); // provider='github', gitHost='', slug=''
  try {
    const result = ensureBrainConfig(dir, { identity: { host: 'github.com', project: 'owner/repo' } });
    assert.equal(result.created, false);
    assert.ok(result.filled.includes('gitHost'), 'should fill gitHost');
    assert.ok(result.filled.includes('slug'), 'should fill slug');

    const cfg = readCfg(dir);
    assert.equal(cfg.project.gitHost, 'github.com');
    assert.equal(cfg.project.slug, 'owner/repo');
    assert.equal(cfg.vcs.provider, 'github'); // NOT overwritten
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureBrainConfig: existing config with set values → nothing overwritten', () => {
  const dir = makeTmpConfig({ gitHost: 'gitlab.com', slug: 'org/proj' });
  try {
    const result = ensureBrainConfig(dir, { identity: { host: 'github.com', project: 'other/repo' } });
    assert.equal(result.created, false);
    assert.deepEqual(result.filled, []); // nothing was empty to fill

    const cfg = readCfg(dir);
    assert.equal(cfg.project.gitHost, 'gitlab.com');
    assert.equal(cfg.project.slug, 'org/proj');
    assert.equal(cfg.vcs.provider, 'github'); // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureBrainConfig: idempotent — second call does not recreate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ensure-'));
  const identity = { host: 'github.com', project: 'owner/repo' };
  try {
    const first = ensureBrainConfig(dir, { identity });
    assert.equal(first.created, true);

    const second = ensureBrainConfig(dir, { identity });
    assert.equal(second.created, false);
    assert.deepEqual(second.filled, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureBrainConfig: no origin (null host) → creates file but empty provider/host/slug', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-ensure-'));
  try {
    const result = ensureBrainConfig(dir, { identity: { host: null, project: null } });
    assert.equal(result.created, true);
    assert.equal(result.provider, '');

    const cfg = JSON.parse(readFileSync(join(dir, 'brain.config.json'), 'utf8'));
    assert.equal(cfg.project.gitHost, '');
    assert.equal(cfg.project.slug, '');
    assert.equal(cfg.vcs.provider, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
