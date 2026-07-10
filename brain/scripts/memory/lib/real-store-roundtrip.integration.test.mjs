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
import { computeRecordId } from './format.mjs';

// Same depth as engram.mjs's repoRoot (brain/scripts/memory/backends/engram.mjs):
// this file lives at brain/scripts/memory/lib/, a sibling directory at the
// same depth — four levels up reaches the repo root.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const recordsDir = join(repoRoot, '.memory', 'records');

test('REQ-C4-1: round-trip id-equality holds for every record in the REAL .memory/records/ store', () => {
  const records = readRecordObservations({ recordsDir });

  if (records.length === 0) {
    // Honest skip, not a false pass — zero coverage must be visible, never masked.
    console.warn(
      'REQ-C4-1: .memory/records/ is empty or missing — 0 real records exercised. ' +
        'This is a coverage GAP, not a pass. Skipping the assertion loop.',
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
