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
import {
  writeFileSync, readFileSync, symlinkSync, lstatSync, statSync, existsSync,
} from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { shipOnSessionEnd } from './session-end-ship.mjs';
import { testTmp } from '../lib/test-tmp.mjs';
import { removeTempTree } from '../lib/tmp-tree.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const ENTRY = join(HERE, 'session-end-ship.mjs');

const FIXED_NOW = () => new Date('2026-09-10T00:00:00Z');
const FIXED_DATE = '2026-09-10';

/** The exact filename shipOnSessionEnd computes for `FIXED_NOW()`. */
function fixedLogName() {
  return `brain-lane-ship-${hostname()}-${FIXED_DATE}.log`;
}

/** A fake `_spawn` seam whose returned "child" records `.unref()` calls. */
function fakeSpawn(calls) {
  return (...args) => {
    const child = { unrefCalled: false, unref() { this.unrefCalled = true; } };
    calls.push({ args, child });
    return child;
  };
}

test('flag false: _spawn is never called, exit is silent (no stdout/stderr, incl. process.stderr.write)', (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

  const calls = [];
  const logs = { out: [], err: [] };
  const writes = [];
  const origLog = console.log, origErr = console.error, origWrite = process.stderr.write;
  console.log = (...a) => logs.out.push(a);
  console.error = (...a) => logs.err.push(a);
  process.stderr.write = (chunk) => { writes.push(chunk); return true; };
  try {
    const result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: false } } }),
      _spawn: fakeSpawn(calls),
      _tmpdir: () => dir,
      _now: FIXED_NOW,
    });
    assert.equal(calls.length, 0, '_spawn must never be called when the flag is false');
    assert.deepEqual(result, { spawned: false, logPath: null });
  } finally {
    console.log = origLog;
    console.error = origErr;
    process.stderr.write = origWrite;
  }
  assert.deepEqual(logs.out, [], 'zero stdout when the flag is false');
  assert.deepEqual(logs.err, [], 'zero console.error when the flag is false');
  assert.deepEqual(writes, [], 'zero process.stderr.write when the flag is false');
});

test('missing memory.lane key is treated as false — _spawn never called', (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

  const calls = [];
  const result = shipOnSessionEnd({
    _loadConfig: () => ({}),
    _spawn: fakeSpawn(calls),
    _tmpdir: () => dir,
    _now: FIXED_NOW,
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(result, { spawned: false, logPath: null });
});

test('flag true: one _spawn call, detached+unref, stdio[1]===stdio[2] (tmp-log fd), env carries tokens unchanged, never leaked on ANY output channel', (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

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
  const writes = [];
  const origLog = console.log, origErr = console.error, origWrite = process.stderr.write;
  console.log = (...a) => logs.out.push(a);
  console.error = (...a) => logs.err.push(a);
  // C3 (#906 cold review): the launcher's own error path writes via
  // `process.stderr.write`, not `console.error` — a mutant that leaked the
  // env through `process.stderr.write` directly would pass a check that only
  // captured console.*. Capture the real channel too.
  process.stderr.write = (chunk) => { writes.push(chunk); return true; };

  let result;
  try {
    result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
      _spawn: fakeSpawn(calls),
      _tmpdir: () => dir,
      _now: FIXED_NOW,
    });
  } finally {
    process.env = savedEnv;
    console.log = origLog;
    console.error = origErr;
    process.stderr.write = origWrite;
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

  const printed = [...logs.out, ...logs.err, ...writes].flat().join(' ');
  assert.ok(!printed.includes(ghFixture), 'GH_TOKEN value must never be printed, on any channel');
  assert.ok(!printed.includes(memFixture), 'BRAIN_MEMORY_TOKEN value must never be printed, on any channel');
});

test('flag true, fresh log path: the created file is mode 0600 (POSIX) — C2 (#906 cold review)', { skip: process.platform === 'win32' ? 'POSIX mode bits only' : false }, (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

  const calls = [];
  const result = shipOnSessionEnd({
    _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
    _spawn: fakeSpawn(calls),
    _tmpdir: () => dir,
    _now: FIXED_NOW,
  });

  assert.equal(result.spawned, true);
  assert.equal(calls.length, 1);
  const mode = statSync(result.logPath).mode & 0o777;
  assert.equal(mode, 0o600, `a freshly created log file must be mode 0600, got 0${mode.toString(8)}`);
});

test('flag true, log path is a pre-existing symlink: refused via O_NOFOLLOW — no spawn, one stderr line, exit-0 path, symlink left untouched — C2 (#906 cold review)', (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

  const logPath = join(dir, fixedLogName());
  const elsewhere = join(dir, 'elsewhere-target.txt');
  writeFileSync(elsewhere, 'not the real log', 'utf8');
  // A predictable tmpdir path pre-created as a symlink by another local user
  // is exactly the attack C2 names: a naive `openSync(path, 'a')` follows it
  // and appends the ship op's stderr evidence into whatever file the
  // attacker's symlink names.
  symlinkSync(elsewhere, logPath);

  const calls = [];
  const writes = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (chunk) => { writes.push(chunk); return true; };

  let result;
  try {
    result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
      _spawn: fakeSpawn(calls),
      _tmpdir: () => dir,
      _now: FIXED_NOW,
    });
  } finally {
    process.stderr.write = origWrite;
  }

  assert.equal(calls.length, 0, 'a symlinked log path must be refused before _spawn is ever reached');
  assert.deepEqual(result, { spawned: false, logPath: null });
  assert.equal(writes.length, 1, 'exactly one stderr line on symlink refusal');
  assert.ok(lstatSync(logPath).isSymbolicLink(), 'the symlink itself must be left in place — never followed, never replaced');
  assert.equal(readFileSync(elsewhere, 'utf8'), 'not the real log', 'the symlink target must never be written through');
});

test('_spawn throws: exactly one stderr line, still returns spawned:false (exit 0 path), child code never read', (t) => {
  const dir = testTmp('906-lane-');
  t.after(() => removeTempTree(dir));

  const writes = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (chunk) => { writes.push(chunk); return true; };

  let result;
  try {
    result = shipOnSessionEnd({
      _loadConfig: () => ({ memory: { lane: { enabled: true } } }),
      _spawn: () => { throw new Error('boom: no such file'); },
      _tmpdir: () => dir,
      _now: FIXED_NOW,
    });
  } finally {
    process.stderr.write = origWrite;
  }

  assert.equal(writes.length, 1, 'exactly one stderr line');
  assert.match(writes[0], /boom: no such file/);
  assert.deepEqual(result, { spawned: false, logPath: null });
});

test('real entrypoint run against this repo\'s own config (flag false) exits 0, prints nothing, writes no log file', () => {
  const r = spawnSync(process.execPath, [ENTRY], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout, '', 'no stdout');
  assert.equal(r.stderr, '', 'no stderr');
  // The flag is false in this repo's own tracked config, so the guard
  // returns before ever computing/opening a log path — assert the file this
  // real run WOULD have used (real _tmpdir + real hostname + today's date)
  // does not exist, making the test's title an assertion, not a claim.
  const today = new Date().toISOString().slice(0, 10);
  const realLogPath = join(tmpdir(), `brain-lane-ship-${hostname()}-${today}.log`);
  assert.equal(existsSync(realLogPath), false, 'flag false must never create the real tmp log file');
});
