// bootstrap.default-platform.test.mjs — bootstrap.sh's platform default is
// `claude`, and it gives the SAME answer as `resolvePlatform` (issue #1125).
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// bootstrap.sh resolves AGENT_PLATFORM in shell, writes it to `.env` and
// exports it before `harness/cli.mjs init` runs. That makes it a SECOND
// resolver beside `harness/platform.mjs#resolvePlatform`, and until #1125 the
// two disagreed on three inputs while agreeing on the default by coincidence:
//
//   - a process-env `AGENT_PLATFORM` was ignored (only `.env` was read), so the
//     documented `AGENT_PLATFORM=antigravity npm run brain:env:init` produced
//     antigravity only because antigravity was also the default;
//   - a legacy `SDD_HARNESS=claude` in `.env` was ignored, and the default was
//     written over it;
//   - a process-env value was shadowed by `.env`, the reverse of the resolver.
//
// Flipping the default to `claude` turns each coincidence into a wrong answer,
// so the default and the precedence move together, and the parity test below
// holds the shell to the JS resolver until #1114 leaves exactly one resolver.
//
// ── #1114 S3.3 ──────────────────────────────────────────────────────────────
//
// `env:init` no longer writes an axis selector into `.env`. What the repo states
// is declared in TRACKED config (`platform.default`, `sdd.default`) through
// `brain:config`; `.env` stays a per-machine override and is only ever READ. The
// precedence below is unchanged (`.env` still beats config, as the resolvers
// have it), with the config's declared default taking the place `.env` used to
// hold for a repo that states nothing per machine.
//
// ── Idiom ───────────────────────────────────────────────────────────────────
//
// Same as bootstrap.cross-tree-code.test.mjs (#1093) and
// bootstrap.worktree.test.mjs (#657): the block under test is LIFTED OUT OF
// bootstrap.sh and executed, so there is no second copy to drift from it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { removeTempTree } from './__fixtures__/tmp-tree.mjs';
import { resolvePlatform } from './harness/platform.mjs';
import { resolveEngine } from './harness/cli.mjs';
import { readAxis, validateAxisConfig, resolveAxis, AXES } from './lib/axis-config.mjs';
import { ensureBrainConfig } from './lib/brain-config.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

const BOOTSTRAP = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.sh');
const LINES = readFileSync(BOOTSTRAP, 'utf8').split('\n');

/** bootstrap.sh's own `env_get` / `env_set` helpers, verbatim. */
function envHelpers() {
  const get = LINES.find((l) => l.startsWith('env_get() {'));
  assert.ok(get, 'bootstrap.sh must define env_get');
  const setStart = LINES.findIndex((l) => l.startsWith('env_set() {'));
  assert.ok(setStart !== -1, 'bootstrap.sh must define env_set');
  const setEnd = LINES.findIndex((l, i) => i > setStart && l === '}');
  assert.ok(setEnd !== -1, 'env_set must close with a bare }');
  return [get, ...LINES.slice(setStart, setEnd + 1)].join('\n');
}

/**
 * The platform block of §6, verbatim: from the line after the SDD section
 * banner up to and including the line that sets the run's AGENT_PLATFORM.
 */
function platformBlock() {
  const banner = LINES.findIndex((l) => l.startsWith('say "$I18N_BOOTSTRAP_SDD_SECTION"'));
  assert.ok(banner !== -1, 'bootstrap.sh §6 must open with the SDD section banner');
  assert.ok(LINES.some((l, i) => i > banner && l.startsWith('_axis_resolve platform')), '§6 must resolve the platform through `config/cli.mjs resolve` (_axis_resolve)');
  assert.ok(!LINES.some((l) => /env_set (AGENT_PLATFORM|SDD_ENGINE)\b/.test(l)), 'bootstrap.sh must not write an axis selector into .env (#1114 S3.3)');
  assert.ok(!LINES.some((l) => /env_get (AGENT_PLATFORM|SDD_ENGINE|SDD_HARNESS)\b/.test(l)), 'bootstrap.sh must not compose its own platform/engine precedence from .env (#1114 S3.3)');
  const end = LINES.findIndex((l, i) => i > banner && l.startsWith('AGENT_PLATFORM="$_R_RUN"'));
  assert.ok(end !== -1, "§6 must set the run's AGENT_PLATFORM from the resolver");
  return LINES.slice(banner + 1, end + 1).join('\n');
}

