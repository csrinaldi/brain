// cold-boot.mjs — REQ-H1-2, REQ-H1-3: resolve headRefOid, checkout detached,
// load doctrine from durable sources only, abstain on self-review (protocol
// §8, §10 Self-review row; design.md §4). Fork A (D2, comment 4993202904):
// H1-1 shipped an interim cold-boot DI-seam reader for the head sha; ADR-0021
// Decision 3 (Fork A condition 2) RETIRED it once the port itself exposed
// `headRefOid` on `prView` — no parallel mini-port survives. `headRefOid` now
// comes straight from the `prView` fetch below (`fetchPr`), already made for
// the self-review check. No resume.md/branch-name seam exists — absent BY
// CONSTRUCTION (R2).

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getVcs } from '../vcs/cli.mjs';
import { gitlabApiConfig } from '../vcs/ci-context.mjs';
import { readRecordObservations } from '../memory/lib/store.mjs';
import { parseVerdict } from './lib/parse-verdict.mjs';

const DOCTRINE_TYPES = new Set(['decision', 'architecture']);
/** Pure guard (REQ-H1-3): a reviewer whose handle equals the PR author abstains. */
export function evaluateSelfReview({ reviewerHandle, author }) {
  return Boolean(reviewerHandle) && Boolean(author) && reviewerHandle === author;
}

function defaultFetchPr({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => (await getVcsFn({ provider })).prView({ project, number });
}

// COLDBOOT-CWD fix (protocol §8 "own clone/worktree"): NEVER `git checkout` in
// the operator's cwd — that moves their HEAD (state-loss). Fetch the shas into
// the operator's object db, then check the head out in a SEPARATE detached
// worktree. `fetch`/`tmp` are seams so the isolation logic is testable without
// a remote.
//
// COLDBOOT-DEPTH fix (issue #291, I291-AMBIENT-STATE): fetch WITH history (NO
// `--depth 1`) and fetch BOTH the head AND the base. A shallow head graft has
// no ancestors, so the three-dot `git diff base...head` (cli.mjs
// getChangedFiles) finds no merge-base and the §10.4 reversion has no base
// tree — the #290 crasher. Cold boot must be self-sufficient: bring both prView
// shas explicitly, never leaning on whatever the operator's clone happens to
// contain (Law 2 at the plumbing layer). Full-history-both is the obvious
// simple choice at this repo's size (reviewer ruling #291); revisit only if
// fetch cost bites on CI shallow clones.
export function defaultCloneDetached({ cwd = process.cwd(), fetch, tmp = tmpdir() } = {}) {
  const doFetch = fetch ?? (sha => execFileSync('git', ['fetch', 'origin', sha], { cwd, encoding: 'utf8' }));
  return ({ sha, baseSha } = {}) => {
    if (baseSha) doFetch(baseSha);
    doFetch(sha);
    const worktreePath = join(tmp, `brain-review-${sha}`);
    // Clear any prior worktree at this path so `worktree add` never fails:
    // `remove` unregisters a registered one; `prune` + rm clears a bare
    // leftover dir (the "is not a working tree" noise, issue #291 secondary).
    try { execFileSync('git', ['worktree', 'remove', '--force', worktreePath], { cwd, encoding: 'utf8' }); } catch { /* not a registered worktree */ }
    try { execFileSync('git', ['worktree', 'prune'], { cwd, encoding: 'utf8' }); } catch { /* best effort */ }
    if (existsSync(worktreePath)) rmSync(worktreePath, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, sha], { cwd, encoding: 'utf8' });
    return { detached: true, sha, baseSha: baseSha ?? null, worktreePath };
  };
}

function defaultReadRecords({ cwd = process.cwd() } = {}) {
  return () => readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
}

// NOTE: prReviews's shape is `{ state, author }` only, no `body` (flagged with H1-2); tests inject fixtures with `body`.
function defaultFetchReviews({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const reviews = await vcs.prReviews({ project, number, apiBase, token, proxyUrl });
    return reviews ?? [];
  };
}

/** Self-review guard, then headRefOid + detached checkout + doctrine load.
 * `headRefOid` (ADR-0021 Decision 1/3) comes straight from `prView` — the
 * same fetch already made for the self-review check above; no separate
 * DI-seam reader exists for it anymore.
 * Returns `{ abstain: true, reason, author }` on self-review, else
 * `{ abstain: false, headSha, prView, doctrine: { records, priorVerdicts } }`. */
export async function gatherColdBoot({ project, number, provider, reviewerHandle, deps = {} } = {}) {
  const fetchPr = deps.fetchPr ?? defaultFetchPr(deps);
  const prView = await fetchPr({ project, number, provider });

  if (evaluateSelfReview({ reviewerHandle, author: prView.author })) {
    return { abstain: true, reason: 'self-review: reviewer handle equals PR author', author: prView.author };
  }

  const cloneDetached = deps.cloneDetached ?? defaultCloneDetached(deps);
  const readRecords = deps.readRecords ?? defaultReadRecords(deps);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(deps);

  const headSha = prView.headRefOid;
  // Fetch the PR's base tip too (issue #291): the diff/reversion downstream need
  // it present with history. `null` when the port can't compute it — cloneDetached
  // then skips the base fetch (same as before), no regression.
  const baseSha = prView.baseRefOid ?? null;
  const clone = await cloneDetached({ sha: headSha, baseSha });

  const records = readRecords().filter(r => DOCTRINE_TYPES.has(r?.type));
  const reviews = await fetchReviews({ project, number, provider });
  const priorVerdicts = reviews.map(r => parseVerdict(r)).filter(Boolean);

  // worktreePath: the isolated detached worktree (H1-2 evaluators operate inside it).
  return { abstain: false, headSha, worktreePath: clone?.worktreePath, prView, doctrine: { records, priorVerdicts } };
}
