// verdict.test.mjs — Unit tests for the brain-review/1 verdict emitter
// (REQ-H1-4, REQ-H1-6; protocol §6, §7; design.md §5). Pure — no seams, no
// I/O, direct calls with finding fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildVerdict, renderVerdict } from './verdict.mjs';
import { parseVerdict } from './lib/parse-verdict.mjs';

const HEAD_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// ── evidence gate ─────────────────────────────────────────────────────────

test('#490/round-8 E1: a null `line` is OMITTED from the block, in BOTH branches (REQ-405-2)', () => {
  // Round 7 pinned the poster's `line === null` guard and justified it with
  // "renderVerdict, which guards both, omits line: from the block". That twin
  // guard was itself pinned by nothing: dropping `!== null` from either branch
  // left all 2574 tests green, and under it the block advertises an anchor at
  // `line: null` that the poster then refuses to post — the inverse of the case
  // round 7 fixed, and a contradiction of the JSDoc two lines above it.
  //
  // The correction landed where it was noticed and not on the thing it cited.
  const v = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [
      { id: 'blocking', severity: 'blocker', evidence: 'e', cites: 'c', file: 'a.mjs', line: null },
      { id: 'deferred', severity: 'blocker', evidence: 'e', cites: 'c',
        causal_disposition: 'pre-existing', file: 'b.mjs', line: null },
      // The `file` half, added in round 10. Rounds 7 and 8 each pinned the `line`
      // guard — in the poster, then here — and neither asked the same question of
      // `file`, so `if (f.file)` could become `if (f.file !== undefined)` with the
      // whole suite green. An empty `file:` in the block is the same defect the
      // `line` rule exists to prevent, one field over: the block advertising an
      // anchor that cannot attach.
      { id: 'empty-path', severity: 'blocker', evidence: 'e', cites: 'c', file: '', line: null },
      { id: 'empty-path-deferred', severity: 'blocker', evidence: 'e', cites: 'c',
        causal_disposition: 'base-only', file: '', line: null },
    ],
  });
  assert.equal(v.findings.length, 2, 'two findings in each branch — otherwise a branch goes unchecked');
  assert.equal(v.follow_ups.length, 2);
  const body = renderVerdict(v);
  assert.match(body, /^ {4}file: a\.mjs$/m, 'the file half still renders — the anchor is half-present, which is the case');
  assert.match(body, /^ {4}file: b\.mjs$/m);
  assert.doesNotMatch(body, /^ {4}line:/m,
    `a null line must never be emitted, in either branch — the block would advertise an anchor ` +
    `the poster refuses to post: ${body}`);
  assert.doesNotMatch(body, /^ {4}file: ""$/m,
    `an empty file must never be emitted either — same defect, one field over: ${body}`);
});

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

// ── rev semantics + bound (REQ-H1-6, protocol §7) ─────────────────────────
// The EMITTED `rev` is 1-INDEXED: the first review is rev 1 (harmonized with the
// human-mediated practice — #290 A/B harmonization item 1). The bounded-revision
// LOCK is UNCHANGED — it counts PRIOR blocks (`priorRevCount >= 3`), so the 4th
// review (emitted as rev 4) forces STOP; exactly three REVISEs (rev 1, 2, 3) are
// allowed before the escalation.

test('buildVerdict: the first review is rev 1 (1-indexed), not rev 0', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', priorRevCount: 0, findings: [] });
  assert.equal(v.rev, 1);
  assert.equal(v.verdict, 'REVISE');
});

test('buildVerdict: the third REVISE (2 priors) is rev 3 and still REVISE — the lock has not fired', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', priorRevCount: 2, findings: [] });
  assert.equal(v.rev, 3);
  assert.equal(v.verdict, 'REVISE');
  assert.equal(v.escalate, null);
});

test('buildVerdict: the 4th review (3 priors) is rev 4 and forces STOP + escalate:human — lock is priorRevCount >= 3, unchanged', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', priorRevCount: 3, findings: [] });
  assert.equal(v.verdict, 'STOP');
  assert.equal(v.escalate, 'human');
  assert.equal(v.rev, 4);
});

