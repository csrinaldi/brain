// installer.test.mjs — Unit tests for the brain versioned installer mechanics.
// Run with: npm test   (node --test, no dependencies)
//
// Covers the two acceptance criteria that demand proof:
//   - local paths survive an upgrade untouched
//   - config migration adds new keys without overwriting existing values

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  globToRegExp,
  matchesAny,
  copyManaged,
  mergeDefaults,
  migrateConfig,
  compareSemver,
  parseSemver,
  highestTag,
  readInstalledVersion,
  resolveInstallUrl,
  installSpec,
  BRAIN_REPO_HTTPS,
} from './installer.mjs';

// ── Glob matching ────────────────────────────────────────────────────────────
test('globToRegExp: ** matches across separators, * does not', () => {
  assert.ok(globToRegExp('brain/core/**').test('brain/core/a/b.md'));
  assert.ok(globToRegExp('brain/core/**').test('brain/core/x.md'));
  assert.ok(!globToRegExp('brain/core/**').test('brain/project/x.md'));
  // Adversarial: a sibling dir sharing the prefix must NOT match (literal slash required).
  assert.ok(!globToRegExp('brain/core/**').test('brain/core-extra/x.md'));
  assert.ok(globToRegExp('scripts/*').test('scripts/a.mjs'));
  assert.ok(!globToRegExp('scripts/*').test('scripts/sub/a.mjs'));
  assert.ok(globToRegExp('.gitattributes').test('.gitattributes'));
});

test('matchesAny: any glob in the set matches', () => {
  const globs = ['brain/core/**', '.gitattributes'];
  assert.ok(matchesAny('brain/core/x.md', globs));
  assert.ok(matchesAny('.gitattributes', globs));
  assert.ok(!matchesAny('brain.config.json', globs));
});

