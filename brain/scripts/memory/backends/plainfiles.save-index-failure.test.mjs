// plainfiles.save-index-failure.test.mjs — issue #637.
//
// `save` appends the durable record and THEN rebuilds the index, and it cannot
// be ordered otherwise: `rebuildIndex` reads the whole store, so it can only run
// after the line it has to see. When that rebuild refuses — a tampered record
// somewhere else in the store — the operator was told `plainfiles.save() failed`
// while their record was already on disk.
//
// That is not a wording problem. The obvious response to "it failed" is to run
// it again, and `ts` is hashed into the content-addressed id at SECOND
// resolution, so a retry a second later mints a record with a different id: not
// a duplicate the store can ever detect, just the same knowledge twice, forever.
// MEASURED on the real CLI before the fix — three retries, three distinct ids.
//
// So the assertions here are about what the operator is TOLD, in both
// directions: a broken store must say the record survived and what to run, and a
// healthy store must be byte-identical to before.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { save } from './plainfiles.mjs';
import { buildRecord, serializeRecord } from '../lib/format.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');

/** A temp store. `tampered: true` plants a line whose bytes no longer hash to its id. */
function store(t, { tampered = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brain-637-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });

  if (tampered) {
    const r = buildRecord({
      ts: '2026-07-01T10:00:00Z',
      actor: '@x',
      actorKind: 'human',
      type: 'decision',
      project: 'brain',
      content: 'original content',
    });
    const line = JSON.parse(serializeRecord(r));
    line.content = 'CHANGED after the id was computed';
    writeFileSync(join(recordsDir, '2026-07.jsonl'), JSON.stringify(line) + '\n', 'utf8');
  }
  return { root, recordsDir };
}

const runCli = (root, ...args) =>
  spawnSync(process.execPath, [CLI, 'save', ...args], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: root, MEMORY_BACKEND: 'plainfiles' },
  });

