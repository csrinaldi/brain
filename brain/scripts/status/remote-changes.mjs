// remote-changes.mjs — what teammates have in flight, read from this clone's
// remote-tracking refs and nothing else (#1201, extends #1198/#1218).
//
// LOCAL AND READ-ONLY (#878 ruling 2): the base reads are two `for-each-ref`
// spawns. This module never opens a network connection and never writes a ref;
// the poller owns the fetch, the snapshot only reads what it left behind. Fetch
// state is NOT in this section (D30): it lives in poller state.

import { field, uncomputable } from './report.mjs';
import { parseCanonicalIssueBranch } from '../lib/branch-grammar.mjs';
import { changeDirNames, gitErrorLine, parseTreeListing, pickChangeDir } from '../lib/git-tree.mjs';
import { LIFECYCLE_STAGES, ARTEFACT_FILE, CHANGES_ROOT } from '../lib/sdd-layout.mjs';
import { parseFrontmatter } from '../memory/lib/resume-frontmatter.mjs';
import { validateResume } from '../memory/lib/resume-schema.mjs';

const ORIGIN = 'refs/remotes/origin/';
/** R4: a lane branch is literally a prefix; the lane PRs are #1070's (owned by #1121). */
const LANE_PREFIXES = Object.freeze(['memory/', 'auto-archive/']);
/** D36: grammar branches read per build; the rest are `deferred`, newest first served. At most 3 spawns each. */
export const REMOTE_READ_BUDGET = 24;
/** D36: the server's follow-up recompute while `deferred > 0`. */
export const REMOTE_FOLLOWUP_MS = 1000;
/** Above this a `resume.md` blob is not read at all (D35). */
export const RESUME_READ_LIMIT = 65536;
const RESUME_FILE = 'resume.md';
const RESUME_FIELDS = Object.freeze(['checkpointed_from', 'checkpointed_at', 'current_slice', 'next_action', 'blockers']);
/** The six documents a change dir holds; `archive` is a stage, not a document. */
const STAGE_FILES = Object.freeze({
  ...Object.fromEntries(LIFECYCLE_STAGES.map((stage) => [stage, ARTEFACT_FILE[stage]])),
  apply: 'apply-progress.md',
  verify: ARTEFACT_FILE.verification,
});
const NOT_GRAMMAR = 'outside the branch grammar: no issue to look a change dir up by';
const FIELD_SEP = '\0';
const LISTING_FORMAT = ['%(refname)', '%(objectname)', '%(committerdate:iso-strict)', '%(authorname)', '%(symref)'].join('%00');

const byTipThenBranch = (a, b) => (a.tipAt < b.tipAt ? 1 : a.tipAt > b.tipAt ? -1 : a.branch.localeCompare(b.branch));
const byIssueThenBranch = (a, b) => a.issue - b.issue || a.branch.localeCompare(b.branch);

/** `for-each-ref` records to `[{ref, sha, tipAt, author, symref}]`. */
function parseListing(out) {
  return String(out ?? '').split('\n').filter(Boolean).map((line) => {
    const [ref, sha, tipAt, author, symref] = line.split(FIELD_SEP);
    return { ref, sha, tipAt, author, symref: symref || null };
  });
}

/** D32: `origin/HEAD`'s target, else `origin/main`; `null` when neither is in the listing. */
function resolveBase(rows) {
  const head = rows.find((r) => r.ref === `${ORIGIN}HEAD`)?.symref;
  if (head && rows.some((r) => r.ref === head)) return head;
  return rows.some((r) => r.ref === `${ORIGIN}main`) ? `${ORIGIN}main` : null;
}

/** D33 rules 1-3: why a ref is hidden, or `null` when it stays. An open PR wins over merged (R6). */
function hiddenBy({ branch, ref, base, merged, openPr }) {
  if (ref === base || branch === 'HEAD') return 'base';
  if (LANE_PREFIXES.some((p) => branch.startsWith(p))) return 'lane';
  if (merged.has(ref) && !openPr) return 'merged';
  return null;
}

