// change-route.mjs — GET /api/change/{issue}: the drawer's IO (#881, PR 3 /
// B1, D8/D11-D14). Composes the six pure `ui/lib/**` shapers this slice
// already shipped; THIS module is the one place in the pair that touches the
// filesystem and spawns `git` — every read goes through an injected
// `_read`/`_run`, so a test never needs a real working tree.
//
// R881-8's four tabs, each `{ok, value|reason}`, every leaf inside `value`
// carrying `source: {path[, line]} | {url}}` (D11, A3):
//
//   spec           spec.md -> requirement/scenario cards           (spec-cards.mjs)
//   tasks          tasks.md -> checklist, `git blame HEAD` attached (tasks-list.mjs + blame.mjs)
//   workingMemory  the object store's committed resume.md, ruling 3 (resume-view.mjs)
//   reviews        the snapshot's review rows, sourced to the PR    (D14)
//
// Committed tier only (R881-3, R881-8, R881-10, #1198): every artifact is read
// from the object store, never from a working tree. `readDocuments` resolves
// HEAD once, lists the six stage artifacts with one `ls-tree`, and reads each
// present blob with `cat-file`; `resume.md` is read at the change branch's
// tip. `spec.md` and `tasks.md` are read ONCE, and the spec cards and the
// tasks checklist are derived from that same string (AC7). Everything runs
// `git` on the served root's OWN git dir via the shared `gitRun`/injected
// `_run` — never `git -C <worktree>`. `HEAD` is mandatory in the blame argv
// for the same reason: the committed version, never the index or the copy.
//
// THE ONE WORKING-TREE EXCEPTION (#883, R883-8, R883-16; amends R1198-4): the
// drawer also shows an open issue's change dir in a LINKED worktree, "on this
// machine". That read lives in `local-overlay.mjs`, never here: this file keeps no
// `node:fs` import, and no artifact is read from the SERVED ROOT's working tree.
//
// WHICH documents the Spec, SDD and Tasks tabs show follows the lookup order (#1276, amends
// #883 D76): the served HEAD, else the one local worktree that holds the change dir, else the one
// origin branch that holds it (`pickTabSource`). The worktree read stays in `local-overlay.mjs`.

import { gitRun, gitErrorLine } from './git-run.mjs';

import { parseSpecCards } from './lib/spec-cards.mjs';
import { parseTasksList, countTasks } from '../lib/tasks-list.mjs';
import { parseBlame } from './lib/blame.mjs';
import { shapeResumeView, resumeWording } from './lib/resume-view.mjs';
import { parseFrontmatter } from '../memory/lib/resume-frontmatter.mjs';
import { validateResume } from '../memory/lib/resume-schema.mjs';
import { LIFECYCLE_STAGES, ARTEFACT_FILE, parseSliceScopes } from '../lib/sdd-layout.mjs';
import { changeDirNames, parseTreeListing, pickChangeDir } from '../lib/git-tree.mjs';
import { prUrl } from './lib/forge-url.mjs';
import { documentWording, localRowDetail, localStateWording, NO_CHANGE_BRANCH } from './lib/drawer-model.mjs';
import { readLocalBlocks } from './local-overlay.mjs';
import { parseCanonicalIssueBranch } from '../lib/branch-grammar.mjs';

/** D14's caveat, verbatim in the UI, until #880 lands `type: review` records. */
export const REVIEWS_SOURCE_NOTE = 'forge comments until #880 lands';

/** The path a "no change dir" reason names — a glob, not a file, since none exists to point at. */
function expectedChangeDirGlob(issue) {
  return `openspec/changes/issue-${issue}-*`;
}

/** `snapshot.changes`'s row for this issue, or `null` — never guesses a dir that was not in the read model. */
function findChangeDir(snapshot, issue) {
  if (!snapshot?.changes?.ok) return null;
  return snapshot.changes.value.find((c) => c.issue === issue)?.dir ?? null;
}

function noChangeDirTab(issue) {
  const path = expectedChangeDirGlob(issue);
  return { ok: false, reason: `no change dir at ${path}`, source: { path } };
}

/** The three tabs' sources that hold no documents: the walk found nothing, refused to choose, or could not read a step (#1276 D86). */
const isUnsourced = (source) => source.kind === 'none' || source.kind === 'refused';

/** A tab of a source that holds no change dir: the source said why, and the tab names the glob an operator can look for. */
function sourceFailure(source, issue) {
  return { ok: false, reason: source.reason, source: { path: expectedChangeDirGlob(issue) } };
}

/** A path as a tab cites it: plain at the served HEAD, `<ref>:<path>` from anywhere else, so no card cites a main path it was not read from. */
const docPath = (source, path) => (source.kind === 'head' ? path : `${source.ref}:${path}`);

/** The tab's own said reason for a document that is not a readable text, or `null` when it is. */
function documentFailure(doc, source, file) {
  if (source.kind === 'worktree') {
    if (!doc) return `${file} is not in ${source.ref}`;
    if (doc.state === 'deleted') return localStateWording(doc, source.branch);
    if (doc.state === 'unreadable') return doc.reason;
    return null;
  }
  if (!doc) return null;
  const sha = String(source.sha ?? source.head ?? '').slice(0, 12);
  if (doc.state === 'missing') return `${doc.path} is not committed at ${source.ref} (${sha})`;
  if (doc.state === 'unreadable') return `${doc.path} could not be read at ${source.ref}: ${doc.reason}`;
  return null;
}

