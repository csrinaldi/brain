// actors-model.test.mjs — buildActorsModel merges the actors and reviews
// sections into one row per actor, humans and agents in the same table
// under the same schema (#882 R882-6). No ranking: rows sort by actor name,
// never by record count or review count.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildActorsModel, REVIEWS_CAVEAT, PRS_MERGED_ABSENT } from './actors-model.mjs';

const actorRow = (over = {}) => ({ actor: 'alice', actorKind: 'human', records: 3, byType: { proposal: 2, decision: 1 }, first: '2026-08-01T00:00:00Z', last: '2026-09-01T00:00:00Z', ...over });
const thread = (over = {}) => ({ pr: 1, ok: true, verdicts: [], latest: null, ...over });
const verdict = (over = {}) => ({ pr: 1, head_sha: 'abc', rev: 1, verdict: 'PASS', author: 'bob', findings: [], findingCount: 0, malformed: [], ...over });

test('#882 R882-6: actorsSection.ok === false is the whole model\'s own reason', () => {
  const model = buildActorsModel({ ok: false, reason: 'records could not be read: boom' }, { ok: true, value: [] });
  assert.deepEqual(model, { ok: false, reason: 'records could not be read: boom' });
});

test('#882 R882-6: a record-only actor and a forge-only actor both get a row, the second actorKind: null with the stated reason', () => {
  const model = buildActorsModel(
    { ok: true, value: [actorRow({ actor: 'alice' })] },
    { ok: true, value: [thread({ verdicts: [verdict({ author: 'carol' })] })] },
  );
  assert.equal(model.ok, true);
  const names = model.value.rows.map((r) => r.actor);
  assert.deepEqual(names, ['alice', 'carol'], 'both rows exist, sorted by name — never dropped, never ranked by volume');
  const carol = model.value.rows.find((r) => r.actor === 'carol');
  assert.equal(carol.actorKind, null);
  assert.equal(carol.actorKindReason, 'kind unknown — no record carries it yet');
  const alice = model.value.rows.find((r) => r.actor === 'alice');
  assert.equal(alice.actorKind, 'human');
  assert.equal(alice.actorKindReason, null, 'a record-backed actor carries no "kind unknown" reason');
});

test('#882 R882-6: reviewsPosted carries the open-PRs-only caveat verbatim, and counts verdicts filtered to that actor', () => {
  const model = buildActorsModel(
    { ok: true, value: [actorRow({ actor: 'alice' })] },
    { ok: true, value: [thread({ verdicts: [verdict({ author: 'alice' }), verdict({ author: 'alice' }), verdict({ author: 'bob' })] })] },
  );
  const alice = model.value.rows.find((r) => r.actor === 'alice');
  assert.deepEqual(alice.reviewsPosted, { ok: true, count: 2, caveat: REVIEWS_CAVEAT });
});

test('#882 R882-6: every row\'s prsMerged is the stated-absence shape, never a bare 0', () => {
  const model = buildActorsModel({ ok: true, value: [actorRow({ actor: 'alice' })] }, { ok: true, value: [] });
  const [alice] = model.value.rows;
  assert.deepEqual(alice.prsMerged, PRS_MERGED_ABSENT);
  assert.notEqual(alice.prsMerged, 0);
});

test('#882 R882-6: reviewsSection.ok === false degrades per-row, not the whole view — records-based rows still render', () => {
  const model = buildActorsModel(
    { ok: true, value: [actorRow({ actor: 'alice' })] },
    { ok: false, reason: 'the forge could not be reached' },
  );
  assert.equal(model.ok, true, 'one degraded section never blanks the whole view');
  const [alice] = model.value.rows;
  assert.deepEqual(alice.reviewsPosted, { ok: false, reason: 'the forge could not be reached' });
});

test('#882 R882-6: an unreadable thread inside an otherwise-ok reviews section contributes nothing, never throws', () => {
  const model = buildActorsModel(
    { ok: true, value: [actorRow({ actor: 'alice' })] },
    { ok: true, value: [thread({ ok: false, reason: 'thread unreadable', verdicts: undefined }), thread({ verdicts: [verdict({ author: 'alice' })] })] },
  );
  const [alice] = model.value.rows;
  assert.deepEqual(alice.reviewsPosted, { ok: true, count: 1, caveat: REVIEWS_CAVEAT });
});

test('#882 R882-6: rows sort by actor name, never by record count or review count — no ranking', () => {
  const model = buildActorsModel(
    { ok: true, value: [actorRow({ actor: 'zack', records: 50 }), actorRow({ actor: 'amy', records: 1 })] },
    { ok: true, value: [] },
  );
  assert.deepEqual(model.value.rows.map((r) => r.actor), ['amy', 'zack']);
});

test('#882 R882-6: a record-only actor with no review rounds still reads reviewsPosted count 0 with the caveat, never a bare unstated number', () => {
  const model = buildActorsModel({ ok: true, value: [actorRow({ actor: 'alice' })] }, { ok: true, value: [] });
  const [alice] = model.value.rows;
  assert.deepEqual(alice.reviewsPosted, { ok: true, count: 0, caveat: REVIEWS_CAVEAT });
});

test('#882 R882-6: every row goes through governance-model.mjs\'s own row() helper — carries a sourceStamp, never a second provenance shaper', () => {
  const model = buildActorsModel({ ok: true, value: [actorRow({ actor: 'alice' })] }, { ok: true, value: [] });
  const [alice] = model.value.rows;
  assert.deepEqual(alice.sourceStamp, { label: '[no source was recorded for this value]', href: null, kind: 'none' }, 'an actor row has no single per-row file/URL — row(null) states that honestly, rather than fabricating one');
});
