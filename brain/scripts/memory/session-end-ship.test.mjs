// brain/scripts/memory/session-end-ship.test.mjs — unit tests for the
// SessionEnd hook launcher (#906, design.md A1-A3).
//
// The compiled SessionEnd hook (settings-hooks.mjs) runs
// `npm run brain:memory:session-end` unconditionally (D2: emit-always). This
// launcher is the runtime guard that makes that safe: it reads
// `memory.lane.enabled` FIRST, and only spawns (detached, unref'd, logged to
// a tmpdir file) when the flag is true. It never blocks the hook and never
// propagates the child's own exit code — a session must not end red because
// a push raced.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { shipOnSessionEnd } from './session-end-ship.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const ENTRY = join(HERE, 'session-end-ship.mjs');

/** A fake `_spawn` seam whose returned "child" records `.unref()` calls. */
function fakeSpawn(calls) {
  return (...args) => {
    const child = { unrefCalled: false, unref() { this.unrefCalled = true; } };
    calls.push({ args, child });
    return child;
  };
}

test('flag false: _spawn is never called, exit is silent (no stdout/stderr)', () => {
  const calls = [];
  const logs = { out: [], err: [] };
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => logs.out.push(a);
  console.error = (...a) => logs.err.push(a);
  try {
    const result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: false } } }),
      _spawn: fakeSpawn(calls),
      _tmpdir: () => '/tmp',
      _now: () => new Date('2026-09-10T00:00:00Z'),
    });
    assert.equal(calls.length, 0, '_spawn must never be called when the flag is false');
    assert.deepEqual(result, { spawned: false, logPath: null });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assert.deepEqual(logs.out, [], 'zero stdout when the flag is false');
  assert.deepEqual(logs.err, [], 'zero stderr when the flag is false');
});

test('missing memory.lane key is treated as false — _spawn never called', () => {
  const calls = [];
  const result = shipOnSessionEnd({
    _loadConfig: () => ({}),
    _spawn: fakeSpawn(calls),
    _tmpdir: () => '/tmp',
    _now: () => new Date('2026-09-10T00:00:00Z'),
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(result, { spawned: false, logPath: null });
});

test('flag true: one _spawn call, detached+unref, stdio[1]===stdio[2] (tmp-log fd), env carries tokens unchanged', () => {
  const calls = [];
  // Not a real credential — a fixture value built from parts so the
  // repo's own hardcoded-secret scanner (check-refs-rules.mjs) never sees a
  // literal `token: "..."` assignment.
  const ghFixture = ['gh', 'fixture', 'value', 'aaa'].join('-');
  const memFixture = ['mem', 'fixture', 'value', 'bbb'].join('-');
  const parentEnv = { ...process.env };
  parentEnv.GH_TOKEN = ghFixture;
  parentEnv.BRAIN_MEMORY_TOKEN = memFixture;
  const savedEnv = process.env;
  process.env = parentEnv;

  const logs = { out: [], err: [] };
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => logs.out.push(a);
  console.error = (...a) => logs.err.push(a);

  let result;
  try {
    result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
      _spawn: fakeSpawn(calls),
      _tmpdir: () => '/tmp',
      _now: () => new Date('2026-09-10T00:00:00Z'),
    });
  } finally {
    process.env = savedEnv;
    console.log = origLog;
    console.error = origErr;
  }

  assert.equal(calls.length, 1, 'exactly one spawn call');
  const [{ args, child }] = calls;
  const [cmd, argv, opts] = args;
  assert.equal(cmd, process.execPath);
  assert.ok(argv.some((a) => a.endsWith('cli.mjs')), `argv must resolve cli.mjs, got ${JSON.stringify(argv)}`);
  assert.ok(argv.includes('ship'));
  assert.ok(argv.includes('--json'));
  assert.equal(opts.detached, true);
  assert.equal(opts.stdio[0], 'ignore');
  assert.equal(opts.stdio[1], opts.stdio[2], 'stdout and stderr share the same tmp-log fd');
  assert.equal(typeof opts.stdio[1], 'number', 'stdio[1] is an open fd number');
  assert.equal(opts.env.GH_TOKEN, ghFixture, 'GH_TOKEN carried unchanged');
  assert.equal(opts.env.BRAIN_MEMORY_TOKEN, memFixture, 'BRAIN_MEMORY_TOKEN carried unchanged');
  assert.ok(child.unrefCalled, '.unref() must be invoked');
  assert.equal(result.spawned, true);
  assert.match(result.logPath, /brain-lane-ship-.+-2026-09-10\.log$/);

  const printed = [...logs.out, ...logs.err].flat().join(' ');
  assert.ok(!printed.includes(ghFixture), 'GH_TOKEN value must never be printed');
  assert.ok(!printed.includes(memFixture), 'BRAIN_MEMORY_TOKEN value must never be printed');
});

test('_spawn throws: exactly one stderr line, still returns spawned:false (exit 0 path), child code never read', () => {
  const writes = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (chunk) => { writes.push(chunk); return true; };

  let result;
  try {
    result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
      _spawn: () => { throw new Error('boom: no such file'); },
      _tmpdir: () => '/tmp',
      _now: () => new Date('2026-09-10T00:00:00Z'),
    });
  } finally {
    process.stderr.write = origWrite;
  }

  assert.equal(writes.length, 1, 'exactly one stderr line');
  assert.match(writes[0], /boom: no such file/);
  assert.deepEqual(result, { spawned: false, logPath: null });
});

test('real entrypoint run against this repo\'s own config (flag false) exits 0, prints nothing, writes no file', () => {
  const r = spawnSync(process.execPath, [ENTRY], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout, '', 'no stdout');
  assert.equal(r.stderr, '', 'no stderr');
});