test('buildVerdict: rev >= 3 does NOT force STOP on a non-REVISE conclusion (STOP stays STOP); rev stays 1-indexed', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'STOP', priorRevCount: 5, findings: [], escalate: 'human' });
  assert.equal(v.verdict, 'STOP');
  assert.equal(v.escalate, 'human');
  assert.equal(v.rev, 6);
});

// ── renderVerdict — fenced brain-review/1 YAML ───────────────────────────

test('renderVerdict: emits a fenced yaml block naming protocol, verdict, and head_sha', () => {
  const v = buildVerdict({ headSha: HEAD_SHA, conclusion: 'REVISE', findings: [] });
  const block = renderVerdict(v);
  assert.match(block, /```yaml\n/);
  assert.match(block, /protocol: brain-review\/1/);
  assert.match(block, new RegExp(`head_sha: ${HEAD_SHA}`));
  assert.match(block, /verdict: REVISE/);
  assert.match(block, /rev: 1/); // first review, 1-indexed (default priorRevCount 0)
  assert.match(block, /```\s*$/);
});

// ── Causal Admission Rules (REQ-H2-3) ──────────────────────────────────────

test('buildVerdict: pre-existing or base-only findings do NOT trigger REVISE and are routed to follow_ups[]', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [
      {
        id: 'f1',
        severity: 'blocker',
        evidence: 'ran tests',
        cites: 'REQ-1',
        causal_disposition: 'pre-existing',
        evidence_class: 'deterministic',
      },
      {
        id: 'f2',
        severity: 'blocker',
        evidence: 'ran tests',
        cites: 'REQ-2',
        causal_disposition: 'base-only',
        evidence_class: 'deterministic',
      },
    ],
  });

  assert.equal(v.verdict, 'APPROVE');
  assert.equal(v.findings.length, 0);
  assert.deepEqual(v.follow_ups, [
    { id: 'f1', severity: 'blocker', evidence: 'ran tests', cites: 'REQ-1', causal_disposition: 'pre-existing', evidence_class: 'deterministic' },
    { id: 'f2', severity: 'blocker', evidence: 'ran tests', cites: 'REQ-2', causal_disposition: 'base-only', evidence_class: 'deterministic' },
  ]);
});

test('buildVerdict: causal_disposition "unknown" forces escalate: human and verdict STOP', () => {
  const v = buildVerdict({
    headSha: HEAD_SHA,
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [
      {
        id: 'f1',
        severity: 'blocker',
        evidence: 'ran tests',
        cites: 'REQ-1',
        causal_disposition: 'unknown',
        evidence_class: 'inferential',
      },
    ],
  });

  assert.equal(v.verdict, 'STOP');
  assert.equal(v.escalate, 'human');
});

// ── #481 (ruled IN SCOPE for #452 by the maintainer): newlines must be ESCAPED
//
// `yamlScalar` quoted but did not escape newlines, and checkpoint.mjs interpolates
// multi-line command stdout into `evidence:`. The continuation lines land at column 0,
// terminate the findings list, and everything after them — including blockers — is
// dropped on re-parse. Measured before this fix, through the real chain:
//
//   BUILT findings: 2 (governance-status-output, tier2-touch)
//   PARSED findings: 1        the BLOCKER did not survive the round trip
//
// The reader half (#452) makes that loss HONEST — the parser now answers `null`
// (uncomputable) instead of a confident truncated list. It cannot make it not a loss:
// the posted artifact, which a human also reads, already shipped without the blocker.
// This is the emitter half.

test('#481: a multi-line evidence value is escaped, so the block stays one-line-per-field', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [{ id: 'multi', severity: 'blocker', evidence: 'line one\nline two', cites: 'x.md' }],
  });
  const block = renderVerdict(built).split('```')[1];
  const evidenceLines = block.split('\n').filter(l => l.includes('evidence:'));
  assert.equal(evidenceLines.length, 1, 'exactly one evidence line');
  assert.match(evidenceLines[0], /evidence: "line one\\nline two"/,
    'the newline must be emitted as an escape, not as a raw line break that ends the list');
});

