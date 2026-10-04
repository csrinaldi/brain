// local-overlay.mjs — the drawer's "on this machine" blocks (#883, D73-D77):
// the seven documents of an open issue's change dir in a linked worktree, each
// compared as a git blob with the served HEAD's and the worktree's own HEAD.
//
// This is the ONE working-tree reader of the drawer (R883-8, R883-16). It reads
// only paths the snapshot's `localWorktrees` section kept (entry.path), never a
// path under the served root. Git runs on the served root's own git dir by sha:
// no `-C`, `--git-dir` or `--work-tree` (D74), and no verb that writes (R883-14).

import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';

import { gitErrorLine, parseTreeListing } from '../lib/git-tree.mjs';
import { countTasks } from '../lib/tasks-list.mjs';
import { LOCAL_DOCUMENT_FILES, LOCAL_DRAWER_CAP } from '../status/local-worktrees.mjs';
import { capText, DOCUMENT_CAP, DOCUMENT_READ_LIMIT, resumeOutcome } from './change-route.mjs';

const SHA256_HEX = 64;

/** `sha1("blob <n>\0" + bytes)`, or sha256 for a 64-digit object format: git's own blob id. */
export function gitBlobHash(bytes, algo = 'sha1') {
  const buf = Buffer.from(bytes);
  return createHash(algo).update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

/**
 * The one state of a present document (D75). `same-as-main` wins over uncommitted;
 * `resume` is never compared with main (main's HEAD has no reader for it).
 */
export function classifyLocalDocument({ hash, headEntry, mainBlob, isResume = false }) {
  if (!isResume && mainBlob && hash === mainBlob) return 'same-as-main';
  if (!headEntry) return 'new';
  return hash !== headEntry.sha ? 'modified' : 'committed';
}

const defaultFs = { lstatSync, realpathSync, openSync, readSync, fstatSync, closeSync };
const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;
const READ_CHUNK = 65536;
const TORN = 'changed while it was read; the next recompute reads it again';
const errLine = (err) => String(err?.message ?? err).split('\n')[0];

/** Every byte of an open file, never more than the read limit plus one chunk. */
function readAll(fs, fd) {
  const chunks = [];
  let total = 0;
  for (;;) {
    const buf = Buffer.alloc(READ_CHUNK);
    const n = fs.readSync(fd, buf, 0, READ_CHUNK, null);
    if (n === 0) break;
    chunks.push(buf.subarray(0, n));
    total += n;
    if (total > DOCUMENT_READ_LIMIT) break;
  }
  return Buffer.concat(chunks);
}

/**
 * One document of a worktree's change dir (D77): `{absent}`, `{refused: reason}` or `{bytes}`.
 * `lstat` first (a link, a FIFO or a huge file is refused before any open), the real path must
 * stay under the change dir, then `O_NOFOLLOW`, read, `fstat`; a size that disagrees is read once
 * more and a second disagreement is said, never guessed.
 */
function readLocalDocument({ fs, abs, rel, dirReal }) {
  let before;
  try {
    before = fs.lstatSync(abs);
  } catch (err) {
    return err?.code === 'ENOENT' ? { absent: true } : { refused: `${rel} could not be read: ${errLine(err)}` };
  }
  if (before.isSymbolicLink()) return { refused: `${rel} is a symbolic link` };
  if (!before.isFile()) return { refused: `${rel} is not a regular file` };
  if (before.size > DOCUMENT_READ_LIMIT) return { refused: `${before.size} bytes exceeds the read limit of ${DOCUMENT_READ_LIMIT}` };
  try {
    if (!fs.realpathSync(abs).startsWith(`${dirReal}${sep}`)) return { refused: `${rel} resolves outside the change dir` };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const expected = attempt === 0 ? before.size : fs.lstatSync(abs).size;
      const fd = fs.openSync(abs, OPEN_FLAGS);
      let bytes;
      let size;
      try {
        bytes = readAll(fs, fd);
        size = fs.fstatSync(fd).size;
      } finally {
        fs.closeSync(fd);
      }
      if (bytes.length === size && size === expected) return { bytes };
    }
    return { refused: `${rel} ${TORN}` };
  } catch (err) {
    return { refused: `${rel} could not be read: ${errLine(err)}` };
  }
}