/** The `from` line of a tab (#1276 D92): only a worktree or an origin source names itself; the served HEAD adds nothing. */
function withFrom(tab, source, detail) {
  if (source.kind === 'worktree') return { ...tab, from: `from ${source.ref} · ${detail}` };
  if (source.kind === 'origin') return { ...tab, from: `from ${source.ref} @ ${source.sha.slice(0, 12)}` };
  return tab;
}

/** What a worktree document's state says in the `from` line: #883's wording, or that the file is not there. */
const stateDetail = (source, doc) => (doc ? localStateWording(doc, source.branch) : 'not in this worktree');

/** A truncated document still feeds its tab; the tab says the cards or items cover only the read part. */
function truncationNote(doc, what) {
  return doc.state === 'truncated' ? `truncated at ${DOCUMENT_CAP} bytes; ${what} cover the read part` : null;
}

function buildSpecTab({ source, issue }) {
  if (isUnsourced(source)) return sourceFailure(source, issue);
  const file = STAGE_FILE.spec;
  const doc = source.documents.spec;
  const detail = stateDetail(source, doc);
  const failure = documentFailure(doc, source, file);
  if (failure) return withFrom({ ok: false, reason: failure, source: { path: docPath(source, doc?.path ?? `${source.dir}/${file}`) } }, source, detail);
  const parsed = parseSpecCards({ text: doc.text, path: docPath(source, doc.path) });
  const note = truncationNote(doc, 'cards');
  return withFrom(parsed.ok && note ? { ...parsed, note } : parsed, source, detail);
}

const UNCOMMITTED_SHA = /^0+$/;

/**
 * `tasks-list.mjs` already never drops a line for missing attribution (it
 * renders `actor: 'unknown'`) — this wraps EVERY item with its own
 * `attribution` leaf so a blame failure is SAID per row (source-guard's
 * "never empty-on-failure"), not silently folded into "unknown", while the
 * checklist itself still renders in full either way. `uncommitted` is
 * `{reason, all}`: a row blamed to the all-zero sha, or every row when `all`,
 * says it is uncommitted instead of carrying git's placeholder author (#1276 D91).
 */
function attachAttribution(items, blame, uncommitted = null) {
  return items.map((item) => {
    if (uncommitted && (uncommitted.all || (blame?.ok && UNCOMMITTED_SHA.test(blame.value[item.line]?.sha ?? '')))) {
      return { ...item, attribution: { ok: false, reason: uncommitted.reason } };
    }
    return {
      ...item,
      attribution: blame.ok
        ? { ok: true, value: { actor: item.actor, ts: item.ts } }
        : { ok: false, reason: blame.reason },
    };
  });
}

/**
 * The one blame of the Tasks tab, run on the served root's git dir by sha (D91). A worktree's
 * modified `tasks.md` is blamed at the worktree's head with the bytes already read as the final
 * image (`--contents -`, on stdin): git marks the lines that differ with the all-zero sha, and no
 * file under a worktree is ever named. An untracked one has nothing to blame: `null`, no spawn.
 */
function blameTasks({ source, doc, path, run }) {
  if (source.kind === 'worktree' && doc.overlay === 'new') return null;
  try {
    const text = source.kind === 'worktree' && doc.overlay === 'modified'
      ? run('git', ['blame', '--porcelain', '--contents', '-', source.head, '--', path], { input: doc.text })
      : run('git', ['blame', '--porcelain', source.kind === 'head' ? 'HEAD' : source.sha ?? source.head, '--', path]);
    return parseBlame({ text });
  } catch (err) {
    return { ok: false, reason: gitErrorLine(err) };
  }
}

/** Where the Tasks tab's count names its read from: the served HEAD's own words stay as they were. */
const PROGRESS_SOURCE = { worktree: () => 'working tree', origin: (source) => `at ${source.ref}` };
const READ_AT = { head: 'at HEAD', worktree: 'in the working tree', origin: (source) => `at ${source.ref}` };

function buildTasksTab({ source, run, issue }) {
  if (isUnsourced(source)) return sourceFailure(source, issue);
  const file = STAGE_FILE.tasks;
  const doc = source.documents.tasks;
  const detail = stateDetail(source, doc);
  const failure = documentFailure(doc, source, file);
  if (failure) return withFrom({ ok: false, reason: failure, source: { path: docPath(source, doc?.path ?? `${source.dir}/${file}`) } }, source, detail);
  const path = doc.path;

  // Committed version only at the served HEAD — `HEAD` is mandatory (R881-3): never the working tree, never the index.
  const blame = blameTasks({ source, doc, path, run });

  const attribution = blame?.ok
    ? Object.entries(blame.value).map(([line, a]) => ({ line: Number(line), actor: a.author ?? 'unknown', ts: a.authorTime ?? null }))
    : [];

  const parsed = parseTasksList({ text: doc.text, path: docPath(source, path), attribution });
  if (!parsed.ok) return withFrom(parsed, source, detail);
  const note = truncationNote(doc, 'items');
  const readAt = typeof READ_AT[source.kind] === 'function' ? READ_AT[source.kind](source) : READ_AT[source.kind];
  // #1199 D52: the drawer counts its own text. A count over a truncated read is not a total.
  const progress = doc.state === 'truncated'
    ? { ok: false, code: 'truncated', reason: `${path} is larger than ${DOCUMENT_CAP} bytes ${readAt}, so no total is known` }
    : countTasks(doc.text);
  const uncommitted = source.kind === 'worktree' ? { reason: `uncommitted in ${source.ref}: no blame`, all: doc.overlay === 'new' } : null;
  const progressSource = PROGRESS_SOURCE[source.kind]?.(source);
  return withFrom({
    ok: true,
    value: attachAttribution(parsed.value, blame ?? { ok: false, reason: uncommitted?.reason }, uncommitted),
    progress,
    ...(note ? { note } : {}),
    ...(progressSource ? { progressSource } : {}),
  }, source, detail);
}

