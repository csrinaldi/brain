// staged-records-check.test.mjs — issue #701, design.md Decision 6.
//
// `evaluateStagedRecords` is pure — no git, no filesystem — mirroring
// `actor-check.mjs#evaluateActor`'s split (pure evaluator + I/O wrapper).
// `parseStagedDiff`/`stagedRecordDiff` (the I/O half) are covered indirectly
// through `runStagedRecordsCheck` in a real-git integration test, following
// `upstream-records.integration.test.mjs`'s own division of labour.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateStagedRecords, parseStagedDiff } from './staged-records-check.mjs';

const ZERO = '0'.repeat(40);
const OID_A = 'a'.repeat(40);
const OID_B = 'b'.repeat(40);

const okUpstream = (byPath) => ({ ok: true, ref: 'origin/main', stated: false, byId: new Map(), byPath, unnamed: [] });

test('evaluateStagedRecords: a staged path byte-identical to the upstream copy is REFUSED', () => {
  const upstream = okUpstream(new Map([['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', OID_A]]));
  const staged = [{ path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: OID_A, status: 'M' }];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'fail');
  assert.deepEqual(r.offending, ['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl']);
});

test('evaluateStagedRecords: divergent bytes at the SAME path are ALLOWED (the source-widening case)', () => {
  const upstream = okUpstream(new Map([['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', OID_A]]));
  const staged = [{ path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: OID_B, status: 'M' }];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'pass');
  assert.deepEqual(r.offending, []);
});

test('evaluateStagedRecords: a genuinely new path (absent upstream) is ALLOWED', () => {
  const upstream = okUpstream(new Map());
  const staged = [{ path: '.memory/records/2026-08-rec-cccccccccccccccc.jsonl', dstOid: OID_A, status: 'A' }];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'pass');
});

test('evaluateStagedRecords: a staged DELETION (dstOid all-zero) is ALLOWED — deleting is a different concern', () => {
  const upstream = okUpstream(new Map([['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', OID_A]]));
  const staged = [{ path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: ZERO, status: 'D' }];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'pass');
});

test('evaluateStagedRecords: an EMPTY upstream (nothing durable yet) allows everything', () => {
  const upstream = okUpstream(new Map());
  const staged = [{ path: '.memory/records/2026-08-rec-dddddddddddddddd.jsonl', dstOid: OID_A, status: 'A' }];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'pass');
});

test('evaluateStagedRecords: upstream lookup unavailable → PASS with a note, never a block', () => {
  const r = evaluateStagedRecords({
    staged: [{ path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: OID_A, status: 'M' }],
    upstream: { ok: false, ref: 'origin/main', stated: false, reason: 'no remote' },
  });
  assert.equal(r.level, 'pass');
  assert.ok(r.note && r.note.length > 0, 'the gate never blocks on a question it could not ask');
});

test('evaluateStagedRecords: multiple staged paths — only the byte-identical one is offending', () => {
  const upstream = okUpstream(new Map([
    ['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', OID_A],
    ['.memory/records/2026-08-rec-bbbbbbbbbbbbbbbb.jsonl', OID_B],
  ]));
  const staged = [
    { path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: OID_A, status: 'M' }, // identical — refuse
    { path: '.memory/records/2026-08-rec-bbbbbbbbbbbbbbbb.jsonl', dstOid: OID_A, status: 'M' }, // divergent — allow
    { path: '.memory/records/2026-08-rec-eeeeeeeeeeeeeeee.jsonl', dstOid: OID_A, status: 'A' }, // new — allow
  ];
  const r = evaluateStagedRecords({ staged, upstream });
  assert.equal(r.level, 'fail');
  assert.deepEqual(r.offending, ['.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl']);
});

// ---------------------------------------------------------------------------
// parseStagedDiff — pure parser over `git diff --cached --raw -z --no-abbrev` output
// ---------------------------------------------------------------------------

test('parseStagedDiff: a modified file', () => {
  const text = `:100644 100644 ${OID_A} ${OID_B} M\0.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl\0`;
  const r = parseStagedDiff(text);
  assert.deepEqual(r, [{ path: '.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl', dstOid: OID_B, status: 'M' }]);
});

test('parseStagedDiff: an added file (src is the zero oid)', () => {
  const text = `:000000 100644 ${ZERO} ${OID_A} A\0.memory/records/2026-08-rec-cccccccccccccccc.jsonl\0`;
  const r = parseStagedDiff(text);
  assert.equal(r[0].status, 'A');
  assert.equal(r[0].dstOid, OID_A);
});

test('parseStagedDiff: a deleted file (dst is the zero oid)', () => {
  const text = `:100644 000000 ${OID_A} ${ZERO} D\0.memory/records/2026-08-rec-aaaaaaaaaaaaaaaa.jsonl\0`;
  const r = parseStagedDiff(text);
  assert.equal(r[0].status, 'D');
  assert.equal(r[0].dstOid, ZERO);
});

test('parseStagedDiff: empty text yields no entries', () => {
  assert.deepEqual(parseStagedDiff(''), []);
});

test('parseStagedDiff: garbage never throws', () => {
  assert.doesNotThrow(() => parseStagedDiff('garbage\0more garbage\0'));
});
