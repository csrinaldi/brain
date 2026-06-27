// brain-config.test.mjs — Unit tests for ensureProjectIdentity.
// Run with: npm test  (node --test, no dependencies)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureProjectIdentity } from './brain-config.mjs';

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
