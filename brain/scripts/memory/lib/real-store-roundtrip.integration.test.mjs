// real-store-roundtrip.integration.test.mjs — REQ-C4-1 (D1, issue #229 C4):
// the round-trip id-equality contract pinned against the REAL committed
// `.memory/records/*.jsonl` store, not a fixture.
//
// HERMETICITY NOTE (finding-#10 doctrine): reading the real `.memory/records/`
// tree here is a DELIBERATE, DOCUMENTED exception — inject/mock everything
// EXCEPT the one thing this test exists to prove. This test exists to prove
// the round-trip contract holds on the ACTUAL migrated data (135 `@legacy`
// records in 2026-06.jsonl + the rest in 2026-07.jsonl), so reading that real
// tree IS the point, not a hermeticity violation. A future reader must NOT
// "fix" this into a fixture-only test — that would silently stop covering the
// real store and defeat REQ-C4-1 (spec.md, scenario "id-equality over every
// real committed record").
//
// C2a pin (format.mjs:66-82): equality here is `id`/`hashInput` equality, NOT
// byte/field equality. `source` is EXCLUDED from the hash — an `issue`
// record with no `source` still round-trips by id even though re-export
// synthesizes a `**Fuente:** issue #N` line (see the existing synthetic pin
// in engram-import.test.mjs:46-60, extended in spirit here for the real
// store's dominant @legacy shape, which carries `source` but no `issue`).
//
// Degenerate-state contract: an empty/missing `.memory/records/` tree SKIPS
// with an explicit, honest message — never a false green that silently hides
// zero coverage (readRecordObservations() already returns `[]` rather than
// throwing on an absent directory, per store.mjs's contract).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRecordObservations } from './store.mjs';
import { importRecord } from './engram-import.mjs';
import { exportObservation } from './engram-export.mjs';
import { buildRecord, computeRecordId, validateRecord } from './format.mjs';

// Same depth as engram.mjs's repoRoot (brain/scripts/memory/backends/engram.mjs):
// this file lives at brain/scripts/memory/lib/, a sibling directory at the
// same depth — four levels up reaches the repo root.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const recordsDir = join(repoRoot, '.memory', 'records');

test('REQ-C4-1: round-trip id-equality holds for every record in the REAL .memory/records/ store', (t) => {
  const records = readRecordObservations({ recordsDir });

  if (records.length === 0) {
    // Real skip, not a false pass — an early `return` is reported as ok/pass by
    // node:test, masking zero coverage. t.skip() makes the gap visible in output.
    t.skip(
      'REQ-C4-1: .memory/records/ is empty or missing — 0 real records exercised. ' +
        'This is a coverage GAP, not a pass.',
    );
    return;
  }

  const failures = [];
  for (const record of records) {
    const observation = importRecord(record);
    const { record: exported, rejected, skipped } = exportObservation(observation);
    if (rejected || skipped) {
      failures.push(
        `${record.id ?? '(missing id)'}: round-trip was ${rejected ? 'REJECTED' : 'SKIPPED'} — ${JSON.stringify(rejected ?? skipped)}`,
      );
      continue;
    }
    const recomputedId = computeRecordId(exported);
    if (recomputedId !== record.id) {
      failures.push(
        `${record.id ?? '(missing id)'}: recomputed id '${recomputedId}' does not match the stored id`,
      );
    }
  }

  console.log(`REQ-C4-1: round-trip id-equality exercised over ${records.length} real records from .memory/records/`);
  assert.deepEqual(
    failures,
    [],
    `${failures.length}/${records.length} real records failed round-trip id-equality:\n${failures.join('\n')}`,
  );
});

test('REQ-C4-1: the @legacy shape (source set, no issue) — the dominant real-store case — round-trips by id', () => {
  const records = readRecordObservations({ recordsDir });
  const legacyRecords = records.filter((r) => r.actor === '@legacy' && r.source !== undefined && r.issue === undefined);

  if (legacyRecords.length === 0) {
    console.warn('REQ-C4-1: no @legacy source-without-issue records found in the real store — skipping this sub-assertion.');
    return;
  }

  const sample = legacyRecords[0];
  const observation = importRecord(sample);
  const { record: exported, rejected, skipped } = exportObservation(observation);
  assert.equal(rejected, undefined, 'the @legacy sample must not be rejected on round-trip');
  assert.equal(skipped, undefined, 'the @legacy sample must not be skipped on round-trip');
  assert.equal(computeRecordId(exported), sample.id, '@legacy source-without-issue round-trips by id');
});

