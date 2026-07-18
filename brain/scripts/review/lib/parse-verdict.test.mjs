// parse-verdict.test.mjs — Unit tests for parsing a `brain-review/1` fenced
// block out of a review body (protocol §6). Used by cold-boot (rev count +
// prior verdicts), and later by the anti-loop lock and the board (H1-2/H1-5).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseVerdict } from './parse-verdict.mjs';

test('parseVerdict: extracts head_sha, rev, verdict, and the passed-through author', () => {
  const body = [
    'Some prose before the block.',
    '',
    '```yaml',
    'protocol: brain-review/1',
    'verdict: REVISE',
    'head_sha: abc123',
    'rev: 1',
    'escalate: null',
    '```',
    '',
    'Prose after.',
  ].join('\n');

  const result = parseVerdict({ body, author: 'brain-reviewer' });
  assert.deepEqual(result, {
    head_sha: 'abc123',
    rev: 1,
    verdict: 'REVISE',
    author: 'brain-reviewer',
  });
});

test('parseVerdict: a body with no brain-review/1 block returns null', () => {
  assert.equal(parseVerdict({ body: 'just a regular human comment, no block here', author: 'alice' }), null);
});

test('parseVerdict: a fenced yaml block for a DIFFERENT protocol returns null', () => {
  const body = '```yaml\nprotocol: something-else/1\nhead_sha: x\nverdict: REVISE\n```';
  assert.equal(parseVerdict({ body, author: 'alice' }), null);
});

test('parseVerdict: missing body (null/undefined) returns null, never throws', () => {
  assert.equal(parseVerdict({ body: null }), null);
  assert.equal(parseVerdict({}), null);
});

test('parseVerdict: a block missing head_sha or verdict returns null (incomplete block)', () => {
  const body = '```yaml\nprotocol: brain-review/1\nrev: 0\n```';
  assert.equal(parseVerdict({ body }), null);
});

// ── sequencing (optional, H1-5c board.mjs) ──────────────────────────────────
// `sequencing:` is rendered by verdict.mjs's renderVerdict as a
// JSON-stringified value wrapped by yamlScalar's quote/escape rules
// (`sequencing: "[\"seq:merge-next\"]"`). Only present when an evaluator
// sets it — no H1 evaluator does yet, so it stays OMITTED from the parsed
// result (not merely null) whenever the block carries no `sequencing:`
// line, keeping the existing exact-key-set assertions above unaffected.

test('parseVerdict: extracts sequencing when the block carries it (JSON-array-of-labels, yamlScalar-quoted)', () => {
  const body = [
    '```yaml',
    'protocol: brain-review/1',
    'verdict: APPROVE',
    'head_sha: abc123',
    'rev: 2',
    'sequencing: "[\\"seq:merge-next\\"]"',
    '```',
  ].join('\n');

  const result = parseVerdict({ body, author: 'brain-reviewer' });
  assert.deepEqual(result.sequencing, ['seq:merge-next']);
});

test('parseVerdict: a block with no sequencing line omits the key entirely (not null)', () => {
  const body = '```yaml\nprotocol: brain-review/1\nverdict: REVISE\nhead_sha: abc123\nrev: 0\n```';
  const result = parseVerdict({ body });
  assert.equal('sequencing' in result, false);
});

test('parseVerdict: an unparseable sequencing scalar is tolerated — omitted, never throws', () => {
  const body = [
    '```yaml',
    'protocol: brain-review/1',
    'verdict: REVISE',
    'head_sha: abc123',
    'rev: 0',
    'sequencing: not-valid-json',
    '```',
  ].join('\n');
  assert.doesNotThrow(() => parseVerdict({ body }));
  const result = parseVerdict({ body });
  assert.equal('sequencing' in result, false);
});
