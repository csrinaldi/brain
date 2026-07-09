// cli.migrate-v1.test.mjs — CLI-level tests for `memory:migrate-v1` un-refusing
// (REQ-C2B2-1) and the `--rollback` flag (REQ-C2B2-2).
//
// cli.mjs resolves `.memory/` from its own file location (`repoRoot`), not
// from `cwd` — so these tests redirect it via the BRAIN_MIGRATE_V1_TEST_ROOT
// env var (a test-only seam, see cli.mjs). This is the ONLY way this file
// touches the filesystem: every invocation here points at a fresh temp dir,
// NEVER the real `.memory/`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

const baseObs = (overrides = {}) => ({
  id: 1,
  sync_id: 'obs-aaaa1111',
  session_id: 's1',
  type: 'discovery',
  title: 'A title',
  content: 'No provenance prose here.',
  project: 'brain',
  scope: 'project',
  topic_key: 'sdd/x/y',
  revision_count: 1,
  duplicate_count: 0,
  last_seen_at: '2026-07-02 11:45:38',
  created_at: '2026-07-01 01:19:12',
  updated_at: '2026-07-02 11:45:38',
  ...overrides,
});

function tmpFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'brain-cli-migrate-v1-'));
  const chunksDir = join(root, '.memory', 'chunks');
  mkdirSync(chunksDir, { recursive: true });
  return { root, chunksDir };
}

function writeChunk(chunksDir, observations) {
  const payload = { sessions: [], observations, prompts: [] };
  writeFileSync(join(chunksDir, 'chunk1.jsonl.gz'), gzipSync(Buffer.from(JSON.stringify(payload))));
}

function runCli(args, testRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MIGRATE_V1_TEST_ROOT: testRoot },
  });
}

// ── REQ-C2B2-1: the un-refused non-dry-run path runs the real migration ─────

test('migrate-v1 without --dry-run executes runMigration against the fixture root (records written, chunks → legacy/, report persisted, index rebuilt)', () => {
  const { root, chunksDir } = tmpFixtureRoot();
  writeChunk(chunksDir, [baseObs()]);

  const result = runCli(['migrate-v1'], root);

  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const memoryRoot = join(root, '.memory');
  assert.ok(existsSync(join(memoryRoot, 'records', '2026-07.jsonl')), 'records/ must be written');
  assert.ok(existsSync(join(memoryRoot, 'legacy', 'chunk1.jsonl.gz')), 'chunk must be moved to legacy/');
  assert.ok(existsSync(join(memoryRoot, 'legacy', 'migration-rejected.json')), 'the rejection report must be persisted');
  assert.ok(existsSync(join(memoryRoot, 'index.jsonl')), 'the index must be rebuilt');
  assert.ok(!existsSync(join(chunksDir, 'chunk1.jsonl.gz')), 'the chunk must no longer be in chunks/');
});

test('migrate-v1 without --dry-run: the abort-if-populated throw surfaces as a non-zero exit with the message', () => {
  const { root, chunksDir } = tmpFixtureRoot();
  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(recordsDir, '2026-01.jsonl'), '{"id":"already-migrated"}\n');
  writeChunk(chunksDir, [baseObs()]);

  const result = runCli(['migrate-v1'], root);

  assert.notEqual(result.status, 0, 'a populated records/ must abort with a non-zero exit');
  assert.match(result.stderr, /run the cutover runbook/);
});

// ── `--dry-run` stays unchanged (report only, no mutation) ──────────────────

test('migrate-v1 --dry-run is unchanged: prints the report and never mutates the fixture store', () => {
  const { root, chunksDir } = tmpFixtureRoot();
  writeChunk(chunksDir, [baseObs()]);

  const result = runCli(['migrate-v1', '--dry-run'], root);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Dry-run migration report/);
  const memoryRoot = join(root, '.memory');
  assert.ok(!existsSync(join(memoryRoot, 'records')), '--dry-run must never create records/');
  assert.ok(!existsSync(join(memoryRoot, 'legacy')), '--dry-run must never create legacy/');
  assert.ok(existsSync(join(chunksDir, 'chunk1.jsonl.gz')), '--dry-run must never move the chunk');
});

// ── REQ-C2B2-2: `--rollback` restores the pre-cutover state ─────────────────

test('migrate-v1 --rollback restores a migrated fixture (chunks back, records/ gone, index rebuilt)', () => {
  const { root, chunksDir } = tmpFixtureRoot();
  writeChunk(chunksDir, [baseObs()]);

  const migrateResult = runCli(['migrate-v1'], root);
  assert.equal(migrateResult.status, 0, 'sanity: the real migration must succeed first');

  const rollbackResult = runCli(['migrate-v1', '--rollback'], root);

  assert.equal(rollbackResult.status, 0, `expected exit 0, got ${rollbackResult.status}. stderr: ${rollbackResult.stderr}`);
  const memoryRoot = join(root, '.memory');
  assert.ok(existsSync(join(chunksDir, 'chunk1.jsonl.gz')), 'the chunk must be restored to chunks/');
  assert.ok(!existsSync(join(memoryRoot, 'records')), 'records/ must be gone after rollback');
  assert.ok(existsSync(join(memoryRoot, 'index.jsonl')), 'the index must be rebuilt');
});