/** The declare helpers, verbatim, between their sentinels. */
function declareHelpers() {
  const start = LINES.findIndex((l) => l.includes('BEGIN axis-declare-helpers'));
  assert.ok(start !== -1, 'bootstrap.sh must mark BEGIN axis-declare-helpers');
  const end = LINES.findIndex((l, i) => i > start && l.includes('END axis-declare-helpers'));
  assert.ok(end > start, 'bootstrap.sh must mark END axis-declare-helpers');
  return LINES.slice(start + 1, end).join('\n');
}

/** The SDD-engine block of §6, verbatim: from its resolve up to and including the run's SDD_ENGINE. */
function sddBlock() {
  const start = LINES.findIndex((l) => l.startsWith('_axis_resolve sdd'));
  assert.ok(start !== -1, '§6 must resolve the engine through `config/cli.mjs resolve`');
  const end = LINES.findIndex((l, i) => i > start && l.startsWith('SDD_ENGINE="$_R_RUN"'));
  assert.ok(end !== -1, "§6 must set the run's SDD_ENGINE from the resolver");
  return LINES.slice(start, end + 1).join('\n');
}

const STUBS = [
  'BRAIN_SCRIPTS=' + JSON.stringify(SCRIPTS),
  'MISSING_OPTIONAL=()',
  'REQUIRED_FAILURES=()',
  'I18N_BOOTSTRAP_AXIS_DECLARED="declared %s=%s %s"',
  'I18N_BOOTSTRAP_AXIS_REFUSED="refused %s: %s"',
  'I18N_BOOTSTRAP_AXIS_REFUSEDNEXT="refused-next %s (%s)"',
  'I18N_BOOTSTRAP_AXIS_ENVONLY="envonly %s %s %s %s"',
  'I18N_BOOTSTRAP_AXIS_DECLAREFAILED="failed %s %s %s"',
  'ok() { :; }',
  'warn() { printf "warn:%s\\n" "$1" >&2; }',
].join('\n');

const BASE_ENV = { ...process.env };
for (const k of ['AGENT_PLATFORM', 'SDD_HARNESS', 'SDD_ENGINE']) delete BASE_ENV[k];

/**
 * Runs the lifted block in a scratch dir holding `envFile` (null = no .env),
 * with `procEnv` layered on a clean environment. Returns what the block
 * resolved and the `.env` it left behind.
 */
