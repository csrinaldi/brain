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

// ── issue #452: three states, three answers ─────────────────────────────────
//
// `null` is the sentinel for "the key is absent". `parseEntryList`'s last line
// made it ALSO the sentinel for "the key is present and its list is empty", so
// `parseVerdict`'s `if (x !== null)` guard dropped the field in both cases and
// a consumer could not tell them apart. That is `evidence-reader-empty-on-failure`
// in the parser — and the THIRD appearance of the #381 class in this same pair
// of functions, the second in `follow_ups`.
//
// `parseEntryList` is not exported, so these go through `parseVerdict`: the
// distinction only matters if it survives to a consumer, and the consumers
// (cold-boot.mjs:123, board.mjs:104) read exactly this shape.

/** A minimal valid /2 block with `extra` spliced in before the fence closes. */
function blockWith(extra) {
  return ['```yaml',
    'protocol: brain-review/2',
    'head_sha: abc123',
    'verdict: APPROVE',
    ...extra,
    '```'].join('\n');
}

test('#452: a key that is ABSENT leaves the property off the result', () => {
  const parsed = parseVerdict({ body: blockWith([]) });
  assert.equal('follow_ups' in parsed, false);
  assert.equal('findings' in parsed, false);
});

test('#452: a key that is PRESENT with an empty list yields [] — not the same answer as absent', () => {
  // Red before the fix: `parseEntryList` returned null here, so the property was
  // dropped and this state was indistinguishable from the one above.
  const parsed = parseVerdict({ body: blockWith(['follow_ups:']) });
  assert.equal('follow_ups' in parsed, true,
    'the key WAS in the block — a reader that reports it absent is answering a different question than the one asked');
  assert.deepEqual(parsed.follow_ups, []);
});

test('#452: a key that is PRESENT with entries yields the entries (unchanged)', () => {
  const parsed = parseVerdict({ body: blockWith(['follow_ups:', '  - id: "K-1"']) });
  assert.deepEqual(parsed.follow_ups, [{ id: 'K-1' }]);
});

test('#452: the same three states hold for findings, on the block encoding', () => {
  assert.equal('findings' in parseVerdict({ body: blockWith([]) }), false);
  assert.deepEqual(parseVerdict({ body: blockWith(['findings:']) }).findings, []);
  assert.deepEqual(parseVerdict({ body: blockWith(['findings:', '  - id: "F-1"']) }).findings, [{ id: 'F-1' }]);
});

test('#452: the INLINE empty encoding is untouched — `findings: []` still round-trips (REQ-452-3)', () => {
  // This path is caught by `scalar()` before the block branch ever runs, and it
  // is the one that ALREADY worked. #381's post-mortem records that this is
  // precisely why that defect stayed hidden — the empty case round-tripped. The
  // repair to the broken encoding must not move the working one.
  const parsed = parseVerdict({ body: blockWith(['findings: []']) });
  assert.equal('findings' in parsed, true);
  assert.deepEqual(parsed.findings, []);
});

test('#452: renderVerdict → parseVerdict closes the round trip for an empty findings list (REQ-452-4)', () => {
  const built = buildVerdict({ headSha: 'abc123', conclusion: 'APPROVE', findings: [] });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual(parsed.findings, [],
    'an empty findings list must survive the trip — the field is now pinnable at the PARSER level, ' +
    'which is what PR #444 could not do (its REQ-409-6 had to assert at the wire level instead)');
});

test('#452: the renderer is UNCHANGED — follow_ups stays absent from what brain emits (REQ-452-6)', () => {
  // The in-scope check. The renderer half (should renderVerdict emit `follow_ups: []`
  // the way it emits `findings: []`?) is a PROTOCOL choice and belongs to #408, which
  // is also what makes follow_ups reachable at all. If this goes red, this change
  // touched something it was not supposed to.
  const built = buildVerdict({ headSha: 'abc123', conclusion: 'APPROVE', findings: [] });
  const rendered = renderVerdict(built);
  assert.doesNotMatch(rendered, /^follow_ups:/m);
  assert.equal('follow_ups' in parseVerdict({ body: rendered }), false);
});