/**
 * The kept worktrees of `issue` whose change dir is present: the ONE predicate of #883's W2 tie-break,
 * shared by `resolveBranch` (which branch) and `pickTabSource` (which documents), so the two cannot disagree (#1276 D87).
 */
export function holdingWorktrees(snapshot, issue) {
  const entries = snapshot?.localWorktrees?.ok ? snapshot.localWorktrees.value.entries : [];
  return entries.filter((e) => e.issue === issue && e.dirState === 'present');
}

/**
 * D12's branch resolution, in order: the issue's open PR headBranch, else the
 * single local branch of this issue, whatever its type (#883 D81) — never
 * picking among more than one unless exactly one of them is checked out in a
 * kept local worktree that holds the change dir (#883 W2). `*\/issue-N` and `*\/issue-N-*` are the two
 * globs `git branch --list` needs; `parseCanonicalIssueBranch` is the one
 * grammar that says which names are really this issue's.
 */
function resolveBranch({ run, snapshot, issue }) {
  const prMatch = snapshot?.prs?.ok ? snapshot.prs.value.find((p) => p.issue === issue) : null;
  if (prMatch?.headBranch) return { ok: true, branch: prMatch.headBranch };

  let listed;
  try {
    listed = run('git', ['branch', '--list', `*/issue-${issue}`, `*/issue-${issue}-*`]);
  } catch (err) {
    return { ok: false, kind: 'failed', reason: `git branch --list failed: ${gitErrorLine(err)}` };
  }
  const names = listed.split(/\r?\n/).map((l) => l.replace(/^[*+]?\s+/, '').trim()).filter((n) => n && parseCanonicalIssueBranch(n)?.issueNumber === String(issue));
  if (names.length === 0) return { ok: false, kind: 'none', reason: `no open PR and no */issue-${issue} branch in this clone` };
  if (names.length === 1) return { ok: true, branch: names[0] };
  // #883 W2: several names. The worktree that holds this issue's change dir is
  // the one the maintainer is working in; the snapshot already says which
  // (no extra spawn). Two such worktrees stay ambiguous and are named.
  const holding = holdingWorktrees(snapshot, issue).filter((e) => names.includes(e.branch));
  const held = [...new Set(holding.map((e) => e.branch))];
  if (held.length === 1) return { ok: true, branch: held[0] };
  const named = held.length > 1 ? `; held by worktrees ${holding.map((e) => e.leaf).join(', ')}` : '';
  return { ok: false, kind: 'ambiguous', reason: `more than one */issue-${issue} branch in this clone: ${names.join(', ')}${named}` };
}

function buildWorkingMemoryTab({ resolved, resume, localResume = false }) {
  // Derived from the one resume document so this tab and the SDD row cannot disagree.
  if (!resolved.ok) return { ok: false, reason: documentWording(resume) };
  const { branch } = resolved;
  if (resume.state === 'unreadable') return { ok: false, reason: documentWording(resume) };
  if (resume.state !== 'present' && resume.state !== 'truncated') {
    return { ok: false, reason: `no committed resume.md on ${branch}${localResume ? '; an uncommitted one is on this machine, below' : ''}` };
  }
  const { frontmatter } = parseFrontmatter(resume.text);
  return { ok: true, value: shapeResumeView({ frontmatter, branch, path: resume.path }) };
}

// Delegates to `lib/forge-url.mjs`'s `prUrl` (#882 cold review of PR 1,
// blocker fix): ONE definition of this shape, not a second copy that can
// drift from the one `roadmap-model.mjs` (and every later governance view)
// now shares.
function buildPrUrl(project, pr) {
  return prUrl(project, pr);
}

