// cold-boot.mjs — REQ-H1-2, REQ-H1-3: resolve headRefOid, checkout detached,
// load doctrine from durable sources only, abstain on self-review (protocol
// §8, §10 Self-review row; design.md §4).
//
// Fork A (D2, issue #266 comment 4993202904) — condition 1: the default
// `fetchHead` DISPATCHES BY PROVIDER (github via `gh api`, gitlab via the
// shared gitlabApiFetch transport over the same merge_requests/:iid payload
// `prView` already reads) — never a bare, unconditional `gh api` call.
// Condition 2: this reader carries a WRITTEN RETIREMENT DATE — it is retired
// in H1-2 when the port exposes `headRefOid` on `prView` (or a rollup verb),
// its own ADR (see tasks.md Group H1-2). Never a resume.md seam, never a
// branch-name fetch — those inputs are absent from this file BY
// CONSTRUCTION (R2): rejected boot input is enforced by "the code path does
// not exist", not remembered as a rule.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { getVcs } from '../vcs/cli.mjs';
import { run } from '../vcs/lib/exec.mjs';
import { gitlabApiFetch } from '../vcs/gitlab-api.mjs';
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

// TODO(#266): H1-2 retirement (Fork A condition 2, comment 4993202904) —
// retire this reader once `prView`/a rollup verb exposes headRefOid on the
// port — that widening is its own decision + ADR, scoped to H1-2.
function defaultFetchHead({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => {
    const vcs = await getVcsFn({ provider });
    if (vcs.PROVIDER === 'gitlab') {
      const { apiBase, token, proxyUrl } = gitlabApiConfig();
      const mr = await gitlabApiFetch({
        apiBase, token, proxyUrl,
        path: `projects/${encodeURIComponent(project)}/merge_requests/${number}`,
      });
      // GitLab's MR payload carries the current source-branch HEAD sha at the
      // top level (`sha`), mirrored under `diff_refs.head_sha` — read both,
      // defensively, never fabricating a value.
      return mr.sha ?? mr.diff_refs?.head_sha ?? null;
    }
    // GitHub interim: `gh pr view --json` (github.mjs's prView) does not
    // expose headRefOid (github.mjs:157-171) — read it directly.
    const r = run('gh', ['api', `repos/${project}/pulls/${number}`, '--jq', '.head.sha']);
    if (!r.ok) throw new Error(`cold-boot: could not resolve headRefOid for PR #${number} — ${r.stderr.trim()}`);
    return r.stdout.trim();
  };
}

function defaultCloneDetached({ cwd = process.cwd() } = {}) {
  return ({ sha }) => {
    execFileSync('git', ['fetch', '--depth', '1', 'origin', sha], { cwd, encoding: 'utf8' });
    execFileSync('git', ['checkout', '--detach', sha], { cwd, encoding: 'utf8' });
    return { detached: true, sha };
  };
}

function defaultReadRecords({ cwd = process.cwd() } = {}) {
  return () => readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
}

// NOTE: `prReviews`'s normalized shape is `{ state, author }` only
// (github.mjs:219-227, gitlab.mjs:194-209) — it does not carry `body`, so
// this default cannot itself surface a live `brain-review/1` block yet.
// Flagged alongside the Fork A port-widening slice (H1-2); tests inject
// `fetchReviews` fixtures with `body` directly.
function defaultFetchReviews({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const reviews = await vcs.prReviews({ project, number, apiBase, token, proxyUrl });
    return reviews ?? [];
  };
}

/**
 * Runs cold boot: self-review guard, then headRefOid resolution + detached
 * checkout + doctrine load. Returns `{ abstain: true, reason, author }` on
 * self-review (no I/O beyond the PR fetch), otherwise
 * `{ abstain: false, headSha, prView, doctrine: { records, priorVerdicts } }`.
 *
 * @param {{ project: string, number: number, provider?: string, reviewerHandle?: string, deps?: object }} args
 */
export async function gatherColdBoot({ project, number, provider, reviewerHandle, deps = {} } = {}) {
  const fetchPr = deps.fetchPr ?? defaultFetchPr(deps);
  const prView = await fetchPr({ project, number, provider });

  if (evaluateSelfReview({ reviewerHandle, author: prView.author })) {
    return { abstain: true, reason: 'self-review: reviewer handle equals PR author', author: prView.author };
  }

  const fetchHead = deps.fetchHead ?? defaultFetchHead(deps);
  const cloneDetached = deps.cloneDetached ?? defaultCloneDetached(deps);
  const readRecords = deps.readRecords ?? defaultReadRecords(deps);
  const fetchReviews = deps.fetchReviews ?? defaultFetchReviews(deps);

  const headSha = await fetchHead({ project, number, provider });
  await cloneDetached({ sha: headSha });

  const records = readRecords().filter(r => DOCTRINE_TYPES.has(r?.type));
  const reviews = await fetchReviews({ project, number, provider });
  const priorVerdicts = reviews.map(r => parseVerdict(r)).filter(Boolean);

  return {
    abstain: false,
    headSha,
    prView,
    doctrine: { records, priorVerdicts },
  };
}