// ── #452 review round: `[]` must mean EMPTY, never UNREADABLE ───────────────
//
// Cold review of PR #478, finding 1 (blocker). The first version of this change
// returned `entries` unconditionally, which made `[]` the answer for BOTH "the
// key's list is empty" and "the key had a body this parser could not read".
// Reproduced: a foreign verdict carrying REAL findings in 0-indent YAML block
// sequence — the shape `yaml.dump` emits by default — parsed as `findings: []`,
// i.e. a positive, trusted assertion that the reviewer found nothing. On main it
// was `undefined` (unknown). That inverts the failure direction on exactly the
// population this fix exists for (cold-boot/board read FOREIGN verdicts), and it
// is the anti-pattern's own rule read backwards:
//
//   brain/core/anti-patterns/evidence-reader-empty-on-failure.md —
//   "null = uncomputable (the fetch failed), [] / '' = genuinely empty."
//
// So: `[]` only when the body under the key is genuinely absent; `null` when
// there was content there and this parser could not read it.

test('#452/#478-F1: a foreign 0-indent YAML list with REAL entries is UNREADABLE (null), never an empty finding list', () => {
  const parsed = parseVerdict({ body: blockWith(['findings:', '- id: F-1', '  severity: blocker']) });
  assert.equal('findings' in parsed, false,
    'this block CARRIES two findings this parser cannot read — reporting findings: [] would tell the ' +
    'consumer the reviewer found nothing, which is the inversion protocol §10 forbids');
});

test('#452/#478-F1: other unreadable indentations are also null, not empty', () => {
  for (const shape of [
    ['findings:', '    - id: F-1'],          // 4-space sequence
    ['findings:', '\t- id: F-1'],            // tab-indented
    ['findings:', '  - "id": F-1'],          // quoted key — ENTRY_OPEN_RE rejects it
    ['findings:', '', '- id: F-1'],          // blank line then foreign content
  ]) {
    const parsed = parseVerdict({ body: blockWith(shape) });
    assert.equal('findings' in parsed, false, `unreadable body reported as empty: ${JSON.stringify(shape)}`);
  }
});

test('#452/#478-F1: a genuinely empty list is still [] — the fix must not swallow the case it exists for', () => {
  // Both ways a list can legitimately be empty: followed by the next top-level
  // key, and sitting at the end of the block. If either of these returned null
  // the blocker fix would have undone #452 itself.
  assert.deepEqual(parseVerdict({ body: blockWith(['findings:', 'conditions: []']) }).findings, [],
    'key followed by the next top-level key — genuinely empty');
  assert.deepEqual(parseVerdict({ body: blockWith(['findings:']) }).findings, [],
    'key at the end of the block — genuinely empty');
});

test('#452/#478-F2: a trailing space on the key line routes to the INLINE branch — a known boundary, pinned not claimed', () => {
  // Cold review finding 2: `scalar()`'s `^key:[ \t]*(.+)$` backtracks so `(.+)`
  // captures the trailing space, `inline` becomes '' (non-null), the block branch
  // is never reached, and parseJsonScalar('') throws -> null. So a key line with a
  // trailing space returns null EVEN WITH ENTRIES under it.
  //
  // Pre-existing on main and NOT fixed here (the candidate repair is `(.+)` ->
  // `(\S.*)` in `scalar`, which touches every scalar read in the block — its own
  // change). Pinned so the state table in spec.md and the JSDoc cannot claim a
  // completeness this parser does not have.
  const withSpace = parseVerdict({ body: blockWith(['findings: ', '  - id: "F-1"']) });
  assert.equal('findings' in withSpace, false, 'documents the boundary — see #477');
  const clean = parseVerdict({ body: blockWith(['findings:', '  - id: "F-1"']) });
  assert.deepEqual(clean.findings, [{ id: 'F-1' }], 'the control: without the trailing space the entries parse');
});

// ── #478 second cold review, F1: a PARTIAL read is uncomputable too ─────────
//
// The first correction applied the unreadable check only in the
// `entries.length === 0` branch. If even ONE entry parsed before the scan hit
// content it could not read, the function returned the truncated prefix as a
// confident, positive list — the same inversion one branch further up, and the
// shipped state table asserted the opposite.
//
// This state is reachable from brain's OWN renderer: `yamlScalar` quotes but
// does not escape newlines (verdict.mjs), and checkpoint.mjs interpolates the
// full multi-line stdout of brain-governance-status into `evidence:`. Measured
// before the fix: a two-finding verdict rendered and re-parsed yielded ONE
// finding, silently dropping a blocker, with `'findings' in parsed === true`.
//
// (The renderer's newline handling is the root cause and is its own ticket —
// no parser can read that block correctly. What this parser CAN do is refuse to
// present a partial read as a complete one.)