/** D14: every round, oldest first (already the order `reviewRows` builds), sourced to the PR — no per-round anchor exists in this repo's provider today (github.mjs:564 drops it). */
function buildReviewsTab({ snapshot, project, issue }) {
  if (!snapshot?.prs?.ok) return { ok: false, reason: 'the PR list could not be read', sourceNote: REVIEWS_SOURCE_NOTE };
  if (!snapshot?.reviews?.ok) return { ok: false, reason: 'the reviews list could not be read', sourceNote: REVIEWS_SOURCE_NOTE };

  const prNumbers = new Set(snapshot.prs.value.filter((p) => p.issue === issue).map((p) => p.number));
  const rounds = [];
  // A per-PR row can be `{pr, ok:false, reason}` (reviewRows fails per PR while
  // the list resolves). It is SAID here, never skipped: skipping read as "no
  // rounds ever posted" (evidence-reader-empty-on-failure.md, R881-9).
  const unreadable = [];
  for (const row of snapshot.reviews.value) {
    if (!prNumbers.has(row.pr)) continue;
    // A queued thread keeps `pending` so the drawer words it "not read yet", never "unreadable" (#1312 D150).
    if (!row.ok) { unreadable.push({ pr: row.pr, ok: false, ...(row.pending === true ? { pending: true } : {}), reason: row.reason, source: { url: buildPrUrl(project, row.pr) } }); continue; }
    for (const verdict of row.verdicts) {
      rounds.push({ ...verdict, source: { url: verdict.commentUrl ?? buildPrUrl(project, row.pr) } });
    }
  }
  if (rounds.length === 0 && unreadable.length > 0) {
    const queued = unreadable.filter((u) => u.pending === true).length;
    // #1365: a thread is worded by its OWN state; only a tab where every thread agrees names them with one phrase.
    if (queued === 0 || queued === unreadable.length) {
      return { ok: false, reason: `${queued > 0 ? 'every review thread of this issue is not read yet' : 'every review thread of this issue is unreadable'}: ${unreadable.map((u) => `#${u.pr} (${u.reason})`).join(', ')}`, unreadable, sourceNote: REVIEWS_SOURCE_NOTE };
    }
    const own = (u) => `#${u.pr} (${u.pending === true ? 'not read yet' : 'unreadable'}: ${u.reason})`;
    return { ok: false, reason: `no review thread of this issue could be shown: ${unreadable.map(own).join(', ')}`, unreadable, sourceNote: REVIEWS_SOURCE_NOTE };
  }
  return { ok: true, value: rounds, unreadable, sourceNote: REVIEWS_SOURCE_NOTE };
}

// The seven raw artefact-presence keys `status/snapshot.mjs`'s
// `readArtefactPresence` always computes (R998-4) — `LIFECYCLE_STAGES` is
// sdd-layout.mjs's own canonical four (issue #456); this file is server-side
// only (no D9 constraint), so it imports that instead of declaring a rival
// literal, then names the three stages the door's own artefact map adds.
const SDD_STAGES = [...LIFECYCLE_STAGES, 'apply', 'verify', 'archive'];

/**
 * The file each stage IS. The four canonical names come from `sdd-layout.mjs`
 * rather than being retyped — that module refuses a change that declares a
 * different file for a lifecycle stage, so a second literal here could
 * silently disagree with the rule the repository actually enforces. The three
 * the door adds are named here because `sdd-layout.mjs` does not own them.
 *
 * #1059: the tab used to stamp all seven rows with the change DIRECTORY, so it
 * reported a stage present without ever naming the file that made it present
 * and every row's provenance pointed at the same place. A stage is a file.
 */
const STAGE_FILE = Object.freeze({
  ...Object.fromEntries(LIFECYCLE_STAGES.map((stage) => [stage, ARTEFACT_FILE[stage]])),
  apply: 'apply-progress.md',
  verify: 'verify-report.md',
  archive: 'archive-report.md',
});

// ── #1198: the seven documents, read from the object store ─────────────────

/** A document is cut here; the note says so and there is no "load full" (R3). */
export const DOCUMENT_CAP = 262144;
/** Above this a blob is not read at all: it is said unreadable with its size. */
export const DOCUMENT_READ_LIMIT = 8 * 1024 * 1024;
/** Headroom over a blob's size so `execFileSync`'s 1 MiB default never turns a 2 MB document into ENOBUFS. */
const READ_HEADROOM = 4096;

/** The six documents read at HEAD, keyed by their stage name. `archive` is a stage, not a document. */
const HEAD_DOCUMENT_KEYS = SDD_STAGES.filter((stage) => stage !== 'archive');


function documentEntry(path, ref, fields) {
  return { path, ref, commit: null, blob: null, state: 'missing', text: null, bytes: null, truncated: false, truncatedAt: null, reason: null, note: null, ...fields };
}

/** Cut at the cap on a UTF-8 boundary: back up while the first dropped byte is a continuation byte. */
export function capText(text) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= DOCUMENT_CAP) return { text, truncated: false, truncatedAt: null };
  let end = DOCUMENT_CAP;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return { text: buf.subarray(0, end).toString('utf8'), truncated: true, truncatedAt: end };
}

/**
 * One document from its tree entry: missing (no entry), unreadable (not a
 * regular blob, over the read limit, or the read failed), present, or
 * truncated. `read(maxBuffer)` performs the content read for this entry.
 */
