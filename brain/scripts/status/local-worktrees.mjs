// local-worktrees.mjs — the `localWorktrees` snapshot section (#883, D69-D72):
// the linked worktrees of this clone that carry an OPEN issue's work, listed
// from one `git worktree list --porcelain` and one directory listing per kept
// worktree. It is the snapshot's one working-tree read (R883-16); it reads
// names and `lstat` metadata only, never a file's content, and never runs git
// inside a worktree.

import { basename, join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';

import { field, pending, uncomputable } from './report.mjs';
import { parseCanonicalIssueBranch } from '../lib/branch-grammar.mjs';
import { gitErrorLine, pickChangeDir } from '../lib/git-tree.mjs';
import { CHANGES_ROOT, LIFECYCLE_STAGES, ARTEFACT_FILE } from '../lib/sdd-layout.mjs';
import { parseWorktrees } from '../memory/lane/collect.mjs';

/** Worktrees per issue whose documents the drawer reads (D72); the rest are listed without them. */
export const LOCAL_DRAWER_CAP = 3;

/** Why a worktree is hidden: one name per cause, so `hidden` is counted, never silent (R883-1). */
const HIDDEN = Object.freeze({ served: 'served', bare: 'bare', prunable: 'prunable', detached: 'detached', notIssue: 'notIssue', closed: 'closed' });
const NO_CHANGE_DIR = 'no change dir in this worktree';
const FINGERPRINT_LENGTH = 16;

const defaultFs = { readdirSync, lstatSync, realpathSync };

/** R2: the seven documents of a change dir, by stage, in the order the drawer lists them. */
export const LOCAL_DOCUMENT_FILES = Object.freeze({
  ...Object.fromEntries(LIFECYCLE_STAGES.map((stage) => [stage, ARTEFACT_FILE[stage]])),
  apply: 'apply-progress.md',
  verify: ARTEFACT_FILE.verification,
  resume: 'resume.md',
});

/** R883-2/R6: a graph that is not ready says so; it never lists worktrees unfiltered. */
function graphGate(graph) {
  if (graph.ok) return null;
  if (graph.pending === true) return pending(graph.reason);
  return uncomputable(`the open-issue list could not be read, so worktrees cannot be filtered to open issues (R6): ${graph.reason}`);
}

const realOrSelf = (fs, p) => { try { return fs.realpathSync(p); } catch { return resolve(p); } };
const errLine = (err) => String(err?.message ?? err).split('\n')[0];

/** The one change dir of `issue` in a worktree, or why not (D70, D77): a symlink or an escaping real path is never read. */
function readChangeDir({ fs, path, issue }) {
  const changes = join(path, CHANGES_ROOT);
  let dirents;
  try {
    dirents = fs.readdirSync(changes, { withFileTypes: true });
  } catch (err) {
    return err?.code === 'ENOENT' || err?.code === 'ENOTDIR'
      ? { dirState: 'missing', reason: NO_CHANGE_DIR, dir: null }
      : { dirState: 'unreadable', reason: `${CHANGES_ROOT}/ could not be listed: ${errLine(err)}`, dir: null };
  }
  const names = dirents.filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name);
  const picked = pickChangeDir(names, issue);
  if (!picked.ok) return { dirState: picked.state, reason: picked.state === 'missing' ? NO_CHANGE_DIR : picked.reason, dir: null };
  const dir = `${CHANGES_ROOT}/${picked.dir}`;
  const abs = join(path, dir);
  try {
    if (fs.lstatSync(abs).isSymbolicLink()) return { dirState: 'unreadable', reason: `${dir} is a symbolic link`, dir };
    const real = fs.realpathSync(abs);
    const wt = realOrSelf(fs, path);
    if (!real.startsWith(`${wt}${sep}`)) return { dirState: 'unreadable', reason: `${dir} resolves outside the worktree`, dir };
  } catch (err) {
    return { dirState: 'unreadable', reason: `${dir} could not be checked: ${errLine(err)}`, dir };
  }
  return { dirState: 'present', reason: null, dir };
}

