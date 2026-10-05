// axis-shape-old-upgrader.test.mjs — #1344: the ADR-0038 migration must be correct under ANY upgrader.
//
// `brain:upgrade -- vX` runs the upgrader ALREADY INSTALLED (the old one: `npm i` replaces the package
// after it is loaded). It imports the INCOMING config-migrations.mjs but calls its OWN `migrateConfig`,
// which for a 1.11.0 consumer hands the migration `{ mergeDefaults }` and nothing else. Until 1.12.1,
// migration 1.11.1 returned the config unchanged without a context, and the old upgrader still stamped
// schemaVersion 1.12.0: an unmigrated config reading as migrated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { migrations } from '../../core/config-migrations.mjs';
import { migrateConfig, mergeDefaults, compareSemver } from './installer.mjs';
import { validateAxisConfig } from './axis-config.mjs';

const AXES = ['vcs', 'memory', 'platform', 'sdd'];
const E1 = migrations.find((m) => m.version === '1.11.1');
const E2 = migrations.find((m) => m.version === '1.12.1');
const shaped = (c) => AXES.every((a) => c[a] && typeof c[a] === 'object' && 'default' in c[a] && 'providers' in c[a]);

// The v1.11.0 `migrateConfig` loop, copied verbatim from `git show v1.11.0:brain/scripts/lib/installer.mjs`
// (lines 1543-1565): NO axisContext, NO notice sink. This is what a 1.11.0 consumer's upgrader runs.
function oldUpgraderMigrateConfig(config, migrationList, targetVersion) {
  const from = config.schemaVersion ?? '0.0.0';
  let result = { ...config };
  const applied = [];
  const ordered = [...migrationList].sort((a, b) => compareSemver(a.version, b.version));
  for (const m of ordered) {
    const isAfterCurrent = compareSemver(m.version, from) > 0;
    const isWithinTarget = compareSemver(m.version, targetVersion) <= 0;
    if (!isAfterCurrent || !isWithinTarget) continue;
    if (typeof m.migrate === 'function') {
      result = m.migrate(result, { mergeDefaults });
    } else if (m.defaults) {
      result = mergeDefaults(result, m.defaults);
    }
    applied.push(m.version);
  }
  result.schemaVersion = compareSemver(targetVersion, result.schemaVersion ?? '0.0.0') > 0
    ? targetVersion
    : (result.schemaVersion ?? targetVersion);
  return { config: result, applied };
}

/** A consumer root with a `.env`, as the old upgrader sees it: process.cwd() IS the consumer root. */
function inConsumer(dotenv, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1344-'));
  const prev = process.cwd();
  const saved = { AGENT_PLATFORM: process.env.AGENT_PLATFORM, SDD_ENGINE: process.env.SDD_ENGINE, SDD_HARNESS: process.env.SDD_HARNESS, MEMORY_BACKEND: process.env.MEMORY_BACKEND };
  for (const k of Object.keys(saved)) delete process.env[k];
  try {
    if (dotenv !== null) writeFileSync(join(dir, '.env'), dotenv);
    process.chdir(dir);
    return fn(dir);
  } finally {
    process.chdir(prev);
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }
}

const CONSUMER_1_11_0 = { schemaVersion: '1.11.0', vcs: { provider: 'github' }, memory: { backend: 'plainfiles' } };

test('REGRESSION #1344: the v1.11.0 upgrader loop + the new migrations leaves every axis shaped', () => {
  inConsumer('AGENT_PLATFORM=claude\nSDD_ENGINE=gentle-ai\n', () => {
    const { config, applied } = oldUpgraderMigrateConfig(CONSUMER_1_11_0, migrations, '1.12.1');
    assert.ok(applied.includes('1.11.1'));
    assert.equal(shaped(config), true, JSON.stringify(config));
    assert.equal(config.platform.default, 'claude');
    assert.equal(config.sdd.default, 'gentle-ai');
    assert.equal(config.memory.default, 'plainfiles');
    assert.equal(config.vcs.default, 'github');
    assert.equal(validateAxisConfig(config).ok, true);
  });
});

test('1.11.1 with NO axisContext shapes all four axes from .env, the config and the legacy keys', () => {
  inConsumer('AGENT_PLATFORM=antigravity\n', (root) => {
    const out = E1.migrate(structuredClone({ vcs: { provider: 'gitlab' }, memory: { backend: 'engram' }, engine: 'plain' }), { mergeDefaults, notice: () => {}, root });
    assert.equal(shaped(out), true);
    assert.equal(out.platform.default, 'antigravity');
    assert.equal(out.sdd.default, 'plain');
    assert.equal(out.memory.default, 'engram');
    assert.equal(out.vcs.default, 'gitlab');
  });
});