function documentFromEntry({ path, ref, commit, entry, read }) {
  if (!entry) return documentEntry(path, ref, { state: 'missing' });
  const refuse = (reason) => documentEntry(path, ref, { state: 'unreadable', reason, bytes: entry.size, blob: entry.sha });
  if (entry.type !== 'blob') return refuse(`${path} is a ${entry.type}, not a file`);
  if (entry.mode === '120000') return refuse(`${path} is a symlink`);
  if (entry.size > DOCUMENT_READ_LIMIT) return refuse(`${entry.size} bytes exceeds the read limit of ${DOCUMENT_READ_LIMIT}`);
  let text;
  try {
    text = String(read(entry.size + READ_HEADROOM) ?? '');
  } catch (err) {
    return refuse(gitErrorLine(err));
  }
  const cut = capText(text);
  return documentEntry(path, ref, {
    commit, blob: entry.sha, state: cut.truncated ? 'truncated' : 'present', text: cut.text, bytes: entry.size, truncated: cut.truncated, truncatedAt: cut.truncatedAt,
    note: cut.truncated ? `truncated at ${DOCUMENT_CAP} bytes` : null,
  });
}

/**
 * The six stage documents at `ref` (default HEAD): `rev-parse` once, one `ls-tree`
 * for all six paths (literal pathspecs, so a `*` in a directory name is never
 * globbed), then one `cat-file blob` per present document. A failure of the first
 * two says every document unreadable with that reason, never an empty list. A ref
 * that no longer resolves (a pruned SHA) is that failure. `label` is what the
 * provenance stamps name (default: the ref); nothing here touches a working tree.
 * @returns {{head: string|null, documents: Record<string, object|null>}}
 */
export function readHeadDocuments({ run, dir, ref = 'HEAD', label = ref }) {
  if (!dir) return { head: null, documents: Object.fromEntries(HEAD_DOCUMENT_KEYS.map((k) => [k, null])) };
  const paths = HEAD_DOCUMENT_KEYS.map((k) => `${dir}/${STAGE_FILE[k]}`);
  let head;
  let tree;
  try {
    head = String(run('git', ['rev-parse', '--verify', `${ref}^{commit}`])).trim();
    tree = parseTreeListing(run('git', ['--literal-pathspecs', 'ls-tree', '-l', '-z', head, '--', ...paths]));
  } catch (err) {
    const reason = gitErrorLine(err);
    return { head: null, documents: Object.fromEntries(HEAD_DOCUMENT_KEYS.map((k, i) => [k, documentEntry(paths[i], label, { state: 'unreadable', reason })])) };
  }
  const documents = {};
  HEAD_DOCUMENT_KEYS.forEach((key, i) => {
    const entry = tree.get(paths[i]);
    documents[key] = documentFromEntry({
      path: paths[i], ref: label, commit: head, entry,
      read: (maxBuffer) => run('git', ['cat-file', 'blob', entry.sha], { maxBuffer }),
    });
  });
  return { head, documents };
}

const RESUME_FILE = 'resume.md';
const CHANGES_ROOT_DIR = 'openspec/changes';

/** The change dirs listed directly under `openspec/changes/` at `commit`, as bare names. */
function listChangeDirNames({ run, commit }) {
  return changeDirNames(parseTreeListing(run('git', ['ls-tree', '-z', commit, '--', `${CHANGES_ROOT_DIR}/`])));
}

/**
 * `resume.md` of one change at `commit` (D38): list `openspec/changes/` at the
 * commit, pick the dir carrying `issue`, read `<dir>/resume.md` by its blob sha.
 * The path is the contract path (`feature-working-memory-contract.md`), never
 * the branch root. `ls-tree` tells "no such file" from "could not read" without
 * parsing stderr: stderr feeds only the reason line (`gitErrorLine`).
 */
function readResumeAt({ run, commit, issue, label }) {
  const fallbackPath = RESUME_FILE;
  try {
    const picked = pickChangeDir(listChangeDirNames({ run, commit }), issue);
    if (!picked.ok && picked.state === 'missing') return documentEntry(fallbackPath, label, { state: 'missing', reason: `no change dir for #${issue} on ${label}` });
    if (!picked.ok) return documentEntry(fallbackPath, label, { state: 'unreadable', reason: picked.reason });
    const path = `${CHANGES_ROOT_DIR}/${picked.dir}/${RESUME_FILE}`;
    const tree = parseTreeListing(run('git', ['--literal-pathspecs', 'ls-tree', '-l', '-z', commit, '--', path]));
    const entry = tree.get(path);
    return documentFromEntry({ path, ref: label, commit, entry, read: (maxBuffer) => run('git', ['cat-file', 'blob', entry.sha], { maxBuffer }) });
  } catch (err) {
    return documentEntry(fallbackPath, label, { state: 'unreadable', reason: gitErrorLine(err) });
  }
}

/** `resume.md` at the change branch's tip: the branch is resolved to a commit ONCE, so the stamp names the commit the text came from. */
function readResumeDocument({ run, resolved, issue }) {
  if (!resolved.ok && resolved.kind === 'none') return documentEntry(RESUME_FILE, null, { state: 'missing', reason: NO_CHANGE_BRANCH });
  if (!resolved.ok) return documentEntry(RESUME_FILE, null, { state: 'unreadable', reason: resolved.reason });
  const { branch } = resolved;
  let commit;
  try {
    commit = String(run('git', ['rev-parse', '--verify', `${branch}^{commit}`])).trim();
  } catch (err) {
    return documentEntry(RESUME_FILE, branch, { state: 'unreadable', reason: gitErrorLine(err) });
  }
  return readResumeAt({ run, commit, issue, label: branch });
}