function runBlock({ procEnv = {}, envFile = null, config = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1125-bootstrap-'));
  try {
    if (envFile !== null) writeFileSync(join(dir, '.env'), envFile);
    writeFileSync(join(dir, 'brain.config.json'), JSON.stringify(config, null, 2) + '\n');
    const script = [
      'set -euo pipefail',
      STUBS,
      envHelpers(),
      declareHelpers(),
      platformBlock(),
      sddBlock(),
      'printf \'%s|%s|%s\' "$AGENT_PLATFORM" "$SDD_ENGINE" "${MISSING_OPTIONAL[*]:-}"',
    ].join('\n');
    const r = spawnSync('bash', ['-c', script], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...BASE_ENV, ...procEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
    assert.equal(r.status, 0, r.stderr);
    const [platform, engine, missing] = r.stdout.split('|');
    const envPath = join(dir, '.env');
    return {
      platform,
      engine,
      missing,
      configText: readFileSync(join(dir, 'brain.config.json'), 'utf8'),
      dotenv: existsSync(envPath) ? readFileSync(envPath, 'utf8') : null,
      config: JSON.parse(readFileSync(join(dir, 'brain.config.json'), 'utf8')),
      stderr: r.stderr,
    };
  } finally {
    removeTempTree(dir);
  }
}

test('#1125 bootstrap.sh: with nothing stated anywhere, the platform is claude and the CONFIG records it (#1114 S3.3)', () => {
  const { platform, dotenv, config } = runBlock();
  assert.equal(platform, 'claude');
  assert.equal(dotenv, null, 'no .env is created for an axis selector');
  assert.equal(config.platform.default, 'claude', 'the default is declared in tracked config');
  assert.deepEqual(config.platform.providers.claude, {}, 'and its provider entry exists, so the refusal never fires');
});

test('#1125 bootstrap.sh: an .env without AGENT_PLATFORM still defaults to claude', () => {
  const { platform, dotenv, config } = runBlock({ envFile: 'VCS_TOKEN=tok\n' });
  assert.equal(platform, 'claude');
  assert.equal(dotenv, 'VCS_TOKEN=tok\n', '.env is left byte-for-byte as it was');
  assert.equal(config.platform.default, 'claude');
});

test('#1125 bootstrap.sh: a stated antigravity still resolves to antigravity on every shell path', () => {
  const cases = {
    '.env AGENT_PLATFORM': { envFile: 'AGENT_PLATFORM=antigravity\n' },
    'process env AGENT_PLATFORM': { procEnv: { AGENT_PLATFORM: 'antigravity' } },
    '.env SDD_HARNESS (legacy)': { envFile: 'SDD_HARNESS=antigravity\n' },
    'process env SDD_HARNESS (legacy)': { procEnv: { SDD_HARNESS: 'antigravity' } },
  };
  for (const [label, opts] of Object.entries(cases)) {
    assert.equal(runBlock(opts).platform, 'antigravity', `stated via ${label}`);
  }
});

test('#1125 bootstrap.sh: a process-env platform wins for the run and does NOT rewrite a platform .env already states', () => {
  // The antigravity backend's REGENERATE_HINT is
  // `AGENT_PLATFORM=antigravity npm run brain:env:init`. It must run antigravity
  // for that invocation, and must not silently switch a claude repo's .env.
  const { platform, dotenv, config, missing } = runBlock({
    procEnv: { AGENT_PLATFORM: 'antigravity' },
    envFile: 'AGENT_PLATFORM=claude\n',
  });
  assert.equal(platform, 'antigravity');
  assert.equal(dotenv, 'AGENT_PLATFORM=claude\n', '.env is left exactly as stated');
  // The repo value claude comes from `.env`, and the resolver SAYS so (#1114 S3.4): it used to be inferred by comparing
  // values, so a `.env` claude that equalled the old code default was declared as if nothing stated it. A per-machine value
  // is never the team's tracked default; the process-env one-off never is either.
  assert.equal(config.platform, undefined, 'a value only .env states is not declared');
  assert.match(missing, /platform claude is declared only on this machine/);
});

test('#1125 bootstrap.sh: a process-env platform on a fresh repo is NOT declared — config records the repo\'s own answer', () => {
  // `brain:upgrade` prints `AGENT_PLATFORM=antigravity npm run brain:env:init`
  // to a FRESH consumer (to regenerate AGENTS.md). Persisting the process value
  // would silently move that consumer off the claude default for good. The
  // process env is per-invocation, exactly as resolvePlatform treats it; .env is
  // what the repo states, and a repo that stated nothing gets the default.
  const { platform, config } = runBlock({ procEnv: { AGENT_PLATFORM: 'antigravity' } });
  assert.equal(platform, 'antigravity', 'the invocation runs what it was asked to');
  assert.equal(config.platform.default, 'claude', 'config records the default, not the one-off');
});

test('#1125 bootstrap.sh: a legacy SDD_HARNESS naming an ENGINE is not a platform — the default applies', () => {
  assert.equal(runBlock({ envFile: 'SDD_HARNESS=gentle-ai\n' }).platform, 'claude');
});

test('#1125/#1114 bootstrap.sh and resolvePlatform/resolveEngine give ONE answer over env, .env and config (incl. config.harness with .env SDD_HARNESS)', () => {
  // bootstrap.sh no longer composes a precedence: it asks `config/cli.mjs resolve`, which calls the real
  // resolvers. This table holds that to the resolvers' own answers, with the legacy `harness` key in config
  // crossed against SDD_HARNESS in process env and `.env` (the reviewer's divergence). One bash process runs
  // every case in its own subshell and scratch dir; declare helpers are stubbed (their writes are covered below).
  const unsetOr = (...v) => [undefined, ...v];
  const cases = [];
  for (const envAP of unsetOr('antigravity'))
    for (const envSH of unsetOr('antigravity', 'plain'))
      for (const fileSH of unsetOr('plain', 'antigravity'))
        for (const cfgH of unsetOr('plain', 'antigravity')) cases.push({ envAP, envSH, fileSH, cfgH });
  for (const fileAP of ['claude', 'antigravity']) cases.push({ fileAP, fileSH: 'plain', cfgH: 'antigravity' });
  cases.push({ fileSE: 'plain', cfgH: 'antigravity' }, { envSE: 'plain', fileSH: 'antigravity' });

  const base = mkdtempSync(join(tmpdir(), 'brain-1125-parity-'));
  try {
    const q = (v) => `'${v}'`;
    const script = ['set -euo pipefail', STUBS, envHelpers(), declareHelpers(), '_axis_declare() { :; }', '_axis_env_only() { :; }'];
    cases.forEach((c, i) => {
      const dir = join(base, String(i));
      const lines = [`mkdir -p ${q(dir)}`, `cd ${q(dir)}`, `printf '%s' ${q(JSON.stringify(c.cfgH ? { harness: c.cfgH } : {}))} > brain.config.json`];
      if (c.fileAP) lines.push(`printf 'AGENT_PLATFORM=%s\\n' ${q(c.fileAP)} >> .env`);
      if (c.fileSH) lines.push(`printf 'SDD_HARNESS=%s\\n' ${q(c.fileSH)} >> .env`);
      if (c.fileSE) lines.push(`printf 'SDD_ENGINE=%s\\n' ${q(c.fileSE)} >> .env`);
      lines.push(c.envAP ? `export AGENT_PLATFORM=${q(c.envAP)}` : 'unset AGENT_PLATFORM');
      lines.push(c.envSH ? `export SDD_HARNESS=${q(c.envSH)}` : 'unset SDD_HARNESS');
      lines.push(c.envSE ? `export SDD_ENGINE=${q(c.envSE)}` : 'unset SDD_ENGINE');
      lines.push(platformBlock(), sddBlock(), `printf '%s %s\\n' "$AGENT_PLATFORM" "$SDD_ENGINE"`);
      script.push(`(\n${lines.join('\n')}\n)`);
    });
    // From a script FILE, not argv and not the `input` option (a piped stdin never sees EOF in the cold reviewer's sandbox, #1221).
    const scriptFile = join(base, 'parity.sh');
    writeFileSync(scriptFile, script.join('\n'));
    const out = execFileSync('bash', [scriptFile], {
      encoding: 'utf8',
      env: BASE_ENV,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\n');

    const mismatches = [];
    cases.forEach((c, i) => {
      const env = {};
      if (c.envAP) env.AGENT_PLATFORM = c.envAP;
      if (c.envSH) env.SDD_HARNESS = c.envSH;
      if (c.envSE) env.SDD_ENGINE = c.envSE;
      const envVars = {};
      if (c.fileAP) envVars.AGENT_PLATFORM = c.fileAP;
      if (c.fileSH) envVars.SDD_HARNESS = c.fileSH;
      if (c.fileSE) envVars.SDD_ENGINE = c.fileSE;
      const config = c.cfgH ? { harness: c.cfgH } : {};
      // Where the resolver REFUSES as undeclared, bootstrap declares a NEW consumer's starting value (claude, gentle-ai) in config.
      const orNew = (fn, fallback) => { try { return fn({ env, envVars, config }); } catch (e) { if (e.code !== 'undeclared') throw e; return fallback; } };
      const js = `${orNew(resolvePlatform, 'claude')} ${orNew(resolveEngine, 'gentle-ai')}`;
      if (out[i] !== js) mismatches.push({ ...c, shell: out[i], js });
    });
    assert.deepEqual(mismatches, [], 'bootstrap.sh must run what the resolvers resolve');
    assert.ok(cases.some((c) => c.cfgH === 'plain' && c.fileSH === 'antigravity'), 'the table contains the reviewer\'s case');
  } finally {
    removeTempTree(base);
  }
});

test('#1114 S3.3 bootstrap.sh: the reviewer\'s exact case — config {harness:plain} with .env SDD_HARNESS=antigravity runs antigravity, as resolvePlatform does', () => {
  const r = runBlock({ config: { schemaVersion: '1.11.0', harness: 'plain' }, envFile: 'SDD_HARNESS=antigravity\n' });
  assert.equal(r.platform, resolvePlatform({ env: {}, envVars: { SDD_HARNESS: 'antigravity' }, config: { harness: 'plain' } }));
  assert.equal(r.platform, 'antigravity');
});

// ── #1114 S3.3: the config is where an axis is declared ─────────────────────────────────────────
test('#1114 S3.3 bootstrap.sh: a value that exists ONLY in .env is never written into tracked config (envOnly warning, config byte-identical)', () => {
  const envFile = 'AGENT_PLATFORM=antigravity\nSDD_ENGINE=plain\nVCS_TOKEN=secret\n';
  const initial = JSON.stringify({}, null, 2) + '\n';
  const r = runBlock({ envFile });
  assert.equal(r.platform, 'antigravity');
  assert.equal(r.engine, 'plain');
  assert.equal(r.dotenv, envFile, '.env is byte-identical');
  assert.equal(r.configText, initial, 'one developer\'s override never becomes the team\'s tracked default through env:init');
  assert.match(r.stderr, /envonly platform antigravity platform antigravity/);
  assert.match(r.stderr, /envonly sdd plain sdd plain/);
  assert.match(r.missing, /platform .*brain:config -- set platform\.default antigravity/);
  assert.match(r.missing, /sdd .*brain:config -- set sdd\.default plain/);
});

test('#1114 S3.3 bootstrap.sh: each axis is judged on its own — an .env platform alone leaves sdd to be declared from the default', () => {
  const r = runBlock({ envFile: 'AGENT_PLATFORM=antigravity\n' });
  assert.equal(r.config.platform, undefined);
  assert.equal(r.config.sdd.default, 'gentle-ai');
});

test('#1114 S3.3 bootstrap.sh: a LEGACY-keyed config is a declaration — resolved from it, nothing re-declared', () => {
  const config = { schemaVersion: '1.11.0', platform: 'antigravity', engine: 'plain' };
  const r = runBlock({ config });
  assert.equal(r.platform, 'antigravity');
  assert.equal(r.engine, 'plain');
  assert.equal(r.configText, JSON.stringify(config, null, 2) + '\n', 'byte-identical: no write over the legacy keys');
  assert.equal(r.missing, '');
});

test('#1114 S3.3 bootstrap.sh: a legacy SDD_HARNESS naming a PLATFORM never becomes the sdd value', () => {
  const r = runBlock({ envFile: 'SDD_HARNESS=antigravity\n' });
  assert.equal(r.platform, 'antigravity');
  assert.equal(r.engine, 'gentle-ai', 'antigravity is not a member of SDD_ENGINES, so the engine falls to the default');
  assert.equal(r.config.sdd.default, 'gentle-ai', '`set sdd.default` would refuse antigravity; the declared value is the default');
});

test('#1114 S3.3 bootstrap.sh: a legacy SDD_HARNESS naming an ENGINE seeds the engine, env-only (not declared)', () => {
  // schemaVersion 1.11.1: the shape migration does not re-run, so only what env:init itself writes can appear.
  const r = runBlock({ envFile: 'SDD_HARNESS=plain\n', config: { schemaVersion: '1.11.1' } });
  assert.equal(r.engine, 'plain');
  assert.equal(r.platform, 'plain', '`plain` is a member of both axes');
  assert.equal(r.config.sdd, undefined);
  assert.match(r.stderr, /envonly sdd plain/);
});

test('#1114 S3.3 bootstrap.sh: a platform the config already declares is the repo\'s answer, and is not rewritten', () => {
  const config = { platform: { default: 'antigravity', providers: { antigravity: { version: '9' } } }, sdd: { default: 'plain', providers: { plain: {} } } };
  const r = runBlock({ config });
  assert.equal(r.platform, 'antigravity', 'a second checkout with no .env runs the team\'s declared platform');
  assert.equal(r.engine, 'plain');
  assert.deepEqual(r.config.platform.providers, { antigravity: { version: '9' } }, 'a declared entry is never overwritten');
});

test('#1114 S3.3 bootstrap.sh: .env still beats the config, as every resolver has it, and a stale .env is not "fixed"', () => {
  const config = { platform: { default: 'claude', providers: { claude: {}, antigravity: {} } } };
  const r = runBlock({ config, envFile: 'AGENT_PLATFORM=antigravity\n' });
  assert.equal(r.platform, 'antigravity');
  assert.equal(r.config.platform.default, 'claude');
});

test('#1114 S3.3 bootstrap.sh: a failed declaration is reported, and the run still resolves its answer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1114-declfail-'));
  try {
    // A readable config in a directory that cannot be written: resolve works, `brain:config set` cannot.
    writeFileSync(join(dir, 'brain.config.json'), '{"schemaVersion":"1.11.1"}\n');
    chmodSync(dir, 0o555);
    const script = ['set -euo pipefail', STUBS, envHelpers(), declareHelpers(), platformBlock(), 'printf "%s|%s" "$AGENT_PLATFORM" "${MISSING_OPTIONAL[*]:-}"'].join('\n');
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', env: BASE_ENV, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^claude\|.*platform\.default/, 'resolved, and the missing declaration is named with its fix');
    assert.match(r.stderr, /failed platform platform claude/);
  } finally {
    chmodSync(dir, 0o755);
    removeTempTree(dir);
  }
});

test('#1114 S2 bootstrap.sh: an unresolvable config is REFUSED and reported; nothing falls back to claude/gentle-ai, nothing is declared', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1114-resfail-'));
  try {
    writeFileSync(join(dir, 'brain.config.json'), '{ not json');
    const script = ['set -euo pipefail', STUBS, envHelpers(), declareHelpers(), platformBlock(), sddBlock(), 'printf "[%s] [%s]|%s" "$AGENT_PLATFORM" "$SDD_ENGINE" "${MISSING_OPTIONAL[*]:-}"'].join('\n');
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', env: BASE_ENV, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^\[\] \[\]\|/, 'no harness is resolved: the old claude/gentle-ai fallback is gone');
    assert.match(r.stdout, /refused-next platform .*brain:config -- resolve platform.*refused-next sdd/);
    assert.match(r.stderr, /refused platform: .*not valid JSON/);
    assert.equal(readFileSync(join(dir, 'brain.config.json'), 'utf8'), '{ not json', 'a config that could not be read is never written over');
  } finally {
    removeTempTree(dir);
  }
});

