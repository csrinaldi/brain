// cli.save-search.test.mjs — CLI-level tests for the net-new `save`/`search`
// verbs (C3, issue #246, REQ-C3-1). Mirrors cli.migrate-v1.test.mjs's
// test-only root-redirect idiom: cli.mjs resolves `.memory/` from its own
// file location, not `cwd`, so these tests redirect via BRAIN_MEMORY_TEST_ROOT
// (a test-only seam, see cli.mjs) — every invocation here points at a fresh
// temp dir, NEVER the real `.memory/`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

function runCli(args, { backend = 'plainfiles', testRoot } = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, MEMORY_BACKEND: backend, ...(testRoot ? { BRAIN_MEMORY_TEST_ROOT: testRoot } : {}) },
  });
}

// ── save dispatches to plainfiles.mjs#save with parsed flags + positionals ──

test('MEMORY_BACKEND=plainfiles + memory save <title> <content> --type ... dispatches to plainfiles save and writes a record', () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'brain-cli-save-'));
  const result = runCli(
    ['save', 'A title', 'The body', '--type', 'discovery', '--project', 'brain', '--scope', 'project', '--topic', 'x/y'],
    { testRoot },
  );

  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const recordsDir = join(testRoot, '.memory', 'records');
  assert.ok(existsSync(recordsDir), 'records/ must be written');
  const files = readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl'));
  assert.equal(files.length, 1);
  const raw = readFileSync(join(recordsDir, files[0]), 'utf8').trim();
  const record = JSON.parse(raw);
  assert.equal(record.type, 'discovery');
  assert.equal(record.project, 'brain');
  assert.ok(record.content.includes('A title'));
  assert.ok(record.content.includes('The body'));
  // NO --actor/--actor-kind/--ts flag is recognized anywhere in the parser.
  assert.equal(record.actorKind, 'agent');
});

test('memory save recognizes NO --actor/--actor-kind/--ts flag anywhere in the parser', () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'brain-cli-save-noflag-'));
  const result = runCli(
    ['save', 't', 'c', '--type', 'discovery', '--project', 'brain', '--actor', 'spoofed', '--actor-kind', 'human', '--ts', '1999-01-01T00:00:00Z'],
    { testRoot },
  );
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const recordsDir = join(testRoot, '.memory', 'records');
  const files = readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl'));
  const record = JSON.parse(readFileSync(join(recordsDir, files[0]), 'utf8').trim());
  assert.equal(record.actorKind, 'agent', 'a --actor-kind flag must be silently ignored — actorKind is never spoofable');
  assert.notEqual(record.ts, '1999-01-01T00:00:00Z', 'a --ts flag must be silently ignored — ts is always measured');
});

// ── search dispatches to plainfiles.mjs#search ──────────────────────────────

test('MEMORY_BACKEND=plainfiles + memory search <query> dispatches to plainfiles search and finds a prior save', () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'brain-cli-search-'));
  const saveResult = runCli(
    ['save', 'Findable title', 'unique-search-needle-xyz', '--type', 'discovery', '--project', 'brain'],
    { testRoot },
  );
  assert.equal(saveResult.status, 0, `seed save failed: ${saveResult.stderr}`);

  const searchResult = runCli(['search', 'unique-search-needle-xyz'], { testRoot });
  assert.equal(searchResult.status, 0, `expected exit 0, got ${searchResult.status}. stderr: ${searchResult.stderr}`);
  assert.ok(searchResult.stdout.includes('unique-search-needle-xyz') || searchResult.stdout.match(/1 matching record/),
    `expected search output to surface the match: ${searchResult.stdout}`);
});

test('memory search under plainfiles with no match prints an empty-results message and exits 0', () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'brain-cli-search-empty-'));
  const result = runCli(['search', 'nothing-will-match-this-xyz'], { testRoot });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
});
