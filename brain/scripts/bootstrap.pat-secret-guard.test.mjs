// bootstrap.pat-secret-guard.test.mjs — issue #1112, cold-review finding
// (blocker 2): `env:init` must FAIL CLOSED before writing the operator's PAT
// into `.env`.
//
// `ensure_env_gitignored` (finding 1) reports a warning when it cannot
// confirm `.env` is git-ignored, but a warning does not stop the PAT write
// that follows a few lines later — bootstrap.sh kept going and wrote the
// token into `.env` regardless. The specific, measured way this happens:
// `git check-ignore` NEVER reports a path as ignored once it is TRACKED,
// no matter which pattern in `.gitignore` matches it (a previous — buggy or
// manual — run already committed `.env`). A `.gitignore` fix cannot protect
// a secret about to be written into a file git's index already has.
//
// The fix adds a single gate — `ENV_SECRET_SAFE`/`ENV_SECRET_UNSAFE_REASON`
// — computed once, read by the one place `.env` gets a new secret written
// into it. Two fragments, lifted verbatim out of bootstrap.sh (#340):
//   - `env-secret-safe-gate`: computes the two variables from real repo state.
//   - `pat-write-gate`: the write decision itself, given those two variables
//     and a candidate token.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { removeTempTree } from './__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BOOTSTRAP = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.sh');
const LINES = readFileSync(BOOTSTRAP, 'utf8').split('\n');

function fragment(beginMarker, endMarker) {
  const start = LINES.findIndex((l) => l.includes(beginMarker));
  assert.ok(start >= 0, `bootstrap.sh must have a ${beginMarker} marker`);
  const end = LINES.findIndex((l, i) => i > start && l.includes(endMarker));
  assert.ok(end > start, `bootstrap.sh must have a matching ${endMarker} marker`);
  return LINES.slice(start + 1, end).join('\n');
}

const SAFE_GATE = fragment('BEGIN env-secret-safe-gate', 'END env-secret-safe-gate');
const WRITE_GATE = fragment('BEGIN pat-write-gate', 'END pat-write-gate');

function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1112-patguard-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'test']);
    return fn(dir);
  } finally {
    removeTempTree(dir);
  }
}

function runSafeGate(dir) {
  const script = ['set -euo pipefail', `cd "${dir}"`, SAFE_GATE, 'printf \'%s|%s\' "$ENV_SECRET_SAFE" "$ENV_SECRET_UNSAFE_REASON"'].join('\n');
  return spawnSync('bash', ['-c', script], { encoding: 'utf8' });
}

// ── env-secret-safe-gate: reads real repo state ─────────────────────────────

test('#1112 safe-gate: .env is TRACKED — unsafe, reason=tracked, regardless of a matching .gitignore', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.env'), 'VCS_TOKEN=already-here\n');
    execFileSync('git', ['-C', dir, 'add', '.env']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'oops: committed .env']);
    writeFileSync(join(dir, '.gitignore'), '.env\n'); // present, but tracked wins anyway
    const result = runSafeGate(dir);
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.equal(result.stdout, 'false|tracked');
  });
});

test('#1112 safe-gate: .env untracked and .gitignore covers it — safe', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.gitignore'), '.env\n');
    const result = runSafeGate(dir);
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.equal(result.stdout, 'true|');
  });
});

test('#1112 safe-gate: .env untracked but NOT covered by any .gitignore pattern — unsafe, reason=ignoreFailed', () => {
  withRepo((dir) => {
    // No .gitignore at all — the repair step (ensure_env_gitignored) either
    // never ran or could not fix it; the gate only reads the resulting state.
    const result = runSafeGate(dir);
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.equal(result.stdout, 'false|ignoreFailed');
  });
});

// ── pat-write-gate: the actual write decision ───────────────────────────────

function runWriteGate(dir, { envSecretSafe, envSecretUnsafeReason = '', patValue }) {
  const script = [
    'set -euo pipefail',
    `cd "${dir}"`,
    'env_set() { touch .env; printf \'%s=%s\\n\' "$1" "$2" >> .env; }',
    'ok()   { printf "OK:%s\\n" "$1"; }',
    'warn() { printf "WARN:%s\\n" "$1"; }',
    'VCS_TOKEN_VAR=VCS_TOKEN',
    `VCS_TOKEN="${patValue}"`,
    `ENV_SECRET_SAFE=${envSecretSafe}`,
    `ENV_SECRET_UNSAFE_REASON=${envSecretUnsafeReason}`,
    'I18N_BOOTSTRAP_PAT_SKIPPED=skipped',
    'I18N_BOOTSTRAP_PAT_SAVED="%s saved"',
    'I18N_BOOTSTRAP_PAT_TRACKEDREFUSED="%s NOT written — .env is already tracked by git. Untrack it first: git rm --cached .env, then re-run env:init."',
    'I18N_BOOTSTRAP_PAT_GITIGNOREREFUSED="%s NOT written — could not confirm .env is git-ignored. Fix .gitignore, then re-run env:init."',
    WRITE_GATE,
  ].join('\n');
  return spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8' });
}

test('#1112 write-gate: .env TRACKED — the token is NOT written, and the message names git rm --cached', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, '.env'), 'VCS_TOKEN=old\n');
    execFileSync('git', ['-C', dir, 'add', '.env']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'oops: committed .env']);
    const before = readFileSync(join(dir, '.env'), 'utf8');

    const result = runWriteGate(dir, { envSecretSafe: 'false', envSecretUnsafeReason: 'tracked', patValue: 'CANDIDATE_PAT_VALUE_NOT_REAL_00000000' });
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.equal(readFileSync(join(dir, '.env'), 'utf8'), before, '.env must be byte-identical — no new token written');
    assert.doesNotMatch(result.stdout, /CANDIDATE_PAT_VALUE_NOT_REAL_00000000/, 'the pasted token must never appear written anywhere');
    assert.match(result.stdout, /git rm --cached/, 'the message must name the real fix');
  });
});

test('#1112 write-gate: the ignore check failing for another reason — the token is NOT written', () => {
  withRepo((dir) => {
    const result = runWriteGate(dir, { envSecretSafe: 'false', envSecretUnsafeReason: 'ignoreFailed', patValue: 'CANDIDATE_PAT_VALUE_NOT_REAL_00000000' });
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.ok(!existsSync(join(dir, '.env')), '.env must never be created by the write gate when unsafe');
    assert.doesNotMatch(result.stdout, /CANDIDATE_PAT_VALUE_NOT_REAL_00000000/);
    assert.match(result.stdout, /WARN:/);
  });
});

test('#1112 write-gate: safe — the token IS written (no regression)', () => {
  withRepo((dir) => {
    const result = runWriteGate(dir, { envSecretSafe: 'true', patValue: 'CANDIDATE_PAT_VALUE_NOT_REAL_00000000' });
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.match(readFileSync(join(dir, '.env'), 'utf8'), /VCS_TOKEN=CANDIDATE_PAT_VALUE_NOT_REAL_00000000/);
  });
});

test('#1112 write-gate: an empty token is still just "skipped" (pre-existing behavior, unchanged)', () => {
  withRepo((dir) => {
    const result = runWriteGate(dir, { envSecretSafe: 'true', patValue: '' });
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.ok(!existsSync(join(dir, '.env')));
    assert.match(result.stdout, /WARN:skipped/);
  });
});
