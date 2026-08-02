#!/usr/bin/env node
// brain-upgrade.mjs — Install/update the brain core in a consumer repo.
// Usage: npm run brain:upgrade -- <tag> [--dry-run] [--no-install] [--force]
//
// What it does (ADR-0006):
//   1. Installs the requested tag:  npm i -D git+https://github.com/csrinaldi/brain.git#<tag>
//      (skip with --no-install if node_modules/brain is already the right tag).
//   2. Copies ONLY the managed paths (brain/core/**, brain/scripts/**, .gitattributes)
//      from node_modules/brain/ into this repo, overwriting them.
//   3. Migrates brain.config.json additively — new keys are added, existing
//      values are never overwritten.
//
// What it NEVER does: touch brain/project/**, brain.config.json values, .env,
// openspec/changes/**, or .memory/**. core is read-only in the consumer
// (ADR-0003). The upgrade is NOT auto-applied anywhere — you run it on purpose
// (anti-pattern: instaladores-autoactualizantes-no-inocuos).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyManaged, mergeClaudeSettings, mergePackageJson, migrateConfig, installSpec, recoverFromJournal, readJournal, acquireLock, breakStaleLock, RESTORE_POINT_DIR } from './lib/installer.mjs';
import { detectPM } from './lib/pm.mjs';

const ROOT = process.cwd();
const PM = detectPM(ROOT).name;

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.warn(`  ${C.yellow}⚠${C.reset} ${m}`);
const info = (m) => console.log(`  ${C.cyan}ℹ${C.reset}  ${m}`);
const die = (m) => { console.error(`  ${C.red}✗${C.reset} ${m}`); process.exit(1); };

// ── Parse args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const tag = args.find((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');
const noInstall = flags.has('--no-install');
const force = flags.has('--force');
const abortOnCollision = flags.has('--abort-on-collision');
const recover = flags.has('--recover');

// ── --recover ──────────────────────────────────────────────────────────────────
// Replays the restore point a KILLED run left behind. Deliberately explicit and
// deliberately terminal: between that crash and now the consumer may have repaired
// things by hand, so this never runs by itself and never chains into an upgrade.
//
// Runs BEFORE the lock is taken, and this ordering is not incidental. A SIGKILL runs
// no exit handler, so the lock it held ALWAYS survives the crash — meaning the one
// command that repairs a killed run would otherwise be the one command guaranteed to
// be blocked by it. Recovery breaks a stale lock instead of yielding to it: the run
// that owned it is by definition dead.
if (recover) {
  breakStaleLock(ROOT);
  if (dryRun) {
    const pending = readJournal(ROOT);
    if (!pending) {
      info('--dry-run: nothing to recover — no interrupted upgrade was recorded here.');
    } else {
      info(`--dry-run: would restore ${pending.saved.length + pending.created.length} managed path(s) from ${join(ROOT, RESTORE_POINT_DIR)}:`);
      for (const f of [...pending.saved, ...pending.created]) console.log(`      ${C.dim}${f}${C.reset}`);
      info('Re-run without --dry-run to actually restore.');
    }
    process.exit(0);
  }
  const result = recoverFromJournal({ destRoot: ROOT });
  if (!result) {
    info('Nothing to recover — no interrupted upgrade was recorded here.');
    process.exit(0);
  }
  ok(`Restored ${result.recovered.length} managed path(s) to their pre-upgrade bytes.`);
  for (const f of result.recovered) console.log(`      ${C.dim}${f}${C.reset}`);
  if (result.failed.length > 0) {
    warn(`Could NOT restore ${result.failed.length} path(s):`);
    for (const f of result.failed) console.log(`      ${C.dim}${f}${C.reset}`);
    info(`Their pre-upgrade bytes were KEPT at ${result.snapshotDir} — restore from there, then delete it.`);
    die('Recovery is INCOMPLETE. Inspect the paths above.');
  }
  console.log(`\n${C.green}Recovered.${C.reset} Re-run the upgrade when ready.\n`);
  process.exit(0);
}

