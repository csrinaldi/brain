// record-route.test.mjs — GET /api/record/{id}'s IO (#1313, R1313-8). One
// record's content, read from `.memory/records/` by an id that is validated
// and never made part of a path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { buildRecordView, RECORD_ID_RE, RECORD_FILE_MAX } from './record-route.mjs';
import { DOCUMENT_CAP } from './change-route.mjs';
import { NO_TEXT, EMPTY_TEXT } from '../memory/lib/record-summary.mjs';
import { testTmp } from '../lib/test-tmp.mjs';

const ID = 'rec-0123456789abcdef';
const OTHER = 'rec-fedcba9876543210';

function fixture(records = {}) {
  const root = testTmp('record-route-');
  const dir = join(root, '.memory', 'records');
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(records)) writeFileSync(join(dir, name), text);
  return { root, dir };
}
const line = (over = {}) => `${JSON.stringify({ id: ID, ts: '2026-06-01T00:00:00Z', actor: '@a', actorKind: 'human', type: 'decision', content: '**T**\n\nbody', ...over })}\n`;

test('#1313 R1313-8 S14: a known id answers its content, the file that holds it, and truncated:false', () => {
  const { root } = fixture({ [`2026-06-${ID}.jsonl`]: line() });
  assert.deepEqual(buildRecordView({ root, id: ID }), {
    status: 200,
    body: { ok: true, id: ID, file: `.memory/records/2026-06-${ID}.jsonl`, content: '**T**\n\nbody', truncated: false, truncatedAt: null },
  });
});

test('#1313 R1313-8 S14: an unknown id answers 404 with a reason that names it', () => {
  const { root } = fixture({ [`2026-06-${OTHER}.jsonl`]: line({ id: OTHER }) });
  const view = buildRecordView({ root, id: ID });
  assert.equal(view.status, 404);
  assert.equal(view.body.ok, false);
  assert.match(view.body.reason, new RegExp(ID));
});

test('#1313 R1313-8: a missing records directory is an unknown id, not a crash', () => {
  const root = testTmp('record-route-none-');
  assert.equal(buildRecordView({ root, id: ID }).status, 404);
});

test('#1313 R1313-8 S14: an id that fails the pattern is refused and reads nothing', () => {
  const { root } = fixture({ [`2026-06-${ID}.jsonl`]: line() });
  for (const id of ['..', '../../package.json', '..%2F..%2Fpackage.json', 'rec-xyz', `${ID}0`, `${ID}/..`, `x${ID}`, '', undefined, null, 5]) {
    const view = buildRecordView({ root, id });
    assert.equal(view.status, 400, `${String(id)} must be refused`);
    assert.equal(view.body.ok, false);
  }
  assert.ok(RECORD_ID_RE.test(ID));
  assert.ok(!RECORD_ID_RE.test(`${ID}\n`), 'a trailing newline does not pass a $-anchored pattern');
});

test('#1313 R1313-8: only a file named <yyyy-mm>-<id>.jsonl answers, a lookalike name does not', () => {
  const { root } = fixture({ [`x-${ID}.jsonl`]: line(), [`2026-06-${ID}.jsonl.bak`]: line(), [`2026-06-${ID}x.jsonl`]: line() });
  assert.equal(buildRecordView({ root, id: ID }).status, 404);
});

test('#1313 R1313-8: a symlink in the records directory is never followed', () => {
  const { root, dir } = fixture();
  const outside = join(root, 'outside.jsonl');
  writeFileSync(outside, line());
  symlinkSync(outside, join(dir, `2026-06-${ID}.jsonl`));
  assert.equal(buildRecordView({ root, id: ID }).status, 404);
});

test('#1313 R1313-8 S15: content over DOCUMENT_CAP bytes is cut on a UTF-8 boundary and says truncated', () => {
  const content = `**T**\n${'é'.repeat(DOCUMENT_CAP)}`; // 2 bytes each
  const { root } = fixture({ [`2026-06-${ID}.jsonl`]: line({ content }) });
  const view = buildRecordView({ root, id: ID });
  assert.equal(view.status, 200);
  assert.equal(view.body.ok, true);
  assert.equal(view.body.truncated, true);
  assert.equal(view.body.truncatedAt, Buffer.byteLength(view.body.content, 'utf8'), 'the cut point is stated in bytes, as an SDD document states it');
  assert.ok(Buffer.byteLength(view.body.content, 'utf8') <= DOCUMENT_CAP);
  assert.doesNotMatch(view.body.content, /�/);
});

test('#1313 R1313-8: a record file over the read bound is not read, and the answer says why', () => {
  const { root } = fixture({ [`2026-06-${ID}.jsonl`]: line({ content: 'x'.repeat(RECORD_FILE_MAX + 10) }) });
  const view = buildRecordView({ root, id: ID });
  assert.equal(view.status, 413);
  assert.equal(view.body.ok, false);
  assert.match(view.body.reason, /larger than/);
});

test('#1313 R1313-8 S16: absent content answers NO_TEXT, empty content EMPTY_TEXT, in the summarizer\'s words', () => {
  const absent = fixture({ [`2026-06-${ID}.jsonl`]: `${JSON.stringify({ id: ID, ts: '2026-06-01T00:00:00Z' })}\n` });
  assert.deepEqual(buildRecordView({ root: absent.root, id: ID }).body, { ok: false, reason: NO_TEXT });
  const empty = fixture({ [`2026-06-${ID}.jsonl`]: line({ content: '  \n ' }) });
  assert.deepEqual(buildRecordView({ root: empty.root, id: ID }).body, { ok: false, reason: EMPTY_TEXT });
});

test('#1313 R1313-8: a file whose line does not parse yields no record: the id reads as unknown', () => {
  const { root } = fixture({ [`2026-06-${ID}.jsonl`]: 'not json\n' });
  const view = buildRecordView({ root, id: ID });
  assert.equal(view.status, 404);
  assert.match(view.body.reason, /no record/);
});
