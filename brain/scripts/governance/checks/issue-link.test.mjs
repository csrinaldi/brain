// issue-link.test.mjs — Unit tests for issueLink check (REQ-S4-1)
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { issueLink } from './issue-link.mjs';

test('issueLink: body with "Closes #42" → pass', () => {
  assert.deepEqual(issueLink('feat: something\n\nCloses #42'), { pass: true });
});

test('issueLink: body with no issue reference → fail with reason', () => {
  const r = issueLink('Some PR description without any link');
  assert.equal(r.pass, false);
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0, 'reason must be present');
});

test('issueLink: case-insensitive "FIXES #7" → pass', () => {
  assert.deepEqual(issueLink('FIXES #7'), { pass: true });
});
