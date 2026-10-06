// scripts/harness/cli.test.mjs — unit tests for the SDD harness dispatcher.
//
// Acceptance criteria:
//   (a) resolveHarness: env var (SDD_HARNESS) wins over .env file value.
//   (b) resolveHarness: .env value used when env var absent.
//   (c) resolveHarness: both absent is refused (no default since #1114 S2).
//   (d) dispatch: calls 'init' on the resolved backend (injectable fake).
//   (e) dispatch: unknown harness → throws a clear error.
//   (f) dispatch: unknown op → throws a clear error.
//   (g) dispatch: backend missing 'init' export → throws a clear error.
//
// Run with: npm test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveHarness, resolvePlatform, resolveEngine, dispatch, VALID_OPS } from './cli.mjs';
import { SDD_ENGINES, AGENT_PLATFORMS } from './platform.mjs';
import * as platformModule from './platform.mjs';
import { AxisRefusal } from '../lib/axis-config.mjs';

const refusal = (fn, code = 'undeclared') => assert.throws(fn, (e) => e instanceof AxisRefusal && e.code === code);

// ── 3-axis resolution tests (issue #305) ───────────────────────────────────

test('resolvePlatform: env AGENT_PLATFORM wins over envVars and config', () => {
  const result = resolvePlatform({
    env: { AGENT_PLATFORM: 'claude' },
    envVars: { AGENT_PLATFORM: 'antigravity' },
  });
  assert.equal(result, 'claude');
});

// The legacy value is `antigravity`, NOT `claude` (#1125): with `claude` the
// default, a legacy `SDD_HARNESS=claude` resolves to `claude` whether or not the
// fallback is read at all — the test would pass against a resolver that dropped
// SDD_HARNESS. The value under test must differ from the default to detect it.
test('resolvePlatform: falls back to legacy SDD_HARNESS when platform absent', () => {
  const result = resolvePlatform({
    env: {},
    envVars: { SDD_HARNESS: 'antigravity' },
  });
  assert.equal(result, 'antigravity');
});

// #1114 S2 (ADR-0038 section 3) — there is NO default platform. #1125 made `claude` the default (ADR-0024 Amendment 2) and
// S2 retires it: nothing declared is a REFUSAL that names the fix. Updated, not deleted: the absence is still pinned.
test('resolvePlatform: nothing stated is REFUSED with the fix named, never claude (#1114 S2)', () => {
  for (const opts of [{ env: {}, envVars: {} }, { env: {}, envVars: {}, config: {} }, { env: {} }]) {
    assert.throws(() => resolvePlatform(opts), (e) => e instanceof AxisRefusal && e.code === 'undeclared' && /brain:config -- set platform\.default <claude\|antigravity\|plain>/.test(e.message));
  }
});

test('resolvePlatform: there is no DEFAULT_PLATFORM / DEFAULT_ENGINE declaration left to fall back to (#1114 S2)', () => {
  assert.equal('DEFAULT_PLATFORM' in platformModule, false);
  assert.equal('DEFAULT_ENGINE' in platformModule, false);
});

test('resolvePlatform: a legacy SDD_HARNESS outside the platform set is REFUSED as undeclared, not leaked into the axis', () => {
  // `gentle-ai` is an ENGINE (ADR-0024); as a legacy SDD_HARNESS it must not feed the platform axis.
  refusal(() => resolvePlatform({ env: {}, envVars: { SDD_HARNESS: 'gentle-ai' } }));
});

test('resolvePlatform: a stated antigravity still resolves to antigravity on EVERY path (#1125)', () => {
  const paths = {
    'process env AGENT_PLATFORM': { env: { AGENT_PLATFORM: 'antigravity' }, envVars: {}, config: {} },
    '.env AGENT_PLATFORM': { env: {}, envVars: { AGENT_PLATFORM: 'antigravity' }, config: {} },
    'config platform': { env: {}, envVars: {}, config: { platform: 'antigravity' } },
    'process env SDD_HARNESS (legacy)': { env: { SDD_HARNESS: 'antigravity' }, envVars: {}, config: {} },
    '.env SDD_HARNESS (legacy)': { env: {}, envVars: { SDD_HARNESS: 'antigravity' }, config: {} },
    'config harness (legacy)': { env: {}, envVars: {}, config: { harness: 'antigravity' } },
  };
  for (const [label, opts] of Object.entries(paths)) {
    assert.equal(resolvePlatform(opts), 'antigravity', `stated via ${label}`);
  }
});

