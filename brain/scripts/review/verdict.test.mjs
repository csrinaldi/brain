// verdict.test.mjs — Unit tests for the brain-review/1 verdict emitter
// (REQ-H1-4, REQ-H1-6; protocol §6, §7; design.md §5). Pure — no seams, no
// I/O, direct calls with finding fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildVerdict, renderVerdict } from './verdict.mjs';

const HEAD_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// ── evidence gate ─────────────────────────────────────────────────────────

test('buildVerdict: a finding with no evidence is excluded from findings[] (inadmissible)', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    findings: [
      { id: 'f1', severity: 'correction', cites: 'ADR-0020' }, // no evidence
      { id: 'f2', severity: 'editorial', evidence: 'ran `npm test`' },
    ],
  });
  assert.deepEqual(v.findings.map(f => f.id), ['f2']);
});

// ── cites gate ────────────────────────────────────────────────────────────

test('buildVerdict: a blocker with no cites is downgraded to correction, not dropped', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    findings: [
      { id: 'f1', severity: 'blocker', evidence: 'ran `npm test`' }, // no cites
    ],
  });
  assert.equal(v.findings.length, 1);
  assert.equal(v.findings[0].severity, 'correction');
});

test('buildVerdict: a blocker WITH cites stays a blocker', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    findings: [
      { id: 'f1', severity: 'blocker', evidence: 'ran `npm test`', cites: 'REQ-H1-4' },
    ],
  });
  assert.equal(v.findings[0].severity, 'blocker');
});

// ── head_sha gate ─────────────────────────────────────────────────────────

test('buildVerdict: no head_sha throws — no headless verdict is representable', () => {
  assert.throws(() => buildVerdict({ conclusion: 'REVISE', findings: [] }), /head_sha/);
});

// ── rev bound (REQ-H1-6) ──────────────────────────────────────────────────

test('buildVerdict: rev >= 3 forces STOP + escalate:human instead of a 4th REVISE', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    priorRevCount: 3,
    findings: [],
  });
  assert.equal(v.verdict, 'STOP');
  assert.equal(v.escalate, 'human');
  assert.equal(v.rev, 3);
});

test('buildVerdict: rev < 3 with a REVISE conclusion stays REVISE', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', priorRevCount: 2, findings: [] });
  assert.equal(v.verdict, 'REVISE');
  assert.equal(v.escalate, null);
});

test('buildVerdict: rev >= 3 does NOT force STOP on a non-REVISE conclusion (e.g. APPROVE-path is never reached, but STOP stays STOP)', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'STOP', priorRevCount: 5, findings: [], escalate: 'human' });
  assert.equal(v.verdict, 'STOP');
  assert.equal(v.escalate, 'human');
});

// ── renderVerdict — fenced brain-review/1 YAML ───────────────────────────

test('renderVerdict: emits a fenced yaml block naming protocol, verdict, and head_sha', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', findings: [] });
  const block = renderVerdict(v);
  assert.match(block, /```yaml\n/);
  assert.match(block, /protocol: brain-review\/1/);
  assert.match(block, new RegExp(`head_sha: ${HEAD_SHA}`));
  assert.match(block, /verdict: REVISE/);
  assert.match(block, /```\s*$/);
});
