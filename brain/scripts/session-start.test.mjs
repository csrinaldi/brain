// session-start.test.mjs — unit tests for session-start.mjs (issue #138, PR2).
//
// Universal, read-only, LOCAL-ONLY session context loader. Strict TDD,
// node:test, zero deps. See openspec/changes/issue-138-session-start/design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveChangeFromBranch } from './session-start.mjs';

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
