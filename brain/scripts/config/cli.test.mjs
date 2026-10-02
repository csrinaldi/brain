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
test('#1114 S3.4: brain:config\'s migration leaves an axis whose effective value is in .env UNDECLARED — never antigravity, never claude', async (t) => {
  const { axisContextFor } = await import('./cli.mjs');
  const { planConfigWrite } = await import('./config-verb.mjs');
  const { migrations } = await import('../../core/config-migrations.mjs');
  const root = world(t, { schemaVersion: '1.11.0', memory: { backend: '' }, vcs: { provider: 'github' }, sdd: {} });
  writeFileSync(join(root, '.env'), 'AGENT_PLATFORM=antigravity\n');
  const config = JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  const axisContext = axisContextFor(config, root);
  const { next, refusal } = planConfigWrite({ config, path: 'memory.default', value: 'plainfiles', migrations, targetVersion: '1.11.1', axisContext });
  assert.equal(refusal, null);
  assert.equal(next.platform.default, '', 'the machine\'s .env is not the team\'s choice, and neither is a default nobody chose');
  assert.deepEqual(next.platform.providers, {});
  assert.equal(next.sdd.default, 'gentle-ai', 'an axis nothing per-machine states keeps today\'s default');
  assert.equal(next.memory.default, 'plainfiles');
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

// ── #1114 S3.3 review + S2: `resolve <axis>` IS the runtime resolver (resolveAxis), so the shell composes no precedence ──
const runEnv = (root, env, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, ...env } });

test('#1114 S2 cli: resolve prints "<run> <repo> <run-where> <repo-where>" — the reviewer\'s case (config harness + .env SDD_HARNESS) agrees with resolvePlatform', async (t) => {
  const { resolvePlatform } = await import('../harness/platform.mjs');
  const root = world(t, { schemaVersion: '1.11.0', harness: 'plain' });
  writeFileSync(join(root, '.env'), 'SDD_HARNESS=antigravity\n');
  const r = runEnv(root, {}, 'resolve', 'platform');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(resolvePlatform({ env: {}, envVars: { SDD_HARNESS: 'antigravity' }, config: { harness: 'plain' }, notice: () => {} }), 'antigravity');
  assert.equal(r.stdout, 'antigravity antigravity dotenv dotenv\n', 'the .env SDD_HARNESS outranks config.harness, exactly as resolvePlatform ranks it');
  assert.match(r.stderr, /SDD_HARNESS .* deprecated/, 'the legacy harness is never used silently');
});