/**
 * The door's own sdd tab (#998 R998-6, design.md's "TAB_IDS grows sdd and
 * records"): the seven stage artefacts' RAW presence for this issue's own
 * row (`snapshot.changes`'s `artefacts{}` map, R998-4) — sourced to the
 * change dir. This deliberately does not re-derive `lib/sdd-model.mjs`'s
 * `STAGE_VOCAB` word/mark: that derivation is the SDD MODE's own concern
 * (every change, at once); a single row's own tab draws the raw fact.
 */
/** The declared slice plan of one change, or its own said reason. `scopes` is a snapshot `sliceScopes` field. */
function sliceTab(scopes, path) {
  if (!scopes || typeof scopes !== 'object') return { ok: false, reason: 'no slice plan is declared in this change\'s tasks.md' };
  if (scopes.ok !== true) return { ok: false, reason: scopes.reason };
  const value = scopes.value ?? [];
  if (value.length === 0) return { ok: false, reason: 'no slice plan is declared in this change\'s tasks.md' };
  return {
    ok: true,
    note: 'declared in tasks.md — what each PR did with its slice is not read',
    value: value.map((slice) => ({
      slice: slice.slice,
      claims: [...(slice.claims ?? [])],
      terminalPr: slice.terminal_pr ?? null,
      source: { path },
    })),
  };
}

/** `snapshot.changes`'s `sliceScopes` shape, from a tasks.md text the drawer read itself. */
function sliceScopesOf(tasksDoc) {
  if (typeof tasksDoc?.text !== 'string') return { ok: false, reason: 'tasks.md was not read, so no slice plan is known' };
  const parsed = parseSliceScopes(tasksDoc.text);
  return parsed.refusal ? { ok: false, reason: parsed.refusal } : { ok: true, value: parsed.scopes };
}

/** The document states that hold text a reader can open (R1282-1). */
const READABLE_STATES = new Set(['present', 'truncated']);

const ARCHIVE_NOT_READ = 'not read outside the served root';

/** The SDD tab of a worktree or origin source: a stage is present when the source holds its document; `archive` is never read there (R1276-8). */
export function buildSourcedSddTab(source) {
  const rows = SDD_STAGES.map((stage) => {
    const doc = source.documents[stage];
    const base = { stage, file: STAGE_FILE[stage], source: { path: docPath(source, `${source.dir}/${STAGE_FILE[stage]}`) } };
    if (stage === 'archive') return { ...base, present: false, detail: ARCHIVE_NOT_READ };
    // R1282-1: a document the source could not read is not there to be done, and its row says why.
    const unreadable = doc?.state === 'unreadable';
    // R1342-1: an allow-list. Only a state that holds readable text is present; a state this code does not know is not.
    const present = READABLE_STATES.has(doc?.state);
    if (unreadable) return { ...base, present, detail: `could not be read: ${doc.reason ?? 'no reason was given'}` };
    return { ...base, present, ...(source.kind === 'worktree' ? { detail: doc ? localRowDetail(doc, source.branch) : 'missing' } : {}) };
  });
  const detail = source.kind === 'worktree' ? source.branch : null;
  return withFrom({ ok: true, value: rows, slices: sliceTab(sliceScopesOf(source.documents.tasks), docPath(source, source.dir)) }, source, detail);
}

function buildSddTab({ snapshot, issue, source }) {
  // `source.dir` is `findChangeDir(snapshot, issue)` at the served HEAD — the SAME `snapshot.changes
  // .value.find(c => c.issue === issue)` predicate this function would otherwise re-run, over the same
  // (already-checked-ok) `snapshot.changes` section. A source with no documents already covers "the changes
  // section could not be read" and "no row for this issue" (found by cold review of #1008/PR6: the row-lookup
  // branch below was unreachable). One reason, said once, shared with the spec/tasks tabs.
  if (isUnsourced(source)) return sourceFailure(source, issue);
  if (source.kind !== 'head') return buildSourcedSddTab(source);
  const { dir } = source;
  const row = snapshot.changes.value.find((c) => c.issue === issue);
  const artefacts = row.artefacts ?? {};
  return {
    ok: true,
    // A MISSING stage still names its file: "design is missing" is only
    // actionable when the reader knows what to create.
    value: SDD_STAGES.map((stage) => ({
      stage,
      file: STAGE_FILE[stage],
      present: Boolean(artefacts[stage]),
      source: { path: `${dir}/${STAGE_FILE[stage]}` },
    })),
    // #1059 region 08: the design puts the slice plan under the stage strip,
    // in this same tab. The plan is DECLARED in `tasks.md` and read into
    // `sliceScopes`; what a pull request actually did with it is not read
    // anywhere on this page, so the note says that rather than letting a
    // reader assume a drawn slice is a merged one.
    slices: sliceTab(row.sliceScopes, dir),
  };
}

/**
 * The door's records tab (#998 R998-6): this issue's own rows from
 * `snapshot.records` (no new IO — the section is already in the snapshot
 * the route holds, same as every other tab), newest first, each sourced to
 * its own record file.
 */