const augustLines = (recordsDir) => {
  const f = join(recordsDir, '2026-08.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean);
};

// ── the backend function ────────────────────────────────────────────────────

test('#637 save(): a reindex failure REJECTS, but the record is on disk and the error says which one', async (t) => {
  const { root, recordsDir } = store(t);
  const boom = new Error('rebuildIndex: id mismatch at 2026-07.jsonl:1 — …');

  await assert.rejects(
    () => save('T', 'C', { type: 'discovery', project: 'brain' }, {
      root,
      _rebuildIndex: () => { throw boom; },
    }),
    (err) => {
      assert.equal(err.indexFailed, true, 'the CLI needs to tell this apart from a refusal');
      assert.match(err.recordId, /^rec-[0-9a-f]{16}$/, 'the id of the record that DID land');
      assert.match(err.recordFile, /2026-08\.jsonl$/, 'and the file it landed in');
      return true;
    },
  );

  // The claim the message makes has to be true.
  const lines = augustLines(recordsDir);
  assert.equal(lines.length, 1, 'the record must actually be durable — that is the whole point');
});

test('#637 save(): the ORIGINAL error is rethrown, not wrapped — the diagnosis survives', async (t) => {
  const { root } = store(t);
  const boom = new Error('rebuildIndex: id mismatch at 2026-07.jsonl:1 — stored id X vs Y');

  await assert.rejects(
    () => save('T', 'C', { type: 'discovery', project: 'brain' }, {
      root,
      _rebuildIndex: () => { throw boom; },
    }),
    (err) => {
      assert.equal(err, boom, 'the very same error object — callers keep their fail-closed throw');
      assert.match(err.message, /id mismatch at 2026-07\.jsonl:1/, "rebuildIndex's file:line must not be swallowed");
      return true;
    },
  );
});

test('#637 save(): a HEALTHY store is untouched — no annotation, no behaviour change', async (t) => {
  const { root, recordsDir } = store(t);
  const result = await save('T', 'C', { type: 'discovery', project: 'brain' }, { root });

  assert.equal(result.written, true);
  assert.match(result.id, /^rec-[0-9a-f]{16}$/);
  assert.match(result.file, /2026-08\.jsonl$/);
  assert.equal(result.indexFailed, undefined, 'nothing failed, so nothing may be marked as failed');
  assert.equal(augustLines(recordsDir).length, 1);
});

test('#637 save(): a failure BEFORE the append is still a plain refusal — nothing is written', async (t) => {
  // The annotation must not spread to the pre-append gates: those really do
  // refuse, and reporting "the record WAS written" there would be the same lie
  // pointing the other way.
  const { root, recordsDir } = store(t);

  await assert.rejects(
    () => save('T', 'C', { project: 'brain' }, { root }),   // no --type
    (err) => {
      assert.equal(err.indexFailed, undefined, 'a genuine refusal must not claim a record landed');
      assert.match(err.message, /--type is required/);
      return true;
    },
  );
  assert.equal(augustLines(recordsDir).length, 0, 'and nothing may be on disk');
});

// ── what the operator is actually told ──────────────────────────────────────

test('#637 CLI on a broken store: states the record survived, names the file, and prescribes reindex', (t) => {
  const { root, recordsDir } = store(t, { tampered: true });
  const r = runCli(root, 'T', 'C', '--type', 'discovery');

  assert.equal(r.status, 1, 'the run did not fully succeed, so the exit code must say so');
  assert.match(r.stderr, /record WAS written/, 'the fact the old message denied');
  assert.match(r.stderr, /2026-08\.jsonl/, 'and WHERE, so it can be found');
  assert.match(r.stderr, /memory:reindex/, 'and what to run instead');
  assert.match(r.stderr, /Do NOT run memory:save again/, 'and the action that would make it worse');
  assert.match(r.stderr, /id mismatch at 2026-07\.jsonl:1/, "rebuildIndex's own diagnosis must survive");
  assert.doesNotMatch(
    r.stderr,
    /plainfiles\.save\(\) failed/,
    'the bare failure line is the defect — it must not survive alongside the accurate one',
  );

  assert.equal(augustLines(recordsDir).length, 1, 'the record the message promises must be there');
});

test('#637 CLI: the prescribed recovery actually works — repair, reindex, the record is indexed', (t) => {
  // Advice that has never been executed is not advice. This runs exactly what
  // the message tells the operator to do and checks the record survives it.
  const { root, recordsDir } = store(t, { tampered: true });
  const saved = runCli(root, 'T', 'C', '--type', 'discovery');
  assert.equal(saved.status, 1);

  rmSync(join(recordsDir, '2026-07.jsonl'));           // "repair the store"
  const reindexed = spawnSync(process.execPath, [CLI, 'reindex'], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: root },
  });

  assert.equal(reindexed.status, 0, `reindex must succeed after the repair; stderr:\n${reindexed.stderr}`);
  assert.match(reindexed.stdout, /1 record\(s\) indexed/, 'and it must index the record save had written');
});

test('#637 CLI: a non-index failure still reports the plain form — the new branch is not a catch-all', (t) => {
  const { root } = store(t);
  const r = runCli(root, 'T', 'C');   // no --type

  assert.equal(r.status, 1);
  assert.match(r.stderr, /plainfiles\.save\(\) failed/, 'ordinary refusals keep their existing shape');
  assert.doesNotMatch(r.stderr, /record WAS written/, 'and must never claim a record landed');
});

test('#637 CLI on a healthy store: stdout is byte-identical to the pre-#637 form', (t) => {
  const { root, recordsDir } = store(t);
  const r = runCli(root, 'T', 'C', '--type', 'discovery');

  assert.equal(r.status, 0);
  const id = JSON.parse(augustLines(recordsDir)[0]).id;
  assert.equal(
    r.stdout,
    `memory/cli: ✓ saved ${id} → ${join(recordsDir, '2026-08.jsonl')}\n`,
    'the clean path must not move by so much as a character',
  );
});

// ── the message is a catalog key ────────────────────────────────────────────

test('#637 the new string exists in both locales and is actually translated', async () => {
  const { default: en } = await import('../../i18n/en.mjs');
  const { default: es } = await import('../../i18n/es.mjs');
  const key = 'memory.plainfiles.save.indexFailed';

  assert.ok(en[key], `${key} must exist in en`);
  assert.ok(es[key], `${key} must exist in es`);
  assert.notEqual(es[key], en[key], `${key} must be translated, not copied`);
  for (const cat of [en, es]) {
    for (const placeholder of ['{id}', '{file}', '{message}']) {
      assert.ok(cat[key].includes(placeholder), `${key} must carry ${placeholder} in every locale`);
    }
  }
});
