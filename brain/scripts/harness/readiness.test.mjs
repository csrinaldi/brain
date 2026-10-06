// REQ-1129-6 — readiness is dispatched through the engine's descriptor (#1129).
// The route cases and the CLI cases that used to live in codex-readiness.test.mjs and
// gemini-readiness.test.mjs, now engine-agnostic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveStageRoute, checkRouteReadiness } from './readiness.mjs';

const CLI = fileURLToPath(new URL('./readiness.mjs', import.meta.url));
const routeCfg = (engine, model) => ({ sdd: { map: { 'cold-review': { engine, ...(model === undefined ? {} : { model }) } } } });

test('resolveStageRoute: an unrouted repo names no engine', () => {
  assert.deepEqual(resolveStageRoute({}), { required: false, stage: 'cold-review', engine: null, model: null });
});

test('resolveStageRoute: an engine that declares no readiness probe is not required, and its model passes through', () => {
  assert.deepEqual(resolveStageRoute(routeCfg('claude', 'sonnet')), { required: false, stage: 'cold-review', engine: 'claude', model: 'sonnet' });
  assert.deepEqual(resolveStageRoute(routeCfg('no-such-engine', 'x')), { required: false, stage: 'cold-review', engine: 'no-such-engine', model: 'x' });
});

test('resolveStageRoute: a pinned policy is enforced for any engine that declares it', () => {
  assert.deepEqual(resolveStageRoute(routeCfg('codex', 'gpt-5.5')), {
    required: true, stage: 'cold-review', engine: 'codex', model: 'gpt-5.5', identity: 'cold-review:codex/gpt-5.5',
  });
  for (const model of ['gpt-5.4', undefined]) {
    assert.throws(() => resolveStageRoute(routeCfg('codex', model)), /requires model gpt-5\.5 for codex; received (gpt-5\.4|none)/);
  }
  assert.throws(() => resolveStageRoute({ sdd: { map: { 'cold-review': { model: 'gpt-5.5' } } } }), /engine/);
});

test('resolveStageRoute: a default policy fills an absent model and keeps a given one', () => {
  assert.equal(resolveStageRoute(routeCfg('gemini')).model, 'gemini-2.5-pro');
  assert.equal(resolveStageRoute(routeCfg('gemini')).identity, 'cold-review:gemini/gemini-2.5-pro');
  const r = resolveStageRoute(routeCfg('gemini', 'gemini-3.1-pro-high'));
  assert.equal(r.required, true);
  assert.equal(r.identity, 'cold-review:gemini/gemini-3.1-pro-high');
});

test('resolveStageRoute: reads the injected registry', () => {
  const registry = { descriptor: (n) => (n === 'zed' ? { name: 'zed', readiness: true, stage: { model: { policy: 'opaque' } } } : null) };
  assert.equal(resolveStageRoute(routeCfg('zed', 'm'), { registry }).required, true);
  assert.equal(resolveStageRoute(routeCfg('claude', 'm'), { registry }).required, false);
});

test('checkRouteReadiness: a route without a probe never spawns and says so', async () => {
  const boom = () => { throw new Error('must not be called'); };
  for (const engine of ['claude', null]) {
    const route = resolveStageRoute(engine ? routeCfg(engine, 'sonnet') : {});
    const result = await checkRouteReadiness(route, { seams: { commandExists: boom, run: boom } });
    assert.deepEqual(result, { ready: true, required: false, diagnostic: `cold-review is routed to ${engine ?? 'no engine'}; it declares no readiness probe` });
  }
});

test('checkRouteReadiness: a gemini route with nothing installed is NOT ready', async () => {
  const result = await checkRouteReadiness(resolveStageRoute(routeCfg('gemini')), { seams: { commandExists: () => false, env: {} } });
  assert.equal(result.ready, false);
  assert.equal(result.required, true);
  assert.match(result.diagnostic, /neither agy.*nor gemini/i);
});

test('checkRouteReadiness: a codex route reaches the codex probe with the injected seams', async () => {
  const result = await checkRouteReadiness(resolveStageRoute(routeCfg('codex', 'gpt-5.5')), {
    seams: { commandExists: () => true, run: (_b, args) => (args[0] === '--version' ? { status: 0, stdout: 'codex-cli 0.154.0' } : { status: 0, stdout: 'Logged in' }) },
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /cold-review:codex\/gpt-5\.5/);
});

test('checkRouteReadiness: a required route whose leaf is missing is refused loudly', async () => {
  await assert.rejects(
    checkRouteReadiness({ required: true, engine: 'zed' }, { load: async () => { throw new Error('no readiness leaf'); } }),
    /no readiness leaf/,
  );
});

function cli(args, config) {
  const dir = mkdtempSync(join(tmpdir(), 'readiness-cli-'));
  try {
    if (config !== undefined) writeFileSync(join(dir, 'brain.config.json'), JSON.stringify(config));
    // A PATH holding ONLY node: the box running the suite may have agy, gemini or codex installed.
    mkdirSync(join(dir, 'bin'));
    symlinkSync(process.execPath, join(dir, 'bin', 'node'));
    const stdoutFile = join(dir, 'out.txt');
    const r = spawnSync('/bin/bash', ['-c', `"${join(dir, 'bin', 'node')}" "${CLI}" ${args} > "${stdoutFile}" 2> "${dir}/err.txt" < /dev/null; echo $?`], { cwd: dir, encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: join(dir, 'bin') } });
    const read = (f) => readFileSync(f, 'utf8');
    return { status: Number(r.stdout.trim()), out: read(stdoutFile), err: read(join(dir, 'err.txt')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI: --required and --engine answer from the route; a missing config is "no engine"', () => {
  assert.deepEqual(cli('--required', routeCfg('claude', 'sonnet')), { status: 0, out: 'no\n', err: '' });
  assert.equal(cli('--engine', routeCfg('claude', 'sonnet')).out, 'claude\n');
  assert.equal(cli('--required', routeCfg('gemini')).out, 'yes\n');
  const none = cli('--check');
  assert.equal(none.status, 0);
  assert.match(none.out, /no engine; it declares no readiness probe/);
  assert.equal(cli('--engine').out, '\n');
});

test('CLI: --check exits 1 on a required engine that is not ready, 0 when no probe is declared', () => {
  const g = cli('--check', routeCfg('gemini'));
  assert.equal(g.status, 1);
  assert.match(g.out, /neither agy.*nor gemini/i);
  assert.equal(cli('--check', routeCfg('claude', 'sonnet')).status, 0);
});

test('CLI: a pin mismatch and an unknown mode fail with a named error', () => {
  const pin = cli('--check', routeCfg('codex', 'gpt-4'));
  assert.equal(pin.status, 1);
  assert.match(pin.err, /requires model gpt-5\.5/);
  const mode = cli('--bogus', routeCfg('claude', 'm'));
  assert.equal(mode.status, 1);
  assert.match(mode.err, /unknown readiness mode/);
});
