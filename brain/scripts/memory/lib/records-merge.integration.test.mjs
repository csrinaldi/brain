// records-merge.integration.test.mjs — REQ-MF-3 integration evidence (CP-C1).
//
// NOT a unit test: builds a real temp git repository, declares the
// `merge=union` attribute on `.memory/records/*.jsonl` (the mechanism C1b
// ships repo-wide via .gitattributes — this test proves the mechanism itself,
// independent of that landing), has two branches each append a DISTINCT
// record to the same month file, and runs a real `git merge`. Asserts a
// clean union (no conflict markers, both records present) and that the
// merged file re-indexes cleanly (REQ-MF-4) with one entry per id.
//
// RED: fails until store.mjs exists (shares GREEN state with store.test.mjs).

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

test('REQ-MF-3: two branches append distinct records to the same month file — git merge=union is conflict-free', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-records-merge-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const recordsDir = join(repo, '.memory', 'records');
  const indexPath = join(repo, '.memory', 'index.json');

  // 1. Init repo + declare the union-merge attribute (the C1b .gitattributes mechanism).
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

  // 2. Branch X appends rec-A.
  git(repo, ['checkout', '-q', '-b', 'branch-x']);
  const recA = buildRecord({ ...base, content: 'Decision A, from branch X.' });
  appendRecord(recA, { recordsDir });
  git(repo, ['add', '.memory/records']);
  git(repo, ['commit', '-q', '-m', 'branch-x: append rec-A']);

  // 3. Branch Y (from main) appends a DISTINCT rec-B to the SAME month file.
  git(repo, ['checkout', '-q', 'main']);
  git(repo, ['checkout', '-q', '-b', 'branch-y']);
  const recB = buildRecord({ ...base, content: 'Decision B, from branch Y.' });
  appendRecord(recB, { recordsDir });
  git(repo, ['add', '.memory/records']);
  git(repo, ['commit', '-q', '-m', 'branch-y: append rec-B']);

  // 4. Merge branch-x into branch-y — this is the concurrent-append collision point.
  const mergeOutput = git(repo, ['merge', '--no-edit', 'branch-x']);

  // 5. Assert a clean union merge: no conflict markers, both records present.
  const monthFile = join(recordsDir, '2026-07.jsonl');
  const merged = readFileSync(monthFile, 'utf8');
  assert.equal(merged.includes('<<<<<<<'), false, 'no conflict markers');
  assert.equal(merged.includes('>>>>>>>'), false, 'no conflict markers');
  const lines = merged.split('\n').filter(Boolean);
  assert.equal(lines.length, 2, 'both branches appended lines survive the union merge');
  const ids = lines.map((l) => JSON.parse(l).id);
  assert.ok(ids.includes(recA.id), 'rec-A present after merge');
  assert.ok(ids.includes(recB.id), 'rec-B present after merge');

  // 6. REQ-MF-4: the merged store re-indexes cleanly — one entry per id.
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 2);

  // Capture the git merge output + final file state as CP-C1 evidence (test log).
  console.log('--- git merge output ---');
  console.log(mergeOutput || '(fast union merge — no textual summary)');
  console.log('--- merged .memory/records/2026-07.jsonl ---');
  console.log(merged);
});