function classify({ rows, base, merged, prs }) {
  const hidden = { base: 0, lane: 0, merged: 0 };
  const entries = [];
  for (const row of rows) {
    const branch = row.ref.slice(ORIGIN.length);
    const open = prs.ok ? prs.value.find((p) => p.headBranch === branch) : null;
    const why = hiddenBy({ branch, ref: row.ref, base, merged, openPr: open });
    if (why) { hidden[why] += 1; continue; }
    const parsed = parseCanonicalIssueBranch(branch);
    entries.push({
      branch, sha: row.sha, tipAt: row.tipAt, author: row.author,
      kind: parsed ? 'grammar' : 'unjoined', issue: parsed ? Number(parsed.issueNumber) : null,
      pr: open ? { number: open.number, title: open.title } : null,
    });
  }
  return { entries, hidden };
}

// ── the per-branch read: three spawns at most, at the branch's own SHA (D35) ──

const unreadableResume = (path, reason) => ({ state: 'unreadable', path, reason, fields: null });

/** One stage's blob metadata from its `ls-tree -l` entry: no text, ever. */
function stageMeta(entry) {
  if (!entry) return { state: 'missing', blob: null, bytes: null };
  if (entry.type !== 'blob' || entry.mode === '120000') return { state: 'unreadable', blob: null, bytes: null };
  return { state: 'present', blob: entry.sha, bytes: entry.size };
}

/** `resume.md` from its entry and text reader: present, missing, unreadable (not a regular blob, over the limit, a read that threw) or invalid. */
function resumeFrom({ path, entry, readBlob }) {
  if (!entry) return { state: 'missing', path, reason: null, fields: null };
  if (entry.type !== 'blob') return unreadableResume(path, `${path} is a ${entry.type}, not a file`);
  if (entry.mode === '120000') return unreadableResume(path, `${path} is a symlink`);
  if (entry.size > RESUME_READ_LIMIT) return unreadableResume(path, `${entry.size} bytes exceeds the read limit of ${RESUME_READ_LIMIT}`);
  let text;
  try { text = String(readBlob(entry.sha, entry.size)); } catch (err) { return unreadableResume(path, gitErrorLine(err)); }
  const { frontmatter } = parseFrontmatter(text);
  if (!frontmatter) return { state: 'invalid', path, reason: 'resume.md has no frontmatter', fields: null };
  try { validateResume(frontmatter); } catch (err) { return { state: 'invalid', path, reason: gitErrorLine(err), fields: null }; }
  return { state: 'present', path, reason: null, fields: Object.fromEntries(RESUME_FIELDS.map((k) => [k, frontmatter[k] ?? null])) };
}

/**
 * Reads one grammar branch at `sha`. `cacheable` is false when a spawn threw: a
 * failed read says nothing durable about an immutable commit, so it is never memoised.
 */
function readBranch({ run, branch, sha, issue }) {
  const label = `origin/${branch}`;
  const fail = (state, reason, cacheable) => ({
    change: { ok: false, state, reason },
    resume: { state, path: null, reason, fields: null },
    cacheable,
  });
  let picked;
  let listing;
  const stagePaths = (dir) => Object.values(STAGE_FILES).map((f) => `${CHANGES_ROOT}/${dir}/${f}`);
  try {
    const names = changeDirNames(parseTreeListing(run('git', ['ls-tree', '-z', sha, '--', `${CHANGES_ROOT}/`])));
    picked = pickChangeDir(names, issue);
    if (!picked.ok) return fail(picked.state, picked.state === 'missing' ? `${picked.reason} on ${label}` : picked.reason, true);
    const resumePath = `${CHANGES_ROOT}/${picked.dir}/${RESUME_FILE}`;
    listing = parseTreeListing(run('git', ['--literal-pathspecs', 'ls-tree', '-l', '-z', sha, '--', ...stagePaths(picked.dir), resumePath]));
  } catch (err) {
    return fail('unreadable', gitErrorLine(err), false);
  }
  const dir = `${CHANGES_ROOT}/${picked.dir}`;
  const artefacts = Object.fromEntries(Object.entries(STAGE_FILES).map(([stage, file]) => [stage, stageMeta(listing.get(`${dir}/${file}`))]));
  const resumePath = `${dir}/${RESUME_FILE}`;
  let threw = false;
  const resume = resumeFrom({
    path: resumePath, entry: listing.get(resumePath),
    readBlob: (blob, size) => { try { return run('git', ['cat-file', 'blob', blob], { maxBuffer: size + 4096 }); } catch (err) { threw = true; throw err; } },
  });
  return { change: { ok: true, value: { dir, artefacts } }, resume, cacheable: !threw };
}

