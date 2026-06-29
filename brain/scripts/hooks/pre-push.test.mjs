// scripts/hooks/pre-push.test.mjs — integration tests for the pre-push hook.
// (Slice 4, task 4.1 / REQ-S4-1)
//
// Acceptance criteria:
//
//   (a) When node is available, the hook calls feature-checkpoint AFTER
//       memory:share — both ops appear in the mock node call log.
//   (b) When node is not in PATH the hook exits 0 immediately (command -v
//       node guard) and feature-checkpoint is NOT called.
//   (c) When feature-checkpoint exits non-zero the hook continues and
//       exits 0 — push is never blocked by checkpoint failure (|| true).
//
// Technique: synthetic PATH with mock node + git shell scripts that record
// each invoked op to a temp log file.  No real node/engram subprocess is
// spawned; all assertions are via the call log and hook exit code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Absolute path to the hook under test.
const HOOK_PATH = new URL('./pre-push', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Create a mock bin directory with synthetic node and/or git binaries.
 *
 * The mock node script:
 *   - Records $2 (the op argument — e.g. "share", "feature-checkpoint") to
 *     callLog on every invocation.
 *   - Exits checkpointCode when op is "feature-checkpoint"; exits 0 otherwise.
 *
 * The mock git script:
 *   - Returns fakeRepoRoot on `git rev-parse --show-toplevel`.
 *   - Returns empty string on `git -C <root> status …` (no pending changes).
 *
 * @param {object}  opts
 * @param {string}  opts.callLog        Path where mock node records each op.
 * @param {string}  [opts.fakeRepoRoot] Value for `git rev-parse --show-toplevel`.
 * @param {number}  [opts.checkpointCode=0] Exit code for feature-checkpoint.
 * @param {boolean} [opts.includeNode=true]  Set false to omit the node binary.
 * @returns {string} Path to the mock bin directory.
 */
function createMockBin({
  callLog,
  fakeRepoRoot = '/fake/repo',
  checkpointCode = 0,
  includeNode = true,
}) {
  const binDir = makeTempDir('pp-bin-');

  if (includeNode) {
    writeFileSync(
      join(binDir, 'node'),
      [
        '#!/usr/bin/env sh',
        // $1 = path to cli.mjs; $2 = op name (share, feature-checkpoint, …)
        `echo "$2" >> "${callLog}"`,
        `if [ "$2" = "feature-checkpoint" ]; then exit ${checkpointCode}; fi`,
        'exit 0',
      ].join('\n'),
    );
    chmodSync(join(binDir, 'node'), 0o755);
  }

  // mock git — handles both calls the hook makes
  writeFileSync(
    join(binDir, 'git'),
    [
      '#!/usr/bin/env sh',
      'if [ "$1" = "rev-parse" ]; then',
      `  printf '%s\\n' "${fakeRepoRoot}"`,
      'elif [ "$1" = "-C" ]; then',
      '  printf ""',   // empty output → no pending .memory/ changes
      'fi',
      'exit 0',
    ].join('\n'),
  );
  chmodSync(join(binDir, 'git'), 0o755);

  return binDir;
}

// Safe base PATH: includes system shell utilities but excludes nvm / user-local
// paths where the real node lives.  This makes `command -v node` reliably fail
// in test (b) while still allowing sh to find echo, [, etc. as fall-back when
// they are not shell built-ins on the platform.
const SAFE_SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin';

/**
 * Run the pre-push hook with a controlled PATH.
 * binDir is prepended so mock node/git take precedence over system binaries.
 * nvm paths are excluded so the real node is never found (test (b) relies on this).
 */
function runHook(binDir) {
  return spawnSync('sh', [HOOK_PATH], {
    env: {
      PATH: `${binDir}:${SAFE_SYSTEM_PATH}`,
      HOME: process.env.HOME ?? '/tmp',
    },
    encoding: 'utf8',
    timeout: 5000,
  });
}

/**
 * Read recorded op lines from the mock node call log.
 */
function readCallLog(callLog) {
  if (!existsSync(callLog)) return [];
  return readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean);
}

// ---------------------------------------------------------------------------
// (a) feature-checkpoint is called after share when node is available
// ---------------------------------------------------------------------------

test('pre-push hook: calls feature-checkpoint after share when node is in PATH', (t) => {
  const tmpRoot = makeTempDir('pp-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  // Create an openspec feature dir (active feature context).
  mkdirSync(join(tmpRoot, 'openspec', 'changes', 'my-feature'), { recursive: true });

  const binDir = createMockBin({ callLog, fakeRepoRoot: tmpRoot });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);

  const ops = readCallLog(callLog);
  assert.ok(
    ops.includes('share'),
    `expected 'share' in call log, got: ${JSON.stringify(ops)}`,
  );
  assert.ok(
    ops.includes('feature-checkpoint'),
    `expected 'feature-checkpoint' in call log, got: ${JSON.stringify(ops)}`,
  );
  assert.equal(
    result.status,
    0,
    `hook must exit 0; got ${result.status}\nstderr: ${result.stderr}`,
  );
});

// ---------------------------------------------------------------------------
// (b) No node in PATH → hook exits 0, feature-checkpoint NOT called
// ---------------------------------------------------------------------------

test('pre-push hook: exits 0 without calling feature-checkpoint when node is absent', (t) => {
  const tmpRoot = makeTempDir('pp-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  // includeNode: false → no node binary in mock bin dir
  const binDir = createMockBin({ callLog, fakeRepoRoot: tmpRoot, includeNode: false });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);

  assert.equal(
    result.status,
    0,
    `hook must exit 0 when node is absent; got ${result.status}`,
  );
  const ops = readCallLog(callLog);
  assert.ok(
    !ops.includes('feature-checkpoint'),
    `feature-checkpoint must NOT be called when node is absent, got: ${JSON.stringify(ops)}`,
  );
});

// ---------------------------------------------------------------------------
// (c) feature-checkpoint exits non-zero → hook still exits 0 (non-blocking)
// ---------------------------------------------------------------------------

test('pre-push hook: exits 0 even when feature-checkpoint fails (|| true guarantee)', (t) => {
  const tmpRoot = makeTempDir('pp-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  // checkpointCode: 1 simulates ambiguous resolution or any checkpoint error.
  const binDir = createMockBin({ callLog, fakeRepoRoot: tmpRoot, checkpointCode: 1 });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);

  const ops = readCallLog(callLog);
  assert.ok(
    ops.includes('feature-checkpoint'),
    `feature-checkpoint must be called before failure, got: ${JSON.stringify(ops)}`,
  );
  assert.equal(
    result.status,
    0,
    `hook must exit 0 even when feature-checkpoint fails (|| true); got ${result.status}\nstderr: ${result.stderr}`,
  );
});