test('resolvePlatform: AGENT_PLATFORMS names the supported platforms, claude first (#1125)', () => {
  assert.deepEqual([...AGENT_PLATFORMS], ['claude', 'antigravity', 'plain']);
  for (const p of AGENT_PLATFORMS) {
    assert.equal(resolvePlatform({ env: {}, envVars: { SDD_HARNESS: p } }), p, `legacy SDD_HARNESS=${p}`);
  }
});

test('resolveEngine: env SDD_ENGINE wins over envVars', () => {
  const result = resolveEngine({
    env: { SDD_ENGINE: 'plain' },
    envVars: { SDD_ENGINE: 'gentle-ai' },
  });
  assert.equal(result, 'plain');
});

test('resolveEngine: falls back to legacy SDD_HARNESS when engine absent', () => {
  const result = resolveEngine({
    env: {},
    envVars: { SDD_HARNESS: 'plain' },
  });
  assert.equal(result, 'plain');
});

test('resolveEngine: nothing stated is REFUSED with the fix named, never gentle-ai (#1114 S2)', () => {
  assert.throws(() => resolveEngine({ env: {}, envVars: {} }), (e) => e instanceof AxisRefusal && e.code === 'undeclared' && /brain:config -- set sdd\.default <gentle-ai\|plain>/.test(e.message));
});

// ── #312 D2 supporting change: SDD_ENGINES is ONE declaration, cli.mjs is a reader ──
//
// `resolveEngine` used to hold the engine-axis membership as an inline
// literal `['gentle-ai', 'plain']`. Extracted to `harness/platform.mjs` as
// `SDD_ENGINES` so `axes/sdd-engine/role-port.mjs`'s registry assertion (and any future
// second reader) shares the same one declaration — `CLI_OPS`-from-`OPS`
// (`:136-145` above) and `IMPLEMENTED_AXES`-from-`RUNNERS`
// (`resolve-challenger.mjs:64-74`) are the house pattern this mirrors.
// `resolveEngine`'s OWN behavior must not move a single inch: this is a
// refactor of WHERE the membership is declared, never of WHAT it resolves to.

test('#312 D2: SDD_ENGINES is exported from platform.mjs and holds exactly the two known engines', () => {
  assert.deepEqual([...SDD_ENGINES].sort(), ['gentle-ai', 'plain']);
});

test('#312 D2: resolveEngine via SDD_HARNESS is unchanged — every SDD_ENGINES member still resolves, in that role, and nothing outside it does', () => {
  for (const engine of SDD_ENGINES) {
    const result = resolveEngine({ env: {}, envVars: { SDD_HARNESS: engine } });
    assert.equal(result, engine, `${engine} must still resolve via the legacy SDD_HARNESS fallback`);
  }
  refusal(() => resolveEngine({ env: {}, envVars: { SDD_HARNESS: 'not-a-real-engine' } }));
});

