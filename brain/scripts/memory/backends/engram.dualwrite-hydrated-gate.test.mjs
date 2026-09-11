// engram.dualwrite-hydrated-gate.test.mjs — fresh-review F1 (#924, PR A of
// #874): `dualWriteRecords()` must never re-export an observation that
// `hydrate()` (#874 split A) itself produced.
//
// Restored by the PR B fresh-review fix batch (finding B1): O1 (ratified
// 2026-09-11) keeps `dualWriteRecords()` intact — its deletion belongs to
// epic task 2.4 (or 1.2a), not split B. Split B only retires `share()`'s
// call into it (row 1); the gate itself, and its direct-call tests, must
// survive that.
//
// Only the first two tests from the original file are restored here — the
// two that call `dualWriteRecords()` DIRECTLY. The original file's third
// test ("share: surfaces skippedHydrated in its returned accounting") drove
// the gate THROUGH `share()`'s old `_readObservations`/`_exportObservation`
// seams, which B1 legitimately retired along with the exporter (row 1);
// `share()` has no observation source to thread that test through anymore,
// so it is intentionally NOT restored.
//
// Why this is a duplicate, not merely redundant: `_defaultEngramSave`
// (engram.mjs's `hydrate()` terminal step) shells `engram save … --topic
// <record id>` with NO `--created-at` flag, so engram stamps its OWN
// `created_at` on the row. `exportObservation()` (engram-export.mjs) derives
// `ts` from `created_at`, and `ts` is hashed by `computeRecordId`
// (format.mjs) — so a hydrated observation, re-exported through this
// function, mints a SECOND record with a DIFFERENT id the moment the two
// clocks disagree by even one second. An observation whose `topic_key`
// already matches the record-id grammar (`rec-[0-9a-f]{16}`) was BORN from a
// record; re-deriving one from it can only ever reproduce (best case) or
// duplicate (every other case) a record `dualWriteRecords` did not need to
// rediscover. The gate must not outlive its test: any future caller handing
// `dualWriteRecords` an observation source (2.4/1.2a heal) needs this guard.
//
// Gated on grammar alone, not on local presence (see the second test below):
// records are additions-only and this repo's local `.memory/records/` is
// only ever a partial index of what a given engram store may hold — a
// `rec-…` topic with no local match is still evidence the row started life
// as a record somewhere, never evidence it is safe to re-export.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dualWriteRecords } from './engram.mjs';
import { buildRecord } from '../lib/format.mjs';

const baseRecordFields = {
  ts: '2026-09-10T09:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

test('dualWriteRecords: an observation whose topic_key is a record id is skipped, counted, and never reaches exportObservation', async () => {
  const plain = { id: 1, topic_key: null, scope: 'project', type: 'decision', project: 'brain', title: '', content: 'plain', created_at: '2026-09-10 09:00:00' };
  const hydrated = { id: 2, topic_key: 'rec-0123456789abcdef', scope: 'project', type: 'decision', project: 'brain', title: '', content: 'hydrated', created_at: '2026-09-10 09:00:05' };

  const recA = buildRecord({ ...baseRecordFields, content: 'plain' });
  let exportObservationCalls = 0;

  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [plain, hydrated] }),
    _exportObservation: (obs) => {
      exportObservationCalls += 1;
      assert.notEqual(obs.id, 2, 'the hydrated observation must never reach _exportObservation');
      return { record: recA, recovered: true };
    },
    _appendRecord: () => {},
    _readRecordIds: () => new Set(),
    _rebuildIndex: () => ({ count: 1, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } }),
    _loadConfig: () => ({}),
  });

  assert.equal(exportObservationCalls, 1, 'only the plain observation is transformed');
  assert.equal(result.skippedHydrated, 1);
  assert.equal(result.written, 1);
});

test('dualWriteRecords: a rec-topic observation is skipped even when NO local record shares its id — records are additions-only, so absence locally is never proof of safety', async () => {
  // No `_readRecordIds` entry for 'rec-fedcba9876543210' — the gate must not
  // consult the local store at all before deciding to skip; the grammar match
  // alone is the whole decision (see file header).
  const orphanHydrated = { id: 3, topic_key: 'rec-fedcba9876543210', scope: 'project', type: 'decision', project: 'brain', title: '', content: 'orphan', created_at: '2026-09-10 09:00:10' };

  const result = await dualWriteRecords('/fake/root', {
    _readObservations: () => ({ observations: [orphanHydrated] }),
    _exportObservation: () => { throw new Error('_exportObservation must never be called for a rec- topic, local match or not'); },
    _appendRecord: () => { throw new Error('nothing to append — the only candidate was skipped'); },
    _readRecordIds: () => new Set(), // deliberately empty — no local match
    _rebuildIndex: () => { throw new Error('zero candidates — dualWriteRecords must early-return before any rebuild'); },
    _loadConfig: () => ({}),
  });

  assert.equal(result.skippedHydrated, 1);
  assert.equal(result.written, 0);
  assert.equal(result.deduped, 0, 'skippedHydrated is its own bucket, never folded into deduped');
});
