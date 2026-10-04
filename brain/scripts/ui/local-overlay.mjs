// local-overlay.mjs — the drawer's "on this machine" blocks (#883, D73-D77):
// the seven documents of an open issue's change dir in a linked worktree, each
// compared as a git blob with the served HEAD's and the worktree's own HEAD.
//
// This is the ONE working-tree reader of the drawer (R883-8, R883-16). It reads
// only paths the snapshot's `localWorktrees` section kept (entry.path), never a
// path under the served root. Git runs on the served root's own git dir by sha:
// no `-C`, `--git-dir` or `--work-tree` (D74), and no verb that writes (R883-14).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { gitErrorLine, parseTreeListing } from '../lib/git-tree.mjs';
import { LOCAL_DOCUMENT_FILES } from '../status/local-worktrees.mjs';
import { capText, DOCUMENT_CAP } from './change-route.mjs';

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

function readLocalDocument({ abs }) {
  const bytes = readFileSync(abs);
  return { bytes };
}

function documentFor({ key, file, entry, dirPath, headEntry, mainBlob, algo, leaf }) {
  const rel = `${entry.dir}/${file}`;
  let read;
  try {
    read = readLocalDocument({ abs: join(dirPath, file) });
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    return { path: rel, ref: `worktree ${leaf}`, state: 'unreadable', reason: gitErrorLine(err) };
  }
  const hash = gitBlobHash(read.bytes, algo);
  const overlay = classifyLocalDocument({ hash, headEntry, mainBlob, isResume: key === 'resume' });
  const cut = capText(read.bytes.toString('utf8'));
  return {
    path: rel, ref: `worktree ${leaf}`, commit: null, state: cut.truncated ? 'truncated' : 'present',
    text: overlay === 'same-as-main' ? null : cut.text, bytes: read.bytes.length, truncated: cut.truncated, truncatedAt: cut.truncatedAt,
    reason: null, note: cut.truncated ? `truncated at ${DOCUMENT_CAP} bytes` : null,
    blob: hash, overlay, uncommitted: overlay === 'new' || overlay === 'modified', marker: `${read.bytes.length} B · ${hash.slice(0, 12)}`,
  };
}

function localBlock({ run, entry, mainDocuments }) {
  const base = { leaf: entry.leaf, branch: entry.branch, head: entry.head, path: entry.path, dir: entry.dir, label: `worktree ${entry.leaf} · ${entry.branch}`, documents: null, absent: [], resume: null, progress: null };
  if (entry.dirState !== 'present') return { ...base, state: entry.dirState === 'missing' ? 'no-change-dir' : 'unreadable', reason: entry.reason };
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
    const doc = documentFor({ key, file, entry, dirPath: join(entry.path, entry.dir), headEntry: tree.get(`${entry.dir}/${file}`), mainBlob: mainDocuments?.[key]?.blob ?? null, algo, leaf: entry.leaf });
    if (doc) documents[key] = doc; else absent.push(file);
  }
  return { ...base, state: 'read', documents, absent };
}

/**
 * The local blocks of one issue, from the snapshot's section: `{local, localNote}`.
 * An absent or unreadable section yields no block (the section says why in the snapshot).
 */
export function readLocalBlocks({ run, snapshot, issue, mainDocuments }) {
  const section = snapshot?.localWorktrees;
  const mine = section?.ok ? section.value.entries.filter((e) => e.issue === issue) : [];
  return { local: mine.map((entry) => localBlock({ run, entry, mainDocuments })), localNote: null };
}