test('#478-2/F1: a partially-readable list is uncomputable (null) — never a confident truncated prefix', () => {
  const parsed = parseVerdict({
    body: blockWith(['findings:', '  - id: "F-1"', '    severity: "blocker"', 'line two of a multi-line scalar']),
  });
  assert.equal('findings' in parsed, false,
    'one entry parsed and then the scan hit unreadable content — reporting [F-1] would hide whatever ' +
    'followed it behind a positive, complete-looking list');
});

test('#478-2/F1 → #481: through the REAL renderer, multi-line evidence ROUND-TRIPS — no finding may vanish silently', () => {
  // MOVED, not deleted. This case first asserted `'findings' in parsed === false`
  // — the honest "uncomputable" answer for a block the parser could not fully
  // read — because `yamlScalar` quoted but did not ESCAPE newlines, so brain's
  // own renderer emitted a list that terminated at the first continuation line.
  //
  // The maintainer ruled #481 in scope for this change, so the emitter is fixed
  // and that premise is gone: this renderer can no longer produce that block. The
  // assertion moves to the stronger property it was standing in for — every
  // finding survives — instead of being deleted along with the defect.
  //
  // The parser-side guarantee it used to carry is NOT lost: the hand-built case
  // above still pins "partial read → null" for input this renderer cannot emit
  // but a foreign, older, or hand-authored source can.
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [
      { id: 'multi', severity: 'blocker', evidence: 'line one\nline two', cites: 'x.md' },
      { id: 'tier2-touch', severity: 'blocker', evidence: 'brain/core/x.md', cites: 'y.md' },
    ],
  });
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual((parsed.findings ?? []).map(f => f.id), ['multi', 'tier2-touch'],
    'a 2-finding verdict must re-parse to 2 findings — before #481 this dropped the second, a BLOCKER');
  assert.equal(parsed.findings[0].evidence, 'line one\nline two',
    'and the multi-line evidence must decode back to its exact characters');
});

test('#478-2/F1: a FULLY readable multi-entry list is unaffected — the control', () => {
  const parsed = parseVerdict({
    body: blockWith(['findings:', '  - id: "F-1"', '  - id: "F-2"', 'conditions: []']),
  });
  assert.deepEqual(parsed.findings, [{ id: 'F-1' }, { id: 'F-2' }]);
});

// ── #478 THIRD cold review, blocker 1: which lines may END a list ───────────
//
// The round-2 correction established "unreadable → null at ANY entry count" as a
// normative requirement in three places — and never interrogated the predicate
// that decides "unreadable". `TOP_LEVEL_KEY_RE` accepted ANY `word:` at column 0
// as the next top-level key, so unreadable content whose first line happens to
// look like one was read as a CLEAN END and the truncated prefix came back as a
// confident, complete list.
//
// The falsifying shape is the likeliest one in production, not a corner case:
// `brain-governance-status`'s stdout — what checkpoint.mjs interpolates into
// `evidence:` — contains lines like `Tier: 2`.
//
// The list can only be ended by a key this protocol actually emits.

test('#478-3/B1: content that merely LOOKS like a key does not end the list — the prefix must not be returned as complete', () => {
  const parsed = parseVerdict({
    body: blockWith([
      'findings:',
      '  - id: "F-1"',
      '    evidence: "line one',
      'Tier: 2',                       // <- from real governance-status stdout
      '  - id: "F-2-BLOCKER"',
      'conditions: []',
    ]),
  });
  assert.equal('findings' in parsed, false,
    'the scan broke on unreadable content; "Tier:" is not a verdict key, so this block is uncomputable — ' +
    'returning [F-1] would drop F-2-BLOCKER AND assert the remainder is the whole set');
});

test('#478-3/B1: a REAL next key still ends the list cleanly — the control', () => {
  const parsed = parseVerdict({ body: blockWith(['findings:', '  - id: "F-1"', 'conditions: []']) });
  assert.deepEqual(parsed.findings, [{ id: 'F-1' }]);
  assert.deepEqual(parseVerdict({ body: blockWith(['findings:', 'conditions: []']) }).findings, []);
});

