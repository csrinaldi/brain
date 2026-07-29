// index-merge.integration.test.mjs — issue #330, REQ-330-1 / REQ-330-2.
//
// `.gitattributes` gave a merge strategy to every committed file under
// `.memory/` EXCEPT `index.jsonl`, so the one file with no assigned strategy
// fell through to git's default text merge and conflicted on every parallel
// branch that had run `memory:share`.
//
// NOT a unit test: builds real temp git repositories and runs a real
// `git merge`. Modelled on records-merge.integration.test.mjs, with two
// additions that file does not need:
//
//   * a NEGATIVE CONTROL (test 2) — the identical scenario with NO attribute
//     declared must conflict. Without it, test 1 could be green because the
//     two branches happened not to overlap, and would prove nothing about the
//     attribute being the cause.
//   * a REPO TRIPWIRE (test 3) — tests 1 and 2 build their own fixture
//     `.gitattributes` (the records test does the same, deliberately, to prove
//     the mechanism independently of the shipped file). That leaves them green
//     even if the repo's real `.gitattributes` never carried the rule: green in
//     test, inert in production. Test 3 closes it.
//
// Why the fixtures start from an EMPTY committed index: `index.jsonl` is a
// deterministic full rewrite sorted by content-hash `id`
// (format.mjs#serializeIndex), so with a non-empty base the two branches'
// insertions land at unpredictable sort positions and may not overlap — the
// negative control would be flaky. From an empty base both sides add at the
// same position, so the conflict (and the union) is deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { buildRecord, buildIndexEntry, serializeIndex } from './format.mjs';
import { appendRecord, rebuildIndex } from './store.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

const INDEX_ATTRIBUTE = '/.memory/index.jsonl merge=union\n';
const RECORDS_ATTRIBUTE = '/.memory/records/*.jsonl merge=union\n';

const BASE_FIELDS = {
  ts: '2026-07-29T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

/** Like git(), but returns the result instead of throwing — for the merge that is EXPECTED to fail. */
function gitAllowFailure(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/**
 * Builds a temp repo whose base commit holds an empty `.memory/index.jsonl`,
 * then branches `branch-x` and `branch-y` off it, each appending one distinct
 * record and rebuilding the index.
 *
 * @param {string} attributes  the fixture `.gitattributes` contents
 * @returns {{repo: string, recordsDir: string, indexPath: string, recA: object, recB: object}}
 */
function buildTwoBranchRepo(attributes) {
  const repo = mkdtempSync(join(tmpdir(), 'brain-index-merge-'));
  const recordsDir = join(repo, '.memory', 'records');
  const indexPath = join(repo, '.memory', 'index.jsonl');

  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'brain-test']);

  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(join(repo, '.gitattributes'), attributes);
  // The base state: an index that exists and is committed, but is empty —
  // serializeIndex(new Map()) is the empty string (format.mjs:210).
  writeFileSync(indexPath, serializeIndex(new Map()), 'utf8');
  git(repo, ['add', '.gitattributes', '.memory']);
  git(repo, ['commit', '-q', '-m', 'init: base state with an empty index']);

  // Branch X — append rec-A, rebuild the index (what `memory:share` does).
  git(repo, ['checkout', '-q', '-b', 'branch-x']);
  const recA = buildRecord({ ...BASE_FIELDS, content: 'Decision A, from branch X.' });
  appendRecord(recA, { recordsDir });
  rebuildIndex({ recordsDir, indexPath });
  git(repo, ['add', '.memory']);
  git(repo, ['commit', '-q', '-m', 'branch-x: share rec-A']);

  // Branch Y — from the same base, append a DISTINCT rec-B and rebuild.
  git(repo, ['checkout', '-q', 'main']);
  git(repo, ['checkout', '-q', '-b', 'branch-y']);
  const recB = buildRecord({ ...BASE_FIELDS, content: 'Decision B, from branch Y.' });
  appendRecord(recB, { recordsDir });
  rebuildIndex({ recordsDir, indexPath });
  git(repo, ['add', '.memory']);
  git(repo, ['commit', '-q', '-m', 'branch-y: share rec-B']);

  return { repo, recordsDir, indexPath, recA, recB };
}

// ── Test 1 — REQ-330-1 S1 + REQ-330-2 S4: with the attribute, the merge is clean ──