test('#1114 S2 cli: resolve reports the WINNING level, and keeps the run value apart from the repo value', (t) => {
  const declared = world(t, { schemaVersion: '1.11.1', platform: { default: 'antigravity', providers: { antigravity: {} } } });
  assert.equal(runEnv(declared, {}, 'resolve', 'platform').stdout, 'antigravity antigravity config config\n');
  // A process-env value is per-invocation: it is the RUN value, never the repo's. The level is the resolver's, not an inference:
  // a process env EQUAL to the config still reports process-env (#1114 S3.4 review).
  assert.equal(runEnv(declared, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform').stdout, 'antigravity antigravity process-env config\n');
  const two = world(t, { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {}, antigravity: {} } } });
  assert.equal(runEnv(two, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform').stdout, 'antigravity claude process-env config\n');
  const dot = world(t, { schemaVersion: '1.11.1', sdd: { default: '', providers: {} } });
  writeFileSync(join(dot, '.env'), 'SDD_ENGINE=plain\n');
  assert.equal(runEnv(dot, {}, 'resolve', 'sdd').stdout, 'plain plain dotenv dotenv\n');
  // Only the process env states one: the repo states nothing (`-`).
  const none = world(t, { schemaVersion: '1.11.1' });
  assert.equal(runEnv(none, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform').stdout, 'antigravity - process-env -\n');
});

test('#1114 S2 cli: resolve of an UNDECLARED axis exits 3 with the fix named; a REFUSED value exits 4; no default is ever printed', (t) => {
  const none = world(t, { schemaVersion: '1.11.1' });
  for (const [axis, names] of [['platform', 'claude|antigravity|plain'], ['sdd', 'gentle-ai|plain'], ['memory', 'engram|plainfiles'], ['vcs', 'github|gitlab']]) {
    const r = runEnv(none, {}, 'resolve', axis);
    assert.equal(r.status, 3, `${axis}: ${r.stderr}`);
    assert.equal(r.stdout, '', `${axis} prints nothing: a guess is not expressible`);
    assert.match(r.stderr, new RegExp(`brain:config -- set ${axis}\\.default <${names.replace('|', '\\|').replace('|', '\\|')}>`));
  }
  const listed = world(t, { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {} } } });
  const refused = runEnv(listed, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform');
  assert.equal(refused.status, 4);
  assert.match(refused.stderr, /not a key of platform\.providers/);
  assert.match(refused.stderr, /set platform\.providers\.antigravity/);
  const bad = runEnv(none, { AGENT_PLATFORM: 'codex' }, 'resolve', 'platform');
  assert.equal(bad.status, 4);
  assert.match(bad.stderr, /not a platform brain ships/);
});

test('#1114 S2 cli: the fix a refusal prints is a command the verb accepts, and it lifts the refusal', (t) => {
  const listed = world(t, { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {} } } });
  const w = runEnv(listed, {}, 'set', 'platform.providers.antigravity', '{}');
  assert.equal(w.status, 0, w.stderr);
  assert.equal(runEnv(listed, { AGENT_PLATFORM: 'antigravity' }, 'resolve', 'platform').status, 0);
});

test('#1114 S2 cli: resolve over an unknown axis exits 1; a legacy-keyed config counts as declared', (t) => {
  const root = world(t, { schemaVersion: '1.11.0', platform: 'antigravity', engine: 'plain' });
  assert.equal(runEnv(root, {}, 'resolve', 'nope').status, 1);
  assert.equal(runEnv(root, {}, 'resolve', 'platform').stdout, 'antigravity antigravity config config\n');
  assert.equal(runEnv(root, {}, 'resolve', 'sdd').stdout, 'plain plain config config\n');
});

test('#1114 S2 cli: an invalid axis config refuses with the validator\'s errors (exit 4)', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', platform: { default: 'antigravity', providers: { claude: {} } } });
  const r = runEnv(root, {}, 'resolve', 'platform');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /invalid for platform/);
  assert.match(r.stderr, /not a key of platform\.providers/);
});

// ── #1114 S3.4: `diagnose` prints diagnoseAxes' findings as JSON — findings, never failures ──
test('#1114 S3.4 cli: diagnose prints the findings as JSON, exits 0, and never prints .env', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {}, antigravity: {} } }, sdd: { default: 'plain', providers: { plain: { version: '1' }, brain: { version: 'self' } } } });
  writeFileSync(join(root, '.env'), 'AGENT_PLATFORM=antigravity\nCANARY_KEY=leak-canary-123\n');
  const r = runEnv(root, {}, 'diagnose');
  assert.equal(r.status, 0, r.stderr);
  const findings = JSON.parse(r.stdout);
  const codes = findings.map((f) => f.code);
  assert.ok(codes.includes('env-shadows-config'), r.stdout);
  assert.ok(codes.includes('version-unverified'), 'claude declares no version');
  assert.ok(!findings.some((f) => f.axis === 'sdd' && f.code.startsWith('version') && /sdd\.providers\.brain\b/.test(f.message)), '"self" is verified against the installed brain');
  assert.doesNotMatch(r.stdout + r.stderr, /leak-canary-123|CANARY_KEY/);
});

test('#1114 S3.4 cli: diagnose reads the process env too, and an invalid config is a finding, not an exit code', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', platform: { default: 'codex', providers: { codex: {} } } });
  const r = runEnv(root, { MEMORY_BACKEND: 'engram' }, 'diagnose');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).some((f) => f.code === 'invalid-config'));
});

test('#1114 S3.4 cli: the version fix diagnose prints is a command the verb accepts', (t) => {
  const root = world(t, { schemaVersion: '1.11.1', sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} } } });
  const f = JSON.parse(runEnv(root, {}, 'diagnose').stdout).find((x) => x.code === 'version-unverified');
  assert.match(f.fix, /^npm run brain:config -- set sdd\.providers\.gentle-ai\.version /);
  const w = runEnv(root, {}, 'set', 'sdd.providers.gentle-ai.version', '1.2.3');
  assert.equal(w.status, 0, w.stderr);
  assert.equal(JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8')).sdd.providers['gentle-ai'].version, '1.2.3');
});