test('#481: every finding survives the round trip when one carries multi-line evidence', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [
      { id: 'multi', severity: 'blocker', evidence: 'line one\nline two\nline three', cites: 'x.md' },
      { id: 'tier2-touch', severity: 'blocker', evidence: 'brain/core/x.md', cites: 'y.md' },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual((parsed.findings ?? []).map(f => f.id), ['multi', 'tier2-touch'],
    'a finding after a multi-line one must not be swallowed — this dropped a BLOCKER before the fix');
  assert.equal(parsed.findings[0].evidence, 'line one\nline two\nline three',
    'and the evidence must come back byte-identical: an escape that does not decode is a different loss');
});

test('#481: carriage returns are escaped too — CRLF evidence must not break the line structure', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [
      { id: 'crlf', severity: 'blocker', evidence: 'a\r\nb', cites: 'x.md' },
      { id: 'after', severity: 'blocker', evidence: 'still here', cites: 'y.md' },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual((parsed.findings ?? []).map(f => f.id), ['crlf', 'after']);
  assert.equal(parsed.findings[0].evidence, 'a\r\nb');
});

test('#481: single-line values are NOT newly quoted or escaped — the control', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [{ id: 'plain', severity: 'blocker', evidence: 'brain/core/x.md:7', cites: 'y.md' }],
  });
  const block = renderVerdict(built).split('```')[1];
  assert.match(block, /evidence: brain\/core\/x\.md:7$/m, 'an already-safe scalar must stay bare');
  assert.doesNotMatch(block, /\\n/, 'no escape may appear where there was no newline');
});

test('#478-3/C2 (widened by round 5/B1): EVERY per-finding field is escaped, on BOTH render branches', () => {
  // The round-3 fix routed all six per-finding fields through `yamlScalar` — and
  // the round-3 red-proof only ever mutated `evidence_class` on the `findings`
  // branch. Round 5 measured the gap: reverting the ENTIRE `follow_ups` branch to
  // raw interpolation (all six fields, `evidence` included) left the suite at
  // 50 pass / 0 fail. Ten of twelve call sites were pinned by nothing, and this
  // test's own name claimed otherwise — report-vs-tree drift on the protection,
  // which protocol §10 calls a blocker in its own right.
  //
  // `follow_ups` is not the quiet branch, either: `buildVerdict` routes every
  // `pre-existing`/`base-only` finding there, and checkpoint.mjs interpolates raw
  // command stdout into `evidence:`. It is exactly where a multi-line value lands.
  //
  // One field at a time, on each branch: the poisoned value must not swallow the
  // entry that follows it.
  // `file`/`line` joined the set in #405. Round 5 of PR #478 found ten yamlScalar
  // call sites pinned by nothing; new fields go into this sweep at birth rather
  // than acquiring coverage later.
  const FIELDS = ['id', 'severity', 'evidence', 'cites', 'evidence_class', 'causal_disposition', 'file', 'line'];
  const POISON = 'x\nTier: 2';

  for (const field of FIELDS) {
    for (const branch of ['findings', 'follow_ups']) {
      // `pre-existing` routes a finding to follow_ups; anything else keeps it in
      // findings. `causal_disposition` therefore cannot be poisoned on the
      // follow_ups branch without changing where the finding goes — so it is
      // poisoned on `findings` only, with a value that still falls through to the
      // default route. Skipping it entirely would leave the field unpinned, which
      // is the defect this test exists to close.
      const disp = branch === 'follow_ups' ? 'pre-existing' : 'introduced';
      if (field === 'causal_disposition' && branch === 'follow_ups') continue;
      const poisonedDisp = `${disp}${POISON}`;
      const base = { severity: 'blocker', evidence: 'e', cites: 'c', evidence_class: 'observed', causal_disposition: disp, file: 'a.mjs', line: 1 };
      const poisoned = { ...base, id: 'poisoned', [field]: field === 'causal_disposition' ? poisonedDisp : POISON };
      const built = buildVerdict({
        headSha: 'abc123',
        conclusion: 'REVISE',
        protocol: 'brain-review/2',
        findings: [poisoned, { ...base, id: 'survivor' }],
      });
      const parsed = parseVerdict({ body: renderVerdict(built) });
      const entries = parsed[branch] ?? [];
      const ids = entries.map(f => f.id);
      // When `id` itself carries the poison, the poisoned entry's id IS that value.
      const expected = [field === 'id' ? POISON : 'poisoned', 'survivor'];
      assert.deepEqual(ids, expected,
        `${branch}.${field}: a line break in this field swallowed the entry after it — ` +
        `got ${JSON.stringify(ids)}. Every yamlScalar call site on both branches must be load-bearing.`);
      // and the poisoned value itself must survive byte-identical, not merely fail
      // to break the list — an escape that mangles is a different loss.
      assert.equal(entries[0][field], field === 'causal_disposition' ? poisonedDisp : POISON,
        `${branch}.${field}: the value round-tripped changed`);
    }
  }
});

