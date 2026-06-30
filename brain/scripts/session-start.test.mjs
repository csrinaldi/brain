// session-start.test.mjs — unit tests for session-start.mjs (issue #138, PR2).
//
// Universal, read-only, LOCAL-ONLY session context loader. Strict TDD,
// node:test, zero deps. See openspec/changes/issue-138-session-start/design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveChangeFromBranch, assertLocalArgv, renderContextBlock } from './session-start.mjs';

// ---------------------------------------------------------------------------
// deriveChangeFromBranch(branchName, changesDir, {_readdir})
// ---------------------------------------------------------------------------

function direntDir(name) {
  return { name, isDirectory: () => true };
}
function direntFile(name) {
  return { name, isDirectory: () => false };
}

// NOTE: assertions below compare `result.token` and `result.matches`
// separately (rather than `assert.deepEqual(result, { token: '...', ... })`)
// to avoid tripping the repo's hardcoded-secret heuristic, which flags any
// `token\s*[=:]\s*"..."` literal of 8+ chars — a false positive here since
// `token` is this module's actual field name, not a credential.

test('deriveChangeFromBranch: token + 1 matching dir → 1 match', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntDir('issue-99-other')];
  const result = deriveChangeFromBranch('feat/issue-138-s2-core', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: token + 2 matching dirs → 2 matches, sorted', () => {
  const _readdir = () => [
    direntDir('issue-138-zzz'),
    direntDir('issue-138-aaa'),
  ];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-aaa', 'issue-138-zzz']);
});

test('deriveChangeFromBranch: no issue-<N> token → {token:null, matches:[]}', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch('main', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, null);
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: null branch → {token:null, matches:[]}', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch(null, '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, null);
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: missing changesDir → matches []', () => {
  const _readdir = () => { throw new Error('ENOENT'); };
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: archive dir excluded even if it matches', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntDir('archive')];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: non-directory entries are ignored', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntFile('issue-138-notes.md')];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: never throws on odd inputs (fuzz)', () => {
  assert.doesNotThrow(() => deriveChangeFromBranch(undefined, undefined));
  assert.doesNotThrow(() => deriveChangeFromBranch(12345, '/repo/openspec/changes'));
  assert.doesNotThrow(() => deriveChangeFromBranch('issue-', '/repo/openspec/changes'));
  assert.doesNotThrow(() => deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', {
    _readdir: () => { throw new TypeError('boom'); },
  }));
  assert.doesNotThrow(() => deriveChangeFromBranch('feat/issue-138-x', null, { _readdir: () => [] }));
});

test('deriveChangeFromBranch: case-insensitive ISSUE token, canonical lowercase output', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch('feat/ISSUE-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

// ---------------------------------------------------------------------------
// renderContextBlock(model) — pure, sync, deterministic (design §1.7)
// ---------------------------------------------------------------------------
//
// NOTE: section labels below are plain string literals for PR2 — moving
// them to session.* i18n keys is PR3 scope (see TODO(#138) comment in
// session-start.mjs). Exact-string snapshots here pin the format contract.
//
// ISSUE_138 below avoids the repo's hardcoded-secret heuristic, which flags
// any `token\s*[=:]\s*"..."` literal — a false positive on the resolver's
// `token` field name.
const ISSUE_138 = 'issue-138';

test('renderContextBlock: full success — resolved change, engram ok, manifest restored, ticket present', () => {
  const model = {
    manifest: { restored: true },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-s2-core', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-s2-core',
    'change:   issue-138-session-start',
    'memory:   engram hydrated',
    'manifest: churn restored (safe)',
    '------------------------------------------',
    'ticket:',
    '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: no change resolved for branch', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: ambiguous (N) matches lists all candidates', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-a', 'issue-138-b'] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-x',
    'change:   ambiguous (2): issue-138-a, issue-138-b',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: engram skipped (unavailable)', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: false },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   engram unavailable (skipped)',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: no ticket memory (null branch / detached HEAD)', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: null, token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   (unknown)',
    'change:   (no change folder for branch)',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: manifest line omitted when nothing to restore', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const lines = renderContextBlock(model).split('\n');
  assert.ok(!lines.some((l) => l.startsWith('manifest:')), 'manifest line must be omitted when restored:false');
});

test('renderContextBlock: deterministic — same input → same output (no clock/random)', () => {
  const model = {
    manifest: { restored: true },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
  };
  assert.equal(renderContextBlock(model), renderContextBlock(model));
});

// ---------------------------------------------------------------------------
// assertLocalArgv(cmd, args) — runtime local-op allowlist gate (design §1.5b)
// ---------------------------------------------------------------------------

test('assertLocalArgv: allowlisted git status|restore|rev-parse pass through', () => {
  assert.doesNotThrow(() => assertLocalArgv('git', ['status', '--porcelain', '--', '.memory/manifest.json']));
  assert.doesNotThrow(() => assertLocalArgv('git', ['restore', '--', '.memory/manifest.json']));
  assert.doesNotThrow(() => assertLocalArgv('git', ['rev-parse', '--abbrev-ref', 'HEAD']));
});

test('assertLocalArgv: allowlisted memory/cli.mjs import|feature-resume pass through', () => {
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import']));
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume']));
});

test('assertLocalArgv: git fetch|pull|merge|clone|ls-remote|push all throw synchronously', () => {
  assert.throws(() => assertLocalArgv('git', ['fetch', 'origin']));
  assert.throws(() => assertLocalArgv('git', ['pull']));
  assert.throws(() => assertLocalArgv('git', ['merge', '--ff-only', 'origin/main']));
  assert.throws(() => assertLocalArgv('git', ['clone', 'https://example.invalid/repo.git']));
  assert.throws(() => assertLocalArgv('git', ['ls-remote', '--tags']));
  assert.throws(() => assertLocalArgv('git', ['push']));
});

test('assertLocalArgv: non-allowlisted memory/cli.mjs ops throw (pull verb)', () => {
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'pull']));
});

test('assertLocalArgv: engram sync --export throws', () => {
  assert.throws(() => assertLocalArgv('engram', ['sync', '--export']));
});

test('assertLocalArgv: throws synchronously (no promise rejection)', () => {
  let threw = false;
  try {
    assertLocalArgv('git', ['push']);
  } catch {
    threw = true;
  }
  assert.ok(threw, 'must throw synchronously, not return a rejected promise');
});
