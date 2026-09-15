// watcher.mjs — directory watchers over the committed tier only (Q3, D4,
// #881 PR 2). Every watch target is a DIRECTORY, never a file: git replaces
// `HEAD`/`packed-refs` by writing a `.lock` file and renaming over the
// target, which orphans a file-bound `fs.watch` the moment it fires once. A
// directory watch survives the rename and keeps seeing every write after it.
//
// The watched set is exactly Q3's table — root, `brain/`,
// `brain/project/decisions/`, each `ANTI_PATTERN_DIRS` entry,
// `.memory/records/`, `openspec/changes/`, each
// `openspec/changes/issue-*/`, `<git-common>/`, `<git-common>/logs/`,
// `<git-common>/worktrees/`, and `<git-common>/worktrees/<n>/logs/` per
// worktree — and NOTHING else. A worktree's own working tree is never
// watched, which doubles as R881-10's "no uncommitted content is ever read".
//
// The reflog (`logs/HEAD`) is the load-bearing choice: it is APPENDED on
// every HEAD movement — commit, `commit --amend`, fast-forward merge, reset,
// rebase step, checkout — and it is one flat path per worktree, unlike
// `logs/refs/heads/<branch>` which nests one dir per branch-name segment.
//
// Every fired watch is funnelled through one 250 ms trailing debounce (D5).
// Recomputes are serialised: an event that lands while a recompute is
// already running schedules exactly ONE follow-up, so a `git rebase` that
// moves HEAD forty times in a burst produces at most two recomputes, never
// forty.
//
// `<git-common>/worktrees/` re-scans on its own event, using `git worktree
// list --porcelain` — the same stanza grammar as
// `memory/lane/collect.mjs:115-129`'s `parseWorktrees()`, DUPLICATED here
// rather than imported: this PR's file scope (tasks.md's
// `brain-slice-scope/1` fence) is `server.mjs`/`watcher.mjs`/`poller.mjs`
// only, and `collect.mjs` is not in it (see apply-progress for the
// deviation this records). Git's own convention makes the worktree's `<n>`
// id under `.git/worktrees/` the basename of its path — confirmed against
// this very repo's own linked worktrees before relying on it.
//
// `openspec/changes/` re-syncs its children the SAME way, on its own event
// (`rescanChangeDirs()`): a change dir created after `start()` — the normal
// case for `/sdd-new` on a long-lived server — gets watched from then on,
// and a removed one has its watch closed (cold review of PR #971 rev 5,
// judgment:cold-7, R881-3, design.md:228). `watchDir()`/`closeWatch()` share
// one generic `trackingId`/`trackingMap` bookkeeping pair between the two
// resync paths rather than each root growing its own copy.
//
// A watch that cannot be registered (`ENOSPC`, `EPERM`, a path that does not
// exist in this root) is caught PER DIRECTORY. The watcher never throws out
// of the constructor or `start()`: the server keeps running, and `state()`
// reports which paths failed and why (Q3 "when the watcher fails").

import { watch as fsWatch, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, isAbsolute, join } from 'node:path';

import { ANTI_PATTERN_DIRS } from '../status/anti-patterns.mjs';
import { CHANGES_ROOT, parseChangeId } from '../lib/sdd-layout.mjs';

const DEBOUNCE_MS = 250;

/** `git worktree list --porcelain` → `{path, bare}` stanzas, one per worktree. */
function parseWorktreeStanzas(stdout) {
  const stanzas = [];
  let current = null;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), bare: false };
      stanzas.push(current);
    } else if (current && line === 'bare') {
      current.bare = true;
    }
  }
  return stanzas;
}