// ── copyManaged: local paths stay intact ───────────────────────────────────────
test('copyManaged overwrites managed paths and never touches local ones', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-test-'));
  try {
    const src = join(tmp, 'src');
    const dest = join(tmp, 'dest');

    // Source (the new brain package): managed files only.
    mkdirSync(join(src, 'brain', 'core'), { recursive: true });
    writeFileSync(join(src, 'brain', 'core', 'methodology.md'), 'NEW core');
    mkdirSync(join(src, 'scripts'), { recursive: true });
    writeFileSync(join(src, 'scripts', 'day-start.mjs'), 'NEW script');
    writeFileSync(join(src, '.gitattributes'), 'NEW attrs');
    // A file that lives in the package but is the consumer's to own. It is NOT
    // a managed path, so it must never be copied into the consumer.
    mkdirSync(join(src, 'brain', 'project'), { recursive: true });
    writeFileSync(join(src, 'brain', 'project', 'README.md'), 'UPSTREAM project readme');
    // A genuine overlap: matches a managed glob AND a local glob → must be skipped.
    writeFileSync(join(src, 'scripts', 'keep.local.mjs'), 'UPSTREAM overlap');

    // Dest (the consumer repo): pre-existing local + managed content.
    mkdirSync(join(dest, 'brain', 'core'), { recursive: true });
    writeFileSync(join(dest, 'brain', 'core', 'methodology.md'), 'OLD core');
    mkdirSync(join(dest, 'brain', 'project', 'decisions'), { recursive: true });
    writeFileSync(join(dest, 'brain', 'project', 'decisions', 'adr-0001.md'), 'MY adr');
    writeFileSync(join(dest, 'brain.config.json'), '{"project":{"name":"mine"}}');

    const managed = ['brain/core/**', 'scripts/**', '.gitattributes'];
    const local = ['brain/project/**', 'brain.config.json', '.env', '.memory/**', 'scripts/*.local.mjs'];

    const { copied, skipped } = copyManaged({ srcRoot: src, destRoot: dest, managed, local });

    // Managed files were overwritten / created.
    assert.equal(readFileSync(join(dest, 'brain', 'core', 'methodology.md'), 'utf8'), 'NEW core');
    assert.equal(readFileSync(join(dest, 'scripts', 'day-start.mjs'), 'utf8'), 'NEW script');
    assert.equal(readFileSync(join(dest, '.gitattributes'), 'utf8'), 'NEW attrs');

    // Local files are untouched.
    assert.equal(readFileSync(join(dest, 'brain', 'project', 'decisions', 'adr-0001.md'), 'utf8'), 'MY adr');
    assert.equal(readFileSync(join(dest, 'brain.config.json'), 'utf8'), '{"project":{"name":"mine"}}');

    // The upstream project/README.md is not a managed path → never copied.
    assert.ok(!existsSync(join(dest, 'brain', 'project', 'README.md')));
    assert.ok(!copied.includes('brain/project/README.md'));

    // The overlap (managed AND local) was skipped, not copied — local wins.
    assert.ok(skipped.includes('scripts/keep.local.mjs'));
    assert.ok(!existsSync(join(dest, 'scripts', 'keep.local.mjs')));

    assert.ok(copied.includes('brain/core/methodology.md'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── mergeDefaults / migrateConfig: never overwrite existing values ──────────────
test('mergeDefaults fills missing keys and preserves existing values', () => {
  const existing = { project: { name: 'mine', slug: 'org/repo' } };
  const defaults = { project: { name: 'DEFAULT', owner: 'DEFAULT' }, newSection: { flag: true } };
  const merged = mergeDefaults(existing, defaults);

  assert.equal(merged.project.name, 'mine');     // existing wins
  assert.equal(merged.project.slug, 'org/repo'); // existing preserved
  assert.equal(merged.project.owner, 'DEFAULT'); // missing key added
  assert.deepEqual(merged.newSection, { flag: true }); // new section added
});

test('migrateConfig applies a new additive migration without clobbering', () => {
  const config = {
    schemaVersion: '0.1.0',
    project: { name: 'mine', slug: 'org/repo', gitHost: 'github.com' },
  };
  const migrations = [
    { version: '0.1.0', description: 'initial', defaults: { project: { name: '', owner: '' } } },
    { version: '0.2.0', description: 'add ci section', defaults: { ci: { provider: 'github-actions' } } },
  ];
  const { config: migrated, applied } = migrateConfig(config, migrations, '0.2.0');

  assert.deepEqual(applied, ['0.2.0']);            // only the pending one ran
  assert.equal(migrated.project.name, 'mine');     // existing untouched
  assert.equal(migrated.ci.provider, 'github-actions'); // new section added
  assert.equal(migrated.schemaVersion, '0.2.0');   // version advanced
});

test('migrateConfig is idempotent — re-running applies nothing', () => {
  const config = { schemaVersion: '0.2.0', project: { name: 'mine' }, ci: { provider: 'x' } };
  const migrations = [{ version: '0.2.0', defaults: { ci: { provider: 'default' } } }];
  const { applied } = migrateConfig(config, migrations, '0.2.0');
  assert.deepEqual(applied, []);
});

// ── Semver helpers ─────────────────────────────────────────────────────────────
test('parseSemver and compareSemver', () => {
  assert.deepEqual(parseSemver('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseSemver('0.1.0-rc.1'), [0, 1, 0]);
  assert.equal(compareSemver('1.0.0', '1.0.1'), -1);
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  assert.equal(compareSemver('v1.0.0', '1.0.0'), 0);
});

test('readInstalledVersion: consumer node_modules/brain wins, falls back to own pkg', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-ver-'));
  try {
    // Consumer layout: node_modules/brain/package.json is the installed brain.
    mkdirSync(join(tmp, 'node_modules', 'brain'), { recursive: true });
    writeFileSync(join(tmp, 'node_modules', 'brain', 'package.json'), JSON.stringify({ name: 'brain', version: '0.3.0' }));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'my-consumer', version: '9.9.9' }));
    assert.equal(readInstalledVersion(tmp), '0.3.0');

    // Self-host layout: no node_modules/brain, own package.json is named brain.
    const selfHost = mkdtempSync(join(tmpdir(), 'brain-self-'));
    try {
      writeFileSync(join(selfHost, 'package.json'), JSON.stringify({ name: 'brain', version: '0.1.0' }));
      assert.equal(readInstalledVersion(selfHost), '0.1.0');
    } finally {
      rmSync(selfHost, { recursive: true, force: true });
    }

    // Neither present → null.
    const empty = mkdtempSync(join(tmpdir(), 'brain-empty-'));
    try {
      assert.equal(readInstalledVersion(empty), null);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('highestTag picks the newest semver tag and ignores peeled refs', () => {
  const stdout = [
    'abc123\trefs/tags/v0.1.0',
    'def456\trefs/tags/v0.2.0',
    'def456\trefs/tags/v0.2.0^{}',
    'ghi789\trefs/tags/not-a-version',
  ].join('\n');
  assert.equal(highestTag(stdout), 'v0.2.0');
  assert.equal(highestTag('no tags here'), null);
});

// ── resolveInstallUrl ─────────────────────────────────────────────────────────

test('resolveInstallUrl: git+https URL is returned as-is', () => {
  assert.equal(
    resolveInstallUrl('git+https://github.com/csrinaldi/brain.git'),
    'git+https://github.com/csrinaldi/brain.git',
  );
});

test('resolveInstallUrl: plain https URL gets git+ prefix', () => {
  assert.equal(
    resolveInstallUrl('https://github.com/csrinaldi/brain.git'),
    'git+https://github.com/csrinaldi/brain.git',
  );
});

test('resolveInstallUrl: git+ssh URL is converted to git+https', () => {
  assert.equal(
    resolveInstallUrl('git+ssh://git@github.com/csrinaldi/brain.git'),
    'git+https://github.com/csrinaldi/brain.git',
  );
});

test('resolveInstallUrl: SCP-style git@ URL is converted to git+https', () => {
  assert.equal(
    resolveInstallUrl('git@github.com:csrinaldi/brain.git'),
    'git+https://github.com/csrinaldi/brain.git',
  );
});

test('resolveInstallUrl: github: shorthand is converted to git+https', () => {
  assert.equal(
    resolveInstallUrl('github:csrinaldi/brain'),
    'git+https://github.com/csrinaldi/brain.git',
  );
});

test('resolveInstallUrl: null/undefined falls back to BRAIN_REPO_HTTPS constant', () => {
  assert.equal(resolveInstallUrl(null), BRAIN_REPO_HTTPS);
  assert.equal(resolveInstallUrl(undefined), BRAIN_REPO_HTTPS);
  assert.equal(resolveInstallUrl(''), BRAIN_REPO_HTTPS);
});

// ── installSpec ───────────────────────────────────────────────────────────────

test('installSpec: derives git+https spec from installed brain package.json (git+https url)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-spec-'));
  try {
    mkdirSync(join(tmp, 'node_modules', 'brain'), { recursive: true });
    writeFileSync(
      join(tmp, 'node_modules', 'brain', 'package.json'),
      JSON.stringify({ name: 'brain', version: '0.4.0', repository: { type: 'git', url: 'git+https://github.com/csrinaldi/brain.git' } }),
    );
    assert.equal(installSpec(tmp, 'v0.4.0'), 'git+https://github.com/csrinaldi/brain.git#v0.4.0');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('installSpec: normalizes https repository.url and appends tag', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-spec-'));
  try {
    mkdirSync(join(tmp, 'node_modules', 'brain'), { recursive: true });
    writeFileSync(
      join(tmp, 'node_modules', 'brain', 'package.json'),
      JSON.stringify({ name: 'brain', version: '0.4.0', repository: { type: 'git', url: 'https://github.com/csrinaldi/brain.git' } }),
    );
    assert.equal(installSpec(tmp, 'v0.4.0'), 'git+https://github.com/csrinaldi/brain.git#v0.4.0');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('installSpec: falls back to constant when node_modules/brain/package.json is absent', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-spec-'));
  try {
    assert.equal(installSpec(tmp, 'v0.4.0'), `${BRAIN_REPO_HTTPS}#v0.4.0`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('installSpec: falls back to constant when repository.url field is absent', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-spec-'));
  try {
    mkdirSync(join(tmp, 'node_modules', 'brain'), { recursive: true });
    writeFileSync(
      join(tmp, 'node_modules', 'brain', 'package.json'),
      JSON.stringify({ name: 'brain', version: '0.4.0' }),
    );
    assert.equal(installSpec(tmp, 'v0.4.0'), `${BRAIN_REPO_HTTPS}#v0.4.0`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
