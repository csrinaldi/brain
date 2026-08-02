// installer-journal.integration.test.mjs — the crash-then-recover contract (#396 slice 2).
//
// Named `.integration.` because one case spawns a real child process and SIGKILLs it.
// That case is the point of the whole slice: SIGKILL runs NO in-process handler, so it
// is the one failure mode slice 1's restore point could not cover, and the only way to
// prove the journal survives it is to actually do it.
//
// The cheap unit cases below pin the same contract without a subprocess, so a
// regression is caught even if the process-spawning case is ever skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  copyManaged,
  createRestorePoint,
  readJournal,
  recoverFromJournal,
  acquireLock,
  RESTORE_POINT_DIR,
  JOURNAL_FILE,
  JOURNAL_VERSION,
} from './installer.mjs';

const LIB = fileURLToPath(new URL('./installer.mjs', import.meta.url));

/** A consumer repo mid-life: one managed path holding bytes the consumer cares about. */
function seed(tmp) {
  const src = join(tmp, 'src');
  const dest = join(tmp, 'dest');
  mkdirSync(join(src, 'brain', 'core'), { recursive: true });
  writeFileSync(join(src, 'brain', 'core', 'a.md'), 'NEW BYTES');
  mkdirSync(join(dest, 'brain', 'core'), { recursive: true });
  writeFileSync(join(dest, 'brain', 'core', 'a.md'), 'CONSUMER ORIGINAL');
  return { src, dest };
}

// ── REQ-J-1: a real SIGKILL leaves a replayable journal ───────────────────────
test('journal: a SIGKILL mid-write leaves a journal, the next run refuses, and --recover restores (REQ-J-1)', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j1-'));
  try {
    const { src, dest } = seed(tmp);

    // A child that performs a REAL write and then spins, so only SIGKILL ends it.
    const child = `
      import { writeFileSync, readFileSync } from 'node:fs';
      const { copyManaged } = await import(${JSON.stringify(LIB)});
      copyManaged({
        srcRoot: ${JSON.stringify(src)}, destRoot: ${JSON.stringify(dest)},
        managed: ['brain/core/**'], local: [],
        specialMerge: { 'brain/core/a.md': (dp, sp) => {
          writeFileSync(dp, readFileSync(sp));
          console.log('WROTE');
          for (;;) {}
        } },
      });
    `;
    const proc = spawn(process.execPath, ['--input-type=module', '-e', child]);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('child never reached the write')), 20000);
      proc.stdout.on('data', (d) => {
        if (d.toString().includes('WROTE')) { clearTimeout(timer); resolve(); }
      });
    });
    proc.kill('SIGKILL');
    await new Promise((resolve) => proc.on('exit', resolve));

    // The tree is half-applied and nothing in-process could have prevented it.
    assert.equal(readFileSync(join(dest, 'brain', 'core', 'a.md'), 'utf8'), 'NEW BYTES',
      'precondition: the kill left the write applied');
    assert.ok(readJournal(dest), 'the journal must survive a kill — it is the only evidence left');

    // A later run must not quietly proceed over it.
    assert.throws(
      () => createRestorePoint({ destRoot: dest, relPaths: ['brain/core/a.md'] }),
      (err) => err.interruptedRun === true && err.coveredPaths === 1,
      'the next run must refuse and say what the interrupted run covered',
    );

    const result = recoverFromJournal({ destRoot: dest });
    assert.deepEqual(result.failed, [], 'recovery must put every covered path back');
    assert.deepEqual(result.recovered, ['brain/core/a.md']);
    assert.equal(readFileSync(join(dest, 'brain', 'core', 'a.md'), 'utf8'), 'CONSUMER ORIGINAL',
      'the tree must return to its pre-upgrade bytes');
    assert.ok(!existsSync(join(dest, RESTORE_POINT_DIR)),
      'a complete recovery consumes its own evidence');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── REQ-J-2: absence of a journal is itself the signal ────────────────────────
test('journal: a leftover snapshot with NO journal is cleared, not replayed (REQ-J-2)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j2-'));
  try {
    const { src, dest } = seed(tmp);
    // What a run killed DURING its snapshot leaves: bytes, but no journal.
    mkdirSync(join(dest, RESTORE_POINT_DIR, 'brain', 'core'), { recursive: true });
    writeFileSync(join(dest, RESTORE_POINT_DIR, 'brain', 'core', 'a.md'), 'STALE');

    const result = copyManaged({ srcRoot: src, destRoot: dest, managed: ['brain/core/**'], local: [] });

    assert.ok(result.copied.includes('brain/core/a.md'),
      'no journal means nothing was ever written, so the run must proceed normally');
    assert.equal(readFileSync(join(dest, 'brain', 'core', 'a.md'), 'utf8'), 'NEW BYTES',
      'stale snapshot bytes must never be restored over a tree they did not protect');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── REQ-J-3: a journal that cannot be trusted is not guessed at ───────────────
test('journal: an unparseable or unknown-version journal is treated as absent (REQ-J-3)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j3-'));
  try {
    const dir = join(tmp, RESTORE_POINT_DIR);
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(dir, JOURNAL_FILE), 'not json at all');
    assert.equal(readJournal(tmp), null, 'unparseable must read as absent');

    writeFileSync(join(dir, JOURNAL_FILE), JSON.stringify({ version: JOURNAL_VERSION + 99, saved: [], created: [], createdDirs: [] }));
    assert.equal(readJournal(tmp), null, 'an unknown version must read as absent, never be guessed at');

    writeFileSync(join(dir, JOURNAL_FILE), JSON.stringify({ version: JOURNAL_VERSION, saved: 'nope' }));
    assert.equal(readJournal(tmp), null, 'a malformed shape must read as absent');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── REQ-J-4: the journal is written before the first write, not after ─────────
test('journal: it exists from before the first write, so a kill can never miss it (REQ-J-4)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j4-'));
  try {
    const { src, dest } = seed(tmp);
    let journalAtFirstWrite = null;

    copyManaged({
      srcRoot: src, destRoot: dest, managed: ['brain/core/**'], local: [],
      // This fn runs as the FIRST write of the run. If the journal is not already on
      // disk here, a kill one instruction earlier would leave an unreplayable snapshot.
      specialMerge: { 'brain/core/a.md': (dp, sp) => {
        journalAtFirstWrite = readJournal(dest);
        writeFileSync(dp, readFileSync(sp));
      } },
    });

    assert.ok(journalAtFirstWrite, 'the journal must already exist when the first write happens');
    assert.deepEqual(journalAtFirstWrite.saved, ['brain/core/a.md']);
    assert.ok(!existsSync(join(dest, RESTORE_POINT_DIR)),
      'and a clean run must leave neither journal nor snapshot behind');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── REQ-J-5: concurrent runs cannot shred each other's restore point ──────────
test('journal: the lock is exclusive, and survives clearing the snapshot dir (REQ-J-5)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j5-'));
  try {
    const first = acquireLock(tmp);
    assert.throws(() => acquireLock(tmp), /another brain:upgrade appears to be running/,
      'a second concurrent run must be refused, not allowed to shred the first restore point');

    // The lock is a SIBLING of the snapshot dir, so a run clearing that dir on entry
    // must not release a lock it does not hold.
    rmSync(join(tmp, RESTORE_POINT_DIR), { recursive: true, force: true });
    assert.throws(() => acquireLock(tmp), /another brain:upgrade appears to be running/);

    first.release();
    const second = acquireLock(tmp);
    assert.ok(second.path, 'the lock must be retakeable once released');
    second.release();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