// ── Lock ───────────────────────────────────────────────────────────────────────
// Two concurrent runs would each clear and rebuild the other's restore point, so
// neither could roll back. Taken only for a real upgrade — never for --recover,
// which must work precisely when a dead run's lock is still lying around.
let lock;
try {
  lock = acquireLock(ROOT);
} catch (err) {
  // A held lock plus a journal is ambiguous BY CONSTRUCTION — a live run writes its
  // journal before its first write, so this looks identical to a run that was killed
  // holding both. Yielding is the safe read (never race a run that might be alive),
  // but the killed case is far more likely and the bare lock message sends the
  // operator to delete a file rather than to the remedy. Name both.
  const pending = readJournal(ROOT);
  if (pending) {
    console.error(`  ${C.red}✗${C.reset} ${err.message}`);
    warn(`A previous run also left an interrupted upgrade here, covering ${pending.saved.length + pending.created.length} managed path(s).`);
    die(`If no upgrade is running, run '${PM} run brain:upgrade -- --recover' — it clears that lock and puts those paths back.`);
  }
  die(err.message);
}
process.on('exit', () => lock.release());

if (!tag && !noInstall) {
  die(`missing <tag>. Usage: ${PM} run brain:upgrade -- v0.1.0 [--dry-run] [--no-install] [--force] [--recover]`);
}

// ── Self-host guard ──────────────────────────────────────────────────────────
// Running this inside the brain repo itself would copy node_modules/brain over
// the working tree — almost never what you want. The brain SOURCE repo carries
// a `.brain-source` marker file at its root (never a managed path — see
// brain/core/managed-paths.mjs, it matches no managed glob) that reliably
// identifies it. Refuse unless --force.
//
// This marker replaces the old `package.json name === "brain"` check, which
// used to die HARD here. That check false-positives on any consumer whose
// package.json was clobbered by a pre-v0.8.0 vendored upgrader (which
// plain-copied package.json instead of merging it) — permanently locking the
// clobbered consumer out of the very upgrade that would fix it (issue #180).
const sourceMarkerPath = join(ROOT, '.brain-source');
if (existsSync(sourceMarkerPath) && !force) {
  die(
    'this is the brain SOURCE repo (.brain-source marker found at repo root).\n' +
    '    brain:upgrade is for CONSUMER repos, not the brain source repo. Use --force only if you really mean it.',
  );
}

// Soft warning (non-fatal): a pre-v0.8.0 brain:upgrade plain-copied
// package.json and may have clobbered a consumer's "name" field to "brain"
// (also version/description/license). Recovery-awareness only — never
// blocks the upgrade. See brain/core/anti-patterns/ for the full writeup.
const ownPkgPath = join(ROOT, 'package.json');
if (existsSync(ownPkgPath) && !existsSync(sourceMarkerPath)) {
  try {
    const ownPkg = JSON.parse(readFileSync(ownPkgPath, 'utf8'));
    if (ownPkg.name === 'brain') {
      warn(
        'package.json name is "brain" — a pre-v0.8.0 brain:upgrade may have clobbered your project name; consider restoring it.',
      );
    }
  } catch { /* unreadable package.json — let the install step report it */ }
}

console.log(`\n${C.bold}brain:upgrade${C.reset} ${tag ? `→ ${C.cyan}${tag}${C.reset}` : ''}${dryRun ? `  ${C.dim}(dry run)${C.reset}` : ''}\n`);

// ── Interrupt handling ─────────────────────────────────────────────────────────
// Measured on this repo (366 managed files): the managed-path write is a single
// synchronous batch that finishes in ~23ms, and Node delivers signals through the
// event loop — so a SIGINT arriving mid-batch is QUEUED, never delivered, and the
// batch always runs to completion before any handler executes.
//
// Registering these handlers is therefore NOT a way to abort a half-finished
// write. It is what changes the outcome of Ctrl-C: without a handler the default
// action kills the process instantly, which is the one thing that CAN leave a
// half-applied tree. With one, the 23ms batch finishes and the tree is whole.
//
// What these handlers do NOT cover — and an earlier revision of this comment got
// wrong: a signal during the package install above kills the CHILD, and spawnSync
// returns synchronously with `{ status: null, signal }`. That path never reaches
// the flag check below; it is handled at the install step itself, which reports
// the interrupt and exits 128+signal. The flag below covers only a signal
// delivered at an await AFTER the install returned normally.
let interrupted = null;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { interrupted ??= sig; });
}

