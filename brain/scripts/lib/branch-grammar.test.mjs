import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueBranch } from './branch-grammar.mjs';

test('branch-grammar: canonical {type}/issue-{N}-{slug} (what brain:ticket:start emits)', () => {
  assert.deepEqual(parseIssueBranch('fix/issue-639-some-slug'), { issueNumber: '639', type: 'fix', slug: 'some-slug', shape: 'canonical' });
  assert.equal(parseIssueBranch('feat/issue-3-x').issueNumber, '3');
});

test('branch-grammar: legacy {type}/{N}-{slug} (what brain:start emits)', () => {
  assert.deepEqual(parseIssueBranch('feature/42-add-cli-i18n'), { issueNumber: '42', type: 'feature', slug: 'add-cli-i18n', shape: 'legacy' });
});

test('branch-grammar: anything else is null, never a fabricated number', () => {
  for (const b of ['main', 'claude/some-slug', 'feature/no-number', 'feature/42', '42-no-prefix', 'fix/issue-x-1', '', null, undefined]) {
    assert.equal(parseIssueBranch(b), null, String(b));
  }
});
