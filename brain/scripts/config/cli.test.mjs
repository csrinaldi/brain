// cli.test.mjs — issue #823: the thin I/O half, against real files and a real
// child process. The planner's rules are covered next door; these tests own
// exit codes, the atomic write, and what the operator is TOLD.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { removeTempTree } from '../__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

function world(t, config = { docs: { language: 'en' }, schemaVersion: '0.2.0' }) {
  const root = mkdtempSync(join(tmpdir(), 'brain-823-'));
  t.after(() => removeTempTree(root));
  writeFileSync(join(root, 'brain.config.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
  return root;
}

const run = (root, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' });

test('#823 cli: get prints the resolved value and exits 0', (t) => {
  const r = run(world(t), 'get', 'docs.language');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '"en"');
});

test('#823 cli: get on a missing path says undefined and exits 1 — absence is a reportable answer, not a crash', (t) => {
  const r = run(world(t), 'get', 'docs.nothing');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs\.nothing/);
});

test('#823 cli: set writes the value AND the pending migrations, atomically, and says which', (t) => {
  const root = world(t, { docs: { language: 'en' }, schemaVersion: '0.2.0' });
  const r = run(root, 'set', 'docs.language', 'es');
  assert.equal(r.status, 0, r.stderr);
  const next = JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  assert.equal(next.docs.language, 'es');
  assert.ok(next.schemaVersion !== '0.2.0', 'pending migrations ran in the verb — the file says so');
  assert.match(r.stdout, /migration/i, 'the operator is told migrations were applied');
});

test('#823 cli: an unknown path refuses, writes NOTHING, exits 1', (t) => {
  const root = world(t);
  const before = readFileSync(join(root, 'brain.config.json'), 'utf8');
  const r = run(root, 'set', 'docs.lang', 'es');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs\.lang/);
  assert.equal(readFileSync(join(root, 'brain.config.json'), 'utf8'), before, 'byte-identical — a refusal writes nothing');
});

test('#823 cli: no brain.config.json is a named refusal, not a stack trace', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-823-empty-'));
  t.after(() => removeTempTree(root));
  const r = run(root, 'get', 'docs.language');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /brain\.config\.json/);
  assert.ok(!/at .*\(/.test(r.stderr), 'no stack trace — this is an operator message');
});

test('#823 cli: usage on a missing op or path', (t) => {
  const r = run(world(t), 'set');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage/);
});

// #906 A6 (measured): the 1.6.0 migration entry is DORMANT until package.json
// is cut to >=1.6.0 — but `deriveKnownPaths` (config-verb.mjs) walks every
// migration's `defaults` with no version filter, so the leaf is settable
// TODAY, version-independent of the installed package.json.
test('#906 A6: memory.lane.enabled is a known settable leaf today, get/set round-trips', (t) => {
  const root = world(t, { docs: { language: 'en' }, schemaVersion: '0.2.0' });
  const setResult = run(root, 'set', 'memory.lane.enabled', 'true');
  assert.equal(setResult.status, 0, setResult.stderr);

  const getResult = run(root, 'get', 'memory.lane.enabled');
  assert.equal(getResult.status, 0, getResult.stderr);
  assert.equal(getResult.stdout.trim(), 'true');
});

// ── #1114 S3.3: `default <axis>` — the one reader shell scripts call instead of parsing JSON ──
test('#1114 S3.3 cli: default <axis> prints the effective default, shape first, legacy as the fallback', (t) => {
  const shaped = world(t, { schemaVersion: '1.11.1', vcs: { provider: 'gitlab', default: 'github', providers: { github: {} } } });
  assert.equal(run(shaped, 'default', 'vcs').stdout, 'github\n');
  const legacy = world(t, { schemaVersion: '1.9.1', vcs: { provider: 'gitlab' } });
  assert.equal(run(legacy, 'default', 'vcs').stdout, 'gitlab\n');
});

test('#1114 S3.3 cli: default <axis> on an undeclared axis prints an empty line and exits 0; an unknown axis exits 1', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', memory: { default: '', providers: {} } });
  const r = run(root, 'default', 'memory');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '\n');
  assert.equal(run(root, 'default', 'cache').status, 1);
});

test('#1114 S3.3 cli: set <axis>.default writes the default AND its provider entry', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', platform: { default: '', providers: {} } });
  const r = run(root, 'set', 'platform.default', 'claude');
  assert.equal(r.status, 0, r.stderr);
  const next = JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  assert.deepEqual(next.platform, { default: 'claude', providers: { claude: {} } });
});

