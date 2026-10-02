// axis-shape-migration.test.mjs — #1114 S3.2: the 1.11.1 config migration to the ADR-0038 shape.
//
// Every consumer keeps running what it runs today (ADR-0038 section 7): the migration writes the
// value each axis EFFECTIVELY resolves to, never a new choice, and reports where each value came
// from. Pure tests over the migration entry; the only I/O is a temp dir for the parity rows.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrations, NEW_CONSUMER_DEFAULTS } from '../../core/config-migrations.mjs';
import { migrateConfig, mergeDefaults } from './installer.mjs';
import { validateAxisConfig, readAxis } from './axis-config.mjs';
import { resolveAxisMigrationContext } from './axis-migration-context.mjs';
import { LIFECYCLE_STAGES } from './sdd-layout.mjs';
import { resolvePlatform } from '../harness/platform.mjs';
import { resolveEngine } from '../harness/cli.mjs';
import { resolveProviderName } from '../vcs/cli.mjs';
import { resolveMemoryBackend } from '../memory/lib/backend-resolve.mjs';
import { parseEnvFile } from './env-read.mjs';

const VERSION = '1.11.1';
const ENTRY = migrations.find((m) => m.version === VERSION);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ctx = (platform = 'claude', sdd = 'gentle-ai', src = "today's default") => ({
  platform: { value: platform, source: src },
  sdd: { value: sdd, source: src },
  lifecycleStages: [...LIFECYCLE_STAGES],
});
/** Runs the entry alone, collecting its notices. */
function run(config, axisContext = ctx()) {
  const notices = [];
  const out = ENTRY.migrate(structuredClone(config), { mergeDefaults, axisContext, notice: (l) => notices.push(l) });
  return { out, notices };
}

test('a 1.11.1 entry exists, is a migrate function, and sits above the shipped 1.11.0', () => {
  assert.ok(ENTRY, 'migrations must contain a 1.11.1 entry');
  assert.equal(typeof ENTRY.migrate, 'function');
  assert.match(ENTRY.description, /1114|ADR-0038/);
});

test('without a context the entry is a no-op (buildDefaultConfig and unaware callers are untouched)', () => {
  const cfg = { vcs: { provider: 'github' }, memory: { backend: 'engram' }, platform: 'plain' };
  assert.deepEqual(ENTRY.migrate(structuredClone(cfg), { mergeDefaults }), cfg);
});

// ── per-axis rules ──────────────────────────────────────────────────────────
test('memory: backend becomes default + providers.<v>; lane and the legacy key stay', () => {
  const { out } = run({ memory: { backend: 'engram', lane: { enabled: true } } });
  assert.equal(out.memory.default, 'engram');
  assert.deepEqual(out.memory.providers, { engram: {} });
  assert.deepEqual(out.memory.lane, { enabled: true });
  assert.equal(out.memory.backend, 'engram');
});

test('memory: undeclared stays default "" with providers {} (an empty key and an absent key alike)', () => {
  for (const memory of [{ backend: '' }, undefined, {}]) {
    const { out } = run(memory === undefined ? {} : { memory });
    assert.equal(out.memory.default, '');
    assert.deepEqual(out.memory.providers, {});
  }
});

test('vcs: provider becomes default + providers.<v>; every other vcs key stays', () => {
  const { out } = run({ vcs: { provider: 'gitlab', slug: 'a/b', gitHost: 'gitlab.example.com' } });
  assert.equal(out.vcs.default, 'gitlab');
  assert.deepEqual(out.vcs.providers, { gitlab: {} });
  assert.equal(out.vcs.slug, 'a/b');
  assert.equal(out.vcs.gitHost, 'gitlab.example.com');
  assert.equal(out.vcs.provider, 'gitlab');
});

test('vcs: undeclared stays default ""', () => {
  const { out } = run({ vcs: { provider: '' } });
  assert.equal(out.vcs.default, '');
  assert.deepEqual(out.vcs.providers, {});
});

test('platform and sdd take the value the context says they effectively run', () => {
  const { out } = run({ platform: 'antigravity', engine: 'plain' }, ctx('antigravity', 'plain', 'brain.config.json platform'));
  assert.equal(out.platform.default, 'antigravity');
  assert.deepEqual(Object.keys(out.platform.providers), ['antigravity']);
  assert.equal(out.sdd.default, 'plain');
  assert.ok(out.sdd.providers.plain);
  assert.equal(out.engine, 'plain', 'the flat engine key stays for the alias window');
});

test('platform: the flat `platform` string cannot coexist with the axis object of the same name', () => {
  const { out } = run({ platform: 'plain' }, ctx('plain', 'gentle-ai'));
  assert.equal(typeof out.platform, 'object');
  assert.equal(out.platform.default, 'plain');
});

test('legacy harness is kept (agent-runtime platformConfig and resolveHarness still read it)', () => {
  const { out } = run({ harness: 'antigravity' }, ctx('antigravity', 'gentle-ai', 'brain.config.json harness'));
  assert.equal(out.harness, 'antigravity');
});

