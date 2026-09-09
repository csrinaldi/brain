// plan.test.mjs — pure unit suite for planLaneCommit (#887 Slice A, the lane
// collector's planner). RED until brain/scripts/memory/lane/plan.mjs exists
// (task A1). Every case here is taken from spec.md's STRICT TDD test map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildRecord, serializeRecord } from '../lib/format.mjs';
import { emptyDuplicates } from '../lib/duplicates.mjs';
import { planLaneCommit } from './plan.mjs';

const PLAN_MJS_PATH = fileURLToPath(new URL('./plan.mjs', import.meta.url));

const base = {
  ts: '2026-09-01T12:00:00Z',
  actor: '@crinaldi',
  actorKind: 'human',
  type: 'decision',
  project: 'brain',
};

const NO_PARENT = { ref: 'origin/main', tip: null };

/** A valid record's filename + serialized content (store.mjs's naming grammar). */
function recordFixture(content) {
  const rec = buildRecord({ ...base, content });
  const month = rec.ts.slice(0, 7);
  const file = `${month}-${rec.id}.jsonl`;
  return { file, content: serializeRecord(rec) };
}

function candidate({ worktree, file, content, status = '??', path, ...rest }) {
  return { worktree, file, path: path ?? `.memory/records/${file}`, status, content, ...rest };
}

function plan(overrides = {}) {
  return planLaneCommit({
    candidates: [],
    mainPaths: [],
    host: 'my-host',
    date: '2026-09-09',
    parent: NO_PARENT,
    ...overrides,
  });
}

// ── A1.1 candidate selection and skip routing ───────────────────────────────

test('an untracked, clean, off-main file is a candidate', () => {
  const { file, content } = recordFixture('a clean record');
  const p = plan({ candidates: [candidate({ worktree: '/repo/wt-a', file, content })] });
  assert.equal(p.files.length, 1);
  assert.equal(p.files[0].file, file);
  assert.equal(p.files[0].worktree, '/repo/wt-a');
  assert.equal(p.files[0].path, `.memory/records/${file}`);
  assert.equal(p.skipped.length, 0);
});

test('modified-tracked, invalid, and already-on-main candidates each skip with their own reason, none collected', () => {
  const modified = recordFixture('modified-tracked candidate');
  const invalid = { file: '2026-09-rec-0000000000000000.jsonl', content: 'not json at all' };
  const onMain = recordFixture('already shipped');

  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-a', file: modified.file, content: modified.content, status: ' M' }),
      candidate({ worktree: '/repo/wt-a', file: invalid.file, content: invalid.content }),
      candidate({ worktree: '/repo/wt-a', file: onMain.file, content: onMain.content }),
    ],
    mainPaths: [`.memory/records/${onMain.file}`],
  });

  assert.equal(p.files.length, 0);
  const reasons = Object.fromEntries(p.skipped.map((s) => [s.file, s.reason]));
  assert.equal(reasons[modified.file], 'modified-tracked');
  assert.equal(reasons[invalid.file], 'invalid');
  assert.equal(reasons[onMain.file], 'already-on-main');
  assert.equal(p.skipped.length, 3);
});

test('an unexpected status code skips as unexpected-status, carrying the code', () => {
  const { file, content } = recordFixture('staged mid-commit');
  const p = plan({ candidates: [candidate({ worktree: '/repo/wt-a', file, content, status: 'A ' })] });
  assert.equal(p.files.length, 0);
  assert.equal(p.skipped.length, 1);
  assert.equal(p.skipped[0].reason, 'unexpected-status');
  assert.equal(p.skipped[0].code, 'A ');
});

test('.memory/index.jsonl is excluded by filename grammar — never in files or skipped', () => {
  const p = plan({
    candidates: [candidate({ worktree: '/repo/wt-a', file: 'index.jsonl', content: '{}', path: '.memory/index.jsonl' })],
  });
  assert.equal(p.files.length, 0);
  assert.equal(p.skipped.length, 0);
});

test('a not-a-record name, including a pre-#677 month log, skips pointing at memory:split-records', () => {
  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-a', file: '2026-09.jsonl', content: '{}' }),
      candidate({ worktree: '/repo/wt-a', file: 'notes.txt', content: 'hi' }),
    ],
  });
  assert.equal(p.files.length, 0);
  assert.equal(p.skipped.length, 2);
  for (const s of p.skipped) {
    assert.equal(s.reason, 'not-a-record');
    assert.match(s.hint, /memory:split-records/);
  }
});

