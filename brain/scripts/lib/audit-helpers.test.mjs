// audit-helpers.test.mjs — Unit tests for brain-audit pure helpers.
// Run with: npm test  (node --test, no git or VCS required)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePrNumber, shouldSkipSize, isAfterBaseline, selectIssueLinkBody } from './audit-helpers.mjs';
import { issueLink } from '../governance/checks/issue-link.mjs';

// ── parsePrNumber ─────────────────────────────────────────────────────────────

test('parsePrNumber: GitHub auto-merge subject extracts number', () => {
  assert.equal(parsePrNumber('Merge pull request #42 from user/branch'), 42);
});

test('parsePrNumber: GitHub auto-merge subject case-insensitive', () => {
  assert.equal(parsePrNumber('merge pull request #7 from other/branch'), 7);
});

test('parsePrNumber: trailing "(#N)" notation extracts number', () => {
  assert.equal(parsePrNumber('feat: add something (#7)'), 7);
});

test('parsePrNumber: trailing "(#N)" with trailing whitespace', () => {
  assert.equal(parsePrNumber('chore: bump version (#123)  '), 123);
});

test('parsePrNumber: no PR number returns null', () => {
  assert.equal(parsePrNumber('chore: no pr reference here'), null);
});

test('parsePrNumber: non-string null returns null', () => {
  assert.equal(parsePrNumber(null), null);
});

test('parsePrNumber: non-string undefined returns null', () => {
  assert.equal(parsePrNumber(undefined), null);
});

// ── shouldSkipSize ────────────────────────────────────────────────────────────

test('shouldSkipSize: size:exception present → true', () => {
  assert.equal(shouldSkipSize(['size:exception', 'kind:feature']), true);
});

test('shouldSkipSize: size:exception is the only label → true', () => {
  assert.equal(shouldSkipSize(['size:exception']), true);
});

test('shouldSkipSize: labels without size:exception → false', () => {
  assert.equal(shouldSkipSize(['kind:feature', 'status:approved']), false);
});

test('shouldSkipSize: empty labels array → false', () => {
  assert.equal(shouldSkipSize([]), false);
});

test('shouldSkipSize: null input → false (graceful)', () => {
  assert.equal(shouldSkipSize(null), false);
});

test('shouldSkipSize: undefined input → false (graceful)', () => {
  assert.equal(shouldSkipSize(undefined), false);
});

// ── isAfterBaseline ───────────────────────────────────────────────────────────

test('isAfterBaseline: returns true when isAncestorFn returns true', () => {
  assert.equal(isAfterBaseline('v1.0.0', 'abc123', () => true), true);
});

test('isAfterBaseline: returns false when isAncestorFn returns false', () => {
  assert.equal(isAfterBaseline('v1.0.0', 'abc123', () => false), false);
});

test('isAfterBaseline: forwards baseline and sha to isAncestorFn', () => {
  let called = null;
  isAfterBaseline('v2.0.0', 'deadbeef', (b, s) => { called = { b, s }; return true; });
  assert.deepEqual(called, { b: 'v2.0.0', s: 'deadbeef' });
});

// ── selectIssueLinkBody ───────────────────────────────────────────────────────

test('selectIssueLinkBody: non-empty prBody → uses prBody', () => {
  const result = selectIssueLinkBody('Closes #5', 'Merge pull request #42 from feat/something');
  assert.equal(result, 'Closes #5');
});

test('selectIssueLinkBody: empty string prBody → falls back to commitBody', () => {
  const result = selectIssueLinkBody('', 'feat: something Closes #3');
  assert.equal(result, 'feat: something Closes #3');
});

test('selectIssueLinkBody: whitespace-only prBody → falls back to commitBody', () => {
  const result = selectIssueLinkBody('   ', 'feat: something Closes #3');
  assert.equal(result, 'feat: something Closes #3');
});

test('selectIssueLinkBody: non-string prBody → falls back to commitBody', () => {
  const result = selectIssueLinkBody(null, 'feat: fallback Closes #1');
  assert.equal(result, 'feat: fallback Closes #1');
});

// ── selectIssueLinkBody + issueLink integration (no git or VCS) ──────────────
//
// These tests prove the full decision path: PR body has the reference but the
// merge commit body does not (the real-world GitHub case where merge commit
// bodies are "Merge pull request #N from branch").

test('issueLink passes when PR body has "Closes #5", merge commit body has none', () => {
  const body = selectIssueLinkBody('This PR Closes #5', 'Merge pull request #42 from feat/something');
  assert.deepEqual(issueLink(body), { pass: true });
});

test('issueLink passes when PR body has "Part of #5", merge commit body has none', () => {
  const body = selectIssueLinkBody('Part of #5', 'Merge pull request #42 from feat/something');
  assert.deepEqual(issueLink(body), { pass: true });
});

test('issueLink falls back to commit body when PR body is empty and commit body has reference', () => {
  const body = selectIssueLinkBody('', 'chore: finalize Closes #3');
  assert.deepEqual(issueLink(body), { pass: true });
});

test('issueLink fails when both PR body and commit body have no reference', () => {
  const body = selectIssueLinkBody('', 'Merge pull request #42 from feat/something');
  assert.equal(issueLink(body).pass, false);
});