test('REQ-330-1: two branches that both ran memory:share merge index.jsonl conflict-free under merge=union', (t) => {
  const { repo, recordsDir, indexPath, recA, recB } = buildTwoBranchRepo(
    RECORDS_ATTRIBUTE + INDEX_ATTRIBUTE,
  );
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const mergeOutput = git(repo, ['merge', '--no-edit', 'branch-x']);

  const merged = readFileSync(indexPath, 'utf8');
  assert.equal(merged.includes('<<<<<<<'), false, 'no conflict markers in the merged index');
  assert.equal(merged.includes('======='), false, 'no conflict markers in the merged index');
  assert.equal(merged.includes('>>>>>>>'), false, 'no conflict markers in the merged index');

  // Union never splits a line: every physical line must still be one complete
  // JSON entry. This is the structural guarantee the strategy rests on.
  const lines = merged.split('\n').filter(Boolean);
  const parsed = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`index.jsonl:${i + 1} is not a complete JSON entry after the union merge — ${err.message}`);
    }
  });

  const ids = new Set(parsed.map((e) => e.id));
  assert.ok(ids.has(recA.id), "branch X's index entry survives the merge");
  assert.ok(ids.has(recB.id), "branch Y's index entry survives the merge");

  // REQ-330-2 S4 — reindex restores the canonical form byte-for-byte. The
  // merged index may be unsorted or carry a duplicate line; that state is
  // transient and repaired with no operator judgment.
  const { count } = rebuildIndex({ recordsDir, indexPath });
  assert.equal(count, 2, 'exactly one entry per distinct record id after reindex');

  const monthFile = '2026-07.jsonl';
  const expected = serializeIndex(
    new Map(
      [recA, recB]
        .map((rec) => [rec.id, buildIndexEntry(rec, monthFile)])
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );
  assert.equal(
    readFileSync(indexPath, 'utf8'),
    expected,
    'the reindexed file is byte-identical to serializeIndex over the merged record set (sorted by id)',
  );

  console.log('--- git merge output ---');
  console.log(mergeOutput || '(fast union merge — no textual summary)');
  console.log('--- merged .memory/index.jsonl (pre-reindex) ---');
  console.log(merged);
});

// ── Test 2 — REQ-330-1 S2: the negative control ──────────────────────────────

test('REQ-330-1 (negative control): WITHOUT a merge strategy the identical scenario conflicts on index.jsonl', (t) => {
  // Records keep their union rule — isolating the index as the only variable,
  // exactly as observed on 2026-07-25: the records merged silently and
  // index.jsonl was the sole conflict.
  const { repo, indexPath } = buildTwoBranchRepo(RECORDS_ATTRIBUTE);
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const r = gitAllowFailure(repo, ['merge', '--no-edit', 'branch-x']);

  assert.notEqual(
    r.status,
    0,
    'without a declared strategy the merge MUST fail — if this passes, the negative control is no longer isolating the attribute',
  );
  const conflicted = readFileSync(indexPath, 'utf8');
  assert.ok(
    conflicted.includes('<<<<<<<') && conflicted.includes('>>>>>>>'),
    'the unmanaged index.jsonl carries conflict markers',
  );
});

// ── Test 3 — REQ-330-1 S3: the repo tripwire ─────────────────────────────────

/**
 * declaresIndexMergeStrategy() — does this `.gitattributes` text assign a
 * merge strategy to `/.memory/index.jsonl`? Pure, so the tripwire's own logic
 * is covered by fixtures rather than trusted.
 *
 * @param {string} text  raw .gitattributes contents
 * @returns {boolean}
 */
export function declaresIndexMergeStrategy(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .some((line) => {
      const [pattern, ...attrs] = line.split(/\s+/);
      if (pattern !== '/.memory/index.jsonl') return false;
      return attrs.some((a) => a.startsWith('merge='));
    });
}

test('declaresIndexMergeStrategy: recognizes a declared strategy, and is not fooled by a comment or a bare path', () => {
  assert.equal(declaresIndexMergeStrategy('/.memory/index.jsonl merge=union\n'), true);
  assert.equal(declaresIndexMergeStrategy('# /.memory/index.jsonl merge=union\n'), false, 'a commented-out rule does not count');
  assert.equal(declaresIndexMergeStrategy('/.memory/index.jsonl text\n'), false, 'a non-merge attribute does not count');
  assert.equal(declaresIndexMergeStrategy('/.memory/records/*.jsonl merge=union\n'), false, 'the records rule does not cover the index');
  assert.equal(declaresIndexMergeStrategy(''), false);
});

test('REQ-330-1: the REPOSITORY\'S OWN .gitattributes declares a merge strategy for /.memory/index.jsonl', () => {
  const text = readFileSync(join(repoRoot, '.gitattributes'), 'utf8');
  assert.equal(
    declaresIndexMergeStrategy(text),
    true,
    'the shipped .gitattributes must declare a merge strategy for /.memory/index.jsonl — ' +
      'tests 1 and 2 build their own fixture, so without this tripwire they would stay green ' +
      'while every real parallel branch kept conflicting (issue #330).',
  );
});