function buildRecordsTab({ snapshot, issue }) {
  if (!snapshot?.records?.ok) return { ok: false, reason: snapshot?.records?.reason ?? 'the records section could not be read' };
  const rows = snapshot.records.value.records
    .filter((r) => r.issue === issue)
    .slice()
    .sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  return {
    ok: true,
    value: rows.map((r) => ({ id: r.id, ts: r.ts, actor: r.actor, actorKind: r.actorKind, type: r.type, supersedes: r.supersedes ?? null, summary: r.summary ?? null, source: { path: r.file } })),
  };
}

// ── #1201 D37: a teammate's branch, read at its SHA, below the served change ──

/** Remote blocks that carry documents; the rest of an issue's entries are listed without them. */
export const REMOTE_DRAWER_CAP = 3;

/** A resume document (remote or local) to `{state, reason, document, view}`: `invalid` is told from `present` by the same schema the writer validates against. */
export function resumeOutcome({ doc, label }) {
  if (doc.state === 'missing') return { state: 'missing', reason: doc.reason, document: doc, view: null };
  if (doc.state === 'unreadable') return { state: 'unreadable', reason: doc.reason, document: doc, view: null };
  const { frontmatter } = parseFrontmatter(doc.text);
  if (!frontmatter) return { state: 'invalid', reason: 'resume.md has no frontmatter', document: doc, view: null };
  try {
    validateResume(frontmatter);
  } catch (err) {
    return { state: 'invalid', reason: gitErrorLine(err), document: doc, view: null };
  }
  return { state: 'present', reason: null, document: doc, view: shapeResumeView({ frontmatter, branch: label, path: doc.path }) };
}

const NO_BLOCK_STATE = { missing: 'no-change-dir' };

/** One remote entry of this issue, as the drawer's block. Entries past the cap and entries the served HEAD already is are listed, not re-read. */
function remoteBlock({ run, entry, index, head, issue }) {
  const label = `origin/${entry.branch}`;
  const base = {
    branch: entry.branch, sha: entry.sha, label: `on ${label} @ ${entry.sha.slice(0, 12)}`, pr: entry.pr, author: entry.author, tipAt: entry.tipAt,
    dir: entry.change?.ok ? entry.change.value.dir : null, documents: null, sameAsServed: entry.sha === head,
  };
  const listed = (state) => ({ ...base, state, resume: { state: entry.resume?.state ?? 'missing', reason: entry.resume?.reason ?? null, document: null, view: null } });
  if (base.sameAsServed) return listed('same-as-served');
  if (index >= REMOTE_DRAWER_CAP) return listed('capped');
  if (!entry.change?.ok) return listed(NO_BLOCK_STATE[entry.change?.state] ?? entry.change?.state ?? 'unreadable');
  const { documents } = readHeadDocuments({ run, dir: base.dir, ref: entry.sha, label });
  return {
    ...base, state: 'read', documents,
    resume: resumeOutcome({ doc: readResumeAt({ run, commit: entry.sha, issue, label }), label }),
  };
}

/** `snapshot.remoteChanges`'s grammar entries of this issue, as blocks (never touching the served change). */
function readRemoteBlocks({ run, snapshot, issue, head }) {
  const section = snapshot?.remoteChanges;
  const mine = section?.ok ? section.value.branches.filter((e) => e.issue === issue) : [];
  const remote = mine.map((entry, index) => remoteBlock({ run, entry, index, head, issue }));
  const note = mine.length > REMOTE_DRAWER_CAP ? `showing documents for ${REMOTE_DRAWER_CAP} of ${mine.length} remote branches; the others are listed without documents` : null;
  return { remote, remoteNote: note };
}

// ── #1276: the document tabs follow the lookup order ─────────────────────────

const WORKTREES_NOT_READ = "this machine's worktrees were not read, so the tabs cannot fall back past them";

/**
 * pickTabSource() — the ONE document source of a drawer read (#1276 D86), walked in the lookup order of
 * #883: the served HEAD, then the one worktree of this machine that holds the change dir, then the one
 * origin branch that holds it. The first step that holds the change wins and a later step is never
 * consulted. `none` says why nothing was found, or which step could not be read; `refused` says the walk
 * would have had to choose between several holders. `documents` is always set, so the view's
 * `documents` map keeps its shape (the served HEAD's nulls when no source holds the change).
 */