test('#312 D2: cli.mjs holds no inline engine-membership literal of its own — SDD_ENGINES is the one declaration', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(
    src, /\[\s*['"]gentle-ai['"]\s*,\s*['"]plain['"]\s*\]/,
    'cli.mjs must read SDD_ENGINES from platform.mjs, not hold its own copy of the engine-axis membership',
  );
});

// ── (b) resolveHarness: .env value used when env var absent ──────────────────

test('resolveHarness: envVars used when env var absent', () => {
  const result = resolveHarness({ env: {}, envVars: { SDD_HARNESS: 'plain' } });
  assert.equal(result, 'plain');
});

// ── (c) resolveHarness: defaults to gentle-ai ────────────────────────────────

test('resolveHarness: both absent is REFUSED (the gentle-ai default is retired, #1114 S2)', () => {
  refusal(() => resolveHarness({ env: {}, envVars: {} }));
  refusal(() => resolveHarness({ env: {} }));
});

// ── (d) dispatch: calls init on the resolved backend ─────────────────────────

test('dispatch: calls init on the resolved backend', async () => {
  const calls = [];
  const fakeBackendLoader = async () => ({
    init: async () => { calls.push('init'); },
  });
  await dispatch('gentle-ai', 'init', [], { backendLoader: fakeBackendLoader });
  assert.deepEqual(calls, ['init']);
});

test('dispatch: forwards extra args to the backend function', async () => {
  const received = [];
  const fakeBackendLoader = async () => ({
    init: async (...args) => { received.push(...args); },
  });
  await dispatch('gentle-ai', 'init', ['extra-arg'], { backendLoader: fakeBackendLoader });
  assert.deepEqual(received, ['extra-arg']);
});

// ── (e) dispatch: unknown harness → error ────────────────────────────────────

test('dispatch: unknown harness (backend not found) → rejects with clear message', async () => {
  const failLoader = async (harness) => {
    throw new Error(`Cannot find module ./backends/${harness}.mjs`);
  };
  await assert.rejects(
    dispatch('nonexistent', 'init', [], { backendLoader: failLoader }),
    /nonexistent/,
  );
});

// ── (f) dispatch: unknown op → error ─────────────────────────────────────────

test('dispatch: unknown op → rejects with clear message', async () => {
  await assert.rejects(
    dispatch('gentle-ai', 'foo', [], { backendLoader: async () => ({}) }),
    /unknown op 'foo'/,
  );
});

// ── (g) dispatch: backend missing the op → error ─────────────────────────────

test('dispatch: backend missing init export → rejects with clear message', async () => {
  const emptyBackend = async () => ({});   // no 'init' exported
  await assert.rejects(
    dispatch('gentle-ai', 'init', [], { backendLoader: emptyBackend }),
    /does not implement op 'init'/,
  );
});

// ── VALID_OPS export ──────────────────────────────────────────────────────────

test('VALID_OPS includes init', () => {
  assert.ok(Array.isArray(VALID_OPS));
  assert.ok(VALID_OPS.includes('init'));
});

// ── #682 C.5 round 2, judgment:cold-1 — the module GRAPH, not the dispatch ────
//
// A backend importing this dispatcher closes a cycle through its own top-level
// await, and the graph never settles: `AGENT_PLATFORM=claude node cli.mjs init`
// exited 13 with `Detected unsettled top-level await` and wrote nothing, on the
// path `bootstrap.sh` runs.
//
// NO TEST IN THIS FILE COULD HAVE SEEN IT, and the reason is structural rather
// than an oversight: every `dispatch` test above injects `backendLoader`, so the
// REAL dynamic import never happens, and the cycle only exists in the real one.
// Faking the loader is right for testing dispatch — it just means dispatch tests
// say nothing about the module graph, which is a second property needing a
// second oracle.
//
// This one reads the graph directly, which is cheap, deterministic, and needs no
// child process: no module a backend can reach may import the dispatcher. That
// is the invariant; the deadlock was one instance of breaking it.

test('#682 cold-1: no backend reaches the dispatcher — the cycle that deadlocked bootstrap', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const { HARNESS_ADAPTER_AXES, harnessAdapterDir } = await import('../axes/lib/harness-adapter-url.mjs');

  const here = dirname(fileURLToPath(import.meta.url));
  // The old `backends/` directory, split by axis in #1141.
  const backendsDirs = HARNESS_ADAPTER_AXES.map((axis) => fileURLToPath(harnessAdapterDir(axis)));

  // Walk the STATIC import graph of every backend, following relative edges.
  const seen = new Set();
  const offenders = [];

  const visit = (file, chain) => {
    if (seen.has(file)) return;
    seen.add(file);
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { return; }
    for (const m of src.matchAll(/^\s*import\s[^'"]*from\s+['"](\.[^'"]+)['"]/gm)) {
      const target = join(dirname(file), m[1]);
      if (/harness[/\\]cli\.mjs$/.test(target)) {
        offenders.push(`${[...chain, file, target].map((f) => f.replace(here, '')).join(' → ')}`);
        continue;
      }
      visit(target, [...chain, file]);
    }
  };

  const backends = backendsDirs.flatMap((dir) => readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && !f.includes('.test.'))
    .map((f) => join(dir, f)));
  assert.ok(backends.length >= 3, 'the backends directory must still hold backends — otherwise this test is vacuous');

  for (const b of backends) visit(b, []);

  assert.deepEqual(
    offenders, [],
    'a backend reaches harness/cli.mjs through its static imports. cli.mjs dispatches to backends from ' +
    'inside a top-level await, so that edge is a cycle re-entered through a suspended module and the ' +
    'graph never settles — `node cli.mjs init` exits 13 and writes nothing. Anything a backend needs ' +
    'from the dispatcher is not dispatch logic: put it in a leaf, like platform.mjs.'
  );
});