test('a candidate that fails to read (unreadable) skips with its error, never invalid', () => {
  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-a', file: '2026-09-rec-1111111111111111.jsonl', content: null, readError: 'ENOENT' }),
    ],
  });
  assert.equal(p.files.length, 0);
  assert.equal(p.skipped.length, 1);
  assert.equal(p.skipped[0].reason, 'unreadable');
  assert.equal(p.skipped[0].error, 'ENOENT');
});

test('a secret-marked candidate routes to skipped with pattern+lineNumber, never appears in files', () => {
  const { file, content } = recordFixture('has a secret in it');
  const p = plan({
    candidates: [
      candidate({
        worktree: '/repo/wt-a',
        file,
        content,
        secret: { pattern: 'ghp_[A-Za-z0-9]{20,}', lineNumber: 1 },
      }),
    ],
  });
  assert.equal(p.files.length, 0);
  assert.equal(p.skipped.length, 1);
  assert.deepEqual(p.skipped[0], {
    file,
    worktree: '/repo/wt-a',
    reason: 'secret',
    pattern: 'ghp_[A-Za-z0-9]{20,}',
    lineNumber: 1,
  });
});

test('a secret-marked WINNER skips the whole group — no fall-through to the runner-up', () => {
  const rec = buildRecord({ ...base, content: 'group with a secret winner' });
  const month = rec.ts.slice(0, 7);
  const file = `${month}-${rec.id}.jsonl`;
  const p = plan({
    candidates: [
      // lexicographically-first worktree path wins C2 and carries the secret mark
      candidate({
        worktree: '/repo/wt-a',
        file,
        content: serializeRecord(rec),
        secret: { pattern: 'ghp_[A-Za-z0-9]{20,}', lineNumber: 1 },
      }),
      candidate({ worktree: '/repo/wt-z', file, content: serializeRecord(rec) }),
    ],
  });
  assert.equal(p.files.length, 0, 'the runner-up must not be collected in place of the secret winner');
  assert.equal(p.skipped.length, 1);
  assert.equal(p.skipped[0].reason, 'secret');
  assert.equal(p.skipped[0].worktree, '/repo/wt-a');
});

// ── A1.2 deterministic dedup on divergence (D3/C2) ──────────────────────────

test('identical-bytes copies across worktrees collapse to one blob, no divergence reported', () => {
  const { file, content } = recordFixture('same bytes everywhere');
  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-a', file, content }),
      candidate({ worktree: '/repo/wt-b', file, content }),
    ],
  });
  assert.equal(p.files.length, 1);
  assert.equal(p.files[0].worktree, '/repo/wt-a', 'lexicographically-first worktree wins even on identical bytes');
  assert.equal(p.duplicates.ids, 1);
  assert.equal(p.duplicates.divergent, 0);
});

test('diverging copies resolve by lexicographic worktree path; the group is reported as divergent', () => {
  const recA = buildRecord({ ...base, content: 'copy A' });
  const month = recA.ts.slice(0, 7);
  const file = `${month}-${recA.id}.jsonl`;
  // Same id, different bytes OUTSIDE the hash (`source` widening — the real-world
  // divergence case, store.mjs:388-396) — never `localeCompare`, plain code-unit order.
  const recB = { ...recA, source: 'issue #887 / widened' };

  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-z', file, content: serializeRecord(recA) }),
      candidate({ worktree: '/repo/wt-a', file, content: serializeRecord(recB) }),
    ],
  });

  assert.equal(p.files.length, 1);
  assert.equal(p.files[0].worktree, '/repo/wt-a', 'lexicographically-first worktree path wins');
  assert.equal(p.duplicates.ids, 1);
  assert.equal(p.duplicates.divergent, 1);
  assert.equal(p.duplicates.groups[0].divergent, true);
});

test('a key-order-only difference is a duplicate, not a divergence (canonicalOrNull agrees)', () => {
  const rec = buildRecord({ ...base, content: 'order only' });
  const month = rec.ts.slice(0, 7);
  const file = `${month}-${rec.id}.jsonl`;
  const reordered = {};
  for (const k of Object.keys(rec).reverse()) reordered[k] = rec[k];

  const p = plan({
    candidates: [
      candidate({ worktree: '/repo/wt-a', file, content: JSON.stringify(reordered) }),
      candidate({ worktree: '/repo/wt-b', file, content: JSON.stringify(rec) }),
    ],
  });

  assert.equal(p.files.length, 1);
  assert.equal(p.duplicates.ids, 1);
  assert.equal(p.duplicates.divergent, 0, 'key order alone must not count as divergent');
});

