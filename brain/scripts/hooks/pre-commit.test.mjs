// pre-commit.test.mjs — issue #701 wiring: staged-records-check runs between
// the main/master block and check-refs.mjs. Mirrors pre-push.test.mjs's
// technique: a synthetic PATH with mock node/git shell scripts, no real
// subprocess spawned.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const HOOK_PATH = new URL('./pre-commit', import.meta.url).pathname;

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * @param {object} opts
 * @param {string} opts.callLog
 * @param {string} [opts.branch='feature/x']
 * @param {number} [opts.stagedRecordsCode=0]
 * @param {number} [opts.checkRefsCode=0]
 */
function createMockBin({ callLog, branch = 'feature/x', stagedRecordsCode = 0, checkRefsCode = 0 }) {
  const binDir = makeTempDir('pc-bin-');
  writeFileSync(
    join(binDir, 'node'),
    [
      '#!/usr/bin/env sh',
      // $1 = script path
      'case "$1" in',
      '  *staged-records-check.mjs)',
      `    echo staged-records-check >> "${callLog}"`,
      `    exit ${stagedRecordsCode}`,
      '    ;;',
      '  *check-refs.mjs)',
      `    echo check-refs >> "${callLog}"`,
      `    exit ${checkRefsCode}`,
      '    ;;',
      'esac',
      'exit 0',
    ].join('\n'),
  );
  chmodSync(join(binDir, 'node'), 0o755);

  writeFileSync(
    join(binDir, 'git'),
    [
      '#!/usr/bin/env sh',
      'if [ "$1" = "rev-parse" ] && [ "$2" = "--abbrev-ref" ]; then',
      `  printf '%s\\n' "${branch}"`,
      'elif [ "$1" = "rev-parse" ] && [ "$2" = "--show-toplevel" ]; then',
      '  printf "/fake/repo\\n"',
      'fi',
      'exit 0',
    ].join('\n'),
  );
  chmodSync(join(binDir, 'git'), 0o755);
  return binDir;
}

const SAFE_SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin';

function runHook(binDir) {
  return spawnSync('sh', [HOOK_PATH], {
    env: { PATH: `${binDir}:${SAFE_SYSTEM_PATH}`, HOME: process.env.HOME ?? '/tmp' },
    encoding: 'utf8',
    timeout: 5000,
  });
}

function readCallLog(callLog) {
  if (!existsSync(callLog)) return [];
  return readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean);
}

test('pre-commit: staged-records-check runs BEFORE check-refs, both on a clean branch', (t) => {
  const tmpRoot = makeTempDir('pc-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  const binDir = createMockBin({ callLog });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);
  assert.equal(result.status, 0);
  assert.deepEqual(readCallLog(callLog), ['staged-records-check', 'check-refs']);
});

test('pre-commit: staged-records-check REFUSING blocks the commit and check-refs never runs', (t) => {
  const tmpRoot = makeTempDir('pc-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  const binDir = createMockBin({ callLog, stagedRecordsCode: 1 });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);
  assert.equal(result.status, 1);
  assert.deepEqual(readCallLog(callLog), ['staged-records-check'], 'check-refs must never run once the gate refuses');
});

test('pre-commit: a direct commit to main is blocked before either check runs', (t) => {
  const tmpRoot = makeTempDir('pc-root-');
  const callLog = join(tmpRoot, 'calls.log');
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  const binDir = createMockBin({ callLog, branch: 'main' });
  t.after(() => rmSync(binDir, { recursive: true, force: true }));

  const result = runHook(binDir);
  assert.equal(result.status, 1);
  assert.deepEqual(readCallLog(callLog), [], 'the main/master block precedes both checks');
});
