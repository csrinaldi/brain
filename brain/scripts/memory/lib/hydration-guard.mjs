// hydration-guard.mjs — a machine-scoped, NON-BLOCKING guard around the engram
// adapter's import window (#820; memory 2.0 task 0.1, Wave 0).
//
// `importMemory` computes its delta from a snapshot of the backend and writes it
// later; `engram import` INSERTS. Two importers through one snapshot double the
// batch, permanently — it fired three times on 2026-09-01, on a path that runs
// at every session start and every `post-merge`, with sixty worktrees sharing
// ONE store. That is why the lock lives in `os.tmpdir()` and not under
// `.memory/`: a per-worktree lock would guard nothing. It is not under the
// backend's own directory either — that layout is the adapter's private
// business (#863's no-artifact rule cuts both ways).
//
// Contention is a SKIP, never a wait. A second importer that finds the guard
// held returns `{held:false, owner}`; the caller says so on stderr and lets the
// next run retry. `post-merge` is `|| true` on purpose, and #795 is what a
// memory path that gets in the way turns into. A stale guard — dead pid, or
// older than `staleMs` — is reclaimed, so a crashed importer cannot wedge
// hydration forever.
//
// This is MITIGATION. The fix is #863's backend contract: hydration from
// records is idempotent by record id, and a backend that satisfies it needs no
// guard at all. Under `MEMORY_BACKEND=plainfiles` `import` is `rebuildIndex`,
// idempotent by construction, and this module is never wired in.

import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_LOCK_PATH = join(tmpdir(), 'brain-memory-hydration.lock');
export const DEFAULT_STALE_MS = 10 * 60 * 1000;
const OWNER_FILE = 'owner.json';

function defaultPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM is an ALIVE pid this user may not signal; only ESRCH means dead.
    return err?.code === 'EPERM';
  }
}

function readOwner(lockPath) {
  try {
    const o = JSON.parse(readFileSync(join(lockPath, OWNER_FILE), 'utf8'));
    if (typeof o?.pid === 'number' && typeof o?.startedAt === 'number') return o;
  } catch {
    /* unreadable → treated as stale below */
  }
  return null;
}

/**
 * Try to take the guard. `mkdirSync` without `recursive` is atomic: exactly one
 * of two concurrent callers gets it, the other gets EEXIST.
 *
 * @returns {{held: true, release: () => void} | {held: false, owner: {pid:number, startedAt:number, ageMs:number}}}
 */
export function acquireHydrationGuard({
  lockPath = DEFAULT_LOCK_PATH,
  staleMs = DEFAULT_STALE_MS,
  _pidAlive = defaultPidAlive,
  _now = Date.now,
  _pid = process.pid,
} = {}) {
  const release = () => rmSync(lockPath, { recursive: true, force: true });
  const take = () => {
    mkdirSync(lockPath);
    writeFileSync(join(lockPath, OWNER_FILE), JSON.stringify({ pid: _pid, startedAt: _now() }), 'utf8');
    return { held: true, release };
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return take();
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
      const owner = readOwner(lockPath);
      const ageMs = owner ? _now() - owner.startedAt : Infinity;
      const stale = !owner || !_pidAlive(owner.pid) || ageMs > staleMs;
      if (!stale) return { held: false, owner: { pid: owner.pid, startedAt: owner.startedAt, ageMs } };
      // Stale: reclaim once, then retry the atomic take. If a second reclaim
      // would be needed, someone else won the race — that is contention.
      release();
    }
  }
  const owner = readOwner(lockPath);
  return { held: false, owner: owner ? { pid: owner.pid, startedAt: owner.startedAt, ageMs: _now() - owner.startedAt } : { pid: -1, startedAt: 0, ageMs: 0 } };
}

/**
 * Run `fn` under the guard. `{held:true, result}` or `{held:false, owner}`; a
 * throw inside `fn` releases the guard and propagates.
 */
export function withHydrationGuard(fn, opts = {}) {
  const g = acquireHydrationGuard(opts);
  if (!g.held) return g;
  try {
    return { held: true, result: fn() };
  } finally {
    g.release();
  }
}