export function pickTabSource({ snapshot, issue, dir, head, headDocuments, local, held, remote }) {
  const stop = (kind, reason) => ({ kind, reason, documents: headDocuments });
  if (dir) return { kind: 'head', dir, ref: 'HEAD', head, documents: headDocuments };
  const plain = noChangeDirTab(issue).reason;
  // R1276-5: a `changes` section that could not be read is today's said reason, whatever lies below it.
  if (!snapshot?.changes?.ok) return stop('none', plain);

  const worktrees = snapshot.localWorktrees;
  if (worktrees && !worktrees.ok) return stop('none', `${WORKTREES_NOT_READ}: ${worktrees.reason}`);
  const holding = holdingWorktrees(snapshot, issue).sort((a, b) => a.path.localeCompare(b.path));
  if (holding.length > 1) {
    return stop('refused', `several worktrees hold the change dir for #${issue}: ${holding.map((e) => e.leaf).join(', ')}; the tabs read none of them — each is under "on this machine"`);
  }
  if (holding.length === 1) {
    const [entry] = holding;
    const read = held.get(entry.path);
    if (!read) return stop('none', `the change dir in worktree ${entry.leaf} could not be read: ${local.find((b) => b.path === entry.path)?.reason ?? 'its documents were not read'}`);
    return { kind: 'worktree', dir: entry.dir, leaf: entry.leaf, branch: entry.branch, head: entry.head, ref: `worktree ${entry.leaf}`, documents: read.documents };
  }

  const branches = snapshot.remoteChanges?.ok ? snapshot.remoteChanges.value.branches : [];
  const holders = branches.filter((e) => e.issue === issue && e.change?.ok);
  if (holders.length === 0) return stop('none', plain);
  let chosen = holders[0];
  if (holders.length > 1) {
    // Q1 (ruled): the open PR's head branch, the same first precedence `resolveBranch` uses; no such holder, no choice.
    const prBranch = snapshot.prs?.ok ? snapshot.prs.value.find((p) => p.issue === issue)?.headBranch : null;
    chosen = holders.find((e) => prBranch && e.branch === prBranch);
    if (!chosen) return stop('refused', `several origin branches hold the change dir for #${issue}: ${holders.map((e) => e.branch).join(', ')}; no open PR names one of them, so the tabs read none`);
  }
  const block = remote.find((b) => b.branch === chosen.branch && b.sha === chosen.sha);
  if (block?.state === 'read') return { kind: 'origin', dir: block.dir, branch: chosen.branch, sha: chosen.sha, ref: `origin/${chosen.branch}`, documents: block.documents };
  if (block?.state === 'capped') return stop('none', `origin/${chosen.branch} holds the change dir but is past the drawer's read cap of ${REMOTE_DRAWER_CAP}`);
  return stop('none', plain);
}

/** The source as the page gets it: its kind and where it is, never a document's text. */
function publicSource(source) {
  switch (source.kind) {
    case 'head': return { kind: 'head', dir: source.dir };
    case 'worktree': return { kind: 'worktree', leaf: source.leaf, branch: source.branch, dir: source.dir, label: source.ref };
    case 'origin': return { kind: 'origin', branch: source.branch, sha12: source.sha.slice(0, 12), dir: source.dir, label: `${source.ref} @ ${source.sha.slice(0, 12)}` };
    default: return { kind: source.kind, reason: source.reason };
  }
}

/**
 * buildChangeView() — the drawer's one composition. Server-side only (D11):
 * the six tabs' IO happens here, the pure shapers just attach `source`.
 *
 * `project` is not in D8's module-map signature verbatim but is required to
 * build a PR URL (D14) the same way `server.mjs`'s `buildMeta()` already
 * carries it — an accepted, disclosed addition, optional and defaulting to
 * `null` (degrades to a relative `pull/<n>` reference, still a non-empty
 * `source.url`, never a crash).
 *
 * @param {{root: string, issue: number, snapshot: object, project?: string|null,
 *   _read?: Function, _run?: Function, _exists?: Function}} opts
 * @returns {{ok:true, value:{issue:number, changeDir:string|null, spec:object, tasks:object, workingMemory:object, reviews:object, remote:object[], remoteNote:string|null}} | {ok:false, reason:string}}
 */
export function buildChangeView({ root, issue, snapshot, project = null, _read, _run, _exists } = {}) {
  if (!Number.isInteger(issue) || issue <= 0) return { ok: false, reason: 'issue must be a positive integer' };
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'no snapshot was supplied' };

  // `_exists` is accepted for signature parity with the rest of `snapshot.mjs`'s
  // readers (`readChanges`'s own `{_read, _list, _exists}` seam) but unused
  // today — `read()`'s own catch already covers "the file is not there".
  void _exists;

  // `_read` is accepted for signature parity and unused: no artifact is read from a working tree (#1198).
  void _read;
  const run = _run ?? gitRun(root);

  const dir = findChangeDir(snapshot, issue);
  const { head, documents: headDocuments } = readHeadDocuments({ run, dir });
  const resolved = resolveBranch({ run, snapshot, issue });
  const resume = readResumeDocument({ run, resolved, issue });
  const { held, ...localRead } = readLocalBlocks({ run, snapshot, issue, mainDocuments: headDocuments });
  const remoteRead = readRemoteBlocks({ run, snapshot, issue, head });
  const source = pickTabSource({ snapshot, issue, dir, head, headDocuments, local: localRead.local, held, remote: remoteRead.remote });
  const documents = { ...source.documents, resume };

  return {
    ok: true,
    value: {
      issue,
      changeDir: dir,
      documents,
      tabSource: publicSource(source),
      spec: buildSpecTab({ source, issue }),
      sdd: buildSddTab({ snapshot, issue, source }),
      tasks: buildTasksTab({ source, run, issue }),
      workingMemory: buildWorkingMemoryTab({ resolved, resume, localResume: localRead.local.some((b) => b.documents?.resume) }),
      reviews: buildReviewsTab({ snapshot, project, issue }),
      records: buildRecordsTab({ snapshot, issue }),
      ...remoteRead,
      ...localRead,
    },
  };
}