// ── issue #404 — the shape the real store cannot yet demonstrate ────────────
// The store is 0/2157 on `issue` (measured), which is exactly WHY the defect
// survived: the round-trip contract was green over a field no producer had
// ever populated, and the first record to carry it turned REQ-C4-1 red.
//
// The test above can therefore never cover the field from committed data
// alone, and waiting for a producer (#368) to appear would leave the contract
// unexercised in the one direction that broke. So this derives issue-carrying
// records FROM the real store's own records — real content bytes, real
// `source` prose, real timestamps — rather than from a fixture. It is the
// same deliberate real-tree read the header documents, not a second store.
//
// A future reader must NOT relax this to fixtures: a fixture cannot prove the
// field survives the real store's actual `source` shapes (2125/2157 carry the
// `@legacy` migration prose, which cites no issue and so exercises exactly the
// render path that used to drop `issue`).

test('REQ-C4-1 / #404: real records re-stamped with an `issue` still round-trip by id', () => {
  const records = readRecordObservations({ recordsDir });

  if (records.length === 0) {
    console.warn('REQ-C4-1/#404: .memory/records/ is empty — skipping the issue-carrying sub-assertion.');
    return;
  }

  // A spread of real shapes: with and without `source`, across both actors.
  const withSource = records.filter((r) => r.source !== undefined).slice(0, 25);
  const withoutSource = records.filter((r) => r.source === undefined).slice(0, 25);
  const samples = [...withSource, ...withoutSource];
  assert.ok(samples.length > 0, 'the real store must yield at least one sample record');

  const failures = [];
  for (const sample of samples) {
    // Rebuild through buildRecord() so the id is the one this record WOULD
    // have carried had its author populated `issue` — never a hand-computed
    // hash, and never a second hasher.
    const issued = buildRecord({
      ts: sample.ts,
      actor: sample.actor,
      actorKind: sample.actorKind,
      type: sample.type,
      project: sample.project,
      content: sample.content,
      issue: 404,
      ...(sample.source !== undefined ? { source: sample.source } : {}),
    });
    assert.equal(issued.issue, 404, 'precondition: the derived record carries the field');

    const { valid, errors } = validateRecord(issued);
    if (!valid) {
      failures.push(`${sample.id}: derived record failed validation — ${errors.join('; ')}`);
      continue;
    }

    const { record: exported, rejected, skipped } = exportObservation(importRecord(issued));
    if (rejected || skipped) {
      failures.push(`${sample.id}: round-trip was ${rejected ? 'REJECTED' : 'SKIPPED'}`);
      continue;
    }
    if (exported.issue !== 404) {
      failures.push(`${sample.id}: issue came back as ${JSON.stringify(exported.issue)}, not 404`);
      continue;
    }
    const recomputedId = computeRecordId(exported);
    if (recomputedId !== issued.id) {
      failures.push(`${sample.id}: recomputed id '${recomputedId}' !== derived id '${issued.id}'`);
    }
  }

  console.log(
    `REQ-C4-1/#404: issue-carrying round-trip exercised over ${samples.length} records derived from the real store`,
  );
  assert.deepEqual(failures, [], `${failures.length}/${samples.length} issue-carrying records failed:\n${failures.join('\n')}`);
});

test('REQ-C4-1 / R4: no record in the REAL store smuggles an `issue #N` citation into `source` without the field', () => {
  // The one shape the Fuente grammar cannot represent (format.mjs R4). Pinned
  // against the real store so the guard is proven vacuous TODAY and turns red
  // the moment a producer writes the shape — rather than being discovered as
  // another silent id drift.
  const records = readRecordObservations({ recordsDir });
  if (records.length === 0) {
    console.warn('REQ-C4-1/R4: .memory/records/ is empty — skipping.');
    return;
  }
  const offenders = records
    .filter((r) => !validateRecord(r).valid)
    .map((r) => `${r.id}: ${validateRecord(r).errors.join('; ')}`);
  assert.deepEqual(offenders, [], `${offenders.length}/${records.length} real records fail validateRecord:\n${offenders.join('\n')}`);
});
