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
import { spawn, spawnSync } from 'node:child_process';
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
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('child never reached the write')), 20000);
        proc.on('error', (e) => { clearTimeout(timer); reject(e); });
        proc.stdout.on('data', (d) => {
          if (d.toString().includes('WROTE')) { clearTimeout(timer); resolve(); }
        });
      });
    } finally {
      // The child busy-spins by design, so it MUST be killed on every path. Without
      // this the timeout branch leaves it spinning, its handle keeps the test
      // runner's event loop referenced, and the CI job hangs at 100% CPU until its
      // wall clock kills it — a hang is worse than the failure it was reporting.
      proc.kill('SIGKILL');
    }
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

// ── REQ-J-6: the real CLI, over the exact state a kill leaves behind ──────────
// REQ-J-1 proves a SIGKILL leaves {journal, snapshot, stale lock}. This stages that
// state and drives the REAL brain-upgrade.mjs over it, which is where the wiring
// lives: three defects (the refusal deleting its own evidence, the stale lock
// blocking the only remedy, and --recover ignoring --dry-run) were all invisible to
// tests that called the library directly.
function stageKilledRun(tmp) {
  const consumer = join(tmp, 'consumer');
  const pkg = join(consumer, 'node_modules', 'brain');
  mkdirSync(join(pkg, 'brain', 'core'), { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'brain', version: '9.9.9' }));
  writeFileSync(join(pkg, 'brain', 'core', 'managed-paths.mjs'),
    'export const managed = ["brain/core/**"];\nexport const local = [];\nexport const MANAGED_SCRIPT_KEYS = [];\n');
  writeFileSync(join(pkg, 'brain', 'core', 'config-migrations.mjs'), 'export const migrations = [];\n');
  writeFileSync(join(pkg, 'brain', 'core', 'a.md'), 'NEW UPSTREAM BYTES');

  // The consumer tree as the kill left it: half-applied.
  mkdirSync(join(consumer, 'brain', 'core'), { recursive: true });
  writeFileSync(join(consumer, 'brain', 'core', 'a.md'), 'NEW UPSTREAM BYTES');

  // …plus exactly what the dead run left: snapshot + journal + a lock it never released.
  const snap = join(consumer, RESTORE_POINT_DIR);
  mkdirSync(join(snap, 'brain', 'core'), { recursive: true });
  writeFileSync(join(snap, 'brain', 'core', 'a.md'), 'CONSUMER ORIGINAL');
  writeFileSync(join(snap, JOURNAL_FILE), JSON.stringify(
    { version: JOURNAL_VERSION, saved: ['brain/core/a.md'], created: [], createdDirs: [] }));
  writeFileSync(join(consumer, RESTORE_POINT_DIR + '.lock'), '424242\n');
  return consumer;
}

const CLI = fileURLToPath(new URL('../brain-upgrade.mjs', import.meta.url));
const runCli = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

test('journal: the real CLI refuses over a killed run WITHOUT destroying its evidence (REQ-J-6)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j6-'));
  try {
    const consumer = stageKilledRun(tmp);
    const snapshotFile = join(consumer, RESTORE_POINT_DIR, 'brain', 'core', 'a.md');

    const r = runCli(consumer, ['v1.2.3', '--no-install']);
    assert.notEqual(r.status, 0, 'a run over an interrupted predecessor must not succeed');
    assert.match(r.stderr + r.stdout, /--recover/, 'it must name the remedy');
    assert.ok(existsSync(snapshotFile),
      'the refusal must NOT delete the snapshot it just told the operator to recover from');
    assert.equal(readFileSync(snapshotFile, 'utf8'), 'CONSUMER ORIGINAL');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('journal: --recover works through a stale lock, and honours --dry-run (REQ-J-7)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brain-j7-'));
  try {
    const consumer = stageKilledRun(tmp);
    const target = join(consumer, 'brain', 'core', 'a.md');

    // A SIGKILL runs no exit handler, so the lock ALWAYS survives — recovery must not
    // be the one command that lock blocks.
    const dry = runCli(consumer, ['--recover', '--dry-run']);
    assert.equal(dry.status, 0, '--dry-run recovery must not fail on the stale lock');
    assert.equal(readFileSync(target, 'utf8'), 'NEW UPSTREAM BYTES',
      '--dry-run must not write, even on the recovery path');

    const real = runCli(consumer, ['--recover']);
    assert.equal(real.status, 0, `recovery must succeed through a stale lock — got: ${real.stderr}`);
    assert.equal(readFileSync(target, 'utf8'), 'CONSUMER ORIGINAL',
      'recovery must return the tree to its pre-upgrade bytes');
    assert.ok(!existsSync(join(consumer, RESTORE_POINT_DIR)),
      'a complete recovery consumes its own evidence');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