test('#1114 S2 bootstrap.sh: a per-machine value the resolver REFUSES (not listed in platform.providers) is reported with its fix, and is not run', () => {
  const config = { platform: { default: 'claude', providers: { claude: {} } }, sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} } } };
  const r = runBlock({ config, envFile: 'AGENT_PLATFORM=antigravity\n' });
  assert.equal(r.platform, '', 'nothing runs on a refused value');
  assert.equal(r.engine, 'gentle-ai');
  assert.match(r.missing, /refused-next platform/);
  assert.match(r.stderr, /refused platform: .*not a key of platform\.providers/);
  assert.deepEqual(r.config, config, 'a refused axis is never rewritten');
});

test('#1114 S3.3 a FRESH install ends with every axis declared in config (the S2 refusal never fires)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1114-fresh-'));
  try {
    // 1. the scaffold env:init runs first: shape on every axis, vcs derived from the origin.
    ensureBrainConfig(dir, { identity: { host: 'github.com', project: 'o/r' } });
    // 2. §6 of env:init: platform and sdd, through the real helpers and the real `brain:config`.
    const script = ['set -euo pipefail', STUBS, envHelpers(), declareHelpers(), platformBlock(), sddBlock(), 'printf done'].join('\n');
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', env: BASE_ENV, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    // 3. §7: the memory prompt's answer, through the same command.
    const m = spawnSync(process.execPath, [join(SCRIPTS, 'config/cli.mjs'), 'set', 'memory.default', 'plainfiles'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    assert.equal(m.status, 0, m.stderr);

    const config = JSON.parse(readFileSync(join(dir, 'brain.config.json'), 'utf8'));
    for (const axis of AXES) {
      const a = readAxis(config, axis);
      assert.equal(a.source, 'shape', `${axis} is in the ADR-0038 shape`);
      assert.notEqual(a.default, '', `${axis}.default is declared`);
      assert.ok(Object.hasOwn(a.providers, a.default), `${axis}.default is a key of ${axis}.providers`);
    }
    assert.deepEqual(validateAxisConfig(config).errors, []);
    // The #1114 S2 proof: with the code defaults GONE, the fresh install's own config answers every axis through the one resolver
    // (no .env, no process env: a second checkout and CI see exactly this).
    for (const axis of AXES) {
      const r = resolveAxis(axis, { env: {}, dotenv: {}, config });
      assert.equal(r.source, 'config', `${axis} resolves from the tracked config alone`);
      assert.equal(r.value, readAxis(config, axis).default, axis);
    }
    assert.equal(existsSync(join(dir, '.env')), false, 'no .env was needed or written');
  } finally {
    removeTempTree(dir);
  }
});