test('1.11.1 with NO axisContext and NO sink prints each value it wrote with its source (the old upgrader has no showNotices)', () => {
  inConsumer('AGENT_PLATFORM=antigravity\n', () => {
    const lines = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try { E1.migrate(structuredClone(CONSUMER_1_11_0), { mergeDefaults }); } finally { console.log = orig; }
    const text = lines.join('\n');
    assert.match(text, /platform\.default = antigravity \(from \.env AGENT_PLATFORM\)/, text);
    assert.match(text, /sdd\.default = gentle-ai/, text);
    assert.match(text, /value and where it came from/, text);
  });
});

test('with a sink, nothing is printed to stdout (the new upgrader shows the lines itself)', () => {
  inConsumer(null, () => {
    const lines = [];
    const sink = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try { E1.migrate(structuredClone(CONSUMER_1_11_0), { mergeDefaults, notice: (l) => sink.push(l) }); } finally { console.log = orig; }
    assert.deepEqual(lines, []);
    assert.ok(sink.length > 0);
  });
});

test('the injectable builder wins over env and .env (the migration stays testable and pure)', () => {
  inConsumer('AGENT_PLATFORM=antigravity\n', () => {
    const out = E1.migrate(structuredClone(CONSUMER_1_11_0), {
      mergeDefaults, notice: () => {},
      buildAxisContext: () => ({ platform: { value: 'plain', source: 'a test' }, sdd: { value: 'plain', source: 'a test' }, lifecycleStages: [] }),
    });
    assert.equal(out.platform.default, 'plain');
  });
});

test('OPT-OUT: axisContext null is env-blind and writes nothing (buildDefaultConfig-style callers stay unchanged)', () => {
  inConsumer('AGENT_PLATFORM=antigravity\nSDD_ENGINE=plain\n', () => {
    const cfg = { vcs: { provider: 'github' }, memory: { backend: 'engram' }, platform: 'plain' };
    assert.deepEqual(E1.migrate(structuredClone(cfg), { mergeDefaults, axisContext: null }), cfg);
    assert.deepEqual(E2.migrate(structuredClone(cfg), { mergeDefaults, axisContext: null }), cfg);
  });
});

test('OPT-OUT: planConfigWrite-style and promote-style callers pass null; migrateConfig forwards null untouched', () => {
  inConsumer('AGENT_PLATFORM=antigravity\n', () => {
    const { config } = migrateConfig({ schemaVersion: '1.11.0' }, migrations, '1.12.1', null);
    assert.equal(config.platform, undefined, 'null is the explicit env-blind opt-out');
  });
});

test('1.12.1 repairs a config stamped 1.12.0 whose axes were never shaped', () => {
  inConsumer('AGENT_PLATFORM=claude\nSDD_ENGINE=gentle-ai\n', () => {
    const stamped = { ...CONSUMER_1_11_0, schemaVersion: '1.12.0' };
    const lines = [];
    const { config, applied } = migrateConfig(stamped, migrations, '1.12.1', undefined);
    void lines;
    assert.deepEqual(applied, ['1.12.1']);
    assert.equal(shaped(config), true);
    assert.equal(config.schemaVersion, '1.12.1');
  });
});

test('1.12.1 is a no-op on a correctly shaped config (nothing re-added, nothing printed)', () => {
  inConsumer('AGENT_PLATFORM=antigravity\n', () => {
    const migrated = E1.migrate(structuredClone(CONSUMER_1_11_0), { mergeDefaults, notice: () => {}, buildAxisContext: () => ({ platform: { value: 'claude', source: 's' }, sdd: { value: 'gentle-ai', source: 's' }, lifecycleStages: [] }) });
    // an owner deliberately removed a key a re-run of the whole shaping would re-add
    delete migrated.sdd.providers.brain;
    const notices = [];
    const out = E2.migrate(structuredClone(migrated), { mergeDefaults, notice: (l) => notices.push(l) });
    assert.deepEqual(out, migrated);
    assert.deepEqual(notices, []);
  });
});

test('1.12.1 repairs only the axes that lack the shape and leaves a shaped axis alone', () => {
  inConsumer(null, () => {
    const half = { memory: { default: 'engram', providers: { engram: {} }, locked: true }, vcs: { provider: 'github' } };
    const out = E2.migrate(structuredClone(half), { mergeDefaults, notice: () => {} });
    assert.equal(shaped(out), true);
    assert.deepEqual(out.memory, half.memory);
  });
});
