// records-merge-duplicate.integration.test.mjs — issue #574 evidence.
//
// records-merge.integration.test.mjs proves the DISTINCT-record merge: two
// branches append different records, union concatenates, the index has both.
// This is its sibling for the case that actually produced the 139 excess lines
// on `main`: two branches holding the SAME record. `merge=union` concatenates
// there too — it has no way not to — so the duplicate physical line is minted
// by the transport doing exactly what ADR-0017 asked of it.
//
// That is the whole argument for deduplicate-and-report over refuse, executed
// against real git rather than asserted in a comment: if `rebuildIndex` refused
// a duplicate, the merge below would leave the store unindexable, and
// `memory:reindex` — the command doctrine prescribes for finishing a merge —
// would be the thing that could no longer run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildRecord } from './format.mjs';
import { appendRecord, rebuildIndex } from './store.mjs';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

test('#574: two branches holding the SAME record union-merge into a duplicate line — collapsed AND reported, never refused', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-records-dup-merge-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const recordsDir = join(repo, '.memory', 'records');
  const indexPath = join(repo, '.memory', 'index.jsonl');

  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'brain-test']);
  writeFileSync(join(repo, '.gitattributes'), '.memory/records/*.jsonl merge=union\n');
  mkdirSync(recordsDir, { recursive: true });
  git(repo, ['add', '.gitattributes']);
  git(repo, ['commit', '-q', '-m', 'init: declare union-merge attribute']);

  const base = {
    ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
  };
  const seed = buildRecord({ ...base, content: 'Already on main before either branch.' });
  // TWO records, materialized independently on both branches. Content-addressed,
  // so both sides compute identical ids and identical bytes (REQ-MF-2 working —
  // it is what makes the duplicate recognizable rather than invisible). Nothing
  // fixes the APPEND ORDER, though: engram's export order, a migration and a
  // manual capture all produce their own. Union has no way to align two hunks
  // that hold the same lines in different orders, so it keeps both — which is
  // the shape the 49 repeated ids on `main` actually have (a block reappearing
  // further down the file, never an adjacent twin).
  const recP = buildRecord({ ...base, content: 'Decision P, captured on both branches.' });
  const recQ = buildRecord({ ...base, content: 'Decision Q, captured on both branches.' });

  appendRecord(seed, { recordsDir });
  git(repo, ['add', '.memory/records']);
  git(repo, ['commit', '-q', '-m', 'main: seed record']);

  git(repo, ['checkout', '-q', '-b', 'branch-x']);
  appendRecord(recP, { recordsDir });
  appendRecord(recQ, { recordsDir });
  git(repo, ['add', '.memory/records']);
  git(repo, ['commit', '-q', '-m', 'branch-x: append P then Q']);

  git(repo, ['checkout', '-q', 'main']);
  git(repo, ['checkout', '-q', '-b', 'branch-y']);
  appendRecord(recQ, { recordsDir });
  appendRecord(recP, { recordsDir });
  git(repo, ['add', '.memory/records']);
  git(repo, ['commit', '-q', '-m', 'branch-y: append the same two, other order']);

  git(repo, ['merge', '--no-edit', 'branch-x']);

  // 1. The transport did what it was told: no conflict, and both copies kept.
  const merged = readFileSync(join(recordsDir, '2026-07.jsonl'), 'utf8');
  assert.equal(merged.includes('<<<<<<<'), false, 'union merge, no conflict markers');
  const ids = merged.split('\n').filter(Boolean).map((l) => JSON.parse(l).id);
  assert.equal(ids.length, 5, 'three records now occupy five physical lines');
  assert.equal(ids.filter((id) => id === recP.id).length, 2);
  assert.equal(ids.filter((id) => id === recQ.id).length, 2);

  // 2. The rule: indexed once per record, and the collapse is REPORTED.
  const { count, duplicates } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 3, 'three records — the collapse is lossless because the repeated lines agree');
  assert.equal(duplicates.ids, 2);
  assert.equal(duplicates.lines, 2, 'the store is exactly two physical lines longer than the index');
  assert.deepEqual(
    duplicates.groups.map((g) => g.occurrences.length),
    [2, 2],
    'every physical location is accounted for, not just the count',
  );

  // 3. And it stays runnable: reindexing after an ordinary merge is the
  //    prescribed resolution, so it must not be the thing that breaks.
  const again = rebuildIndex({ recordsDir, indexPath });
  assert.equal(again.count, 3);
  assert.equal(again.duplicates.lines, 2, 'idempotent — reporting a duplicate does not consume it');
});
