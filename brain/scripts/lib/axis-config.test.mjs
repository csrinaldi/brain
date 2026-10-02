// axis-config.test.mjs — ADR-0038 shape reader/validator (#1114 S3.1) and the parity of every
// migrated reader: a legacy config and the equivalent new-shape config resolve identically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readAxis, validateAxisConfig, resolveAxis, AxisRefusal, PLATFORM_CAPABILITIES, AGENT_PLATFORMS, SDD_ENGINES } from './axis-config.mjs';
import { resolvePlatform } from '../harness/platform.mjs';
import { resolveEngine, resolveHarness } from '../harness/cli.mjs';
import { resolveProviderName } from '../vcs/cli.mjs';
import { resolveMemoryBackend } from '../memory/lib/backend-resolve.mjs';

const shape = (def, extra = {}) => ({ default: def, providers: { [def]: {} }, ...extra });

// ── readAxis ────────────────────────────────────────────────────────────────
const LEGACY = {
  memory: [{ memory: { backend: 'plainfiles' } }, 'plainfiles'],
  vcs: [{ vcs: { provider: 'github' } }, 'github'],
  platform: [{ platform: 'antigravity' }, 'antigravity'],
  sdd: [{ engine: 'plain' }, 'plain'],
};

for (const axis of ['vcs', 'memory', 'platform', 'sdd']) {
  test(`readAxis(${axis}): shape, legacy, none and both`, () => {
    const [legacyCfg, value] = LEGACY[axis];
    const shapeCfg = { [axis]: { default: value, providers: { [value]: { version: '1' } } } };
    assert.deepEqual(readAxis(shapeCfg, axis), { default: value, providers: { [value]: { version: '1' } }, source: 'shape' });
    assert.deepEqual(readAxis(legacyCfg, axis), { default: value, providers: { [value]: {} }, source: 'legacy' });
    assert.deepEqual(readAxis({}, axis), { default: '', providers: {}, source: 'none' });
    assert.deepEqual(readAxis(undefined, axis), { default: '', providers: {}, source: 'none' });
    const alsoLegacy = { memory: { backend: 'x' }, vcs: { provider: 'x' } }[axis] ?? {};
    const extra = axis === 'platform' ? { harness: 'plain' } : axis === 'sdd' ? { engine: 'gentle-ai' } : {};
    const both = readAxis({ ...extra, [axis]: { ...alsoLegacy, ...shapeCfg[axis] } }, axis);
    assert.equal(both.source, 'shape');
    assert.equal(both.default, value);
    assert.equal(both.legacyShadowed, true);
  });
}

test('readAxis: the legacy declared-but-empty key is undeclared, as every resolver already read it', () => {
  assert.deepEqual(readAxis({ memory: { backend: '' } }, 'memory'), { default: '', providers: {}, source: 'none' });
  assert.deepEqual(readAxis({ vcs: { provider: '' } }, 'vcs'), { default: '', providers: {}, source: 'none' });
});

test('readAxis: a shape that is undeclared ("") lets a later legacy value through (S3.2: `brain:config set memory.backend` after the migration)', () => {
  assert.deepEqual(
    readAxis({ memory: { default: '', providers: {}, backend: 'plainfiles', lane: { enabled: true } } }, 'memory'),
    { default: 'plainfiles', providers: { plainfiles: {} }, source: 'legacy' },
  );
  assert.deepEqual(
    readAxis({ vcs: { default: '', providers: { gitlab: { version: '1' } }, provider: 'github' } }, 'vcs'),
    { default: 'github', providers: { gitlab: { version: '1' }, github: {} }, source: 'legacy' },
  );
  // a declared shape default still wins over the legacy key
  assert.equal(readAxis({ vcs: { default: 'gitlab', providers: { gitlab: {} }, provider: 'github' } }, 'vcs').default, 'gitlab');
  // undeclared on both sides stays a shape result
  assert.deepEqual(readAxis({ vcs: { default: '', providers: {} } }, 'vcs'), { default: '', providers: {}, source: 'shape' });
});

