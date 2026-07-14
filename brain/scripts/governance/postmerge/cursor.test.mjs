// cursor.test.mjs — remote-authoritative tri-state cursor + atomic CAS
// advance (design §2). Every fixture below is copied verbatim from design
// §7.2's shape column (doctrine #900): B1-B6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { gitTry, gitOrThrow } from './git-seam.mjs';
import {
  CURSOR_REF, syncCursor, readCursor, resolveWindow, advanceCursor, acceptManually,
} from './cursor.mjs';

const CURSOR_SCRIPT = new URL('./cursor.mjs', import.meta.url).pathname;

// ── Fixture helpers (house pattern — brain-audit.test.mjs) ────────────────────

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function realGit(cwd) {
  return { try: (argv) => gitTry(argv, { cwd }), orThrow: (argv) => gitOrThrow(argv, { cwd }) };
}

function headSha(dir) {
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

/**
 * Build a bare "origin" repo with one commit on main, then a plain clone of
 * it (exactly like actions/checkout: fetches refs/heads/* + tags ONLY —
 * never a custom namespace). Returns { originDir, cloneDir, sha }.
 */
function makeBareOriginAndClone(t, { setCursorRef = false } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'cursor-fixture-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const seedDir = join(scratch, 'seed');
  mkdirSync(seedDir);
  const seedGit = makeRepo(seedDir);
  seedGit('commit', '--allow-empty', '-m', 'init');
  const sha = headSha(seedDir);

  const originDir = join(scratch, 'origin.git');
  spawnSync('git', ['clone', '--bare', seedDir, originDir], { encoding: 'utf8' });

  if (setCursorRef) {
    spawnSync('git', ['update-ref', CURSOR_REF, sha], { cwd: originDir, encoding: 'utf8' });
  }

  const cloneDir = join(scratch, 'clone');
  spawnSync('git', ['clone', originDir, cloneDir], { encoding: 'utf8' });

  return { originDir, cloneDir, sha };
}

// ── Phase 1.2 — tri-state read ────────────────────────────────────────────────

test('syncCursor: issues the exact refspec via the injected git seam', () => {
  const calls = [];
  const fakeGit = { try: (argv) => { calls.push(argv); return { status: 0, stdout: '', stderr: '' }; } };
  syncCursor({ git: fakeGit });
  assert.deepEqual(calls, [
    ['fetch', '--prune', 'origin', '+refs/governance/*:refs/governance/*'],
  ]);
});

// B1 — the tautological-test trap, reproduced.
test('readCursor: B1 — cursor ref set on origin, plain clone (fetches heads+tags only) → present, via explicit fetch', (t) => {
  const { cloneDir, sha } = makeBareOriginAndClone(t, { setCursorRef: true });
  const git = realGit(cloneDir);

  // First prove the fixture reproduces the real production shape: a plain
  // clone never fetched refs/governance/*, so the local rev-parse fails.
  const before = git.try(['rev-parse', '--verify', `${CURSOR_REF}^{commit}`]);
  assert.notEqual(before.status, 0, 'fixture sanity: local ref must be unresolved before readCursor runs');

  const result = readCursor({ git });
  assert.deepEqual(result, { state: 'present', sha });
});

// B2 — no cursor ref at all.
test('readCursor: B2 — no cursor ref on origin → absent (ls-remote --exit-code = 2)', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: false });
  const git = realGit(cloneDir);

  const result = readCursor({ git });
  assert.deepEqual(result, { state: 'absent' });
});

// B3 — unreachable origin.
test('readCursor: B3 — unreachable origin → unknown, NEVER absent', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: true });
  const git = realGit(cloneDir);

  spawnSync('git', ['remote', 'set-url', 'origin', join(cloneDir, 'does', 'not', 'exist')], {
    cwd: cloneDir, encoding: 'utf8',
  });

  const result = readCursor({ git });
  assert.equal(result.state, 'unknown');
  assert.notEqual(result.state, 'absent');
});

