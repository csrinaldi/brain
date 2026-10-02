// axis-migration-context.test.mjs — #1114 S3.2: the value a consumer EFFECTIVELY runs today for
// the two axes that had a code default (platform, sdd), and where it came from. The migration
// writes that value into tracked config, so it must be exactly what the resolvers answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveAxisMigrationContext } from './axis-migration-context.mjs';
import { resolvePlatform } from '../harness/platform.mjs';
import { resolveEngine } from '../harness/cli.mjs';
import { parseEnvFile } from './env-read.mjs';
import { LIFECYCLE_STAGES } from './sdd-layout.mjs';

function withRoot(dotenv, fn) {
  const root = mkdtempSync(join(tmpdir(), 'axis-ctx-'));
  try {
    if (dotenv !== null) writeFileSync(join(root, '.env'), dotenv);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const TABLE = [
  ['nothing at all', {}, null, {}],
  ['process env AGENT_PLATFORM', { AGENT_PLATFORM: 'antigravity' }, null, {}],
  ['.env AGENT_PLATFORM', {}, 'AGENT_PLATFORM=plain\n', {}],
  ['shell beats .env', { AGENT_PLATFORM: 'antigravity' }, 'AGENT_PLATFORM=plain\n', {}],
  ['flat platform', {}, null, { platform: 'antigravity' }],
  ['env beats flat platform', { AGENT_PLATFORM: 'plain' }, null, { platform: 'antigravity' }],
  ['legacy harness that is a platform', {}, null, { harness: 'antigravity' }],
  ['legacy harness that is an engine only', {}, null, { harness: 'gentle-ai' }],
  ['SDD_HARNESS in .env', {}, 'SDD_HARNESS=plain\n', {}],
  ['SDD_HARNESS in process env', { SDD_HARNESS: 'antigravity' }, null, {}],
  ['SDD_ENGINE in .env', {}, 'SDD_ENGINE=plain\n', {}],
  ['SDD_ENGINE in process env, flat engine in config', { SDD_ENGINE: 'plain' }, null, { engine: 'gentle-ai' }],
  ['flat engine', {}, null, { engine: 'plain' }],
  ['already the new shape', {}, null, { platform: { default: 'plain', providers: { plain: {} } }, sdd: { default: 'plain', providers: { plain: {} } } }],
  ['empty process env value', { AGENT_PLATFORM: '', SDD_ENGINE: '' }, null, { platform: 'plain', engine: 'plain' }],
];

for (const [name, env, dotenv, config] of TABLE) {
  test(`parity with resolvePlatform / resolveEngine: ${name}`, () => {
    withRoot(dotenv, (root) => {
      const envVars = dotenv === null ? {} : parseEnvFile(dotenv);
      const ctx = resolveAxisMigrationContext({ config, env, root });
      assert.equal(ctx.platform.value, resolvePlatform({ env, envVars, config }), 'platform');
      assert.equal(ctx.sdd.value, resolveEngine({ env, envVars, config }), 'sdd');
      assert.ok(ctx.platform.source && ctx.sdd.source, 'every value names its source');
    });
  });
}

test('sources name where the value came from, and never carry the value of an unrelated key', () => {
  withRoot('AGENT_PLATFORM=plain\nSDD_ENGINE=plain\nSECRET_TOKEN=hunter2\n', (root) => {
    const ctx = resolveAxisMigrationContext({ config: {}, env: {}, root });
    assert.equal(ctx.platform.source, '.env AGENT_PLATFORM');
    assert.equal(ctx.sdd.source, '.env SDD_ENGINE');
    assert.ok(!JSON.stringify(ctx).includes('hunter2'));
  });
  withRoot(null, (root) => {
    assert.equal(resolveAxisMigrationContext({ config: {}, env: { AGENT_PLATFORM: 'claude' }, root }).platform.source, 'process env AGENT_PLATFORM');
    assert.equal(resolveAxisMigrationContext({ config: { platform: 'plain' }, env: {}, root }).platform.source, 'brain.config.json platform');
    assert.equal(resolveAxisMigrationContext({ config: { harness: 'plain' }, env: {}, root }).platform.source, 'brain.config.json harness');
    assert.equal(resolveAxisMigrationContext({ config: { engine: 'plain' }, env: {}, root }).sdd.source, 'brain.config.json engine');
    assert.equal(resolveAxisMigrationContext({ config: {}, env: {}, root }).platform.source, "today's default");
    assert.equal(resolveAxisMigrationContext({ config: {}, env: {}, root }).sdd.source, "today's default");
  });
});

test('the context carries the lifecycle stages the migration must not route as runtimes', () => {
  withRoot(null, (root) => {
    assert.deepEqual(resolveAxisMigrationContext({ config: {}, env: {}, root }).lifecycleStages, [...LIFECYCLE_STAGES]);
  });
});

test('it never writes: the .env on disk is byte-identical afterwards', () => {
  const text = 'AGENT_PLATFORM=plain\n# a comment\nOTHER=1\n';
  withRoot(text, (root) => {
    resolveAxisMigrationContext({ config: {}, env: {}, root });
    assert.equal(readFileSync(join(root, '.env'), 'utf8'), text);
  });
});
