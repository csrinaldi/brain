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
// Committed tier only (R881-3, R881-8, R881-10): `spec.md`/`tasks.md` are
// read from the SERVED ROOT's working tree (the same tree `buildSnapshot`
// already reads — no worktree content, no linked worktree's `.git`); the
// blame and the branch/resume reads run `git` on the served root's OWN git
// dir via a plain `execFileSync`/injected `_run` — never `git -C <worktree>`
// and never a linked worktree's working tree. `HEAD` is mandatory in the
// blame argv for exactly that reason: the committed version, never the
// index or the working copy.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { parseSpecCards } from './lib/spec-cards.mjs';
import { parseTasksList } from './lib/tasks-list.mjs';
import { parseBlame } from './lib/blame.mjs';
import { shapeResumeView } from './lib/resume-view.mjs';
import { parseFrontmatter } from '../memory/lib/resume-frontmatter.mjs';

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

function buildSpecTab({ read, dir, issue }) {
  if (!dir) return noChangeDirTab(issue);
  const path = `${dir}/spec.md`;
  let text;
  try { text = read(path); } catch (err) { return { ok: false, reason: `${path} could not be read: ${err?.message ?? err}`, source: { path } }; }
  return parseSpecCards({ text, path });
}

/**
 * `tasks-list.mjs` already never drops a line for missing attribution (it
 * renders `actor: 'unknown'`) — this wraps EVERY item with its own
 * `attribution` leaf so a blame failure is SAID per row (source-guard's
 * "never empty-on-failure"), not silently folded into "unknown", while the
 * checklist itself still renders in full either way.
 */
function attachAttribution(items, blame) {
  return items.map((item) => ({
    ...item,
    attribution: blame.ok
      ? { ok: true, value: { actor: item.actor, ts: item.ts } }
      : { ok: false, reason: blame.reason },
  }));
}

function buildTasksTab({ read, run, dir, issue }) {
  if (!dir) return noChangeDirTab(issue);
  const path = `${dir}/tasks.md`;
  let text;
  try { text = read(path); } catch (err) { return { ok: false, reason: `${path} could not be read: ${err?.message ?? err}`, source: { path } }; }

  let blame;
  try {
    // Committed version only — `HEAD` is mandatory (R881-3): never the
    // working tree, never the index.
    const blameText = run('git', ['blame', '--porcelain', 'HEAD', '--', path]);
    blame = parseBlame({ text: blameText });
  } catch (err) {
    blame = { ok: false, reason: err?.message ?? String(err) };
  }

  const attribution = blame.ok
    ? Object.entries(blame.value).map(([line, a]) => ({ line: Number(line), actor: a.author ?? 'unknown', ts: a.authorTime ?? null }))
    : [];

  const parsed = parseTasksList({ text, path, attribution });
  if (!parsed.ok) return parsed;
  return { ok: true, value: attachAttribution(parsed.value, blame) };
}

/**
 * D12's branch resolution, in order: the issue's open PR headBranch, else the
 * single `feat/issue-<N>-*` branch in this clone — never picking among more
 * than one.
 */
function resolveBranch({ run, snapshot, issue }) {
  const prMatch = snapshot?.prs?.ok ? snapshot.prs.value.find((p) => p.issue === issue) : null;
  if (prMatch?.headBranch) return { ok: true, branch: prMatch.headBranch };

  let listed;
  try {
    listed = run('git', ['branch', '--list', `feat/issue-${issue}-*`]);
  } catch (err) {
    return { ok: false, reason: `git branch --list failed: ${err?.message ?? err}` };
  }
  const names = listed.split(/\r?\n/).map((l) => l.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  if (names.length === 0) return { ok: false, reason: `no open PR and no feat/issue-${issue}-* branch in this clone` };
  if (names.length > 1) return { ok: false, reason: `more than one feat/issue-${issue}-* branch in this clone: ${names.join(', ')}` };
  return { ok: true, branch: names[0] };
}

function buildWorkingMemoryTab({ run, snapshot, issue }) {
  const resolved = resolveBranch({ run, snapshot, issue });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const { branch } = resolved;
  let text;
  try {
    text = run('git', ['show', `${branch}:resume.md`]);
  } catch {
    return { ok: false, reason: `no committed resume.md on ${branch}; the local overlay arrives in slice 5 (#883)` };
  }
  const { frontmatter } = parseFrontmatter(text);
  return { ok: true, value: shapeResumeView({ frontmatter, branch }) };
}

function buildPrUrl(project, pr) {
  return project ? `https://github.com/${project}/pull/${pr}` : `pull/${pr}`;
}

/** D14: every round, oldest first (already the order `reviewRows` builds), sourced to the PR — no per-round anchor exists in this repo's provider today (github.mjs:564 drops it). */
function buildReviewsTab({ snapshot, project, issue }) {
  if (!snapshot?.prs?.ok) return { ok: false, reason: 'the PR list could not be read', sourceNote: REVIEWS_SOURCE_NOTE };
  if (!snapshot?.reviews?.ok) return { ok: false, reason: 'the reviews list could not be read', sourceNote: REVIEWS_SOURCE_NOTE };

  const prNumbers = new Set(snapshot.prs.value.filter((p) => p.issue === issue).map((p) => p.number));
  const rounds = [];
  for (const row of snapshot.reviews.value) {
    if (!prNumbers.has(row.pr) || !row.ok) continue; // an unreadable thread degrades, never crashes the tab
    for (const verdict of row.verdicts) {
      rounds.push({ ...verdict, source: { url: verdict.commentUrl ?? buildPrUrl(project, row.pr) } });
    }
  }
  return { ok: true, value: rounds, sourceNote: REVIEWS_SOURCE_NOTE };
}

/**
 * buildChangeView() — the drawer's one composition. Server-side only (D11):
 * the four tabs' IO happens here, the pure shapers just attach `source`.
 *
 * `project` is not in D8's module-map signature verbatim but is required to
 * build a PR URL (D14) the same way `server.mjs`'s `buildMeta()` already
 * carries it — an accepted, disclosed addition, optional and defaulting to
 * `null` (degrades to a relative `pull/<n>` reference, still a non-empty
 * `source.url`, never a crash).
 *
 * @param {{root: string, issue: number, snapshot: object, project?: string|null,
 *   _read?: Function, _run?: Function, _exists?: Function}} opts
 * @returns {{ok:true, value:{issue:number, changeDir:string|null, spec:object, tasks:object, workingMemory:object, reviews:object}} | {ok:false, reason:string}}
 */
export function buildChangeView({ root, issue, snapshot, project = null, _read, _run, _exists } = {}) {
  if (!Number.isInteger(issue) || issue <= 0) return { ok: false, reason: 'issue must be a positive integer' };
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'no snapshot was supplied' };

  // `_exists` is accepted for signature parity with the rest of `snapshot.mjs`'s
  // readers (`readChanges`'s own `{_read, _list, _exists}` seam) but unused
  // today — `read()`'s own catch already covers "the file is not there".
  void _exists;

  const read = _read ?? ((p) => readFileSync(join(root, p), 'utf8'));
  const run = _run ?? ((file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));

  const dir = findChangeDir(snapshot, issue);

  return {
    ok: true,
    value: {
      issue,
      changeDir: dir,
      spec: buildSpecTab({ read, dir, issue }),
      tasks: buildTasksTab({ read, run, dir, issue }),
      workingMemory: buildWorkingMemoryTab({ run, snapshot, issue }),
      reviews: buildReviewsTab({ snapshot, project, issue }),
    },
  };
}