// ── #1128: `node harness/cli.mjs init` reports a platform's refusal, on a scratch consumer ──
//
// The adapters resolve the repo root from their own location, and the CLI cannot be handed a
// root, so the scratch consumer is a COPY of brain/scripts (tests excluded) under a temp root.
// Child I/O goes through files and the process is bounded: a pipe can hang a sandboxed child.

const SCRIPTS_SRC = joinPath(fileURLToPath(new URL('.', import.meta.url)), '..');
let consumer;

before(() => {
  consumer = mkdtempSync(joinPath(tmpdir(), 'cli-init-consumer-'));
  cpSync(SCRIPTS_SRC, joinPath(consumer, 'brain', 'scripts'), { recursive: true, filter: (src) => !/\.test\.mjs$/.test(src) });
  // The same data files `init` reads (SOURCE_DOCS), so antigravity has real input.
  cpSync(joinPath(SCRIPTS_SRC, '..', 'HOME.md'), joinPath(consumer, 'brain', 'HOME.md'));
  cpSync(joinPath(SCRIPTS_SRC, '..', 'core'), joinPath(consumer, 'brain', 'core'), { recursive: true });
  writeFileSync(joinPath(consumer, 'brain.config.json'), JSON.stringify({
    platform: { default: 'claude', providers: { claude: {}, antigravity: {} } },
    sdd: { default: 'plain', providers: { plain: {} } },
  }));
});
after(() => { if (consumer) rmSync(consumer, { recursive: true, force: true }); });

function cliInit(platform) {
  const out = joinPath(consumer, 'cli.out');
  const err = joinPath(consumer, 'cli.err');
  const r = spawnSync('/bin/bash', ['-c', `"${process.execPath}" brain/scripts/harness/cli.mjs init > "${out}" 2> "${err}" < /dev/null; echo $?`], {
    cwd: consumer, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, AGENT_PLATFORM: platform, SDD_ENGINE: 'plain' },
  });
  return { status: Number(r.stdout.trim()), out: readFileSync(out, 'utf8'), err: readFileSync(err, 'utf8') };
}

test('#1128: antigravity with a malformed .gemini/settings.json exits 1, names the file and leaves it byte-identical', () => {
  mkdirSync(joinPath(consumer, '.gemini'), { recursive: true });
  const file = joinPath(consumer, '.gemini', 'settings.json');
  writeFileSync(file, '{ not json at all');
  const r = cliInit('antigravity');
  assert.equal(r.status, 1, r.err);
  assert.match(r.err, /\.gemini\/settings\.json/);
  assert.equal(readFileSync(file, 'utf8'), '{ not json at all');
  rmSync(file);
});

test('#1128: claude init exits 0 and writes .claude/settings.json (#682 holds with the registry)', () => {
  const r = cliInit('claude');
  assert.equal(r.status, 0, r.err);
  assert.ok(existsSync(joinPath(consumer, '.claude', 'settings.json')));
  mkdirSync(joinPath(consumer, '.claude'), { recursive: true });
  writeFileSync(joinPath(consumer, '.claude', 'settings.json'), '{ nope');
  const bad = cliInit('claude');
  assert.equal(bad.status, 1, bad.err);
  assert.equal(readFileSync(joinPath(consumer, '.claude', 'settings.json'), 'utf8'), '{ nope');
});