// ── #1114 S3.4 (S3.3 cold review): the success line names the ACTUAL source of the run's values ──
function successLine({ procEnv = {}, envFile = null, config = {}, userConfig = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1114-srcline-'));
  try {
    // The user layer (#1263): a BRAIN_HOME of the fixture's own, seeded only when the scenario asks.
    mkdirSync(join(dir, 'brain-home'), { recursive: true });
    if (userConfig !== null) writeFileSync(join(dir, 'brain-home', 'config.json'), JSON.stringify(userConfig));
    if (envFile !== null) writeFileSync(join(dir, '.env'), envFile);
    writeFileSync(join(dir, 'brain.config.json'), JSON.stringify(config, null, 2) + '\n');
    const src = (prefix) => LINES.map((l) => l.trim()).find((l) => l.startsWith(prefix));
    const okLine = src('ok "$(printf "$I18N_BOOTSTRAP_SDD_OK"');
    assert.ok(okLine, 'bootstrap.sh must report the harness through I18N_BOOTSTRAP_SDD_OK');
    const script = [
      'set -euo pipefail',
      STUBS.replace('ok() { :; }', 'ok() { printf "OK:%s\\n" "$1"; }'),
      `eval "$(node ${JSON.stringify(join(SCRIPTS, 'i18n/sh.mjs'))})"`,
      envHelpers(),
      declareHelpers(),
      platformBlock(),
      src('_PLATFORM_SRC='),
      sddBlock(),
      src('_SDD_SRC='),
      okLine,
    ].join('\n');
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', env: { ...BASE_ENV, BRAIN_HOME: join(dir, 'brain-home'), ...procEnv }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split('\n').find((l) => l.startsWith('OK:harness')) ?? r.stdout;
  } finally {
    removeTempTree(dir);
  }
}

test('#1114 S3.4 bootstrap.sh: the harness success line names where the run values came from', () => {
  const declared = { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {}, antigravity: {} } }, sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {}, plain: {} } } };
  assert.equal(successLine({ config: declared }), 'OK:harness: gentle-ai (claude) (brain.config.json)');
  assert.equal(successLine({ config: declared, envFile: 'AGENT_PLATFORM=antigravity\nSDD_ENGINE=plain\n' }), 'OK:harness: plain (antigravity) (.env)');
  assert.equal(successLine({ config: declared, procEnv: { AGENT_PLATFORM: 'antigravity', SDD_ENGINE: 'plain' } }), 'OK:harness: plain (antigravity) (process env)');
  assert.equal(successLine({ config: { schemaVersion: '1.11.1' } }), 'OK:harness: gentle-ai (claude) (brain.config.json)', 'a new consumer: declared by env:init just now');
  // The label is the resolver's WINNING level, never an inequality (#1114 S3.4): a process env EQUAL to the config is still the process env.
  assert.equal(successLine({ config: declared, procEnv: { AGENT_PLATFORM: 'claude', SDD_ENGINE: 'gentle-ai' } }), 'OK:harness: gentle-ai (claude) (process env)');
  assert.equal(successLine({ config: declared, envFile: 'AGENT_PLATFORM=claude\nSDD_ENGINE=gentle-ai\n' }), 'OK:harness: gentle-ai (claude) (.env)');
  assert.equal(successLine({ config: declared, envFile: 'AGENT_PLATFORM=antigravity\n' }), 'OK:harness: gentle-ai (antigravity) (platform: .env; engine: brain.config.json)');
});

