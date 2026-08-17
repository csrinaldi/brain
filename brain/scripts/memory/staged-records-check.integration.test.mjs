// staged-records-check.integration.test.mjs — issue #701, the I/O half of
// the gate against a real git repo (mirrors
// lib/upstream-records.integration.test.mjs's pattern).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildRecord, serializeRecord } from './lib/format.mjs';
import { appendRecord } from './lib/store.mjs';
import { runStagedRecordsCheck, main } from './staged-records-check.mjs';

function git(cwd, args, { allowFailure = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}

const BASE = {
  ts: '2026-07-04T12:00:00Z', actor: '@crinaldi', actorKind: 'human', type: 'decision', project: 'brain',
};

/**
 * A worktree, branched BEFORE the trunk record exists (`.gitignore`-only
 * init, matching `upstream-records.integration.test.mjs`'s shape — the
 * branch point is precisely NOT where the record lands), fetched AFTER the
 * trunk record is pushed so `origin/main` sees it locally.
 */
function worldWithTrunkRecord(t) {
  const remote = mkdtempSync(join(tmpdir(), 'brain-701-gate-remote-'));
  const trunk = mkdtempSync(join(tmpdir(), 'brain-701-gate-trunk-'));
  const worktree = mkdtempSync(join(tmpdir(), 'brain-701-gate-worktree-'));
  t.after(() => {
    rmSync(remote, { recursive: true, force: true });
    rmSync(trunk, { recursive: true, force: true });
    rmSync(worktree, { recursive: true, force: true });
  });

  git(remote, ['init', '-q', '--bare', '-b', 'main']);
  git(trunk, ['init', '-q', '-b', 'main']);
  git(trunk, ['config', 'user.email', 'test@example.invalid']);
  git(trunk, ['config', 'user.name', 'brain-test']);
  writeFileSync(join(trunk, '.gitignore'), '');
  git(trunk, ['add', '.gitignore']);
  git(trunk, ['commit', '-q', '-m', 'init']);
  git(trunk, ['remote', 'add', 'origin', remote]);
  git(trunk, ['push', '-q', '-u', 'origin', 'main']);

  git(worktree, ['clone', '-q', remote, '.']);
  git(worktree, ['config', 'user.email', 'test@example.invalid']);
  git(worktree, ['config', 'user.name', 'brain-test']);
  git(worktree, ['checkout', '-q', '-b', 'feature/701']);

  const record = buildRecord({ ...BASE, content: 'Already durable on the trunk.' });
  const recordsDir = join(trunk, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  appendRecord(record, { recordsDir });
  git(trunk, ['add', '.memory/records']);
  git(trunk, ['commit', '-q', '-m', 'trunk record']);
  git(trunk, ['push', '-q', 'origin', 'main']);
  git(worktree, ['fetch', '-q', 'origin']);

  return { worktree, record };
}

test('issue #701 gate: staging a byte-identical re-export of the trunk record REFUSES', (t) => {
  const { worktree, record } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const path = join(recordsDir, `2026-07-${record.id}.jsonl`);
  // The exact accident this ticket is about: `share` (pre-#701, or the fix's
  // own residual on an unavailable ref) materializes the SAME bytes as an
  // untracked file, and the operator `git add`s it.
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(path, serializeRecord(record) + '\n', 'utf8');
  git(worktree, ['add', '.memory/records']);

  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'fail');
  assert.deepEqual(result.offending, [`.memory/records/2026-07-${record.id}.jsonl`]);
});

test('issue #701 gate: a genuinely new staged record ALLOWS', (t) => {
  const { worktree } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const newRecord = buildRecord({ ...BASE, content: 'Brand new, never seen upstream.' });
  mkdirSync(recordsDir, { recursive: true });
  appendRecord(newRecord, { recordsDir });
  git(worktree, ['add', '.memory/records']);

  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'pass');
});

test('issue #701 gate: nothing staged under .memory/records/ ALLOWS', (t) => {
  const { worktree } = worldWithTrunkRecord(t);
  const result = runStagedRecordsCheck({ root: worktree });
  assert.equal(result.level, 'pass');
  assert.deepEqual(result.offending, []);
});

test('issue #701 gate main(): a refusal exits 1 and prints the lossless remedy', async (t) => {
  const { worktree, record } = worldWithTrunkRecord(t);
  const recordsDir = join(worktree, '.memory', 'records');
  const path = join(recordsDir, `2026-07-${record.id}.jsonl`);
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(path, serializeRecord(record) + '\n', 'utf8');
  git(worktree, ['add', '.memory/records']);

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  let code;
  try {
    code = await main({ root: worktree });
  } finally {
    console.log = originalLog;
  }
  assert.equal(code, 1);
  assert.ok(logs.some((l) => l.includes('git restore --staged')), `expected the remedy to be printed; got:\n${logs.join('\n')}`);
});