// Local/remote inconsistency — ls-remote says present, local rev-parse still fails.
test('readCursor: origin reports present but local ref fails to resolve after fetch → unknown, never downgraded to absent', () => {
  const fakeGit = {
    try: (argv) => {
      if (argv[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (argv[0] === 'ls-remote') return { status: 0, stdout: `${'a'.repeat(40)}\trefs/governance/audit-cursor\n`, stderr: '' };
      if (argv[0] === 'rev-parse') return { status: 128, stdout: '', stderr: 'fatal: bad revision' };
      throw new Error(`unexpected git call: ${argv.join(' ')}`);
    },
  };
  const result = readCursor({ git: fakeGit });
  assert.deepEqual(result, { state: 'unknown' });
});

// ── Phase 1.3 — resolveWindow is ALWAYS cursor..HEAD ──────────────────────────

test('resolveWindow: present cursor at C, head H → { present, base: C, range: C..H, head: H }', (t) => {
  const { cloneDir, sha } = makeBareOriginAndClone(t, { setCursorRef: true });
  const git = realGit(cloneDir);
  spawnSync('git', ['commit', '--allow-empty', '-m', 'more'], { cwd: cloneDir, encoding: 'utf8' });
  const head = headSha(cloneDir);

  const result = resolveWindow({ git, head });
  assert.deepEqual(result, { state: 'present', base: sha, range: `${sha}..${head}`, head });
});

// B6 — cursor sha not an ancestor of HEAD (rewritten main).
test('resolveWindow: B6 — cursor is not an ancestor of HEAD → unknown, never a silently enormous window', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: false });
  const git = realGit(cloneDir);

  // Foreign commit unrelated to this repo's history.
  spawnSync('git', ['checkout', '--orphan', 'other'], { cwd: cloneDir, encoding: 'utf8' });
  spawnSync('git', ['commit', '--allow-empty', '-m', 'orphan'], { cwd: cloneDir, encoding: 'utf8' });
  const foreignSha = headSha(cloneDir);
  spawnSync('git', ['update-ref', CURSOR_REF, foreignSha], { cwd: cloneDir, encoding: 'utf8' });
  spawnSync('git', ['checkout', 'main'], { cwd: cloneDir, encoding: 'utf8' });
  spawnSync('git', ['commit', '--allow-empty', '-m', 'main-work'], { cwd: cloneDir, encoding: 'utf8' });
  const head = headSha(cloneDir);

  // Stub readCursor's dependency so this test does not depend on the ref
  // also being fetchable/present on the (bare) origin remote.
  const fakeGit = {
    try: (argv) => {
      if (argv[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (argv[0] === 'ls-remote') return { status: 0, stdout: `${foreignSha}\trefs/governance/audit-cursor\n`, stderr: '' };
      if (argv[0] === 'rev-parse') return { status: 0, stdout: `${foreignSha}\n`, stderr: '' };
      return git.try(argv);
    },
  };

  const result = resolveWindow({ git: fakeGit, head });
  assert.deepEqual(result, { state: 'unknown', reason: 'cursor is not an ancestor of HEAD' });
});

test('resolveWindow: absent/unknown cursor state is propagated without computing a range', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: false });
  const git = realGit(cloneDir);
  const head = headSha(cloneDir);

  const result = resolveWindow({ git, head });
  assert.deepEqual(result, { state: 'absent' });
  assert.equal('range' in result, false);
});

// ── Phase 1.4 — advanceCursor: atomic CAS ─────────────────────────────────────

test('advanceCursor: B4 — no cursor ref exists → throws, ref still does not exist afterward', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cursor-cas-b4-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git0 = makeRepo(dir);
  git0('commit', '--allow-empty', '-m', 'A');
  const from = headSha(dir);
  git0('commit', '--allow-empty', '-m', 'B');
  const to = headSha(dir);
  const git = realGit(dir);

  assert.throws(() => advanceCursor({ git, from, to }));
  const after = git.try(['rev-parse', '--verify', `${CURSOR_REF}^{commit}`]);
  assert.notEqual(after.status, 0, 'ref must not have been created');
});

test('advanceCursor: non-40-hex from throws before touching git', () => {
  let called = false;
  const fakeGit = {
    try: () => { called = true; return { status: 0, stdout: '', stderr: '' }; },
    orThrow: () => { called = true; return ''; },
  };
  assert.throws(() => advanceCursor({ git: fakeGit, from: 'short-sha', to: 'a'.repeat(40) }));
  assert.equal(called, false, 'git seam must not be invoked when from fails validation');
});

test('advanceCursor: from that is not an ancestor of to throws (cursor only ever moves forward)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cursor-cas-notancestor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git0 = makeRepo(dir);
  git0('commit', '--allow-empty', '-m', 'A');
  const to = headSha(dir);
  git0('checkout', '--orphan', 'unrelated');
  git0('commit', '--allow-empty', '-m', 'B');
  const from = headSha(dir);
  const git = realGit(dir);

  assert.throws(() => advanceCursor({ git, from, to }));
});

// B5 — two advanceCursor calls with the same (now-stale) from.
test('advanceCursor: B5 — second CAS with the same (stale) from fails after the first succeeds', (t) => {
  const scratch = mkdtempSync(join(tmpdir(), 'cursor-cas-b5-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const originDir = join(scratch, 'origin.git');
  mkdirSync(originDir);
  spawnSync('git', ['init', '--bare', '--initial-branch=main', originDir], { encoding: 'utf8' });

  const workDir = join(scratch, 'work');
  mkdirSync(workDir);
  const git0 = makeRepo(workDir);
  git0('remote', 'add', 'origin', originDir);
  git0('commit', '--allow-empty', '-m', 'A');
  const from = headSha(workDir);
  git0('push', 'origin', 'main');
  git0('update-ref', CURSOR_REF, from);
  git0('push', 'origin', `${CURSOR_REF}:${CURSOR_REF}`);

  git0('commit', '--allow-empty', '-m', 'B');
  const to1 = headSha(workDir);
  git0('commit', '--allow-empty', '-m', 'C');
  const to2 = headSha(workDir);

  const git = realGit(workDir);
  advanceCursor({ git, from, to: to1 });

  assert.throws(() => advanceCursor({ git, from, to: to2 }));
});

test('acceptManually: refuses an empty --reason', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: true });
  const git = realGit(cloneDir);
  assert.throws(() => acceptManually({ git, to: headSha(cloneDir), reason: '' }));
});