test('readAxis: legacy `harness` feeds platform or sdd by membership, never both', () => {
  assert.equal(readAxis({ harness: 'antigravity' }, 'platform').default, 'antigravity');
  assert.equal(readAxis({ harness: 'antigravity' }, 'sdd').default, '');
  assert.equal(readAxis({ harness: 'gentle-ai' }, 'sdd').default, 'gentle-ai');
  assert.equal(readAxis({ harness: 'gentle-ai' }, 'platform').default, '');
  assert.equal(readAxis({ harness: 'plain' }, 'platform').default, 'plain');
  assert.equal(readAxis({ harness: 'plain' }, 'sdd').default, 'plain');
  assert.equal(readAxis({ harness: 'antigravity' }, 'platform', { harness: false }).source, 'none');
  assert.equal(readAxis({ platform: 'claude', harness: 'antigravity' }, 'platform').default, 'claude');
});

test('readAxis: an `sdd` object without default/providers (map, configs) is not the shape', () => {
  assert.deepEqual(readAxis({ sdd: { map: {}, configs: {} }, engine: 'plain' }, 'sdd'), { default: 'plain', providers: { plain: {} }, source: 'legacy' });
});

test('membership lists are the declared ones', () => {
  assert.deepEqual([...AGENT_PLATFORMS], ['claude', 'antigravity', 'plain']);
  assert.deepEqual([...SDD_ENGINES], ['gentle-ai', 'plain']);
  for (const p of AGENT_PLATFORMS) assert.ok(PLATFORM_CAPABILITIES[p], `capabilities declared for ${p}`);
});

// ── validateAxisConfig: ADR-0038's three examples ──────────────────────────
const VALID = {
  vcs: { default: 'github', providers: { github: { version: '2.63.0' } } },
  memory: { default: 'engram', providers: { engram: { version: '1.15.3' } }, lane: { enabled: true } },
  platform: { default: 'claude', providers: { claude: { version: '2.1.0' }, codex: { version: '0.50.0' } } },
  sdd: {
    default: 'gentle-ai',
    providers: { 'gentle-ai': { version: '1.20.0' }, brain: { version: 'self' } },
    roles: {
      'cold-review': { agent: 'brain:cold-review', engine: 'codex', model: 'gpt-5.5' },
      design: { model: 'claude-opus-5-5' },
    },
  },
};
const codes = (r) => r.errors.map((e) => e.code);

test('validateAxisConfig: ADR-0038 valid example passes', () => {
  assert.deepEqual(validateAxisConfig(VALID), { ok: true, errors: [] });
});

test('validateAxisConfig: refused example 1 — default not listed (and codex cannot orchestrate)', () => {
  const r = validateAxisConfig({ platform: { default: 'codex', providers: { claude: {} } } });
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes('default-not-in-providers'));
  assert.ok(codes(r).includes('default-cannot-orchestrate'));
  assert.equal(r.errors[0].axis, 'platform');
  assert.equal(r.errors[0].path, 'platform.default');
});

test('validateAxisConfig: listing codex does not save it as the orchestrator', () => {
  const r = validateAxisConfig({ platform: { default: 'codex', providers: { codex: {} } } });
  assert.deepEqual(codes(r), ['default-cannot-orchestrate']);
});

test('validateAxisConfig: refused example 2 — undeclared SDD provider and platform engine', () => {
  const r = validateAxisConfig({
    platform: { default: 'claude', providers: { claude: {} } },
    sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} }, roles: { 'cold-review': { agent: 'brain:cold-review', engine: 'gemini' } } },
  });
  assert.deepEqual(codes(r).sort(), ['role-agent-provider-unknown', 'role-engine-unknown']);
});

test('validateAxisConfig: default must be a key of providers, per axis; empty is allowed', () => {
  for (const axis of ['vcs', 'memory', 'sdd']) {
    assert.equal(validateAxisConfig({ [axis]: { default: 'x', providers: { y: {} } } }).ok, false, axis);
    assert.equal(validateAxisConfig({ [axis]: { default: 'x' } }).ok, false, `${axis} without providers`);
    assert.equal(validateAxisConfig({ [axis]: { default: '', providers: {} } }).ok, true, `${axis} undeclared`);
  }
});

