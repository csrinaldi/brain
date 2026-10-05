// inflight-model.mjs — what is in flight right now (#1284 D95-D98, D103). Pure,
// imported by the browser AND by node:test: no clock (the caller passes `nowMs`),
// no DOM, no fetch, no git. The git-backed times (a change dir's last commit, a bare
// worktree's head commit) arrive as data on the snapshot sections.
//
// One row per OPEN issue that any of four sources names. A source that is not ready is
// named, never read as "nothing there" (R1284-6); the model never fails as a whole.

import { hierarchyOf } from './rollup-model.mjs';
import { authorLine } from './remote-model.mjs';
import { SOURCE, progressLabel } from './progress-view.mjs';

/** A row with no activity for this many days moves to the collapsed stale group. */
export const STALE_DAYS = 7;
const DAY_MS = 86400000;

export const NO_OPEN_ISSUE = 'no open issue is in flight';
const ACTIVITY_UNKNOWN = 'activity unknown';

/** The five sections whose readiness decides whether the list can claim to be complete. */
const DATA_SECTIONS = ['changes', 'localWorktrees', 'remoteChanges', 'prs', 'hierarchy'];

const valueOf = (section) => (section?.ok === true ? section.value : null);

function missingSources(sections) {
  const out = [];
  for (const name of DATA_SECTIONS) {
    const s = sections[name];
    if (s?.ok === true) continue;
    if (s && typeof s === 'object') out.push({ name, state: s.pending === true ? 'pending' : 'failed', reason: s.reason });
    else out.push({ name, state: 'failed', reason: `no ${name} section was given` });
  }
  return out;
}

/**
 * workIndex(sections) -> {missing, byIssue} — the SAME join `buildInflight` reads, for the chips (#1308 D123).
 * `byIssue` maps an issue number to the entries of the four work sources that name it (any age: staleness is the
 * section's grouping, not a state); `missing` is the four work sources that are not ready (`hierarchy` is not
 * work evidence, so it is never listed here).
 */
export function workIndex(sections) {
  const s = sections ?? {};
  return { missing: missingSources(s).filter((m) => m.name !== 'hierarchy'), byIssue: collect(s) };
}

const noticeFor = (m) => (m.state === 'pending' ? `${m.name}: still loading` : `${m.name}: could not be read — ${m.reason}`);

/** Every issue number one of the four sources names, with that source's entries. */
function collect(sections) {
  const byIssue = new Map();
  const slot = (issue) => {
    if (!byIssue.has(issue)) byIssue.set(issue, { issue, changes: [], worktrees: [], branches: [], prs: [] });
    return byIssue.get(issue);
  };
  for (const c of valueOf(sections.changes) ?? []) if (!c.archived && Number.isInteger(c.issue)) slot(c.issue).changes.push(c);
  for (const w of valueOf(sections.localWorktrees)?.entries ?? []) if (Number.isInteger(w.issue)) slot(w.issue).worktrees.push(w);
  for (const b of valueOf(sections.remoteChanges)?.branches ?? []) if (b.kind === 'grammar' && Number.isInteger(b.issue)) slot(b.issue).branches.push(b);
  for (const p of valueOf(sections.prs) ?? []) if (Number.isInteger(p.issue)) slot(p.issue).prs.push(p);
  return byIssue;
}

const ms = (iso) => (typeof iso === 'string' ? Date.parse(iso) : NaN);

/**
 * The row's activity: the latest of every measured time (worktree `touchedAt`, branch `tipAt`, the change dir's
 * last commit when its read succeeded); only when none exists, a bare worktree's head commit (D98, D103, D105).
 */
function activityOf(c) {
  const measured = [
    ...c.worktrees.map((w) => [w.touchedAt, 'worktree files']),
    ...c.branches.map((b) => [b.tipAt, 'branch tip']),
    ...c.changes.map((x) => [x.lastCommit?.ok === true ? x.lastCommit.at : null, 'change dir last commit']),
  ];
  const fallback = c.worktrees.map((w) => [w.headCommitAt, 'worktree head commit']);
  for (const pool of [measured, fallback]) {
    let best = null;
    for (const [at, from] of pool) if (!Number.isNaN(ms(at)) && (best === null || ms(at) > ms(best.at))) best = { at, from };
    if (best) return { activityAt: best.at, activityFrom: best.from };
  }
  return { activityAt: null, activityFrom: ACTIVITY_UNKNOWN };
}

