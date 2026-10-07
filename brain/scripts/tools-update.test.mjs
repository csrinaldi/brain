// tools-update.test.mjs — #1386: `brain:tools:update` is the ONLY verb that applies
// global tool updates; it refuses under CI or without a TTY. Every spawn is a recorded
// fake — no real `gentle-ai` is ever executed here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runToolsUpdate } from './tools-update.mjs';
import { MANAGED_SCRIPT_KEYS } from '../core/managed-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function harness({ env = {}, isTTY = true, statuses = {} } = {}) {
  const calls = [];
  const lines = [];
  const spawn = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    return { status: statuses[args[0]] ?? 0 };
  };
  const io = { log: (m) => lines.push(m), err: (m) => lines.push(m) };
  return { calls, lines, run: () => runToolsUpdate({ spawn, env, isTTY, ...io }) };
}

test('interactive, no CI: probes, then runs `gentle-ai update` before `gentle-ai upgrade`', async () => {
  const h = harness();
  const r = await h.run();
  assert.equal(r.exitCode, 0);
  assert.deepEqual(h.calls, ['gentle-ai --version', 'gentle-ai update', 'gentle-ai upgrade']);
});

test('CI refuses: exit non-zero, nothing spawned, message names CI and interactive use', async () => {
  const h = harness({ env: { CI: 'true' } });
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.deepEqual(h.calls, []);
  assert.match(h.lines.join('\n'), /CI/);
  assert.match(h.lines.join('\n'), /interactive/i);
});

test('CI=1 refuses even with a TTY; CI=false / CI=0 / empty do not count as CI', async () => {
  assert.notEqual((await harness({ env: { CI: '1' } }).run()).exitCode, 0);
  for (const v of ['false', '0', '']) {
    const h = harness({ env: { CI: v } });
    assert.equal((await h.run()).exitCode, 0, `CI=${JSON.stringify(v)}`);
  }
});

test('no TTY refuses: exit non-zero, nothing spawned, message names the missing terminal', async () => {
  const h = harness({ isTTY: false });
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.deepEqual(h.calls, []);
  assert.match(h.lines.join('\n'), /terminal|TTY/i);
  assert.match(h.lines.join('\n'), /interactive/i);
});

test('gentle-ai missing: exit non-zero, no update/upgrade attempted', async () => {
  const h = harness({ statuses: { '--version': 1 } });
  const r = await h.run();
  assert.notEqual(r.exitCode, 0);
  assert.deepEqual(h.calls, ['gentle-ai --version']);
});

test('a failing `update` stops the verb: upgrade is never run', async () => {
  const h = harness({ statuses: { update: 3 } });
  const r = await h.run();
  assert.equal(r.exitCode, 3);
  assert.deepEqual(h.calls, ['gentle-ai --version', 'gentle-ai update']);
});

test('an upgrade failure is the verb exit status', async () => {
  const r = await harness({ statuses: { upgrade: 5 } }).run();
  assert.equal(r.exitCode, 5);
});

test('CLI entry under CI and under a piped stdin: refuses and never reaches a gentle-ai on PATH', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tools-update-'));
  const marker = join(dir, 'called');
  const fake = join(dir, 'gentle-ai');
  writeFileSync(fake, `#!/bin/sh\necho "$@" >> "${marker}"\n`);
  chmodSync(fake, 0o755);
  const node = process.execPath;
  const bin = join(dir, 'bin');
  const script = join(ROOT, 'brain/scripts/tools-update.mjs');
  for (const env of [{ CI: '1' }, {}]) {
    const r = spawnSync(node, [script], {
      encoding: 'utf8', input: '',
      env: { PATH: `${dir}`, HOME: dir, ...env },
    });
    assert.notEqual(r.status, 0, JSON.stringify(env));
    assert.match(r.stdout + r.stderr, /interactive/i);
  }
  assert.equal(existsSync(marker), false, 'the fake gentle-ai must never be invoked');
  void bin; void readFileSync;
});

test('the verb is an npm script and a managed script key (it reaches consumers)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['brain:tools:update'], 'node ./brain/scripts/tools-update.mjs');
  assert.ok(MANAGED_SCRIPT_KEYS.includes('brain:tools:update'));
});

test('a failing probe returns its own status, like every other step (R2)', async () => {
  const r = await harness({ statuses: { '--version': 7 } }).run();
  assert.equal(r.exitCode, 7);
});

test('a probe with no status (the binary is missing, ENOENT) still exits non-zero', async () => {
  const calls = [];
  const spawn = (cmd, args) => { calls.push(args[0]); return { status: null, error: new Error('spawn gentle-ai ENOENT') }; };
  const r = await runToolsUpdate({ spawn, env: {}, isTTY: true, log: () => {}, err: () => {} });
  assert.equal(r.exitCode, 1);
  assert.deepEqual(calls, ['--version']);
});
