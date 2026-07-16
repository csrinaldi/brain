// cold-boot.mjs — REQ-H1-2, REQ-H1-3: resolve headRefOid, checkout detached,
// load doctrine from durable sources only, abstain on self-review (protocol
// §8, §10 Self-review row; design.md §4). Fork A (D2, comment 4993202904):
// `fetchHead` DISPATCHES BY PROVIDER (never a bare `gh api` call — condition
// 1); TODO(#266) retires this reader once the port exposes headRefOid
// (condition 2, tasks.md Group H1-2). No resume.md/branch-name seam exists —
// absent BY CONSTRUCTION (R2).

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

function defaultFetchHead({ getVcs: getVcsFn = getVcs } = {}) {
  return async ({ project, number, provider }) => {
    const vcs = await getVcsFn({ provider });
    if (vcs.PROVIDER === 'gitlab') {
      // GitLab's MR payload carries the HEAD sha at top level (`sha`), mirrored under `diff_refs.head_sha`.
      const { apiBase, token, proxyUrl } = gitlabApiConfig();
      const path = `projects/${encodeURIComponent(project)}/merge_requests/${number}`;
      const mr = await gitlabApiFetch({ apiBase, token, proxyUrl, path });
      return mr.sha ?? mr.diff_refs?.head_sha ?? null;
    }
    // GitHub interim: prView doesn't expose headRefOid (github.mjs:157-171).
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
 * Returns `{ abstain: true, reason, author }` on self-review, else
 * `{ abstain: false, headSha, prView, doctrine: { records, priorVerdicts } }`. */
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

  return { abstain: false, headSha, prView, doctrine: { records, priorVerdicts } };
}