test('the brain SDD provider is declared on every consumer, as "self", and nothing else carries a version', () => {
  const { out } = run({ vcs: { provider: 'github' }, memory: { backend: 'engram' } });
  assert.deepEqual(out.sdd.providers.brain, { version: 'self' });
  const versions = [];
  for (const axis of ['vcs', 'memory', 'platform', 'sdd']) {
    for (const [name, p] of Object.entries(out[axis].providers)) if ('version' in p) versions.push(`${axis}.${name}`);
  }
  assert.deepEqual(versions, ['sdd.brain']);
});

test('an existing sdd.providers.brain is never overwritten', () => {
  const { out } = run({ sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {}, brain: { version: '9.9.9' } } } });
  assert.deepEqual(out.sdd.providers.brain, { version: '9.9.9' });
});

// ── routed engines (ADR-0038 section 7, ruling 2) ───────────────────────────
test('a custom stage routed to a runtime adds that runtime to platform.providers; cold-review gets its role', () => {
  const map = { 'cold-review': { engine: 'codex', model: 'gpt-5.5' } };
  const { out } = run({ sdd: { map } });
  assert.deepEqual(out.platform.providers.codex, {});
  assert.deepEqual(out.sdd.roles['cold-review'], { agent: 'brain:cold-review', engine: 'codex', model: 'gpt-5.5' });
  assert.deepEqual(out.sdd.map, map, 'sdd.map is not reshaped (#1132)');
});

test('a lifecycle stage routed to a framework never reaches platform.providers', () => {
  const { out } = run({ sdd: { map: { design: { engine: 'gentle-ai' }, spec: { engine: 'plain' } } } });
  assert.deepEqual(Object.keys(out.platform.providers), ['claude']);
  assert.equal(out.sdd.roles, undefined);
});

test('a custom stage other than cold-review adds its runtime but invents no role', () => {
  const { out } = run({ sdd: { map: { lint: { engine: 'gemini' } } } });
  assert.deepEqual(out.platform.providers.gemini, {});
  assert.equal(out.sdd.roles, undefined);
});

test('an existing cold-review role is kept, not rewritten', () => {
  const roles = { 'cold-review': { agent: 'brain:cold-review', engine: 'claude', model: 'm' } };
  const { out } = run({ sdd: { map: { 'cold-review': { engine: 'codex' } }, roles } });
  assert.deepEqual(out.sdd.roles, roles);
});

test('sdd.configs and sdd.map are left exactly where they were', () => {
  const sdd = { map: { 'cold-review': { engine: 'codex', model: 'gpt-5.5' } }, configs: { design: { agent: 'gentle-ai', enabled: false } }, stages: {}, engines: {} };
  const { out } = run({ sdd });
  for (const k of Object.keys(sdd)) assert.deepEqual(out.sdd[k], sdd[k], k);
});

// ── idempotency, no-op on the new shape, notices ────────────────────────────
test('idempotent: a second run changes nothing and says nothing', () => {
  const cfg = { vcs: { provider: 'github' }, memory: { backend: 'engram', lane: { enabled: true } }, platform: 'plain', sdd: { map: { 'cold-review': { engine: 'codex', model: 'm' } } } };
  const first = run(cfg, ctx('plain', 'gentle-ai', 'brain.config.json platform'));
  const second = run(first.out, ctx('plain', 'gentle-ai', 'brain.config.json platform'));
  assert.deepEqual(second.out, first.out);
  assert.deepEqual(second.notices, []);
});

test('a config already in the new shape is a no-op, even when the context disagrees', () => {
  const cfg = {
    vcs: { default: 'github', providers: { github: { version: '2.63.0' } } },
    memory: { default: 'plainfiles', providers: { plainfiles: {} } },
    platform: { default: 'antigravity', providers: { antigravity: {} } },
    sdd: { default: 'plain', providers: { plain: {}, brain: { version: 'self' } } },
  };
  const { out, notices } = run(cfg, ctx('claude', 'gentle-ai', '.env AGENT_PLATFORM'));
  assert.deepEqual(out, cfg);
  assert.deepEqual(notices, []);
});