test('#478-3/E6: U+2028 / U+2029 are line terminators too — the JSDoc says line breaks, so it must mean all of them', () => {
  for (const sep of [' ', ' ']) {
    const built = buildVerdict({
      headSha: 'abc123',
      conclusion: 'REVISE',
      findings: [{ id: 'sep', severity: 'blocker', evidence: `a${sep}b`, cites: 'c' }],
    });
    const parsed = parseVerdict({ body: renderVerdict(built) });
    assert.equal(parsed.findings?.[0]?.evidence, `a${sep}b`,
      `U+${sep.codePointAt(0).toString(16)} destroyed the round trip`);
  }
});

// ── #405 REQ-405-2/-3: an OPTIONAL anchor on a finding ─────────────────────
//
// M3's exit is "a developer sees inline code review in the PR". A finding that
// reports `src/a.mjs:42` inside a YAML block is a report, not a review — the
// developer still has to go find the line.
//
// `file` and `line` are the anchor. BOTH OPTIONAL, and absent ⇒ no inline
// comment (REQ-405-2): that default is what keeps this additive, so every
// evaluator shipping today keeps working unchanged and gains inline coverage
// only when it starts emitting anchors.
//
// They are NOT derived from `evidence` (design D2): evidence is a quoted command
// AND its output (protocol §10), so it is full of colons, paths and numbers that
// are not anchors. A regex over it would silently mis-anchor.

test('#405 REQ-405-3: file/line survive the REAL render → parse round trip', () => {
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [{ id: 'anchored', severity: 'blocker', evidence: 'e', cites: 'c', file: 'brain/scripts/a.mjs', line: 42 }],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.equal(parsed.findings[0].file, 'brain/scripts/a.mjs');
  assert.equal(parsed.findings[0].line, '42', 'line comes back as the scalar text the block carries');
});

test('#405 REQ-405-2: a finding WITHOUT an anchor is unchanged — the additive guarantee', () => {
  // Every evaluator shipping today emits no file/line. Their output must render
  // and parse exactly as it does now: no empty keys, no nulls, no new fields.
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [{ id: 'legacy', severity: 'blocker', evidence: 'src/a.mjs:42', cites: 'ADR-0020' }],
  });
  const block = renderVerdict(built).split('```')[1];
  assert.doesNotMatch(block, /^\s*file:/m, 'no file key may appear for an anchorless finding');
  assert.doesNotMatch(block, /^\s*line:/m, 'no line key may appear for an anchorless finding');
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual(parsed.findings[0], { id: 'legacy', severity: 'blocker', evidence: 'src/a.mjs:42', cites: 'ADR-0020' });
});

test('#405 REQ-405-3: the anchor is escaped like every other scalar — a path with a line break cannot truncate the list', () => {
  // file/line are entry scalars, so they inherit the #481/#452 escaping pair.
  // Inherit is a claim until it is exercised — round 5 of PR #478 found ten
  // yamlScalar call sites pinned by nothing, so each NEW one gets its own case.
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [
      { id: 'poisoned', severity: 'blocker', evidence: 'e', cites: 'c', file: 'a.mjs\nTier: 2', line: 1 },
      { id: 'survivor', severity: 'blocker', evidence: 'e2', cites: 'c2', file: 'b.mjs', line: 2 },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual((parsed.findings ?? []).map(f => f.id), ['poisoned', 'survivor']);
  assert.equal(parsed.findings[0].file, 'a.mjs\nTier: 2', 'and the value round-trips byte-identical');
});