test('validateAxisConfig: a shape object without a `default` key is refused (missing-default, #1114 S3.2)', () => {
  for (const axis of ['vcs', 'memory', 'platform', 'sdd']) {
    const r = validateAxisConfig({ [axis]: { providers: { github: {} } } });
    assert.equal(r.ok, false, axis);
    assert.deepEqual(codes(r), ['missing-default'], axis);
    assert.equal(r.errors[0].path, `${axis}.default`);
  }
  // an axis node that is not the shape at all (no providers, no default) is not this error
  assert.equal(validateAxisConfig({ sdd: { map: {} } }).ok, true);
  assert.equal(validateAxisConfig({ memory: { lane: { enabled: true } } }).ok, true);
});

test('validateAxisConfig: a role engine must be able to execute a stage prompt', () => {
  const cfg = (engine) => ({
    platform: { default: 'claude', providers: { claude: {}, plain: {}, antigravity: {}, codex: {} } },
    sdd: { default: 'plain', providers: { plain: {}, brain: {} }, roles: { s: { agent: 'brain:s', engine } } },
  });
  assert.deepEqual(codes(validateAxisConfig(cfg('plain'))), ['role-engine-cannot-execute']);
  assert.deepEqual(codes(validateAxisConfig(cfg('antigravity'))), ['role-engine-cannot-execute']);
  assert.equal(validateAxisConfig(cfg('claude')).ok, true);
  assert.equal(validateAxisConfig(cfg('codex')).ok, true);
});

test('validateAxisConfig: a role without agent/engine is not an error (cascade is S2/#1132)', () => {
  assert.equal(validateAxisConfig({ sdd: { default: 'plain', providers: { plain: {} }, roles: { design: { model: 'm' } } } }).ok, true);
});

test('validateAxisConfig: platform.default must orchestrate (plain does, antigravity does)', () => {
  for (const p of ['claude', 'antigravity', 'plain']) {
    assert.equal(validateAxisConfig({ platform: shape(p) }).ok, true, p);
  }
});

test('validateAxisConfig: never throws on hostile input', () => {
  for (const bad of [null, undefined, 42, 'x', [], { platform: 7 }, { platform: { providers: 3, default: 5 } }, { sdd: { roles: { a: null, b: 'x' }, providers: [] } }]) {
    const r = validateAxisConfig(bad);
    assert.equal(typeof r.ok, 'boolean');
    assert.ok(Array.isArray(r.errors));
  }
  assert.equal(validateAxisConfig({}).ok, true);
  assert.equal(validateAxisConfig({ platform: { providers: 3 } }).ok, false);
});

// ── parity: every resolver is a thin caller of resolveAxis (#1114 S2) ────────
// Legacy config vs new-shape config resolve identically; where S2 removed a code default the answer is a REFUSAL.
const refuses = (fn, code) => assert.throws(fn, (e) => e instanceof AxisRefusal && e.code === code, `expected a ${code} refusal`);

test('parity: resolveProviderName (env and runtime provider keep their precedence)', () => {
  assert.equal(resolveProviderName({ config: { vcs: { provider: 'github' } }, env: {} }), 'github');
  assert.equal(resolveProviderName({ config: { vcs: shape('github') }, env: {} }), 'github');
  const both = { vcs: { default: 'github', providers: { github: {}, gitlab: {} } } };
  assert.equal(resolveProviderName({ config: both, env: { VCS_PROVIDER: 'gitlab' } }), 'gitlab');
  assert.equal(resolveProviderName({ config: both, env: { VCS_PROVIDER: 'gitlab' }, provider: 'github' }), 'github');
  assert.equal(resolveProviderName({ config: {}, env: {}, provider: 'gitlab' }), 'gitlab', 'a runtime provider needs no vcs.providers entry');
  refuses(() => resolveProviderName({ config: { vcs: { provider: '' } }, env: {} }), 'undeclared');
  refuses(() => resolveProviderName({ config: { vcs: shape('') }, env: {} }), 'undeclared');
  refuses(() => resolveProviderName({ config: {}, env: {} }), 'undeclared');
});