// ── 1. Install the tag ─────────────────────────────────────────────────────────
// Derive the install specifier from the currently installed brain's package.json
// repository.url (always normalized to git+https://…) so HTTPS-only consumers
// (CI, containers without an SSH key) can install the private repo reliably.
// Falls back to the canonical constant when the file/field is absent.
const spec = installSpec(ROOT, tag);
const pm = detectPM(ROOT);
if (!noInstall) {
  if (dryRun) {
    info(`would run: ${[...pm.installArgs, spec].join(' ')}`);
  } else {
    info(`Installing ${spec} ...`);
    const r = spawnSync(pm.installArgs[0], [...pm.installArgs.slice(1), spec], { stdio: 'inherit', cwd: ROOT });
    // Signal BEFORE status, and this order is load-bearing. A child killed by a
    // signal reports `status: null`, so testing status first reports a plain
    // Ctrl-C as "install failed — check repo access", and collapses the
    // conventional 128+signal exit code into a bare 1. Nothing has been copied at
    // this point on either path.
    if (r.signal) {
      console.error(`\n  ${C.red}✗${C.reset} Install interrupted by ${r.signal} — no managed path was written.`);
      process.exit(r.signal === 'SIGTERM' ? 143 : 130);
    }
    if (r.status !== 0) die(`${pm.name} install failed — check repo access and that the tag exists.`);
    ok('Package installed.');
  }
}

// ── 2. Copy managed paths ───────────────────────────────────────────────────────
const pkgRoot = join(ROOT, 'node_modules', 'brain');
if (!existsSync(pkgRoot)) {
  die(`node_modules/brain not found — install brain first (drop --no-install).`);
}

const { managed, local } = await import(join(pkgRoot, 'brain', 'core', 'managed-paths.mjs'));

// A signal raised during the install above is delivered here, at the first await
// after it — before any managed path has been written.
if (interrupted) {
  // Same signal, same exit code as the install step and the final summary — `die()`
  // would exit 1 here and make one interrupt look like three different outcomes
  // depending on when it landed. Note it says "no managed path", not "nothing":
  // step 1 already rewrote package.json, the lockfile and node_modules.
  console.error(`  ${C.red}✗${C.reset} ${interrupted} received before the copy began — no managed path was written.`);
  process.exit(interrupted === 'SIGTERM' ? 143 : 130);
}

let copied, skipped, merged, collisions;
try {
  ({ copied, skipped, merged, collisions } = copyManaged({
    srcRoot: pkgRoot,
    destRoot: ROOT,
    managed,
    local,
    dryRun,
    specialMerge: { '.claude/settings.json': mergeClaudeSettings, 'package.json': mergePackageJson },
    abortOnCollision,
  }));
} catch (err) {
  // copyManaged snapshots every path it may write BEFORE its first write and
  // restores those bytes before re-throwing (#396), so there is normally nothing
  // half-applied to repair by hand. Say which of the two it was — a rollback that
  // only partly worked must never be reported as a clean one.
  // An interrupted previous run is not this run's failure — it is a decision the
  // operator has to make, so it gets its own wording and its own remedy.
  if (err?.interruptedRun) {
    console.error(`  ${C.red}✗${C.reset} ${err.message}`);
    die(`Run '${PM} run brain:upgrade -- --recover' to put those paths back.`);
  }

  // A refusal happens before the first write, so the write-phase wording would be
  // false in both halves — say what actually happened instead.
  if (err?.beforeAnyWrite) {
    console.error(`  ${C.red}✗${C.reset} Upgrade refused before any managed path was written: ${err?.message ?? err}`);
    die('Nothing was changed. Resolve the paths named above and re-run.');
  }

  console.error(`  ${C.red}✗${C.reset} Upgrade failed while writing managed paths: ${err?.message ?? err}`);
  // The root cause lives in `cause` whenever the rollback state had to be carried on
  // a wrapper (a frozen or non-object throw), and it is the only line that says WHY.
  if (err?.cause !== undefined) {
    console.error(`      ${C.dim}caused by: ${err.cause?.message ?? err.cause}${C.reset}`);
  }
  if (err?.rollbackIncomplete?.length) {
    warn(`Rollback could NOT restore ${err.rollbackIncomplete.length} path(s) — still modified:`);
    for (const f of err.rollbackIncomplete) console.log(`      ${C.dim}${f}${C.reset}`);
    if (err.rollbackSnapshotDir) {
      info(`Their pre-copy bytes were KEPT at ${err.rollbackSnapshotDir}`);
      info('That directory is never cleared automatically — restore from it, then delete it yourself.');
    }
    die('The tree is NOT fully restored. Inspect the paths above before retrying.');
  }
  // Scoped deliberately. Step 1 already ran the package install, which rewrote
  // package.json, the lockfile and node_modules BEFORE any snapshot was taken —
  // so "the tree is unchanged" would be a false statement to print here.
  die('Every managed path was rolled back to the bytes it had before the copy. The dependency install was NOT reverted.');
}

