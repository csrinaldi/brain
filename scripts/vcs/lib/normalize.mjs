// normalize.mjs — Shared normalization helpers for VCS providers.
//
// Providers map their host-native shapes to the normalized contract defined in
// brain/core/methodology/vcs-contract.md. These helpers hold the cross-provider
// mappings so each provider doesn't re-implement them. Pure functions — unit
// tested in scripts/vcs/cli.test.mjs.

// Canonical commit-status enum (GitLab style). Providers map their native enum
// to one of these. `null` means "no status available".
export const COMMIT_STATUS = ['success', 'failed', 'running', 'pending', 'canceled'];

// GitHub check-run/commit-status values → canonical enum.
const GITHUB_STATUS_MAP = {
  success: 'success',
  failure: 'failed',
  error: 'failed',
  cancelled: 'canceled',
  canceled: 'canceled',
  timed_out: 'failed',
  action_required: 'pending', // approval gate blocking the run — closest fit is pending (not 'failed')
  pending: 'pending',
  in_progress: 'running', // a check actively running — distinct from queued/pending
  queued: 'pending',
  neutral: null,
  skipped: null,
};

/**
 * Normalizes a provider-native commit/check status to the canonical enum.
 * @param {'github'|'gitlab'} provider
 * @param {string|null|undefined} raw
 * @returns {'success'|'failed'|'running'|'pending'|'canceled'|null}
 */
export function normalizeCommitStatus(provider, raw) {
  if (raw == null) return null;
  if (provider === 'github') return GITHUB_STATUS_MAP[raw] ?? null;
  // GitLab is already canonical, but guard against unknown values.
  return COMMIT_STATUS.includes(raw) ? raw : null;
}

/**
 * Normalizes an issue/MR state filter to the wire value a provider expects.
 * The contract uses 'open'; GitLab's API wants 'opened'.
 * @param {'github'|'gitlab'} provider
 * @param {string} state  Canonical state ('open' | 'closed' | ...).
 * @returns {string}
 */
export function providerState(provider, state = 'open') {
  if (provider === 'gitlab') return state === 'open' ? 'opened' : state;
  return state;
}

/**
 * Normalizes an assignee filter ('me' | 'none' | undefined) to provider syntax.
 * Returns an object of query params to merge into the request, so each provider
 * stays declarative.
 * @param {'github'|'gitlab'} provider
 * @param {'me'|'none'|undefined} assignee
 * @param {string} [currentUser] Required by GitLab for the 'me' case.
 * @returns {object}
 */
export function assigneeParams(provider, assignee, currentUser) {
  if (!assignee) return {};
  if (provider === 'gitlab') {
    if (assignee === 'none') return { assignee_id: 'None' };
    if (assignee === 'me') return { assignee_username: currentUser };
  }
  if (provider === 'github') {
    return { assignee: assignee === 'me' ? (currentUser ?? '@me') : 'none' };
  }
  return {};
}