// ── #1114 S3.3 review: `brain:config` never promotes a per-machine value; brain:upgrade does ──
test('#1114 S3.3 BLOCKER: brain:config\'s migration context ignores env and .env — the reviewer\'s case writes claude, never antigravity', async (t) => {
  const { axisContextFor } = await import('./cli.mjs');
  const { planConfigWrite } = await import('./config-verb.mjs');
  const { migrations } = await import('../../core/config-migrations.mjs');
  const root = world(t, { schemaVersion: '1.9.1', vcs: { provider: 'github' } });
  writeFileSync(join(root, '.env'), 'AGENT_PLATFORM=antigravity\n');
  const config = JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  const axisContext = axisContextFor(config, root);
  const { next, refusal } = planConfigWrite({ config, path: 'sdd.default', value: 'gentle-ai', migrations, targetVersion: '1.11.1', axisContext });
  assert.equal(refusal, null);
  assert.equal(next.platform.default, 'claude', 'today\'s default, not the machine\'s .env');
  assert.equal(next.sdd.default, 'gentle-ai');
});

test('#1114 S3.3: the SAME config migrated through brain:upgrade\'s context still writes antigravity, with the .env source', async (t) => {
  const { resolveAxisMigrationContext } = await import('../lib/axis-migration-context.mjs');
  const { migrateConfig } = await import('../lib/installer.mjs');
  const { migrations } = await import('../../core/config-migrations.mjs');
  const root = world(t, { schemaVersion: '1.9.1', vcs: { provider: 'github' } });
  writeFileSync(join(root, '.env'), 'AGENT_PLATFORM=antigravity\n');
  const config = JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  const axisContext = resolveAxisMigrationContext({ config, env: {}, root });
  const { config: out, notices } = migrateConfig(config, migrations, '1.11.1', axisContext);
  assert.equal(out.platform.default, 'antigravity');
  assert.ok(notices.some((l) => /platform\.default = antigravity \(from \.env AGENT_PLATFORM\)/.test(l)), notices.join('\n'));
});

// ── #1114 S3.3 review: `resolve <platform|sdd>` IS the runtime resolver, so the shell composes no precedence ──
const runEnv = (root, env, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, ...env } });

test('#1114 S3.3 cli: resolve prints "<run> <repo> <source>" — the reviewer\'s case (config harness + .env SDD_HARNESS) agrees with resolvePlatform', async (t) => {
  const { resolvePlatform } = await import('../harness/platform.mjs');
  const root = world(t, { schemaVersion: '1.11.0', harness: 'plain' });
  writeFileSync(join(root, '.env'), 'SDD_HARNESS=antigravity\n');
  const r = runEnv(root, {}, 'resolve', 'platform');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(resolvePlatform({ env: {}, envVars: { SDD_HARNESS: 'antigravity' }, config: { harness: 'plain' } }), 'antigravity');
  assert.equal(r.stdout, 'antigravity antigravity .env\n', 'the .env SDD_HARNESS outranks config.harness, exactly as resolvePlatform ranks it');
});

test('#1114 S3.3 cli: resolve reports the source — config, default, .env — and keeps the run value apart from the repo value', (t) => {
  const declared = world(t, { schemaVersion: '1.11.1', platform: { default: 'antigravity', providers: { antigravity: {} } } });
  assert.equal(runEnv(declared, {}, 'resolve', 'platform').stdout, 'antigravity antigravity config\n');
  const none = world(t, { schemaVersion: '1.11.1' });
  assert.equal(runEnv(none, {}, 'resolve', 'platform').stdout, 'claude claude default\n');
  assert.equal(runEnv(none, {}, 'resolve', 'sdd').stdout, 'gentle-ai gentle-ai default\n');
  // A process-env value is per-invocation: it is the RUN value, never the repo's.
  assert.equal(runEnv(none, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform').stdout, 'antigravity claude default\n');
  const dot = world(t, { schemaVersion: '1.11.1' });
  writeFileSync(join(dot, '.env'), 'SDD_ENGINE=plain\n');
  assert.equal(runEnv(dot, {}, 'resolve', 'sdd').stdout, 'plain plain .env\n');
});

test('#1114 S3.3 cli: resolve over an unknown axis exits 1; a legacy-keyed config counts as declared', (t) => {
  const root = world(t, { schemaVersion: '1.11.0', platform: 'antigravity', engine: 'plain' });
  assert.equal(runEnv(root, {}, 'resolve', 'vcs').status, 1);
  assert.equal(runEnv(root, {}, 'resolve', 'platform').stdout, 'antigravity antigravity config\n');
  assert.equal(runEnv(root, {}, 'resolve', 'sdd').stdout, 'plain plain config\n');
});