test('acceptManually: reads the LIVE cursor as `from`, echoes reason, performs the same CAS advance', (t) => {
  const scratch = mkdtempSync(join(tmpdir(), 'cursor-accept-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const originDir = join(scratch, 'origin.git');
  mkdirSync(originDir);
  spawnSync('git', ['init', '--bare', '--initial-branch=main', originDir], { encoding: 'utf8' });

  const workDir = join(scratch, 'work');
  mkdirSync(workDir);
  const git0 = makeRepo(workDir);
  git0('remote', 'add', 'origin', originDir);
  git0('commit', '--allow-empty', '-m', 'A');
  const from = headSha(workDir);
  git0('push', 'origin', 'main');
  git0('update-ref', CURSOR_REF, from);
  git0('push', 'origin', `${CURSOR_REF}:${CURSOR_REF}`);

  git0('commit', '--allow-empty', '-m', 'B');
  const to = headSha(workDir);

  const git = realGit(workDir);
  const result = acceptManually({ git, to, reason: 'owner-approved forward-fix' });
  assert.deepEqual(result, { from, to });

  const after = git.try(['rev-parse', '--verify', `${CURSOR_REF}^{commit}`]);
  assert.equal(after.stdout.trim(), to);
});

// ── CLI mode ───────────────────────────────────────────────────────────────

test('CLI: `cursor.mjs window` prints PRESENT <base> <head> and exits 0', (t) => {
  const { cloneDir, sha } = makeBareOriginAndClone(t, { setCursorRef: true });
  spawnSync('git', ['commit', '--allow-empty', '-m', 'more'], { cwd: cloneDir, encoding: 'utf8' });
  const head = headSha(cloneDir);

  const r = spawnSync('node', [CURSOR_SCRIPT, 'window'], { cwd: cloneDir, encoding: 'utf8' });
  assert.equal(r.stdout.trim(), `PRESENT ${sha} ${head}`);
  assert.equal(r.status, 0);
});

test('CLI: `cursor.mjs window` prints ABSENT and exits 2 when the cursor ref is absent', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: false });

  const r = spawnSync('node', [CURSOR_SCRIPT, 'window'], { cwd: cloneDir, encoding: 'utf8' });
  assert.equal(r.stdout.trim(), 'ABSENT');
  assert.equal(r.status, 2);
});

test('CLI: `cursor.mjs window` prints UNKNOWN <reason> and exits 2 when origin is unreachable', (t) => {
  const { cloneDir } = makeBareOriginAndClone(t, { setCursorRef: true });
  spawnSync('git', ['remote', 'set-url', 'origin', join(cloneDir, 'nope')], { cwd: cloneDir, encoding: 'utf8' });

  const r = spawnSync('node', [CURSOR_SCRIPT, 'window'], { cwd: cloneDir, encoding: 'utf8' });
  assert.match(r.stdout.trim(), /^UNKNOWN/);
  assert.equal(r.status, 2);
});

test('CLI: `cursor.mjs accept <sha> --reason "<text>"` invokes acceptManually', (t) => {
  const scratch = mkdtempSync(join(tmpdir(), 'cursor-cli-accept-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const originDir = join(scratch, 'origin.git');
  mkdirSync(originDir);
  spawnSync('git', ['init', '--bare', '--initial-branch=main', originDir], { encoding: 'utf8' });

  const workDir = join(scratch, 'work');
  mkdirSync(workDir);
  const git0 = makeRepo(workDir);
  git0('remote', 'add', 'origin', originDir);
  git0('commit', '--allow-empty', '-m', 'A');
  const from = headSha(workDir);
  git0('push', 'origin', 'main');
  git0('update-ref', CURSOR_REF, from);
  git0('push', 'origin', `${CURSOR_REF}:${CURSOR_REF}`);
  git0('commit', '--allow-empty', '-m', 'B');
  const to = headSha(workDir);

  const r = spawnSync('node', [CURSOR_SCRIPT, 'accept', to, '--reason', 'owner-approved'], {
    cwd: workDir, encoding: 'utf8',
  });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /owner-approved/);
});

test('CLI: `cursor.mjs accept` with a missing --reason exits non-zero with a usage message', (t) => {
  const { cloneDir, sha } = makeBareOriginAndClone(t, { setCursorRef: true });

  const r = spawnSync('node', [CURSOR_SCRIPT, 'accept', sha], { cwd: cloneDir, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Usage/);
});
