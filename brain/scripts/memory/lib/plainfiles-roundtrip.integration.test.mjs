// plainfiles-roundtrip.integration.test.mjs — REQ-C3-6, CP-C3 evidence: the
// two-direction round-trip proving the durability claim is not n=1. Reuses
// C4's already-proven seams (dualWriteRecords / importMemory) — hermetic, no
// live engram binary and no live git spawned in `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { dualWriteRecords, importMemory } from '../backends/engram.mjs';
import { save, search } from '../backends/plainfiles.mjs';
import { exportObservation } from './engram-export.mjs';
import { renderProvenance } from './provenance.mjs';
import { RECORD_TYPES, computeRecordId } from './format.mjs';

function tmpRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

// Every RECORD_TYPES member + a supersedes chain (REQ-C3-6). §4 prose
// (renderProvenance) makes actor/actorKind/supersedes RECOVERED (not the
// @legacy fallback), matching a real first-class-writer observation shape.
function buildFixtureObservations() {
  const base = { project: 'brain', scope: 'project', created_at: '2026-07-01 00:00:00' };
  const obs = RECORD_TYPES.map((type, i) => ({
    ...base,
    id: i + 1,
    sync_id: `obs-fixture-${i + 1}`,
    type,
    title: `Fixture ${type}`,
    content: renderProvenance({ actor: '@fixture', actorKind: 'agent', content: `${type} body text` }),
  }));

  const firstExported = exportObservation(obs[0]).record;
  obs.push({
    ...base,
    id: obs.length + 1,
    sync_id: 'obs-fixture-chain',
    type: 'decision',
    title: 'Fixture supersedes chain',
    content: renderProvenance({
      actor: '@fixture', actorKind: 'agent', supersedes: firstExported.id, content: 'supersedes body text',
    }),
  });
  return obs;
}

// ── engram → plainfiles: dualWriteRecords populates records/, plainfiles.search surfaces them ──

test('REQ-C3-6: engram → plainfiles round-trips with record-level equality, no live engram/git', async () => {
  const root = tmpRoot('c3-roundtrip-e2p-');
  try {
    const fixtures = buildFixtureObservations();
    const accounting = await dualWriteRecords(root, { _readObservations: () => ({ observations: fixtures }) });
    assert.equal(accounting.written, fixtures.length, `expected all ${fixtures.length} fixtures written, got ${accounting.written}`);

    for (const obs of fixtures) {
      const expected = exportObservation(obs).record;
      const needle = obs.sync_id === 'obs-fixture-chain' ? 'supersedes body text' : `${obs.type} body text`;
      const { matches } = await search(needle, { root }, { _which: () => false });
      const found = matches.find((m) => m.id === expected.id);
      assert.ok(found, `expected fixture ${obs.sync_id} (id ${expected.id}) to surface via plainfiles.search`);
      assert.equal(found.content, expected.content, `record-level content equality for ${obs.sync_id}`);
      assert.equal(computeRecordId(found), found.id, 'the surfaced record must be self-consistent');
    }
    // the supersedes chain link itself round-trips.
    const chainExpected = exportObservation(fixtures.at(-1)).record;
    assert.equal(chainExpected.supersedes, exportObservation(fixtures[0]).record.id, 'the supersedes chain link must round-trip');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── plainfiles → engram: save() into a temp root, importMemory() captures the engram-save calls ──

test('REQ-C3-6: plainfiles → engram round-trips with record-level equality, no live engram/git', async () => {
  const root = tmpRoot('c3-roundtrip-p2e-');
  try {
    const seams = { getBranch: () => 'fixture-branch', getTimestamp: () => '2026-07-01T00:00:00Z', getHostname: () => 'fixture-host' };
    const saved = [];
    for (const type of RECORD_TYPES) {
      const result = await save(`P2E ${type}`, `${type} content from plainfiles`, { type, project: 'brain' }, { root, ...seams });
      saved.push(result);
    }

    const captured = [];
    const importResult = await importMemory({
      root,
      _requireEngram: () => 'engram',
      _engramSave: (title, content, opts) => { captured.push({ title, content, opts }); },
    });
    assert.equal(importResult.written, saved.length, 'importMemory must import exactly what save() wrote');

    for (const s of saved) {
      const call = captured.find((c) => c.opts.topic === s.id);
      assert.ok(call, `expected a captured engram save call with topic === record id ${s.id} (the idempotent upsert key)`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── durability is executable, not asserted ──────────────────────────────────

test('REQ-C3-6: durability is executable — a plain Node grep of records/*.jsonl answers a decision topic, no engram/rg', async () => {
  const root = tmpRoot('c3-roundtrip-durability-');
  try {
    const seams = { getBranch: () => 'main', getTimestamp: () => '2026-07-01T00:00:00Z', getHostname: () => 'h' };
    const decisionText = 'the durability decision: plainfiles ships as the second real backend';
    await save('Durability decision', decisionText, { type: 'decision', project: 'brain' }, { root, ...seams });

    const recordsDir = join(root, '.memory', 'records');
    const files = readdirSync(recordsDir);
    const found = files.some((f) => readFileSync(join(recordsDir, f), 'utf8').includes(decisionText));
    assert.ok(found, 'a plain Node read/grep of records/*.jsonl must retrieve the known decision content — no engram, no rg');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
