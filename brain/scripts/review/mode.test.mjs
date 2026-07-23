// mode.test.mjs — Unit tests for REQ-H1-7: mode is derived from repo state,
// never declared (protocol §H1, design.md §4). Table-driven — deriveMode is
// pure over { labels, changedFiles } (R6).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveMode } from './mode.mjs';

const CASES = [
  {
    name: 'needs-ruling label wins over everything else',
    input: { labels: ['needs-ruling'], changedFiles: ['openspec/changes/x/checkpoint-report.md'] },
    expected: 'ruling',
  },
  {
    name: 'checkpoint-report.md touched (no needs-ruling) → checkpoint',
    input: { labels: [], changedFiles: ['openspec/changes/x/checkpoint-report.md'] },
    expected: 'checkpoint',
  },
  {
    name: 'checkpoint-report.md nested under a change dir still matches',
    input: { labels: [], changedFiles: ['openspec/changes/issue-266-h1/checkpoint-report.md'] },
    expected: 'checkpoint',
  },
  {
    name: 'neither derivation input matches → tranche (the default)',
    input: { labels: ['type:feature'], changedFiles: ['brain/scripts/review/mode.mjs'] },
    expected: 'tranche',
  },
  {
    name: 'no labels, no changed files → tranche',
    input: { labels: [], changedFiles: [] },
    expected: 'tranche',
  },
  {
    name: 'a file that merely CONTAINS "checkpoint-report.md" as a substring, not a path segment, does not match',
    input: { labels: [], changedFiles: ['docs/not-a-real-checkpoint-report.md.txt'] },
    expected: 'tranche',
  },
];

for (const { name, input, expected } of CASES) {
  test(`deriveMode: ${name}`, () => {
    assert.equal(deriveMode(input), expected);
  });
}

test('deriveMode: defaults labels/changedFiles to [] when omitted — never throws on a bare call', () => {
  assert.equal(deriveMode({}), 'tranche');
  assert.equal(deriveMode(), 'tranche');
});