test('parity: resolvePlatform (precedence is unchanged; the claude default is GONE)', () => {
  const quiet = { notice: () => {} };
  const cases = [
    [{ platform: 'antigravity' }, {}, 'antigravity'],
    [{ platform: shape('antigravity') }, {}, 'antigravity'],
    [{ platform: { default: 'antigravity', providers: { antigravity: {}, plain: {} } } }, { AGENT_PLATFORM: 'plain' }, 'plain'],
    [{ harness: 'plain' }, {}, 'plain'],
    [{ harness: 'plain' }, { SDD_HARNESS: 'antigravity' }, 'antigravity'],
    [{ platform: 'claude', harness: 'plain' }, {}, 'claude'],
  ];
  for (const [config, env, want] of cases) assert.equal(resolveAxis('platform', { env, config, ...quiet }).value, want, JSON.stringify([config, env]));
  for (const [config, env, want] of cases) assert.equal(resolvePlatform({ env, envVars: {}, config }), want, JSON.stringify([config, env]));
  assert.equal(resolvePlatform({ env: {}, envVars: { AGENT_PLATFORM: 'plain' }, config: { platform: { default: 'antigravity', providers: { antigravity: {}, plain: {} } } } }), 'plain');
  // the old code default: nothing declared, or only an engine-only harness, is now a refusal
  refuses(() => resolvePlatform({ env: {}, envVars: {}, config: { harness: 'gentle-ai' } }), 'undeclared');
  refuses(() => resolvePlatform({ env: {}, envVars: {}, config: {} }), 'undeclared');
});

test('parity: resolveEngine and resolveHarness (the gentle-ai default is GONE)', () => {
  const cases = [
    [{ engine: 'plain' }, {}, 'plain'],
    [{ sdd: shape('plain') }, {}, 'plain'],
    [{ sdd: { default: 'plain', providers: { plain: {}, 'gentle-ai': {} } } }, { SDD_ENGINE: 'gentle-ai' }, 'gentle-ai'],
    [{ harness: 'plain' }, {}, 'plain'],
    [{ harness: 'plain' }, { SDD_HARNESS: 'gentle-ai' }, 'gentle-ai'],
    [{ engine: 'gentle-ai', harness: 'plain' }, {}, 'gentle-ai'],
  ];
  for (const [config, env, want] of cases) assert.equal(resolveEngine({ env, envVars: {}, config }), want, JSON.stringify([config, env]));
  assert.equal(resolveHarness({ env: {}, envVars: {}, config: { sdd: shape('plain') } }), 'plain');
  assert.equal(resolveHarness({ env: {}, envVars: {}, config: { harness: 'plain' } }), 'plain');
  for (const config of [{ harness: 'antigravity' }, { sdd: { map: {} } }, {}]) {
    refuses(() => resolveEngine({ env: {}, envVars: {}, config }), 'undeclared');
    refuses(() => resolveHarness({ env: {}, envVars: {}, config }), 'undeclared');
  }
});

test('parity: resolveMemoryBackend (config level only; env keeps its precedence; undeclared stays a refusal)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'axis-config-'));
  try {
    const run = (config, env = {}) => {
      const configFile = join(dir, 'brain.config.json');
      writeFileSync(configFile, JSON.stringify(config));
      return resolveMemoryBackend({ root: dir, env, envFile: join(dir, 'absent.env'), configFile });
    };
    for (const cfg of [{ memory: { backend: 'plainfiles' } }, { memory: shape('plainfiles') }]) {
      const r = run(cfg);
      assert.equal(r.status, 'declared');
      assert.equal(r.backend, 'plainfiles');
      assert.equal(r.source, 'config');
    }
    assert.equal(run({ memory: { default: 'plainfiles', providers: { plainfiles: {}, engram: {} } } }, { MEMORY_BACKEND: 'engram' }).backend, 'engram');
    assert.equal(run({ memory: shape('plainfiles') }, { MEMORY_BACKEND: 'engram' }).status, 'invalid', 'an unlisted per-machine value is refused, not coerced');
    assert.equal(run({ memory: { backend: '' } }).status, 'undeclared');
    assert.equal(run({ memory: shape('') }).status, 'undeclared');
    assert.equal(run({}).status, 'undeclared');
    assert.equal(run({ memory: shape('mongo') }).status, 'invalid');
    assert.equal(run({ memory: { backend: 'mongo' } }).status, 'invalid');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