test('notices print every value written and its source; a per-machine source says so', () => {
  const { notices } = run(
    { vcs: { provider: 'github' }, memory: { backend: '' }, sdd: { map: { 'cold-review': { engine: 'codex', model: 'gpt-5.5' } } } },
    { ...ctx('antigravity', 'gentle-ai', '.env AGENT_PLATFORM'), sdd: { value: 'gentle-ai', source: "today's default" } },
  );
  const all = notices.join('\n');
  assert.match(all, /platform\.default = antigravity \(from \.env AGENT_PLATFORM\)/);
  assert.match(all, /per-machine/);
  assert.match(all, /sdd\.default = gentle-ai \(from today's default\)/);
  assert.match(all, /vcs\.default = github \(from brain\.config\.json vcs\.provider\)/);
  assert.match(all, /memory\.default = "" /);
  assert.match(all, /sdd\.providers\.brain/);
  assert.match(all, /platform\.providers\.codex/);
  assert.match(all, /sdd\.roles\["cold-review"\]/);
  assert.ok(!/per-machine/.test(notices.find((n) => n.startsWith('sdd.default'))), 'a code default is not a per-machine value');
});

test('migrateConfig hands the entry its context and returns the notices; the other callers keep working', () => {
  const res = migrateConfig({ schemaVersion: '1.9.1', vcs: { provider: 'github' } }, migrations, VERSION, ctx());
  assert.ok(res.applied.includes(VERSION));
  assert.equal(res.config.schemaVersion, VERSION);
  assert.equal(res.config.vcs.default, 'github');
  assert.ok(res.notices.length > 0);
  const bare = migrateConfig({ schemaVersion: '1.9.1', vcs: { provider: 'github' } }, migrations, VERSION);
  assert.deepEqual(bare.notices, []);
  assert.equal(bare.config.vcs.default, undefined, 'no context, no migration: a caller that cannot read .env must not guess');
});

// ── validation after migrating, on fixtures ─────────────────────────────────
const FIXTURES = {
  'this repository (brain.config.json as committed)': () => JSON.parse(readFileSync(join(REPO_ROOT, 'brain.config.json'), 'utf8')),
  'a fresh consumer (new-consumer defaults + every shipped migration, provider filled)': () => {
    const c = migrateConfig(mergeDefaults({}, NEW_CONSUMER_DEFAULTS), migrations, '1.11.0').config;
    c.vcs.provider = 'github';
    return c;
  },
  'a gitlab consumer': () => ({ vcs: { provider: 'gitlab', slug: 'g/p' }, memory: { backend: 'plainfiles' } }),
  'AGENT_PLATFORM=plain': () => ({ vcs: { provider: 'github' }, memory: { backend: '' } }),
  'antigravity': () => ({ vcs: { provider: 'github' }, platform: 'antigravity', memory: { backend: 'engram' } }),
};
const FIXTURE_ENV = { 'AGENT_PLATFORM=plain': { AGENT_PLATFORM: 'plain' } };

for (const [name, make] of Object.entries(FIXTURES)) {
  test(`after migrating, validateAxisConfig passes: ${name}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'axis-shape-'));
    try {
      const before = make();
      const c = resolveAxisMigrationContext({ config: before, env: FIXTURE_ENV[name] ?? {}, root });
      const { out } = run(before, c);
      const v = validateAxisConfig(out);
      assert.deepEqual(v.errors, []);
      assert.equal(v.ok, true);
      for (const axis of ['vcs', 'memory', 'platform', 'sdd']) assert.equal(readAxis(out, axis).source, 'shape', axis);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('this repository: cold-review keeps routing to codex through sdd.roles and platform.providers', () => {
  const before = FIXTURES['this repository (brain.config.json as committed)']();
  const { out } = run(before, ctx());
  assert.equal(out.sdd.roles['cold-review'].engine, before.sdd.map['cold-review'].engine);
  assert.ok(out.platform.providers[before.sdd.map['cold-review'].engine]);
});

// ── parity: the resolvers answer the same before and after ─────────────────
const PARITY = [
  ['legacy everything', { vcs: { provider: 'github' }, memory: { backend: 'engram' }, platform: 'antigravity', engine: 'plain' }, {}, null],
  ['nothing stated', { vcs: { provider: 'gitlab' }, memory: { backend: '' } }, {}, null],
  ['.env states the platform', { vcs: { provider: 'github' } }, {}, 'AGENT_PLATFORM=plain\nSDD_ENGINE=plain\n'],
  ['process env states the platform', { vcs: { provider: 'github' } }, { AGENT_PLATFORM: 'antigravity' }, null],
  ['legacy SDD_HARNESS names a platform', { vcs: { provider: 'github' } }, {}, 'SDD_HARNESS=plain\n'],
  ['config harness', { vcs: { provider: 'github' }, harness: 'antigravity' }, {}, null],
  ['env overrides config afterwards', { vcs: { provider: 'github' }, memory: { backend: 'plainfiles' }, platform: 'plain' }, { MEMORY_BACKEND: 'engram', VCS_PROVIDER: 'gitlab' }, null],
];

for (const [name, before, env, dotenv] of PARITY) {
  test(`parity before/after the migration: ${name}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'axis-parity-'));
    try {
      if (dotenv !== null) writeFileSync(join(root, '.env'), dotenv);
      const envVars = dotenv === null ? {} : parseEnvFile(dotenv);
      const c = resolveAxisMigrationContext({ config: before, env, root });
      const after = run(before, c).out;

      assert.equal(resolvePlatform({ env, envVars, config: after }), resolvePlatform({ env, envVars, config: before }), 'platform');
      assert.equal(resolveEngine({ env, envVars, config: after }), resolveEngine({ env, envVars, config: before }), 'engine');

      const vcs = (config) => { try { return resolveProviderName({ config, env }); } catch (e) { return `refused:${e.message}`; } };
      assert.equal(vcs(after), vcs(before), 'vcs');

      const memory = (config) => {
        const configFile = join(root, 'brain.config.json');
        writeFileSync(configFile, JSON.stringify(config));
        const r = resolveMemoryBackend({ root, env, configFile });
        return [r.status, r.backend, r.source];
      };
      assert.deepEqual(memory(after), memory(before), 'memory');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