// ── A1.3 stability under shuffled enumeration ───────────────────────────────

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

test('stability: all 6 permutations of worktree-block enumeration order yield a deep-equal plan; a repeat call matches too', () => {
  const worktrees = ['/repo/wt-a', '/repo/wt-b', '/repo/wt-c'];
  const solo = recordFixture('solo in wt-a');
  const shared = recordFixture('shared identical bytes');
  const divA = buildRecord({ ...base, content: 'diverges across wt-a/wt-b' });
  const divMonth = divA.ts.slice(0, 7);
  const divFile = `${divMonth}-${divA.id}.jsonl`;
  const divB = { ...divA, source: 'issue #887 / widened' };
  const onlyC = recordFixture('solo in wt-c');

  /** Fixed per-worktree candidate blocks — only the BLOCK order is permuted. */
  const byWorktree = {
    '/repo/wt-a': [
      candidate({ worktree: '/repo/wt-a', file: solo.file, content: solo.content }),
      candidate({ worktree: '/repo/wt-a', file: shared.file, content: shared.content }),
      candidate({ worktree: '/repo/wt-a', file: divFile, content: serializeRecord(divA) }),
    ],
    '/repo/wt-b': [
      candidate({ worktree: '/repo/wt-b', file: shared.file, content: shared.content }),
      candidate({ worktree: '/repo/wt-b', file: divFile, content: serializeRecord(divB) }),
    ],
    '/repo/wt-c': [
      candidate({ worktree: '/repo/wt-c', file: onlyC.file, content: onlyC.content }),
    ],
  };

  const orders = permutations(worktrees);
  assert.equal(orders.length, 6, 'exhaustive, not randomised');

  let reference = null;
  for (const order of orders) {
    const candidates = order.flatMap((wt) => byWorktree[wt]);
    const p = plan({ candidates });
    if (reference === null) reference = p;
    else assert.deepStrictEqual(p, reference);
  }

  const repeat = plan({ candidates: worktrees.flatMap((wt) => byWorktree[wt]) });
  assert.deepStrictEqual(repeat, reference, 'a repeated call on identical input returns an identical plan');
});

// ── A1.4 ref/message naming and empty-input shape ───────────────────────────

test('host slug: lowercase, non-alnum collapsed to -, trimmed, truncated to 40', () => {
  const p = plan({ host: '  My.Host_Name!!  ' });
  assert.equal(p.ref, 'refs/heads/memory/my-host-name-2026-09-09');
});

test('the finished ref matches L1s grammar exactly', () => {
  const p = plan({ host: 'host1' });
  assert.match(p.ref, /^refs\/heads\/memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/);
});

test('an empty host slug throws memory.collect.badHost', () => {
  assert.throws(() => plan({ host: '!!!' }), /memory\.collect\.badHost/);
});

test('message is "memory: <host-slug> <date> (<n> records)"', () => {
  const { file, content } = recordFixture('one record');
  const p = plan({ candidates: [candidate({ worktree: '/repo/wt-a', file, content })] });
  assert.equal(p.message, 'memory: my-host 2026-09-09 (1 records)');
});

test('parent resolves to the given tip when present, else the input ref', () => {
  const p1 = plan({ parent: { ref: 'origin/main', tip: null } });
  assert.equal(p1.parent, 'origin/main');
  const p2 = plan({ parent: { ref: 'origin/main', tip: 'deadbeefdeadbeef' } });
  assert.equal(p2.parent, 'deadbeefdeadbeef');
});

test('a plan built from zero candidates returns commit: null and an empty duplicates shape', () => {
  const p = plan();
  assert.equal(p.commit, null);
  assert.deepStrictEqual(p.duplicates, emptyDuplicates());
  assert.deepStrictEqual(p.files, []);
  assert.deepStrictEqual(p.skipped, []);
});

// ── source guard: pure module, no fs/spawn/clock/os ─────────────────────────

test('plan.mjs imports no node:fs, node:child_process, node:os, and reads no wall clock', () => {
  const src = readFileSync(PLAN_MJS_PATH, 'utf8');
  assert.doesNotMatch(src, /from ['"]node:fs['"]/);
  assert.doesNotMatch(src, /from ['"]node:child_process['"]/);
  assert.doesNotMatch(src, /from ['"]node:os['"]/);
  assert.doesNotMatch(src, /new Date\(/);
});