function documentFor({ fs, key, file, entry, dirReal, headEntry, mainBlob, algo, leaf }) {
  const rel = `${entry.dir}/${file}`;
  const ref = `worktree ${leaf}`;
  const read = readLocalDocument({ fs, abs: join(entry.path, rel), rel, dirReal });
  if (read.absent) return null;
  if (read.refused) return { path: rel, ref, commit: null, blob: null, state: 'unreadable', text: null, bytes: null, truncated: false, truncatedAt: null, reason: read.refused, note: null, overlay: 'unreadable', uncommitted: false, marker: null };
  const hash = gitBlobHash(read.bytes, algo);
  const overlay = classifyLocalDocument({ hash, headEntry, mainBlob, isResume: key === 'resume' });
  const cut = capText(read.bytes.toString('utf8'));
  return {
    path: rel, ref, commit: null, state: cut.truncated ? 'truncated' : 'present',
    text: overlay === 'same-as-main' ? null : cut.text, bytes: read.bytes.length, truncated: cut.truncated, truncatedAt: cut.truncatedAt,
    reason: null, note: cut.truncated ? `truncated at ${DOCUMENT_CAP} bytes` : null,
    blob: hash, overlay, uncommitted: overlay === 'new' || overlay === 'modified', marker: `${read.bytes.length} B · ${hash.slice(0, 12)}`,
    ...(key === 'tasks' && !cut.truncated ? { progress: countTasks(cut.text) } : {}),
  };
}

/** The change dir's real path, or the one-line reason it must not be read (R883-7): a link, or a real path outside the worktree. */
function checkChangeDir({ fs, entry }) {
  const abs = join(entry.path, entry.dir);
  try {
    if (fs.lstatSync(abs).isSymbolicLink()) return { reason: `${entry.dir} is a symbolic link` };
    const dirReal = fs.realpathSync(abs);
    if (!dirReal.startsWith(`${fs.realpathSync(entry.path)}${sep}`)) return { reason: `${entry.dir} resolves outside the worktree` };
    return { dirReal };
  } catch (err) {
    return { reason: `${entry.dir} could not be checked: ${errLine(err)}` };
  }
}

function localBlock({ run, fs, entry, mainDocuments, origin }) {
  const base = { leaf: entry.leaf, branch: entry.branch, head: entry.head, path: entry.path, dir: entry.dir, label: `worktree ${entry.leaf} · ${entry.branch}`, documents: null, absent: [], resume: null, progress: null };
  if (entry.capped) return { ...base, state: 'capped' };
  if (entry.dirState !== 'present') return { ...base, state: entry.dirState === 'missing' ? 'no-change-dir' : 'unreadable', reason: entry.reason };
  const checked = checkChangeDir({ fs, entry });
  if (checked.reason) return { ...base, state: 'unreadable', reason: checked.reason };
  const paths = Object.values(LOCAL_DOCUMENT_FILES).map((file) => `${entry.dir}/${file}`);
  let tree;
  try {
    tree = parseTreeListing(run('git', ['--literal-pathspecs', 'ls-tree', '-l', '-z', entry.head, '--', ...paths]));
  } catch (err) {
    return { ...base, state: 'unreadable', reason: gitErrorLine(err) };
  }
  const algo = entry.head.length === SHA256_HEX ? 'sha256' : 'sha1';
  const documents = {};
  const absent = [];
  for (const [key, file] of Object.entries(LOCAL_DOCUMENT_FILES)) {
    const doc = documentFor({ fs, key, file, entry, dirReal: checked.dirReal, headEntry: tree.get(`${entry.dir}/${file}`), mainBlob: mainDocuments?.[key]?.blob ?? null, algo, leaf: entry.leaf });
    if (doc) documents[key] = doc; else absent.push(file);
  }
  // The collapse hides every document, so it needs all of them accounted for (R883-9): readable,
  // committed, and none committed at HEAD but missing from the working tree.
  const deletedLocally = absent.some((file) => tree.has(`${entry.dir}/${file}`));
  const clean = !deletedLocally && Object.values(documents).every((d) => d.state !== 'unreadable' && !d.uncommitted);
  if (clean && origin) return { ...base, state: 'same-as-origin', absent, resume: null };
  const resume = documents.resume ?? { state: 'missing', reason: `no resume.md in worktree ${entry.leaf}` };
  return { ...base, state: 'read', documents, absent, resume: resumeOutcome({ doc: resume, label: `worktree ${entry.leaf}` }) };
}

/**
 * The local blocks of one issue, from the snapshot's section: `{local, localNote}`.
 * An absent or unreadable section yields no block (the section says why in the snapshot).
 */
export function readLocalBlocks({ run, snapshot, issue, mainDocuments, _fs = defaultFs }) {
  const section = snapshot?.localWorktrees;
  if (section && !section.ok && section.pending !== true) return { local: [], localNote: `this machine's worktrees were not read: ${section.reason}` };
  const mine = section?.ok ? section.value.entries.filter((e) => e.issue === issue) : [];
  const remote = snapshot?.remoteChanges?.ok ? snapshot.remoteChanges.value.branches : [];
  const atOrigin = (e) => remote.some((r) => r.branch === e.branch && r.sha === e.head);
  const capped = mine.filter((e) => e.capped).length;
  const note = capped > 0 ? `showing documents for ${mine.length - capped} of ${mine.length} worktrees; the others are listed without documents (cap of ${LOCAL_DRAWER_CAP})` : null;
  return { local: mine.map((entry) => localBlock({ run, fs: _fs, entry, mainDocuments, origin: atOrigin(entry) })), localNote: note };
}
