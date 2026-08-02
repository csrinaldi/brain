// installer.mjs — Pure(ish) building blocks for the brain versioned installer.
//
// These functions implement the mechanics behind `brain:upgrade` and the
// `day:start` check-and-notify. They are deliberately small and side-effect
// free where possible so they can be unit-tested without a network or a real
// git remote (see installer.test.mjs).
//
// Contract (ADR-0003 / ADR-0006): the upgrade copies only the paths declared
// `managed` in brain/core/managed-paths.mjs and never touches `local` paths.
// Config migrations are additive: existing consumer values always win.

import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, dirname, relative, sep } from 'node:path';
import { MANAGED_SCRIPT_KEYS } from '../../core/managed-paths.mjs';

// ── Glob matching ────────────────────────────────────────────────────────────
// Minimal glob → RegExp for the manifest syntax: `*` (no separator) and `**`
// (recursive). A trailing `/**` also matches the directory's own entries.

/**
 * Compiles a single glob pattern to a RegExp anchored at both ends.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` → match anything (including separators). Swallow an optional
        // following slash so `a/**` matches `a/b` and `a/b/c`.
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Returns true if `relPath` (POSIX-style, repo-relative) matches any glob.
 * @param {string} relPath
 * @param {string[]} globs
 * @returns {boolean}
 */
export function matchesAny(relPath, globs) {
  return globs.some((g) => globToRegExp(g).test(relPath));
}

// ── File walking ─────────────────────────────────────────────────────────────

