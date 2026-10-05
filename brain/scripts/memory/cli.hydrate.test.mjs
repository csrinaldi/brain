// cli.hydrate.test.mjs — the dispatcher's `hydrate` op and its deprecated `import` alias (#1115, #1189).
//
// Drives the REAL cli.mjs in a child process and asserts on what it emits and its exit status:
// the defect was a refusal ("backend 'plainfiles' does not implement op 'import'") printed by
// the dispatcher itself, which no adapter unit test can reach.
//
// Hermetic: PATH is replaced by a dir holding only `which` (so engram is absent by measurement),
// the backend is declared through a temp `.env`, and BRAIN_MEMORY_TEST_ROOT points the rooted ops
// at a fixture. Every spawn carries a timeout and an ignored stdin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRecord, serializeRecord } from './lib/format.mjs';
import { FALLBACK_OPS } from './lib/backend-selection.mjs';
import { EXIT_DEFERRED } from './lib/backend-resolve.mjs';
import { removeTempTree } from '../lib/tmp-tree.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');
const REAL_WHICH = execFileSync('sh', ['-c', 'command -v which'], { encoding: 'utf8' }).trim();
const NOT_IMPLEMENTED = /does not implement op/;

function world(t, { backend = 'plainfiles', records = 1 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brain-1115-'));
  t.after(() => removeTempTree(root));
  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  const lines = [];
  for (let i = 0; i < records; i++) {
    lines.push(serializeRecord(buildRecord({
      ts: '2026-08-14T12:00:00Z', actor: '@test', actorKind: 'human', type: 'decision', project: 'brain',
      content: `hydrate fixture record ${i}`,
    })));
  }
  if (records > 0) writeFileSync(join(recordsDir, '2026-08.jsonl'), lines.join('\n') + '\n', 'utf8');
  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(REAL_WHICH, join(bin, 'which'));
  const envPath = join(root, 'dotenv');
  writeFileSync(envPath, backend ? `MEMORY_BACKEND=${backend}\n` : '', 'utf8');
  return { root, bin, envPath, indexPath: join(root, '.memory', 'index.jsonl') };
}

function run(w, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      HOME: process.env.HOME,
      BRAIN_HOME: process.env.BRAIN_HOME || '/nonexistent/brain-home',
      PATH: w.bin,
      BRAIN_MEMORY_TEST_ROOT: w.root,
      BRAIN_MEMORY_ENV_FILE: w.envPath,
      BRAIN_MEMORY_CONFIG_FILE: join(w.root, 'no-brain-config.json'),
    },
  });
}

test('EXIT_DEFERRED is 6 and FALLBACK_OPS is still exactly ["pull"]', () => {
  assert.equal(EXIT_DEFERRED, 6);
  assert.deepEqual([...FALLBACK_OPS], ['pull']);
});

test('plainfiles: hydrate exits 0, rebuilds the index, and never says "does not implement"', (t) => {
  const w = world(t);
  const r = run(w, ['hydrate']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.doesNotMatch(r.stderr, NOT_IMPLEMENTED);
  assert.equal(readFileSync(w.indexPath, 'utf8').split('\n').filter(Boolean).length, 1);
});

test('plainfiles: `import` is an alias — exit 0, ONE deprecation notice naming hydrate, no refusal', (t) => {
  const w = world(t);
  const r = run(w, ['import']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.doesNotMatch(r.stderr, NOT_IMPLEMENTED);
  assert.equal((r.stderr.match(/'import' is deprecated/g) ?? []).length, 1, 'exactly one notice');
  assert.match(r.stderr, /hydrate/);
  assert.ok(existsSync(w.indexPath), 'the alias dispatches hydrate, which rebuilt the index');
});

test('plainfiles: `hydrate` itself prints no deprecation notice', (t) => {
  const r = run(world(t), ['hydrate']);
  assert.doesNotMatch(r.stderr, /deprecated/);
});

test('plainfiles `hydrate --verify` on a missing index: exit 0, reports stale on stdout, writes NOTHING', (t) => {
  const w = world(t, { records: 2 });
  const r = run(w, ['hydrate', '--verify']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim().split('\n').pop()), { hydrate: 'verified', stale: true, indexCount: 2 });
  assert.match(r.stderr, /stale/);
  assert.equal(existsSync(w.indexPath), false, 'verify must not create the index');
});

test('plainfiles `hydrate --verify` on a canonical index reports stale:false and leaves it byte-identical', (t) => {
  const w = world(t, { records: 2 });
  assert.equal(run(w, ['hydrate']).status, 0);
  const before = readFileSync(w.indexPath, 'utf8');
  const r = run(w, ['hydrate', '--verify']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).stale, false);
  assert.doesNotMatch(r.stderr, /stale/);
  assert.equal(readFileSync(w.indexPath, 'utf8'), before);
});

test('`hydrate` with an unknown argument refuses (exit 1) instead of forwarding it', (t) => {
  const r = run(world(t), ['hydrate', '--bogus']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--bogus/);
});

test('engram declared, binary absent: hydrate DEFERS — exit 6, names gentle-ai install, no plainfiles, no substitution', (t) => {
  const w = world(t, { backend: 'engram' });
  const r = run(w, ['hydrate']);
  assert.equal(r.status, EXIT_DEFERRED, `${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /gentle-ai install/);
  assert.match(r.stderr, /deferred/);
  assert.doesNotMatch(r.stderr, /plainfiles/);
  assert.doesNotMatch(r.stderr, NOT_IMPLEMENTED);
});

test('engram declared, binary absent: the `import` alias defers the same way (exit 6) and prints the notice', (t) => {
  const r = run(world(t, { backend: 'engram' }), ['import']);
  assert.equal(r.status, EXIT_DEFERRED);
  assert.match(r.stderr, /'import' is deprecated/);
  assert.match(r.stderr, /gentle-ai install/);
  assert.doesNotMatch(r.stderr, /plainfiles/);
});

test('nothing declared: hydrate and import both refuse with exit 3, naming the fix', (t) => {
  for (const op of ['hydrate', 'import']) {
    const r = run(world(t, { backend: '' }), [op]);
    assert.equal(r.status, 3, `${op}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /memory\.backend/);
  }
});

test('an invalid declaration refuses hydrate and import with exit 4', (t) => {
  for (const op of ['hydrate', 'import']) {
    const r = run(world(t, { backend: 'plainfile' }), [op]);
    assert.equal(r.status, 4, `${op}: ${r.stdout}${r.stderr}`);
  }
});