/** The issue kind, only when the hierarchy entry's level is declared; a defaulted level is not data (D104). */
function kindOf(entry) {
  return typeof entry?.level === 'string' && entry.levelSource && entry.levelSource !== 'default' ? entry.level : null;
}

/** Tasks progress, only from a served-tree change dir row that carries a `progress` value (D104). */
function progressOf(c) {
  const withProgress = c.changes.find((x) => x.progress);
  return withProgress ? progressLabel(withProgress.progress, SOURCE.workingTree, { prefix: 'tasks' }) : null;
}

function titleOf(graph, issue) {
  const node = (valueOf(graph)?.nodes ?? []).find((n) => n.number === issue);
  return node?.title ?? '';
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function rowOf(c, state, graph, entry) {
  const authors = [...new Set(c.branches.map((b) => b.author).filter(Boolean))];
  // A change-dir-only row has no branch to read an author from; the dir's last committer is the only name there is.
  if (authors.length === 0 && c.worktrees.length === 0) {
    for (const x of c.changes) if (x.lastCommit?.ok === true && x.lastCommit.author && !authors.includes(x.lastCommit.author)) authors.push(x.lastCommit.author);
  }
  return {
    issue: c.issue,
    title: titleOf(graph, c.issue),
    state,
    kind: kindOf(entry),
    progress: progressOf(c),
    ...activityOf(c),
    worktrees: c.worktrees.map((w) => ({ leaf: w.leaf, dirState: w.dirState })),
    branches: c.branches.map((b) => ({ branch: b.branch, author: b.author, tipAt: b.tipAt })),
    prs: c.prs.map((p) => p.number),
    changeDir: c.changes[0]?.id ?? null,
    authors,
    authorLines: authors.map(authorLine),
    onThisMachine: c.worktrees.length > 0,
    facts: [
      kindOf(entry),
      progressOf(c),
      c.worktrees.length > 0 ? `${plural(c.worktrees.length, 'worktree', 'worktrees')} on this machine` : null,
      c.branches.length > 0 ? `${plural(c.branches.length, 'branch', 'branches')} on origin` : null,
      ...c.prs.map((p) => `PR #${p.number}`),
      ...authors.map(authorLine),
    ].filter(Boolean),
  };
}

const newestFirst = (a, b) => ms(b.activityAt) - ms(a.activityAt) || a.issue - b.issue;

/**
 * buildInflight(sections, {nowMs}) -> {ok:true, value:{rows, unknown, stale, missingSources, candidates, notices, empty}}
 *
 * `rows` are dated and fresh, newest first; `unknown` have no activity time and follow them;
 * `stale` are dated and at least STALE_DAYS old. `candidates` is how many issues a source names.
 * `notices` is the text naming every missing source; `empty` is the one empty statement, set only
 * when every source is ready and nothing is in flight.
 */
export function buildInflight(sections, { nowMs }) {
  const s = sections ?? {};
  const missing = missingSources(s);
  const candidates = collect(s);
  const notices = missing.map(noticeFor);
  const value = { rows: [], unknown: [], stale: [], missingSources: missing, candidates: candidates.size, notices, empty: null };

  const h = hierarchyOf(s.hierarchy);
  if (!h.ok) {
    // D96: with no state there is no filter, so no row is drawn; the count says how many were named.
    value.notices = [`${candidates.size} candidate issue(s); their open/closed state is not read yet (hierarchy: ${h.pending === true ? 'still loading' : 'could not be read'} — ${h.reason})`, ...notices.filter((n) => !n.startsWith('hierarchy:'))];
    return { ok: true, value };
  }

  const dated = [];
  for (const c of [...candidates.values()].sort((a, b) => a.issue - b.issue)) {
    const entry = h.value.issues.get(c.issue);
    if (!entry) continue; // D96: the open list feeds the map completely, so an unlisted issue is not open
    if (entry.state === 'closed') continue;
    const row = rowOf(c, entry.state === 'open' ? 'open' : 'unknown', s.graph, entry);
    if (row.activityAt === null) value.unknown.push(row);
    else dated.push(row);
  }
  dated.sort(newestFirst);
  const staleMs = STALE_DAYS * DAY_MS;
  for (const row of dated) (nowMs - ms(row.activityAt) >= staleMs ? value.stale : value.rows).push(row);
  if (missing.length === 0 && dated.length === 0 && value.unknown.length === 0) value.empty = NO_OPEN_ISSUE;
  return { ok: true, value };
}