/**
 * Recursively lists files under `root`, returning POSIX-style relative paths.
 * Skips node_modules and the .git directory — neither is ever a managed path
 * and walking them would be slow and noisy.
 * @param {string} root
 * @returns {string[]}
 */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        out.push(relative(root, abs).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Builds the restore/discard/preserve handle over a captured snapshot.
 *
 * Extracted so the journal-recovery path (`recoverFromJournal`) replays a snapshot
 * left by a run that DIED, using exactly the same restore logic a live run uses —
 * two implementations of "put the tree back" is precisely the class of bug this
 * repo batches under #315/#316/#340.
 *
 * @param {{destRoot: string, dir: string, saved: string[], created: string[], createdDirs: Set<string>}} snap
 */
function restoreHandle({ destRoot, dir, saved, created, createdDirs }) {
  return {
    dir,
    saved,
    created,
    /**
     * Returns every captured path to its pre-write state.
     *
     * Best-effort per path, deliberately: one unrecoverable entry must not strand
     * the rollback of all the others. (`rmSync(..., { force: true })` suppresses
     * ENOENT but NOT ENOTDIR, so a managed path whose parent exists as a file
     * would otherwise abort the whole restore — and its throw would replace the
     * original failure the caller is trying to report.)
     *
     * @returns {{ failed: string[] }} Paths that could not be returned to their
     *   prior state. Non-empty means the tree is still dirty and the caller must
     *   say so rather than report a clean rollback.
     */
    restore() {
      const failed = [];

      for (const rel of saved) {
        const target = join(destRoot, rel);
        try {
          // Recovery can run long after the crash, and the consumer may have deleted
          // the half-written directory in the meantime. A live rollback never needed
          // this — the write loop had just created the parent.
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(join(dir, rel), target);
        } catch { failed.push(rel); }
      }

      // Judged by outcome, not by whether the call threw: a path that is gone was
      // rolled back either way, and a path the write never reached was never dirty.
      // Only a path still on disk afterwards is a real failure.
      for (const rel of created) {
        const path = join(destRoot, rel);
        try { rmSync(path, { force: true }); } catch { /* verified on the next line */ }
        if (pathPresent(path)) failed.push(rel);
      }

      // Deepest first, so a nested chain empties from the leaf up. A directory that
      // is no longer empty was repopulated by something outside this call — leaving
      // it in place is correct, not a failure.
      for (const d of [...createdDirs].sort((a, b) => b.length - a.length)) {
        try {
          if (pathPresent(d) && readdirSync(d).length === 0) rmSync(d, { recursive: true, force: true });
        // Reported repo-relative like every other entry: the caller prints them as
        // one list, and mixing absolute with relative paths reads as two bugs.
        } catch { failed.push(relative(destRoot, d)); }
      }

      return { failed };
    },
    /**
     * Drops the snapshot. Safe to call after restore().
     *
     * The JOURNAL goes first, deliberately. `rmSync` gives no ordering guarantee, so a
     * crash midway through a recursive delete could otherwise leave a journal
     * describing a snapshot that is already half-gone — and the next run would trust
     * it. Removing the journal first makes an interrupted discard fail SAFE: what
     * survives is an unreferenced directory, which the next run treats as debris.
     */
    discard() {
      try { rmSync(join(dir, JOURNAL_FILE), { force: true }); } catch { /* fall through */ }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ── Restore point (rollback) ──────────────────────────────────────────────────

/**
 * Directory the pre-write snapshot is staged in, relative to the consumer root.
 * Kept inside the repo so the snapshot lands on the same filesystem as the files
 * it protects. It matches no `managed` glob, so an upgrade never copies over its
 * own restore point (pinned by test — REQ-S6-6).
 */
export const RESTORE_POINT_DIR = '.brain-upgrade-backup';

/**
 * The journal, written INSIDE the snapshot directory.
 *
 * Its presence is the whole signal, and the moment it is written is what makes that
 * signal trustworthy: it lands AFTER the snapshot is complete and BEFORE the first
 * write. So on a later run, a leftover snapshot directory means one of exactly two
 * things, and they are told apart by this file alone:
 *
 *   no journal  → the previous run died while snapshotting. Nothing was written, so
 *                 the leftover protects nothing and is safe to clear.
 *   journal     → the previous run died between its first and last write. Those bytes
 *                 are the only surviving record of the pre-upgrade tree.
 *
 * Without that distinction, replaying a leftover snapshot could restore bytes over a
 * tree the previous run never touched.
 */
export const JOURNAL_FILE = 'journal.json';

/** Bumped when the journal's shape changes; an unrecognised version is ignored, never guessed at. */
export const JOURNAL_VERSION = 1;

/** Lock path, deliberately a SIBLING of the snapshot dir so clearing that dir never releases it. */
export const LOCK_PATH_SUFFIX = '.lock';

/**
 * Forces a path's bytes (or a directory's entries) to stable storage.
 *
 * Recovery code cannot rely on the page cache. On a power cut, ext4's default
 * ordering commits metadata without guaranteeing data, and gives NO ordering at all
 * between two independent files — so a journal could land while the snapshot bytes
 * it describes did not. Recovery would then restore a zero-length file over the
 * consumer's real content AND report success, which is the worst outcome this code
 * can produce. Best-effort: a filesystem that refuses fsync is not a reason to abort
 * an upgrade, but it IS a reason not to have claimed durability without trying.
 */
function fsyncPath(p) {
  let fd;
  try {
    fd = openSync(p, 'r');
    fsyncSync(fd);
  } catch { /* best effort */ } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { /* ignore */ } }
  }
}

/**
 * Removes a lock left by a run that died.
 *
 * Only `--recover` may call this, and the reasoning is narrow: a SIGKILL runs no exit
 * handler, so the lock ALWAYS survives the crash. Without this, the one command that
 * repairs a killed run is the one command that killed run is guaranteed to block.
 * The run that held it is dead by definition — there is nothing to yield to.
 */
export function breakStaleLock(destRoot) {
  try { rmSync(join(destRoot, RESTORE_POINT_DIR + LOCK_PATH_SUFFIX), { force: true }); } catch { /* cosmetic */ }
}

function writeJournal({ dir, saved, created, createdDirs, destRoot }) {
  const journal = {
    version: JOURNAL_VERSION,
    saved,
    created,
    createdDirs: [...createdDirs].map((d) => relative(destRoot, d)),
  };
  mkdirSync(dir, { recursive: true });
  const path = join(dir, JOURNAL_FILE);
  writeFileSync(path, JSON.stringify(journal, null, 2) + '\n');
  // The journal is the last thing written before the first managed write, so this is
  // the barrier that makes "journal present" mean "the snapshot below it is durable".
  fsyncPath(path);
  fsyncPath(dir);
}

/**
 * Reads a journal left by an interrupted run, or null when there is none to trust.
 *
 * Fails closed on anything malformed: a journal that cannot be parsed, carries an
 * unknown version, or lacks its path arrays is treated as ABSENT rather than
 * guessed at — replaying a half-understood journal is worse than not replaying.
 *
 * @param {string} destRoot
 * @returns {{version: number, saved: string[], created: string[], createdDirs: string[]}|null}
 */
export function readJournal(destRoot) {
  try {
    const j = JSON.parse(readFileSync(join(destRoot, RESTORE_POINT_DIR, JOURNAL_FILE), 'utf8'));
    if (j?.version !== JOURNAL_VERSION) return null;
    if (!Array.isArray(j.saved) || !Array.isArray(j.created) || !Array.isArray(j.createdDirs)) return null;
    return j;
  } catch {
    return null;
  }
}

/**
 * Replays a journal left by a run that DIED — the SIGKILL / power-loss path slice 1
 * could not cover, because no in-process handler runs for those.
 *
 * Deliberately NOT automatic. Between the crash and this call the consumer may have
 * repaired things by hand, and replaying stale snapshot bytes over that repair would
 * destroy work while reporting success. The caller reaches this only on an explicit
 * request; `createRestorePoint` refuses until it happens.
 *
 * @param {{destRoot: string}} opts
 * @returns {{recovered: string[], failed: string[], snapshotDir: string|null}|null}
 *   null when there is nothing to recover.
 */
export function recoverFromJournal({ destRoot }) {
  const journal = readJournal(destRoot);
  if (!journal) return null;

  const dir = join(destRoot, RESTORE_POINT_DIR);
  const handle = restoreHandle({
    destRoot,
    dir,
    saved: journal.saved,
    created: journal.created,
    createdDirs: new Set(journal.createdDirs.map((d) => join(destRoot, d))),
  });

  const { failed } = handle.restore();
  const recovered = [...journal.saved, ...journal.created].filter((p) => !failed.includes(p));

  if (failed.length === 0) {
    safeDiscard(handle);
    return { recovered, failed, snapshotDir: null };
  }
  // Same rule as a live rollback: what could not be put back keeps its evidence AND
  // keeps the gate armed, so the next run still refuses over the still-dirty tree.
  return { recovered, failed, snapshotDir: dir };
}

/**
 * Takes an exclusive lock for the whole upgrade, or refuses.
 *
 * Two concurrent runs in one repo would each clear and rebuild the other's restore
 * point, so neither could roll back. `wx` makes the create atomic — there is no
 * check-then-create window to lose.
 *
 * @param {string} destRoot
 * @returns {{path: string, release: () => void}}
 */
export function acquireLock(destRoot) {
  const path = join(destRoot, RESTORE_POINT_DIR + LOCK_PATH_SUFFIX);
  try {
    writeFileSync(path, `${process.pid}\n`, { flag: 'wx' });
  } catch (err) {
    if (err?.code === 'EEXIST') {
      throw new Error(
        `another brain:upgrade appears to be running in this repo (lock at ${path}). ` +
        'If none is, delete that file and re-run.',
      );
    }
    throw err;
  }
  return {
    path,
    release() { try { rmSync(path, { force: true }); } catch { /* cosmetic */ } },
  };
}

/**
 * `lstat` without throwing — returns null when the path is absent.
 *
 * Deliberately NOT `existsSync`, which follows symlinks and therefore reports a
 * DANGLING link as absent. That misclassification is load-bearing here: a path
 * wrongly judged absent is recorded as "created by this run" and is DELETED on
 * rollback, destroying an entry that existed before the call.
 *
 * @param {string} p
 * @returns {import('node:fs').Stats|null}
 */
function lstatOrNull(p) {
  try { return lstatSync(p); } catch { return null; }
}

/** True when something occupies `p` — including a symlink with no target. */
function pathPresent(p) {
  return lstatOrNull(p) !== null;
}

/**
 * True when `p`, after every symlink ON ITS WHOLE PATH is resolved, lands outside
 * `destRoot`.
 *
 * This is the real, measured boundary — not "is it a symlink". A symlink pointing
 * INSIDE the repo round-trips perfectly: `copyFileSync` follows it when the
 * snapshot is taken, follows it again on the write, and follows it a third time on
 * restore, so the target ends at its original bytes and the link itself is never
 * touched. Refusing those would soft-lock a consumer for no gain — and
 * `AGENTS.md -> CLAUDE.md`, a managed path, is the canonical agent-interop symlink.
 *
 * What genuinely cannot be covered is a write that lands outside `destRoot`, since
 * the snapshot lives inside it. Resolving the whole path (not just the leaf) is
 * what catches a symlinked ANCESTOR directory, which a leaf-only check misses.
 *
 * @param {string} destRoot
 * @param {string} p
 * @returns {boolean}
 */
function escapesRoot(destRoot, p) {
  let rootReal;
  try { rootReal = realpathSync(destRoot); } catch { return false; }

  // Resolve the deepest ancestor that exists, then re-attach the tail that does
  // not — so a path scheduled to be CREATED under a symlinked parent is judged on
  // where it would actually land.
  const tail = [];
  for (let cur = p; ;) {
    try {
      const base = realpathSync(cur);
      const resolved = tail.length ? join(base, ...tail) : base;
      return resolved !== rootReal && !resolved.startsWith(rootReal + sep);
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return false; // nothing on the path resolves at all
      tail.unshift(basename(cur));
      cur = parent;
    }
  }
}

/**
 * Drops a restore point without ever letting cleanup failure masquerade as the
 * action failing.
 *
 * `rmSync(..., { force: true })` suppresses ENOENT but NOT EACCES/EPERM/EBUSY, so
 * an unguarded discard can turn a fully-applied upgrade into a reported failure —
 * and inside a `catch`, its throw would replace the very error being reported. A
 * leftover snapshot directory is cosmetic; a false failure report is not.
 */
function safeDiscard(restorePoint) {
  try { restorePoint.discard(); } catch { /* cosmetic — never surface as failure */ }
}

/**
 * Attaches rollback state to a failure without ever losing the original.
 *
 * A bare `err.rollbackIncomplete = …` is not safe: modules are strict mode, so
 * assigning to a string, a frozen Error or null throws a TypeError that REPLACES
 * the failure being reported and drops the dirty-tree signal with it — leaving
 * the caller to print a clean-rollback message over a dirty tree. `specialMerge`
 * is caller-supplied on an exported API, so a non-Error throw is reachable
 * without touching this file.
 *
 * @param {unknown} err     Whatever the write loop threw.
 * @param {string[]} failed Paths `restore()` could not put back.
 * @param {string} snapshotDir Where the surviving snapshot was left.
 * @returns {unknown} `err` itself when it can carry the annotation, else a
 *   wrapper carrying `err` as `cause`.
 */
function annotateRollback(err, failed, snapshotDir) {
  if (failed.length === 0) return err;
  if (err !== null && typeof err === 'object') {
    try {
      err.rollbackIncomplete = failed;
      err.rollbackSnapshotDir = snapshotDir;
      return err;
    } catch { /* frozen or sealed — fall through to the wrapper */ }
  }
  const wrapped = new Error(
    `upgrade failed and the rollback was incomplete — ${failed.length} path(s) still modified`,
    { cause: err },
  );
  wrapped.rollbackIncomplete = failed;
  wrapped.rollbackSnapshotDir = snapshotDir;
  return wrapped;
}

/**
 * Captures the current on-disk state of `relPaths` so a failed write can be undone.
 *
 * Why this exists (#396): `copyManaged` writes the managed payload with a
 * sequential loop of copy/merge calls. A throw partway through — ENOSPC, EACCES,
 * an unreadable source file, a merge function rejecting malformed consumer JSON —
 * used to leave the consumer tree half old and half new, recoverable only through
 * the consumer's own git hygiene.
 *
 * The snapshot is taken BEFORE the first write, so restoring every captured path
 * returns the tree to its pre-write bytes no matter where in the loop the failure
 * landed. Paths that did not exist beforehand are recorded under `created` and are
 * DELETED on restore rather than restored — a fresh install rolls back to absent,
 * not to empty. Directories the write would have had to create are pruned too, so
 * a rollback leaves no empty scaffolding behind.
 *
 * Taking the snapshot can itself fail — it writes to the same disk that is about
 * to be written. That is the safe ordering, not a gap: it throws before any
 * managed path has been touched, so the caller observes zero writes.
 *
 * NOT covered here: SIGKILL and power loss, which run no in-process handler at
 * all. Surviving those needs an on-disk journal replayed by the NEXT invocation;
 * this snapshot directory is the substrate that work builds on. Tracked as the
 * second half of #396.
 *
 * @param {object} opts
 * @param {string} opts.destRoot  Consumer repo root.
 * @param {string[]} opts.relPaths  Every dest-relative path the caller may write.
 * @returns {{ dir: string, saved: string[], created: string[], restore: () => void, discard: () => void }}
 */
export function createRestorePoint({ destRoot, relPaths }) {
  const dir = join(destRoot, RESTORE_POINT_DIR);
  const saved = [];
  const created = [];
  const createdDirs = new Set();
  const escaping = [];
  const dangling = [];

  // INVERTED from slice 1, as that slice's own comment said it must be. A leftover
  // snapshot is no longer debris to clear — with a recovery path in place it may be
  // the only surviving record of a tree a killed run left half-applied, and clearing
  // it here would destroy exactly what recovery replays.
  //
  // The journal is what tells the two cases apart (see JOURNAL_FILE): written after
  // the snapshot and before the first write, so its ABSENCE proves the previous run
  // never wrote anything.
  const interrupted = readJournal(destRoot);
  if (interrupted) {
    const n = interrupted.saved.length + interrupted.created.length;
    throw Object.assign(
      new Error(
        `a previous brain:upgrade was interrupted after it began writing, and its restore point ` +
        `is still here (${dir}). It covers ${n} managed path(s). Nothing will be written until ` +
        'it is dealt with: re-run with --recover to put those paths back, or delete that ' +
        'directory to discard the record and lose the ability to undo that run.',
      ),
      { interruptedRun: true, snapshotDir: dir, coveredPaths: n },
    );
  }
  // No journal: the previous run died BEFORE its first write, so what it left behind
  // protects nothing.
  rmSync(dir, { recursive: true, force: true });

  for (const rel of relPaths) {
    const dest = join(destRoot, rel);

    // Refused case 1: the write would land outside the repository, so no snapshot
    // inside it can cover the change. Catches a symlinked path AND a symlinked
    // ancestor directory — a leaf-only test misses the latter entirely.
    if (escapesRoot(destRoot, dest)) {
      escaping.push(rel);
      continue;
    }

    const st = lstatOrNull(dest);

    // Refused case 2: a DANGLING symlink. There is nothing to copy, so no snapshot
    // of it can be taken — and this is the exact shape that used to be misread as
    // "absent, created by this run" and DELETED on rollback.
    if (st?.isSymbolicLink() && !existsSync(dest)) {
      dangling.push(rel);
      continue;
    }

    if (st) {
      // Includes a VALID symlink resolving inside the repo. copyFileSync follows it
      // in every direction, so backup -> write -> restore returns the target to its
      // original bytes with the link intact. Measured, not assumed.
      const backup = join(dir, rel);
      mkdirSync(dirname(backup), { recursive: true });
      copyFileSync(dest, backup);
      fsyncPath(backup);
      saved.push(rel);
      continue;
    }

    created.push(rel);
    // Record the ancestor directories the write loop would have to create, so a
    // rollback can prune them back out instead of leaving empty dirs behind.
    for (let d = dirname(dest); d.startsWith(destRoot) && d !== destRoot && !pathPresent(d); d = dirname(d)) {
      createdDirs.add(d);
    }
  }

  // Fail closed, before a single byte is written, and ONLY for what genuinely
  // cannot be rolled back. The message names the paths and the remedy, so this is
  // an actionable refusal rather than the silent-lockout class recorded in
  // brain/core/anti-patterns/.
  if (escaping.length > 0 || dangling.length > 0) {
    rmSync(dir, { recursive: true, force: true });
    const reasons = [];
    if (escaping.length > 0) {
      reasons.push(
        `${escaping.length} path(s) resolve outside the repository, so a write there could not ` +
        `be rolled back — ${escaping.join(', ')}`,
      );
    }
    if (dangling.length > 0) {
      reasons.push(
        `${dangling.length} path(s) are symlinks with no target, so no snapshot of them can be ` +
        `taken — ${dangling.join(', ')}`,
      );
    }
    throw new Error(
      `cannot protect this upgrade: ${reasons.join('; ')}. Point them inside the repository, ` +
      'replace them with real files, or remove them, then re-run. ' +
      'A symlink resolving INSIDE the repository is fine and needs no change.',
    );
  }

  writeJournal({ dir, saved, created, createdDirs, destRoot });

  return restoreHandle({ destRoot, dir, saved, created, createdDirs });
}

// ── Copy managed paths ─────────────────────────────────────────────────────────

/**
 * Copies every file under `srcRoot` whose relative path matches a `managed`
 * glob into `destRoot`, overwriting. A path that also matches a `local` glob is
 * skipped (local always wins) and reported under `skipped`.
 *
 * Before any write begins, a read-only pre-flight pass inspects every managed
 * path that is NOT in `specialMerge`: if the destination exists and its bytes
 * differ from the source, the relative path is pushed to `collisions[]`. This
 * pre-flight always completes before the write loop starts, so a caller with
 * `abortOnCollision: true` is guaranteed to observe zero writes.
 *
 * When `abortOnCollision` is true and `collisions` is non-empty, the function
 * returns immediately — before the write loop — with empty `copied` and `merged`
 * arrays. When false (the default), all files are written and `collisions` is
 * surfaced as a warning list for the caller.
 *
 * When `specialMerge` is provided, any managed path whose relative form is a
 * key in that map is routed through the corresponding merge function instead of
 * `copyFileSync`. Those paths are excluded from the collision guard (they merge,
 * never collide). The merge function receives `(destPath, srcPath)` and is
 * responsible for writing the merged result to disk. Those paths are reported
 * under `merged` (not `copied`). Under `--dry-run` the merge function is NOT
 * called but the path still appears in `merged` so callers can plan output.
 *
 * The write loop is guarded by a restore point (#396): if any write throws, every
 * path the loop could have touched is returned to its pre-call bytes and the
 * original error is re-thrown. A caller that catches therefore sees an unchanged
 * tree, not a half-applied one. See `createRestorePoint` for what this does and
 * does not survive.
 *
 * @param {object}  opts
 * @param {string}  opts.srcRoot          Installed brain package root.
 * @param {string}  opts.destRoot         Consumer repo root.
 * @param {string[]} opts.managed
 * @param {string[]} opts.local
 * @param {boolean} [opts.dryRun]         When true, computes the plan without writing.
 * @param {boolean} [opts.abortOnCollision] When true and collisions exist, returns
 *   before the write loop with empty copied/merged arrays.
 * @param {Record<string, (destPath: string, srcPath: string) => void>} [opts.specialMerge]
 *   Map of relative path → merge function. Paths in this map bypass the collision
 *   guard and copyFileSync.
 * @returns {{ copied: string[], skipped: string[], merged: string[], collisions: string[] }}
 */
export function copyManaged({ srcRoot, destRoot, managed, local, dryRun = false, specialMerge = {}, abortOnCollision = false }) {
  const skipped = [];
  const collisions = [];
  const toCopy = [];  // rel paths for plain copyFileSync
  const toMerge = []; // rel paths for specialMerge

  // ── Pre-flight pass (read-only) ─────────────────────────────────────────────
  // Categorise every source file into skipped, toMerge, or toCopy.
  // For toCopy candidates, detect collisions: dest exists AND bytes differ.
  for (const rel of listFiles(srcRoot)) {
    if (!matchesAny(rel, managed)) continue;
    if (matchesAny(rel, local)) {
      // Overlap: local ownership wins. Never clobber the consumer.
      skipped.push(rel);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(specialMerge, rel)) {
      // Special merge path: excluded from the collision guard.
      toMerge.push(rel);
    } else {
      // Plain copy candidate: check for a collision before the write loop.
      const destFile = join(destRoot, rel);
      if (existsSync(destFile)) {
        const srcBytes = readFileSync(join(srcRoot, rel));
        const destBytes = readFileSync(destFile);
        if (!srcBytes.equals(destBytes)) {
          collisions.push(rel);
        }
      }
      toCopy.push(rel);
    }
  }

  // Write in a stable order rather than in whatever order the filesystem handed
  // back. Two reasons: an upgrade that fails partway does so at a reproducible
  // point (so a bug report is reproducible), and it matches the sorted arrays
  // this function already returns. The journal half of #396 needs a defined
  // replay order too.
  toMerge.sort();
  toCopy.sort();

  // ── Abort gate ──────────────────────────────────────────────────────────────
  // When the caller requests abort-on-collision and collisions were found, return
  // before the write loop so the caller observes zero writes. Skipped under
  // dryRun: a dry run never writes anyway, so we fall through and return the full
  // plan (toCopy/toMerge) — the caller can report it AND the collisions.
  if (abortOnCollision && !dryRun && collisions.length > 0) {
    return {
      copied: [],
      skipped: skipped.sort(),
      merged: [],
      collisions: collisions.sort(),
    };
  }

  // ── Write loop ──────────────────────────────────────────────────────────────
  // Guarded by a restore point (#396): the loop is not atomic — it is a sequence
  // of independent writes — so a throw anywhere inside it would otherwise leave
  // the tree half old and half new. The snapshot is taken before the first write
  // and covers every path either loop can touch, so the rollback is complete
  // regardless of where the failure lands.
  if (!dryRun) {
    let restorePoint;
    try {
      restorePoint = createRestorePoint({ destRoot, relPaths: [...toMerge, ...toCopy] });
    } catch (err) {
      // An interrupted-run refusal is NOT a failed snapshot. It fires because a
      // journal is already on disk, and that journal plus its snapshot are the only
      // record of a tree some killed run left half-applied. Clearing here would
      // destroy the evidence in the very act of telling the operator to recover from
      // it — the same "destroy what we promised to protect" shape as the `finally`
      // discard and the retry-clears-the-preserved-snapshot bug before it.
      if (err?.interruptedRun) throw err;

      // A genuinely failed snapshot: nothing was written, but it may have built part
      // of a backup first. Clear it — a refusal must not leave debris behind.
      rmSync(join(destRoot, RESTORE_POINT_DIR), { recursive: true, force: true });
      // Tag it so the caller can say "refused, nothing was touched" instead of the
      // write-phase wording, which would be false here in both halves.
      if (err !== null && typeof err === 'object') {
        try { err.beforeAnyWrite = true; } catch { /* frozen — wording stays generic */ }
      }
      throw err;
    }

    try {
      for (const rel of toMerge) {
        const dest = join(destRoot, rel);
        mkdirSync(dirname(dest), { recursive: true });
        specialMerge[rel](dest, join(srcRoot, rel));
      }
      for (const rel of toCopy) {
        const dest = join(destRoot, rel);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(join(srcRoot, rel), dest);
      }
    } catch (err) {
      const { failed } = restorePoint.restore();
      if (failed.length === 0) {
        // Everything went back. The snapshot has served its purpose.
        safeDiscard(restorePoint);
        throw err;
      }
      // The rollback could NOT put everything back, so the snapshot is now the only
      // surviving copy of those bytes. Move it somewhere no later run auto-clears —
      // only a COMPLETE rollback earns the cleanup, which is why this is not a
      // `finally` — and tell the caller where it went.
      // Left at the DEFAULT path on purpose. Slice 1 renamed it here, because back
      // then a retry cleared that path — but slice 2's journal makes a retry REFUSE
      // instead, and renaming would move the journal out of readJournal's sight and
      // silently disarm the gate over a tree that is still dirty.
      throw annotateRollback(err, failed, restorePoint.dir);
    }

    safeDiscard(restorePoint);
  }

  return {
    copied: toCopy.sort(),
    skipped: skipped.sort(),
    merged: toMerge.sort(),
    collisions: collisions.sort(),
  };
}

// ── Claude settings merge ─────────────────────────────────────────────────────

/**
 * Merges brain's `.claude/settings.json` into the consumer's copy without
 * overwriting consumer-owned content.
 *
 * Behaviour:
 * - No existing file at `existingPath` → write brain's block as-is.
 * - Existing file → spread consumer object (all consumer keys preserved),
 *   then for EVERY hook event brain defines (PreToolUse, PostToolUse, …),
 *   additively append brain's entries that are not already present.
 *   `permissions.allow` and every other consumer key are left untouched.
 *
 * Entry dedup is by `JSON.stringify`, so it is sensitive to key ordering: a
 * brain hook entry a consumer hand-added with a different key order would not
 * dedup and could duplicate. In practice brain owns these entries and writes
 * them with a stable key order, so this is a non-issue.
 *
 * @param {string} existingPath       Absolute path to consumer's settings.json (may not exist).
 * @param {string} brainSettingsPath  Absolute path to brain's settings.json.
 */
export function mergeClaudeSettings(existingPath, brainSettingsPath) {
  const brainSettings = JSON.parse(readFileSync(brainSettingsPath, 'utf8'));

  if (!existsSync(existingPath)) {
    mkdirSync(dirname(existingPath), { recursive: true });
    writeFileSync(existingPath, JSON.stringify(brainSettings, null, 2) + '\n');
    return;
  }

  // The consumer's file is not under brain's control — a corrupt or partial
  // settings.json must fail with a file-identifying message, not an opaque
  // SyntaxError that aborts brain:upgrade with no clue which file is at fault.
  let consumerSettings;
  try {
    consumerSettings = JSON.parse(readFileSync(existingPath, 'utf8'));
  } catch (e) {
    throw new Error(
      `mergeClaudeSettings: could not parse consumer settings at ${existingPath}: ${e.message}`,
    );
  }

  // Shallow-spread preserves all top-level consumer keys (permissions.allow, etc.).
  const merged = { ...consumerSettings };

  // Merge every hook event brain defines: keep consumer entries first, then
  // append any brain entries not already present (compared by serialised value).
  // Consumer-only hook events are preserved untouched by the spread below.
  const brainHooks = brainSettings.hooks ?? {};
  if (Object.keys(brainHooks).length > 0) {
    const mergedHooks = { ...consumerSettings.hooks };
    for (const [event, brainEntries] of Object.entries(brainHooks)) {
      const consumerEntries = mergedHooks[event] ?? [];
      const seen = new Set(consumerEntries.map((e) => JSON.stringify(e)));
      const additions = brainEntries.filter((e) => !seen.has(JSON.stringify(e)));
      mergedHooks[event] = [...consumerEntries, ...additions];
    }
    merged.hooks = mergedHooks;
  }

  writeFileSync(existingPath, JSON.stringify(merged, null, 2) + '\n');
}

// ── Package.json scripts merge ─────────────────────────────────────────────────

/**
 * Merges managed brain:* script entries into a consumer's package.json without
 * overwriting consumer-owned values.
 *
 * Rules:
 * - `out = { ...consumer }` — all top-level consumer fields preserved.
 * - `out.scripts = { ...consumer.scripts }` — created empty if absent.
 * - For each [k, v] in managedScripts: add ONLY if k is NOT already in out.scripts.
 *   Consumer value wins unconditionally — never deleted, never reordered.
 * - Additions are appended in managedScripts iteration order (MANAGED_SCRIPT_KEYS
 *   order when the caller is mergePackageJson).
 * - Serialized as `JSON.stringify(out, null, 2) + '\n'` — matches every other
 *   JSON writer in the repo (mergeClaudeSettings, migrateConfig).
 *
 * @param {string|object} consumerPkgRaw  Consumer's package.json — text or parsed object.
 * @param {Record<string, string>} managedScripts  Brain-managed key→target map.
 * @param {string} [label]  Optional file path for error messages (mirrors mergeClaudeSettings).
 * @returns {string} Serialized package.json (2-space indent + trailing newline).
 */
export function mergePackageJsonScripts(consumerPkgRaw, managedScripts, label) {
  let consumer;
  if (typeof consumerPkgRaw === 'string') {
    try {
      consumer = JSON.parse(consumerPkgRaw);
    } catch (e) {
      const at = label ? ` at ${label}` : '';
      throw new Error(
        `mergePackageJsonScripts: could not parse consumer package.json${at}: ${e.message}`,
      );
    }
  } else {
    consumer = consumerPkgRaw;
  }

  const out = { ...consumer };
  out.scripts = { ...(consumer.scripts ?? {}) };

  for (const [k, v] of Object.entries(managedScripts)) {
    if (!(k in out.scripts)) {
      out.scripts[k] = v;
    }
  }

  return JSON.stringify(out, null, 2) + '\n';
}

/**
 * IO wrapper for mergePackageJsonScripts — implements the specialMerge signature.
 *
 * Reads brain's package.json at `srcPath`, filters its `scripts` to
 * `MANAGED_SCRIPT_KEYS` → managedScripts. Reads the consumer's package.json at
 * `destPath` (may be absent — treated as an empty `{}` so all managed scripts are
 * written). Calls the pure fn and writes the result ONLY if it differs from the
 * current file bytes (idempotent no-op write — no needless mtime churn on re-upgrade).
 *
 * @param {string} destPath  Absolute path to consumer's package.json (may not exist).
 * @param {string} srcPath   Absolute path to brain's package.json.
 */
export function mergePackageJson(destPath, srcPath) {
  const brainPkg = JSON.parse(readFileSync(srcPath, 'utf8'));

  // Filter brain's scripts to only the managed brain:* keys.
  const managedScripts = {};
  for (const key of MANAGED_SCRIPT_KEYS) {
    if (brainPkg.scripts?.[key] !== undefined) {
      managedScripts[key] = brainPkg.scripts[key];
    }
  }

  // Absent consumer → start from an empty object (managed scripts become the only content).
  const consumerRaw = existsSync(destPath)
    ? readFileSync(destPath, 'utf8')
    : '{}';

  const result = mergePackageJsonScripts(consumerRaw, managedScripts, destPath);

  // Write only if content changed — avoid mtime churn on idempotent re-upgrade.
  if (existsSync(destPath) && readFileSync(destPath, 'utf8') === result) return;

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, result);
}

// ── Config migration ─────────────────────────────────────────────────────────

/**
 * Deep-merges `defaults` into `existing`, preserving every value already
 * present in `existing`. Only missing keys are filled. Arrays and non-plain
 * values are treated as leaves (existing wins). Returns a new object.
 * @param {object} existing
 * @param {object} defaults
 * @returns {object}
 */
export function mergeDefaults(existing, defaults) {
  const isPlainObject = (v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  const out = { ...existing };
  for (const [key, defVal] of Object.entries(defaults)) {
    if (!(key in out)) {
      out[key] = defVal;
    } else if (isPlainObject(out[key]) && isPlainObject(defVal)) {
      out[key] = mergeDefaults(out[key], defVal);
    }
    // else: key exists with a leaf/array value — keep the consumer's value.
  }
  return out;
}

// ── Semver ───────────────────────────────────────────────────────────────────

/**
 * Parses a version string ("v0.1.0", "1.2.3") into [major, minor, patch].
 * Non-numeric or missing parts become 0. Pre-release suffixes are ignored.
 * @param {string} v
 * @returns {[number, number, number]}
 */
export function parseSemver(v) {
  const core = String(v ?? '').trim().replace(/^v/, '').split('-')[0];
  const [maj, min, pat] = core.split('.');
  return [Number(maj) || 0, Number(min) || 0, Number(pat) || 0];
}

/**
 * Compares two versions. Returns -1 if a < b, 0 if equal, 1 if a > b.
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Applies every pending migration to a config object.
 *
 * "Pending" = migration.version > config.schemaVersion AND <= targetVersion.
 * Additive migrations (those with `defaults`) merge defaults without
 * overwriting existing values. Migrations with a `migrate` fn run it with the
 * { mergeDefaults } helper. The returned config carries the new schemaVersion.
 *
 * @param {object} config        The consumer's current brain.config.json.
 * @param {Array}  migrations    Ordered migration descriptors.
 * @param {string} targetVersion The brain version being installed.
 * @returns {{ config: object, applied: string[] }}
 */
export function migrateConfig(config, migrations, targetVersion) {
  const from = config.schemaVersion ?? '0.0.0';
  let result = { ...config };
  const applied = [];
  const ordered = [...migrations].sort((a, b) => compareSemver(a.version, b.version));
  for (const m of ordered) {
    const isAfterCurrent = compareSemver(m.version, from) > 0;
    const isWithinTarget = compareSemver(m.version, targetVersion) <= 0;
    if (!isAfterCurrent || !isWithinTarget) continue;
    if (typeof m.migrate === 'function') {
      result = m.migrate(result, { mergeDefaults });
    } else if (m.defaults) {
      result = mergeDefaults(result, m.defaults);
    }
    applied.push(m.version);
  }
  result.schemaVersion = compareSemver(targetVersion, result.schemaVersion ?? '0.0.0') > 0
    ? targetVersion
    : (result.schemaVersion ?? targetVersion);
  return { config: result, applied };
}

// ── Install URL resolution ─────────────────────────────────────────────────────

/**
 * Canonical HTTPS install URL for the brain package.
 * Used as a fallback when the installed package.json has no repository.url or
 * when that URL cannot be parsed.
 */
export const BRAIN_REPO_HTTPS = 'git+https://github.com/csrinaldi/brain.git';

/**
 * Normalizes any git repository URL to an npm-installable `git+https://` form.
 *
 * Accepted input forms and their canonical output:
 *   git+https://host/owner/repo.git  → as-is
 *   https://host/owner/repo.git      → prefix `git+`
 *   git+ssh://git@host/owner/repo.git → convert host and path to git+https
 *   git@host:owner/repo.git          → SCP form → convert to git+https
 *   github:owner/repo                → expand to git+https://github.com/…
 *
 * Null / empty input returns BRAIN_REPO_HTTPS (safe fallback).
 *
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function resolveInstallUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return BRAIN_REPO_HTTPS;

  const u = url.trim();

  // Already the correct form.
  if (u.startsWith('git+https://')) {
    return u.endsWith('.git') ? u : `${u}.git`;
  }

  // Plain https — just prefix git+.
  if (u.startsWith('https://')) {
    return 'git+' + (u.endsWith('.git') ? u : `${u}.git`);
  }

  // github: shorthand — npm resolves this to SSH, which is the problem we're fixing.
  const githubShorthand = u.match(/^github:([^#]+)/);
  if (githubShorthand) {
    const path = githubShorthand[1].replace(/\.git$/, '');
    return `git+https://github.com/${path}.git`;
  }

  // git+ssh://git@host/owner/repo.git
  const gitSsh = u.match(/^git\+ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (gitSsh) {
    return `git+https://${gitSsh[1]}/${gitSsh[2]}.git`;
  }

  // git@host:owner/repo.git  (SCP shorthand)
  const scp = u.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scp) {
    return `git+https://${scp[1]}/${scp[2]}.git`;
  }

  // Unknown form — ensure at least the git+ prefix.
  return u.startsWith('git+') ? u : `git+${u}`;
}

/**
 * Returns the full npm install specifier for brain at the given tag.
 *
 * Reads `repository.url` from the installed brain's `package.json` at
 * `<root>/node_modules/brain/package.json`, normalizes it with
 * `resolveInstallUrl`, and appends `#<tag>`.
 *
 * Falls back to `BRAIN_REPO_HTTPS#<tag>` when the file is absent,
 * unparseable, or the `repository.url` field is missing.
 *
 * The result is ALWAYS in the form `git+https://…#<tag>` — never SSH or
 * `github:` shorthand — so HTTPS-only consumers (CI, containers without
 * SSH keys) can install the private repo without extra setup.
 *
 * @param {string} root Consumer repo root (e.g. `process.cwd()`).
 * @param {string} tag  Git tag to install (e.g. `"v0.4.0"`).
 * @returns {string}
 */
export function installSpec(root, tag) {
  const pkgPath = join(root, 'node_modules', 'brain', 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const repoUrl = pkg?.repository?.url ?? (typeof pkg?.repository === 'string' ? pkg.repository : undefined);
    if (repoUrl && typeof repoUrl === 'string') {
      return `${resolveInstallUrl(repoUrl)}#${tag}`;
    }
  } catch {
    // File absent or unparseable — fall through to constant fallback.
  }
  return `${BRAIN_REPO_HTTPS}#${tag}`;
}

// ── Update check (for day:start) ───────────────────────────────────────────────

/**
 * Parses `git ls-remote --tags` output into the highest semver tag found.
 * Ignores peeled tag refs (`^{}`) and non-semver tags.
 * @param {string} lsRemoteStdout
 * @returns {string|null} The highest tag (e.g. "v1.2.0"), or null if none.
 */
export function highestTag(lsRemoteStdout) {
  const tags = [];
  for (const line of String(lsRemoteStdout).split('\n')) {
    const m = line.match(/refs\/tags\/(\S+)/);
    if (!m) continue;
    const tag = m[1];
    if (tag.endsWith('^{}')) continue;
    if (!/^v?\d+\.\d+\.\d+/.test(tag)) continue;
    tags.push(tag);
  }
  if (tags.length === 0) return null;
  return tags.sort(compareSemver).at(-1);
}

/**
 * Reads the installed brain version. In a consumer, that's the version field
 * of node_modules/brain/package.json. In the brain repo itself (self-host),
 * it's the repo's own package.json. Returns null if neither is found.
 * @param {string} repoRoot
 * @returns {string|null}
 */
export function readInstalledVersion(repoRoot) {
  const candidates = [
    join(repoRoot, 'node_modules', 'brain', 'package.json'),
    join(repoRoot, 'package.json'),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));
      if (pkg.name === 'brain' && pkg.version) return pkg.version;
    } catch {
      // try next candidate
    }
  }
  return null;
}