function defaultRun(root) {
  return (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** `git rev-parse --git-common-dir`, resolved to an absolute path. */
export function resolveGitCommonDir({ root, _run } = {}) {
  const run = _run ?? defaultRun(root);
  const out = run('git', ['rev-parse', '--git-common-dir']).trim();
  return isAbsolute(out) ? out : join(root, out);
}

/**
 * createWatcher() — directory watchers, debounce, worktree re-scan.
 *
 * @param {{
 *   root: string,
 *   gitCommonDir?: string|null,
 *   _watch?: Function, _run?: Function, _readdir?: Function, _now?: () => Date,
 *   debounceMs?: number, _setTimeout?: Function, _clearTimeout?: Function,
 *   onRecompute?: (evt: {causes: string[], refWorktrees: string[], at: Date}) => Promise<void>|void,
 * }} opts
 * @returns {{start(): void, close(): void, state(): {ok: boolean, reason?: string, watched: number, failed: Array<{path:string,reason:string}>}}}
 */
export function createWatcher({
  root,
  gitCommonDir = null,
  _watch = fsWatch,
  _run,
  _readdir = readdirSync,
  _now = () => new Date(),
  debounceMs = DEBOUNCE_MS,
  _setTimeout = setTimeout,
  _clearTimeout = clearTimeout,
  onRecompute = () => {},
} = {}) {
  const run = _run ?? defaultRun(root);
  const handles = new Map(); // absPath -> {handle, label, kind, worktreePath}
  const watchedWorktrees = new Map(); // id -> path
  const watchedChangeDirs = new Map(); // name -> absPath
  let failed = [];
  let resolvedGitCommonDir = gitCommonDir;
  let debounceTimer = null;
  let pendingCauses = new Set();
  let pendingRefWorktrees = new Set();
  let recomputing = false;
  let queuedAfterRecompute = false;

  function recordFailure(label, err) {
    failed = failed.filter((f) => f.path !== label);
    failed.push({ path: label, reason: err?.message ?? String(err) });
  }

  function watchDir(absPath, label, kind, worktreePath, trackingId, trackingMap) {
    if (handles.has(absPath)) return;
    try {
      const handle = _watch(absPath, { persistent: false }, () => onFire(absPath));
      // A LIVE `FSWatcher` can fail asynchronously, well after registration
      // succeeded — a late `ENOSPC`, `EPERM`, or the watched path itself
      // disappearing. `fs.watch`'s `EventEmitter` throws synchronously out of
      // `.emit()` if 'error' has no listener, which would crash this whole
      // process (R881-9: a watcher failure is a said state, never a crash).
      // Guarded by `typeof handle.on === 'function'` so test doubles that
      // return a plain `{close()}` (no EventEmitter) keep working unchanged.
      if (typeof handle.on === 'function') {
        handle.on('error', (err) => {
          recordFailure(label, err);
          closeWatch(absPath); // a failed handle cannot fire again
        });
      }
      handles.set(absPath, { handle, label, kind, worktreePath, trackingId, trackingMap });
      failed = failed.filter((f) => f.path !== label);
    } catch (err) {
      recordFailure(label, err);
    }
  }

  function closeWatch(absPath) {
    const entry = handles.get(absPath);
    if (!entry) return;
    try { entry.handle.close(); } catch { /* best effort */ }
    handles.delete(absPath);
    // A tracked child (a worktree's logs/, a change dir) handle carries its
    // `trackingId` + `trackingMap`. Closing it — either because the child
    // vanished (a rescan's removal loop) or because its handle errored
    // asynchronously (the `handle.on('error', ...)` path above) — must make
    // the child eligible for `watchDir()` again on the NEXT rescan. The
    // tracking map only ever records a child whose watch is actually open
    // right now (see rescanWorktrees()/rescanChangeDirs()), so it must be
    // cleared here too, not just on removal (R881-3, judgment:cold-1, cold-7).
    if (entry.trackingId !== undefined) entry.trackingMap.delete(entry.trackingId);
  }

  function onFire(absPath) {
    const entry = handles.get(absPath);
    if (!entry) return;
    pendingCauses.add(`watch:${entry.label}`);
    if (entry.kind === 'refs') pendingRefWorktrees.add(entry.worktreePath ?? root);
    if (entry.kind === 'worktrees') rescanWorktrees();
    if (entry.kind === 'changes') rescanChangeDirs();
    scheduleDebounce();
  }

  function scheduleDebounce() {
    if (debounceTimer) _clearTimeout(debounceTimer);
    debounceTimer = _setTimeout(fireDebounce, debounceMs);
  }

  function fireDebounce() {
    debounceTimer = null;
    if (recomputing) { queuedAfterRecompute = true; return; }
    dispatch();
  }

  async function dispatch() {
    const causes = [...pendingCauses];
    const refWorktrees = [...pendingRefWorktrees];
    pendingCauses = new Set();
    pendingRefWorktrees = new Set();
    recomputing = true;
    try {
      await onRecompute({ causes, refWorktrees, at: _now() });
    } finally {
      recomputing = false;
      if (queuedAfterRecompute) {
        queuedAfterRecompute = false;
        dispatch();
      }
    }
  }

  /**
   * `null` on failure — NEVER `[]` — so a caller can tell "the root could not
   * be read right now" apart from "the root really has zero change dirs".
   * Collapsing those two into the same empty value is exactly the shape
   * `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` names, and
   * is what let a transient `EMFILE`/`EACCES` close every watched change dir
   * as "vanished" (cold review of PR #971 pre-push, R881-9). Mirrors
   * `activeWorktrees()` above: catch here, record the failure here, return a
   * sentinel the caller cannot mistake for real data.
   */
  function listChangeDirs() {
    try {
      return _readdir(join(root, CHANGES_ROOT)).filter((n) => parseChangeId(n) !== null);
    } catch (err) {
      recordFailure(CHANGES_ROOT, err);
      return null;
    }
  }

  /**
   * A `<root>/openspec/changes/` event re-syncs its children exactly like a
   * `<git-common>/worktrees/` event re-syncs worktrees (rescanWorktrees()
   * below): open a watch for every change dir now present and not yet
   * watched, close the watches of dirs that vanished. Same retry-on-next-
   * event rule as judgment:cold-1 — a dir whose `watchDir()` call failed
   * stays eligible and is retried on the NEXT `CHANGES_ROOT` event, never
   * marked watched after one failed attempt (R881-3, cold-7).
   *
   * When the root itself cannot be read (`listChangeDirs()` returns `null`),
   * the failure is already recorded and reconciliation is SKIPPED entirely —
   * every currently-watched change dir stays open. Treating an unreadable
   * root as "zero change dirs" would close all of them on one transient
   * error, with no root event left to ever re-open them (R881-9, pre-push
   * cold review of PR #971).
   */
  function rescanChangeDirs() {
    const names = listChangeDirs();
    if (names === null) return;
    failed = failed.filter((f) => f.path !== CHANGES_ROOT); // the root is readable again — drop a stale failure entry
    const current = new Set(names);
    for (const [name] of watchedChangeDirs) {
      if (!current.has(name)) {
        closeWatch(join(root, CHANGES_ROOT, name));
        watchedChangeDirs.delete(name);
      }
    }
    for (const name of current) {
      if (!watchedChangeDirs.has(name)) {
        const absPath = join(root, CHANGES_ROOT, name);
        watchDir(absPath, `${CHANGES_ROOT}/${name}/`, 'tree', undefined, name, watchedChangeDirs);
        if (handles.has(absPath)) watchedChangeDirs.set(name, absPath);
      }
    }
  }

  /** The linked worktrees `git worktree list --porcelain` reports right now, minus the primary checkout (always listed first) and any bare stanza. */
  function activeWorktrees() {
    let stdout;
    try { stdout = run('git', ['worktree', 'list', '--porcelain']); } catch (err) { recordFailure('<git-common>/worktrees', err); return []; }
    return parseWorktreeStanzas(stdout).slice(1).filter((s) => !s.bare).map((s) => ({ path: s.path, id: basename(s.path) }));
  }

  function rescanWorktrees() {
    if (!resolvedGitCommonDir) return;
    const current = activeWorktrees();
    const currentIds = new Set(current.map((w) => w.id));
    for (const [id] of watchedWorktrees) {
      if (!currentIds.has(id)) {
        closeWatch(join(resolvedGitCommonDir, 'worktrees', id, 'logs'));
        watchedWorktrees.delete(id);
      }
    }
    // Retry is driven by rescan events only (a `<git-common>/worktrees/` dir
    // event), never by a timer of its own — this is what the cold review of
    // PR #971 rev 1 (judgment:cold-1) measured. `watchedWorktrees.has(w.id)`
    // is true ONLY when a handle for that worktree is actually open right
    // now (see below and closeWatch()), so a worktree whose watchDir() call
    // failed — or whose live handle later errored — stays eligible and gets
    // retried the next time this function runs, instead of being marked
    // watched forever after one failed attempt (R881-3: a commit in a linked
    // worktree must be seen, not silently invisible for the rest of the
    // process).
    for (const w of current) {
      if (!watchedWorktrees.has(w.id)) {
        const absPath = join(resolvedGitCommonDir, 'worktrees', w.id, 'logs');
        watchDir(absPath, `<git-common>/worktrees/${w.id}/logs/`, 'refs', w.path, w.id, watchedWorktrees);
        if (handles.has(absPath)) watchedWorktrees.set(w.id, w.path);
      }
    }
  }

  function start() {
    watchDir(root, '<root>', 'tree');
    watchDir(join(root, 'brain'), 'brain/', 'tree');
    watchDir(join(root, 'brain/project/decisions'), 'brain/project/decisions/', 'tree');
    for (const { dir } of ANTI_PATTERN_DIRS) watchDir(join(root, dir), `${dir}/`, 'tree');
    watchDir(join(root, '.memory/records'), '.memory/records/', 'tree');
    watchDir(join(root, CHANGES_ROOT), `${CHANGES_ROOT}/`, 'changes');
    rescanChangeDirs();

    if (resolvedGitCommonDir === null) {
      try { resolvedGitCommonDir = resolveGitCommonDir({ root, _run: run }); } catch (err) { recordFailure('<git-common>', err); }
    }
    if (resolvedGitCommonDir) {
      watchDir(resolvedGitCommonDir, '<git-common>/', 'refs', root);
      watchDir(join(resolvedGitCommonDir, 'logs'), '<git-common>/logs/', 'refs', root);
      watchDir(join(resolvedGitCommonDir, 'worktrees'), '<git-common>/worktrees/', 'worktrees');
      rescanWorktrees();
    }
  }

  function close() {
    if (debounceTimer) { _clearTimeout(debounceTimer); debounceTimer = null; }
    for (const absPath of [...handles.keys()]) closeWatch(absPath);
    watchedWorktrees.clear();
  }

  function state() {
    return failed.length === 0
      ? { ok: true, watched: handles.size, failed: [] }
      : { ok: false, reason: `${failed.length} watch(es) failed`, watched: handles.size, failed: failed.map((f) => ({ ...f })) };
  }

  return { start, close, state };
}