// ── the configError channel, at the ONE layer a human actually reads ─────────
//
// Every other layer of this channel was pinned — `resolveUpstreamRef` carrying
// it, `upstreamRecordEntries` carrying it on both arms, `evaluateStagedRecords`
// forwarding it, `engram.mjs` accounting for it — and the PRINT was not. Cold
// review round 2 of #701 measured that directly: neutering `if
// (result.configError)` in `main()` left the whole suite green at 4001 pass / 0
// fail. The whole point of the channel is that the operator is TOLD, so the
// telling is what needs a detector.
//
// `env: {}` is deliberate and load-bearing. `runStagedRecordsCheck` defaults
// `env` to `process.env`, and an ambient `BRAIN_MEMORY_UPSTREAM_REF` is level 1
// — it wins over the config, so the config is never read and `configError` never
// arises. Without this the tests below pass or fail on the shell they inherit.

/** Runs `main()` with `console.log` captured. Restored on every path. */
async function mainCapturingLogs(deps) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    return { code: await main(deps), logs };
  } finally {
    console.log = originalLog;
  }
}

const CORRUPT_CONFIG = '<<<<<<< HEAD\n{ "memory": { "upstreamRef": "origin/feature" } }\n';

test('issue #701 gate main(): an unreadable brain.config.json is PRINTED, and the gate still refuses', async (t) => {
  const { worktree, record } = worldWithTrunkRecord(t);
  // Mid-merge: conflict markers in the config. This is the reachable case —
  // conflict markers mean you are mid-merge, which is exactly when the dedup
  // gate earns its keep.
  writeFileSync(join(worktree, 'brain.config.json'), CORRUPT_CONFIG, 'utf8');
  const recordsDir = join(worktree, '.memory', 'records');
  const path = join(recordsDir, `2026-07-${record.id}.jsonl`);
  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(path, serializeRecord(record) + '\n', 'utf8');
  git(worktree, ['add', '.memory/records']);

  const { code, logs } = await mainCapturingLogs({ root: worktree, env: {} });
  const printed = logs.join('\n');

  assert.ok(
    /brain\.config\.json .* could not be parsed/.test(printed),
    `the operator must be TOLD the config was skipped; got:\n${printed}`,
  );
  assert.ok(
    /NOT honored/.test(printed),
    `and told that a ref stated there went unread; got:\n${printed}`,
  );
  // The POSITIVE branch of the two-key split. `origin/main` was fetched in this
  // world, so it genuinely IS the derived ref resolution fell through to and
  // naming it is true here — which is the only case where naming it is true.
  // Without this assertion both catalog keys satisfy the two checks above (they
  // share "could not be parsed" and "NOT honored"), and `refResolved` could be
  // dropped from the carry with the suite still green.
  // `origin/HEAD`, not `origin/main`: this worktree is a CLONE, so level 3 is
  // set and answers before level 4 is ever tried. Naming the ref that actually
  // answered is the whole point of the clause.
  assert.ok(
    /derived as origin\/HEAD instead/.test(printed),
    `a ref that DID answer must be named, or the operator cannot tell which base was used; got:\n${printed}`,
  );
  // The config failure does not disable the gate: origin/main still answered.
  assert.equal(code, 1, 'a broken config must not turn a refusal into a pass — that is the defect the fall-through exists to avoid');
});

test('issue #701 gate main(): with NO ref resolved, the printed line does NOT claim a derived ref', async (t) => {
  // The second half of the sentence-scale doubling: `ref` here is
  // `resolveUpstreamRef`'s hard-coded `origin/main` placeholder, returned when
  // NOTHING resolved. Naming it as the base "derived instead" told the operator
  // a ref had answered, one line before the note said none had.
  const { worktree } = worldWithTrunkRecord(t);
  git(worktree, ['remote', 'remove', 'origin']); // takes origin/HEAD + origin/main with it
  writeFileSync(join(worktree, 'brain.config.json'), CORRUPT_CONFIG, 'utf8');

  const { logs } = await mainCapturingLogs({ root: worktree, env: {} });
  const printed = logs.join('\n');

  assert.ok(
    /could not be parsed/.test(printed),
    `the config failure is reported whether or not a ref answered; got:\n${printed}`,
  );
  assert.ok(
    /no upstream base resolved either/.test(printed),
    `the line must say nothing resolved; got:\n${printed}`,
  );
  assert.equal(
    /derived as origin\/main instead/.test(printed), false,
    'origin/main here is the placeholder for "nothing resolved", never a ref that answered',
  );
});

test('issue #701 gate main(): a READABLE config prints no config line at all', async (t) => {
  // The negative side of the detector: without it, a print site that fired
  // unconditionally would satisfy every assertion above.
  const { worktree } = worldWithTrunkRecord(t);
  writeFileSync(join(worktree, 'brain.config.json'), JSON.stringify({ project: { slug: 'brain' } }), 'utf8');

  const { code, logs } = await mainCapturingLogs({ root: worktree, env: {} });

  assert.equal(code, 0);
  assert.equal(
    /brain\.config\.json/.test(logs.join('\n')), false,
    'nothing failed to be read, so nothing may be reported — the channel is evidence, not a banner',
  );
});