test('#478-3/B1: the terminator set does not drift from what renderVerdict emits', () => {
  // The list-ending predicate names the protocol's own keys. If renderVerdict
  // gains a top-level key and this set is not updated, a verdict carrying that
  // key would parse as "unreadable" — failing safe, but wrongly. This test is
  // the drift guard the loose regex made impossible.
  const built = buildVerdict({
    headSha: 'abc123',
    conclusion: 'REVISE',
    findings: [{ id: 'F-1', severity: 'blocker', evidence: 'x', cites: 'y' }],
    conditions: ['c'],
    sequencing: ['seq:x'],
    pin: { a: 1 },
  });
  const block = renderVerdict(built).split('```')[1];
  const emitted = block.split('\n')
    .map(l => l.match(/^([A-Za-z_][A-Za-z0-9_]*):/))
    .filter(Boolean).map(m => m[1]);
  assert.ok(emitted.length >= 6, `expected several top-level keys, got ${JSON.stringify(emitted)}`);
  // `findings` is excluded as its own terminator: a second `findings:` line in the
  // same block is matched by `scalar()`'s inline branch before the list branch
  // ever runs, so the probe would measure that instead. A key cannot end its own
  // list, and no renderer emits one twice.
  for (const key of emitted.filter(k => k !== 'findings')) {
    const probe = parseVerdict({ body: blockWith(['findings:', `${key}: whatever`]) });
    assert.deepEqual(probe.findings, [],
      `renderVerdict emits top-level "${key}" but the parser does not accept it as a list terminator — ` +
      'a verdict carrying it after a list would parse as unreadable');
  }
});

// ── #478 round 4: ONE encoder must not have TWO decoders ────────────────────
//
// Found by the fourth cold review, which was tracing this to board.mjs's label
// writes when it died mid-run; reproduced and confirmed from its probe.
//
// `yamlScalar` is the single emitter. Two functions decode it:
//   unyamlScalar   — used for findings/follow_ups ENTRY fields
//   parseJsonScalar — used for `pin`, `sequencing`, and the INLINE list form
//
// When #481 taught the encoder to escape line terminators, only `unyamlScalar`
// learned to decode them. `parseJsonScalar` kept a generic `\X -> X` strip,
// which turns the new `\u2028` escape into the literal text `u2028`:
//
//   in : seq:blocked-on<U+2028>411
//   out: seq:blocked-onu2028411
//
// That is not cosmetic. `sequencing` is the ONE member of this family with a
// destructive live consumer: board.mjs's reconcileBoardLabels compares the
// parsed list against the PR's current labels, so a corrupted name puts the
// REAL label in toRemove and a fabricated one in toAdd.

test('#478-4: `sequencing` round-trips through the REAL encoder when a value carries a line separator', () => {
  const built = buildVerdict({ headSha: 'abc123', conclusion: 'APPROVE', findings: [] });
  built.sequencing = ['seq:after-411', 'seq:blocked-on\u2028411'];
  const parsed = parseVerdict({ body: renderVerdict(built) });
  assert.deepEqual(parsed.sequencing, built.sequencing,
    'a decoder that does not mirror the encoder corrupts the label NAME — and board.mjs deletes labels by name');
});

test('#478-4: the same holds for every escape the encoder emits, on BOTH decoders', () => {
  // The entry path (unyamlScalar) and the JSON path (parseJsonScalar) must agree,
  // because one emitter feeds both. Any value the encoder can produce must come
  // back identical on either route.
  const nasty = ['a\nb', 'a\rb', 'a\u2028b', 'a\u2029b', 'a"b', 'a\\b', 'a\\nb'];
  for (const v of nasty) {
    const built = buildVerdict({
      headSha: 'abc123',
      conclusion: 'REVISE',
      findings: [{ id: 'f', severity: 'blocker', evidence: v, cites: 'c' }],
    });
    built.sequencing = [v];
    const parsed = parseVerdict({ body: renderVerdict(built) });
    assert.equal(parsed.findings[0].evidence, v, `entry path corrupted ${JSON.stringify(v)}`);
    assert.deepEqual(parsed.sequencing, [v], `JSON path corrupted ${JSON.stringify(v)}`);
  }
});
