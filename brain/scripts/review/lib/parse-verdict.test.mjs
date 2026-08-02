// parse-verdict.test.mjs — Unit tests for parsing a `brain-review/1` fenced
// block out of a review body (protocol §6). Used by cold-boot (rev count +
// prior verdicts), and later by the anti-loop lock and the board (H1-2/H1-5).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseVerdict } from './parse-verdict.mjs';
import { buildVerdict, renderVerdict } from '../verdict.mjs';

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

// ── brain-review/2 support (REQ-H2-2, REQ-H2-4) ───────────────────────────

test('parseVerdict: accepts protocol: brain-review/2 alongside brain-review/1', () => {
  const body = [
    '```yaml',
    'protocol: brain-review/2',
    'verdict: REVISE',
    'head_sha: def456',
    'rev: 1',
    '```',
  ].join('\n');

  const result = parseVerdict({ body, author: 'reviewer-v2' });
  assert.deepEqual(result, {
    protocol: 'brain-review/2',
    head_sha: 'def456',
    rev: 1,
    verdict: 'REVISE',
    author: 'reviewer-v2',
  });
});

test('parseVerdict: extracts findings with evidence_class and causal_disposition from brain-review/2 block', () => {
  const body = [
    '```yaml',
    'protocol: brain-review/2',
    'verdict: REVISE',
    'head_sha: def456',
    'rev: 1',
    'findings: "[{\\"id\\":\\"R3-001\\",\\"evidence_class\\":\\"inferential\\",\\"causal_disposition\\":\\"introduced\\"}]"',
    '```',
  ].join('\n');

  const result = parseVerdict({ body, author: 'reviewer-v2' });
  assert.deepEqual(result.findings, [
    { id: 'R3-001', evidence_class: 'inferential', causal_disposition: 'introduced' },
  ]);
});

// ── #381: the REAL render -> parse round-trip ───────────────────────────────
// Every findings test above this line hand-writes its input. That is exactly
// how the defect survived: `renderVerdict` emits findings as a YAML LIST,
// `parseVerdict` only read a same-line JSON scalar, and no test ever fed one
// to the other. The tests below drive parseVerdict from ACTUAL buildVerdict +
// renderVerdict output — if the two encodings ever diverge again, these fail.

test('#381 round-trip: non-empty findings survive renderVerdict -> parseVerdict', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [
      { id: 'F-1', severity: 'blocker', evidence: 'src/a.mjs:42', cites: 'ADR-0020' },
      { id: 'F-2', severity: 'correction', evidence: 'a quoted: value, with punctuation' },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built), author: 'rev' });

  assert.equal(parsed.findings.length, 2, 'both findings must survive the round-trip');
  assert.deepEqual(parsed.findings[0], {
    id: 'F-1',
    severity: 'blocker',
    evidence: 'src/a.mjs:42',
    cites: 'ADR-0020',
  });
  // The second finding's evidence needed quoting on the way out; it must come
  // back un-quoted and byte-identical, not as the raw `"..."` literal.
  assert.equal(parsed.findings[1].evidence, 'a quoted: value, with punctuation');
  assert.equal(parsed.findings[1].severity, 'correction');
});

test('#381 round-trip: an empty findings array still round-trips (the case that always worked)', () => {
  const built = buildVerdict({ headSha: 'abc123', conclusion: 'APPROVE', findings: [] });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual(parsed.findings, [], 'findings: [] must parse to an empty array, not null');
});

test('#381 round-trip: follow_ups survive too — they were rendered but never parsed', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [
      { id: 'K-1', severity: 'blocker', evidence: 'live.mjs:7', causal_disposition: 'introduced' },
      { id: 'K-2', severity: 'blocker', evidence: 'old.mjs:9', causal_disposition: 'pre-existing' },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });

  assert.deepEqual(parsed.findings.map(f => f.id), ['K-1'], 'introduced findings stay in findings');
  assert.deepEqual(parsed.follow_ups.map(f => f.id), ['K-2'], 'pre-existing findings move to follow_ups');
  assert.equal(parsed.follow_ups[0].causal_disposition, 'pre-existing');
});

test('#381 round-trip: the list parser stops at the next top-level key', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [{ id: 'F-1', severity: 'blocker', evidence: 'x.mjs:1' }],
    conditions: ['some-condition'],
  });
  const rendered = renderVerdict(built);
  const parsed = parseVerdict({ body: rendered });

  assert.equal(parsed.findings.length, 1, 'exactly one finding — conditions must not be absorbed');
  assert.equal('conditions' in parsed.findings[0], false, 'the next key must not leak into the entry');
});
