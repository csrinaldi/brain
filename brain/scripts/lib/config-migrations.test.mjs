// brain/scripts/lib/config-migrations.test.mjs — unit tests for the `1.6.0`
// entry (#906 A6): `memory.lane.enabled` defaults to false, additive-only,
// never overwriting an already-set value.
//
// This file did not exist before #906 — the migrations were previously
// exercised only indirectly, through installer.test.mjs, vcs/cli.test.mjs,
// and stage-engine.test.mjs (each importing `migrations` for their own
// purpose). This is the first test file that owns the migration LIST itself.
//
// Lives here, not beside brain/core/config-migrations.mjs: `npm test`'s
// globs (test-hygiene's #850 guard) only reach `brain/scripts/**/*.test.mjs`
// and `test/**/*.e2e.test.mjs` — a test under brain/core/ is never run. Same
// precedent as brain/scripts/lib/managed-paths.test.mjs, whose subject
// (brain/core/managed-paths.mjs) lives one directory over too.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrations } from '../../core/config-migrations.mjs';
import { migrateConfig } from './installer.mjs';

const ENTRY = migrations.find((m) => m.version === '1.6.0');

test('#906 A6: a 1.6.0 entry exists and declares memory.lane.enabled: false', () => {
  assert.ok(ENTRY, 'migrations must contain a 1.6.0 entry');
  assert.deepEqual(ENTRY.defaults, { memory: { lane: { enabled: false } } });
});

test('#906 A6: additive — a config with no memory key gets enabled:false after 1.6.0', () => {
  const { config } = migrateConfig({ schemaVersion: '0.1.0' }, migrations, '1.6.0');
  assert.equal(config.memory.lane.enabled, false);
});

test('#906 A6: additive-only — an already-true value is NEVER overwritten by the migration', () => {
  const { config } = migrateConfig(
    { schemaVersion: '0.1.0', memory: { lane: { enabled: true } } },
    migrations,
    '1.6.0',
  );
  assert.equal(config.memory.lane.enabled, true, 'a consumer-set true must survive the migration');
});

test('#906 A6: every migration version is unique (never reused, per config-migrations.mjs doctrine)', () => {
  const versions = migrations.map((m) => m.version);
  assert.equal(new Set(versions).size, versions.length, 'a duplicated version number names two indistinguishable states');
});