// ── Collision report ────────────────────────────────────────────────────────────
// Emitted before the summary so the operator sees it immediately. The non-zero
// exit (under --abort-on-collision) is deferred until AFTER the plan/summary is
// printed (see below), so a `--dry-run --abort-on-collision` preview still shows
// the full "would copy/merge" plan instead of blanking it.
if (collisions.length > 0) {
  if (abortOnCollision) {
    const effect = dryRun ? 'a live upgrade would write zero files' : 'zero files were written';
    warn(`Aborting: ${collisions.length} collision(s) detected — destination differs from brain source (${effect}).`);
  } else {
    warn(`${collisions.length} collision(s) detected (destination differs from brain source). Proceeding — review the diff:`);
  }
  for (const f of collisions) console.log(`      ${C.dim}${f}${C.reset}`);
}

if (dryRun) {
  info(`would copy ${copied.length} managed file(s):`);
  for (const f of copied) console.log(`      ${C.dim}${f}${C.reset}`);
  if (merged.length) {
    info(`would merge ${merged.length} settings file(s) (consumer content preserved):`);
    for (const f of merged) console.log(`      ${C.dim}${f}${C.reset}`);
  }
} else {
  ok(`Copied ${copied.length} managed file(s) (brain/core, scripts, .gitattributes).`);
  if (merged.length) {
    ok(`Merged ${merged.length} settings file(s) additively (consumer content preserved):`);
    for (const f of merged) console.log(`      ${C.dim}${f}${C.reset}`);
  }
}
if (skipped.length) {
  warn(`Skipped ${skipped.length} path(s) that overlap local ownership (local wins):`);
  for (const f of skipped) console.log(`      ${C.dim}${f}${C.reset}`);
}

// Deferred non-zero exit: the plan/summary has now been printed, so stop here —
// before config migration — when the caller asked to abort on collisions.
if (abortOnCollision && collisions.length > 0) process.exit(1);

// ── 3. Migrate brain.config.json (additive) ─────────────────────────────────────
const configPath = join(ROOT, 'brain.config.json');
const { migrations } = await import(join(pkgRoot, 'brain', 'core', 'config-migrations.mjs'));
const installedVersion = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version;

if (!existsSync(configPath)) {
  warn(`brain.config.json not found — skipping migration. Create it and re-run, or run env:init.`);
} else {
  const current = JSON.parse(readFileSync(configPath, 'utf8'));
  const { config: migrated, applied } = migrateConfig(current, migrations, installedVersion);
  if (dryRun) {
    info(applied.length
      ? `would apply config migration(s): ${applied.join(', ')}`
      : 'config already up to date — no migrations pending.');
  } else if (applied.length) {
    writeFileSync(configPath, JSON.stringify(migrated, null, 2) + '\n');
    ok(`Applied config migration(s): ${applied.join(', ')} (schemaVersion → ${migrated.schemaVersion}).`);
  } else {
    // Still persist schemaVersion bump if it advanced without key changes.
    if (migrated.schemaVersion !== current.schemaVersion) {
      writeFileSync(configPath, JSON.stringify(migrated, null, 2) + '\n');
    }
    ok('Config already up to date — no migrations pending.');
  }
}

console.log(`\n${C.green}Done.${C.reset} Review the diff and commit. ${C.dim}core is read-only — improvements go upstream.${C.reset}`);
console.log(`${C.dim}Tip:${C.reset} run ${C.cyan}npm run env:init${C.reset} to (re)configure git hooks (${C.dim}core.hooksPath${C.reset} is per-clone, not committed) and the environment. ${C.dim}day:start also self-heals it.${C.reset}\n`);

// A deferred interrupt. Exactly WHEN it landed is not knowable here — it may have
// arrived during the write, the config migration, or this summary — so the report
// states only what is certain, then honours the signal in the exit code.
if (interrupted) {
  if (dryRun) {
    warn(`${interrupted} received during a dry run — nothing was written.`);
  } else {
    warn(`${interrupted} was received and deferred. The managed-path write is a single synchronous batch that a signal cannot interrupt, so it ran to completion: the upgrade is applied, not half-applied. Nothing to clean up.`);
  }
  process.exit(interrupted === 'SIGTERM' ? 143 : 130);
}