test('#1263 S1 bootstrap.sh: a user-layer platform wins for the run and the success line names the user config; the team config is not rewritten', () => {
  const declared = { schemaVersion: '1.11.1', platform: { default: 'claude', providers: { claude: {} } }, sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} } } };
  const carol = { platform: { default: 'antigravity', providers: { antigravity: {} } } };
  assert.equal(successLine({ config: declared, userConfig: carol }), 'OK:harness: gentle-ai (antigravity) (platform: user config (~/.brain); engine: brain.config.json)');
  // the team config stays byte-identical: the user layer is read, never declared into the repo
  assert.equal(successLine({ config: declared, userConfig: carol, procEnv: { SDD_ENGINE: 'gentle-ai' } }), 'OK:harness: gentle-ai (antigravity) (platform: user config (~/.brain); engine: process env)');
});

test('#1114 S3.4 bootstrap.sh: the source words exist in en and es, and the success line carries {source}', async () => {
  const en = (await import('./i18n/en.mjs')).default;
  const es = (await import('./i18n/es.mjs')).default;
  for (const cat of [en, es]) {
    for (const k of ['shell', 'dotenv', 'user', 'config', 'default', 'split']) assert.ok(cat[`bootstrap.axis.source.${k}`], `bootstrap.axis.source.${k}`);
    assert.match(cat['bootstrap.sdd.ok'], /\{harness\}.*\{source\}/);
    assert.doesNotMatch(cat['bootstrap.sdd.ok'], /brain\.config\.json/);
  }
});
