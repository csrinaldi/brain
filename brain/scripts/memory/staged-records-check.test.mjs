// staged-records-check.test.mjs — issue #701, design.md Decision 6.
//
// `evaluateStagedRecords` is pure — no git, no filesystem — mirroring
// `actor-check.mjs#evaluateActor`'s split (pure evaluator + I/O wrapper).
// `parseStagedDiff`/`stagedRecordDiff` (the I/O half) are covered indirectly
// through `runStagedRecordsCheck` in a real-git integration test, following
// `upstream-records.integration.test.mjs`'s own division of labour.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { evaluateStagedRecords, parseStagedDiff, runStagedRecordsCheck } from './staged-records-check.mjs';

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

// ── R/C: git emits SOURCE first, DESTINATION second ─────────────────────────
//
// The branch that consumes a rename's second path token had ZERO coverage, and
// the code under it was backwards: it kept the SOURCE and discarded the
// destination, calling the destination "the old path". Found by cold review of
// #707, and it broke the gate in BOTH directions — a byte-identical restage was
// allowed whenever git paired it with a record deletion, and a legitimate
// `git mv` was refused while naming the file being deleted. (Not "an UNRELATED
// deletion": git pairs on byte similarity, and two real same-session records
// are measurably not similar enough to pair — see the module's own note.)
//
// The axis these tests add is STATUS: every fixture above is A/M/D, none is
// R or C, so nothing distinguished "took the right token" from "took a token".

test('parseStagedDiff: a rename yields the DESTINATION path, which is the one dstOid describes', () => {
  const text =
    `:100644 100644 ${OID_A} ${OID_B} R083\0` +
    '.memory/records/2026-08-rec-1111111111111111.jsonl\0' + // source
    '.memory/records/2026-08-rec-2222222222222222.jsonl\0';  // destination
  const r = parseStagedDiff(text);
  assert.equal(r.length, 1);
  assert.equal(r[0].path, '.memory/records/2026-08-rec-2222222222222222.jsonl',
    'the source path is not the one being written — pairing it with dstOid is what let a restage through');
  assert.equal(r[0].dstOid, OID_B);
});

test('parseStagedDiff: a copy behaves like a rename — the destination wins', () => {
  const text =
    `:100644 100644 ${OID_A} ${OID_B} C100\0` +
    '.memory/records/2026-08-rec-1111111111111111.jsonl\0' +
    '.memory/records/2026-08-rec-3333333333333333.jsonl\0';
  assert.equal(parseStagedDiff(text)[0].path, '.memory/records/2026-08-rec-3333333333333333.jsonl');
});

test('parseStagedDiff: the SAME write parses identically whether git pairs it as a rename or not', () => {
  // The verdict must not depend on whether an unrelated deletion happened to
  // sit in the same commit — that is the accident that made the gate silent.
  const target = '.memory/records/2026-08-rec-2222222222222222.jsonl';
  const asAdd = `:000000 100644 ${ZERO} ${OID_B} A\0${target}\0`;
  const asRename =
    `:100644 100644 ${OID_A} ${OID_B} R083\0.memory/records/2026-08-rec-1111111111111111.jsonl\0${target}\0`;

  const a = parseStagedDiff(asAdd)[0];
  const b = parseStagedDiff(asRename)[0];
  assert.equal(a.path, b.path, 'same file, same path, regardless of how git framed it');
  assert.equal(a.dstOid, b.dstOid, 'and the same blob is what the gate compares');
});

test('parseStagedDiff: a rename with its destination token missing does not fabricate one', () => {
  const truncated = `:100644 100644 ${OID_A} ${OID_B} R083\0.memory/records/2026-08-rec-1111111111111111.jsonl\0`;
  assert.deepEqual(parseStagedDiff(truncated), [], 'a truncated entry is dropped, never guessed at');
});

test('parseStagedDiff: empty text yields no entries', () => {
  assert.deepEqual(parseStagedDiff(''), []);
});

test('parseStagedDiff: garbage never throws', () => {
  assert.doesNotThrow(() => parseStagedDiff('garbage\0more garbage\0'));
});

// ---------------------------------------------------------------------------
// runStagedRecordsCheck — the config LEVEL reaches the upstream lookup.
//
// This is the SECOND of the two entry points that defaulted `config = {}` and
// so killed `upstream-records.mjs`'s "omitted → read from root" contract (cold
// review of #708). It is exercised with the REAL `upstreamRecordEntries`
// (only git and the staged diff are faked), because a stubbed
// `_upstreamRecordEntries` would prove the argument was passed and nothing
// about whether it is honored.
// ---------------------------------------------------------------------------

/**
 * A tmpdir removed when the test ends — the convention
 * `staged-records-check.integration.test.mjs:35-43` already follows. Without it
 * this file leaks one directory per run (cold review round 2 of #701).
 */
function tmpRoot(t, configText) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-staged-records-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (configText !== undefined) writeFileSync(join(dir, 'brain.config.json'), configText);
  return dir;
}

test('runStagedRecordsCheck: memory.upstreamRef is read from root when config is omitted', (t) => {
  const root = tmpRoot(t, JSON.stringify({ memory: { upstreamRef: 'origin/stated-by-config' } }));

  const r = runStagedRecordsCheck({
    root,
    env: {},
    // origin/HEAD WOULD resolve — a stated ref must not fall through to it.
    _spawn: (bin, args) => {
      if (args[0] === 'rev-parse') {
        const ref = args[3]?.replace(/\^\{tree\}$/, '');
        return { status: ['origin/HEAD', 'origin/main'].includes(ref) ? 0 : 1 };
      }
      return { status: 0, stdout: '' };
    },
    _stagedRecordDiff: () => ({ ok: true, staged: [] }),
  });

  assert.equal(r.level, 'pass', 'an unresolvable upstream never blocks — the gate degrades open');
  assert.match(r.note, /origin\/stated-by-config/, 'the config-stated ref must reach the upstream lookup');
});

test('runStagedRecordsCheck: _loadConfig is injectable through the wrapper', () => {
  const r = runStagedRecordsCheck({
    root: '/fake',
    env: {},
    _loadConfig: () => ({ memory: { upstreamRef: 'origin/injected-by-seam' } }),
    _spawn: () => ({ status: 1 }),
    _stagedRecordDiff: () => ({ ok: true, staged: [] }),
  });
  assert.equal(r.level, 'pass');
  assert.match(r.note, /origin\/injected-by-seam/);
});