/** `touchedAt` and the fingerprint from `lstat` alone (D72): no content is read, only size and mtime. */
function readTouch({ fs, path, found }) {
  const parts = [];
  let latest = null;
  const note = (mtimeMs) => { if (latest === null || mtimeMs > latest) latest = mtimeMs; };
  if (found.dirState === 'present') {
    try { note(fs.lstatSync(join(path, found.dir)).mtimeMs); } catch { /* the dir vanished; the files below say the same */ }
    for (const file of Object.values(LOCAL_DOCUMENT_FILES)) {
      try {
        const st = fs.lstatSync(join(path, found.dir, file));
        parts.push([file, st.size, st.mtimeMs]);
        note(st.mtimeMs);
      } catch { /* absent, or gone since the listing: absence is part of the fingerprint */ }
    }
  }
  const fingerprint = createHash('sha1').update(JSON.stringify([found.dir, found.dirState, parts])).digest('hex').slice(0, FINGERPRINT_LENGTH);
  return { touchedAt: latest === null ? null : new Date(latest).toISOString(), fingerprint };
}

const byIssueThenNewest = (a, b) => a.issue - b.issue
  || (a.touchedAt === b.touchedAt ? 0 : a.touchedAt === null ? 1 : b.touchedAt === null ? -1 : (a.touchedAt < b.touchedAt ? 1 : -1))
  || a.path.localeCompare(b.path);

/**
 * #1284 D103: a worktree whose change dir is `missing` has no `touchedAt`, so ONE
 * `git show -s --format=%cI <sha...>` gives it the time of its head commit. Local, read-only.
 * A failed call, or an output that does not line up with the shas, assigns nothing: a time
 * nobody read is `null`, never a guess.
 */
function readHeadCommitTimes(entries, run) {
  const asked = entries.filter((e) => e.dirState === 'missing' && e.touchedAt === null && e.head);
  const shas = [...new Set(asked.map((e) => e.head))];
  if (shas.length === 0) return;
  let lines;
  try {
    lines = String(run('git', ['show', '-s', '--format=%cI', ...shas])).split('\n').map((l) => l.trim()).filter(Boolean);
  } catch { return; }
  if (lines.length !== shas.length) return;
  const bySha = new Map(shas.map((sha, i) => [sha, lines[i]]));
  for (const e of asked) e.headCommitAt = bySha.get(e.head);
}

/**
 * The worktrees of open issues, as a section.
 * @param {{run: Function, root: string, graph: object, _fs?: object}} opts
 */
export function readLocalWorktrees({ run, root, graph, _fs = defaultFs }) {
  const gated = graphGate(graph);
  if (gated) return gated;
  let listing;
  try {
    listing = parseWorktrees(String(run('git', ['worktree', 'list', '--porcelain'])));
  } catch (err) {
    return uncomputable(`the worktree list could not be read: ${gitErrorLine(err)}`);
  }
  const open = new Set(graph.value.nodes.map((n) => n.number));
  const servedReal = realOrSelf(_fs, root);
  const hidden = Object.fromEntries(Object.values(HIDDEN).map((cause) => [cause, 0]));
  const kept = [];
  for (const s of listing) {
    const parsed = s.branch ? parseCanonicalIssueBranch(s.branch) : null;
    const why = realOrSelf(_fs, s.path) === servedReal ? HIDDEN.served
      : s.bare ? HIDDEN.bare
        : s.prunable ? HIDDEN.prunable
          : s.detached || !s.branch ? HIDDEN.detached
            : !parsed ? HIDDEN.notIssue
              : !open.has(Number(parsed.issueNumber)) ? HIDDEN.closed : null;
    if (why) { hidden[why] += 1; continue; }
    const issue = Number(parsed.issueNumber);
    const found = readChangeDir({ fs: _fs, path: s.path, issue });
    kept.push({
      path: s.path, leaf: basename(s.path), branch: s.branch, head: s.head, issue,
      ...found, ...readTouch({ fs: _fs, path: s.path, found }), headCommitAt: null, capped: false,
    });
  }
  readHeadCommitTimes(kept, run);
  kept.sort(byIssueThenNewest);
  const rank = new Map();
  for (const entry of kept) {
    const n = rank.get(entry.issue) ?? 0;
    rank.set(entry.issue, n + 1);
    entry.capped = n >= LOCAL_DRAWER_CAP;
  }
  return field({ entries: kept, hidden, tier: 'working-tree' });
}