const DEFERRED = 'not read yet: over this build\'s read budget';
const deferredRead = () => ({
  change: { ok: false, state: 'deferred', reason: DEFERRED },
  resume: { state: 'deferred', path: null, reason: DEFERRED, fields: null },
});

/**
 * D36: fills `change`/`resume` of every grammar entry, newest tip first. A
 * commit is immutable, so `${sha}:${issue}` fully determines the read: a hit
 * costs nothing, a miss costs at most 3 spawns until `budget` is spent, and the
 * rest are `deferred` (never `unreadable`). Reads that threw are not memoised.
 * Keys whose sha left the listing are evicted, so the memo cannot outgrow the refs.
 * @returns {number} how many entries were deferred
 */
function fillReads({ entries, rows, run, cache, budget }) {
  let reads = 0;
  let deferred = 0;
  const grammar = entries.filter((e) => e.kind === 'grammar').sort(byTipThenBranch);
  for (const e of grammar) {
    const key = `${e.sha}:${e.issue}`;
    let read = cache?.get(key);
    if (!read && reads >= budget) { Object.assign(e, deferredRead()); deferred += 1; continue; }
    if (!read) {
      reads += 1;
      read = readBranch({ run, branch: e.branch, sha: e.sha, issue: e.issue });
      if (cache && read.cacheable) cache.set(key, read);
    }
    e.change = read.change;
    e.resume = read.resume;
  }
  for (const e of entries) if (e.kind === 'unjoined') { e.change = { ok: false, reason: NOT_GRAMMAR }; e.resume = null; }
  if (cache) {
    const live = new Set(rows.map((r) => r.sha));
    for (const key of [...cache.keys()]) if (!live.has(key.slice(0, key.indexOf(':')))) cache.delete(key);
  }
  return deferred;
}

/**
 * @param {{run: Function, prs: {ok: boolean, value?: object[], reason?: string},
 *   cache?: Map<string, object>|null, budget?: number}} opts
 *   `run(file, args)` is the injected git runner; `prs` is the snapshot's own PR section;
 *   `cache` is the server's in-memory memo (the CLI passes none and runs cold).
 */
export function readRemoteChanges({ run, prs, cache = null, budget = REMOTE_READ_BUDGET }) {
  let rows;
  let merged;
  let base;
  try {
    rows = parseListing(run('git', ['for-each-ref', `--format=${LISTING_FORMAT}`, ORIGIN]));
    if (rows.length === 0) return uncomputable('no refs/remotes/origin/* in this clone');
    base = resolveBase(rows);
    if (!base) return uncomputable('no base: neither origin/HEAD nor origin/main is in this clone');
    merged = new Set(String(run('git', ['for-each-ref', '--format=%(refname)', `--merged=${base}`, ORIGIN])).split('\n').filter(Boolean));
  } catch (err) {
    return uncomputable(`the remote-tracking refs could not be read: ${gitErrorLine(err)}`);
  }
  const { entries, hidden } = classify({ rows, base, merged, prs });
  const deferred = fillReads({ entries, rows, run, cache, budget });
  return field({
    base: base.slice('refs/remotes/'.length),
    branches: entries.filter((e) => e.kind === 'grammar').sort(byIssueThenBranch),
    unjoined: entries.filter((e) => e.kind === 'unjoined').sort(byTipThenBranch),
    hidden,
    prsApplied: prs.ok ? true : { ok: false, reason: prs.reason },
    deferred,
  });
}
